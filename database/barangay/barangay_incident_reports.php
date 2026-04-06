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

function hv_responder_required_dept_code(string $hazardType): string
{
    $hazard = strtolower(trim($hazardType));
    if ($hazard === '') return 'disaster';
    if (strpos($hazard, 'fire') !== false) return 'fire';
    if (strpos($hazard, 'medical') !== false || strpos($hazard, 'ambulance') !== false) return 'medical';
    if (
        strpos($hazard, 'flood') !== false
        || strpos($hazard, 'storm') !== false
        || strpos($hazard, 'typhoon') !== false
        || strpos($hazard, 'earthquake') !== false
        || strpos($hazard, 'road') !== false
        || strpos($hazard, 'landslide') !== false
        || strpos($hazard, 'disaster') !== false
    ) {
        return 'disaster';
    }
    return 'police';
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
    $historyOnly = ($feedView === 'history');
    $statusFilterSql = '';
    if ($incidentOnly) {
        $statusFilterSql =
            ' AND (
                rs.status_code IN ("pending_barangay", "verified_barangay", "responders_assigned", "on_the_way", "arrived", "responding")
                OR (
                    rs.status_code = "resolved"
                    AND EXISTS (
                        SELECT 1
                        FROM hazard_report_assignments ax
                        WHERE ax.hazard_report_id = hr.id
                          AND ax.active_flag = 1
                    )
                )
            )';
    } elseif ($historyOnly) {
        $statusFilterSql =
            ' AND rs.status_code = "resolved"
              AND NOT EXISTS (
                  SELECT 1
                  FROM hazard_report_assignments ax
                  WHERE ax.hazard_report_id = hr.id
                    AND ax.active_flag = 1
              )';
    }

    $sql =
        'SELECT hr.id, ht.type_name AS hazard, hr.location_text, hr.latitude, hr.longitude, hr.description, hr.rescue_needed, hr.photo_path, hr.created_at,
                rs.status_code, rs.status_label, CONCAT(u.first_name, " ", u.last_name) AS reporter_name,
                pal.level_code AS people_affected_code,
                il.level_code AS injury_level_code,
                rc.condition_code AS road_condition_code,
                qd.hazard_specific_detail,
                (
                    SELECT ras2.status_code
                    FROM hazard_report_assignments a2
                    INNER JOIN responder_assignment_statuses ras2 ON ras2.id = a2.assignment_status_id
                    WHERE a2.hazard_report_id = hr.id
                      AND a2.active_flag = 1
                    ORDER BY a2.assigned_at DESC, a2.id DESC
                    LIMIT 1
                ) AS active_assignment_status_code,
                (
                    SELECT ras2.status_label
                    FROM hazard_report_assignments a2
                    INNER JOIN responder_assignment_statuses ras2 ON ras2.id = a2.assignment_status_id
                    WHERE a2.hazard_report_id = hr.id
                      AND a2.active_flag = 1
                    ORDER BY a2.assigned_at DESC, a2.id DESC
                    LIMIT 1
                ) AS active_assignment_status_label,
                (
                    SELECT CONCAT(ur.first_name, " ", ur.last_name)
                    FROM hazard_report_assignments a2
                    INNER JOIN users ur ON ur.id = a2.primary_responder_user_id
                    WHERE a2.hazard_report_id = hr.id
                      AND a2.active_flag = 1
                    ORDER BY a2.assigned_at DESC, a2.id DESC
                    LIMIT 1
                ) AS active_responder_name,
                MAX(CASE WHEN a.active_flag = 1 THEN 1 ELSE 0 END) AS has_active_assignment,
                MAX(CASE WHEN a.active_flag = 1 THEN a.id ELSE NULL END) AS active_assignment_id,
                MAX(CASE WHEN a.active_flag = 0 THEN a.closed_at ELSE NULL END) AS last_closed_at,
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
        $statusCode = strtolower(trim((string)($row['status_code'] ?? '')));
        $statusLabel = (string)($row['status_label'] ?? '');

        $activeAssignmentStatusCode = strtolower(trim((string)($row['active_assignment_status_code'] ?? '')));
        $activeAssignmentStatusLabel = (string)($row['active_assignment_status_label'] ?? '');
        if ($activeAssignmentStatusCode !== '') {
            if ($activeAssignmentStatusCode === 'assigned') {
                $statusCode = 'responders_assigned';
                $statusLabel = 'Responders Assigned';
            } else {
                $statusCode = $activeAssignmentStatusCode;
                if ($activeAssignmentStatusLabel !== '') {
                    $statusLabel = $activeAssignmentStatusLabel;
                }
            }
        }

        if ($statusCode === 'pending_barangay') $pending++;
        if ((int)$row['rescue_needed'] === 1) $sos++;
        $rows[] = [
            'id' => (int)$row['id'],
            'title' => (string)$row['hazard'] . ' - ' . (string)$row['location_text'],
            'locationText' => (string)$row['location_text'],
            'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'statusCode' => $statusCode,
            'statusLabel' => $statusLabel,
            'hazardType' => (string)$row['hazard'],
            'description' => (string)$row['description'],
            'reporterName' => (string)$row['reporter_name'],
            'rescueNeeded' => (bool)$row['rescue_needed'],
            'hasPhoto' => !empty($row['photo_path']),
            'photoPath' => (string)($row['photo_path'] ?? ''),
            'peopleAffectedCode' => (string)($row['people_affected_code'] ?? ''),
            'injuryLevelCode' => (string)($row['injury_level_code'] ?? ''),
            'roadConditionCode' => (string)($row['road_condition_code'] ?? ''),
            'hazardSpecificDetail' => (string)($row['hazard_specific_detail'] ?? ''),
            'activeResponderName' => trim((string)($row['active_responder_name'] ?? '')),
            'hasActiveAssignment' => ((int)($row['has_active_assignment'] ?? 0)) === 1,
            'activeAssignmentId' => isset($row['active_assignment_id']) && $row['active_assignment_id'] !== null ? (int)$row['active_assignment_id'] : null,
            'confirmWeight' => (int)$row['confirm_weight'],
            'rejectWeight' => (int)$row['reject_weight'],
            'createdAt' => (string)$row['created_at'],
            'closedAt' => (string)($row['last_closed_at'] ?? ''),
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

        $statusRow = hv_get_report_status_row_by_code($statusCode);
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
            'SELECT hr.id, hr.barangay_id, ht.type_name AS hazard_type, rs.status_code
             FROM hazard_reports hr
             INNER JOIN hazard_types ht ON ht.id = hr.hazard_type_id
             INNER JOIN report_statuses rs ON rs.id = hr.status_id
             WHERE hr.id = ? AND hr.barangay_id = ?
             LIMIT 1'
        );
        $bid = (int)$user['barangay_id'];
        $checkReport->bind_param('ii', $reportId, $bid);
        $checkReport->execute();
        $reportRow = $checkReport->get_result()->fetch_assoc();
        $checkReport->close();
        if (!$reportRow) throw new RuntimeException('Report is out of barangay scope');
        if (strtolower(trim((string)$reportRow['status_code'])) !== 'verified_barangay') {
            throw new RuntimeException('Only verified reports can be assigned');
        }

        $scope = hv_fetch_scope_ids_by_barangay_id($bid);
        if (!$scope) throw new RuntimeException('Barangay scope missing');

        if (!hv_barangay_can_use_responder($responderUserId, (int)$scope['barangay_id'], (int)$scope['municipality_id'], (int)$scope['province_id'])) {
            throw new RuntimeException('Responder is not eligible for this barangay scope');
        }

        $assignStatusRow = hv_get_assignment_status_row_by_code('assigned');
        if (!$assignStatusRow) throw new RuntimeException('Missing assignment status');
        $assignStatusId = (int)$assignStatusRow['id'];

        $reportStatusRow = hv_get_report_status_row_by_code('responders_assigned');
        if (!$reportStatusRow) throw new RuntimeException('Missing report status responders_assigned');
        $reportStatusId = (int)$reportStatusRow['id'];

        $responderCheck = $conn->prepare(
            'SELECT rp.department_id, COALESCE(rd.dept_code, "disaster") AS dept_code,
                    COALESCE(rp.can_receive_assignment, 1) AS can_receive_assignment,
                    COALESCE(rp.max_active_assignments, 1) AS max_active_assignments,
                    COALESCE(ras.status_code, "offline") AS availability_code,
                    COALESCE(ras.is_dispatchable, 0) AS is_dispatchable,
                    (
                        SELECT COUNT(*)
                        FROM hazard_report_assignment_responders ar2
                        INNER JOIN hazard_report_assignments a2 ON a2.id = ar2.assignment_id
                        WHERE ar2.responder_user_id = rp.user_id
                          AND a2.active_flag = 1
                    ) AS active_assignment_count
             FROM responder_profiles rp
             LEFT JOIN responder_departments rd ON rd.id = rp.department_id
             LEFT JOIN responder_availability_statuses ras ON ras.id = rp.availability_status_id
             WHERE rp.user_id = ?
             LIMIT 1'
        );
        $responderCheck->bind_param('i', $responderUserId);
        $responderCheck->execute();
        $responderRow = $responderCheck->get_result()->fetch_assoc();
        $responderCheck->close();
        if (!$responderRow) throw new RuntimeException('Responder profile is missing');

        $availabilityCode = strtolower(trim((string)($responderRow['availability_code'] ?? '')));
        $isDispatchable = (int)($responderRow['is_dispatchable'] ?? 0) === 1;
        $canReceiveAssignment = (int)($responderRow['can_receive_assignment'] ?? 0) === 1;
        $maxActiveAssignments = (int)($responderRow['max_active_assignments'] ?? 1);
        $activeAssignmentCount = (int)($responderRow['active_assignment_count'] ?? 0);
        if (!$isDispatchable || !$canReceiveAssignment || $availabilityCode !== 'available') {
            throw new RuntimeException('Responder is not currently available for dispatch');
        }
        if ($maxActiveAssignments > 0 && $activeAssignmentCount >= $maxActiveAssignments) {
            throw new RuntimeException('Responder already reached max active assignments');
        }

        $requiredDeptCode = hv_responder_required_dept_code((string)($reportRow['hazard_type'] ?? ''));
        $responderDeptCode = strtolower(trim((string)($responderRow['dept_code'] ?? 'disaster')));
        if ($requiredDeptCode !== $responderDeptCode) {
            throw new RuntimeException('Responder department does not match incident department requirement');
        }

        $deptId = isset($responderRow['department_id']) && $responderRow['department_id'] !== null ? (int)$responderRow['department_id'] : 0;
        if ($deptId <= 0) throw new RuntimeException('Responder department is missing');

        $closeActive = $conn->prepare('UPDATE hazard_report_assignments SET active_flag = 0, closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ? WHERE hazard_report_id = ? AND active_flag = 1');
        $uid = (int)$user['id'];
        $closeActive->bind_param('ii', $uid, $reportId);
        $closeActive->execute();
        $closeActive->close();

        $insert = $conn->prepare('INSERT INTO hazard_report_assignments (hazard_report_id, assigned_by_user_id, department_id, primary_responder_user_id, assignment_status_id, notes) VALUES (?, ?, ?, ?, ?, ?)');
        $insert->bind_param('iiiiis', $reportId, $uid, $deptId, $responderUserId, $assignStatusId, $note);
        $insert->execute();
        $assignmentId = (int)$conn->insert_id;
        $insert->close();

        $team = $conn->prepare('INSERT INTO hazard_report_assignment_responders (assignment_id, responder_user_id, team_role, is_primary) VALUES (?, ?, ?, 1)');
        $teamRole = 'Primary Responder';
        $team->bind_param('iis', $assignmentId, $responderUserId, $teamRole);
        $team->execute();
        $team->close();

        $assignHistory = $conn->prepare('INSERT INTO hazard_report_assignment_status_history (assignment_id, assignment_status_id, updated_by_user_id, note) VALUES (?, ?, ?, ?)');
        $assignHistoryNote = ($note !== '') ? $note : 'Assignment created by barangay';
        $assignHistory->bind_param('iiis', $assignmentId, $assignStatusId, $uid, $assignHistoryNote);
        $assignHistory->execute();
        $assignHistory->close();

        $updateReport = $conn->prepare('UPDATE hazard_reports SET status_id = ? WHERE id = ?');
        $updateReport->bind_param('ii', $reportStatusId, $reportId);
        $updateReport->execute();
        $updateReport->close();

        $reportHistory = $conn->prepare('INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note) VALUES (?, ?, ?, ?)');
        $reportHistoryNote = 'Barangay assigned responder #' . $responderUserId;
        $reportHistory->bind_param('iiis', $reportId, $reportStatusId, $uid, $reportHistoryNote);
        $reportHistory->execute();
        $reportHistory->close();

        hv_set_responder_availability_if_exists($responderUserId, 'busy', $uid, 'Assigned to report #' . $reportId);

        $conn->commit();
        hv_json(['ok' => true, 'assignmentId' => $assignmentId, 'statusCode' => 'responders_assigned', 'statusLabel' => (string)$reportStatusRow['status_label']]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        $message = $e instanceof RuntimeException ? $e->getMessage() : 'Assignment failed';
        hv_json(['ok' => false, 'error' => $message], 500);
    }
}

