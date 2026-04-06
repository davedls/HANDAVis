<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$locationKey = strtolower(trim((string)($_GET['location'] ?? 'bacolod')));
$scenarioKey = strtolower(trim((string)($_GET['scenario'] ?? 'flood')));
$severityKey = strtolower(trim((string)($_GET['severity'] ?? 'high')));

$locations = [
    'bacolod' => [
        'label' => 'Bacolod City',
        'keywords' => ['bacolod', 'negros occidental', 'bcdrrmo', 'western visayas'],
        'local_sources' => ['bacolod_city'],
    ],
    'iloilo'  => [
        'label' => 'Iloilo City',
        'keywords' => ['iloilo city', 'iloilo', 'guimaras', 'western visayas'],
        'local_sources' => ['iloilo_cdrrmo'],
    ],
    'capiz'   => [
        'label' => 'Roxas / Capiz',
        'keywords' => ['roxas', 'capiz', 'western visayas'],
        'local_sources' => [],
    ],
    'antique' => [
        'label' => 'Antique Coast',
        'keywords' => ['antique', 'san jose', 'western visayas'],
        'local_sources' => [],
    ],
];

$scenarioKeywords = [
    'flood' => ['flood', 'rain', 'rainfall', 'flash flood', 'thunderstorm', 'heavy rainfall', 'landslide'],
    'storm' => ['storm', 'tropical cyclone', 'typhoon', 'wind', 'gust', 'surge', 'thunderstorm', 'rainfall'],
    'fire'  => ['fire', 'smoke', 'burn', 'blaze', 'rescue', 'evacuation', 'incident'],
];

$westernVisayasKeywords = [
    'western visayas', 'w. visayas', 'region 6', 'region vi', 'iloilo', 'guimaras',
    'antique', 'aklan', 'capiz', 'roxas', 'negros occidental', 'bacolod', 'panay'
];

$location = $locations[$locationKey] ?? $locations['bacolod'];
$wantedKeywords = $scenarioKeywords[$scenarioKey] ?? $scenarioKeywords['flood'];

function fetchRemote(string $url, int $timeout = 8): ?string {
    $ua = 'Mozilla/5.0 (compatible; HANDAVis-WV/1.0; +https://localhost/)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT => $ua,
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'],
            CURLOPT_ENCODING => '',
        ]);
        $result = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($result !== false && $httpCode >= 200 && $httpCode < 400) {
            return (string) $result;
        }
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => $timeout,
            'header' => "User-Agent: {$ua}\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $result = @file_get_contents($url, false, $context);
    return $result !== false ? (string) $result : null;
}

function htmlText(string $html): string {
    $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', ' ', $html) ?? $html;
    $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is', ' ', $html) ?? $html;
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    return trim($text);
}

function cleanText(string $value): string {
    $value = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    return trim($value);
}

function inferLevel(string $text): string {
    $hay = mb_strtolower($text);
    foreach ([
        'danger' => ['danger', 'evacuate now', 'critical', 'red alert'],
        'warning' => ['warning', 'heavy rainfall', 'storm surge', 'thunderstorm', 'blue alert', 'red'],
        'watch' => ['watch', 'advisory', 'monitor', 'less likely', 'elevated'],
    ] as $level => $needles) {
        foreach ($needles as $needle) {
            if (mb_strpos($hay, $needle) !== false) return $level;
        }
    }
    return 'info';
}

function containsAny(string $haystack, array $needles): bool {
    $haystack = mb_strtolower($haystack);
    foreach ($needles as $needle) {
        if (mb_strpos($haystack, mb_strtolower($needle)) !== false) {
            return true;
        }
    }
    return false;
}

function summarize(string $text, int $max = 260): string {
    $text = cleanText($text);
    if (mb_strlen($text) <= $max) return $text;
    return rtrim(mb_substr($text, 0, $max - 1)) . '…';
}

