<?php
require_once __DIR__ . '/../database/require_login.php';
require_once __DIR__ . '/../database/require_role.php';
require_once __DIR__ . '/../database/config.php';
hv_require_login('../index.php?auth=login&notice=login_required');
hv_require_role(['Admin'], '../user_home.php');

header('Content-Type: application/json');

$result = $conn->query(
    "SELECT alert_id, title, alert_type, description, status, created_at
     FROM regional_alerts
     ORDER BY created_at DESC"
);

if (!$result) {
    echo json_encode([]);
    exit;
}

$alerts = [];
while ($row = $result->fetch_assoc()) {
    $alerts[] = $row;
}

echo json_encode($alerts);