<?php

/*
DB_HOST=localhost
DB_NAME=your_account_dbname
DB_USER=your_account_dbuser
DB_PASS=your_database_password
DB_PORT=3306
*/

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$db_host = 'localhost';
$db_name = 'rechelmavilrio_handaviss';
$db_user = 'rechelmavilrio_handaviss';
$db_pass = 'HandaVi$!';
$db_port = 3306;

try {
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
    $conn->set_charset('utf8mb4');
} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    die('Database connection failed. Check DB credentials and MySQL grants.');
}
