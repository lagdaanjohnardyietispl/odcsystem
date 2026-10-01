<?php

$host = "localhost";
$user = "root";
$password = "";
$database = "dental_system";

$conn = @new mysqli($host, $user, $password, $database);

if ($conn->connect_errno) {
    die("Database Connection Failed: " . $conn->connect_error);
}

$tablesResult = $conn->query("SHOW TABLES LIKE 'appointments'");
if ($tablesResult && $tablesResult->num_rows === 0) {
    $conn->query("CREATE TABLE appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_name VARCHAR(120) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        treatment VARCHAR(120) NOT NULL,
        items_used VARCHAR(255) NOT NULL DEFAULT '',
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");
}

$columnsResult = $conn->query("SHOW COLUMNS FROM appointments");
$existingColumns = [];

if ($columnsResult) {
    while ($column = $columnsResult->fetch_assoc()) {
        $existingColumns[] = $column['Field'];
    }

    if (!in_array('items_used', $existingColumns, true)) {
        $conn->query("ALTER TABLE appointments ADD COLUMN items_used VARCHAR(255) NOT NULL DEFAULT ''");
    }

    if (!in_array('price', $existingColumns, true)) {
        $conn->query("ALTER TABLE appointments ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0.00");
    }
}

?>