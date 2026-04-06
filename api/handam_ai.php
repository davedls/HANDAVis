<?php
header('Content-Type: application/json; charset=utf-8');

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_text($value): string
{
    return trim((string) $value);
}

function load_optional_config(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $file = __DIR__ . '/../includes/openai_config.php';
    if (!is_file($file)) {
        return;
    }

    $config = require $file;

    if (isset($OPENAI_API_KEY) && is_string($OPENAI_API_KEY) && trim($OPENAI_API_KEY) !== '') {
        $GLOBALS['OPENAI_API_KEY'] = trim($OPENAI_API_KEY);
    }

    if (isset($HANDAM_OPENAI_MODEL) && is_string($HANDAM_OPENAI_MODEL) && trim($HANDAM_OPENAI_MODEL) !== '') {
        $GLOBALS['HANDAM_OPENAI_MODEL'] = trim($HANDAM_OPENAI_MODEL);
    }

    if (is_array($config)) {
        if (!empty($config['api_key']) && is_string($config['api_key'])) {
            $GLOBALS['OPENAI_API_KEY'] = trim($config['api_key']);
        }

        if (!empty($config['model']) && is_string($config['model'])) {
            $GLOBALS['HANDAM_OPENAI_MODEL'] = trim($config['model']);
        }
    }
}

function hv_contains_text(string $haystack, string $needle): bool
{
    return $needle !== '' && strpos($haystack, $needle) !== false;
}

function is_placeholder_openai_key(?string $value): bool
{
    $value = strtolower(trim((string)$value));
    if ($value === '') {
        return true;
    }

    return hv_contains_text($value, 'paste_your_openai_api_key_here')
        || hv_contains_text($value, 'paste-your-openai-api-key-here')
        || hv_contains_text($value, 'your-openai-api-key')
        || hv_contains_text($value, 'your_openai_api_key');
}

function get_openai_key(): ?string
{
    load_optional_config();

    $candidates = [
        getenv('OPENAI_API_KEY'),
        $_ENV['OPENAI_API_KEY'] ?? null,
        $GLOBALS['OPENAI_API_KEY'] ?? null,
        defined('OPENAI_API_KEY') ? OPENAI_API_KEY : null,
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '' && !is_placeholder_openai_key($candidate)) {
            return trim($candidate);
        }
    }

    return null;
}

function get_preferred_model(): ?string
{
    load_optional_config();

    $candidates = [
        getenv('HANDAM_OPENAI_MODEL'),
        $_ENV['HANDAM_OPENAI_MODEL'] ?? null,
        $GLOBALS['HANDAM_OPENAI_MODEL'] ?? null,
        defined('HANDAM_OPENAI_MODEL') ? HANDAM_OPENAI_MODEL : null,
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }

    return null;
}

function normalize_history($history): array
{
    if (!is_array($history)) {
        return [];
    }

    $normalized = [];

    foreach ($history as $item) {
        if (!is_array($item)) {
            continue;
        }

        $role = $item['role'] ?? 'user';
        $content = clean_text($item['content'] ?? '');

        if ($content === '') {
            continue;
        }

        if (!in_array($role, ['user', 'assistant'], true)) {
            $role = 'user';
        }

        $normalized[] = [
            'role' => $role,
            'content' => $content,
        ];
    }

    return array_slice($normalized, -22);
}

function normalize_language(string $value): string
{
    $value = strtolower(trim($value));
    $allowed = ['auto', 'en', 'tl', 'hil', 'ceb'];
    return in_array($value, $allowed, true) ? $value : 'auto';
}

function normalize_coords(?array $coords): ?array
{
    if (!is_array($coords)) {
        return null;
    }

    if (isset($coords['lat'], $coords['lng']) && is_numeric($coords['lat']) && is_numeric($coords['lng'])) {
        return [(float)$coords['lat'], (float)$coords['lng']];
    }

    if (isset($coords[0], $coords[1]) && is_numeric($coords[0]) && is_numeric($coords[1])) {
        return [(float)$coords[0], (float)$coords[1]];
    }

    return null;
}

