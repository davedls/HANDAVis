<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || (int)$_SESSION['user_id'] <= 0) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Invalid request method']);
    exit;
}

$currentPassword = (string)($_POST['current_password'] ?? '');
$newPassword = (string)($_POST['new_password'] ?? '');
$confirmPassword = (string)($_POST['confirm_password'] ?? '');

if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please fill in all password fields.']);
    exit;
}
if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'New passwords do not match.']);
    exit;
}
if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Password must be at least 8 characters.']);
    exit;
}

require_once __DIR__ . '/../config.php';

$userId = (int)$_SESSION['user_id'];

try {
    $getStmt = $conn->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
    $getStmt->bind_param('i', $userId);
    $getStmt->execute();
    $row = $getStmt->get_result()->fetch_assoc();
    $getStmt->close();

    if (!$row || !password_verify($currentPassword, (string)$row['password_hash'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is incorrect.']);
        exit;
    }

    if (password_verify($newPassword, (string)$row['password_hash'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password must be different from current password.']);
        exit;
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateStmt = $conn->prepare('UPDATE users SET password_hash = ? WHERE id = ? LIMIT 1');
    $updateStmt->bind_param('si', $newHash, $userId);
    $updateStmt->execute();
    $updateStmt->close();

    echo json_encode(['ok' => true, 'message' => 'Password updated successfully.']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to update password. Please try again.']);
}
