<?php
declare(strict_types=1);

require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/config.php';

function hv_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function hv_get_current_user(): array
{
    hv_require_login();

    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        hv_json(['ok' => false, 'error' => 'Unauthorized'], 401);
    }

    global $conn;
    $stmt = $conn->prepare(
        'SELECT u.id, u.first_name, u.last_name, u.role_id, u.barangay_id, r.role_name,
                b.barangay_name, m.municipality_name, p.province_name
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         INNER JOIN barangays b ON b.id = u.barangay_id
         INNER JOIN municipalities m ON m.id = b.municipality_id
         INNER JOIN provinces p ON p.id = m.province_id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        hv_json(['ok' => false, 'error' => 'User record not found'], 401);
    }

    return $row;
}

function hv_get_report_status_row_by_code(string $statusCode): ?array
{
    global $conn;
    $stmt = $conn->prepare('SELECT id, status_label FROM report_statuses WHERE status_code = ? LIMIT 1');
    $stmt->bind_param('s', $statusCode);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function hv_get_assignment_status_row_by_code(string $statusCode): ?array
{
    global $conn;
    $stmt = $conn->prepare('SELECT id, status_label FROM responder_assignment_statuses WHERE status_code = ? LIMIT 1');
    $stmt->bind_param('s', $statusCode);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function hv_fetch_scope_ids_by_barangay_id(int $barangayId): ?array
{
    global $conn;
    $stmt = $conn->prepare(
        'SELECT b.id AS barangay_id, b.municipality_id, m.province_id
         FROM barangays b
         INNER JOIN municipalities m ON m.id = b.municipality_id
         WHERE b.id = ?
         LIMIT 1'
    );
    $stmt->bind_param('i', $barangayId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function hv_barangay_can_use_responder(int $responderUserId, int $requestBarangayId, int $municipalityId, int $provinceId): bool
{
    global $conn;
    $responderRoleCode = 'responder';
    $stmt = $conn->prepare(
        'SELECT 1
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         INNER JOIN barangays b ON b.id = u.barangay_id
         WHERE u.id = ?
           AND u.is_active = 1
           AND LOWER(TRIM(r.role_code)) = ?
           AND (
             EXISTS (
               SELECT 1
               FROM responder_scope_rules rsr
               WHERE rsr.responder_user_id = u.id
                 AND rsr.is_active = 1
                 AND (
                   (LOWER(TRIM(rsr.scope_level)) = "barangay" AND rsr.barangay_id = ?)
                   OR (LOWER(TRIM(rsr.scope_level)) = "municipality" AND rsr.municipality_id = ?)
                   OR (LOWER(TRIM(rsr.scope_level)) = "province" AND rsr.province_id = ?)
                 )
             )
             OR (
               NOT EXISTS (
                 SELECT 1
                 FROM responder_scope_rules rsr2
                 WHERE rsr2.responder_user_id = u.id
                   AND rsr2.is_active = 1
               )
               AND b.id = ?
             )
           )
         LIMIT 1'
    );
    $stmt->bind_param('isiiii', $responderUserId, $responderRoleCode, $requestBarangayId, $municipalityId, $provinceId, $requestBarangayId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return (bool)$row;
}

function hv_set_responder_availability_if_exists(int $responderUserId, string $availabilityCode, int $updatedByUserId, string $note): void
{
    global $conn;

    $statusStmt = $conn->prepare('SELECT id FROM responder_availability_statuses WHERE status_code = ? LIMIT 1');
    $statusStmt->bind_param('s', $availabilityCode);
    $statusStmt->execute();
    $statusRow = $statusStmt->get_result()->fetch_assoc();
    $statusStmt->close();
    if (!$statusRow) return;

    $availabilityId = (int)$statusRow['id'];

    $update = $conn->prepare(
        'UPDATE responder_profiles
         SET availability_status_id = ?, last_availability_changed_at = CURRENT_TIMESTAMP
         WHERE user_id = ?'
    );
    $update->bind_param('ii', $availabilityId, $responderUserId);
    $update->execute();
    $update->close();

    $history = $conn->prepare(
        'INSERT INTO responder_availability_history (responder_user_id, availability_status_id, changed_by_user_id, note)
         VALUES (?, ?, ?, ?)'
    );
    $history->bind_param('iiis', $responderUserId, $availabilityId, $updatedByUserId, $note);
    $history->execute();
    $history->close();
}
