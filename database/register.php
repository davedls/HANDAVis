<?php
session_start();
require_once __DIR__ . '/config.php';

function back_to_previous(string $tab = 'register'): void {
    $fallback = '../index.php';
    $target = $_SERVER['HTTP_REFERER'] ?? $fallback;
    $separator = (strpos($target, '?') === false) ? '?' : '&';
    header('Location: ' . $target . $separator . 'auth=' . urlencode($tab));
    exit;
}

function hv_normalize_phone(string $phone): string {
    $normalized = preg_replace('/[^\d+]/', '', trim($phone));
    if ($normalized === null) {
        return '';
    }

    $normalized = preg_replace('/(?!^)\+/', '', $normalized);
    if ($normalized === null) {
        return '';
    }

    if (preg_match('/^639\d{9}$/', $normalized)) {
        return '+' . $normalized;
    }

    if (preg_match('/^9\d{9}$/', $normalized)) {
        return '0' . $normalized;
    }

    return $normalized;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    back_to_previous('register');
}

$firstName = trim($_POST['first_name'] ?? '');
$lastName = trim($_POST['last_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$province = trim($_POST['province'] ?? '');
$municipality = trim($_POST['municipality'] ?? '');
$barangay = trim($_POST['barangay'] ?? '');
$phone = hv_normalize_phone((string)($_POST['phone'] ?? ''));
$role = trim($_POST['role'] ?? '');
$password = $_POST['password'] ?? '';
$confirmPassword = $_POST['confirm_password'] ?? '';
$agreeTerms = (int)($_POST['agree_terms'] ?? 0);

$allowedRoles = ['User', 'Barangay Staff', 'Barangay', 'Responder'];

if (
    $firstName === '' || $lastName === '' || $email === '' || $province === '' ||
    $municipality === '' || $barangay === '' || $phone === '' || $role === '' ||
    $password === '' || $confirmPassword === ''
) {
    $_SESSION['auth_error'] = 'Please complete all registration fields.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $_SESSION['auth_error'] = 'Please enter a valid email address.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if (!preg_match('/^(09\d{9}|\+639\d{9})$/', $phone)) {
    $_SESSION['auth_error'] = 'Please enter a valid PH mobile number like 09123456789 or +639123456789.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if (!in_array($role, $allowedRoles, true)) {
    $_SESSION['auth_error'] = 'Invalid account type selected.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if ($role === 'Barangay') {
    $role = 'Barangay Staff';
}

if ($password !== $confirmPassword) {
    $_SESSION['auth_error'] = 'Passwords do not match.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if (strlen($password) < 8) {
    $_SESSION['auth_error'] = 'Password must be at least 8 characters long.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if (strlen($password) > 255 || strlen($confirmPassword) > 255) {
    $_SESSION['auth_error'] = 'Invalid password input.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

if ($agreeTerms !== 1) {
    $_SESSION['auth_error'] = 'You must agree to the Terms and Privacy Policy.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn->begin_transaction();

    $checkStmt = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $checkStmt->bind_param('s', $email);
    $checkStmt->execute();
    $existingUser = $checkStmt->get_result()->fetch_assoc();
    $checkStmt->close();

    if ($existingUser) {
        $conn->rollback();
        $_SESSION['auth_error'] = 'That email is already registered.';
        $_SESSION['auth_tab'] = 'register';
        back_to_previous('register');
    }

    $roleStmt = $conn->prepare('SELECT id FROM roles WHERE role_name = ? LIMIT 1');
    $roleStmt->bind_param('s', $role);
    $roleStmt->execute();
    $roleRow = $roleStmt->get_result()->fetch_assoc();
    $roleStmt->close();

    if (!$roleRow) {
        $_SESSION['auth_error'] = 'The selected account type is not available right now.';
        $_SESSION['auth_tab'] = 'register';
        $conn->rollback();
        back_to_previous('register');
    }

    $barangayStmt = $conn->prepare(
        'SELECT b.id
         FROM barangays b
         INNER JOIN municipalities m ON m.id = b.municipality_id
         INNER JOIN provinces p ON p.id = m.province_id
         WHERE p.province_name = ? AND m.municipality_name = ? AND b.barangay_name = ?
         LIMIT 1'
    );
    $barangayStmt->bind_param('sss', $province, $municipality, $barangay);
    $barangayStmt->execute();
    $barangayRow = $barangayStmt->get_result()->fetch_assoc();
    $barangayStmt->close();

    if (!$barangayRow) {
        $_SESSION['auth_error'] = 'The selected province, municipality, or barangay could not be matched.';
        $_SESSION['auth_tab'] = 'register';
        $conn->rollback();
        back_to_previous('register');
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $roleId = (int)$roleRow['id'];
    $barangayId = (int)$barangayRow['id'];

    $userStmt = $conn->prepare(
        'INSERT INTO users
        (role_id, barangay_id, first_name, last_name, email, phone, password_hash, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    );
    $userStmt->bind_param(
        'iisssss',
        $roleId,
        $barangayId,
        $firstName,
        $lastName,
        $email,
        $phone,
        $hashedPassword
    );
    $userStmt->execute();
    $userId = $conn->insert_id;
    $userStmt->close();

    $profileStmt = $conn->prepare('INSERT INTO user_profiles (user_id, bio, avatar_path) VALUES (?, NULL, NULL)');
    $profileStmt->bind_param('i', $userId);
    $profileStmt->execute();
    $profileStmt->close();

    $conn->commit();

    session_regenerate_id(true);

    $_SESSION['user_id'] = (int)$userId;
    $_SESSION['user'] = [
        'id' => (int)$userId,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'role' => $role,
    ];

    header('Location: ../user_home.php');
    exit;
} catch (Throwable $e) {
    try {
        $conn->rollback();
    } catch (Throwable $rollbackError) {
    }

    $_SESSION['auth_error'] = 'Registration failed. Please try again.';
    $_SESSION['auth_tab'] = 'register';
    back_to_previous('register');
}