function normalizeUrl(string $href, string $baseUrl): string {
    if ($href === '') return $baseUrl;
    if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) return $href;
    return rtrim($baseUrl, '/') . '/' . ltrim($href, '/');
}

function scoreItem(array $item, array $locationKeywords, array $scenarioKeywords, array $wvKeywords): int {
    $hay = mb_strtolower(($item['title'] ?? '') . ' ' . ($item['summary'] ?? '') . ' ' . ($item['area'] ?? ''));
    $score = 0;
    foreach ($wvKeywords as $keyword) {
        if (mb_strpos($hay, mb_strtolower($keyword)) !== false) $score += 4;
    }
    foreach ($locationKeywords as $keyword) {
        if (mb_strpos($hay, mb_strtolower($keyword)) !== false) $score += 6;
    }
    foreach ($scenarioKeywords as $keyword) {
        if (mb_strpos($hay, mb_strtolower($keyword)) !== false) $score += 3;
    }
    if (($item['type'] ?? '') === 'official') $score += 4;
    if (($item['source_scope'] ?? '') === 'local') $score += 2;
    return $score;
}

function parsePagasaVisprsd(string $html, array $locationKeywords, array $wvKeywords): array {
    $items = [];
    $text = htmlText($html);

    if (preg_match('/As of today,\s*there is no Heavy Rainfall Warning Issued\./i', $text)) {
        $items[] = [
            'source' => 'PAGASA VIS_PRSD',
            'type' => 'official',
            'source_scope' => 'regional',
            'title' => 'No heavy rainfall warning issued for Visayas PRSD',
            'summary' => 'PAGASA VIS_PRSD currently shows no heavy rainfall warning issued.',
            'area' => 'Western Visayas',
            'level' => 'info',
            'url' => 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
        ];
    }

    if (preg_match('/Thunderstorm Information\s*#VISPRSD\s*Issued at\s*(.*?)\s*(Thunderstorm .*? within 12 hours\.)/i', $text, $m)) {
        $summary = summarize($m[2]);
        if (containsAny($summary, $wvKeywords)) {
            $items[] = [
                'source' => 'PAGASA VIS_PRSD',
                'type' => 'official',
                'source_scope' => 'regional',
                'title' => 'VIS_PRSD thunderstorm information',
                'summary' => $summary,
                'area' => 'Western Visayas',
                'published_at' => cleanText($m[1]),
                'level' => inferLevel($summary),
                'url' => 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
            ];
        }
    }

    return $items;
}

function parsePagasaWeatherAdvisory(string $html, array $locationKeywords, array $wvKeywords): array {
    $items = [];
    $text = htmlText($html);

    if (preg_match('/As of today,\s*there is no Weather Advisory issued\./i', $text)) {
        $items[] = [
            'source' => 'PAGASA Weather Advisory',
            'type' => 'official',
            'source_scope' => 'regional',
            'title' => 'No active PAGASA weather advisory for Western Visayas',
            'summary' => 'PAGASA currently shows no active weather advisory. Continue monitoring the Western Visayas regional forecast page for localized updates.',
            'area' => 'Western Visayas',
            'level' => 'info',
            'url' => 'https://www.pagasa.dost.gov.ph/weather/weather-advisory',
        ];
        return $items;
    }

    if (containsAny($text, $wvKeywords)) {
        $items[] = [
            'source' => 'PAGASA Weather Advisory',
            'type' => 'official',
            'source_scope' => 'regional',
            'title' => 'PAGASA weather advisory mentions Western Visayas',
            'summary' => summarize($text, 240),
            'area' => 'Western Visayas',
            'level' => inferLevel($text),
            'url' => 'https://www.pagasa.dost.gov.ph/weather/weather-advisory',
        ];
    }

    return $items;
}

