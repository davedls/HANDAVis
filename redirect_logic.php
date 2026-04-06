<?php
// HANDAVis/redirect_logic.php

function performRedirect($targetPage) {
    // Get current page name
    $currentPath = $_SERVER['PHP_SELF'];
    $currentPage = basename($currentPath);

    // Only redirect if we aren't already on the target page
    if ($currentPage !== $targetPage) {
        header("Location: $targetPage");
        exit();
    }
}

// Check the User Agent string for mobile devices
$userAgent = $_SERVER['HTTP_USER_AGENT'];
$isMobile = preg_match('/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i', $userAgent);

if ($isMobile) {
    performRedirect("mobile_index.php");
} else {
    performRedirect("index.php");
}
?>