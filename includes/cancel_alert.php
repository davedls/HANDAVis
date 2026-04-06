<?php
require_once __DIR__ . '/../database/require_login.php';
require_once __DIR__ . '/../database/require_role.php';
require_once __DIR__ . '/../database/config.php';
hv_require_login('../index.php?auth=login&notice=login_required');
hv_require_role(['Admin'], '../user_home.php');

header('Content-Type: application/json');

$alert_id = (int)($_POST['alert_id'] ?? 0);
if ($alert_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid alert.']);
    exit;
}

try {
    $stmt = $conn->prepare(
        "DELETE FROM regional_alerts WHERE alert_id = ?"
    );
    $stmt->bind_param('i', $alert_id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Alert not found.']);
        $stmt->close();
        exit;
    }

    $stmt->close();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}