<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function hv_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hv_require_session_user_id(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }

    foreach (['user_id', 'id', 'uid'] as $key) {
        if (isset($_SESSION[$key]) && is_numeric($_SESSION[$key])) {
            return (int)$_SESSION[$key];
        }
    }

    hv_json(['ok' => false, 'message' => 'No logged-in user session was found.'], 401);
}

function hv_bootstrap_pdo(): PDO
{
    $candidates = [
        __DIR__ . '/../includes/config.php',
        __DIR__ . '/../database/config.php',
        __DIR__ . '/../database/connection.php',
        __DIR__ . '/../database/db_connection.php',
        __DIR__ . '/../config.php',
        __DIR__ . '/../HANDAVis/database/config.php',
        __DIR__ . '/../HANDAVis/database/db_connection.php',
    ];

    foreach ($candidates as $file) {
        if (file_exists($file)) {
            require_once $file;
        }
    }

    foreach (['pdo', 'db', 'database', 'conn'] as $globalName) {
        if (isset($GLOBALS[$globalName]) && $GLOBALS[$globalName] instanceof PDO) {
            return $GLOBALS[$globalName];
        }
    }

    if (function_exists('getPDO')) {
        $pdo = getPDO();
        if ($pdo instanceof PDO) {
            return $pdo;
        }
    }

    if (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
        $dbHost = (string)($GLOBALS['db_host'] ?? 'localhost');
        $dbName = (string)($GLOBALS['db_name'] ?? '');
        $dbUser = (string)($GLOBALS['db_user'] ?? '');
        $dbPass = (string)($GLOBALS['db_pass'] ?? '');
        $dbPort = (int)($GLOBALS['db_port'] ?? 3306);

        if ($dbName !== '' && $dbUser !== '') {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
            return new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }
    }

    hv_json([
        'ok' => false,
        'message' => 'Database connection not found. Update process/safety_circle_api.php so it includes your real PDO or mysqli connection file.'
    ], 500);
}

function hv_ensure_schema(PDO $pdo): void
{
    $queries = [
        <<<SQL
CREATE TABLE IF NOT EXISTS safety_circle_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  member_user_id INT UNSIGNED NOT NULL,
  relation_label VARCHAR(120) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner_member (owner_user_id, member_user_id),
  KEY idx_owner_user_id (owner_user_id),
  KEY idx_member_user_id (member_user_id)
)
SQL,
        <<<SQL
CREATE TABLE IF NOT EXISTS safety_circle_status (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  status ENUM('watch','safe','help','sos') NOT NULL DEFAULT 'watch',
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
SQL,
        <<<SQL
CREATE TABLE IF NOT EXISTS safety_circle_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sender_user_id INT UNSIGNED NOT NULL,
  receiver_user_id INT UNSIGNED NOT NULL,
  alert_type ENUM('safe','help','sos','ping') NOT NULL,
  message VARCHAR(255) NOT NULL,
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_receiver_unread (receiver_user_id, is_read, id),
  KEY idx_sender (sender_user_id),
  KEY idx_created_at (created_at)
)
SQL,
        <<<SQL
CREATE TABLE IF NOT EXISTS safety_circle_places (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  radius_meters INT UNSIGNED NOT NULL DEFAULT 250,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_owner_place (owner_user_id, created_at)
)
SQL,
        <<<SQL
CREATE TABLE IF NOT EXISTS safety_circle_location_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  event_type ENUM('location_update','arrival','departure','status_update','place_saved') NOT NULL DEFAULT 'location_update',
  status ENUM('watch','safe','help','sos') NOT NULL DEFAULT 'watch',
  place_label VARCHAR(120) DEFAULT NULL,
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  speed_kmh DECIMAL(8,2) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_history (user_id, created_at),
  KEY idx_event_history (event_type, created_at)
)
SQL,
    ];

    foreach ($queries as $query) {
        $pdo->exec($query);
    }

    foreach ([
        'ALTER TABLE safety_circle_status ADD COLUMN battery_level TINYINT UNSIGNED NULL AFTER lng',
        'ALTER TABLE safety_circle_status ADD COLUMN is_charging TINYINT(1) NOT NULL DEFAULT 0 AFTER battery_level',
        'ALTER TABLE safety_circle_status ADD COLUMN accuracy_meters DECIMAL(8,2) NULL AFTER is_charging'
    ] as $alterSql) {
        try {
            $pdo->exec($alterSql);
        } catch (Throwable $e) {
            // Ignore duplicate-column errors so the API stays compatible with existing installs.
        }
    }
}

