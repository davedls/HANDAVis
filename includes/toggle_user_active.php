<?php
require_once __DIR__ . '/../database/require_login.php';
require_once __DIR__ . '/../database/require_role.php';
require_once __DIR__ . '/../database/config.php';
hv_require_login();
hv_require_role(['Admin']);

header('Content-Type: application/json');

$userId   = isset($_POST['user_id'])  ? (int)$_POST['user_id']  : 0;
$isActive = isset($_POST['is_active']) ? (int)$_POST['is_active'] : 0;

if ($userId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid user ID.']);
    exit;
}

$isActive = $isActive ? 1 : 0;

try {
    $stmt = $conn->prepare('UPDATE users SET is_active = ? WHERE id = ?');
    $stmt->bind_param('ii', $isActive, $userId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected > 0) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'User not found or no change made.']);
    }
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => 'Database error.']);
}