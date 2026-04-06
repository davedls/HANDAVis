<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
 
if (!isset($_SESSION['user_id']) || (int)$_SESSION['user_id'] <= 0) {
    header('Location: index.php');
    exit;
}
 
if (isset($_GET['id']) && (int)$_GET['id'] > 0) {
    $userId = (int)$_GET['id'];
    $isOwnProfile = ($userId === (int)$_SESSION['user_id']);
} else {
    $userId = (int)$_SESSION['user_id'];
    $isOwnProfile = true;
}
 
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
 
require_once __DIR__ . '/config.php';
 
 
$sessionUser = $_SESSION['user'] ?? [];
$profile = [
    'user_id' => $userId,
    'first_name' => '', // Leave these empty so they don't default to YOUR name
    'last_name' => '',
    'email' => '',
    'phone' => '',
    'province_name' => '',
    'municipality_name' => '',
    'barangay_name' => '',
    'bio' => '',
    'avatar_path' => '',
    'emergency_contact_name' => '',
    'emergency_contact_phone' => '',
];
 
$profileColumns = [];
try {
    $colRes = $conn->query('SHOW COLUMNS FROM user_profiles');
    while ($col = $colRes->fetch_assoc()) {
        $name = (string)($col['Field'] ?? '');
        if ($name !== '') {
            $profileColumns[$name] = true;
        }
    }
} catch (Throwable $e) {}
 
$selectEmergencyName  = isset($profileColumns['emergency_contact_name'])  ? ', up.emergency_contact_name'  : '';
$selectEmergencyPhone = isset($profileColumns['emergency_contact_phone']) ? ', up.emergency_contact_phone' : '';
 
try {
  $stmt = $conn->prepare(
    'SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone,
            up.bio, up.avatar_path 
     FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = ?
     LIMIT 1'
);
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    if ($row) {
        // This is key: it merges the data from 'users' and 'user_profiles' into one array
        $profile = array_merge($profile, $row);
    } else {
        // If the ID doesn't exist at all
        $fullName = "User Not Found";
    }
} catch (Throwable $e) {
    // Log the error so you can see it in your server logs
    error_log("Profile Fetch Error: " . $e->getMessage());
}
try {
    $locStmt = $conn->prepare(
        'SELECT p.province_name, m.municipality_name, b.barangay_name
         FROM users u
         LEFT JOIN barangays b ON b.id = u.barangay_id
         LEFT JOIN municipalities m ON m.id = b.municipality_id
         LEFT JOIN provinces p ON p.id = m.province_id
         WHERE u.id = ?
         LIMIT 1'
    );
    $locStmt->bind_param('i', $userId);
    $locStmt->execute();
    $locRow = $locStmt->get_result()->fetch_assoc();
    $locStmt->close();
    if ($locRow) {
        $profile = array_merge($profile, $locRow);
    }
} catch (Throwable $e) {}
 
$firstName = trim((string)($profile['first_name'] ?? ''));
$lastName  = trim((string)($profile['last_name']  ?? ''));
$fullName  = trim($firstName . ' ' . $lastName);
 
if ($fullName === '') {
    // Since you don't have a 'username' column, use the email as a fallback
    $emailParts = explode('@', (string)($profile['email'] ?? 'User'));
    $fullName = $emailParts[0]; 
}
 
$safeUserId = str_pad((string)$userId, 5, '0', STR_PAD_LEFT);
$email               = (string)($profile['email']                  ?? '');
$phone               = (string)($profile['phone']                  ?? '');
$municipality        = (string)($profile['municipality_name']      ?? '');
$barangay            = (string)($profile['barangay_name']          ?? '');
$bio                 = (string)($profile['bio']                    ?? '');
$emergencyContactName  = (string)($profile['emergency_contact_name']  ?? '');
$emergencyContactPhone = (string)($profile['emergency_contact_phone'] ?? '');
$handleSeed = strtolower(preg_replace('/[^a-z0-9]/i', '', $firstName . $lastName));
if ($handleSeed === '') {
    // Use the email prefix if the name is empty
    $emailParts = explode('@', (string)($profile['email'] ?? ''));
    $handleSeed = !empty($emailParts[0]) ? $emailParts[0] : 'user' . $safeUserId;
}
$handle = '@' . $handleSeed;
 