function hv_decode_json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function hv_row_coords(?float $lat, ?float $lng): ?array
{
    if ($lat === null || $lng === null) {
        return null;
    }

    return [$lat, $lng];
}

function hv_relative_time(?string $timestamp): string
{
    if (!$timestamp) return 'Just now';
    $then = strtotime($timestamp);
    if (!$then) return 'Just now';

    $diff = max(0, time() - $then);
    if ($diff < 45) return 'Just now';
    if ($diff < 3600) return floor($diff / 60) . ' min ago';
    if ($diff < 86400) return floor($diff / 3600) . ' hr ago';
    return floor($diff / 86400) . ' day ago';
}

function hv_fetch_members(PDO $pdo, int $userId): array
{
    $sql = <<<SQL
SELECT
    c.user_id,
    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, CONCAT('User #', c.user_id)) AS name,
    COALESCE(NULLIF(c.relation_label, ''), 'Safety Circle member') AS relation,
    COALESCE(u.email, '') AS email,
    s.status,
    s.lat,
    s.lng,
    s.battery_level,
    s.is_charging,
    s.accuracy_meters,
    s.updated_at,
    (
        SELECT h.speed_kmh
        FROM safety_circle_location_history h
        WHERE h.user_id = c.user_id
        ORDER BY h.id DESC
        LIMIT 1
    ) AS speed_kmh
FROM (
    SELECT m.member_user_id AS user_id,
           COALESCE(NULLIF(m.relation_label, ''), 'Safety Circle member') AS relation_label
    FROM safety_circle_members m
    WHERE m.owner_user_id = :owner_user_id
      AND m.is_active = 1

    UNION

    SELECT m.owner_user_id AS user_id,
           'Connected with you' AS relation_label
    FROM safety_circle_members m
    WHERE m.member_user_id = :member_user_id
      AND m.is_active = 1
) c
JOIN users u ON u.id = c.user_id
LEFT JOIN safety_circle_status s ON s.user_id = c.user_id
WHERE c.user_id <> :self_user_id
ORDER BY name ASC
SQL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'owner_user_id' => $userId,
        'member_user_id' => $userId,
        'self_user_id' => $userId,
    ]);

    $members = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $lat = $row['lat'] !== null ? (float)$row['lat'] : null;
        $lng = $row['lng'] !== null ? (float)$row['lng'] : null;
        $speedKmh = $row['speed_kmh'] !== null ? (float)$row['speed_kmh'] : null;
        $motionStatus = $speedKmh !== null && $speedKmh >= 18 ? 'moving' : 'stationary';
        $batteryLevel = $row['battery_level'] !== null ? (int)$row['battery_level'] : null;
        $isCharging = isset($row['is_charging']) ? (bool)$row['is_charging'] : false;
        $accuracyMeters = $row['accuracy_meters'] !== null ? (float)$row['accuracy_meters'] : null;
        $note = $lat !== null && $lng !== null ? 'Live location shared' : 'Waiting for live location';

        if ($motionStatus === 'moving' && $speedKmh !== null) {
            $note = 'On the move at ' . round($speedKmh) . ' km/h';
        } elseif ($batteryLevel !== null && $batteryLevel <= 20 && !$isCharging) {
            $note = 'Low battery warning';
        }

        $members[] = [
            'user_id' => (int)$row['user_id'],
            'name' => (string)$row['name'],
            'email' => (string)($row['email'] ?? ''),
            'relation' => (string)($row['relation'] ?: 'Safety Circle member'),
            'status' => (string)($row['status'] ?: 'watch'),
            'motion_status' => $motionStatus,
            'lat' => $lat,
            'lng' => $lng,
            'coords' => hv_row_coords($lat, $lng),
            'battery' => $batteryLevel,
            'is_charging' => $isCharging,
            'accuracy_meters' => $accuracyMeters,
            'speed_kmh' => $speedKmh,
            'updated_at' => $row['updated_at'],
            'updated_label' => hv_relative_time($row['updated_at']),
            'note' => $note
        ];
    }

    return $members;
}

