<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../config.php';

$userId = (int)($_SESSION['user_id'] ?? 0);
$sessionUser = $_SESSION['user'] ?? [];

$profile = [
    'user_id' => $userId,
    'barangay_id' => 0,
    'first_name' => (string)($sessionUser['first_name'] ?? ''),
    'last_name' => (string)($sessionUser['last_name'] ?? ''),
    'email' => (string)($sessionUser['email'] ?? ''),
    'phone' => '',
    'province_name' => '',
    'municipality_name' => '',
    'barangay_name' => '',
    'bio' => '',
    'avatar_path' => '',
    'barangay_hall_address' => '',
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
} catch (Throwable $e) {
}

$selectHallAddress = isset($profileColumns['barangay_hall_address']) ? ', up.barangay_hall_address' : '';

try {
    $stmt = $conn->prepare(
        'SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone,
                up.bio, up.avatar_path' . $selectHallAddress . '
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        $profile = array_merge($profile, $row);
    }
} catch (Throwable $e) {
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
} catch (Throwable $e) {
}

try {
    $idStmt = $conn->prepare('SELECT barangay_id FROM users WHERE id = ? LIMIT 1');
    $idStmt->bind_param('i', $userId);
    $idStmt->execute();
    $idRow = $idStmt->get_result()->fetch_assoc();
    $idStmt->close();
    if ($idRow) {
        $profile['barangay_id'] = (int)($idRow['barangay_id'] ?? 0);
    }
} catch (Throwable $e) {
}

$firstName = trim((string)($profile['first_name'] ?? ''));
$lastName = trim((string)($profile['last_name'] ?? ''));
$fullName = trim($firstName . ' ' . $lastName);
if ($fullName === '') {
    $fullName = 'Barangay Staff';
}

$safeUserId = str_pad((string)$userId, 5, '0', STR_PAD_LEFT);
$email = (string)($profile['email'] ?? '');
$phone = (string)($profile['phone'] ?? '');
$municipality = (string)($profile['municipality_name'] ?? '');
$barangay = (string)($profile['barangay_name'] ?? '');
$bio = (string)($profile['bio'] ?? '');
$barangayHallAddress = (string)($profile['barangay_hall_address'] ?? '');

$handleSeed = strtolower(preg_replace('/[^a-z0-9]/i', '', $firstName . $lastName));
if ($handleSeed === '') {
    $handleSeed = 'brgy' . $safeUserId;
}
$handle = '@' . $handleSeed;

$locationText = trim($barangay . ($barangay !== '' && $municipality !== '' ? ', ' : '') . $municipality);
if ($locationText === '') {
    $locationText = 'Location not set';
}

$avatarInitials = strtoupper(substr($firstName, 0, 1) . substr($lastName, 0, 1));
if ($avatarInitials === '') {
    $avatarInitials = 'B';
}

$avatarPath = trim((string)($profile['avatar_path'] ?? ''));
$avatarUrl = '';
if ($avatarPath !== '') {
    $avatarUrl = '/HANDAVis/' . ltrim(str_replace('\\', '/', $avatarPath), '/');
}

$municipalityOptions = [];
$barangayOptions = [];
$provinceOptions = [];

try {
    $provinceRes = $conn->query('SELECT province_name FROM provinces ORDER BY province_name');
    while ($provinceRow = $provinceRes->fetch_assoc()) {
        $name = trim((string)($provinceRow['province_name'] ?? ''));
        if ($name !== '') {
            $provinceOptions[] = $name;
        }
    }
} catch (Throwable $e) {
}

$provinceNameCurrent = (string)($profile['province_name'] ?? '');
if ($provinceNameCurrent !== '' && !in_array($provinceNameCurrent, $provinceOptions, true)) {
    $provinceOptions[] = $provinceNameCurrent;
}
if (!empty($provinceOptions)) {
    sort($provinceOptions, SORT_NATURAL | SORT_FLAG_CASE);
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
            if ($name !== '') {
                $municipalityOptions[] = $name;
            }
        }
        $munStmt->close();
    }
} catch (Throwable $e) {
}

if ($municipality !== '' && !in_array($municipality, $municipalityOptions, true)) {
    $municipalityOptions[] = $municipality;
}
if (!empty($municipalityOptions)) {
    sort($municipalityOptions, SORT_NATURAL | SORT_FLAG_CASE);
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
            if ($name !== '') {
                $barangayOptions[] = $name;
            }
        }
        $bgyStmt->close();
    }
} catch (Throwable $e) {
}

if ($barangay !== '' && !in_array($barangay, $barangayOptions, true)) {
    $barangayOptions[] = $barangay;
}
if (!empty($barangayOptions)) {
    sort($barangayOptions, SORT_NATURAL | SORT_FLAG_CASE);
}
if (empty($barangayOptions)) {
    $barangayOptions[] = $barangay !== '' ? $barangay : 'Not set';
}
