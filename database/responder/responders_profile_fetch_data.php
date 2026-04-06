<?php
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../require_login.php';
require_once __DIR__ . '/../config.php';

hv_require_login('../../index.php?auth=login&notice=login_required');

$userId = (int)($_SESSION['user_id'] ?? 0);

function hv_has_col(mysqli $conn, string $table, string $column): bool
{
    $stmt = $conn->prepare(
        'SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1'
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $exists = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    return $exists;
}

$hasPosition = hv_has_col($conn, 'responder_profiles', 'position_role');
$hasAddress = hv_has_col($conn, 'responder_profiles', 'address');
$hasPhoto = hv_has_col($conn, 'responder_profiles', 'profile_photo_path');

$extraSelect = '';
if ($hasPosition) $extraSelect .= ', rp.position_role';
if ($hasAddress) $extraSelect .= ', rp.address';
if ($hasPhoto) $extraSelect .= ', rp.profile_photo_path';

$profile = [
    'user_id' => $userId,
    'first_name' => '',
    'last_name' => '',
    'email' => '',
    'phone' => '',
    'barangay_name' => '',
    'municipality_name' => '',
    'province_name' => '',
    'responder_code' => '',
    'department_name' => 'Disaster Response Team',
    'department_code' => 'disaster',
    'availability_status' => 'Available',
    'availability_code' => 'available',
    'position_role' => 'Responder',
    'address' => '',
    'profile_photo_path' => '',
];

$stmt = $conn->prepare(
    'SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone,
            b.barangay_name, m.municipality_name, p.province_name,
            rp.responder_code,
            rd.dept_name AS department_name,
            rd.dept_code AS department_code,
            ras.status_label AS availability_status,
            ras.status_code AS availability_code' . $extraSelect . '
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN barangays b ON b.id = u.barangay_id
     LEFT JOIN municipalities m ON m.id = b.municipality_id
     LEFT JOIN provinces p ON p.id = m.province_id
     LEFT JOIN responder_profiles rp ON rp.user_id = u.id
     LEFT JOIN responder_departments rd ON rd.id = rp.department_id
     LEFT JOIN responder_availability_statuses ras ON ras.id = rp.availability_status_id
     WHERE u.id = ?
     LIMIT 1'
);
$stmt->bind_param('i', $userId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($row) {
    $profile = array_merge($profile, $row);
}

$fullName = trim(((string)$profile['first_name']) . ' ' . ((string)$profile['last_name']));
if ($fullName === '') $fullName = 'Responder';

$responderCode = trim((string)($profile['responder_code'] ?? ''));
if ($responderCode === '') {
    $responderCode = 'R-' . str_pad((string)$userId, 5, '0', STR_PAD_LEFT);
}

$avatarInitials = strtoupper(substr((string)$profile['first_name'], 0, 1) . substr((string)$profile['last_name'], 0, 1));
if ($avatarInitials === '') $avatarInitials = 'R';

$avatarUrl = '';
$avatarPath = trim((string)($profile['profile_photo_path'] ?? ''));
if ($avatarPath !== '') {
    $avatarUrl = '/HANDAVis/' . ltrim(str_replace('\\', '/', $avatarPath), '/');
}

$currentIncidentStatus = 'No active incident';
$activeIncidentStmt = $conn->prepare(
    'SELECT ras.status_label
     FROM hazard_report_assignments a
     INNER JOIN hazard_report_assignment_responders ar ON ar.assignment_id = a.id
     INNER JOIN responder_assignment_statuses ras ON ras.id = a.assignment_status_id
     WHERE ar.responder_user_id = ?
       AND a.active_flag = 1
     ORDER BY a.assigned_at DESC, a.id DESC
     LIMIT 1'
);
$activeIncidentStmt->bind_param('i', $userId);
$activeIncidentStmt->execute();
$activeIncidentRow = $activeIncidentStmt->get_result()->fetch_assoc();
$activeIncidentStmt->close();
if ($activeIncidentRow && !empty($activeIncidentRow['status_label'])) {
    $currentIncidentStatus = (string)$activeIncidentRow['status_label'];
}

$activity = [
    'total_handled' => 0,
    'active_assignments' => 0,
    'resolved_incidents' => 0,
];

$activityStmt = $conn->prepare(
    'SELECT
        COUNT(DISTINCT a.id) AS total_handled,
        SUM(CASE WHEN a.active_flag = 1 THEN 1 ELSE 0 END) AS active_assignments,
        SUM(CASE WHEN (LOWER(ras.status_code) = "resolved" OR a.resolved_at IS NOT NULL) THEN 1 ELSE 0 END) AS resolved_incidents
     FROM hazard_report_assignments a
     INNER JOIN hazard_report_assignment_responders ar ON ar.assignment_id = a.id
     LEFT JOIN responder_assignment_statuses ras ON ras.id = a.assignment_status_id
     WHERE ar.responder_user_id = ?'
);
$activityStmt->bind_param('i', $userId);
$activityStmt->execute();
$activityRow = $activityStmt->get_result()->fetch_assoc();
$activityStmt->close();
if ($activityRow) {
    $activity['total_handled'] = (int)($activityRow['total_handled'] ?? 0);
    $activity['active_assignments'] = (int)($activityRow['active_assignments'] ?? 0);
    $activity['resolved_incidents'] = (int)($activityRow['resolved_incidents'] ?? 0);
}

$availabilityLabel = (string)($profile['availability_status'] ?? 'Available');
$availabilityCode = strtolower(trim((string)($profile['availability_code'] ?? 'available')));
$departmentName = (string)($profile['department_name'] ?? 'Disaster Response Team');
$departmentCode = strtolower(trim((string)($profile['department_code'] ?? 'disaster')));
$positionRole = trim((string)($profile['position_role'] ?? 'Responder'));
if ($positionRole === '') $positionRole = 'Responder';

$assignedBarangay = trim((string)($profile['barangay_name'] ?? ''));
if ($assignedBarangay === '') $assignedBarangay = 'Not assigned';