function hv_fetch_self(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT user_id, status, lat, lng, battery_level, is_charging, accuracy_meters, updated_at,
                (SELECT h.speed_kmh FROM safety_circle_location_history h WHERE h.user_id = safety_circle_status.user_id ORDER BY h.id DESC LIMIT 1) AS speed_kmh
         FROM safety_circle_status
         WHERE user_id = :user_id
         LIMIT 1'
    );
    $stmt->execute(['user_id' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return [
            'user_id' => $userId,
            'status' => 'watch',
            'coords' => null,
            'updated_at' => null,
        ];
    }

    return [
        'user_id' => (int)$row['user_id'],
        'status' => (string)($row['status'] ?: 'watch'),
        'coords' => hv_row_coords($row['lat'] !== null ? (float)$row['lat'] : null, $row['lng'] !== null ? (float)$row['lng'] : null),
        'battery' => $row['battery_level'] !== null ? (int)$row['battery_level'] : null,
        'is_charging' => isset($row['is_charging']) ? (bool)$row['is_charging'] : false,
        'accuracy_meters' => $row['accuracy_meters'] !== null ? (float)$row['accuracy_meters'] : null,
        'speed_kmh' => $row['speed_kmh'] !== null ? (float)$row['speed_kmh'] : null,
        'updated_at' => $row['updated_at'],
    ];
}

function hv_fetch_alerts(PDO $pdo, int $userId, int $sinceId = 0): array
{
    $sql = <<<SQL
SELECT
    a.id,
    a.alert_type,
    a.message,
    a.lat,
    a.lng,
    a.created_at,
    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, CONCAT('User #', a.sender_user_id)) AS sender_name
FROM safety_circle_alerts a
JOIN users u ON u.id = a.sender_user_id
WHERE a.receiver_user_id = :receiver_user_id
  AND a.id > :since_id
ORDER BY a.id ASC
SQL;
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'receiver_user_id' => $userId,
        'since_id' => $sinceId,
    ]);

    $alerts = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $alerts[] = [
            'id' => (int)$row['id'],
            'alert_type' => (string)$row['alert_type'],
            'message' => (string)$row['message'],
            'sender_name' => (string)$row['sender_name'],
            'created_at' => (string)$row['created_at'],
            'lat' => $row['lat'] !== null ? (float)$row['lat'] : null,
            'lng' => $row['lng'] !== null ? (float)$row['lng'] : null,
        ];
    }

    return $alerts;
}

function hv_distance_meters(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float
{
    if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) {
        return null;
    }

    $earthRadius = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2
        + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

    return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function hv_fetch_places(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, label, lat, lng, radius_meters, created_at
         FROM safety_circle_places
         WHERE owner_user_id = :owner_user_id
         ORDER BY created_at DESC, id DESC'
    );
    $stmt->execute(['owner_user_id' => $userId]);

    $places = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $places[] = [
            'id' => (int)$row['id'],
            'label' => (string)$row['label'],
            'lat' => (float)$row['lat'],
            'lng' => (float)$row['lng'],
            'radius_meters' => (int)$row['radius_meters'],
            'created_at' => (string)$row['created_at'],
            'created_label' => hv_relative_time((string)$row['created_at']),
        ];
    }

    return $places;
}

