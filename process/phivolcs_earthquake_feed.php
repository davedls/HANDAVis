<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function hv_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hv_fetch_remote_html(string $url): string
{
    if (function_exists('curl_init')) {
        $attempts = [
            [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2],
            [CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0],
        ];

        foreach ($attempts as $sslOptions) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_TIMEOUT => 18,
                CURLOPT_USERAGENT => 'HANDAVis PHIVOLCS Sync/1.0',
            ] + $sslOptions);
            $body = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if (is_string($body) && $body !== '' && $status >= 200 && $status < 400) {
                return $body;
            }

            if ($error === '' && $status >= 400) {
                throw new RuntimeException('HTTP ' . $status);
            }
        }

        throw new RuntimeException($error !== '' ? $error : 'Unable to fetch remote feed.');
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 18,
            'follow_location' => 1,
            'user_agent' => 'HANDAVis PHIVOLCS Sync/1.0',
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if (!is_string($body) || $body === '') {
        throw new RuntimeException('Unable to fetch remote feed.');
    }

    return $body;
}

function hv_clean_text(string $html): string
{
    $text = html_entity_decode(str_replace(['<br>', '<br/>', '<br />'], "\n", $html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = str_replace(['Â°', '┬░'], '°', $text);
    $text = strip_tags($text);
    $text = preg_replace('/[ \t]+/u', ' ', $text ?? '') ?? '';
    $text = preg_replace('/\s*\n\s*/u', ' ', $text) ?? '';
    $text = preg_replace('/\s*\|\s*/u', ' ', $text) ?? '';
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    return trim($text);
}

function hv_make_absolute_url(string $base, string $href): string
{
    $href = trim(str_replace('\\', '/', $href));
    if ($href === '') {
        return '';
    }
    if (preg_match('~^https?://~i', $href)) {
        return $href;
    }
    return rtrim($base, '/') . '/' . ltrim($href, '/');
}

function hv_parse_lat_lon(string $value): ?float
{
    $raw = strtoupper(trim($value));
    if ($raw === '') {
        return null;
    }

    if (!preg_match('/-?\d+(?:\.\d+)?/', $raw, $match)) {
        return null;
    }

    $number = (float) $match[0];
    if (str_contains($raw, 'S') || str_contains($raw, 'W')) {
        $number *= -1;
    }

    return is_finite($number) ? $number : null;
}

function hv_detect_severity(?float $magnitude): string
{
    if ($magnitude === null) return 'Monitor';
    if ($magnitude >= 6.0) return 'Critical';
    if ($magnitude >= 5.0) return 'High';
    if ($magnitude >= 4.0) return 'Moderate';
    return 'Low';
}

function hv_extract_between_comments(string $html, string $startMarker, string $endMarker): string
{
    $pattern = '/<!--\s*' . preg_quote($startMarker, '/') . '\s*-->(.*?)<!--\s*' . preg_quote($endMarker, '/') . '\s*-->/is';
    if (preg_match($pattern, $html, $match)) {
        return hv_clean_text($match[1]);
    }
    return '';
}

function hv_extract_inline_after_comment(string $html, string $marker): string
{
    $pattern = '/<!--\s*' . preg_quote($marker, '/') . '\s*-->\s*([^<]+)/is';
    if (preg_match($pattern, $html, $match)) {
        return hv_clean_text($match[1]);
    }
    return '';
}

function hv_parse_tsunami_flag(string $detailText): string
{
    if ($detailText === '') {
        return 'No';
    }

    if (preg_match('/\bno\b[^.]{0,120}\btsunami\b/i', $detailText) || preg_match('/\btsunami\b[^.]{0,120}\bno\b/i', $detailText)) {
        return 'No';
    }

    if (preg_match('/\btsunami\b/i', $detailText)) {
        return 'Yes';
    }

    return 'No';
}

function hv_extract_tsunami_height(string $detailText): ?string
{
    if (preg_match('/tsunami[^0-9]{0,80}(\d+(?:\.\d+)?)\s*m(?:eters?)?/i', $detailText, $match)) {
        return $match[1] . 'm';
    }
    return null;
}

function hv_extract_highest_intensity(string $intensityText): array
{
    preg_match_all('/Intensity\s*([IVX]+)/i', $intensityText, $matches);
    $romanValues = ['I' => 1, 'II' => 2, 'III' => 3, 'IV' => 4, 'V' => 5, 'VI' => 6, 'VII' => 7, 'VIII' => 8, 'IX' => 9, 'X' => 10];
    $bestRoman = '';
    $bestValue = 0;

    foreach (($matches[1] ?? []) as $roman) {
        $candidate = strtoupper(trim((string) $roman));
        $value = $romanValues[$candidate] ?? 0;
        if ($value > $bestValue) {
            $bestValue = $value;
            $bestRoman = $candidate;
        }
    }

    return [
        'roman' => $bestRoman !== '' ? $bestRoman : 'Not stated',
        'value' => $bestValue,
    ];
}

function hv_is_yes_value(string $value): bool
{
    return (bool) preg_match('/\b(yes|expected)\b/i', $value);
}

function hv_parse_bulletin_datetime(string $value): ?DateTimeImmutable
{
    $clean = trim(preg_replace('/\s+/', ' ', str_replace('|', ' ', $value)) ?? '');
    if ($clean === '') {
        return null;
    }

    $tz = new DateTimeZone('Asia/Manila');
    $formats = ['d F Y - h:i A', 'd M Y - h:i:s A', 'd M Y - h:i A', 'd F Y - h:i:s A'];

    foreach ($formats as $format) {
        $dt = DateTimeImmutable::createFromFormat($format, $clean, $tz);
        if ($dt instanceof DateTimeImmutable) {
            return $dt;
        }
    }

    return null;
}

function hv_distance_km(array $a, array $b): float
{
    $earthRadius = 6371.0;
    $lat1 = deg2rad((float) $a[0]);
    $lng1 = deg2rad((float) $a[1]);
    $lat2 = deg2rad((float) $b[0]);
    $lng2 = deg2rad((float) $b[1]);
    $dLat = $lat2 - $lat1;
    $dLng = $lng2 - $lng1;
    $calc = sin($dLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dLng / 2) ** 2;
    return $earthRadius * 2 * asin(min(1.0, sqrt($calc)));
}

function hv_mentions_western_visayas(string $text): bool
{
    $haystack = strtolower($text);
    if ($haystack === '') {
        return false;
    }

    $keywords = [
        'western visayas', 'aklan', 'antique', 'capiz', 'guimaras', 'iloilo', 'negros occidental',
        'bacolod', 'roxas', 'kalibo', 'sipalay', 'kabankalan', 'sibalom', 'guimbal', 'miagao',
        'san jose de buenavista', 'silay', 'talisay', 'victorias', 'passi', 'bago'
    ];

    foreach ($keywords as $keyword) {
        if (str_contains($haystack, $keyword)) {
            return true;
        }
    }

    return false;
}

function hv_is_near_western_visayas(array $coords): bool
{
    $referencePoints = [
        [11.7016, 122.3647], // Aklan
        [10.7446, 121.9410], // Antique
        [11.5850, 122.7513], // Capiz
        [10.5929, 122.6325], // Guimaras
        [10.7202, 122.5621], // Iloilo
        [10.6765, 122.9509], // Negros Occidental
    ];

    foreach ($referencePoints as $point) {
        if (hv_distance_km($coords, $point) <= 120) {
            return true;
        }
    }

    return false;
}

function hv_should_fetch_detail_for_western_visayas(array $record): bool
{
    $sourceUrl = (string) ($record['sourceUrl'] ?? '');
    if ($sourceUrl !== '' && preg_match('/F\.html$/i', $sourceUrl)) {
        return true;
    }

    $summaryText = implode(' ', array_filter([
        (string) ($record['area'] ?? ''),
        (string) ($record['epicenter'] ?? ''),
    ]));

    if (hv_mentions_western_visayas($summaryText)) {
        return true;
    }

    $coords = $record['coords'] ?? null;
    return is_array($coords)
        && count($coords) === 2
        && is_finite((float) $coords[0])
        && is_finite((float) $coords[1])
        && hv_is_near_western_visayas([(float) $coords[0], (float) $coords[1]]);
}

function hv_is_western_visayas_relevant(array $record): bool
{
    $combinedText = implode(' ', array_filter([
        (string) ($record['area'] ?? ''),
        (string) ($record['epicenter'] ?? ''),
        (string) ($record['intensity'] ?? ''),
        (string) ($record['note'] ?? ''),
    ]));

    if (hv_mentions_western_visayas($combinedText)) {
        return true;
    }

    $coords = $record['coords'] ?? null;
    if (is_array($coords) && count($coords) === 2 && is_finite((float) $coords[0]) && is_finite((float) $coords[1])) {
        return hv_is_near_western_visayas([(float) $coords[0], (float) $coords[1]]);
    }

    return false;
}

function hv_parse_detail_fields(string $html): array
{
    $detailText = hv_clean_text($html);
    $dateTime = hv_extract_inline_after_comment($html, '2 DateTime-Data');
    $epicenter = hv_extract_inline_after_comment($html, '3 Location-Data');
    $depth = hv_extract_inline_after_comment($html, '4 Depth-Data');
    $origin = hv_extract_inline_after_comment($html, '5 Origin-Data');
    $magnitude = hv_extract_inline_after_comment($html, '6 Magnitude-Data');
    $intensity = hv_extract_between_comments($html, '7 Intensity-Data', 'End Intensities-Data');
    $damage = hv_extract_inline_after_comment($html, '8 Damage-Data');
    $aftershocks = hv_extract_inline_after_comment($html, '9 Aftershock-Data');
    $note = '';

    if (preg_match('/This is an aftershock[^.]*earthquake\.?/i', $detailText, $aftershockMatch)) {
        $note = hv_clean_text($aftershockMatch[0]);
    }

    $intensity = trim((string) (preg_replace('/^Reported\s+Intensities\s*:\s*/i', '', $intensity) ?? $intensity));
    if ($intensity === '' || preg_match('/^(expecting|damage|no\b|issued\b)/i', $intensity)) {
        $intensity = 'Not stated';
    }

    $highestIntensity = hv_extract_highest_intensity($intensity);
    $tsunamiFlag = hv_parse_tsunami_flag($detailText);
    $tsunamiHeight = hv_extract_tsunami_height($detailText);

    return [
        'reportedAt' => $dateTime,
        'epicenter' => $epicenter,
        'depth' => $depth,
        'origin' => $origin,
        'magnitude' => $magnitude,
        'intensity' => $intensity,
        'highestIntensity' => $highestIntensity['roman'],
        'intensityValue' => $highestIntensity['value'],
        'damageExpected' => hv_is_yes_value($damage),
        'aftershocksExpected' => hv_is_yes_value($aftershocks),
        'tsunami' => $tsunamiFlag,
        'tsunamiHeight' => $tsunamiHeight,
        'note' => $note,
    ];
}

function hv_parse_homepage_rows(string $html, int $limit): array
{
    $previousLibxml = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $loaded = @$dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
    libxml_clear_errors();
    libxml_use_internal_errors($previousLibxml);

    if (!$loaded) {
        throw new RuntimeException('Could not parse the PHIVOLCS earthquake page.');
    }

    $xpath = new DOMXPath($dom);
    $rows = $xpath->query('//tr');
    $records = [];
    $cutoff = new DateTimeImmutable('-72 hours', new DateTimeZone('Asia/Manila'));

    foreach ($rows as $row) {
        $cells = $xpath->query('./td', $row);
        if (!$cells || $cells->length < 6) {
            continue;
        }

        $dateTime = hv_clean_text($dom->saveHTML($cells->item(0)) ?: '');
        if (!preg_match('/\d{2}\s+[A-Za-z]+\s+\d{4}\s*-\s*\d{2}:\d{2}/', $dateTime)) {
            continue;
        }

        $dateTimeObj = hv_parse_bulletin_datetime($dateTime);
        if (!$dateTimeObj instanceof DateTimeImmutable) {
            continue;
        }
        if ($dateTimeObj < $cutoff) {
            break;
        }

        $lat = hv_parse_lat_lon($cells->item(1)->textContent ?? '');
        $lng = hv_parse_lat_lon($cells->item(2)->textContent ?? '');
        if ($lat === null || $lng === null) {
            continue;
        }

        $depth = hv_clean_text($dom->saveHTML($cells->item(3)) ?: '');
        $magText = hv_clean_text($dom->saveHTML($cells->item(4)) ?: '');
        $location = hv_clean_text($dom->saveHTML($cells->item(5)) ?: '');
        $linkNode = $xpath->query('.//a[@href]', $cells->item(0))->item(0);
        $detailUrl = $linkNode instanceof DOMElement ? hv_make_absolute_url('https://earthquake.phivolcs.dost.gov.ph', $linkNode->getAttribute('href')) : '';

        preg_match('/\d+(?:\.\d+)?/', $magText, $magMatch);
        $magnitudeValue = isset($magMatch[0]) ? (float) $magMatch[0] : null;

        $records[] = [
            'id' => 'phivolcs-eq-' . md5($dateTime . '|' . $lat . '|' . $lng . '|' . $location),
            'type' => 'earthquake',
            'name' => 'PHIVOLCS Earthquake' . ($magnitudeValue !== null ? ' M' . number_format($magnitudeValue, 1) : ''),
            'area' => $location,
            'coords' => [$lat, $lng],
            'severity' => hv_detect_severity($magnitudeValue),
            'reportedAt' => $dateTimeObj->format('d M Y - h:i A'),
            'timestamp' => $dateTimeObj->getTimestamp(),
            'epicenter' => $location,
            'depth' => $depth !== '' ? ((string) ((int) $depth) . ' km') : '',
            'magnitude' => $magText !== '' ? ('M ' . $magText) : ($magnitudeValue !== null ? 'M ' . number_format($magnitudeValue, 1) : ''),
            'magnitudeValue' => $magnitudeValue,
            'intensity' => 'Not stated',
            'highestIntensity' => 'Not stated',
            'intensityValue' => 0,
            'damageExpected' => false,
            'aftershocksExpected' => false,
            'tsunami' => 'No',
            'tsunamiHeight' => null,
            'origin' => '',
            'note' => '',
            'source' => 'PHIVOLCS',
            'sourceUrl' => $detailUrl,
        ];

        if (count($records) >= $limit) {
            break;
        }
    }

    return $records;
}

$limit = max(1, min(20, (int) ($_GET['limit'] ?? 12)));
$forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
$cacheFile = __DIR__ . '/../cache/phivolcs_earthquake_latest.json';
$cacheTtlSeconds = 300;

if (!$forceRefresh && is_file($cacheFile) && (time() - (int) filemtime($cacheFile) < $cacheTtlSeconds)) {
    $cached = file_get_contents($cacheFile);
    if (is_string($cached) && $cached !== '') {
        echo $cached;
        exit;
    }
}

try {
    $homepageHtml = hv_fetch_remote_html('https://earthquake.phivolcs.dost.gov.ph/');
    $records = hv_parse_homepage_rows($homepageHtml, 250);
    $records = array_values(array_filter($records, 'hv_should_fetch_detail_for_western_visayas'));
    usort($records, static function (array $a, array $b): int {
        return (int) ($b['timestamp'] ?? 0) <=> (int) ($a['timestamp'] ?? 0);
    });
    $records = array_slice($records, 0, max($limit * 4, 24));

    foreach ($records as &$record) {
        if (($record['sourceUrl'] ?? '') === '') {
            continue;
        }
        try {
            $detailHtml = hv_fetch_remote_html((string) $record['sourceUrl']);
            $detail = hv_parse_detail_fields($detailHtml);
            if (!empty($detail['reportedAt']) && !preg_match('/\b(Location|Origin|Magnitude)\b/i', $detail['reportedAt'])) $record['reportedAt'] = $detail['reportedAt'];
            if (!empty($detail['epicenter']) && !preg_match('/\b(Location|Origin|Magnitude)\b/i', $detail['epicenter'])) $record['epicenter'] = $detail['epicenter'];
            if (!empty($detail['depth'])) {
                $depthValue = (int) preg_replace('/[^0-9]/', '', (string) $detail['depth']);
                $record['depth'] = $depthValue > 0 ? ($depthValue . ' km') : $record['depth'];
            }
            if (!empty($detail['origin'])) $record['origin'] = $detail['origin'];
            if (!empty($detail['magnitude'])) $record['magnitude'] = preg_replace('/^Ms\s*/i', 'M ', $detail['magnitude']) ?? $detail['magnitude'];
            if (!empty($detail['intensity'])) $record['intensity'] = $detail['intensity'];
            if (!empty($detail['highestIntensity'])) $record['highestIntensity'] = $detail['highestIntensity'];
            if (isset($detail['intensityValue'])) $record['intensityValue'] = (int) $detail['intensityValue'];
            $record['damageExpected'] = !empty($detail['damageExpected']);
            $record['aftershocksExpected'] = !empty($detail['aftershocksExpected']);
            if (!empty($detail['tsunami'])) $record['tsunami'] = $detail['tsunami'];
            if (!empty($detail['tsunamiHeight'])) $record['tsunamiHeight'] = $detail['tsunamiHeight'];
            if (!empty($detail['note'])) $record['note'] = $detail['note'];
        } catch (Throwable $detailError) {
            // Keep the homepage data if the detail page is temporarily unavailable.
        }
    }
    unset($record);

    $records = array_values(array_filter($records, 'hv_is_western_visayas_relevant'));
    usort($records, static function (array $a, array $b): int {
        return (int) ($b['timestamp'] ?? 0) <=> (int) ($a['timestamp'] ?? 0);
    });
    $records = array_slice($records, 0, $limit);

    $payload = [
        'ok' => true,
        'count' => count($records),
        'source' => 'PHIVOLCS Latest Earthquake Information (Western Visayas relevant, last 72 hours)',
        'updatedAt' => gmdate('c'),
        'earthquakes' => $records,
    ];

    @file_put_contents($cacheFile, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    hv_json($payload);
} catch (Throwable $e) {
    if (is_file($cacheFile)) {
        $cached = file_get_contents($cacheFile);
        if (is_string($cached) && $cached !== '') {
            echo $cached;
            exit;
        }
    }

    hv_json([
        'ok' => false,
        'message' => 'Could not load PHIVOLCS earthquake records.',
        'error' => $e->getMessage(),
    ], 500);
}