function haversine_km(?array $from, ?array $to): ?float
{
    $fromCoords = normalize_coords($from);
    $toCoords = normalize_coords($to);
    if ($fromCoords === null || $toCoords === null) {
        return null;
    }

    $earthRadius = 6371;
    $dLat = deg2rad($toCoords[0] - $fromCoords[0]);
    $dLng = deg2rad($toCoords[1] - $fromCoords[1]);
    $a = sin($dLat / 2) * sin($dLat / 2)
        + cos(deg2rad($fromCoords[0])) * cos(deg2rad($toCoords[0]))
        * sin($dLng / 2) * sin($dLng / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

    return $earthRadius * $c;
}

function build_portal_context(?array $location, string $message = ''): array
{
    $locationCoords = normalize_coords($location);
    $messageLower = strtolower($message);

    $allShelters = [
        ['id' => 'bac-man-crt', 'name' => 'Mandalagan Covered Court', 'city' => 'Bacolod City', 'barangay' => 'Mandalagan', 'coords' => [10.6983, 122.9611], 'capacity_percent' => 62],
        ['id' => 'bac-b30-hal', 'name' => 'Barangay 30 Multi-Purpose Hall', 'city' => 'Bacolod City', 'barangay' => 'Barangay 30', 'coords' => [10.6698, 122.9621], 'capacity_percent' => 58],
        ['id' => 'bac-tac-gym', 'name' => 'Taculing Gymnasium', 'city' => 'Bacolod City', 'barangay' => 'Taculing', 'coords' => [10.6496, 122.9475], 'capacity_percent' => 45],
        ['id' => 'ilo-sooc-evac', 'name' => 'Regional Evacuation Center - Barangay Sooc', 'city' => 'Iloilo City', 'barangay' => 'Sooc', 'coords' => [10.7100, 122.5450], 'capacity_percent' => 500],
        ['id' => 'ilo-molo-multi', 'name' => 'Evacuation / Multi-Purpose Hall - Barangay San Juan (Molo)', 'city' => 'Iloilo City', 'barangay' => 'San Juan, Molo', 'coords' => [10.7090, 122.5545], 'capacity_percent' => 200],
        ['id' => 'ilo-arevalo-hall', 'name' => 'Covered Court Evacuation Site - Barangay Sto. Niño Sur (Arevalo)', 'city' => 'Iloilo City', 'barangay' => 'Sto. Niño Sur, Arevalo', 'coords' => [10.7080, 122.5440], 'capacity_percent' => 180],
        ['id' => 'hin-evac-ctr', 'name' => 'Hinigaran Disaster Evacuation Center', 'city' => 'Hinigaran', 'barangay' => 'Poblacion', 'coords' => [10.2678, 122.8502], 'capacity_percent' => 150],
        ['id' => 'hin-pub-plz', 'name' => 'Hinigaran Public Plaza Gym', 'city' => 'Hinigaran', 'barangay' => 'Town Proper', 'coords' => [10.2694, 122.8485], 'capacity_percent' => 90],
        ['id' => 'hin-esp-hall', 'name' => 'Esperanza Multi-Purpose Hall', 'city' => 'Hinigaran', 'barangay' => 'Esperanza', 'coords' => [10.2541, 122.8612], 'capacity_percent' => 40],
        ['id' => 'bago-comm-center', 'name' => 'Bago City Community Center', 'city' => 'Bago City', 'barangay' => 'Poblacion', 'coords' => [10.5385, 122.8408], 'capacity_percent' => 200],
    ];

    $knownAreas = [
        ['name' => 'Barangay Tangub, Bacolod City', 'city' => 'Bacolod City', 'aliases' => ['barangay tangub', 'brgy tangub', 'tangub'], 'coords' => [10.7085, 122.9512]],
        ['name' => 'Bacolod City', 'city' => 'Bacolod City', 'aliases' => ['bacolod', 'mandalagan', 'taculing'], 'coords' => [10.6765, 122.9509]],
        ['name' => 'Iloilo City', 'city' => 'Iloilo City', 'aliases' => ['iloilo city', 'iloilo', 'sooc', 'molo', 'arevalo'], 'coords' => [10.7202, 122.5621]],
        ['name' => 'Hinigaran', 'city' => 'Hinigaran', 'aliases' => ['hinigaran', 'esperanza'], 'coords' => [10.2678, 122.8502]],
        ['name' => 'Bago City', 'city' => 'Bago City', 'aliases' => ['bago city', 'bago'], 'coords' => [10.5385, 122.8408]],
    ];

    $focusArea = null;
    foreach ($knownAreas as $area) {
        foreach ($area['aliases'] as $alias) {
            if ($alias !== '' && strpos($messageLower, $alias) !== false) {
                $focusArea = $area;
                break 2;
            }
        }
    }

    if ($focusArea === null && $locationCoords !== null) {
        $nearestArea = null;
        $nearestDistance = null;
        foreach ($knownAreas as $area) {
            $distance = haversine_km($locationCoords, $area['coords']);
            if ($distance === null) {
                continue;
            }
            if ($nearestDistance === null || $distance < $nearestDistance) {
                $nearestDistance = $distance;
                $nearestArea = $area;
            }
        }
        $focusArea = $nearestArea;
    }

    $relevantShelters = $allShelters;
    if ($focusArea !== null && !empty($focusArea['city'])) {
        $relevantShelters = array_values(array_filter($allShelters, static function (array $shelter) use ($focusArea): bool {
            return strcasecmp((string)$shelter['city'], (string)$focusArea['city']) === 0;
        }));
    }

    $originCoords = $locationCoords;
    if ($originCoords === null && $focusArea !== null) {
        $originCoords = $focusArea['coords'];
    }

    foreach ($relevantShelters as &$shelter) {
        $distance = haversine_km($originCoords, $shelter['coords']);
        if ($distance !== null) {
            $shelter['distance_km'] = round($distance, 1);
        }
    }
    unset($shelter);

    usort($relevantShelters, static function (array $a, array $b): int {
        $distanceA = $a['distance_km'] ?? 999999;
        $distanceB = $b['distance_km'] ?? 999999;
        if ($distanceA === $distanceB) {
            return strcasecmp((string)$a['name'], (string)$b['name']);
        }
        return $distanceA <=> $distanceB;
    });

    $nearbyHazards = [];
    if ($focusArea !== null && stripos((string)$focusArea['name'], 'Tangub') !== false) {
        $nearbyHazards[] = [
            'type' => 'flood',
            'area' => 'Barangay Tangub, Bacolod City',
            'status' => 'Portal map currently flags elevated flood concern in Tangub.',
        ];
    }

    return [
        'location' => $location,
        'focus_area' => $focusArea,
        'active_alerts' => [],
        'nearby_hazards' => $nearbyHazards,
        'shelters' => array_slice($relevantShelters, 0, 5),
        'suggested_shelter' => $relevantShelters[0] ?? null,
        'emergency_contacts' => [],
        'data_notes' => [
            'Shelter distances are estimated from the current HANDAVis map dataset.',
            'If the user shares a more exact location or enables device location, prefer the nearest mapped shelter in the context.',
        ],
    ];
}

function language_label(string $language): string
{
    $labels = [
        'auto' => 'Auto',
        'en' => 'English',
        'tl' => 'Tagalog',
        'hil' => 'Hiligaynon',
        'ceb' => 'Cebuano',
    ];

    return $labels[$language] ?? 'Auto';
}

function can_connect_to_host(string $host, int $port = 443, int $timeout = 5): bool
{
    $errno = 0;
    $errstr = '';
    $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);
    if ($socket === false) {
        return false;
    }

    fclose($socket);
    return true;
}