function hv_record_location_history(PDO $pdo, int $userId, string $status, ?float $lat, ?float $lng, string $eventType = 'location_update', ?string $placeLabel = null): ?array
{
    $previous = null;

    $previousStmt = $pdo->prepare(
        'SELECT status, lat, lng, created_at
         FROM safety_circle_location_history
         WHERE user_id = :user_id
         ORDER BY id DESC
         LIMIT 1'
    );
    $previousStmt->execute(['user_id' => $userId]);
    $row = $previousStmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $previous = [
            'status' => (string)($row['status'] ?? 'watch'),
            'lat' => $row['lat'] !== null ? (float)$row['lat'] : null,
            'lng' => $row['lng'] !== null ? (float)$row['lng'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
        ];
    }

    $shouldInsert = $eventType !== 'location_update';
    $speedKmh = null;

    if (!$shouldInsert) {
        if (!$previous) {
            $shouldInsert = true;
        } else {
            $prevTime = strtotime((string)$previous['created_at']);
            $seconds = $prevTime ? max(1, time() - $prevTime) : 0;
            $distance = hv_distance_meters($previous['lat'], $previous['lng'], $lat, $lng);
            if ($distance !== null && $seconds > 0) {
                $speedKmh = round(($distance / $seconds) * 3.6, 2);
            }

            $shouldInsert = $previous['status'] !== $status
                || $seconds >= 600
                || ($distance !== null && $distance >= 50);
        }
    }

    if ($shouldInsert) {
        $insertStmt = $pdo->prepare(
            'INSERT INTO safety_circle_location_history (user_id, event_type, status, place_label, lat, lng, speed_kmh, created_at)
             VALUES (:user_id, :event_type, :status, :place_label, :lat, :lng, :speed_kmh, NOW())'
        );
        $insertStmt->execute([
            'user_id' => $userId,
            'event_type' => $eventType,
            'status' => $status,
            'place_label' => $placeLabel,
            'lat' => $lat,
            'lng' => $lng,
            'speed_kmh' => $speedKmh,
        ]);
    }

    return $previous;
}

function hv_handle_place_transitions(PDO $pdo, int $userId, ?array $previous, string $status, ?float $lat, ?float $lng): void
{
    if (!$previous || $lat === null || $lng === null) {
        return;
    }

    $places = hv_fetch_places($pdo, $userId);
    if (!$places) {
        return;
    }

    foreach ($places as $place) {
        $prevDistance = hv_distance_meters($previous['lat'] ?? null, $previous['lng'] ?? null, (float)$place['lat'], (float)$place['lng']);
        $currentDistance = hv_distance_meters($lat, $lng, (float)$place['lat'], (float)$place['lng']);

        if ($prevDistance === null || $currentDistance === null) {
            continue;
        }

        $radius = max(50, (int)($place['radius_meters'] ?? 250));
        $wasInside = $prevDistance <= $radius;
        $isInside = $currentDistance <= $radius;

        if (!$wasInside && $isInside) {
            hv_record_location_history($pdo, $userId, $status, $lat, $lng, 'arrival', (string)$place['label']);
            hv_insert_alerts_for_circle($pdo, $userId, 'ping', $lat, $lng, 'A Safety Circle member arrived at ' . (string)$place['label'] . '.');
        } elseif ($wasInside && !$isInside) {
            hv_record_location_history($pdo, $userId, $status, $lat, $lng, 'departure', (string)$place['label']);
            hv_insert_alerts_for_circle($pdo, $userId, 'ping', $lat, $lng, 'A Safety Circle member left ' . (string)$place['label'] . '.');
        }
    }
}

