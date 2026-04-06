<?php
declare(strict_types=1);
require_once __DIR__ . '/database/require_login.php';
hv_require_login();

require_once __DIR__ . '/database/config.php';

$alertCount = 0;
try {
    $stmt = $conn->prepare('SELECT COUNT(*) FROM regional_alerts WHERE status = ?');
    $active = 'active';
    $stmt->bind_param('s', $active);
    $stmt->execute();
    $stmt->bind_result($alertCount);
    $stmt->fetch();
    $stmt->close();
} catch (Throwable $e) {
    $alertCount = 0;
}

function hv_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function hv_fetch_url(string $url, int $timeout = 12): ?string
{
    $userAgent = 'HANDAVis/1.0 (+https://example.local)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_USERAGENT => $userAgent,
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xml,text/xml,application/rss+xml,*/*'],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_errno($ch) ? curl_error($ch) : null;
        curl_close($ch);
        if ($error || $statusCode >= 400 || !is_string($body) || $body === '') {
            return null;
        }
        return $body;
    }

    if (ini_get('allow_url_fopen')) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => $timeout,
                'header' => "User-Agent: {$userAgent}\r\nAccept: text/html,application/xml,text/xml,application/rss+xml,*/*\r\n",
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        if (is_string($body) && $body !== '') {
            return $body;
        }
    }

    return null;
}

function hv_clean_text(?string $text): string
{
    if ($text === null) {
        return '';
    }

    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = strip_tags($text);
    $text = preg_replace('/\s+/u', ' ', $text ?? '') ?? '';
    return trim($text);
}

function hv_absolute_url(string $url, string $base): string
{
    if ($url === '') {
        return $base;
    }

    if (preg_match('#^https?://#i', $url)) {
        return $url;
    }

    $parts = parse_url($base);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return $url;
    }

    $scheme = $parts['scheme'];
    $host = $parts['host'];

    if (str_starts_with($url, '//')) {
        return $scheme . ':' . $url;
    }

    if (str_starts_with($url, '/')) {
        return $scheme . '://' . $host . $url;
    }

    $path = $parts['path'] ?? '/';
    $dir = rtrim(str_replace('\\', '/', dirname($path)), '/');
    return $scheme . '://' . $host . ($dir ? $dir : '') . '/' . ltrim($url, '/');
}

function hv_contains_wv(string $text): bool
{
    $text = mb_strtolower($text, 'UTF-8');
    $keywords = [
        'western visayas',
        'region vi',
        'bacolod',
        'negros occidental',
        'neg occ',
        'kabankalan',
        'silay',
        'victorias',
        'talisay city',
        'sagay',
        'cadiz',
        'bago city',
        'sipalay',
        'san carlos',
        'himamaylan',
        'murcia',
        'iloilo',
        'iloilo city',
        'guimaras',
        'antique',
        'aklan',
        'boracay',
        'capiz',
        'roxas city',
    ];

    foreach ($keywords as $keyword) {
        if (str_contains($text, $keyword)) {
            return true;
        }
    }

    return false;
}


function hv_is_weather_disaster_related(string $text): bool
{
    $text = mb_strtolower($text, 'UTF-8');
    $keywords = [
        'weather',
        'rain',
        'rainfall',
        'heavy rain',
        'flood',
        'flooding',
        'thunderstorm',
        'storm',
        'typhoon',
        'tropical cyclone',
        'low pressure area',
        'lpa',
        'landslide',
        'earthquake',
        'volcano',
        'kanlaon',
        'eruption',
        'ashfall',
        'disaster',
        'evacuation',
        'class suspension',
        'gale warning',
        'storm surge',
        'heat index',
        'drought',
        'el niño',
        'la niña',
    ];

    foreach ($keywords as $keyword) {
        if (str_contains($text, $keyword)) {
            return true;
        }
    }

    return false;
}

function hv_alert_priority(array $item): int
{
    $text = mb_strtolower((string) (($item['title'] ?? '') . ' ' . ($item['summary'] ?? '') . ' ' . ($item['badge'] ?? '')), 'UTF-8');

    if (str_contains($text, 'eruption') || str_contains($text, 'alert level') || str_contains($text, 'severe thunderstorm') || str_contains($text, 'heavy rainfall warning')) {
        return 500;
    }
    if (str_contains($text, 'warning')) {
        return 420;
    }
    if (str_contains($text, 'watch')) {
        return 340;
    }
    if (str_contains($text, 'advisory')) {
        return 260;
    }
    if (str_contains($text, 'forecast') || str_contains($text, 'information') || str_contains($text, 'bulletin')) {
        return 180;
    }
    if (str_contains($text, 'no active') || str_contains($text, 'no weather advisory') || str_contains($text, 'no heavy rainfall warning')) {
        return 80;
    }

    return 120;
}

function hv_alert_badge(string $title, string $summary = ''): array
{
    $text = mb_strtolower($title . ' ' . $summary, 'UTF-8');

    if (str_contains($text, 'no weather advisory') || str_contains($text, 'no heavy rainfall warning')) {
        return ['CLEAR', 'pill-green'];
    }
    if (str_contains($text, 'warning') || str_contains($text, 'eruption') || str_contains($text, 'alert level')) {
        return ['WARNING', 'pill-red'];
    }
    if (str_contains($text, 'watch') || str_contains($text, 'monitor')) {
        return ['WATCH', 'pill-yellow'];
    }
    if (str_contains($text, 'advisory')) {
        return ['ADVISORY', 'pill-cyan'];
    }
    if (str_contains($text, 'forecast') || str_contains($text, 'update') || str_contains($text, 'information')) {
        return ['UPDATE', 'pill-blue'];
    }

    return ['LIVE', 'pill-blue'];
}

function hv_format_time(?int $timestamp): string
{
    if (!$timestamp) {
        return 'Live source';
    }
    return date('M j, Y g:i A', $timestamp);
}

function hv_extract_between(string $text, string $start, string $end = ''): string
{
    $pattern = '/' . preg_quote($start, '/') . '\s*(.*?)' . ($end !== '' ? preg_quote($end, '/') : '$') . '/is';
    if (preg_match($pattern, $text, $matches)) {
        return hv_clean_text($matches[1]);
    }
    return '';
}