function build_diagnostic_report(): array
{
    $configPath = __DIR__ . '/../includes/openai_config.php';
    $resolvedHost = gethostbyname('api.openai.com');

    return [
        'ok' => true,
        'php_version' => PHP_VERSION,
        'curl_enabled' => function_exists('curl_init'),
        'config_file_found' => is_file($configPath),
        'api_key_configured' => get_openai_key() !== null,
        'preferred_model' => get_preferred_model() ?: null,
        'openai_dns_resolves' => $resolvedHost !== 'api.openai.com',
        'openai_socket_reachable' => can_connect_to_host('api.openai.com', 443),
    ];
}

function run_openai_self_test(): array
{
    $apiKey = get_openai_key();
    if (!$apiKey) {
        return [
            'ok' => false,
            'error' => 'OpenAI API key is not configured on the server.',
        ];
    }

    $preferredModel = get_preferred_model();
    $modelCandidates = [];
    if ($preferredModel) {
        $modelCandidates[] = $preferredModel;
    }
    $modelCandidates[] = 'gpt-4.1-mini';
    $modelCandidates[] = 'gpt-4o-mini';
    $modelCandidates[] = 'gpt-5.4';
    $modelCandidates[] = 'gpt-5.4-mini';
    $modelCandidates = array_values(array_unique($modelCandidates));

    $instructions = 'You are HANDAm. Reply briefly with the exact text: CONNECTION_OK';
    $input = 'Reply with CONNECTION_OK only.';

    $attempts = [];
    foreach ($modelCandidates as $model) {
        $result = call_openai_responses($apiKey, $model, $instructions, $input);
        $attempts[] = [
            'model' => $model,
            'ok' => (bool)($result['ok'] ?? false),
            'http_code' => (int)($result['http_code'] ?? 200),
            'error' => $result['error'] ?? null,
            'details' => $result['details'] ?? null,
            'reply' => $result['reply'] ?? null,
        ];

        if (($result['ok'] ?? false) === true) {
            return [
                'ok' => true,
                'model_used' => $model,
                'reply' => $result['reply'] ?? '',
                'attempts' => $attempts,
            ];
        }
    }

    return [
        'ok' => false,
        'error' => 'All OpenAI self-test attempts failed.',
        'attempts' => $attempts,
    ];
}