function hv_fetch_recent_activity(PDO $pdo, int $userId, int $limit = 18): array
{
    $userIds = hv_circle_connected_user_ids($pdo, $userId);
    $userIds[] = $userId;
    $userIds = array_values(array_unique(array_map('intval', $userIds)));
    if (!$userIds) {
        return [];
    }

    $placeholders = [];
    $params = [];
    foreach ($userIds as $index => $memberId) {
        $key = 'user_id_' . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $memberId;
    }

    $limit = max(1, min(30, $limit));
    $sql =
        'SELECT
            h.id,
            h.user_id,
            h.event_type,
            h.status,
            h.place_label,
            h.lat,
            h.lng,
            h.speed_kmh,
            h.created_at,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, ""))), ""), u.email, CONCAT("User #", h.user_id)) AS actor_name
         FROM safety_circle_location_history h
         JOIN users u ON u.id = h.user_id
         WHERE h.user_id IN (' . implode(', ', $placeholders) . ')
         ORDER BY h.created_at DESC
         LIMIT ' . $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $activity = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $eventType = (string)($row['event_type'] ?? 'location_update');
        $status = (string)($row['status'] ?? 'watch');
        $actorName = (string)($row['actor_name'] ?? ('User #' . $row['user_id']));
        $placeLabel = (string)($row['place_label'] ?? '');
        $title = $actorName . ' shared a location update';
        $summary = 'Live location was refreshed.';

        if ($eventType === 'arrival') {
            $title = $actorName . ' arrived at ' . ($placeLabel !== '' ? $placeLabel : 'a saved place');
            $summary = 'Arrival detected inside a saved place.';
        } elseif ($eventType === 'departure') {
            $title = $actorName . ' left ' . ($placeLabel !== '' ? $placeLabel : 'a saved place');
            $summary = 'Departure detected from a saved place.';
        } elseif ($eventType === 'place_saved') {
            $title = $actorName . ' saved ' . ($placeLabel !== '' ? $placeLabel : 'a place');
            $summary = 'Geofence alert is now active for that place.';
        } elseif ($status === 'sos') {
            $title = $actorName . ' activated SOS';
            $summary = 'Urgent help request shared with the circle.';
        } elseif ($status === 'help') {
            $title = $actorName . ' marked Need Help';
            $summary = 'Assistance request sent to the circle.';
        } elseif ($status === 'safe') {
            $title = $actorName . ' checked in as safe';
            $summary = 'Safe check-in update received.';
        } elseif ($row['speed_kmh'] !== null && (float)$row['speed_kmh'] >= 25) {
            $title = $actorName . ' is on the move';
            $summary = 'Movement update recorded at ' . round((float)$row['speed_kmh']) . ' km/h.';
        }

        $activity[] = [
            'id' => (int)$row['id'],
            'user_id' => (int)$row['user_id'],
            'actor_name' => $actorName,
            'event_type' => $eventType,
            'status' => $status,
            'title' => $title,
            'summary' => $summary,
            'place_label' => $placeLabel,
            'speed_kmh' => $row['speed_kmh'] !== null ? (float)$row['speed_kmh'] : null,
            'created_at' => (string)$row['created_at'],
            'created_label' => hv_relative_time((string)$row['created_at']),
            'lat' => $row['lat'] !== null ? (float)$row['lat'] : null,
            'lng' => $row['lng'] !== null ? (float)$row['lng'] : null,
        ];
    }

    return $activity;
}

function hv_circle_connected_user_ids(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        <<<SQL
SELECT related_user_id
FROM (
    SELECT member_user_id AS related_user_id
    FROM safety_circle_members
    WHERE owner_user_id = :owner_user_id
      AND is_active = 1

    UNION

    SELECT owner_user_id AS related_user_id
    FROM safety_circle_members
    WHERE member_user_id = :member_user_id
      AND is_active = 1
) circle_links
WHERE related_user_id <> :self_user_id
SQL
    );

    $stmt->execute([
        'owner_user_id' => $userId,
        'member_user_id' => $userId,
        'self_user_id' => $userId,
    ]);

    return array_values(array_unique(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [])));
}

function hv_is_circle_connected(PDO $pdo, int $userId, int $otherUserId): bool
{
    if ($userId <= 0 || $otherUserId <= 0 || $userId === $otherUserId) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1
         FROM safety_circle_members
         WHERE is_active = 1
           AND ((owner_user_id = :user_id AND member_user_id = :other_user_id)
             OR (owner_user_id = :other_user_id_reverse AND member_user_id = :user_id_reverse))
         LIMIT 1'
    );
    $stmt->execute([
        'user_id' => $userId,
        'other_user_id' => $otherUserId,
        'other_user_id_reverse' => $otherUserId,
        'user_id_reverse' => $userId,
    ]);

    return (bool)$stmt->fetchColumn();
}

