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

function hv_is_local_debug(): bool
{
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    return strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false;
}

function hv_role_to_reporter_code(string $role): string
{
    $role = trim($role);
    if ($role === 'Barangay Staff') return 'barangay';
    if ($role === 'Barangay') return 'barangay';
    if ($role === 'Responder') return 'responder';
    if ($role === 'Admin') return 'admin';
    return 'resident';
}

function hv_weight_for_role(string $role): int
{
    $code = hv_role_to_reporter_code($role);
    if ($code === 'admin') return 5;
    if ($code === 'responder') return 4;
    if ($code === 'barangay') return 3;
    return 1;
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

function hv_context_payload(array $userRow): array
{
    return [
        'userId' => (string)$userRow['id'],
        'displayName' => trim(($userRow['first_name'] ?? '') . ' ' . ($userRow['last_name'] ?? '')),
        'role' => hv_role_to_reporter_code((string)$userRow['role_name']),
        'verified' => false,
        'province' => (string)$userRow['province_name'],
        'city' => (string)$userRow['municipality_name'],
        'barangay' => (string)$userRow['barangay_name'],
        'lat' => null,
        'lng' => null,
        'coverageLevel' => 'city',
        'coverageRadiusKm' => 10,
        'locationSource' => 'profile',
    ];
}

function hv_extract_db_report_id(string $uiId): int
{
    if (preg_match('/^rep-db-(\d+)$/', trim($uiId), $m)) {
        return (int)$m[1];
    }
    return 0;
}

function hv_extract_location_parts(string $locationText): array
{
    $out = ['barangay' => '', 'city' => '', 'province' => ''];
    $raw = trim($locationText);
    if ($raw === '') return $out;

    if (preg_match('/(?:^|,)\s*(?:brgy\.?|barangay)\s*([^,]+)/i', $raw, $m)) {
        $out['barangay'] = trim((string)$m[1]);
    } else {
        $segments = array_values(array_filter(array_map('trim', explode(',', $raw)), static fn($v) => $v !== ''));
        if (!empty($segments)) $out['barangay'] = (string)$segments[0];
    }

    $segments = array_values(array_filter(array_map('trim', explode(',', $raw)), static fn($v) => $v !== ''));
    if (count($segments) >= 2) $out['city'] = (string)$segments[1];
    if (count($segments) >= 3) $out['province'] = (string)$segments[2];

    return $out;
}

function hv_resolve_submit_barangay_id(array $data, array $userRow): int
{
    $fallbackBarangayId = (int)$userRow['barangay_id'];

    $barangay = trim((string)($data['barangay'] ?? ''));
    $city = trim((string)($data['city'] ?? ''));
    $province = trim((string)($data['province'] ?? ''));
    $location = trim((string)($data['location'] ?? ''));

    // Use free-text location only when explicit context fields are missing.
    // This avoids unintentionally re-routing reports to a different barangay
    // just because the user typed a landmark/address string.
    if ($barangay === '' || $city === '' || $province === '') {
        $locParts = hv_extract_location_parts($location);
        if ($barangay === '' && $locParts['barangay'] !== '') {
            $barangay = $locParts['barangay'];
        }
        if ($city === '' && $locParts['city'] !== '') {
            $city = $locParts['city'];
        }
        if ($province === '' && $locParts['province'] !== '') {
            $province = $locParts['province'];
        }
    }

    if ($barangay === '') return $fallbackBarangayId;

    $barangay = preg_replace('/^brgy\.?\s*/i', '', $barangay ?? '');
    $barangay = preg_replace('/^barangay\s+/i', '', $barangay ?? '');
    if (!is_string($barangay) || trim($barangay) === '') return $fallbackBarangayId;
    $barangay = trim($barangay);

    global $conn;

    if ($city !== '' && $province !== '') {
        $stmt = $conn->prepare(
            'SELECT b.id
             FROM barangays b
             INNER JOIN municipalities m ON m.id = b.municipality_id
             INNER JOIN provinces p ON p.id = m.province_id
             WHERE LOWER(TRIM(b.barangay_name)) = LOWER(TRIM(?))
               AND LOWER(TRIM(m.municipality_name)) = LOWER(TRIM(?))
               AND LOWER(TRIM(p.province_name)) = LOWER(TRIM(?))
             LIMIT 1'
        );
        $stmt->bind_param('sss', $barangay, $city, $province);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($row && isset($row['id'])) return (int)$row['id'];
    }

    if ($city !== '') {
        $stmt = $conn->prepare(
            'SELECT b.id
             FROM barangays b
             INNER JOIN municipalities m ON m.id = b.municipality_id
             WHERE LOWER(TRIM(b.barangay_name)) = LOWER(TRIM(?))
               AND LOWER(TRIM(m.municipality_name)) = LOWER(TRIM(?))
             LIMIT 1'
        );
        $stmt->bind_param('ss', $barangay, $city);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($row && isset($row['id'])) return (int)$row['id'];
    }

    $stmt = $conn->prepare(
        'SELECT id
         FROM barangays
         WHERE LOWER(TRIM(barangay_name)) = LOWER(TRIM(?))
         LIMIT 1'
    );
    $stmt->bind_param('s', $barangay);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row && isset($row['id'])) return (int)$row['id'];

    return $fallbackBarangayId;
}

