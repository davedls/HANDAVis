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

if (!isset($_FILES['avatar']) || !is_array($_FILES['avatar'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['avatar'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Upload failed']);
    exit;
}

$tmpPath = (string)($file['tmp_name'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid upload']);
    exit;
}

if ((int)($file['size'] ?? 0) > (5 * 1024 * 1024)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'File too large (max 5MB)']);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($tmpPath);
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Only JPG, PNG, and WEBP are allowed']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$ext = $allowed[$mime];
$uploadDirAbs = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . 'profile_avatars';
if (!is_dir($uploadDirAbs) && !mkdir($uploadDirAbs, 0775, true) && !is_dir($uploadDirAbs)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not create upload directory']);
    exit;
}

$fileName = 'avatar_' . $userId . '_' . time() . '.' . $ext;
$targetAbs = $uploadDirAbs . DIRECTORY_SEPARATOR . $fileName;
if (!move_uploaded_file($tmpPath, $targetAbs)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not save file']);
    exit;
}

$relativePath = 'images/profile_avatars/' . $fileName;
require_once __DIR__ . '/../config.php';

try {
    $upsert = $conn->prepare(
        'INSERT INTO user_profiles (user_id, avatar_path)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE avatar_path = VALUES(avatar_path)'
    );
    $upsert->bind_param('is', $userId, $relativePath);
    $upsert->execute();
    $upsert->close();

    echo json_encode([
        'ok' => true,
        'avatar_path' => $relativePath,
        'avatar_url' => '/HANDAVis/' . $relativePath . '?v=' . time(),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database update failed']);
}