function hv_search_circle_candidates(PDO $pdo, int $userId, string $query): array
{
    $query = trim($query);
    if ($query === '') {
        return [];
    }

    $needle = '%' . $query . '%';
    $stmt = $pdo->prepare(
        <<<SQL
SELECT
    u.id AS user_id,
    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, CONCAT('User #', u.id)) AS name,
    COALESCE(u.email, '') AS email,
    EXISTS(
        SELECT 1
        FROM safety_circle_members m
        WHERE m.is_active = 1
          AND ((m.owner_user_id = :viewer_id AND m.member_user_id = u.id)
            OR (m.owner_user_id = u.id AND m.member_user_id = :viewer_id_check))
    ) AS is_connected
FROM users u
WHERE u.id <> :self_user_id
  AND (
      COALESCE(u.first_name, '') LIKE :needle_first
      OR COALESCE(u.last_name, '') LIKE :needle_last
      OR COALESCE(u.email, '') LIKE :needle_email
      OR TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE :needle_name
  )
ORDER BY is_connected DESC, name ASC
LIMIT 12
SQL
    );
    $stmt->execute([
        'viewer_id' => $userId,
        'viewer_id_check' => $userId,
        'self_user_id' => $userId,
        'needle_first' => $needle,
        'needle_last' => $needle,
        'needle_email' => $needle,
        'needle_name' => $needle,
    ]);

    $results = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $results[] = [
            'user_id' => (int)$row['user_id'],
            'name' => (string)$row['name'],
            'email' => (string)($row['email'] ?? ''),
            'is_connected' => (bool)$row['is_connected'],
        ];
    }

    return $results;
}

function hv_insert_alerts_for_circle(PDO $pdo, int $senderUserId, string $alertType, ?float $lat, ?float $lng, string $message): void
{
    $memberIds = hv_circle_connected_user_ids($pdo, $senderUserId);

    if (!$memberIds) {
        return;
    }

    $insertStmt = $pdo->prepare(
        'INSERT INTO safety_circle_alerts (sender_user_id, receiver_user_id, alert_type, message, lat, lng, is_read, created_at)
         VALUES (:sender_user_id, :receiver_user_id, :alert_type, :message, :lat, :lng, 0, NOW())'
    );

    foreach ($memberIds as $memberUserId) {
        $insertStmt->execute([
            'sender_user_id' => $senderUserId,
            'receiver_user_id' => (int)$memberUserId,
            'alert_type' => $alertType,
            'message' => $message,
            'lat' => $lat,
            'lng' => $lng,
        ]);
    }
}

$userId = hv_require_session_user_id();
$pdo = hv_bootstrap_pdo();
hv_ensure_schema($pdo);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$input = $method === 'POST' ? hv_decode_json_input() : [];
$action = $method === 'POST' ? (string)($input['action'] ?? '') : (string)($_GET['action'] ?? 'bootstrap');

