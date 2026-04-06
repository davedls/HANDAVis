<?php
header('Content-Type: application/json; charset=utf-8');

$apiKey = 'zpka_c3a44bef885e482980b1a04b3e937179_3a236aa1';
$type = isset($_GET['type']) ? strtolower(trim($_GET['type'])) : 'current';
$locationKey = isset($_GET['locationKey']) ? trim($_GET['locationKey']) : '';

if ($locationKey === '') {
    http_response_code(400);
    echo json_encode(['error' => 'locationKey is required']);
    exit;
}

$base = 'https://dataservice.accuweather.com';

switch ($type) {
    case 'forecast':
        $url = $base . '/forecasts/v1/daily/5day/' . rawurlencode($locationKey)
            . '?apikey=' . rawurlencode($apiKey)
            . '&metric=true';
        break;
    case 'location':
        $url = $base . '/locations/v1/' . rawurlencode($locationKey)
            . '?apikey=' . rawurlencode($apiKey);
        break;
    case 'current':
    default:
        $url = $base . '/currentconditions/v1/' . rawurlencode($locationKey)
            . '?apikey=' . rawurlencode($apiKey)
            . '&details=true&metric=true';
        break;
}

$cacheTtlByType = [
    'current' => 900,
    'forecast' => 3600,
    'location' => 86400,
];
$cacheTtl = isset($cacheTtlByType[$type]) ? $cacheTtlByType[$type] : 900;

$cacheDir = __DIR__ . DIRECTORY_SEPARATOR . 'cache_weather';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0775, true);
}
$cacheKey = sha1($type . '|' . $locationKey);
$cacheFile = $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.json';

function request_with_curl($url)
{
    if (!function_exists('curl_init')) {
        return [false, 0, 'cURL extension is not enabled'];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Accept-Encoding: identity',
        ],
    ]);

    $responseBody = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($responseBody === false) {
        return [false, $statusCode, $curlError ?: 'Unknown cURL error'];
    }

    return [$responseBody, $statusCode, null];
}

function request_with_stream($url)
{
    if (!ini_get('allow_url_fopen')) {
        return [false, 0, 'allow_url_fopen is disabled'];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\nAccept-Encoding: identity\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $responseBody = @file_get_contents($url, false, $context);
    $statusCode = 0;
    if (isset($http_response_header) && is_array($http_response_header) && isset($http_response_header[0])) {
        if (preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
            $statusCode = (int) $matches[1];
        }
    }

    if ($responseBody === false) {
        return [false, $statusCode, 'stream transport failed'];
    }

    return [$responseBody, $statusCode, null];
}

function decode_gzip_if_needed($body)
{
    if (!is_string($body)) {
        return $body;
    }
    if (strncmp($body, "\x1f\x8b", 2) === 0 && function_exists('gzdecode')) {
        $decoded = @gzdecode($body);
        if ($decoded !== false) {
            return $decoded;
        }
    }
    return $body;
}

function read_cache($cacheFile)
{
    if (!is_file($cacheFile)) {
        return null;
    }
    $raw = @file_get_contents($cacheFile);
    if ($raw === false) {
        return null;
    }
    $json = json_decode($raw, true);
    if (!is_array($json) || !isset($json['timestamp']) || !isset($json['body'])) {
        return null;
    }
    return $json;
}

function write_cache($cacheFile, $body)
{
    $payload = json_encode([
        'timestamp' => time(),
        'body' => $body,
    ]);
    if ($payload !== false) {
        @file_put_contents($cacheFile, $payload, LOCK_EX);
    }
}

$cached = read_cache($cacheFile);
if ($cached && isset($cached['timestamp']) && (time() - (int) $cached['timestamp']) < $cacheTtl) {
    header('X-Weather-Cache: hit-fresh');
    http_response_code(200);
    echo $cached['body'];
    exit;
}

[$responseBody, $statusCode, $transportError] = request_with_curl($url);
if ($responseBody === false) {
    [$responseBody, $statusCode, $fallbackError] = request_with_stream($url);
    if ($responseBody === false) {
        http_response_code(502);
        echo json_encode([
            'error' => 'Failed to call weather provider',
            'detail' => $transportError . '; ' . $fallbackError,
            'type' => $type,
            'locationKey' => $locationKey,
        ]);
        exit;
    }
}

$responseBody = decode_gzip_if_needed($responseBody);

if ((int) $statusCode === 429) {
    if ($cached && isset($cached['body'])) {
        header('X-Weather-Cache: hit-stale-429');
        http_response_code(200);
        echo $cached['body'];
        exit;
    }
}

if ($statusCode >= 200 && $statusCode < 300) {
    write_cache($cacheFile, $responseBody);
    header('X-Weather-Cache: miss-store');
} else {
    header('X-Weather-Cache: miss-error');
}

http_response_code($statusCode > 0 ? $statusCode : 200);
echo $responseBody;