$locationText = trim($barangay . ($barangay !== '' && $municipality !== '' ? ', ' : '') . $municipality);
if ($locationText === '') $locationText = 'Location not set';
 
$avatarInitials = strtoupper(substr($firstName, 0, 1) . substr($lastName, 0, 1));
if ($avatarInitials === '') $avatarInitials = 'U';
 
// --- UPDATED FOLDER PATH: images/avatars ---
// --- FINAL AVATAR LOGIC (Using images/profile_avatars) ---
$avatarPath = trim((string)($profile['avatar_path'] ?? ''));
$avatarUrl = '';
 
if ($avatarPath !== '') {
    $cleanPath = ltrim(str_replace('\\', '/', $avatarPath), '/');
 
    if (strpos($cleanPath, 'images/profile_avatars/') === 0) {
        $avatarUrl = '/HANDAVis/' . $cleanPath;
    } else {
        $avatarUrl = '/HANDAVis/images/profile_avatars/' . basename($cleanPath);
    }
 
    $avatarUrl .= '?v=' . time();
} else {
    $avatarUrl = 'https://ui-avatars.com/api/?name=' . urlencode($firstName) . '&background=0D8ABC&color=fff&size=128';
}
// ── Days Active + Member Since ─────────────────────────────────────────────
$daysActive  = 0;
$memberSince = 'Jan 2025';
try {
    $dateStmt = $conn->prepare('SELECT created_at FROM users WHERE id = ? LIMIT 1');
    $dateStmt->bind_param('i', $userId);
    $dateStmt->execute();
    $dateRow = $dateStmt->get_result()->fetch_assoc();
    $dateStmt->close();
    if ($dateRow && !empty($dateRow['created_at'])) {
        $created     = new DateTime($dateRow['created_at']);
        $now         = new DateTime();
        $daysActive  = (int)$created->diff($now)->days;
        $memberSince = $created->format('M Y');
    }
} catch (Throwable $e) {}
 
// ── Reports Filed ──────────────────────────────────────────────────────────
$reportsFiled = 0;
try {
    $repStmt = $conn->prepare('SELECT COUNT(*) FROM hazard_reports WHERE reporter_user_id = ?');
    $repStmt->bind_param('i', $userId);
    $repStmt->execute();
    $repStmt->bind_result($reportsFiled);
    $repStmt->fetch();
    $repStmt->close();
} catch (Throwable $e) {}
 
// ── User Role ──────────────────────────────────────────────────────────────
$userRole = 'User';
try {
    $roleStmt = $conn->prepare(
        'SELECT r.role_name FROM roles r
         INNER JOIN users u ON u.role_id = r.id
         WHERE u.id = ? LIMIT 1'
    );
    $roleStmt->bind_param('i', $userId);
    $roleStmt->execute();
    $roleStmt->bind_result($userRole);
    $roleStmt->fetch();
    $roleStmt->close();
    if (empty($userRole)) $userRole = 'User';
} catch (Throwable $e) {}
 
// ── Alerts Viewed ──────────────────────────────────────────────────────────
$alertsViewed = 0;
try {
    $viewStmt = $conn->prepare('SELECT COUNT(*) FROM user_alert_views WHERE user_id = ?');
    $viewStmt->bind_param('i', $userId);
    $viewStmt->execute();
    $viewStmt->bind_result($alertsViewed);
    $viewStmt->fetch();
    $viewStmt->close();
} catch (Throwable $e) {}
 
// ── Location options ───────────────────────────────────────────────────────
$municipalityOptions = [];
$barangayOptions     = [];
$provinceOptions     = [];
 