function hv_fetch_reports_by_barangay_scope(array $userRow): array
{
    global $conn;

    $barangayId = (int)$userRow['barangay_id'];
    $municipalityName = (string)$userRow['municipality_name'];

    $query =
        'SELECT hr.id, hr.location_text, hr.description, hr.latitude, hr.longitude, hr.rescue_needed,
                hr.photo_path, hr.created_at, rs.status_label,
                ht.type_name AS hazard, b.barangay_name, m.municipality_name, p.province_name,
                CONCAT(ru.first_name, " ", ru.last_name) AS author,
                rr.role_name AS reporter_role,
                COALESCE(SUM(CASE WHEN va.action_code = "confirm" THEN hrv.weight_value ELSE 0 END), 0) AS confirm_weight,
                COALESCE(SUM(CASE WHEN va.action_code = "reject" THEN hrv.weight_value ELSE 0 END), 0) AS reject_weight
         FROM hazard_reports hr
         INNER JOIN hazard_types ht ON ht.id = hr.hazard_type_id
         INNER JOIN report_statuses rs ON rs.id = hr.status_id
         INNER JOIN users ru ON ru.id = hr.reporter_user_id
         INNER JOIN roles rr ON rr.id = ru.role_id
         INNER JOIN barangays b ON b.id = hr.barangay_id
         INNER JOIN municipalities m ON m.id = b.municipality_id
         INNER JOIN provinces p ON p.id = m.province_id
         LEFT JOIN hazard_report_verifications hrv ON hrv.hazard_report_id = hr.id
         LEFT JOIN verification_actions va ON va.id = hrv.action_id
         WHERE (hr.barangay_id = ? OR m.municipality_name = ?)
         GROUP BY hr.id
         ORDER BY hr.created_at DESC
         LIMIT 120';

    $stmt = $conn->prepare($query);
    $stmt->bind_param('is', $barangayId, $municipalityName);
    $stmt->execute();
    $res = $stmt->get_result();

    $out = [];
    while ($row = $res->fetch_assoc()) {
        $out[] = [
            'id' => 'rep-db-' . (int)$row['id'],
            'hazard' => (string)$row['hazard'],
            'province' => (string)$row['province_name'],
            'city' => (string)$row['municipality_name'],
            'barangay' => (string)$row['barangay_name'],
            'location' => (string)$row['location_text'],
            'description' => (string)$row['description'],
            'author' => (string)$row['author'],
            'role' => hv_role_to_reporter_code((string)$row['reporter_role']),
            'lat' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'lng' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'hasPhoto' => !empty($row['photo_path']),
            'rescueNeeded' => (bool)$row['rescue_needed'],
            'confirmWeight' => (int)$row['confirm_weight'],
            'rejectWeight' => (int)$row['reject_weight'],
            'createdAt' => strtotime((string)$row['created_at']) * 1000,
            'status' => (string)$row['status_label'],
        ];
    }

    $stmt->close();
    return $out;
}

function hv_handle_bootstrap(): void
{
    $user = hv_get_current_user();
    hv_json([
        'ok' => true,
        'context' => hv_context_payload($user),
        'reports' => hv_fetch_reports_by_barangay_scope($user),
    ]);
}

