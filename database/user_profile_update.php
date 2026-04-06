<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

if (!isset($_SESSION['user_id']) || (int)$_SESSION['user_id'] <= 0) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized.']);
    exit;
}

require_once __DIR__ . '/config.php';

function hv_profile_update_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

function hv_has_profile_column(mysqli $conn, string $column): bool
{
    $stmt = $conn->prepare(
        'SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = "user_profiles"
           AND COLUMN_NAME = ?
         LIMIT 1'
    );
    $stmt->bind_param('s', $column);
    $stmt->execute();
    $exists = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    return $exists;
}

function hv_ensure_profile_column(mysqli $conn, string $column, string $definition): void
{
    if (hv_has_profile_column($conn, $column)) {
        return;
    }
    $conn->query('ALTER TABLE user_profiles ADD COLUMN ' . $column . ' ' . $definition);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
    hv_profile_update_fail(400, 'Invalid request payload.');
}

$userId = (int)$_SESSION['user_id'];

$firstName = trim((string)($payload['first_name'] ?? ''));
$lastName = trim((string)($payload['last_name'] ?? ''));
$email = trim((string)($payload['email'] ?? ''));
$phone = trim((string)($payload['phone'] ?? ''));
$province = trim((string)($payload['province'] ?? ''));
$municipality = trim((string)($payload['municipality'] ?? ''));
$barangay = trim((string)($payload['barangay'] ?? ''));
$bio = trim((string)($payload['bio'] ?? ''));
$emergencyContactName = trim((string)($payload['emergency_contact_name'] ?? ''));
$emergencyContactPhone = trim((string)($payload['emergency_contact_phone'] ?? ''));

if ($firstName === '' || $lastName === '' || $email === '') {
    hv_profile_update_fail(422, 'First name, last name, and email are required.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    hv_profile_update_fail(422, 'Please enter a valid email address.');
}

if ($phone !== '' && !preg_match('/^(09\d{9}|\+639\d{9})$/', $phone)) {
    hv_profile_update_fail(422, 'Please enter a valid contact number.');
}
if ($emergencyContactPhone !== '' && !preg_match('/^(09\d{9}|\+639\d{9}|\+63\s?9\d{2}\s?\d{3}\s?\d{4})$/', $emergencyContactPhone)) {
    hv_profile_update_fail(422, 'Please enter a valid emergency contact number.');
}

if (mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100 || mb_strlen($email) > 255) {
    hv_profile_update_fail(422, 'One or more profile fields are too long.');
}
if (mb_strlen($phone) > 20 || mb_strlen($emergencyContactName) > 120 || mb_strlen($emergencyContactPhone) > 30 || mb_strlen($bio) > 2000) {
    hv_profile_update_fail(422, 'One or more profile fields are too long.');
}
if (mb_strlen($province) > 120 || mb_strlen($municipality) > 120 || mb_strlen($barangay) > 120) {
    hv_profile_update_fail(422, 'One or more location fields are too long.');
}

try {
    $conn->begin_transaction();

    $emailCheckStmt = $conn->prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1');
    $emailCheckStmt->bind_param('si', $email, $userId);
    $emailCheckStmt->execute();
    $emailUsed = $emailCheckStmt->get_result()->fetch_assoc();
    $emailCheckStmt->close();
    if ($emailUsed) {
        $conn->rollback();
        hv_profile_update_fail(409, 'That email is already used by another account.');
    }

    $barangayId = null;
    if ($province !== '' && $municipality !== '' && $barangay !== '') {
        $bgyStmt = $conn->prepare(
            'SELECT b.id
             FROM barangays b
             INNER JOIN municipalities m ON m.id = b.municipality_id
             INNER JOIN provinces p ON p.id = m.province_id
             WHERE p.province_name = ? AND m.municipality_name = ? AND b.barangay_name = ?
             LIMIT 1'
        );
        $bgyStmt->bind_param('sss', $province, $municipality, $barangay);
        $bgyStmt->execute();
        $bgyRow = $bgyStmt->get_result()->fetch_assoc();
        $bgyStmt->close();

        if (!$bgyRow) {
            $conn->rollback();
            hv_profile_update_fail(422, 'Selected province/municipality/barangay could not be matched.');
        }
        $barangayId = (int)$bgyRow['id'];
    } elseif ($province !== '' || $municipality !== '' || $barangay !== '') {
        $conn->rollback();
        hv_profile_update_fail(422, 'Please select a complete location: province, municipality, and barangay.');
    }

    if ($barangayId !== null) {
        $userStmt = $conn->prepare(
            'UPDATE users
             SET first_name = ?, last_name = ?, email = ?, phone = ?, barangay_id = ?
             WHERE id = ?
             LIMIT 1'
        );
        $userStmt->bind_param('ssssii', $firstName, $lastName, $email, $phone, $barangayId, $userId);
    } else {
        $userStmt = $conn->prepare(
            'UPDATE users
             SET first_name = ?, last_name = ?, email = ?, phone = ?
             WHERE id = ?
             LIMIT 1'
        );
        $userStmt->bind_param('ssssi', $firstName, $lastName, $email, $phone, $userId);
    }
    $userStmt->execute();
    $userStmt->close();

    hv_ensure_profile_column($conn, 'emergency_contact_name', 'VARCHAR(120) NULL');
    hv_ensure_profile_column($conn, 'emergency_contact_phone', 'VARCHAR(30) NULL');

    $profileStmt = $conn->prepare(
        'INSERT INTO user_profiles (user_id, bio, emergency_contact_name, emergency_contact_phone)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           bio = VALUES(bio),
           emergency_contact_name = VALUES(emergency_contact_name),
           emergency_contact_phone = VALUES(emergency_contact_phone)'
    );
    $profileStmt->bind_param('isss', $userId, $bio, $emergencyContactName, $emergencyContactPhone);
    $profileStmt->execute();
    $profileStmt->close();

    $conn->commit();

    $_SESSION['user']['first_name'] = $firstName;
    $_SESSION['user']['last_name'] = $lastName;
    $_SESSION['user']['email'] = $email;

    echo json_encode([
        'ok' => true,
        'message' => 'Profile updated successfully.'
    ]);
} catch (Throwable $e) {
    try {
        $conn->rollback();
    } catch (Throwable $rollbackError) {
    }
    hv_profile_update_fail(500, 'Unable to update profile right now.');
}
