<?php
session_start();
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

function hv_natural_sort_list(array $items): array
{
    $items = array_values(array_filter(array_map(static function ($item) {
        return trim((string)$item);
    }, $items), static function ($item) {
        return $item !== '';
    }));

    usort($items, static function (string $a, string $b): int {
        return strnatcasecmp($a, $b);
    });

    return array_values(array_unique($items));
}

$type = $_GET['type'] ?? '';

if ($type === 'municipalities') {
    $province = trim($_GET['province'] ?? '');

    if ($province === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Province is required.']);
        exit;
    }

    $stmt = $conn->prepare(
        'SELECT m.municipality_name
         FROM municipalities m
         INNER JOIN provinces p ON p.id = m.province_id
         WHERE p.province_name = ?
         ORDER BY m.municipality_name'
    );
    $stmt->bind_param('s', $province);
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row['municipality_name'];
    }

    $stmt->close();
    echo json_encode(['data' => hv_natural_sort_list($data)]);
    exit;
}

if ($type === 'barangays') {
    $province = trim($_GET['province'] ?? '');
    $municipality = trim($_GET['municipality'] ?? '');

    if ($province === '' || $municipality === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Province and municipality are required.']);
        exit;
    }

    $stmt = $conn->prepare(
        'SELECT b.barangay_name
         FROM barangays b
         INNER JOIN municipalities m ON m.id = b.municipality_id
         INNER JOIN provinces p ON p.id = m.province_id
         WHERE p.province_name = ? AND m.municipality_name = ?
         ORDER BY b.barangay_name'
    );
    $stmt->bind_param('ss', $province, $municipality);
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row['barangay_name'];
    }

    $stmt->close();
    echo json_encode(['data' => hv_natural_sort_list($data)]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid request type.']);
