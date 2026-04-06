<?php
session_start();
require_once __DIR__ . '/../database/config.php';

if (!isset($_SESSION['user_id'])) {
    header('Location: ../index.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../roles/admin/admin_index.php');
    exit;
}

$title       = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$alert_type  = trim($_POST['alert_type'] ?? '');
$published_by = (int)$_SESSION['user_id'];

$allowed_types = ['emergency','typhoon','flood','earthquake','fire','tsunami','landslide','drought','other'];

if ($title === '' || $description === '' || !in_array($alert_type, $allowed_types)) {
    $_SESSION['alert_error'] = 'Please fill in all fields.';
    header('Location: ../roles/admin/admin_index.php');
    exit;
}

try {
    $stmt = $conn->prepare(
        'INSERT INTO regional_alerts (title, description, alert_type, status, published_by)
         VALUES (?, ?, ?, \'active\', ?)'
    );
    $stmt->bind_param('sssi', $title, $description, $alert_type, $published_by);
    $stmt->execute();
    $stmt->close();

    $_SESSION['alert_success'] = 'Alert published successfully.';
    header('Location: ../roles/admin/admin_index.php');
    exit;
} catch (Throwable $e) {
    $_SESSION['alert_error'] = 'Failed to publish alert. Please try again.';
    header('Location: ../roles/admin/admin_index.php');
    exit;
}