function hv_build_official_alerts(): array
{
    $alerts = [];

    $advisoryUrl = 'https://www.pagasa.dost.gov.ph/weather/weather-advisory';
    $advisoryHtml = hv_fetch_url($advisoryUrl);
    if ($advisoryHtml) {
        $advisoryText = hv_clean_text($advisoryHtml);
        $summary = hv_extract_between($advisoryText, 'Weather Advisory', 'We always find ways');
        if ($summary === '') {
            $summary = hv_extract_between($advisoryText, 'Weather Advisory');
        }

        if ($summary !== '') {
            if (stripos($summary, 'no weather advisory issued') !== false) {
                $alerts[] = [
                    'title' => 'No active PAGASA weather advisory',
                    'summary' => 'As of the latest PAGASA weather advisory page, no weather advisory is currently posted.',
                    'source' => 'PAGASA Weather Advisory',
                    'url' => $advisoryUrl,
                    'timestamp' => time(),
                    'action' => 'goToUserAlerts',
                ];
            } else {
                $alerts[] = [
                    'title' => 'PAGASA weather advisory',
                    'summary' => $summary,
                    'source' => 'PAGASA Weather Advisory',
                    'url' => $advisoryUrl,
                    'timestamp' => time(),
                    'action' => 'goToUserAlerts',
                ];
            }
        }
    }

    $visayasUrl = 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd';
    $visayasHtml = hv_fetch_url($visayasUrl);
    if ($visayasHtml) {
        $visayasText = hv_clean_text($visayasHtml);

        if (preg_match('/Regional Forecast Issued At:\s*([^\.]+?\d{4})/i', $visayasText, $m)) {
            $issuedText = hv_clean_text($m[1]);
            $alerts[] = [
                'title' => 'Western Visayas regional forecast posted',
                'summary' => 'Latest regional forecast issued at ' . $issuedText . '. Open the Visayas forecast panel for the current official regional outlook.',
                'source' => 'PAGASA Visayas Regional Forecast',
                'url' => $visayasUrl,
                'timestamp' => strtotime($issuedText) ?: time(),
                'action' => 'goToUserAlerts',
            ];
        }

        if (preg_match('/As of today,\s*there is no Heavy Rainfall Warning Issued\./i', $visayasText)) {
            $alerts[] = [
                'title' => 'No active heavy rainfall warning for Visayas page',
                'summary' => 'The PAGASA Visayas page currently says there is no heavy rainfall warning issued.',
                'source' => 'PAGASA Visayas Regional Forecast',
                'url' => $visayasUrl,
                'timestamp' => time(),
                'action' => 'goToUserAlerts',
            ];
        }

        if (preg_match('/Thunderstorm Information #VISPRSD Issued at\s*(.*?)\s*(Thunderstorm is .*? within 12 hours\.)/i', $visayasText, $m)) {
            $issued = hv_clean_text($m[1]);
            $summary = hv_clean_text($m[2]);
            if (hv_contains_wv($summary)) {
                $alerts[] = [
                    'title' => 'PAGASA thunderstorm information for Visayas',
                    'summary' => $summary,
                    'source' => 'PAGASA VISPRSD',
                    'url' => $visayasUrl,
                    'timestamp' => strtotime($issued) ?: time(),
                    'action' => 'goToUserAlerts',
                ];
            }
        }

        if (preg_match('/Thunderstorm Watch #VISPRSD Issued at\s*(.*?)\s*(Thunderstorm is .*? within 12 hours\.)/i', $visayasText, $m)) {
            $issued = hv_clean_text($m[1]);
            $summary = hv_clean_text($m[2]);
            if (hv_contains_wv($summary)) {
                $alerts[] = [
                    'title' => 'PAGASA thunderstorm watch for Visayas',
                    'summary' => $summary,
                    'source' => 'PAGASA VISPRSD',
                    'url' => $visayasUrl,
                    'timestamp' => strtotime($issued) ?: time(),
                    'action' => 'goToUserAlerts',
                ];
            }
        }

        if (preg_match('/Mt\. Kanlaon Issued at:\s*(.*?)\s*Valid until:\s*(.*?)\s/i', $visayasText, $m)) {
            $issued = hv_clean_text($m[1]);
            $alerts[] = [
                'title' => 'Kanlaon special forecast posted on PAGASA Visayas page',
                'summary' => 'A special forecast link for Mt. Kanlaon is listed on the PAGASA Visayas regional page.',
                'source' => 'PAGASA VISPRSD',
                'url' => $visayasUrl,
                'timestamp' => strtotime($issued) ?: time(),
                'action' => 'goToUserAlerts',
            ];
        }
    }

    $kanlaonUrl = 'https://wovodat.phivolcs.dost.gov.ph/bulletin/list-of-bulletin?vdId=574';
    $kanlaonHtml = hv_fetch_url($kanlaonUrl);
    if ($kanlaonHtml) {
        $kanlaonText = hv_clean_text($kanlaonHtml);
        if (preg_match('/Kanlaon Volcano (Summary of 24Hr Observation|Eruption Bulletin)\s*(\d{1,2}\s+\w+\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)?/i', $kanlaonText, $m)) {
            $kind = hv_clean_text($m[1]);
            $timeText = hv_clean_text($m[2] ?? '');
            $alerts[] = [
                'title' => 'PHIVOLCS Kanlaon bulletin available',
                'summary' => 'Latest PHIVOLCS page shows a Kanlaon volcano ' . strtolower($kind ?: 'bulletin') . ' for monitoring.',
                'source' => 'PHIVOLCS',
                'url' => $kanlaonUrl,
                'timestamp' => strtotime($timeText) ?: time(),
                'action' => 'goToUserAlerts',
            ];
        }
    }

    $unique = [];
    $deduped = [];
    foreach ($alerts as $alert) {
        $key = md5(($alert['title'] ?? '') . '|' . ($alert['summary'] ?? ''));
        if (isset($unique[$key])) {
            continue;
        }
        [$badge, $badgeClass] = hv_alert_badge($alert['title'] ?? '', $alert['summary'] ?? '');
        $alert['badge'] = $badge;
        $alert['badgeClass'] = $badgeClass;
        $deduped[] = $alert;
        $unique[$key] = true;
    }

    usort($deduped, static function (array $a, array $b): int {
        $priorityDiff = hv_alert_priority($b) <=> hv_alert_priority($a);
        if ($priorityDiff !== 0) {
            return $priorityDiff;
        }
        return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
    });

    return array_slice($deduped, 0, 6);
}

