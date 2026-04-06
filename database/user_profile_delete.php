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

require_once __DIR__ . '/config.php';

$userId = (int)$_SESSION['user_id'];

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn->begin_transaction();

    $profileStmt = $conn->prepare('DELETE FROM user_profiles WHERE user_id = ?');
    $profileStmt->bind_param('i', $userId);
    $profileStmt->execute();
    $profileStmt->close();

    $userStmt = $conn->prepare('DELETE FROM users WHERE id = ? LIMIT 1');
    $userStmt->bind_param('i', $userId);
    $userStmt->execute();
    $deletedRows = $userStmt->affected_rows;
    $userStmt->close();

    if ($deletedRows < 1) {
        throw new RuntimeException('User was not deleted.');
    }

    $conn->commit();

    $_SESSION = [];
    session_unset();
    session_destroy();

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    echo json_encode(['ok' => true, 'message' => 'Account deleted.', 'redirect' => '/HANDAVis/index.php']);
} catch (Throwable $e) {
    try {
        $conn->rollback();
    } catch (Throwable $rollbackError) {
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to delete account. This account may have related records. Please contact admin.']);
}
