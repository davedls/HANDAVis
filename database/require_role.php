<?php
declare(strict_types=1);

if (!function_exists('hv_require_role')) {
    function hv_normalize_role_name(string $role): string
    {
        $value = strtolower(trim($role));
        if ($value === 'barangay') return 'barangay_staff';
        if ($value === 'barangay staff') return 'barangay_staff';
        return str_replace(' ', '_', $value);
    }

    function hv_role_from_session_or_db(): string
    {
        $role = trim((string)($_SESSION['user']['role'] ?? ''));
        if ($role !== '') {
            return $role;
        }

        $userId = (int)($_SESSION['user_id'] ?? 0);
        if ($userId <= 0) {
            return '';
        }

        if (!isset($GLOBALS['conn']) || !($GLOBALS['conn'] instanceof mysqli)) {
            require_once __DIR__ . '/config.php';
        }

        if (!isset($GLOBALS['conn']) || !($GLOBALS['conn'] instanceof mysqli)) {
            return '';
        }

        try {
            $stmt = $GLOBALS['conn']->prepare(
                'SELECT r.role_name
                 FROM users u
                 INNER JOIN roles r ON r.id = u.role_id
                 WHERE u.id = ?
                 LIMIT 1'
            );
            if (!$stmt) {
                return '';
            }

            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            $dbRole = trim((string)($row['role_name'] ?? ''));
            if ($dbRole === '') {
                return '';
            }

            if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
                $_SESSION['user'] = [];
            }
            $_SESSION['user']['role'] = $dbRole;
            return $dbRole;
        } catch (Throwable $e) {
            return '';
        }
    }

    function hv_require_role(
        array $allowedRoles,
        string $redirectTo = '../../user_home.php',
        string $loginRedirectTo = '../../index.php?auth=login&notice=session_expired'
    ): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $sessionUserId = (int)($_SESSION['user_id'] ?? 0);
        if ($sessionUserId <= 0) {
            $requestUri = trim((string)($_SERVER['REQUEST_URI'] ?? ''));
            if ($requestUri !== '' && stripos($requestUri, '/database/login.php') === false) {
                $_SESSION['post_login_redirect'] = $requestUri;
            }
            header('Location: ' . $loginRedirectTo);
            exit;
        }

        $role = hv_role_from_session_or_db();
        $current = hv_normalize_role_name($role);
        $allowed = array_map(static fn(string $r): string => hv_normalize_role_name($r), $allowedRoles);

        if ($role === '') {
            $requestUri = trim((string)($_SERVER['REQUEST_URI'] ?? ''));
            if ($requestUri !== '' && stripos($requestUri, '/database/login.php') === false) {
                $_SESSION['post_login_redirect'] = $requestUri;
            }
            header('Location: ' . $loginRedirectTo);
            exit;
        }

        if (!in_array($current, $allowed, true)) {
            header('Location: ' . $redirectTo);
            exit;
        }
    }
}