function parseIloiloCdrrmo(string $html, array $locationKeywords, array $wvKeywords, array $scenarioKeywords): array {
    $items = [];
    $text = htmlText($html);

    if (preg_match_all('/(\d{2}-\d{2}-\d{4}\s+ILOILO CITY(?:\s+EMERGENCY)?\s+OPERATIONS CENTER ADVISORY\s+.*?)(?=\d{2}-\d{2}-\d{4}\s+ILOILO CITY|\# ARE YOU INFORMED\?|Emergency Hotlines|$)/i', $text, $matches)) {
        foreach ($matches[1] as $chunk) {
            $chunk = cleanText($chunk);
            if (!containsAny($chunk, $wvKeywords) && !containsAny($chunk, $scenarioKeywords)) {
                continue;
            }
            $title = 'Iloilo City Operations Center advisory';
            if (preg_match('/ADVISORY\s+(.*?)(Issued at:|Valid|$)/i', $chunk, $m)) {
                $title = 'Iloilo City Operations Center advisory: ' . summarize($m[1], 90);
            }
            $items[] = [
                'source' => 'Iloilo CDRRMO',
                'type' => 'official',
                'source_scope' => 'local',
                'title' => $title,
                'summary' => summarize($chunk, 250),
                'area' => containsAny($chunk, ['western visayas']) ? 'Western Visayas / Iloilo City' : 'Iloilo City',
                'level' => inferLevel($chunk),
                'url' => 'https://cdrrmo.iloilocity.gov.ph/fb-updates/',
            ];
            if (count($items) >= 2) break;
        }
    }

    return $items;
}

function parseBacolodNews(string $html, array $scenarioKeywords): array {
    $items = [];
    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    if (!$dom->loadHTML($html)) return $items;
    $xpath = new DOMXPath($dom);
    $nodes = $xpath->query('//a[@href]');
    if (!$nodes) return $items;
    $seen = [];
    foreach ($nodes as $node) {
        $href = trim((string) $node->getAttribute('href'));
        $label = cleanText($node->textContent ?? '');
        if ($label === '' || mb_strlen($label) < 18) continue;
        $labelHay = mb_strtolower($label);
        if (!containsAny($labelHay, array_merge($scenarioKeywords, ['bacolod', 'rainfall', 'weather', 'eoc', 'advisory', 'emergency']))) continue;
        if (isset($seen[$labelHay])) continue;
        $seen[$labelHay] = true;
        $items[] = [
            'source' => 'Bacolod City Government',
            'type' => 'official',
            'source_scope' => 'local',
            'title' => $label,
            'summary' => 'Latest Bacolod City Government post related to weather, emergency operations, or incident response.',
            'area' => 'Bacolod City / Negros Occidental',
            'level' => inferLevel($label),
            'url' => normalizeUrl($href, 'https://bacolodcity.gov.ph'),
        ];
        if (count($items) >= 2) break;
    }
    return $items;
}

function parsePiaDisaster(string $html, array $locationKeywords, array $wvKeywords, array $scenarioKeywords): array {
    $items = [];
    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    if (!$dom->loadHTML($html)) return $items;
    $xpath = new DOMXPath($dom);
    $nodes = $xpath->query('//a[@href]');
    if (!$nodes) return $items;
    $seen = [];
    foreach ($nodes as $node) {
        $href = trim((string) $node->getAttribute('href'));
        $label = cleanText($node->textContent ?? '');
        if ($label === '' || mb_strlen($label) < 18) continue;
        $hay = mb_strtolower($label . ' ' . $href);
        if (!containsAny($hay, $wvKeywords) && !containsAny($hay, $locationKeywords)) continue;
        if (!containsAny($hay, $scenarioKeywords) && !containsAny($hay, ['alert', 'disaster', 'typhoon', 'evacuation', 'relief'])) continue;
        if (isset($seen[$hay])) continue;
        $seen[$hay] = true;
        $items[] = [
            'source' => 'PIA Disaster Information Service',
            'type' => 'news',
            'source_scope' => 'regional',
            'title' => $label,
            'summary' => 'Regional disaster-information story focused on Western Visayas or the selected province/city.',
            'area' => 'Western Visayas',
            'level' => inferLevel($label),
            'url' => normalizeUrl($href, 'https://pia.gov.ph'),
        ];
        if (count($items) >= 3) break;
    }
    return $items;
}