function hv_handle_submit(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $hazard = trim((string)($data['hazard'] ?? ''));
    $location = trim((string)($data['location'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    if ($hazard === '' || $location === '' || $description === '') {
        hv_json(['ok' => false, 'error' => 'Hazard, location, and description are required'], 422);
    }

    $rescueNeeded = !empty($data['rescueNeeded']) ? 1 : 0;
    $lat = isset($data['lat']) && is_numeric($data['lat']) ? (float)$data['lat'] : null;
    $lng = isset($data['lng']) && is_numeric($data['lng']) ? (float)$data['lng'] : null;
    $peopleAffected = trim((string)($data['peopleAffected'] ?? ''));
    $injuries = trim((string)($data['injuries'] ?? ''));
    $roadStatus = trim((string)($data['roadStatus'] ?? ''));
    $hazardSpecificDetail = trim((string)($data['hazardDetail'] ?? ''));

    global $conn;
    try {
        $conn->begin_transaction();
        $typeStmt = $conn->prepare('SELECT id FROM hazard_types WHERE type_name = ? LIMIT 1');
        $typeStmt->bind_param('s', $hazard);
        $typeStmt->execute();
        $typeRow = $typeStmt->get_result()->fetch_assoc();
        $typeStmt->close();
        if (!$typeRow) throw new RuntimeException('Unknown hazard type');

        $statusCode = 'pending_barangay';
        $statusStmt = $conn->prepare('SELECT id, status_label FROM report_statuses WHERE status_code = ? LIMIT 1');
        $statusStmt->bind_param('s', $statusCode);
        $statusStmt->execute();
        $statusRow = $statusStmt->get_result()->fetch_assoc();
        $statusStmt->close();
        if (!$statusRow) throw new RuntimeException('Missing pending status');

        $insertStmt = $conn->prepare(
            'INSERT INTO hazard_reports
             (reporter_user_id, hazard_type_id, barangay_id, status_id, location_text, latitude, longitude, description, rescue_needed, photo_path)
             VALUES (?, ?, ?, ?, ?, NULLIF(?, ""), NULLIF(?, ""), ?, ?, NULL)'
        );
        $uid = (int)$user['id'];
        $hid = (int)$typeRow['id'];
        $bid = hv_resolve_submit_barangay_id($data, $user);
        $sid = (int)$statusRow['id'];
        $latSql = $lat !== null ? (string)$lat : '';
        $lngSql = $lng !== null ? (string)$lng : '';
        $insertStmt->bind_param('iiiissssi', $uid, $hid, $bid, $sid, $location, $latSql, $lngSql, $description, $rescueNeeded);
        $insertStmt->execute();
        $newReportId = (int)$conn->insert_id;
        $insertStmt->close();

        $lvlPeople = null;
        $lvlInjury = null;
        $lvlRoad = null;

        if ($peopleAffected !== '') {
            $cleanPeopleAffected = strtolower(str_replace(["–", "—"], '-', $peopleAffected));
            $map = [
                '1-5' => '1_5',
                '6-20' => '6_20',
                '20+' => '20_plus',
                'unknown' => 'unknown',
            ];
            $code = $map[$cleanPeopleAffected] ?? '';
            if ($code !== '') {
                $stmt = $conn->prepare('SELECT id FROM people_affected_levels WHERE level_code = ? LIMIT 1');
                $stmt->bind_param('s', $code);
                $stmt->execute();
                $row = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                if ($row) $lvlPeople = (int)$row['id'];
            }
        }

        if ($injuries !== '') {
            $code = strtolower($injuries);
            $stmt = $conn->prepare('SELECT id FROM injury_levels WHERE level_code = ? LIMIT 1');
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($row) $lvlInjury = (int)$row['id'];
        }

        if ($roadStatus !== '') {
            $code = strtolower($roadStatus);
            $stmt = $conn->prepare('SELECT id FROM road_conditions WHERE condition_code = ? LIMIT 1');
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($row) $lvlRoad = (int)$row['id'];
        }

        $qdStmt = $conn->prepare(
            'INSERT INTO hazard_report_quick_details
             (hazard_report_id, people_affected_level_id, injury_level_id, road_condition_id, hazard_specific_detail)
             VALUES (?, ?, ?, ?, ?)'
        );
        $qdStmt->bind_param('iiiis', $newReportId, $lvlPeople, $lvlInjury, $lvlRoad, $hazardSpecificDetail);
        $qdStmt->execute();
        $qdStmt->close();

        $note = 'Report submitted';
        $historyStmt = $conn->prepare(
            'INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note)
             VALUES (?, ?, ?, ?)'
        );
        $historyStmt->bind_param('iiis', $newReportId, $sid, $uid, $note);
        $historyStmt->execute();
        $historyStmt->close();

        try {
            $actionCode = 'confirm';
            $actionStmt = $conn->prepare('SELECT id FROM verification_actions WHERE action_code = ? LIMIT 1');
            $actionStmt->bind_param('s', $actionCode);
            $actionStmt->execute();
            $actionRow = $actionStmt->get_result()->fetch_assoc();
            $actionStmt->close();
            if ($actionRow) {
                $voteStmt = $conn->prepare(
                    'INSERT INTO hazard_report_verifications (hazard_report_id, user_id, action_id, weight_value)
                     VALUES (?, ?, ?, ?)'
                );
                $weight = hv_weight_for_role((string)$user['role_name']);
                $actionId = (int)$actionRow['id'];
                $voteStmt->bind_param('iiii', $newReportId, $uid, $actionId, $weight);
                $voteStmt->execute();
                $voteStmt->close();
            }
        } catch (Throwable $ignored) {
            // Do not block submission if optional verification metadata is missing on local/dev databases.
        }

        $conn->commit();
        $resolvedStatusLabel = trim((string)($statusRow['status_label'] ?? ''));
        if ($resolvedStatusLabel === '') {
            $resolvedStatusLabel = 'Pending Verification';
        }

        hv_json([
            'ok' => true,
            'id' => 'rep-db-' . $newReportId,
            'statusCode' => $statusCode,
            'statusLabel' => $resolvedStatusLabel,
        ]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        error_log('hazard_reports submit failed: ' . $e->getMessage());
        $errorMessage = hv_is_local_debug() ? ('Failed to save report: ' . $e->getMessage()) : 'Failed to save report';
        hv_json(['ok' => false, 'error' => $errorMessage], 500);
    }
}

function hv_handle_verify(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $reportId = hv_extract_db_report_id((string)($data['reportId'] ?? ''));
    $action = trim((string)($data['action'] ?? ''));
    if ($reportId <= 0 || !in_array($action, ['confirm', 'reject'], true)) {
        hv_json(['ok' => false, 'error' => 'Invalid verification input'], 422);
    }

    global $conn;
    $stmt = $conn->prepare('SELECT id FROM verification_actions WHERE action_code = ? LIMIT 1');
    $stmt->bind_param('s', $action);
    $stmt->execute();
    $actionRow = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$actionRow) hv_json(['ok' => false, 'error' => 'Invalid action'], 422);

    $actionId = (int)$actionRow['id'];
    $uid = (int)$user['id'];
    $weight = hv_weight_for_role((string)$user['role_name']);
    $upsert = $conn->prepare(
        'INSERT INTO hazard_report_verifications (hazard_report_id, user_id, action_id, weight_value)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE action_id = VALUES(action_id), weight_value = VALUES(weight_value), created_at = CURRENT_TIMESTAMP'
    );
    $upsert->bind_param('iiii', $reportId, $uid, $actionId, $weight);
    $upsert->execute();
    $upsert->close();

    hv_json(['ok' => true]);
}

function hv_handle_barangay_feed(): void
{
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    global $conn;
    $barangayId = (int)$user['barangay_id'];
    $feedView = strtolower(trim((string)($_GET['view'] ?? '')));
    $incidentOnly = ($feedView === 'incident');
    $statusFilterSql = '';
    if ($incidentOnly) {
        $statusFilterSql = ' AND rs.status_code IN ("verified_barangay", "responders_assigned", "on_the_way", "arrived", "responding", "resolved")';
    }

    $sql =
        'SELECT hr.id, ht.type_name AS hazard, hr.location_text, hr.description, hr.rescue_needed, hr.photo_path, hr.created_at,
                rs.status_code, rs.status_label, CONCAT(u.first_name, " ", u.last_name) AS reporter_name,
                pal.level_code AS people_affected_code,
                il.level_code AS injury_level_code,
                rc.condition_code AS road_condition_code,
                qd.hazard_specific_detail,
                MAX(CASE WHEN a.active_flag = 1 THEN 1 ELSE 0 END) AS has_active_assignment,
                MAX(CASE WHEN a.active_flag = 1 THEN a.id ELSE NULL END) AS active_assignment_id,
                COALESCE(SUM(CASE WHEN va.action_code = "confirm" THEN hrv.weight_value ELSE 0 END), 0) AS confirm_weight,
                COALESCE(SUM(CASE WHEN va.action_code = "reject" THEN hrv.weight_value ELSE 0 END), 0) AS reject_weight
         FROM hazard_reports hr
         INNER JOIN hazard_types ht ON ht.id = hr.hazard_type_id
         INNER JOIN report_statuses rs ON rs.id = hr.status_id
         INNER JOIN users u ON u.id = hr.reporter_user_id
         LEFT JOIN hazard_report_quick_details qd ON qd.hazard_report_id = hr.id
         LEFT JOIN people_affected_levels pal ON pal.id = qd.people_affected_level_id
         LEFT JOIN injury_levels il ON il.id = qd.injury_level_id
         LEFT JOIN road_conditions rc ON rc.id = qd.road_condition_id
         LEFT JOIN hazard_report_assignments a ON a.hazard_report_id = hr.id
         LEFT JOIN hazard_report_verifications hrv ON hrv.hazard_report_id = hr.id
         LEFT JOIN verification_actions va ON va.id = hrv.action_id
         WHERE hr.barangay_id = ?' . $statusFilterSql . '
         GROUP BY hr.id
         ORDER BY hr.created_at DESC
         LIMIT 200';
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $barangayId);
    $stmt->execute();
    $res = $stmt->get_result();

    $pending = 0;
    $sos = 0;
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        if ((string)$row['status_code'] === 'pending_barangay') $pending++;
        if ((int)$row['rescue_needed'] === 1) $sos++;
        $rows[] = [
            'id' => (int)$row['id'],
            'title' => (string)$row['hazard'] . ' - ' . (string)$row['location_text'],
            'locationText' => (string)$row['location_text'],
            'statusCode' => (string)$row['status_code'],
            'statusLabel' => (string)$row['status_label'],
            'description' => (string)$row['description'],
            'reporterName' => (string)$row['reporter_name'],
            'rescueNeeded' => (bool)$row['rescue_needed'],
            'hasPhoto' => !empty($row['photo_path']),
            'peopleAffectedCode' => (string)($row['people_affected_code'] ?? ''),
            'injuryLevelCode' => (string)($row['injury_level_code'] ?? ''),
            'roadConditionCode' => (string)($row['road_condition_code'] ?? ''),
            'hazardSpecificDetail' => (string)($row['hazard_specific_detail'] ?? ''),
            'hasActiveAssignment' => ((int)($row['has_active_assignment'] ?? 0)) === 1,
            'activeAssignmentId' => isset($row['active_assignment_id']) && $row['active_assignment_id'] !== null
                ? (int)$row['active_assignment_id']
                : null,
            'confirmWeight' => (int)$row['confirm_weight'],
            'rejectWeight' => (int)$row['reject_weight'],
            'createdAt' => (string)$row['created_at'],
        ];
    }
    $stmt->close();

    hv_json(['ok' => true, 'pendingCount' => $pending, 'sosCount' => $sos, 'reports' => $rows]);
}

function hv_handle_barangay_review(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $reportId = (int)($data['reportId'] ?? 0);
    $approved = !empty($data['approved']);
    if ($reportId <= 0) hv_json(['ok' => false, 'error' => 'Invalid report'], 422);

    $statusCode = $approved ? 'verified_barangay' : 'rejected_barangay';

    global $conn;
    try {
        $conn->begin_transaction();

        $check = $conn->prepare('SELECT id FROM hazard_reports WHERE id = ? AND barangay_id = ? LIMIT 1');
        $bid = (int)$user['barangay_id'];
        $check->bind_param('ii', $reportId, $bid);
        $check->execute();
        $row = $check->get_result()->fetch_assoc();
        $check->close();
        if (!$row) throw new RuntimeException('Out of scope');

        $statusStmt = $conn->prepare('SELECT id, status_label FROM report_statuses WHERE status_code = ? LIMIT 1');
        $statusStmt->bind_param('s', $statusCode);
        $statusStmt->execute();
        $statusRow = $statusStmt->get_result()->fetch_assoc();
        $statusStmt->close();
        if (!$statusRow) throw new RuntimeException('Status missing');

        $sid = (int)$statusRow['id'];
        $update = $conn->prepare('UPDATE hazard_reports SET status_id = ? WHERE id = ?');
        $update->bind_param('ii', $sid, $reportId);
        $update->execute();
        $update->close();

        $uid = (int)$user['id'];
        $note = $approved ? 'Barangay verification approved' : 'Barangay verification rejected';
        $history = $conn->prepare('INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note) VALUES (?, ?, ?, ?)');
        $history->bind_param('iiis', $reportId, $sid, $uid, $note);
        $history->execute();
        $history->close();

        $conn->commit();
        hv_json(['ok' => true, 'statusLabel' => (string)$statusRow['status_label']]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        hv_json(['ok' => false, 'error' => 'Review update failed'], 500);
    }
}

function hv_handle_admin_summary(): void
{
    $user = hv_get_current_user();
    if ((string)$user['role_name'] !== 'Admin') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    global $conn;
    $metrics = ['verifiedReports' => 0, 'pendingReports' => 0, 'totalReports' => 0];
    $res = $conn->query(
        'SELECT
          SUM(CASE WHEN rs.status_code = "verified_barangay" THEN 1 ELSE 0 END) AS verified_count,
          SUM(CASE WHEN rs.status_code = "pending_barangay" THEN 1 ELSE 0 END) AS pending_count,
          COUNT(*) AS total_count
         FROM hazard_reports hr
         INNER JOIN report_statuses rs ON rs.id = hr.status_id'
    );
    if ($row = $res->fetch_assoc()) {
        $metrics['verifiedReports'] = (int)$row['verified_count'];
        $metrics['pendingReports'] = (int)$row['pending_count'];
        $metrics['totalReports'] = (int)$row['total_count'];
    }

    hv_json(['ok' => true, 'metrics' => $metrics]);
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

function hv_handle_barangay_assign(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $reportId = (int)($data['reportId'] ?? 0);
    $responderUserId = (int)($data['responderUserId'] ?? 0);
    $note = trim((string)($data['note'] ?? ''));
    if ($reportId <= 0 || $responderUserId <= 0) hv_json(['ok' => false, 'error' => 'Invalid assignment input'], 422);

    global $conn;
    try {
        $conn->begin_transaction();

        $checkReport = $conn->prepare(
            'SELECT hr.id, hr.barangay_id
             FROM hazard_reports hr
             WHERE hr.id = ? AND hr.barangay_id = ?
             LIMIT 1'
        );
        $bid = (int)$user['barangay_id'];
        $checkReport->bind_param('ii', $reportId, $bid);
        $checkReport->execute();
        $reportRow = $checkReport->get_result()->fetch_assoc();
        $checkReport->close();
        if (!$reportRow) throw new RuntimeException('Report is out of barangay scope');

        $scope = hv_fetch_scope_ids_by_barangay_id($bid);
        if (!$scope) throw new RuntimeException('Barangay scope missing');

        if (!hv_barangay_can_use_responder(
            $responderUserId,
            (int)$scope['barangay_id'],
            (int)$scope['municipality_id'],
            (int)$scope['province_id']
        )) {
            throw new RuntimeException('Responder is not eligible for this barangay scope');
        }

        $assignStatusRow = hv_get_assignment_status_row_by_code('assigned');
        if (!$assignStatusRow) throw new RuntimeException('Missing assignment status');
        $assignStatusId = (int)$assignStatusRow['id'];

        $reportStatusRow = hv_get_report_status_row_by_code('responders_assigned');
        if (!$reportStatusRow) throw new RuntimeException('Missing report status responders_assigned');
        $reportStatusId = (int)$reportStatusRow['id'];

        $deptId = null;
        $deptStmt = $conn->prepare('SELECT department_id FROM responder_profiles WHERE user_id = ? LIMIT 1');
        $deptStmt->bind_param('i', $responderUserId);
        $deptStmt->execute();
        $deptRow = $deptStmt->get_result()->fetch_assoc();
        $deptStmt->close();
        if ($deptRow && isset($deptRow['department_id']) && $deptRow['department_id'] !== null) {
            $deptId = (int)$deptRow['department_id'];
        }
        if ($deptId === null) {
            $deptFallback = $conn->prepare('SELECT id FROM responder_departments WHERE dept_code = "disaster" LIMIT 1');
            $deptFallback->execute();
            $deptFallbackRow = $deptFallback->get_result()->fetch_assoc();
            $deptFallback->close();
            if ($deptFallbackRow && isset($deptFallbackRow['id'])) {
                $deptId = (int)$deptFallbackRow['id'];
            }
        }
        if ($deptId === null) {
            throw new RuntimeException('Responder department is missing');
        }

        $closeActive = $conn->prepare(
            'UPDATE hazard_report_assignments
             SET active_flag = 0, closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ?
             WHERE hazard_report_id = ? AND active_flag = 1'
        );
        $uid = (int)$user['id'];
        $closeActive->bind_param('ii', $uid, $reportId);
        $closeActive->execute();
        $closeActive->close();

        $insert = $conn->prepare(
            'INSERT INTO hazard_report_assignments
             (hazard_report_id, assigned_by_user_id, department_id, primary_responder_user_id, assignment_status_id, notes)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $insert->bind_param('iiiiis', $reportId, $uid, $deptId, $responderUserId, $assignStatusId, $note);
        $insert->execute();
        $assignmentId = (int)$conn->insert_id;
        $insert->close();

        $team = $conn->prepare(
            'INSERT INTO hazard_report_assignment_responders (assignment_id, responder_user_id, team_role, is_primary)
             VALUES (?, ?, ?, 1)'
        );
        $teamRole = 'Primary Responder';
        $team->bind_param('iis', $assignmentId, $responderUserId, $teamRole);
        $team->execute();
        $team->close();

        $assignHistory = $conn->prepare(
            'INSERT INTO hazard_report_assignment_status_history (assignment_id, assignment_status_id, updated_by_user_id, note)
             VALUES (?, ?, ?, ?)'
        );
        $assignHistoryNote = ($note !== '') ? $note : 'Assignment created by barangay';
        $assignHistory->bind_param('iiis', $assignmentId, $assignStatusId, $uid, $assignHistoryNote);
        $assignHistory->execute();
        $assignHistory->close();

        $updateReport = $conn->prepare('UPDATE hazard_reports SET status_id = ? WHERE id = ?');
        $updateReport->bind_param('ii', $reportStatusId, $reportId);
        $updateReport->execute();
        $updateReport->close();

        $reportHistory = $conn->prepare(
            'INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note)
             VALUES (?, ?, ?, ?)'
        );
        $reportHistoryNote = 'Barangay assigned responder #' . $responderUserId;
        $reportHistory->bind_param('iiis', $reportId, $reportStatusId, $uid, $reportHistoryNote);
        $reportHistory->execute();
        $reportHistory->close();

        hv_set_responder_availability_if_exists($responderUserId, 'busy', $uid, 'Assigned to report #' . $reportId);

        $conn->commit();
        hv_json([
            'ok' => true,
            'assignmentId' => $assignmentId,
            'statusCode' => 'responders_assigned',
            'statusLabel' => (string)$reportStatusRow['status_label'],
        ]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        hv_json(['ok' => false, 'error' => 'Assignment failed'], 500);
    }
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
    if ($assignmentId <= 0 || !in_array($statusCode, $allowed, true)) {
        hv_json(['ok' => false, 'error' => 'Invalid status input'], 422);
    }

    global $conn;
    try {
        $conn->begin_transaction();

        $check = $conn->prepare(
            'SELECT a.id, a.hazard_report_id, a.primary_responder_user_id
             FROM hazard_report_assignments a
             INNER JOIN hazard_report_assignment_responders ar ON ar.assignment_id = a.id
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

        $assignmentStatusRow = hv_get_assignment_status_row_by_code($statusCode);
        if (!$assignmentStatusRow) throw new RuntimeException('Assignment status missing');
        $assignmentStatusId = (int)$assignmentStatusRow['id'];

        $fieldSql = '';
        if ($statusCode === 'on_the_way') $fieldSql = ', accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)';
        if ($statusCode === 'arrived') $fieldSql = ', arrived_at = COALESCE(arrived_at, CURRENT_TIMESTAMP)';
        if ($statusCode === 'responding') $fieldSql = ', response_started_at = COALESCE(response_started_at, CURRENT_TIMESTAMP)';
        if ($statusCode === 'resolved') $fieldSql = ', resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)';

        $updateAssignment = $conn->prepare(
            'UPDATE hazard_report_assignments
             SET assignment_status_id = ?' . $fieldSql . '
             WHERE id = ?'
        );
        $updateAssignment->bind_param('ii', $assignmentStatusId, $assignmentId);
        $updateAssignment->execute();
        $updateAssignment->close();

        $historyNote = $note !== '' ? $note : ('Responder updated status to ' . $statusCode);
        $insertAssignmentHistory = $conn->prepare(
            'INSERT INTO hazard_report_assignment_status_history (assignment_id, assignment_status_id, updated_by_user_id, note)
             VALUES (?, ?, ?, ?)'
        );
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

        $insertReportHistory = $conn->prepare(
            'INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note)
             VALUES (?, ?, ?, ?)'
        );
        $reportNote = 'Responder #' . $uid . ' set status to ' . $statusCode;
        $insertReportHistory->bind_param('iiis', $reportId, $reportStatusId, $uid, $reportNote);
        $insertReportHistory->execute();
        $insertReportHistory->close();

        if ($statusCode === 'resolved') {
            hv_set_responder_availability_if_exists($uid, 'available', $uid, 'Marked assignment #' . $assignmentId . ' as resolved');
        }

        $conn->commit();
        hv_json([
            'ok' => true,
            'assignmentId' => $assignmentId,
            'reportId' => $reportId,
            'statusCode' => $statusCode,
            'statusLabel' => (string)$reportStatusRow['status_label'],
        ]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        hv_json(['ok' => false, 'error' => 'Responder status update failed'], 500);
    }
}

function hv_handle_barangay_confirm_resolved(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') hv_json(['ok' => false, 'error' => 'Method not allowed'], 405);
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) hv_json(['ok' => false, 'error' => 'Invalid payload'], 422);

    $assignmentId = (int)($data['assignmentId'] ?? 0);
    $reportId = (int)($data['reportId'] ?? 0);
    if ($assignmentId <= 0 && $reportId <= 0) {
        hv_json(['ok' => false, 'error' => 'Assignment or report id is required'], 422);
    }

    global $conn;
    try {
        $conn->begin_transaction();

        $bid = (int)$user['barangay_id'];
        $uid = (int)$user['id'];

        $assignmentQuery =
            'SELECT a.id, a.hazard_report_id, a.primary_responder_user_id, ras.status_code
             FROM hazard_report_assignments a
             INNER JOIN hazard_reports hr ON hr.id = a.hazard_report_id
             INNER JOIN responder_assignment_statuses ras ON ras.id = a.assignment_status_id
             WHERE hr.barangay_id = ?';
        if ($assignmentId > 0) {
            $assignmentQuery .= ' AND a.id = ?';
        } else {
            $assignmentQuery .= ' AND a.hazard_report_id = ? AND a.active_flag = 1';
        }
        $assignmentQuery .= ' LIMIT 1';

        $stmt = $conn->prepare($assignmentQuery);
        if ($assignmentId > 0) {
            $stmt->bind_param('ii', $bid, $assignmentId);
        } else {
            $stmt->bind_param('ii', $bid, $reportId);
        }
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) throw new RuntimeException('Assignment not found for barangay');

        $resolvedStatusCode = strtolower(trim((string)$row['status_code']));
        if ($resolvedStatusCode !== 'resolved') {
            throw new RuntimeException('Assignment must be resolved before barangay confirmation');
        }

        $resolvedReportStatusRow = hv_get_report_status_row_by_code('resolved');
        if (!$resolvedReportStatusRow) throw new RuntimeException('Missing resolved report status');
        $resolvedReportStatusId = (int)$resolvedReportStatusRow['id'];

        $aid = (int)$row['id'];
        $hid = (int)$row['hazard_report_id'];
        $responderUserId = (int)($row['primary_responder_user_id'] ?? 0);

        $close = $conn->prepare(
            'UPDATE hazard_report_assignments
             SET active_flag = 0, closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ?
             WHERE id = ?'
        );
        $close->bind_param('ii', $uid, $aid);
        $close->execute();
        $close->close();

        $updateReport = $conn->prepare('UPDATE hazard_reports SET status_id = ? WHERE id = ?');
        $updateReport->bind_param('ii', $resolvedReportStatusId, $hid);
        $updateReport->execute();
        $updateReport->close();

        $history = $conn->prepare(
            'INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note)
             VALUES (?, ?, ?, ?)'
        );
        $note = 'Barangay confirmed incident resolved';
        $history->bind_param('iiis', $hid, $resolvedReportStatusId, $uid, $note);
        $history->execute();
        $history->close();

        if ($responderUserId > 0) {
            hv_set_responder_availability_if_exists($responderUserId, 'available', $uid, 'Barangay confirmed resolved on assignment #' . $aid);
        }

        $conn->commit();
        hv_json([
            'ok' => true,
            'assignmentId' => $aid,
            'reportId' => $hid,
            'statusCode' => 'resolved',
            'statusLabel' => (string)$resolvedReportStatusRow['status_label'],
        ]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        hv_json(['ok' => false, 'error' => 'Barangay resolution confirmation failed'], 500);
    }
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

function hv_handle_barangay_responders(): void
{
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    global $conn;
    $barangayId = (int)$user['barangay_id'];

    $scopeStmt = $conn->prepare(
        'SELECT b.id AS barangay_id, b.municipality_id, m.province_id
         FROM barangays b
         INNER JOIN municipalities m ON m.id = b.municipality_id
         WHERE b.id = ?
         LIMIT 1'
    );
    $scopeStmt->bind_param('i', $barangayId);
    $scopeStmt->execute();
    $scopeRow = $scopeStmt->get_result()->fetch_assoc();
    $scopeStmt->close();
    if (!$scopeRow) hv_json(['ok' => true, 'responders' => []]);

    $requestBarangayId = (int)$scopeRow['barangay_id'];
    $municipalityId = (int)$scopeRow['municipality_id'];
    $provinceId = (int)$scopeRow['province_id'];
    $responderRoleCode = 'responder';

    $stmt = $conn->prepare(
        'SELECT u.id, u.first_name, u.last_name, u.is_active, r.role_name, r.role_code,
                b.barangay_name, m.municipality_name, p.province_name,
                COALESCE(rd.dept_code, "disaster") AS dept_code
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         INNER JOIN barangays b ON b.id = u.barangay_id
         INNER JOIN municipalities m ON m.id = b.municipality_id
         INNER JOIN provinces p ON p.id = m.province_id
         LEFT JOIN responder_profiles rp ON rp.user_id = u.id
         LEFT JOIN responder_departments rd ON rd.id = rp.department_id
         WHERE LOWER(TRIM(r.role_code)) = ?
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
                 SELECT 1 FROM responder_scope_rules rsr2
                 WHERE rsr2.responder_user_id = u.id
                   AND rsr2.is_active = 1
               )
               AND b.id = ?
             )
           )
         ORDER BY u.first_name ASC, u.last_name ASC
         LIMIT 300'
    );
    $stmt->bind_param('siiii', $responderRoleCode, $requestBarangayId, $municipalityId, $provinceId, $requestBarangayId);
    $stmt->execute();
    $res = $stmt->get_result();

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = [
            'id' => (int)$row['id'],
            'name' => trim((string)$row['first_name'] . ' ' . (string)$row['last_name']),
            'roleName' => (string)$row['role_name'],
            'roleCode' => (string)$row['role_code'],
            'isActive' => ((int)$row['is_active']) === 1,
            'barangay' => (string)$row['barangay_name'],
            'city' => (string)$row['municipality_name'],
            'province' => (string)$row['province_name'],
            'deptKey' => (string)$row['dept_code'],
        ];
    }
    $stmt->close();

    hv_json(['ok' => true, 'responders' => $rows]);
}

function hv_handle_barangay_report_history(): void
{
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    $reportId = (int)($_GET['report_id'] ?? 0);
    if ($reportId <= 0) hv_json(['ok' => false, 'error' => 'Invalid report id'], 422);

    global $conn;
    $check = $conn->prepare('SELECT id FROM hazard_reports WHERE id = ? AND barangay_id = ? LIMIT 1');
    $bid = (int)$user['barangay_id'];
    $check->bind_param('ii', $reportId, $bid);
    $check->execute();
    $checkRow = $check->get_result()->fetch_assoc();
    $check->close();
    if (!$checkRow) hv_json(['ok' => false, 'error' => 'Out of scope'], 403);

    $stmt = $conn->prepare(
        'SELECT h.id, rs.status_code, rs.status_label, h.note, h.created_at,
                CONCAT(u.first_name, " ", u.last_name) AS updated_by_name
         FROM hazard_report_status_history h
         INNER JOIN report_statuses rs ON rs.id = h.status_id
         INNER JOIN users u ON u.id = h.updated_by_user_id
         WHERE h.hazard_report_id = ?
         ORDER BY h.created_at ASC, h.id ASC'
    );
    $stmt->bind_param('i', $reportId);
    $stmt->execute();
    $res = $stmt->get_result();

    $history = [];
    while ($row = $res->fetch_assoc()) {
        $history[] = [
            'id' => (int)$row['id'],
            'statusCode' => (string)$row['status_code'],
            'statusLabel' => (string)$row['status_label'],
            'note' => (string)($row['note'] ?? ''),
            'updatedBy' => (string)($row['updated_by_name'] ?? ''),
            'createdAt' => (string)$row['created_at'],
        ];
    }
    $stmt->close();

    hv_json(['ok' => true, 'history' => $history]);
}

// Dispatcher 
$action = trim((string)($_GET['action'] ?? ''));
if ($action !== '') {
    if ($action === 'bootstrap') hv_handle_bootstrap();
    if ($action === 'submit') hv_handle_submit();
    if ($action === 'verify') hv_handle_verify();
    if ($action === 'admin_summary') hv_handle_admin_summary();
    hv_json(['ok' => false, 'error' => 'Unknown action'], 404);
}
