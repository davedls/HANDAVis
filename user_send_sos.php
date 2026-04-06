<?php
session_start();
header('Content-Type: application/json');
ini_set('display_errors', '0');
ini_set('html_errors', '0');
mysqli_report(MYSQLI_REPORT_OFF);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    echo json_encode([
        'status' => 'error',
        'message' => 'Use POST for SOS sending.',
    ]);
    exit;
}

function json_error($message, $httpCode = 400)
{
    http_response_code($httpCode);
    echo json_encode(['status' => 'error', 'message' => $message]);
    exit;
}

function normalize_phone($raw)
{
    $digits = preg_replace('/\D+/', '', (string) $raw);
    if ($digits === null || $digits === '') {
        return null;
    }

    if (strpos($digits, '09') === 0) {
        $digits = '63' . substr($digits, 1);
    }

    if (strpos($digits, '639') !== 0 || strlen($digits) !== 12) {
        return null;
    }

    return $digits;
}

function resolve_barangay_id(mysqli $conn, array $data)
{
    $candidates = [
        $_SESSION['barangay_id'] ?? null,
        $_SESSION['user_barangay_id'] ?? null,
        $_SESSION['user_barangay'] ?? null,
        $data['barangay_id'] ?? null,
        $data['barangay'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if ($candidate !== null && is_numeric((string) $candidate)) {
            return (int) $candidate;
        }
    }

    $sessionUserId = $_SESSION['user_id'] ?? $_SESSION['id'] ?? null;
    if ($sessionUserId !== null && is_numeric((string) $sessionUserId)) {
        $uid = (int) $sessionUserId;
        $stmt = $conn->prepare('SELECT barangay_id FROM users WHERE id = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('i', $uid);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            $stmt->close();
            if ($row && isset($row['barangay_id'])) {
                return (int) $row['barangay_id'];
            }
        }
    }

    return null;
}

function fetch_recipient_numbers(mysqli $conn, $barangayId)
{
    $responderRoleId = 3;
    $adminRoleId = 4;

    $sql = 'SELECT DISTINCT phone FROM users
            WHERE barangay_id = ?
              AND role_id IN (?, ?)
              AND is_active = 1
              AND phone IS NOT NULL
              AND phone <> ""';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return [];
    }

    $stmt->bind_param('iii', $barangayId, $responderRoleId, $adminRoleId);
    $stmt->execute();
    $result = $stmt->get_result();

    $numbers = [];
    while ($row = $result->fetch_assoc()) {
        $normalized = normalize_phone($row['phone']);
        if ($normalized !== null) {
            $numbers[$normalized] = true;
        }
    }
    $stmt->close();

    return array_keys($numbers);
}

function send_sms($number, $message, $apiKey, $sender)
{
    $url = 'https://dashboard.philsms.com/api/v3/sms/send';
    $postData = [
        'recipient' => $number,
        'sender_id' => $sender,
        'type' => 'plain',
        'message' => $message,
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $apiKey",
        'Content-Type: application/json',
        'Accept: application/json',
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'error' => $curlError, 'provider_response' => null];
    }

    $decoded = json_decode((string) $response, true);
    if (is_array($decoded) && isset($decoded['status']) && strtolower((string) $decoded['status']) === 'success') {
        return ['ok' => true];
    }

    $providerError = 'SMS provider rejected the request.';
    if (is_array($decoded)) {
        if (!empty($decoded['message'])) {
            $providerError = (string) $decoded['message'];
        } elseif (!empty($decoded['error'])) {
            $providerError = (string) $decoded['error'];
        } elseif (!empty($decoded['errors']) && is_array($decoded['errors'])) {
            $providerError = json_encode($decoded['errors']);
        }
    }

    return [
        'ok' => false,
        'error' => $providerError,
        'provider_response' => is_array($decoded) ? $decoded : $response,
    ];
}

$raw = file_get_contents('php://input');
$data = json_decode((string) $raw, true, 512, JSON_INVALID_UTF8_IGNORE);
if (!is_array($data) || count($data) === 0) {
    $data = $_POST;
}
if (!is_array($data) || count($data) === 0) {
    json_error('Invalid request body. Send JSON: {"reason":"...","lat":...,"lng":...,"barangay_id":...}.');
}

$reason = trim((string) ($data['reason'] ?? 'Unknown emergency'));
$lat = isset($data['lat']) ? trim((string) $data['lat']) : '';
$lng = isset($data['lng']) ? trim((string) $data['lng']) : '';

$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbUser = getenv('DB_USER') ?: 'rechelmavilrio_handaviss';
$dbPass = getenv('DB_PASS') ?: 'HandaVi$!';
$dbName = getenv('DB_NAME') ?: 'rechelmavilrio_handaviss';
$dbPort = (int) (getenv('DB_PORT') ?: 3306);

$conn = null;
try {
    $conn = @new mysqli($dbHost, $dbUser, $dbPass, $dbName, $dbPort);
} catch (Throwable $e) {
    json_error('Database connection failed. Configure DB_HOST, DB_USER, DB_PASS, and DB_NAME.', 500);
}

if (!$conn || $conn->connect_errno) {
    json_error('Database connection failed. Configure DB_HOST, DB_USER, DB_PASS, and DB_NAME.', 500);
}
$conn->set_charset('utf8mb4');

$barangayId = resolve_barangay_id($conn, $data);
if ($barangayId === null || $barangayId <= 0) {
    json_error('Unable to determine user barangay_id.');
}

$message = "SOS ALERT\nEmergency: {$reason}";
if ($lat !== '' && $lng !== '') {
    $message .= "\nLocation: https://maps.google.com/?q={$lat},{$lng}";
} else {
    $message .= "\nLocation unavailable";
}

$recipientNumbers = fetch_recipient_numbers($conn, $barangayId);
if (count($recipientNumbers) === 0) {
    json_error('No responder/admin contact numbers found for this barangay_id.', 404);
}

$apiKey = getenv('PHILSMS_API_KEY') ?: '1907|Qtb3mKULr4hzjJsZMmp5Ga1ELuod7Kl24YZOhus60f42cc14';
$sender = getenv('PHILSMS_SENDER_ID') ?: 'PhilSMS';

$sent = 0;
$errors = [];
foreach ($recipientNumbers as $number) {
    $result = send_sms($number, $message, $apiKey, $sender);
    if ($result['ok']) {
        $sent++;
    } else {
        $errors[] = [
            'number' => $number,
            'error' => $result['error'],
            'provider_response' => $result['provider_response'] ?? null,
        ];
    }
}

if ($sent === 0) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Failed to send SOS to all recipients.',
        'attempted' => count($recipientNumbers),
        'errors' => $errors,
    ]);
    exit;
}

echo json_encode([
    'status' => 'success',
    'message' => 'SOS sent.',
    'sent_count' => $sent,
    'attempted' => count($recipientNumbers),
    'failed_count' => count($recipientNumbers) - $sent,
    'errors' => $errors,
]);
