<?php
declare(strict_types=1);

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
$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if (!isset($allowed[$mime])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Only JPG, PNG, and WEBP are allowed']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$ext = $allowed[$mime];
$uploadDirAbs = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . 'responder_avatars';
if (!is_dir($uploadDirAbs) && !mkdir($uploadDirAbs, 0775, true) && !is_dir($uploadDirAbs)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not create upload directory']);
    exit;
}

$fileName = 'responder_' . $userId . '_' . time() . '.' . $ext;
$targetAbs = $uploadDirAbs . DIRECTORY_SEPARATOR . $fileName;
if (!move_uploaded_file($tmpPath, $targetAbs)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not save file']);
    exit;
}

$relativePath = 'images/responder_avatars/' . $fileName;

require_once __DIR__ . '/../config.php';

function hv_has_col(mysqli $conn, string $table, string $column): bool
{
    $stmt = $conn->prepare(
        'SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1'
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    $exists = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    return $exists;
}

function hv_ensure_col(mysqli $conn, string $table, string $column, string $definition): void
{
    if (hv_has_col($conn, $table, $column)) return;
    $conn->query('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $definition);
}

try {
    hv_ensure_col($conn, 'responder_profiles', 'profile_photo_path', 'VARCHAR(255) NULL');

    $upsert = $conn->prepare(
        'INSERT INTO responder_profiles (user_id, profile_photo_path)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE profile_photo_path = VALUES(profile_photo_path)'
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