$feedDefs = [
    ['url' => 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd', 'parser' => static fn(string $html): array => parsePagasaVisprsd($html, $location['keywords'], $westernVisayasKeywords)],
    ['url' => 'https://www.pagasa.dost.gov.ph/weather/weather-advisory', 'parser' => static fn(string $html): array => parsePagasaWeatherAdvisory($html, $location['keywords'], $westernVisayasKeywords)],
    ['url' => 'https://cdrrmo.iloilocity.gov.ph/fb-updates/', 'parser' => static fn(string $html): array => parseIloiloCdrrmo($html, $location['keywords'], $westernVisayasKeywords, $wantedKeywords)],
    ['url' => 'https://pia.gov.ph/disaster-information-service/', 'parser' => static fn(string $html): array => parsePiaDisaster($html, $location['keywords'], $westernVisayasKeywords, $wantedKeywords)],
];

if (in_array('bacolod_city', $location['local_sources'], true)) {
    $feedDefs[] = ['url' => 'https://bacolodcity.gov.ph/category/news/', 'parser' => static fn(string $html): array => parseBacolodNews($html, $wantedKeywords)];
}

$items = [];
foreach ($feedDefs as $def) {
    $html = fetchRemote($def['url']);
    if (!$html) continue;
    try {
        foreach ($def['parser']($html) as $item) {
            $items[] = $item;
        }
    } catch (Throwable $e) {
        // skip parser-specific failures
    }
}

$items = array_values(array_filter($items, static function (array $item) use ($location, $westernVisayasKeywords): bool {
    $hay = mb_strtolower(($item['title'] ?? '') . ' ' . ($item['summary'] ?? '') . ' ' . ($item['area'] ?? ''));
    return containsAny($hay, $westernVisayasKeywords) || containsAny($hay, $location['keywords']);
}));

foreach ($items as &$item) {
    $item['score'] = scoreItem($item, $location['keywords'], $wantedKeywords, $westernVisayasKeywords);
}
unset($item);

usort($items, static function (array $a, array $b): int {
    return ($b['score'] <=> $a['score']) ?: strcmp((string) ($a['source'] ?? ''), (string) ($b['source'] ?? ''));
});

$items = array_slice($items, 0, 8);

if (!$items) {
    $items = [[
        'source' => 'HANDAVis WV Fallback',
        'type' => 'official',
        'source_scope' => 'regional',
        'title' => 'Western Visayas feed unavailable right now',
        'summary' => 'The Western Visayas sources could not be reached from this server. Check internet access, cURL, or hosting restrictions, then refresh again.',
        'area' => $location['label'],
        'level' => 'watch',
        'url' => 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
        'score' => 0,
    ]];
}

$officialCount = count(array_filter($items, static fn(array $item): bool => ($item['type'] ?? '') === 'official'));
$newsCount = count(array_filter($items, static fn(array $item): bool => ($item['type'] ?? '') === 'news'));
$localCount = count(array_filter($items, static fn(array $item): bool => ($item['source_scope'] ?? '') === 'local'));

echo json_encode([
    'region' => 'Western Visayas',
    'location' => $location['label'],
    'scenario' => $scenarioKey,
    'severity' => $severityKey,
    'fetched_at' => gmdate('c'),
    'meta' => [
        'official_count' => $officialCount,
        'news_count' => $newsCount,
        'local_count' => $localCount,
        'summary' => 'Western Visayas only • ' . $officialCount . ' official • ' . $newsCount . ' regional • ' . $localCount . ' local items loaded for ' . $location['label'],
    ],
    'items' => $items,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
