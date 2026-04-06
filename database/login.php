<?php
session_start();
require_once __DIR__ . '/config.php';

function back_to_previous(string $tab = 'login'): void {
    $fallback = '../index.php';
    $target = $_SERVER['HTTP_REFERER'] ?? $fallback;
    $separator = (strpos($target, '?') === false) ? '?' : '&';
    header('Location: ' . $target . $separator . 'auth=' . urlencode($tab));
    exit;
}

function hv_take_post_login_redirect(): string {
    $raw = (string)($_SESSION['post_login_redirect'] ?? '');
    unset($_SESSION['post_login_redirect']);
    return trim($raw);
}

function hv_is_allowed_post_login_redirect(string $target, string $roleCode, string $roleName): bool {
    if ($target === '') return false;
    if (preg_match('/[\r\n]/', $target)) return false;

    $parts = parse_url($target);
    if ($parts === false) return false;
    if (!empty($parts['scheme']) || !empty($parts['host'])) return false;

    $path = (string)($parts['path'] ?? '');
    if ($path === '') return false;

    $roleCode = strtolower(trim($roleCode));
    $roleName = strtolower(trim($roleName));

    $isResponder = ($roleCode === 'responder' || $roleName === 'responder');
    $isBarangay = ($roleCode === 'barangay_staff' || $roleCode === 'barangay' || $roleName === 'barangay staff' || $roleName === 'barangay');
    $isAdmin = ($roleCode === 'admin' || $roleName === 'admin');

    if ($isResponder) return strpos($path, '/roles/responders/') !== false;
    if ($isBarangay) return strpos($path, '/roles/barangays/') !== false;
    if ($isAdmin) return strpos($path, '/roles/admin/') !== false;

    return strpos($path, '/user_') !== false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    back_to_previous('login');
}

$email = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if ($email === '' || $password === '') {
    $_SESSION['auth_error'] = 'Please enter your email and password.';
    $_SESSION['auth_tab'] = 'login';
    back_to_previous('login');
}

if (strlen($password) > 255) {
    $_SESSION['auth_error'] = 'Invalid login request.';
    $_SESSION['auth_tab'] = 'login';
    back_to_previous('login');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $_SESSION['auth_error'] = 'Please enter a valid email address.';
    $_SESSION['auth_tab'] = 'login';
    back_to_previous('login');
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $stmt = $conn->prepare(
        'SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.is_active, r.role_name, r.role_code
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.email = ?
         LIMIT 1'
    );
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        $_SESSION['auth_error'] = 'Invalid email or password.';
        $_SESSION['auth_tab'] = 'login';
        back_to_previous('login');
    }

    if ((int)$user['is_active'] !== 1) {
        $_SESSION['auth_error'] = 'Your account is inactive. Please contact support or an administrator.';
        $_SESSION['auth_tab'] = 'login';
        back_to_previous('login');
    }

    session_regenerate_id(true);

    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['user'] = [
        'id' => (int)$user['id'],
        'first_name' => $user['first_name'] ?? '',
        'last_name' => $user['last_name'] ?? '',
        'email' => $user['email'] ?? '',
        'role' => $user['role_name'] ?? 'User',
    ];

    $roleName = $user['role_name'] ?? 'User';
    $roleCode = strtolower(trim((string)($user['role_code'] ?? '')));
    $target = '../user_home.php';
    if ($roleName === 'Barangay Staff' || $roleName === 'Barangay' || $roleCode === 'barangay_staff' || $roleCode === 'barangay') {
        $target = '../roles/barangays/barangay_index.php';
    } elseif ($roleName === 'Responder' || $roleCode === 'responder') {
        $target = '../roles/responders/index.php';
    } elseif ($roleName === 'Admin' || $roleCode === 'admin') {
        $target = '../roles/admin/admin_index.php';
    }

    $postLoginTarget = hv_take_post_login_redirect();
    if (hv_is_allowed_post_login_redirect($postLoginTarget, $roleCode, $roleName)) {
        $target = $postLoginTarget;
    }

    header('Location: ' . $target);
    exit;
} catch (Throwable $e) {
    $_SESSION['auth_error'] = 'Login failed. Please check your database connection and users table.';
    $_SESSION['auth_tab'] = 'login';
    back_to_previous('login');
}
