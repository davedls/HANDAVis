<?php
require_once __DIR__ . '/../database/require_login.php';
require_once __DIR__ . '/../database/require_role.php';
require_once __DIR__ . '/../database/config.php';
hv_require_login('../index.php?auth=login&notice=login_required');
hv_require_role(['Admin'], '../user_home.php');

header('Content-Type: application/json');

$result = $conn->query(
    "SELECT b.id, b.barangay_name, b.created_at,
            m.municipality_name
     FROM barangays b
     LEFT JOIN municipalities m ON b.municipality_id = m.id
     ORDER BY m.municipality_name ASC, b.barangay_name ASC"
);

if (!$result) { echo json_encode([]); exit; }

$barangays = [];
while ($row = $result->fetch_assoc()) {
    $barangays[] = $row;
}

echo json_encode($barangays);