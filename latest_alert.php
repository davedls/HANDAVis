<?php
require_once __DIR__ . '/database/config.php';
header('Content-Type: application/json');

$stmt = $conn->prepare(
    'SELECT alert_id, title, description, alert_type, created_at
     FROM regional_alerts
     WHERE status = ?
     ORDER BY created_at DESC
     LIMIT 1'
);
$active = 'active';
$stmt->bind_param('s', $active);
$stmt->execute();
$alert = $stmt->get_result()->fetch_assoc();
$stmt->close();

echo json_encode($alert ?: null);