function hv_build_news_feed(): array
{
    $newsItems = [];
    $query = urlencode('("Western Visayas" OR Bacolod OR Iloilo OR Antique OR Aklan OR Capiz OR Guimaras OR "Negros Occidental" OR Kanlaon) (flood OR flooding OR rainfall OR rain OR weather OR thunderstorm OR storm OR typhoon OR cyclone OR landslide OR earthquake OR eruption OR ashfall OR evacuation OR disaster) (site:dailyguardian.com.ph OR site:panaynews.net OR site:visayandailystar.com)');
    $rssUrl = 'https://news.google.com/rss/search?q=' . $query . '&hl=en-PH&gl=PH&ceid=PH:en';
    $rss = hv_fetch_url($rssUrl);

    if ($rss) {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($rss);
        if ($xml && isset($xml->channel->item)) {
            foreach ($xml->channel->item as $item) {
                $title = hv_clean_text((string) $item->title);
                $description = hv_clean_text((string) $item->description);
                $link = hv_clean_text((string) $item->link);
                $source = hv_clean_text((string) ($item->source ?? 'Regional news'));
                $pubDate = hv_clean_text((string) $item->pubDate);

                if ($title === '' || !hv_contains_wv($title . ' ' . $description . ' ' . $source)) {
                    continue;
                }

                if (!hv_is_weather_disaster_related($title . ' ' . $description)) {
                    continue;
                }

                $newsItems[] = [
                    'title' => preg_replace('/\s*-\s*[^-]+$/', '', $title) ?: $title,
                    'summary' => $description !== '' ? $description : 'Summarized disaster or weather update from a Western Visayas source.',
                    'source' => $source !== '' ? $source : 'Regional news',
                    'url' => $link,
                    'timestamp' => strtotime($pubDate) ?: time(),
                    'action' => 'openLink',
                ];
            }
        }
        libxml_clear_errors();
    }

    if (count($newsItems) < 4) {
        $fallbacks = [
            'https://dailyguardian.com.ph/',
            'https://www.panaynews.net/',
            'https://visayandailystar.com/',
        ];

        foreach ($fallbacks as $url) {
            $html = hv_fetch_url($url);
            if (!$html) {
                continue;
            }

            libxml_use_internal_errors(true);
            $dom = new DOMDocument();
            if (!@$dom->loadHTML($html)) {
                continue;
            }
            $xpath = new DOMXPath($dom);
            $anchors = $xpath->query('//a[@href]');
            if (!$anchors) {
                continue;
            }

            foreach ($anchors as $anchor) {
                $title = hv_clean_text($anchor->textContent);
                $href = hv_absolute_url((string) $anchor->getAttribute('href'), $url);

                if ($title === '' || mb_strlen($title) < 18 || !preg_match('#^https?://#i', $href)) {
                    continue;
                }

                if (!hv_contains_wv($title . ' ' . $href)) {
                    continue;
                }

                if (!hv_is_weather_disaster_related($title . ' ' . $href)) {
                    continue;
                }

                $sourceHost = parse_url($url, PHP_URL_HOST) ?: 'Regional news';
                $newsItems[] = [
                    'title' => $title,
                    'summary' => 'Summarized from the source homepage to keep the dashboard lightweight.',
                    'source' => preg_replace('/^www\./', '', $sourceHost),
                    'url' => $href,
                    'timestamp' => time(),
                    'action' => 'openLink',
                ];

                if (count($newsItems) >= 10) {
                    break 2;
                }
            }

            libxml_clear_errors();
        }
    }

    $unique = [];
    $deduped = [];
    foreach ($newsItems as $item) {
        $key = md5(($item['title'] ?? '') . '|' . ($item['url'] ?? ''));
        if (isset($unique[$key])) {
            continue;
        }
        $deduped[] = $item;
        $unique[$key] = true;
    }

    usort($deduped, static function (array $a, array $b): int {
        return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
    });

    return array_slice($deduped, 0, 6);
}


