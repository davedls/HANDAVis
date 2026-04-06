<?php
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

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

function hv_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

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

function hv_ensure_col(mysqli $conn, string $table, string $column, string $definition): void
{
    if (hv_has_col($conn, $table, $column)) return;
    $conn->query('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $definition);
}

$data = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($data)) hv_fail(400, 'Invalid request payload.');

$userId = (int)$_SESSION['user_id'];
$firstName = trim((string)($data['first_name'] ?? ''));
$lastName = trim((string)($data['last_name'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$phone = trim((string)($data['phone'] ?? ''));
$address = trim((string)($data['address'] ?? ''));
$latitude = isset($data['latitude']) && is_numeric($data['latitude']) ? (float)$data['latitude'] : null;
$longitude = isset($data['longitude']) && is_numeric($data['longitude']) ? (float)$data['longitude'] : null;
$accuracy = isset($data['location_accuracy_m']) && is_numeric($data['location_accuracy_m']) ? (float)$data['location_accuracy_m'] : null;

if ($firstName === '' || $lastName === '' || $email === '') hv_fail(422, 'Full name and email are required.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) hv_fail(422, 'Please enter a valid email address.');
if ($phone !== '' && !preg_match('/^(09\d{9}|\+639\d{9})$/', $phone)) hv_fail(422, 'Please enter a valid contact number.');
if ($latitude !== null && ($latitude < -90.0 || $latitude > 90.0)) hv_fail(422, 'Latitude out of range.');
if ($longitude !== null && ($longitude < -180.0 || $longitude > 180.0)) hv_fail(422, 'Longitude out of range.');
if ($accuracy !== null && $accuracy < 0) $accuracy = null;

try {
    $conn->begin_transaction();

    $emailCheck = $conn->prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1');
    $emailCheck->bind_param('si', $email, $userId);
    $emailCheck->execute();
    $exists = $emailCheck->get_result()->fetch_assoc();
    $emailCheck->close();
    if ($exists) {
        $conn->rollback();
        hv_fail(409, 'That email is already used by another account.');
    }

    $u = $conn->prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ? LIMIT 1');
    $u->bind_param('ssssi', $firstName, $lastName, $email, $phone, $userId);
    $u->execute();
    $u->close();

    hv_ensure_col($conn, 'responder_profiles', 'address', 'VARCHAR(255) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'latitude', 'DECIMAL(10,7) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'longitude', 'DECIMAL(10,7) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'location_accuracy_m', 'DECIMAL(8,2) NULL');
    hv_ensure_col($conn, 'responder_profiles', 'last_location_at', 'DATETIME NULL');

    $rp = $conn->prepare(
        'INSERT INTO responder_profiles (user_id, address)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE address = VALUES(address)'
    );
    $rp->bind_param('is', $userId, $address);
    $rp->execute();
    $rp->close();

    if ($latitude !== null && $longitude !== null) {
        $latSql = (string)$latitude;
        $lngSql = (string)$longitude;
        $accSql = ($accuracy !== null && is_finite($accuracy)) ? (string)$accuracy : null;

        $loc = $conn->prepare(
            'UPDATE responder_profiles
             SET latitude = NULLIF(?, ""),
                 longitude = NULLIF(?, ""),
                 location_accuracy_m = NULLIF(?, ""),
                 last_location_at = CURRENT_TIMESTAMP
             WHERE user_id = ?
             LIMIT 1'
        );
        $loc->bind_param('sssi', $latSql, $lngSql, $accSql, $userId);
        $loc->execute();
        $loc->close();
    }

    $conn->commit();

    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        $_SESSION['user'] = [];
    }
    $_SESSION['user']['first_name'] = $firstName;
    $_SESSION['user']['last_name'] = $lastName;
    $_SESSION['user']['email'] = $email;

    echo json_encode(['ok' => true, 'message' => 'Responder profile updated successfully.']);
} catch (Throwable $e) {
    try { $conn->rollback(); } catch (Throwable $ignored) {}
    hv_fail(500, 'Unable to update responder profile right now.');
}