try {
    if ($action === 'search-users') {
        $query = trim((string)($_GET['q'] ?? $input['q'] ?? ''));
        hv_json([
            'ok' => true,
            'results' => strlen($query) >= 2 ? hv_search_circle_candidates($pdo, $userId, $query) : [],
        ]);
    }

    if ($action === 'bootstrap') {
        $alerts = hv_fetch_alerts($pdo, $userId, 0);
        $latestAlertId = 0;
        foreach ($alerts as $alert) {
            $latestAlertId = max($latestAlertId, (int)$alert['id']);
        }

        hv_json([
            'ok' => true,
            'self' => hv_fetch_self($pdo, $userId),
            'members' => hv_fetch_members($pdo, $userId),
            'places' => hv_fetch_places($pdo, $userId),
            'recent_activity' => hv_fetch_recent_activity($pdo, $userId),
            'unread_alerts' => $alerts,
            'latest_alert_id' => $latestAlertId,
        ]);
    }

    if ($action === 'poll') {
        $sinceId = isset($_GET['since_id']) ? max(0, (int)$_GET['since_id']) : 0;
        $alerts = hv_fetch_alerts($pdo, $userId, $sinceId);
        $latestAlertId = $sinceId;
        foreach ($alerts as $alert) {
            $latestAlertId = max($latestAlertId, (int)$alert['id']);
        }

        hv_json([
            'ok' => true,
            'self' => hv_fetch_self($pdo, $userId),
            'members' => hv_fetch_members($pdo, $userId),
            'places' => hv_fetch_places($pdo, $userId),
            'recent_activity' => hv_fetch_recent_activity($pdo, $userId),
            'alerts' => $alerts,
            'latest_alert_id' => $latestAlertId,
        ]);
    }

    if ($method !== 'POST') {
        hv_json(['ok' => false, 'message' => 'This action requires POST.'], 405);
    }

    if ($action === 'add-member') {
        $memberUserId = isset($input['member_user_id']) ? (int)$input['member_user_id'] : 0;
        $relation = trim(substr((string)($input['relation'] ?? ''), 0, 120));

        if ($memberUserId <= 0) {
            hv_json(['ok' => false, 'message' => 'Pick a user to add first.'], 422);
        }

        if ($memberUserId === $userId) {
            hv_json(['ok' => false, 'message' => 'You cannot add yourself to your own Safety Circle.'], 422);
        }

        $userCheck = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
        $userCheck->execute(['id' => $memberUserId]);
        if (!$userCheck->fetchColumn()) {
            hv_json(['ok' => false, 'message' => 'That user could not be found.'], 404);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO safety_circle_members (owner_user_id, member_user_id, relation_label, is_active, created_at)
             VALUES (:owner_user_id, :member_user_id, :relation_label, 1, NOW())
             ON DUPLICATE KEY UPDATE relation_label = VALUES(relation_label), is_active = 1'
        );
        $stmt->execute([
            'owner_user_id' => $userId,
            'member_user_id' => $memberUserId,
            'relation_label' => $relation !== '' ? $relation : null,
        ]);

        $alertStmt = $pdo->prepare(
            'INSERT INTO safety_circle_alerts (sender_user_id, receiver_user_id, alert_type, message, is_read, created_at)
             VALUES (:sender_user_id, :receiver_user_id, :alert_type, :message, 0, NOW())'
        );
        $alertStmt->execute([
            'sender_user_id' => $userId,
            'receiver_user_id' => $memberUserId,
            'alert_type' => 'ping',
            'message' => 'You were added to a Safety Circle. Open the map to share your live location and status.',
        ]);

        hv_json([
            'ok' => true,
            'self' => hv_fetch_self($pdo, $userId),
            'members' => hv_fetch_members($pdo, $userId),
        ]);
    }

    if ($action === 'save-place') {
        $label = trim(substr((string)($input['label'] ?? ''), 0, 120));
        $lat = isset($input['lat']) && is_numeric($input['lat']) ? (float)$input['lat'] : null;
        $lng = isset($input['lng']) && is_numeric($input['lng']) ? (float)$input['lng'] : null;
        $radiusMeters = isset($input['radius_meters']) && is_numeric($input['radius_meters']) ? (int)$input['radius_meters'] : 250;
        $radiusMeters = max(100, min(2000, $radiusMeters));

        if ($label === '') {
            hv_json(['ok' => false, 'message' => 'Enter a place label first.'], 422);
        }
        if ($lat === null || $lng === null) {
            hv_json(['ok' => false, 'message' => 'A live location is required to save a place.'], 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO safety_circle_places (owner_user_id, label, lat, lng, radius_meters, created_at)
             VALUES (:owner_user_id, :label, :lat, :lng, :radius_meters, NOW())'
        );
        $stmt->execute([
            'owner_user_id' => $userId,
            'label' => $label,
            'lat' => $lat,
            'lng' => $lng,
            'radius_meters' => $radiusMeters,
        ]);

        hv_record_location_history($pdo, $userId, 'watch', $lat, $lng, 'place_saved', $label);

        hv_json([
            'ok' => true,
            'places' => hv_fetch_places($pdo, $userId),
            'recent_activity' => hv_fetch_recent_activity($pdo, $userId),
        ]);
    }

    if ($action === 'delete-place') {
        $placeId = isset($input['place_id']) ? (int)$input['place_id'] : 0;
        if ($placeId <= 0) {
            hv_json(['ok' => false, 'message' => 'Missing place_id.'], 422);
        }

        $stmt = $pdo->prepare('DELETE FROM safety_circle_places WHERE id = :id AND owner_user_id = :owner_user_id');
        $stmt->execute([
            'id' => $placeId,
            'owner_user_id' => $userId,
        ]);

        hv_json([
            'ok' => true,
            'places' => hv_fetch_places($pdo, $userId),
            'recent_activity' => hv_fetch_recent_activity($pdo, $userId),
        ]);
    }

    if ($action === 'set-status') {
        $status = strtolower(trim((string)($input['status'] ?? 'watch')));
        if (!in_array($status, ['safe', 'help', 'sos', 'watch'], true)) {
            hv_json(['ok' => false, 'message' => 'Invalid status value.'], 422);
        }

        $lat = isset($input['lat']) && is_numeric($input['lat']) ? (float)$input['lat'] : null;
        $lng = isset($input['lng']) && is_numeric($input['lng']) ? (float)$input['lng'] : null;
        $batteryLevel = isset($input['battery']) && is_numeric($input['battery'])
            ? max(0, min(100, (int)round((float)$input['battery'])))
            : null;
        $isCharging = !empty($input['is_charging']) ? 1 : 0;
        $accuracyMeters = isset($input['accuracy_meters']) && is_numeric($input['accuracy_meters'])
            ? max(0, round((float)$input['accuracy_meters'], 2))
            : null;

        $stmt = $pdo->prepare(
            'INSERT INTO safety_circle_status (user_id, status, lat, lng, battery_level, is_charging, accuracy_meters, updated_at)
             VALUES (:user_id, :status, :lat, :lng, :battery_level, :is_charging, :accuracy_meters, NOW())
             ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                lat = VALUES(lat),
                lng = VALUES(lng),
                battery_level = COALESCE(VALUES(battery_level), battery_level),
                is_charging = VALUES(is_charging),
                accuracy_meters = COALESCE(VALUES(accuracy_meters), accuracy_meters),
                updated_at = NOW()'
        );
        $stmt->execute([
            'user_id' => $userId,
            'status' => $status,
            'lat' => $lat,
            'lng' => $lng,
            'battery_level' => $batteryLevel,
            'is_charging' => $isCharging,
            'accuracy_meters' => $accuracyMeters,
        ]);

        $historyEventType = $status === 'watch' ? 'location_update' : 'status_update';
        $previousPoint = hv_record_location_history($pdo, $userId, $status, $lat, $lng, $historyEventType);
        hv_handle_place_transitions($pdo, $userId, $previousPoint, $status, $lat, $lng);

        if (in_array($status, ['safe', 'help', 'sos'], true)) {
            $message = $status === 'sos'
                ? 'Urgent SOS from a Safety Circle member.'
                : ($status === 'help'
                    ? 'A Safety Circle member marked themselves as needing help.'
                    : 'A Safety Circle member marked themselves as safe.');
            hv_insert_alerts_for_circle($pdo, $userId, $status, $lat, $lng, $message);
        }

        hv_json([
            'ok' => true,
            'self' => hv_fetch_self($pdo, $userId),
            'places' => hv_fetch_places($pdo, $userId),
            'recent_activity' => hv_fetch_recent_activity($pdo, $userId),
        ]);
    }

    if ($action === 'ping-member') {
        $memberUserId = isset($input['member_user_id']) ? (int)$input['member_user_id'] : 0;
        if ($memberUserId <= 0) {
            hv_json(['ok' => false, 'message' => 'Missing member_user_id.'], 422);
        }

        if (!hv_is_circle_connected($pdo, $userId, $memberUserId)) {
            hv_json(['ok' => false, 'message' => 'You can only ping people in your Safety Circle.'], 403);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO safety_circle_alerts (sender_user_id, receiver_user_id, alert_type, message, is_read, created_at)
             VALUES (:sender_user_id, :receiver_user_id, :alert_type, :message, 0, NOW())'
        );
        $stmt->execute([
            'sender_user_id' => $userId,
            'receiver_user_id' => $memberUserId,
            'alert_type' => 'ping',
            'message' => 'A Safety Circle member pinged you.',
        ]);

        hv_json(['ok' => true]);
    }

    hv_json(['ok' => false, 'message' => 'Unsupported action.'], 400);
} catch (Throwable $e) {
    hv_json([
        'ok' => false,
        'message' => 'Safety Circle API failed.',
        'error' => $e->getMessage()
    ], 500);
}