try {
    $provinceRes = $conn->query('SELECT province_name FROM provinces ORDER BY province_name');
    while ($provinceRow = $provinceRes->fetch_assoc()) {
        $name = trim((string)($provinceRow['province_name'] ?? ''));
        if ($name !== '') $provinceOptions[] = $name;
    }
} catch (Throwable $e) {}
 
$provinceNameCurrent = (string)($profile['province_name'] ?? '');
if ($provinceNameCurrent !== '' && !in_array($provinceNameCurrent, $provinceOptions, true)) {
    array_unshift($provinceOptions, $provinceNameCurrent);
}
if (empty($provinceOptions)) {
    $provinceOptions[] = $provinceNameCurrent !== '' ? $provinceNameCurrent : 'Not set';
}
 
try {
    if (($profile['province_name'] ?? '') !== '') {
        $munStmt = $conn->prepare(
            'SELECT m.municipality_name
             FROM municipalities m
             INNER JOIN provinces p ON p.id = m.province_id
             WHERE p.province_name = ?
             ORDER BY m.municipality_name'
        );
        $provinceName = (string)$profile['province_name'];
        $munStmt->bind_param('s', $provinceName);
        $munStmt->execute();
        $munResult = $munStmt->get_result();
        while ($munRow = $munResult->fetch_assoc()) {
            $name = trim((string)($munRow['municipality_name'] ?? ''));
            if ($name !== '') $municipalityOptions[] = $name;
        }
        $munStmt->close();
    }
} catch (Throwable $e) {}
 
if ($municipality !== '' && !in_array($municipality, $municipalityOptions, true)) {
    array_unshift($municipalityOptions, $municipality);
}
if (empty($municipalityOptions)) {
    $municipalityOptions[] = $municipality !== '' ? $municipality : 'Not set';
}
 
try {
    if (($profile['province_name'] ?? '') !== '' && $municipality !== '') {
        $bgyStmt = $conn->prepare(
            'SELECT b.barangay_name
             FROM barangays b
             INNER JOIN municipalities m ON m.id = b.municipality_id
             INNER JOIN provinces p ON p.id = m.province_id
             WHERE p.province_name = ? AND m.municipality_name = ?
             ORDER BY b.barangay_name'
        );
        $provinceName = (string)$profile['province_name'];
        $bgyStmt->bind_param('ss', $provinceName, $municipality);
        $bgyStmt->execute();
        $bgyResult = $bgyStmt->get_result();
        while ($bgyRow = $bgyResult->fetch_assoc()) {
            $name = trim((string)($bgyRow['barangay_name'] ?? ''));
            if ($name !== '') $barangayOptions[] = $name;
        }
        $bgyStmt->close();
    }
} catch (Throwable $e) {}
 
if ($barangay !== '' && !in_array($barangay, $barangayOptions, true)) {
    array_unshift($barangayOptions, $barangay);
}
if (empty($barangayOptions)) {
    $barangayOptions[] = $barangay !== '' ? $barangay : 'Not set';
	
}
// ── Friendship status between logged-in user and viewed profile ──────────────
$profile_user_id = $userId; // the profile being viewed
$current_user_id = (int)$_SESSION['user_id'];
$friendship_status = 'none'; // default: no relationship
 
if (!$isOwnProfile) {
    try {
        $fStmt = $conn->prepare("
            SELECT status, user_id
            FROM friendships
            WHERE (user_id = ? AND friend_id = ?)
               OR (user_id = ? AND friend_id = ?)
            LIMIT 1
        ");
        $fStmt->bind_param("iiii", $current_user_id, $profile_user_id, $profile_user_id, $current_user_id);
        $fStmt->execute();
        $fResult = $fStmt->get_result();
        $fRow = $fResult->fetch_assoc();
        $fStmt->close();
 
        if ($fRow) {
            if ($fRow['status'] === 'accepted') {
                $friendship_status = 'friends';
            } elseif ($fRow['status'] === 'pending') {
                // outgoing = current user sent the request
                $friendship_status = ((int)$fRow['user_id'] === $current_user_id) ? 'outgoing' : 'incoming';
            }
        }
    } catch (Throwable $e) {}
}
 