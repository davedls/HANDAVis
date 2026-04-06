<?php
require_once __DIR__ . '/require_login.php';
hv_require_login();
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');



if (!isset($_SESSION['user_id'])) {
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_FILES['avatar'])) {
    echo json_encode(['ok' => false, 'error' => 'No file uploaded']);
    exit;
}

$file    = $_FILES['avatar'];
$allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$maxSize = 5 * 1024 * 1024; // 5MB

if (!in_array($file['type'], $allowed)) {
    echo json_encode(['ok' => false, 'error' => 'Invalid file type. Use JPG, PNG, WEBP or GIF.']);
    exit;
}

if ($file['size'] > $maxSize) {
    echo json_encode(['ok' => false, 'error' => 'File too large. Max 5MB.']);
    exit;
}

$userId    = (int)$_SESSION['user_id'];
$ext       = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename  = 'user_' . $userId . '_' . time() . '.' . $ext;
$uploadDir = __DIR__ . '/../images/profile_avatars/';
$avatarUrl = '/HANDAVis/images/profile_avatars/' . $filename;
$dbPath    = 'images/profile_avatars/' . $filename;

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
    echo json_encode(['ok' => false, 'error' => 'Failed to save file.']);
    exit;
}

try {
    // Check if user_profiles row exists
    $check = $conn->prepare("SELECT user_id FROM user_profiles WHERE user_id = ?");
    $check->bind_param('i', $userId);
    $check->execute();
    $exists = $check->get_result()->num_rows > 0;
    $check->close();

    if ($exists) {
        $stmt = $conn->prepare("UPDATE user_profiles SET avatar_path = ? WHERE user_id = ?");
        $stmt->bind_param('si', $dbPath, $userId);
    } else {
        $stmt = $conn->prepare("INSERT INTO user_profiles (user_id, avatar_path) VALUES (?, ?)");
        $stmt->bind_param('is', $userId, $dbPath);
    }

    $stmt->execute();
    $stmt->close();

    echo json_encode(['ok' => true, 'avatar_url' => $avatarUrl]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}