function hv_handle_barangay_responders(): void
{
    $user = hv_get_current_user();
    $roleName = (string)$user['role_name'];
    if ($roleName !== 'Barangay Staff' && $roleName !== 'Barangay') hv_json(['ok' => false, 'error' => 'Forbidden'], 403);

    global $conn;
    $barangayId = (int)$user['barangay_id'];
    $scope = hv_fetch_scope_ids_by_barangay_id($barangayId);
    if (!$scope) hv_json(['ok' => true, 'responders' => []]);

    $requestBarangayId = (int)$scope['barangay_id'];
    $municipalityId = (int)$scope['municipality_id'];
    $provinceId = (int)$scope['province_id'];
    $responderRoleCode = 'responder';

    $latExpr = 'NULL';
    $lngExpr = 'NULL';
    if (hv_has_col($conn, 'responder_profiles', 'latitude')) $latExpr = 'rp.latitude';
    elseif (hv_has_col($conn, 'responder_profiles', 'lat')) $latExpr = 'rp.lat';
    if (hv_has_col($conn, 'responder_profiles', 'longitude')) $lngExpr = 'rp.longitude';
    elseif (hv_has_col($conn, 'responder_profiles', 'lng')) $lngExpr = 'rp.lng';

    $stmt = $conn->prepare(
        'SELECT u.id, u.first_name, u.last_name, u.is_active, r.role_name, r.role_code,
                b.barangay_name, m.municipality_name, p.province_name,
                COALESCE(rd.dept_code, "disaster") AS dept_code,
                COALESCE(ras.status_code, "offline") AS availability_code,
                COALESCE(ras.status_label, "Offline") AS availability_label,
                COALESCE(ras.is_dispatchable, 0) AS is_dispatchable,
                COALESCE(rp.can_receive_assignment, 1) AS can_receive_assignment,
                COALESCE(rp.max_active_assignments, 1) AS max_active_assignments,
                (
                    SELECT a3.hazard_report_id
                    FROM hazard_report_assignment_responders ar3
                    INNER JOIN hazard_report_assignments a3 ON a3.id = ar3.assignment_id
                    WHERE ar3.responder_user_id = u.id
                      AND a3.active_flag = 1
                    ORDER BY a3.assigned_at DESC, a3.id DESC
                    LIMIT 1
                ) AS active_report_id,
                (
                    SELECT ras3.status_code
                    FROM hazard_report_assignment_responders ar3
                    INNER JOIN hazard_report_assignments a3 ON a3.id = ar3.assignment_id
                    INNER JOIN responder_assignment_statuses ras3 ON ras3.id = a3.assignment_status_id
                    WHERE ar3.responder_user_id = u.id
                      AND a3.active_flag = 1
                    ORDER BY a3.assigned_at DESC, a3.id DESC
                    LIMIT 1
                ) AS active_assignment_status_code,
                (
                    SELECT ras3.status_label
                    FROM hazard_report_assignment_responders ar3
                    INNER JOIN hazard_report_assignments a3 ON a3.id = ar3.assignment_id
                    INNER JOIN responder_assignment_statuses ras3 ON ras3.id = a3.assignment_status_id
                    WHERE ar3.responder_user_id = u.id
                      AND a3.active_flag = 1
                    ORDER BY a3.assigned_at DESC, a3.id DESC
                    LIMIT 1
                ) AS active_assignment_status_label,
                (
                    SELECT COUNT(*)
                    FROM hazard_report_assignment_responders ar2
                    INNER JOIN hazard_report_assignments a2 ON a2.id = ar2.assignment_id
                    WHERE ar2.responder_user_id = u.id
                      AND a2.active_flag = 1
                ) AS active_assignment_count,
                ' . $latExpr . ' AS responder_latitude,
                ' . $lngExpr . ' AS responder_longitude
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         INNER JOIN barangays b ON b.id = u.barangay_id
         INNER JOIN municipalities m ON m.id = b.municipality_id
         INNER JOIN provinces p ON p.id = m.province_id
         LEFT JOIN responder_profiles rp ON rp.user_id = u.id
         LEFT JOIN responder_departments rd ON rd.id = rp.department_id
         LEFT JOIN responder_availability_statuses ras ON ras.id = rp.availability_status_id
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
            'availabilityCode' => (string)$row['availability_code'],
            'availabilityLabel' => (string)$row['availability_label'],
            'isDispatchable' => ((int)($row['is_dispatchable'] ?? 0)) === 1,
            'canReceiveAssignment' => ((int)($row['can_receive_assignment'] ?? 0)) === 1,
            'maxActiveAssignments' => (int)($row['max_active_assignments'] ?? 1),
            'activeAssignmentCount' => (int)($row['active_assignment_count'] ?? 0),
            'activeReportId' => isset($row['active_report_id']) && $row['active_report_id'] !== null ? (int)$row['active_report_id'] : null,
            'activeAssignmentStatusCode' => (string)($row['active_assignment_status_code'] ?? ''),
            'activeAssignmentStatusLabel' => (string)($row['active_assignment_status_label'] ?? ''),
            'barangay' => (string)$row['barangay_name'],
            'city' => (string)$row['municipality_name'],
            'province' => (string)$row['province_name'],
            'deptKey' => (string)$row['dept_code'],
            'latitude' => $row['responder_latitude'] !== null ? (float)$row['responder_latitude'] : null,
            'longitude' => $row['responder_longitude'] !== null ? (float)$row['responder_longitude'] : null,
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

    $history = [];
    $dedupe = [];

    $pushHistory = static function (array $row) use (&$history, &$dedupe): void {
        $code = strtolower(trim((string)($row['statusCode'] ?? '')));
        $createdAt = (string)($row['createdAt'] ?? '');
        $updatedBy = strtolower(trim((string)($row['updatedBy'] ?? '')));
        $dedupeKey = $code . '|' . $createdAt . '|' . $updatedBy;
        if (isset($dedupe[$dedupeKey])) return;
        $dedupe[$dedupeKey] = true;
        $history[] = $row;
    };

    $reportHistoryStmt = $conn->prepare(
        'SELECT h.id, rs.status_code, rs.status_label, h.note, h.created_at,
                CONCAT(u.first_name, " ", u.last_name) AS updated_by_name
         FROM hazard_report_status_history h
         INNER JOIN report_statuses rs ON rs.id = h.status_id
         INNER JOIN users u ON u.id = h.updated_by_user_id
         WHERE h.hazard_report_id = ?
         ORDER BY h.created_at ASC, h.id ASC'
    );
    $reportHistoryStmt->bind_param('i', $reportId);
    $reportHistoryStmt->execute();
    $reportRes = $reportHistoryStmt->get_result();
    while ($row = $reportRes->fetch_assoc()) {
        $pushHistory([
            'id' => (int)$row['id'],
            'statusCode' => (string)$row['status_code'],
            'statusLabel' => (string)$row['status_label'],
            'note' => (string)($row['note'] ?? ''),
            'updatedBy' => (string)($row['updated_by_name'] ?? ''),
            'createdAt' => (string)$row['created_at'],
        ]);
    }
    $reportHistoryStmt->close();

    $assignmentHistoryStmt = $conn->prepare(
        'SELECT ah.id, ras.status_code, ras.status_label, ah.note, ah.created_at,
                CONCAT(u.first_name, " ", u.last_name) AS updated_by_name
         FROM hazard_report_assignment_status_history ah
         INNER JOIN hazard_report_assignments a ON a.id = ah.assignment_id
         INNER JOIN responder_assignment_statuses ras ON ras.id = ah.assignment_status_id
         INNER JOIN users u ON u.id = ah.updated_by_user_id
         WHERE a.hazard_report_id = ?
         ORDER BY ah.created_at ASC, ah.id ASC'
    );
    $assignmentHistoryStmt->bind_param('i', $reportId);
    $assignmentHistoryStmt->execute();
    $assignmentRes = $assignmentHistoryStmt->get_result();
    while ($row = $assignmentRes->fetch_assoc()) {
        $assignmentCode = strtolower(trim((string)($row['status_code'] ?? '')));
        $mappedCode = $assignmentCode === 'assigned' ? 'responders_assigned' : $assignmentCode;
        $mappedLabel = (string)($row['status_label'] ?? '');
        if ($assignmentCode === 'assigned') $mappedLabel = 'Responders Assigned';

        $pushHistory([
            'id' => (int)$row['id'],
            'statusCode' => $mappedCode,
            'statusLabel' => $mappedLabel,
            'note' => (string)($row['note'] ?? ''),
            'updatedBy' => (string)($row['updated_by_name'] ?? ''),
            'createdAt' => (string)$row['created_at'],
        ]);
    }
    $assignmentHistoryStmt->close();

    $rank = static function (string $statusCode): int {
        $code = strtolower(trim($statusCode));
        if ($code === 'pending_barangay') return 1;
        if ($code === 'verified_barangay') return 2;
        if ($code === 'responders_assigned') return 3;
        if ($code === 'on_the_way') return 4;
        if ($code === 'arrived') return 5;
        if ($code === 'responding') return 6;
        if ($code === 'resolved') return 7;
        if ($code === 'rejected_barangay') return 7;
        return 999;
    };

    usort($history, static function (array $a, array $b) use ($rank): int {
        $ta = strtotime((string)($a['createdAt'] ?? '')) ?: 0;
        $tb = strtotime((string)($b['createdAt'] ?? '')) ?: 0;
        if ($ta !== $tb) return $ta <=> $tb;

        $ra = $rank((string)($a['statusCode'] ?? ''));
        $rb = $rank((string)($b['statusCode'] ?? ''));
        if ($ra !== $rb) return $ra <=> $rb;

        $ia = (int)($a['id'] ?? 0);
        $ib = (int)($b['id'] ?? 0);
        return $ia <=> $ib;
    });

    hv_json(['ok' => true, 'history' => $history]);
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
    if ($assignmentId <= 0 && $reportId <= 0) hv_json(['ok' => false, 'error' => 'Assignment or report id is required'], 422);

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
        if ($assignmentId > 0) $assignmentQuery .= ' AND a.id = ?';
        else $assignmentQuery .= ' AND a.hazard_report_id = ? AND a.active_flag = 1';
        $assignmentQuery .= ' LIMIT 1';

        $stmt = $conn->prepare($assignmentQuery);
        if ($assignmentId > 0) $stmt->bind_param('ii', $bid, $assignmentId);
        else $stmt->bind_param('ii', $bid, $reportId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) throw new RuntimeException('Assignment not found for barangay');

        if (strtolower(trim((string)$row['status_code'])) !== 'resolved') {
            throw new RuntimeException('Assignment must be resolved before barangay confirmation');
        }

        $resolvedReportStatusRow = hv_get_report_status_row_by_code('resolved');
        if (!$resolvedReportStatusRow) throw new RuntimeException('Missing resolved report status');
        $resolvedReportStatusId = (int)$resolvedReportStatusRow['id'];

        $aid = (int)$row['id'];
        $hid = (int)$row['hazard_report_id'];
        $responderUserId = (int)($row['primary_responder_user_id'] ?? 0);

        $close = $conn->prepare('UPDATE hazard_report_assignments SET active_flag = 0, closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ? WHERE id = ?');
        $close->bind_param('ii', $uid, $aid);
        $close->execute();
        $close->close();

        $updateReport = $conn->prepare('UPDATE hazard_reports SET status_id = ? WHERE id = ?');
        $updateReport->bind_param('ii', $resolvedReportStatusId, $hid);
        $updateReport->execute();
        $updateReport->close();

        $history = $conn->prepare('INSERT INTO hazard_report_status_history (hazard_report_id, status_id, updated_by_user_id, note) VALUES (?, ?, ?, ?)');
        $note = 'Barangay confirmed incident resolved';
        $history->bind_param('iiis', $hid, $resolvedReportStatusId, $uid, $note);
        $history->execute();
        $history->close();

        if ($responderUserId > 0) hv_set_responder_availability_if_exists($responderUserId, 'available', $uid, 'Barangay confirmed resolved on assignment #' . $aid);

        $conn->commit();
        hv_json(['ok' => true, 'assignmentId' => $aid, 'reportId' => $hid, 'statusCode' => 'resolved', 'statusLabel' => (string)$resolvedReportStatusRow['status_label']]);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        hv_json(['ok' => false, 'error' => 'Barangay resolution confirmation failed'], 500);
    }
}

$action = trim((string)($_GET['action'] ?? ''));
$allowed = [
    'barangay_feed',
    'barangay_review',
    'barangay_assign',
    'barangay_responders',
    'barangay_report_history',
    'barangay_confirm_resolved',
];
if ($action === '' || !in_array($action, $allowed, true)) {
    hv_json(['ok' => false, 'error' => 'Unknown action'], 404);
}

if ($action === 'barangay_feed') hv_handle_barangay_feed();
if ($action === 'barangay_review') hv_handle_barangay_review();
if ($action === 'barangay_assign') hv_handle_barangay_assign();
if ($action === 'barangay_responders') hv_handle_barangay_responders();
if ($action === 'barangay_report_history') hv_handle_barangay_report_history();
if ($action === 'barangay_confirm_resolved') hv_handle_barangay_confirm_resolved();

hv_json(['ok' => false, 'error' => 'Unknown action'], 404);
