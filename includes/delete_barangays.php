<?php
require_once __DIR__ . '/../database/require_login.php';
require_once __DIR__ . '/../database/require_role.php';
require_once __DIR__ . '/../database/config.php';
hv_require_login('../index.php?auth=login&notice=login_required');
hv_require_role(['Admin'], '../user_home.php');

header('Content-Type: application/json');

$id   = (int)($_POST['id'] ?? 0);
$name = trim($_POST['barangay_name'] ?? '');

if ($id <= 0 || $name === '') { echo json_encode(['success' => false, 'message' => 'Invalid data.']); exit; }

try {
    $stmt = $conn->prepare("UPDATE barangays SET barangay_name = ? WHERE id = ?");
    $stmt->bind_param('si', $name, $id);
    $stmt->execute();
    if ($stmt->affected_rows === 0) { echo json_encode(['success' => false, 'message' => 'Not found.']); $stmt->close(); exit; }
    $stmt->close();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
