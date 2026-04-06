<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../database/db_connection.php';

function hv_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hv_detect_facility_type(string $facilityName): string
{
    $name = strtolower(trim($facilityName));

    if ($name === '') {
        return 'Evacuation Center';
    }
    if (str_contains($name, 'school')) {
        return 'School-based shelter';
    }
    if (str_contains($name, 'gym')) {
        return 'Gymnasium shelter';
    }
    if (str_contains($name, 'hall')) {
        return 'Hall / civic shelter';
    }
    if (str_contains($name, 'court')) {
        return 'Covered court shelter';
    }
    if (str_contains($name, 'municipal')) {
        return 'Municipal shelter';
    }

    return 'Evacuation Center';
}

function hv_build_validation_status(string $coordinateBasis, string $dataConfidence): string
{
    $basis = strtolower(trim($coordinateBasis));
    $confidence = trim($dataConfidence);

    if ($basis !== '') {
        if (str_contains($basis, 'exact')) {
            return 'Mapped exact location';
        }
        if (str_contains($basis, 'approximate') || str_contains($basis, 'proxy') || str_contains($basis, 'centroid')) {
            return 'Approximate / field-check advised';
        }
    }

    return $confidence !== '' ? 'Confidence: ' . $confidence : '';
}

if (!isset($conn) || !($conn instanceof mysqli)) {
    hv_json([
        'ok' => false,
        'message' => 'Database connection is unavailable.'
    ], 500);
}

$limit = max(1, min(500, (int)($_GET['limit'] ?? 250)));
$province = trim((string)($_GET['province'] ?? ''));

$sql = "
    SELECT
        ec.id,
        ec.ec_id,
        ec.barangay_area,
        ec.facility_name,
        ec.latitude,
        ec.longitude,
        ec.coordinate_basis,
        ec.hazard_focus,
        ec.priority_tier,
        COALESCE(ec.data_confidence, '') AS data_confidence,
        COALESCE(ec.notes, '') AS notes,
        COALESCE(ec.source_url, '') AS source_url,
        COALESCE(ec.google_maps_link, '') AS google_maps_link,
        COALESCE(ec.created_at, '') AS created_at,
        COALESCE(ec.updated_at, '') AS updated_at,
        COALESCE(m.municipality_name, '') AS municipality_name,
        COALESCE(p.province_name, '') AS province_name
    FROM evacuation_centers ec
    LEFT JOIN municipalities m ON m.id = ec.municipality_id
    LEFT JOIN provinces p ON p.id = ec.province_id
    WHERE ec.latitude IS NOT NULL
      AND ec.longitude IS NOT NULL
";

if ($province !== '') {
    $sql .= " AND p.province_name = ? ";
}

$sql .= "
    ORDER BY
      p.province_name ASC,
      m.municipality_name ASC,
      ec.facility_name ASC
    LIMIT ?
";

try {
    if ($province !== '') {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('si', $province, $limit);
    } else {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $limit);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    $centers = [];
    while ($row = $result->fetch_assoc()) {
        $lat = isset($row['latitude']) ? (float)$row['latitude'] : null;
        $lng = isset($row['longitude']) ? (float)$row['longitude'] : null;
        if (!is_finite($lat) || !is_finite($lng)) {
            continue;
        }

        $facilityName = (string)($row['facility_name'] ?? 'Evacuation Center');
        $coordinateBasis = (string)($row['coordinate_basis'] ?? '');
        $dataConfidence = (string)($row['data_confidence'] ?? '');

        $centers[] = [
            'id' => 'ec-' . (int)$row['id'],
            'ec_id' => (string)($row['ec_id'] ?? ''),
            'name' => $facilityName,
            'facilityType' => hv_detect_facility_type($facilityName),
            'barangay' => (string)($row['barangay_area'] ?? ''),
            'cityMunicipality' => (string)($row['municipality_name'] ?? ''),
            'province' => (string)($row['province_name'] ?? ''),
            'coords' => [$lat, $lng],
            'hazardFocus' => (string)($row['hazard_focus'] ?? ''),
            'priorityTier' => (string)($row['priority_tier'] ?? ''),
            'validationStatus' => hv_build_validation_status($coordinateBasis, $dataConfidence),
            'dataConfidence' => $dataConfidence,
            'coordinateBasis' => $coordinateBasis,
            'notes' => (string)($row['notes'] ?? ''),
            'sourceUrl' => (string)($row['source_url'] ?? ''),
            'mapsLink' => (string)($row['google_maps_link'] ?? ''),
            'createdAt' => (string)($row['created_at'] ?? ''),
            'updatedAt' => (string)($row['updated_at'] ?? ''),
            'type' => 'evac'
        ];
    }
    $stmt->close();

    hv_json([
        'ok' => true,
        'count' => count($centers),
        'source' => 'evacuation_centers table',
        'centers' => $centers
    ]);
} catch (Throwable $e) {
    hv_json([
        'ok' => false,
        'message' => 'Could not load evacuation centers.',
        'error' => $e->getMessage()
    ], 500);
}