function hv_cache_dir(): string
{
    $dir = __DIR__ . '/cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function hv_cache_read(string $key, int $maxAgeSeconds): ?array
{
    $file = hv_cache_dir() . '/' . preg_replace('/[^a-z0-9_\-]+/i', '_', $key) . '.json';
    if (!is_file($file)) {
        return null;
    }
    $mtime = @filemtime($file);
    if (!$mtime || (time() - $mtime) > $maxAgeSeconds) {
        return null;
    }
    $raw = @file_get_contents($file);
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function hv_cache_write(string $key, array $payload): void
{
    $file = hv_cache_dir() . '/' . preg_replace('/[^a-z0-9_\-]+/i', '_', $key) . '.json';
    @file_put_contents($file, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

function hv_fetch_json(string $url, int $timeout = 12): ?array
{
    $body = hv_fetch_url($url, $timeout);
    if (!is_string($body) || $body === '') {
        return null;
    }
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : null;
}

function hv_average(array $values): float
{
    $numbers = array_values(array_filter($values, static fn($v): bool => is_numeric($v)));
    return $numbers ? array_sum($numbers) / count($numbers) : 0.0;
}

function hv_max_value(array $values): float
{
    $numbers = array_values(array_filter($values, static fn($v): bool => is_numeric($v)));
    return $numbers ? (float) max($numbers) : 0.0;
}

function hv_mode_value(array $values): ?int
{
    $values = array_values(array_filter($values, static fn($v): bool => $v !== null && $v !== ''));
    if (!$values) {
        return null;
    }
    $counts = [];
    foreach ($values as $value) {
        $counts[(string) $value] = ($counts[(string) $value] ?? 0) + 1;
    }
    arsort($counts);
    $mode = array_key_first($counts);
    return $mode !== null ? (int) $mode : null;
}

function hv_wmo_label(int $code): string
{
    return match ($code) {
        0 => 'Clear Sky',
        1 => 'Mainly Clear',
        2 => 'Partly Cloudy',
        3 => 'Overcast',
        45, 48 => 'Foggy',
        51, 53, 55 => 'Drizzle',
        61, 63, 65, 80, 81, 82 => 'Rain',
        95, 96, 99 => 'Thunderstorm',
        default => 'Cloudy',
    };
}

function hv_weather_icon_key(int $code): string
{
    return match (true) {
        in_array($code, [0, 1], true) => 'sunny',
        in_array($code, [2, 3, 45, 48], true) => 'cloudy',
        in_array($code, [95, 96, 99], true) => 'storm',
        default => 'rain',
    };
}

function hv_precip_risk(float $probability): array
{
    if ($probability >= 60) {
        return ['text' => 'HIGH', 'class' => 'risk-high'];
    }
    if ($probability >= 30) {
        return ['text' => 'MOD', 'class' => 'risk-mod'];
    }
    return ['text' => 'LOW', 'class' => 'risk-low'];
}

function hv_wind_direction(float $deg): string
{
    $dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return $dirs[(int) round($deg / 45) % 8];
}

function hv_build_regional_weather(): array
{
    $cached = hv_cache_read('wv_regional_weather_v1', 300);
    if ($cached) {
        return $cached;
    }

    $points = [
        ['label' => 'Iloilo City', 'lat' => 10.7202, 'lon' => 122.5621],
        ['label' => 'Bacolod City', 'lat' => 10.6765, 'lon' => 122.9509],
        ['label' => 'Roxas City', 'lat' => 11.5853, 'lon' => 122.7511],
        ['label' => 'Kalibo', 'lat' => 11.7016, 'lon' => 122.3647],
        ['label' => 'San Jose de Buenavista', 'lat' => 10.7450, 'lon' => 121.9410],
        ['label' => 'Jordan, Guimaras', 'lat' => 10.7286, 'lon' => 122.5962],
    ];

    $latitudes = implode(',', array_map(static fn(array $p): string => (string) $p['lat'], $points));
    $longitudes = implode(',', array_map(static fn(array $p): string => (string) $p['lon'], $points));
    $timezoneList = implode(',', array_fill(0, count($points), 'Asia/Manila'));

    $url = 'https://api.open-meteo.com/v1/forecast'
        . '?latitude=' . rawurlencode($latitudes)
        . '&longitude=' . rawurlencode($longitudes)
        . '&current=' . rawurlencode('temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m')
        . '&daily=' . rawurlencode('weather_code,temperature_2m_max,precipitation_probability_max')
        . '&timezone=' . rawurlencode($timezoneList)
        . '&forecast_days=4';

    $payload = hv_fetch_json($url, 14);
    $records = [];
    if (isset($payload[0]) && is_array($payload[0])) {
        $records = $payload;
    } elseif (is_array($payload) && isset($payload['latitude'])) {
        $records = [$payload];
    }

    if (!$records) {
        return [
            'ok' => false,
            'region' => 'Western Visayas',
            'summary' => 'Could not sync live regional weather.',
            'last_updated' => date(DATE_ATOM),
        ];
    }

    $temps = [];
    $feels = [];
    $humidity = [];
    $winds = [];
    $dirs = [];
    $codes = [];
    $cities = [];
    $forecastBuckets = [1 => [], 2 => [], 3 => []];

    foreach ($records as $idx => $record) {
        $current = $record['current'] ?? [];
        $daily = $record['daily'] ?? [];
        $code = (int) ($current['weather_code'] ?? 3);

        $temps[] = (float) ($current['temperature_2m'] ?? 0);
        $feels[] = (float) ($current['apparent_temperature'] ?? 0);
        $humidity[] = (float) ($current['relative_humidity_2m'] ?? 0);
        $winds[] = (float) ($current['wind_speed_10m'] ?? 0);
        $dirs[] = (float) ($current['wind_direction_10m'] ?? 0);
        $codes[] = $code;

        $cities[] = [
            'label' => $points[$idx]['label'] ?? ('Point ' . ($idx + 1)),
            'temp' => round((float) ($current['temperature_2m'] ?? 0)),
            'condition' => hv_wmo_label($code),
        ];

        for ($i = 1; $i <= 3; $i++) {
            $forecastBuckets[$i][] = [
                'temp_max' => (float) (($daily['temperature_2m_max'][$i] ?? 0)),
                'precip_probability_max' => (float) (($daily['precipitation_probability_max'][$i] ?? 0)),
                'weather_code' => (int) (($daily['weather_code'][$i] ?? $code)),
                'date' => (string) (($daily['time'][$i] ?? '')),
            ];
        }
    }

    $dominantCode = hv_mode_value($codes) ?? 3;
    $forecast = [];
    for ($i = 1; $i <= 3; $i++) {
        $tempsDay = array_map(static fn(array $row): float => (float) ($row['temp_max'] ?? 0), $forecastBuckets[$i]);
        $probsDay = array_map(static fn(array $row): float => (float) ($row['precip_probability_max'] ?? 0), $forecastBuckets[$i]);
        $codesDay = array_map(static fn(array $row): int => (int) ($row['weather_code'] ?? 3), $forecastBuckets[$i]);
        $date = $forecastBuckets[$i][0]['date'] ?? '';

        $forecast[] = [
            'label' => $i === 1 ? 'Tomorrow' : date('D', strtotime($date ?: ('+' . $i . ' day'))),
            'temp_max' => round(hv_average($tempsDay)),
            'precip_probability_max' => round(hv_max_value($probsDay)),
            'weather_code' => hv_mode_value($codesDay) ?? 3,
            'risk' => hv_precip_risk(hv_max_value($probsDay)),
        ];
    }

    $weather = [
        'ok' => true,
        'region' => 'Western Visayas',
        'condition' => hv_wmo_label($dominantCode),
        'weather_code' => $dominantCode,
        'icon' => hv_weather_icon_key($dominantCode),
        'temperature' => round(hv_average($temps)),
        'feels_like' => round(hv_average($feels)),
        'humidity' => round(hv_average($humidity)),
        'wind_speed' => round(hv_average($winds)),
        'wind_direction' => hv_wind_direction(hv_average($dirs)),
        'summary' => 'Regional average across Iloilo, Bacolod, Roxas, Kalibo, Antique, and Guimaras.',
        'forecast' => $forecast,
        'cities' => $cities,
        'last_updated' => date(DATE_ATOM),
    ];

    hv_cache_write('wv_regional_weather_v1', $weather);
    return $weather;
}

function hv_extract_source_alert(array $alerts, string $needle): ?array
{
    foreach ($alerts as $alert) {
        if (stripos((string) ($alert['source'] ?? ''), $needle) !== false) {
            return $alert;
        }
    }
    return null;
}



function hv_detect_areas(array $items): array
{
    $text = mb_strtolower(implode(' ', array_map(static function (array $item): string {
        return (string) (($item['title'] ?? '') . ' ' . ($item['summary'] ?? ''));
    }, $items)), 'UTF-8');

    $areaMap = [
        'Bacolod' => ['bacolod'],
        'Negros Occidental' => ['negros occidental', 'neg occ'],
        'Iloilo' => ['iloilo', 'iloilo city'],
        'Capiz' => ['capiz', 'roxas city'],
        'Aklan' => ['aklan', 'boracay'],
        'Antique' => ['antique'],
        'Guimaras' => ['guimaras'],
    ];

    $areas = [];
    foreach ($areaMap as $label => $keywords) {
        foreach ($keywords as $keyword) {
            if (str_contains($text, $keyword)) {
                $areas[] = $label;
                break;
            }
        }
    }

    if (!$areas) {
        return ['Western Visayas'];
    }

    return array_slice(array_values(array_unique($areas)), 0, 3);
}

function hv_build_action_now(array $hero, array $weather, int $activeCount): string
{
    $heroText = mb_strtolower((string) (($hero['title'] ?? '') . ' ' . ($hero['summary'] ?? '')), 'UTF-8');

    if (str_contains($heroText, 'warning') || str_contains($heroText, 'alert level') || str_contains($heroText, 'eruption')) {
        return 'Review official alerts first, prepare essentials, and avoid high-risk routes until local responders advise otherwise.';
    }
    if (str_contains($heroText, 'watch') || str_contains($heroText, 'advisory')) {
        return 'Stay alert, monitor updates closely, and check the map before travel or evacuation decisions.';
    }
    if ($activeCount > 0) {
        return 'Use the Alerts page for the latest official issuances, then confirm routes and centers before moving.';
    }
    if (!empty($weather['ok'])) {
        return 'No active official advisory is shown right now. Keep essentials ready and monitor conditions if weather changes.';
    }

    return 'Open Alerts for the official advisory page, then use the map and responder panels for routing and center checks.';
}

function hv_build_live_feed(): array
{
    $cached = hv_cache_read('wv_live_feed_v8', 300);
    if ($cached) {
        return $cached;
    }

    $officialAlerts = hv_build_official_alerts();
    $news = hv_build_news_feed();
    $weather = hv_build_regional_weather();

    $activeAlerts = array_values(array_filter(
        $officialAlerts,
        static fn(array $item): bool => !in_array(($item['badge'] ?? ''), ['CLEAR'], true)
    ));

    $hero = $activeAlerts[0] ?? ($officialAlerts[0] ?? [
        'title' => 'No active official advisory for Western Visayas',
        'summary' => 'Continue monitoring PAGASA and PHIVOLCS official pages for the latest region-wide advisories.',
        'badge' => 'CLEAR',
        'badgeClass' => 'pill-green',
        'source' => 'HANDAVis',
        'timestamp' => time(),
        'url' => 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
    ]);

    $timeline = [];
    foreach (array_slice($officialAlerts, 0, 3) as $item) {
        $timeline[] = [
            'timestamp' => (int) ($item['timestamp'] ?? time()),
            'title' => $item['title'],
            'summary' => $item['summary'],
            'type' => 'official',
        ];
    }
    foreach (array_slice($news, 0, 3) as $item) {
        $timeline[] = [
            'timestamp' => (int) ($item['timestamp'] ?? time()),
            'title' => $item['title'],
            'summary' => $item['summary'],
            'type' => 'news',
        ];
    }
    if (!empty($weather['ok'])) {
        $timeline[] = [
            'timestamp' => strtotime((string) ($weather['last_updated'] ?? date(DATE_ATOM))) ?: time(),
            'title' => 'Western Visayas weather synced',
            'summary' => ($weather['condition'] ?? 'Weather') . ' across the region. Regional average ' . ($weather['temperature'] ?? '--') . '°C.',
            'type' => 'weather',
        ];
    }

    usort($timeline, static function (array $a, array $b): int {
        return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
    });

    $pagasaVisayas = hv_extract_source_alert($officialAlerts, 'PAGASA Visayas');
    $pagasaAdvisory = hv_extract_source_alert($officialAlerts, 'PAGASA Weather Advisory');
    $phivolcs = hv_extract_source_alert($officialAlerts, 'PHIVOLCS');

    $sources = array_slice([
        [
            'label' => 'PAGASA Visayas',
            'status' => $pagasaVisayas['badge'] ?? 'LIVE',
            'summary' => $pagasaVisayas['summary'] ?? 'Cross-checking the official Visayas regional forecast page.',
            'updated' => hv_format_time((int) ($pagasaVisayas['timestamp'] ?? time())),
        ],
        [
            'label' => 'PAGASA Advisory',
            'status' => $pagasaAdvisory['badge'] ?? 'LIVE',
            'summary' => $pagasaAdvisory['summary'] ?? 'No advisory text was parsed right now.',
            'updated' => hv_format_time((int) ($pagasaAdvisory['timestamp'] ?? time())),
        ],
        [
            'label' => 'PHIVOLCS',
            'status' => $phivolcs['badge'] ?? 'LIVE',
            'summary' => $phivolcs['title'] ?? 'Watching the latest Kanlaon bulletin for Negros-related hazards.',
            'updated' => hv_format_time((int) ($phivolcs['timestamp'] ?? time())),
        ],
        [
            'label' => 'Regional News',
            'status' => count($news) > 0 ? 'LIVE' : 'QUIET',
            'summary' => $news[0]['title'] ?? 'No fresh Western Visayas disaster or weather headline matched the filter right now.',
            'updated' => count($news) > 0 ? hv_format_time((int) ($news[0]['timestamp'] ?? time())) : 'Live source',
        ],
    ], 0, 4);

    $affectedAreas = hv_detect_areas($activeAlerts ?: $officialAlerts);
    $actionNow = hv_build_action_now($hero, $weather, count($activeAlerts));
    $sourceCheck = ($hero['source'] ?? 'Official sources') . ' • ' . hv_format_time((int) ($hero['timestamp'] ?? time()));

    $payload = [
        'ok' => true,
        'generated_at' => date(DATE_ATOM),
        'hero' => [
            'title' => $hero['title'],
            'summary' => $hero['summary'],
            'badge' => $hero['badge'] ?? 'LIVE',
            'badgeClass' => $hero['badgeClass'] ?? 'pill-blue',
            'source' => $hero['source'] ?? 'Live source',
            'timeLabel' => hv_format_time((int) ($hero['timestamp'] ?? time())),
            'url' => $hero['url'] ?? 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
        ],
        'hero_context' => [
            'affected' => implode(' • ', $affectedAreas),
            'action' => $actionNow,
            'sourceCheck' => $sourceCheck,
        ],
        'metrics' => [
            'officialAlertCount' => count($activeAlerts),
            'newsCount' => count($news),
            'sourceCount' => count($sources),
        ],
        'official_alerts' => array_slice($officialAlerts, 0, 3),
        'regional_news' => $news,
        'timeline' => array_slice($timeline, 0, 6),
        'weather' => $weather,
        'snapshot' => [
            'region' => 'Western Visayas only',
            'status' => count($activeAlerts) > 0 ? 'Active official items found' : 'No active official advisory shown',
            'guidance' => $actionNow,
            'center' => 'Connect your verified evacuation center dataset to replace this placeholder with a nearest live center.',
            'contacts' => [
                [
                    'label' => 'National Emergency',
                    'value' => '911',
                    'description' => 'Primary emergency response hotline for urgent police, fire, and medical emergencies.',
                    'icon' => 'shield',
                    'accent' => 'red',
                ],
                [
                    'label' => 'Bacolod Fire Station',
                    'value' => '0921-341-7002',
                    'description' => 'Direct Bacolod City fire response contact for local fire incidents and rescue support.',
                    'icon' => 'fire',
                    'accent' => 'orange',
                ],
                [
                    'label' => 'Philippine Red Cross',
                    'value' => '143',
                    'description' => '24/7 hotline for ambulance, first aid, rescue, and humanitarian response.',
                    'icon' => 'heart',
                    'accent' => 'cyan',
                ],
                [
                    'label' => 'Local DRRMO / Barangay',
                    'value' => 'Add verified local number',
                    'description' => 'Replace this with your barangay or city DRRMO hotline for faster area-based response.',
                    'icon' => 'phone',
                    'accent' => 'green',
                ],
            ],
        ],
        'sources' => $sources,
    ];

    hv_cache_write('wv_live_feed_v8', $payload);
    return $payload;
}


if (isset($_GET['ajax']) && $_GET['ajax'] === 'live_dashboard_feed') {
    hv_json_response(hv_build_live_feed());
}

?>
<script>
	document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetPage = urlParams.get('page');
    
    if (targetPage && typeof openPage === "function") {
        // Automatically click the correct section based on the URL
        openPage(null, targetPage);
    }
});
	// 1. SEARCH FUNCTION
function searchFriends() {
    const term = document.getElementById('friendSearchInput').value;
    const list = document.getElementById('friendsList');

    if (term.length < 2) {
        // If they backspace everything, you might want to reload the actual friend list
        return; 
    }

    fetch(`userhome.php?ajax=search_users&term=${encodeURIComponent(term)}`)
        .then(res => res.json())
        .then(users => {
            list.innerHTML = ''; // Clear current list
            
            if (users.length === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5;">No users found</div>';
                return;
            }

           users.forEach(user => {
    const isFriend = (user.f_status === 'accepted');
    
    // Fix the "Double Folder" and Pathing issues
    let avatarUrl = '';
    if (user.avatar_path) {
        let cleanPath = user.avatar_path.replace(/\\/g, '/').replace(/^\/+/, '');
        avatarUrl = cleanPath.includes('images/profile_avatars') 
                    ? '/HANDAVis/' + cleanPath 
                    : '/HANDAVis/images/profile_avatars/' + cleanPath;
    } else {
        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D8ABC&color=fff`;
    }

    list.innerHTML += `
        <div class="friend-item" style="display:flex; align-items:center; padding:10px; gap:10px;">
            <img src="${avatarUrl}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
            <span style="font-size:13px; color:white; flex-grow:1;">${user.username}</span>
            <button onclick="toggleFriendship(${user.id}, '${user.f_status}', event)" 
                    style="background:none; border:none; cursor:pointer; font-size:11px; color: ${isFriend ? '#ff4d57' : '#4fd8ff'};">
                ${isFriend ? 'Unfriend' : 'Add Friend'}
            </button>
        </div>`;
});

// 2. ADD/UNFRIEND ACTION FUNCTION
function toggleFriendship(targetId, currentStatus, event) {
    event.stopPropagation(); // Prevents dropdown from closing on button click
    
    const action = (currentStatus === 'accepted') ? 'unfriend' : 'add';
    
    // Create form data to send to your PHP
    const formData = new FormData();
    formData.append('action', action);
    formData.append('friend_id', targetId);

    fetch('database/friends_action.php', { // Create this file or add to userhome.php
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            searchFriends(); // Refresh the search list to show updated button
        }
    });
}
</script>
<!DOCTYPE html>
<html lang="en">
<head>
	
	<?php if (file_exists(__DIR__ . '/assets/css/watch_style.css')): ?>
	<link rel="stylesheet" href="assets/css/watch_style.css?v=<?php echo filemtime(__DIR__ . '/assets/css/watch_style.css'); ?>">
	<?php endif; ?>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - User Dashboard</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo file_exists(__DIR__ . '/handav.png') ? filemtime(__DIR__ . '/handav.png') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_home.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_home.css') ? filemtime(__DIR__ . '/assets/css/user_home.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_main_header.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_main_header.css') ? filemtime(__DIR__ . '/assets/css/user_main_header.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_dashboard.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_dashboard.css') ? filemtime(__DIR__ . '/assets/css/user_dashboard.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_footer.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_footer.css') ? filemtime(__DIR__ . '/assets/css/user_footer.css') : time(); ?>">
  <link rel="stylesheet" href="assets/user_home.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/user_watch.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/bigger_buttons.css">
  <link rel="stylesheet" href="assets/css/reduce_animation.css">


</head>
<body>
  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <div class="dashboard">
    <?php $activePage = 'dashboardPage'; require __DIR__ . '/includes/user_dashboard.php'; ?>

    <main class="portal-content">
				
      <section id="dashboardPage" class="page active">
        <div class="topbar" id="homeTop">
          <div class="page-head">
            <h1>Home Dashboard</h1>
            <p>Real-time official advisories, summarized trusted sources, and live Western Visayas weather in one lightweight home feed.</p>
          </div>
          <div class="topbar-actions">
            <span class="chip"><span class="chip-dot"></span>Western Visayas only</span>
          </div>
        </div>

        <section class="hero">
          <div class="alert-banner">
            <div>
              <strong id="heroAlertTitle">Loading official advisories...</strong>
              <span id="heroAlertMeta">Checking PAGASA, PHIVOLCS, and verified regional sources.</span>
            </div>
            <div id="heroAlertPill" class="alert-pill">LIVE</div>
          </div>

          <div class="hero-grid hero-grid-updated">
            <div class="panel emergency-card hero-card official-focus-card">
              <span class="official-focus-icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none">
                  <path d="M32 8 54 48H10L32 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                  <path d="M32 24v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  <circle cx="32" cy="42" r="2.4" fill="currentColor"/>
                </svg>
              </span>
              <div class="eyebrow">Official Alert</div>
              <h3 id="dashboardAlertHeadline">Syncing Western Visayas official updates.</h3>
              <p id="dashboardAlertSummary">This card only shows source-backed information. No fabricated levels, fake timestamps, or placeholder warnings.</p>
              <div class="button-row">
                <button class="btn" onclick="goToUserAlerts()">View Alerts</button>
                <button class="btn secondary" onclick="jumpToMap()">View Map</button>
                <button class="btn secondary" onclick="jumpToSafety()">Safety Guide</button>
              </div>

              <div class="hero-context">
                <div class="hero-context-card">
                  <span class="hero-context-label">Affected areas</span>
                  <strong id="heroAffectedAreas">Western Visayas</strong>
                  <p>Closest matching areas from the latest official region-wide update.</p>
                </div>
                <div class="hero-context-card">
                  <span class="hero-context-label">Action now</span>
                  <strong id="heroActionNow">Monitor official alerts</strong>
                  <p>Use the alerts page first, then check routing and safe centers.</p>
                </div>
                <div class="hero-context-card">
                  <span class="hero-context-label">Source check</span>
                  <strong id="heroSourceCheck">PAGASA • Live</strong>
                  <p>Only official sources and verified Western Visayas summaries are used here.</p>
                </div>
              </div>

              <div class="footer-note hero-footer-note">
                Source-backed only • Summaries are pulled from PAGASA, PHIVOLCS, and verified Western Visayas news sources.
              </div>
            </div>

            <div class="hero-shortcuts-panel" aria-label="Main navigation shortcuts">
              <button class="panel metric-card weather-accent hero-shortcut-card clickable-panel" onclick="jumpToWeatherSection()" type="button">
                <img src="images/cloudy-day.png" alt="Weather" class="card-image">
                <div class="eyebrow">Weather</div>
                <div id="metricWeatherValue" class="metric-value">--°C</div>
                <div id="metricWeatherText" class="subtext">Tap to view forecast.</div>
              </button>

              <button class="panel metric-card alert-accent hero-shortcut-card clickable-panel official-shortcut-card" onclick="goToUserAlerts()" type="button">
                <img src="images/alert1.png" alt="Alerts" class="card-image">
                <span class="card-watermark" aria-hidden="true">
                  <svg viewBox="0 0 64 64" fill="none">
                    <path d="M32 10 54 48H10L32 10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                    <path d="M32 24v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="32" cy="42" r="2.4" fill="currentColor"/>
                  </svg>
                </span>
                <div class="eyebrow">Alerts</div>
                <div id="userAlertCount" class="metric-value"><?php echo $alertCount; ?></div>
                <div id="metricAlertText" class="subtext">Tap to open alerts page.</div>
              </button>

              <button class="panel metric-card centers-accent hero-shortcut-card clickable-panel" onclick="jumpToSafety()" type="button">
                <img src="images/home.png" alt="House Safety" class="card-image">
                <div class="eyebrow">House Safety</div>
                <div class="metric-value">GO</div>
                <div class="subtext">Open safety page.</div>
              </button>

              <button class="panel metric-card reports-accent hero-shortcut-card clickable-panel" onclick="setActivePageSafe('reportPage')" type="button">
                <img src="images/report.png" alt="Report Hazard" class="card-image">
                <div class="eyebrow">Report</div>
                <div id="reportMetric" class="metric-value">GO</div>
                <div class="subtext">Open report panel.</div>
              </button>
            </div>
          </div>
        </section>

        <h2 class="section-title">Live Now</h2>
        <div class="content-grid live-updates-grid">
          <div class="panel span-12 summary-panel" id="newsTop">
            <div class="live-now-head">
              <div class="eyebrow">Source Status</div>
              <div class="muted-note" id="sourceStatusNote">Sources are checked at page load and when you refresh the home page.</div>
            </div>
            <div id="sourceStatusGrid" class="status-grid">
              <div class="status-card">
                <div class="status-label">Loading source status...</div>
                <div class="status-summary">Checking PAGASA, PHIVOLCS, and regional news.</div>
                <div class="status-updated">Checking sources...</div>
              </div>
            </div>
          </div>
        </div>

        <h2 class="section-title">Forecast Snapshot</h2>
        <div class="content-grid" id="weatherTop">
          <div class="panel span-12 pagasa-card">
            <div class="pagasa-header">
              <div class="eyebrow" style="margin-bottom:0;">Western Visayas Forecast Snapshot</div>
              <span class="pagasa-badge">WESTERN VISAYAS LIVE</span>
            </div>

            <div class="pagasa-main">
              <div class="pagasa-temp-block">
                <div class="pagasa-temp" id="pagasaTemp">--°C</div>
                <div class="pagasa-condition" id="pagasaCondition">Loading</div>
              </div>
              <div class="pagasa-icon-bubble">
                <svg id="pagasaWeatherIcon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="pagasa-weather-svg">
                  <path d="M46 28a10 10 0 0 0-19.6-2.8A8 8 0 1 0 20 41h26a8 8 0 0 0 0-16z" stroke="#4fd8ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="rgba(79,216,255,0.08)"/>
                </svg>
              </div>
            </div>

            <div class="pagasa-stats">
              <div class="pagasa-stat">
                <span class="pagasa-stat-icon">🌡️</span>
                <div>
                  <div class="pagasa-stat-label" id="pagasaFeels">--°C</div>
                  <div class="pagasa-stat-value">Feels Like</div>
                </div>
              </div>
              <div class="pagasa-stat-divider"></div>
              <div class="pagasa-stat">
                <span class="pagasa-stat-icon">💨</span>
                <div>
                  <div class="pagasa-stat-label" id="pagasaWind">--</div>
                  <div class="pagasa-stat-value">Wind</div>
                </div>
              </div>
              <div class="pagasa-stat-divider"></div>
              <div class="pagasa-stat">
                <span class="pagasa-stat-icon">💧</span>
                <div>
                  <div class="pagasa-stat-label" id="pagasaHumidity">--%</div>
                  <div class="pagasa-stat-value">Humidity</div>
                </div>
              </div>
            </div>

            <div class="pagasa-forecast-row" id="pagasaForecastRow">
              <div class="pagasa-day">
                <div class="pagasa-day-label">Tomorrow</div>
                <svg viewBox="0 0 40 40" fill="none" class="pagasa-day-icon">
                  <path d="M28 18a6 6 0 0 0-11.8-1.7A5 5 0 1 0 13 26h15a5 5 0 0 0 0-10z" stroke="#4fd8ff" stroke-width="1.8" fill="rgba(79,216,255,0.08)"/>
                </svg>
                <div class="pagasa-day-temp" id="pagasaDay1Temp">--°C</div>
                <div class="pagasa-rain-risk risk-low" id="pagasaDay1Risk">LOW</div>
              </div>
              <div class="pagasa-day">
                <div class="pagasa-day-label" id="pagasaDay2Label">--</div>
                <svg viewBox="0 0 40 40" fill="none" class="pagasa-day-icon">
                  <path d="M28 18a6 6 0 0 0-11.8-1.7A5 5 0 1 0 13 26h15a5 5 0 0 0 0-10z" stroke="#4fd8ff" stroke-width="1.8" fill="rgba(79,216,255,0.08)"/>
                </svg>
                <div class="pagasa-day-temp" id="pagasaDay2Temp">--°C</div>
                <div class="pagasa-rain-risk risk-low" id="pagasaDay2Risk">LOW</div>
              </div>
              <div class="pagasa-day">
                <div class="pagasa-day-label" id="pagasaDay3Label">--</div>
                <svg viewBox="0 0 40 40" fill="none" class="pagasa-day-icon">
                  <path d="M28 18a6 6 0 0 0-11.8-1.7A5 5 0 1 0 13 26h15a5 5 0 0 0 0-10z" stroke="#4fd8ff" stroke-width="1.8" fill="rgba(79,216,255,0.08)"/>
                </svg>
                <div class="pagasa-day-temp" id="pagasaDay3Temp">--°C</div>
                <div class="pagasa-rain-risk risk-low" id="pagasaDay3Risk">LOW</div>
              </div>
            </div>

            <div class="footer-note" style="margin-top:14px;">
              Live data for <strong style="color:#4fd8ff;">Western Visayas</strong>
              &middot; Regional weather average + official advisory cross-check
              &middot; <span id="pagasaLastUpdated">Updating...</span>
            </div>

            <div class="pagasa-alerts-section">
              <div class="eyebrow" style="margin-bottom:10px;">Latest Live Alerts</div>
              <div id="pagasaAlertsList" class="list">
                <div class="list-item">
                  <strong>Waiting for alert feed...</strong>
                  <span>This list will mirror the official alert card above.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h2 class="section-title">Essential At a Glance</h2>
        <div class="content-grid essential-grid">
          <div class="essential-stack">
            <div class="panel compact-panel area-panel">
              <div class="eyebrow">My Area Status</div>
              <div class="list compact-list">
                <div class="list-item">
                  <strong id="snapshotRegion">Western Visayas only</strong>
                  <span id="snapshotStatus">Waiting for live status.</span>
                </div>
                <div class="list-item">
                  <strong>Recommended action</strong>
                  <span id="snapshotGuidance">Open the map and follow official updates before acting on community reports.</span>
                </div>
              </div>
            </div>

            <div class="panel compact-panel center-panel">
              <div class="eyebrow">Nearest Safe Center</div>
              <div class="list compact-list">
                <div class="list-item">
                  <strong id="snapshotCenterTitle">Center data not synced yet</strong>
                  <span id="snapshotCenterText">Connect your verified evacuation center dataset so this card can show the nearest live center instead of a hardcoded placeholder.</span>
                  <button class="tag" onclick="jumpToMap()">Open Map Panel</button>
                </div>
              </div>
            </div>
          </div>

          <div class="panel contacts-panel" id="contactsTop">
            <div class="eyebrow">Emergency Contacts</div>
            <div class="contacts-header">
              <strong>Fast help, easy to scan</strong>
              <span>Use the most urgent contact first, then your barangay or DRRMO line.</span>
            </div>
            <div id="contactList" class="contact-grid">
              <div class="contact-card emergency-accent">
                <div class="contact-icon">☎</div>
                <div class="contact-copy">
                  <strong>National Emergency</strong>
                  <span>911</span>
                  <small>Primary emergency response hotline.</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

<?php include __DIR__ . '/includes/user_watch.php'; ?>
    </main>

    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <div id="toast" class="toast"></div>

  <script src="assets/js/user_dashboard.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_dashboard.js') ? filemtime(__DIR__ . '/assets/js/user_dashboard.js') : time(); ?>"></script>
  <script src="assets/js/user_main_header.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_main_header.js') ? filemtime(__DIR__ . '/assets/js/user_main_header.js') : time(); ?>"></script>
  <script src="assets/js/user_home.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_home.js') ? filemtime(__DIR__ . '/assets/js/user_home.js') : time(); ?>"></script>
  <script src="assets/js/user_watch.js?v=<?php echo time(); ?>"></script>
  <script src="assets/js/user_settings.js"></script>

<?php if (file_exists(__DIR__ . '/assets/js/watch_logic.js')): ?>
<script src="assets/js/watch_logic.js?v=<?php echo filemtime(__DIR__ . '/assets/js/watch_logic.js'); ?>"></script>
<?php endif; ?>
	<div id="videoModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; align-items: center; justify-content: center;">
    <div style="width: 90%; max-width: 900px; position: relative;">
        <button onclick="closeVideoPlayer()" style="position: absolute; top: -40px; right: 0; background: none; border: none; color: #fff; font-size: 30px; cursor: pointer;">&times;</button>
        <div id="playerFrame" style="position: relative; padding-bottom: 56.25%; height: 0; background: #000;">
            </div>
    </div>
</div>
<script>
  window.hvRegionalAlertCount = <?php echo (int)$alertCount; ?>;
</script>
</body>
</html>