function build_input(string $message, array $history, string $preferredLanguage, string $detectedLanguage, array $portalContext): string
{
    $historyText = "";
    foreach ($history as $item) {
        $speaker = $item['role'] === 'assistant' ? 'HANDAm' : 'User';
        $historyText .= $speaker . ': ' . $item['content'] . "\n";
    }

    $portalContextJson = json_encode($portalContext, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    return <<<TEXT
Conversation memory:
{$historyText}

Preferred language setting: {$preferredLanguage}
Detected language hint for latest message: {$detectedLanguage}

Latest user message:
{$message}

Portal context:
{$portalContextJson}
TEXT;
}

function extract_reply_text(array $decoded): string
{
    $reply = '';

    if (!empty($decoded['output']) && is_array($decoded['output'])) {
        foreach ($decoded['output'] as $outputItem) {
            if (($outputItem['type'] ?? '') !== 'message') {
                continue;
            }

            if (!empty($outputItem['content']) && is_array($outputItem['content'])) {
                foreach ($outputItem['content'] as $contentItem) {
                    if (($contentItem['type'] ?? '') === 'output_text') {
                        $reply .= $contentItem['text'] ?? '';
                    }
                }
            }
        }
    }

    return trim($reply);
}

function call_openai_responses(string $apiKey, string $model, string $instructions, string $input): array
{
    if (!function_exists('curl_init')) {
        return [
            'ok' => false,
            'http_code' => 500,
            'error' => 'PHP cURL extension is not enabled on the server.',
            'details' => null,
        ];
    }

    $requestBody = [
        'model' => $model,
        'instructions' => $instructions,
        'input' => $input,
        'max_output_tokens' => 420,
        'truncation' => 'auto',
    ];

    $ch = curl_init('https://api.openai.com/v1/responses');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($requestBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 40,
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false) {
        return [
            'ok' => false,
            'http_code' => 502,
            'error' => 'Could not contact the OpenAI API.',
            'details' => $curlError,
        ];
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        return [
            'ok' => false,
            'http_code' => 502,
            'error' => 'Invalid API response.',
            'details' => $response,
        ];
    }

    if ($httpCode >= 400) {
        return [
            'ok' => false,
            'http_code' => $httpCode,
            'error' => 'OpenAI API error.',
            'details' => $decoded,
        ];
    }

    $reply = extract_reply_text($decoded);
    if ($reply === '') {
        return [
            'ok' => false,
            'http_code' => 502,
            'error' => 'The model returned an empty reply.',
            'details' => $decoded,
        ];
    }

    return [
        'ok' => true,
        'reply' => $reply,
        'raw' => $decoded,
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    if (($_GET['diagnostic'] ?? '') === '1') {
        respond(build_diagnostic_report());
    }

    if (($_GET['self_test'] ?? '') === '1') {
        respond(run_openai_self_test());
    }

    respond([
        'ok' => true,
        'message' => 'Use POST for AI chat requests, GET ?diagnostic=1 for connection checks, or GET ?self_test=1 for a live OpenAI test.',
    ]);
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    respond(['error' => 'Invalid JSON body.'], 400);
}

$message = clean_text($payload['message'] ?? '');
$history = normalize_history($payload['history'] ?? []);
$preferredLanguage = normalize_language((string) ($payload['preferred_language'] ?? 'auto'));
$detectedLanguage = normalize_language((string) ($payload['detected_language'] ?? 'auto'));
$location = is_array($payload['location'] ?? null) ? $payload['location'] : null;

if ($message === '') {
    respond(['error' => 'Message is required.'], 400);
}

$apiKey = get_openai_key();
if (!$apiKey) {
    respond([
        'error' => 'OpenAI API key is not configured on the server. Set OPENAI_API_KEY in the server environment or in the local gitignored includes/openai_config.php file.',
    ], 500);
}

$portalContext = build_portal_context($location, $message);
$input = build_input($message, $history, language_label($preferredLanguage), language_label($detectedLanguage), $portalContext);

$instructions = <<<TEXT
You are HANDAm, the conversational AI assistant of HANDAVis.

Behavior:
- Converse naturally like a modern chat assistant, not like a rigid keyword bot.
- Avoid repetitive canned intros unless the user explicitly asks who you are.
- Maintain context from prior turns and answer like a real ongoing conversation.
- Greetings, thanks, small talk, clarifying questions, and normal casual conversation are allowed.

Language handling:
- Supported languages: English, Tagalog, Hiligaynon, and Cebuano.
- Understand mixed-language input, informal spelling, slang, and typos.
- If the preferred language is set to a specific language, reply only in that language.
- If the preferred language is Auto, reply in the language that best matches the user's latest message and recent conversation.
- If the user asks you to switch languages, switch immediately and continue naturally in that language.
- Never force English if the user is clearly using Tagalog, Hiligaynon, or Cebuano.

Domain focus:
- Your strongest expertise is disaster preparedness, evacuation, shelters, alerts, routes, safety steps, hotlines, weather risk, and emergency guidance.
- You may still handle simple non-disaster conversation naturally and briefly.
- If the user asks a broad unrelated topic, answer briefly and gently steer back only when appropriate.

Grounding:
- Use the provided portal context for local alerts, shelters, routes, hotlines, and location-aware guidance.
- If `suggested_shelter` or `shelters` is present in the portal context and the user asks for the nearest evacuation center, name the most relevant shelter from that context instead of saying there is no shelter data.
- For nearest-center or evacuation questions, prefer this structure when relevant: (1) nearest mapped center, (2) 1-2 backup options, (3) a short evacuation or safety note, and (4) a brief hazard note if `nearby_hazards` contains flood or similar risk.
- When distances come from the portal context, describe them as estimated or based on the current HANDAVis map dataset.
- Never invent live facts that are missing from portal context.
- If portal context lacks live data, clearly say you are giving general guidance only.
- If the user asks whether there is flooding in their exact area and the portal context has no live flood data, say that you cannot confirm live flood status from the current portal context and then give the safest next steps.

Style:
- Be warm, calm, clear, and helpful.
- Keep answers concise but not robotic.
- For shelter and evacuation answers, prefer short paragraphs or 2-4 easy-to-scan bullets.
- Ask a short follow-up question only when it truly helps.
TEXT;

$preferredModel = get_preferred_model();
$modelCandidates = [];
if ($preferredModel) {
    $modelCandidates[] = $preferredModel;
}
$modelCandidates[] = 'gpt-4.1-mini';
$modelCandidates[] = 'gpt-4o-mini';
$modelCandidates[] = 'gpt-5.4';
$modelCandidates[] = 'gpt-5.4-mini';
$modelCandidates = array_values(array_unique($modelCandidates));

$lastError = null;
$reply = '';
$modelUsed = null;

foreach ($modelCandidates as $model) {
    $result = call_openai_responses($apiKey, $model, $instructions, $input);
    if ($result['ok'] === true) {
        $reply = $result['reply'];
        $modelUsed = $model;
        break;
    }

    $lastError = $result;

    $detailsJson = json_encode($result['details'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (is_string($detailsJson) && stripos($detailsJson, 'model') !== false && stripos($detailsJson, 'not found') !== false) {
        continue;
    }

    if (($result['http_code'] ?? 0) === 404) {
        continue;
    }

    break;
}

if ($reply === '') {
    error_log('handam_ai failure: ' . json_encode([
        'error' => $lastError['error'] ?? 'Failed to generate a reply.',
        'http_code' => (int)($lastError['http_code'] ?? 502),
        'details' => $lastError['details'] ?? null,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    respond([
        'error' => $lastError['error'] ?? 'Failed to generate a reply.',
        'details' => $lastError['details'] ?? null,
    ], (int) ($lastError['http_code'] ?? 502));
}

respond([
    'reply' => $reply,
    'language_used' => $preferredLanguage === 'auto' ? $detectedLanguage : $preferredLanguage,
    'model_used' => $modelUsed,
]);
