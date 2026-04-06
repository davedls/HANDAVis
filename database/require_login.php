<?php
declare(strict_types=1);

if (!function_exists('hv_require_login')) {
    function hv_require_login(string $redirectTo = 'index.php?auth=login&notice=login_required'): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (!isset($_SESSION['user_id']) || (int) $_SESSION['user_id'] <= 0) {
            header('Location: ' . $redirectTo);
            exit;
        }
    }
}
