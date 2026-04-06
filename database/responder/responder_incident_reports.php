<?php
declare(strict_types=1);

require_once __DIR__ . '/../incident_common.php';

function hv_has_col(mysqli $conn, string $table, string $column): bool
{
    $stmt = $conn->prepare(
        'SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1'
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $exists = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    return $exists;
}

function hv_ensure_col(mysqli $conn, string $table, string $column, string $definition): void
{
    if (hv_has_col($conn, $table, $column)) return;
    $conn->query('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $definition);
}

function hv_ensure_responder_location_columns(mysqli $conn): void
{
    hv_ensure_col($conn, 'responder_profiles', 'latitude', 'DECIMAL(10,7) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'longitude', 'DECIMAL(10,7) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'location_accuracy_m', 'DECIMAL(8,2) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'last_location_at', 'DATETIME NULL');
}

function hv_handle_responder_active_assignment(): void
{
    $user = hv_get_current_user();
    if ((string)$user['role_name'] !== 'Responder') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $requestedAssignmentId = (int)($_GET['assignment_id'] ?? 0);
    $uid = (int)$user['id'];

    global $conn;
    if ($requestedAssignmentId > 0) {
        $stmt = $conn->prepare(
            'SELECT a.id AS assignment_id, a.hazard_report_id, a.assigned_at,
                    rs.status_code, rs.status_label,
                    hr.location_text, hr.description, hr.latitude, hr.longitude,
                    ht.type_name AS hazard_type,
                    CONCAT(au.first_name, " ", au.last_name) AS assigned_by_name
             FROM hazard_report_assignments a
             INNER JOIN hazard_report_assignment_responders ar ON ar.assignment_id = a.id
             INNER JOIN responder_assignment_statuses rs ON rs.id = a.assignment_status_id
             INNER JOIN hazard_reports hr ON hr.id = a.hazard_report_id
             INNER JOIN hazard_types ht ON ht.id = hr.hazard_type_id
             INNER JOIN users au ON au.id = a.assigned_by_user_id
             WHERE a.id = ?
               AND ar.responder_user_id = ?
               AND a.active_flag = 1
             LIMIT 1'
        );
        $stmt->bind_param('ii', $requestedAssignmentId, $uid);
    } else {
        $stmt = $conn->prepare(
            'SELECT a.id AS assignment_id, a.hazard_report_id, a.assigned_at,
                    rs.status_code, rs.status_label,
                    hr.location_text, hr.description, hr.latitude, hr.longitude,
                    ht.type_name AS hazard_type,
                    CONCAT(au.first_name, " ", au.last_name) AS assigned_by_name
             FROM hazard_report_assignments a
             INNER JOIN hazard_report_assignment_responders ar ON ar.assignment_id = a.id
             INNER JOIN responder_assignment_statuses rs ON rs.id = a.assignment_status_id
             INNER JOIN hazard_reports hr ON hr.id = a.hazard_report_id
             INNER JOIN hazard_types ht ON ht.id = hr.hazard_type_id
             INNER JOIN users au ON au.id = a.assigned_by_user_id
             WHERE ar.responder_user_id = ?
               AND a.active_flag = 1
             ORDER BY a.assigned_at DESC, a.id DESC
             LIMIT 1'
        );
        $stmt->bind_param('i', $uid);
    }

    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        hv_json(['ok' => true, 'assignment' => null]);
    }

    hv_json([
        'ok' => true,
        'assignment' => [
            'assignmentId' => (int)$row['assignment_id'],
            'reportId' => (int)$row['hazard_report_id'],
            'statusCode' => (string)$row['status_code'],
            'statusLabel' => (string)$row['status_label'],
            'hazardType' => (string)$row['hazard_type'],
            'location' => (string)$row['location_text'],
            'description' => (string)$row['description'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'assignedBy' => (string)$row['assigned_by_name'],
            'assignedAt' => (string)$row['assigned_at'],
        ],
    ]);
}

function hv_handle_responder_update_status(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    if ((string)$user['role_name'] !== 'Responder') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $assignmentId = (int)($data['assignmentId'] ?? 0);
    $statusCode = strtolower(trim((string)($data['statusCode'] ?? '')));
    $note = trim((string)($data['note'] ?? ''));
    $allowed = ['on_the_way', 'arrived', 'responding', 'resolved'];
    if ($assignmentId <= 0 || !in_array($statusCode, $allowed, true)) hv_json(['ok' => false, 'error' => 'Invalid status input'], 422);

    global $conn;
    try {
        $conn->begin_transaction();

        $check = $conn->prepare(
            'SELECT a.id, a.hazard_report_id, COALESCE(LOWER(TRIM(ras.status_code)), "assigned") AS current_status_code
             FROM hazard_report_assignments a
             INNER JOIN hazard_report_assignment_responders ar ON ar.assignment_id = a.id
             INNER JOIN responder_assignment_statuses ras ON ras.id = a.assignment_status_id
             WHERE a.id = ?
               AND a.active_flag = 1
               AND ar.responder_user_id = ?
             LIMIT 1'
        );
        $uid = (int)$user['id'];
        $check->bind_param('ii', $assignmentId, $uid);
        $check->execute();
        $assignmentRow = $check->get_result()->fetch_assoc();
        $check->close();
        if (!$assignmentRow) throw new RuntimeException('Assignment not found');

        $currentStatusCode = strtolower(trim((string)($assignmentRow['current_status_code'] ?? 'assigned')));
        if ($currentStatusCode === 'responders_assigned') $currentStatusCode = 'assigned';

        $statusOrder = [
            'assigned' => 0,
            'on_the_way' => 1,
            'arrived' => 2,
            'responding' => 3,
            'resolved' => 4,
        ];

        if (!array_key_exists($currentStatusCode, $statusOrder)) {
            throw new RuntimeException('Current assignment status is invalid');
        }

        $currentIdx = $statusOrder[$currentStatusCode];
        $nextIdx = $statusOrder[$statusCode] ?? -1;
        if ($nextIdx !== ($currentIdx + 1)) {
            throw new RuntimeException('Invalid transition. Please update status step-by-step.');
        }

        $assignmentStatusRow = hv_get_assignment_status_row_by_code($statusCode);
        if (!$assignmentStatusRow) throw new RuntimeException('Assignment status missing');
        $assignmentStatusId = (int)$assignmentStatusRow['id'];

        $fieldSql = '';
        if ($statusCode === 'on_the_way') $fieldSql = ', accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)';
        if ($statusCode === 'arrived') $fieldSql = ', arrived_at = COALESCE(arrived_at, CURRENT_TIMESTAMP)';
        if ($statusCode === 'responding') $fieldSql = ', response_started_at = COALESCE(response_started_at, CURRENT_TIMESTAMP)';
        if ($statusCode === 'resolved') $fieldSql = ', resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)';

        $updateAssignment = $conn->prepare('UPDATE hazard_report_assignments SET assignment_status_id = ?' . $fieldSql . ' WHERE id = ?');
        $updateAssignment->bind_param('ii', $assignmentStatusId, $assignmentId);
        $updateAssignment->execute();
        $updateAssignment->close();

        $historyNote = $note !== '' ? $note : ('Responder updated status to ' . $statusCode);
        $insertAssignmentHistory = $conn->prepare('INSERT INTO hazard_report_assignment_status_history (assignment_id, assignment_status_id, updated_by_user_id, note) VALUES (?, ?, ?, ?)');
        $insertAssignmentHistory->bind_param('iiis', $assignmentId, $assignmentStatusId, $uid, $historyNote);
        $insertAssignmentHistory->execute();
        $insertAssignmentHistory->close();

        $reportStatusRow = hv_get_report_status_row_by_code($statusCode);
        if (!$reportStatusRow) throw new RuntimeException('Report status missing for ' . $statusCode);
        $reportStatusId = (int)$reportStatusRow['id'];

        $reportId = (int)$assignmentRow['hazard_report_id'];
        $updateReport = $conn->prepare('UPDATE hazard_reports SET status_id = ? WHERE id = ?');
        $updateReport->bind_param('ii', $reportStatusId, $reportId);
        $updateReport->execute();
        $updateReport->close();

        $insertReportHistory = $conn->prepare('INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note) VALUES (?, ?, ?, ?)');
        $reportNote = 'Responder #' . $uid . ' set status to ' . $statusCode;
        $insertReportHistory->bind_param('iiis', $reportId, $reportStatusId, $uid, $reportNote);
        $insertReportHistory->execute();
        $insertReportHistory->close();

        if ($statusCode === 'resolved') hv_set_responder_availability_if_exists($uid, 'available', $uid, 'Marked assignment #' . $assignmentId . ' as resolved');

        $conn->commit();
        hv_json(['ok' => true, 'assignmentId' => $assignmentId, 'reportId' => $reportId, 'statusCode' => $statusCode, 'statusLabel' => (string)$reportStatusRow['status_label']]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        if ($e instanceof RuntimeException) {
            hv_json(['ok' => false, 'error' => $e->getMessage()], 409);
        }
        hv_json(['ok' => false, 'error' => 'Responder status update failed'], 500);
    }
}

function hv_handle_responder_update_location(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    if ((string)$user['role_name'] !== 'Responder') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $lat = isset($data['latitude']) && is_numeric($data['latitude']) ? (float)$data['latitude'] : null;
    $lng = isset($data['longitude']) && is_numeric($data['longitude']) ? (float)$data['longitude'] : null;
    $accuracy = isset($data['accuracy']) && is_numeric($data['accuracy']) ? (float)$data['accuracy'] : null;

    if ($lat === null || $lng === null) hv_json(['ok' => false, 'error' => 'Latitude and longitude are required'], 422);
    if ($lat < -90.0 || $lat > 90.0) hv_json(['ok' => false, 'error' => 'Latitude out of range'], 422);
    if ($lng < -180.0 || $lng > 180.0) hv_json(['ok' => false, 'error' => 'Longitude out of range'], 422);
    if ($accuracy !== null && $accuracy < 0) $accuracy = null;

    global $conn;
    try {
        hv_ensure_responder_location_columns($conn);

        $uid = (int)$user['id'];
        $latSql = (string)$lat;
        $lngSql = (string)$lng;
        $accuracySql = ($accuracy !== null && is_finite($accuracy)) ? (string)$accuracy : null;

        $stmt = $conn->prepare(
            'INSERT INTO responder_profiles (user_id, latitude, longitude, location_accuracy_m, last_location_at)
             VALUES (?, NULLIF(?, ""), NULLIF(?, ""), NULLIF(?, ""), CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
                latitude = VALUES(latitude),
                longitude = VALUES(longitude),
                location_accuracy_m = VALUES(location_accuracy_m),
                last_location_at = CURRENT_TIMESTAMP'
        );
        $stmt->bind_param('isss', $uid, $latSql, $lngSql, $accuracySql);
        $stmt->execute();
        $stmt->close();

        hv_json([
            'ok' => true,
            'latitude' => $lat,
            'longitude' => $lng,
            'accuracy' => $accuracy,
            'updatedAt' => gmdate('c'),
        ]);
    } catch (Throwable $e) {
        hv_json(['ok' => false, 'error' => 'Failed to update responder location'], 500);
    }
}

function hv_handle_responder_dashboard_metrics(): void
{
    $user = hv_get_current_user();
    if ((string)$user['role_name'] !== 'Responder') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $uid = (int)$user['id'];
    global $conn;

    $statusCode = '';
    $statusStmt = $conn->prepare(
        'SELECT COALESCE(LOWER(TRIM(rs.status_code)), "") AS status_code
         FROM hazard_report_assignments a
         INNER JOIN responder_assignment_statuses rs ON rs.id = a.assignment_status_id
         INNER JOIN (
            SELECT DISTINCT assignment_id
            FROM hazard_report_assignment_responders
            WHERE responder_user_id = ?
         ) ar ON ar.assignment_id = a.id
         WHERE a.active_flag = 1
         ORDER BY a.assigned_at DESC, a.id DESC
         LIMIT 1'
    );
    $statusStmt->bind_param('i', $uid);
    $statusStmt->execute();
    $statusRow = $statusStmt->get_result()->fetch_assoc();
    $statusStmt->close();
    if ($statusRow && isset($statusRow['status_code'])) {
        $statusCode = strtolower(trim((string)$statusRow['status_code']));
    }

    $statusLabel = 'No assignment';
    if ($statusCode === 'responders_assigned' || $statusCode === 'assigned') $statusLabel = 'Assigned';
    if ($statusCode === 'on_the_way') $statusLabel = 'On the Way';
    if ($statusCode === 'arrived') $statusLabel = 'Arrived';
    if ($statusCode === 'responding') $statusLabel = 'Responding';
    if ($statusCode === 'resolved') $statusLabel = 'Resolved';

    $today = [
        'total' => 0,
        'resolved' => 0,
        'active' => 0,
    ];
    $todayStmt = $conn->prepare(
        'SELECT
            COUNT(DISTINCT a.id) AS total_count,
            COUNT(DISTINCT CASE
                WHEN LOWER(TRIM(COALESCE(rs.status_code, ""))) = "resolved"
                     OR a.resolved_at IS NOT NULL
                THEN a.id
                ELSE NULL
            END) AS resolved_count,
            COUNT(DISTINCT CASE
                WHEN a.active_flag = 1
                     AND LOWER(TRIM(COALESCE(rs.status_code, ""))) <> "resolved"
                THEN a.id
                ELSE NULL
            END) AS active_count
         FROM hazard_report_assignments a
         INNER JOIN (
            SELECT DISTINCT assignment_id
            FROM hazard_report_assignment_responders
            WHERE responder_user_id = ?
         ) ar ON ar.assignment_id = a.id
         LEFT JOIN responder_assignment_statuses rs ON rs.id = a.assignment_status_id
         WHERE DATE(a.assigned_at) = CURRENT_DATE()'
    );
    $todayStmt->bind_param('i', $uid);
    $todayStmt->execute();
    $todayRow = $todayStmt->get_result()->fetch_assoc();
    $todayStmt->close();
    if ($todayRow) {
        $today['total'] = (int)($todayRow['total_count'] ?? 0);
        $today['resolved'] = (int)($todayRow['resolved_count'] ?? 0);
        $today['active'] = (int)($todayRow['active_count'] ?? 0);
    }

    $avgMinutes = null;
    $avgStmt = $conn->prepare(
        'SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(a.accepted_at, a.assigned_at), a.resolved_at)) AS avg_minutes
         FROM hazard_report_assignments a
         INNER JOIN (
            SELECT DISTINCT assignment_id
            FROM hazard_report_assignment_responders
            WHERE responder_user_id = ?
         ) ar ON ar.assignment_id = a.id
         WHERE
           a.resolved_at IS NOT NULL
           AND a.resolved_at >= DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY)
           AND a.resolved_at < DATE_ADD(DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY), INTERVAL 7 DAY)'
    );
    $avgStmt->bind_param('i', $uid);
    $avgStmt->execute();
    $avgRow = $avgStmt->get_result()->fetch_assoc();
    $avgStmt->close();
    if ($avgRow && $avgRow['avg_minutes'] !== null) {
        $avgMinutes = (int)round((float)$avgRow['avg_minutes']);
    }

    $resolvedTotal = 0;
    $handledStmt = $conn->prepare(
        'SELECT COUNT(DISTINCT a.id) AS resolved_total
         FROM hazard_report_assignments a
         INNER JOIN (
            SELECT DISTINCT assignment_id
            FROM hazard_report_assignment_responders
            WHERE responder_user_id = ?
         ) ar ON ar.assignment_id = a.id
         LEFT JOIN responder_assignment_statuses rs ON rs.id = a.assignment_status_id
         WHERE (
             LOWER(TRIM(COALESCE(rs.status_code, ""))) = "resolved"
             OR a.resolved_at IS NOT NULL
           )'
    );
    $handledStmt->bind_param('i', $uid);
    $handledStmt->execute();
    $handledRow = $handledStmt->get_result()->fetch_assoc();
    $handledStmt->close();
    if ($handledRow) {
        $resolvedTotal = (int)($handledRow['resolved_total'] ?? 0);
    }

    $recentActivity = [];
    $recentStmt = $conn->prepare(
        'SELECT
            a.id AS assignment_id,
            COALESCE(NULLIF(TRIM(ht.type_name), ""), "Incident") AS hazard_type,
            COALESCE(NULLIF(TRIM(hr.location_text), ""), "Location not provided") AS location_text,
            a.assigned_at,
            a.accepted_at,
            a.resolved_at,
            COALESCE(LOWER(TRIM(rs.status_code)), "") AS status_code,
            TIMESTAMPDIFF(MINUTE, COALESCE(a.accepted_at, a.assigned_at), a.resolved_at) AS resolved_minutes
         FROM hazard_report_assignments a
         INNER JOIN (
            SELECT DISTINCT assignment_id
            FROM hazard_report_assignment_responders
            WHERE responder_user_id = ?
         ) ar ON ar.assignment_id = a.id
         INNER JOIN hazard_reports hr ON hr.id = a.hazard_report_id
         LEFT JOIN hazard_types ht ON ht.id = hr.hazard_type_id
         LEFT JOIN responder_assignment_statuses rs ON rs.id = a.assignment_status_id
         WHERE (
            LOWER(TRIM(COALESCE(rs.status_code, ""))) = "resolved"
            OR a.resolved_at IS NOT NULL
         )
           AND DATE(COALESCE(a.resolved_at, a.assigned_at)) = CURRENT_DATE()
         ORDER BY COALESCE(a.resolved_at, a.assigned_at) DESC, a.id DESC
         LIMIT 5'
    );
    $recentStmt->bind_param('i', $uid);
    $recentStmt->execute();
    $recentResult = $recentStmt->get_result();
    while ($row = $recentResult->fetch_assoc()) {
        $recentActivity[] = [
            'assignmentId' => (int)($row['assignment_id'] ?? 0),
            'hazardType' => (string)($row['hazard_type'] ?? 'Incident'),
            'location' => (string)($row['location_text'] ?? 'Location not provided'),
            'statusCode' => (string)($row['status_code'] ?? 'resolved'),
            'resolvedMinutes' => $row['resolved_minutes'] !== null ? (int)$row['resolved_minutes'] : null,
            'assignedAt' => (string)($row['assigned_at'] ?? ''),
            'resolvedAt' => (string)($row['resolved_at'] ?? ''),
        ];
    }
    $recentStmt->close();

    $barangayName = trim((string)($user['barangay_name'] ?? ''));
    if ($barangayName !== '') {
        $barangayName = 'Brgy. ' . preg_replace('/^Brgy\.?\s*/i', '', $barangayName);
    } else {
        $barangayName = 'Barangay not set';
    }
    $statusSubtext = $statusCode === '' ? 'No active assignment' : $barangayName;

    hv_json([
        'ok' => true,
        'metrics' => [
            'myStatus' => [
                'label' => $statusLabel,
                'location' => $statusSubtext,
            ],
            'assignmentsToday' => [
                'total' => $today['total'],
                'resolved' => $today['resolved'],
                'active' => $today['active'],
            ],
            'avgResponse' => [
                'minutes' => $avgMinutes,
                'windowLabel' => 'This week',
            ],
            'handledIncidents' => [
                'count' => $resolvedTotal,
                'description' => 'Lifetime assignments completed',
            ],
            'recentActivity' => $recentActivity,
        ],
    ]);
}

$action = trim((string)($_GET['action'] ?? ''));
$allowed = ['responder_active_assignment', 'responder_update_status', 'responder_update_location', 'responder_dashboard_metrics'];
if ($action === '' || !in_array($action, $allowed, true)) hv_json(['ok' => false, 'error' => 'Unknown action'], 404);

if ($action === 'responder_active_assignment') hv_handle_responder_active_assignment();
if ($action === 'responder_update_status') hv_handle_responder_update_status();
if ($action === 'responder_update_location') hv_handle_responder_update_location();
if ($action === 'responder_dashboard_metrics') hv_handle_responder_dashboard_metrics();

hv_json(['ok' => false, 'error' => 'Unknown action'], 404);
