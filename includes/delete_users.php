<?php
require_once __DIR__ . '/../database/require_login.php';
require_once __DIR__ . '/../database/require_role.php';
require_once __DIR__ . '/../database/config.php';
hv_require_login('../index.php?auth=login&notice=login_required');
hv_require_role(['Admin'], '../user_home.php');

header('Content-Type: application/json');

$user_id = (int)($_POST['user_id'] ?? 0);
if ($user_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid user.']);
    exit;
}

// Prevent admin from deleting themselves
if ($user_id === (int)$_SESSION['user_id']) {
    echo json_encode(['success' => false, 'message' => 'You cannot delete your own account.']);
    exit;
}

try {
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param('i', $user_id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        $stmt->close();
        exit;
    }

    $stmt->close();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}