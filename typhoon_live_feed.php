<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function hv_json_exit(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function hv_fetch_remote(string $url): ?string {
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        return null;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_USERAGENT => 'HANDAVis/1.0 Typhoon Feed Proxy',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($status >= 200 && $status < 300 && is_string($body) && $body !== '') {
            return $body;
        }
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 12,
            'header' => "User-Agent: HANDAVis/1.0 Typhoon Feed Proxy\r\n",
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    return is_string($body) && $body !== '' ? $body : null;
}

$samplePath = __DIR__ . '/../data/typhoon_live.json';
if (is_file($samplePath)) {
    $decoded = json_decode((string) file_get_contents($samplePath), true);
    if (is_array($decoded)) {
        hv_json_exit($decoded);
    }
}

$pagasaUrl = 'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin';
$html = hv_fetch_remote($pagasaUrl);

if ($html === null) {
    hv_json_exit([
        'active' => false,
        'message' => 'Live typhoon feed unavailable right now.',
        'source' => 'PAGASA bulletin page',
        'source_url' => $pagasaUrl,
        'updated_at' => date(DATE_ATOM),
        'note' => 'Add data/typhoon_live.json with parsed track points for full cone rendering when a storm is active.'
    ]);
}

if (stripos($html, 'No Active Tropical Cyclone within the Philippine Area of Responsibility') !== false) {
    hv_json_exit([
        'active' => false,
        'message' => 'No active tropical cyclone within the Philippine Area of Responsibility.',
        'source' => 'PAGASA bulletin page',
        'source_url' => $pagasaUrl,
        'updated_at' => date(DATE_ATOM),
        'note' => 'The map stays live and will draw a cone automatically once an active feed with track points is available.'
    ]);
}

preg_match('/Tropical Cyclone Bulletin[^A-Za-z0-9]+([A-Z][A-Za-z\-]+)/', $html, $nameMatch);
$stormName = isset($nameMatch[1]) ? trim($nameMatch[1]) : 'Active tropical cyclone';

hv_json_exit([
    'active' => false,
    'message' => 'An active bulletin appears to exist, but this basic proxy does not yet have parsed track points.',
    'source' => 'PAGASA bulletin page',
    'source_url' => $pagasaUrl,
    'storm_name' => $stormName,
    'updated_at' => date(DATE_ATOM),
    'note' => 'For a real cone path, save parsed advisory data to data/typhoon_live.json using the format in README/changes.txt.'
]);
