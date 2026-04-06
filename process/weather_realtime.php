<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$lat = isset($_GET['lat']) ? (float) $_GET['lat'] : null;
$lon = isset($_GET['lon']) ? (float) $_GET['lon'] : null;
$label = isset($_GET['label']) ? trim((string) $_GET['label']) : 'Selected place';

if ($lat === null || $lon === null || !is_numeric($lat) || !is_numeric($lon)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Missing coordinates',
        'detail' => 'Provide lat and lon query parameters.'
    ]);
    exit;
}

$query = http_build_query([
    'latitude' => $lat,
    'longitude' => $lon,
    'timezone' => 'Asia/Manila',
    'forecast_days' => 5,
    'current' => implode(',', [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'weather_code',
        'wind_speed_10m',
        'uv_index'
    ]),
    'daily' => implode(',', [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'uv_index_max'
    ])
]);

$url = 'https://api.open-meteo.com/v1/forecast?' . $query;

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'User-Agent: HANDAVis/1.0'
    ]
]);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode >= 400) {
    http_response_code($httpCode >= 400 ? $httpCode : 502);
    echo json_encode([
        'error' => 'Upstream weather request failed',
        'detail' => $error ?: 'Could not fetch weather data right now.',
        'source' => 'open-meteo',
        'label' => $label,
    ]);
    exit;
}

$payload = json_decode($response, true);
if (!is_array($payload)) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Invalid weather payload',
        'detail' => 'Weather provider returned unreadable JSON.',
        'source' => 'open-meteo',
        'label' => $label,
    ]);
    exit;
}

$payload['label'] = $label;
$payload['source'] = 'open-meteo';
$payload['requested'] = [
    'lat' => $lat,
    'lon' => $lon,
    'timezone' => 'Asia/Manila',
];

echo json_encode($payload);
