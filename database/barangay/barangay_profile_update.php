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

require_once __DIR__ . '/../config.php';

function hv_barangay_profile_fail(int $status, string $message): void
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
    hv_barangay_profile_fail(400, 'Invalid request payload.');
}

$userId = (int)$_SESSION['user_id'];
$email = trim((string)($payload['email'] ?? ''));
$phone = trim((string)($payload['phone'] ?? ''));
$barangayHallAddress = trim((string)($payload['barangay_hall_address'] ?? ''));

if ($email === '') {
    hv_barangay_profile_fail(422, 'Official email address is required.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    hv_barangay_profile_fail(422, 'Please enter a valid official email address.');
}
if ($phone !== '' && !preg_match('/^(09\d{9}|\+639\d{9})$/', $phone)) {
    hv_barangay_profile_fail(422, 'Please enter a valid official contact number.');
}
if (mb_strlen($barangayHallAddress) > 255) {
    hv_barangay_profile_fail(422, 'Barangay hall address is too long.');
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
        hv_barangay_profile_fail(409, 'That email is already used by another account.');
    }

    $userStmt = $conn->prepare(
        'UPDATE users
         SET email = ?, phone = ?
         WHERE id = ?
         LIMIT 1'
    );
    $userStmt->bind_param('ssi', $email, $phone, $userId);
    $userStmt->execute();
    $userStmt->close();

    hv_ensure_profile_column($conn, 'barangay_hall_address', 'VARCHAR(255) NULL');

    $profileStmt = $conn->prepare(
        'INSERT INTO user_profiles (user_id, barangay_hall_address)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE
           barangay_hall_address = VALUES(barangay_hall_address)'
    );
    $profileStmt->bind_param('is', $userId, $barangayHallAddress);
    $profileStmt->execute();
    $profileStmt->close();

    $conn->commit();

    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        $_SESSION['user'] = [];
    }
    $_SESSION['user']['email'] = $email;

    echo json_encode(['ok' => true, 'message' => 'Barangay profile updated successfully.']);
} catch (Throwable $e) {
    try {
        $conn->rollback();
    } catch (Throwable $rollbackError) {
    }
    hv_barangay_profile_fail(500, 'Unable to update profile right now.');
}
