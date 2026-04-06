<?php
//require_once 'redirect_logic.php';
// /mobile_index.php

define('BASE_PATH', __DIR__);

require_once BASE_PATH . '/app/controllers/HomeController.php';

$app = new HomeController();
$app->render();
?>

<script>
(() => {
    const BASE = location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);
    const DESKTOP_URL = BASE + "index.php";

    // 1. Check if the screen is currently Desktop-sized
    const isDesktopViewport = window.innerWidth >= 1024;

    // 2. The Logic:
    // If they are on a large screen AND there is no active session flag, 
    // it means they freshly opened the browser or a new tab. REDIRECT.
    if (isDesktopViewport && !sessionStorage.getItem('handavis_mobile_session')) {
        location.replace(DESKTOP_URL + location.hash);
        return;
    }

    // 3. If they are here (either small screen or flag is already set),
    // ensure the flag is set so they stay here during resizes/rotations.
    sessionStorage.setItem('handavis_mobile_session', 'true');

    // 4. IMPORTANT: We do NOT put a redirect-to-desktop listener here.
    // This allows the user to resize to 2000px using Inspect Tool and STAY on mobile.
    console.log("HANDAVis Mobile Session: Active. Resizing/Rotation locked to mobile view.");
})();
</script>