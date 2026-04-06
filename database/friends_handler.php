<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
 
ob_start();
 
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
 
require_once __DIR__ . '/config.php';
 
$current_user_id = (int)($_SESSION['user_id'] ?? 0);
$action = $_REQUEST['action'] ?? '';
 
ob_end_clean();
 
header('Content-Type: application/json');
 
if ($current_user_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}
 
/*
|--------------------------------------------------------------------------
| GET FRIENDS LIST
|--------------------------------------------------------------------------
*/
if ($action === 'get_friends') {
    $sql = "
        SELECT u.id, u.first_name, u.last_name, up.avatar_path
        FROM friendships f
        JOIN users u ON (
            CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END = u.id
        )
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE (f.user_id = ? OR f.friend_id = ?)
          AND f.status = 'accepted'
        ORDER BY u.first_name ASC
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iii", $current_user_id, $current_user_id, $current_user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $friends = [];
    while ($row = $result->fetch_assoc()) {
        $avatar = $row['avatar_path'] ?? '';
        if (!empty($avatar)) {
            $clean = ltrim(str_replace('\\', '/', $avatar), '/');
            $avatarUrl = (strpos($clean, 'images/profile_avatars') !== false)
                ? '/HANDAVis/' . $clean
                : '/HANDAVis/images/profile_avatars/' . basename($clean);
        } else {
            $avatarUrl = '';
        }
        $friends[] = [
            'id'       => (int)$row['id'],
            'name'     => trim($row['first_name'] . ' ' . $row['last_name']),
            'avatar'   => $avatarUrl,
            'initials' => strtoupper(substr($row['first_name'], 0, 1) . substr($row['last_name'], 0, 1)),
        ];
    }
    $stmt->close();
    echo json_encode($friends);
    exit;
}
 
/*
|--------------------------------------------------------------------------
| SEARCH USERS + RELATIONSHIP STATUS
|--------------------------------------------------------------------------
*/
if ($action === 'search') {
    $searchTerm = "%" . trim($_GET['query'] ?? '') . "%";
 
    $sql = "
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            CASE
                WHEN f.status = 'accepted' THEN 'accepted'
                WHEN f.status = 'pending' AND f.user_id = ? THEN 'outgoing_pending'
                WHEN f.status = 'pending' AND f.friend_id = ? THEN 'incoming_pending'
                ELSE NULL
            END AS rel_status
        FROM users u
        LEFT JOIN friendships f
            ON (
                (f.user_id = ? AND f.friend_id = u.id)
                OR
                (f.user_id = u.id AND f.friend_id = ?)
            )
        WHERE (u.first_name LIKE ? OR u.last_name LIKE ?)
          AND u.id != ?
        LIMIT 15
    ";
 
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
        "iiiissi",
        $current_user_id,
        $current_user_id,
        $current_user_id,
        $current_user_id,
        $searchTerm,
        $searchTerm,
        $current_user_id
    );
 
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'Query failed']);
        exit;
    }
 
    $result = $stmt->get_result();
    $users = [];
 
    while ($row = $result->fetch_assoc()) {
        $row['username'] = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ($row['username'] === '') {
            $row['username'] = 'User #' . $row['id'];
        }
        $users[] = $row;
    }
 
    echo json_encode($users);
    exit;
}
 
/*
|--------------------------------------------------------------------------
| ADD FRIEND REQUEST
|--------------------------------------------------------------------------
*/
if ($action === 'add_friend') {
    $friend_id = (int)($_POST['friend_id'] ?? 0);
 
    if ($friend_id <= 0 || $friend_id === $current_user_id) {
        echo json_encode(['success' => false, 'error' => 'Invalid user']);
        exit;
    }
 
    $check = $conn->prepare("
        SELECT id, status
        FROM friendships
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
        LIMIT 1
    ");
    $check->bind_param("iiii", $current_user_id, $friend_id, $friend_id, $current_user_id);
    $check->execute();
    $existing = $check->get_result()->fetch_assoc();
    $check->close();
 
    if ($existing) {
        echo json_encode(['success' => false, 'error' => 'Friend request already exists']);
        exit;
    }
 
    $stmt = $conn->prepare("
        INSERT INTO friendships (user_id, friend_id, status)
        VALUES (?, ?, 'pending')
    ");
    $stmt->bind_param("ii", $current_user_id, $friend_id);
 
    if ($stmt->execute()) {
 
    // 🔔 Insert notification for the receiver (User B)
    $notif = $conn->prepare("
        INSERT INTO notifications (user_id, sender_id, type, message)
        VALUES (?, ?, 'friend_request', 'sent you a friend request')
    ");
    $notif->bind_param("ii", $friend_id, $current_user_id);
    $notif->execute();
    $notif->close();
 
    echo json_encode(['success' => true, 'message' => 'Friend request sent']);
} else {
        echo json_encode(['success' => false, 'error' => 'Failed to send request']);
    }
    $stmt->close();
    exit;
}
 
/*
|--------------------------------------------------------------------------
| ACCEPT FRIEND REQUEST
|--------------------------------------------------------------------------
*/
if ($action === 'accept_friend') {
    $friend_id = (int)($_POST['friend_id'] ?? 0);
 
    if ($friend_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid user']);
        exit;
    }
 
    $stmt = $conn->prepare("
        UPDATE friendships
        SET status = 'accepted'
        WHERE user_id = ? AND friend_id = ? AND status = 'pending'
    ");
    $stmt->bind_param("ii", $friend_id, $current_user_id);
 
    if ($stmt->execute() && $stmt->affected_rows > 0) {
 
    // 🔔 Notify the original sender (User A)
    $notif = $conn->prepare("
        INSERT INTO notifications (user_id, sender_id, type, message)
        VALUES (?, ?, 'alert', 'accepted your friend request')
    ");
    $notif->bind_param("ii", $friend_id, $current_user_id);
    $notif->execute();
    $notif->close();
 
    echo json_encode(['success' => true, 'message' => 'Friend request accepted']);
} else {
        echo json_encode(['success' => false, 'error' => 'No pending request found']);
    }
    $stmt->close();
    exit;
}
 
 
/*
|--------------------------------------------------------------------------
| REJECT FRIEND REQUEST
|--------------------------------------------------------------------------
*/
if ($action === 'reject_friend') {
    $friend_id = (int)($_POST['friend_id'] ?? 0);
 
    if ($friend_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid user']);
        exit;
    }
 
    $stmt = $conn->prepare("
        DELETE FROM friendships
        WHERE user_id = ? AND friend_id = ? AND status = 'pending'
    ");
    $stmt->bind_param("ii", $friend_id, $current_user_id);
 
    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['success' => true, 'message' => 'Friend request rejected']);
    } else {
        echo json_encode(['success' => false, 'error' => 'No pending request found']);
    }
    $stmt->close();
    exit;
}
 
/*
|--------------------------------------------------------------------------
| UNFRIEND
|--------------------------------------------------------------------------
*/
if ($action === 'unfriend') {
    $friend_id = (int)($_POST['friend_id'] ?? 0);
 
    if ($friend_id <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid user']);
        exit;
    }
 
    $stmt = $conn->prepare("
        DELETE FROM friendships
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
    ");
    $stmt->bind_param("iiii", $current_user_id, $friend_id, $friend_id, $current_user_id);
 
    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['success' => true, 'message' => 'Unfriended successfully']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Friendship not found']);
    }
    $stmt->close();
    exit;
}
 
/*
|--------------------------------------------------------------------------
| GET FRIENDS LIST
|--------------------------------------------------------------------------
*/
if ($action === 'get_friends') {
    $sql = "
        SELECT u.id, u.first_name, u.last_name, up.avatar_path
        FROM friendships f
        JOIN users u ON u.id = CASE
            WHEN f.user_id = ? THEN f.friend_id
            ELSE f.user_id
        END
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE (f.user_id = ? OR f.friend_id = ?)
          AND f.status = 'accepted'
        ORDER BY u.first_name ASC
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iii", $current_user_id, $current_user_id, $current_user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $friends = [];
    while ($row = $result->fetch_assoc()) {
        $row['username'] = trim($row['first_name'] . ' ' . $row['last_name']);
        $av = $row['avatar_path'] ?? '';
        if (!empty($av)) {
            $av = ltrim(str_replace('\\', '/', $av), '/');
            $row['avatar_url'] = (strpos($av, 'images/profile_avatars') !== false)
                ? '/HANDAVis/' . $av
                : '/HANDAVis/images/profile_avatars/' . basename($av);
        } else {
            $row['avatar_url'] = '';
        }
        unset($row['avatar_path']);
        $friends[] = $row;
    }
    $stmt->close();
    echo json_encode($friends);
    exit;
}
 
/*
|--------------------------------------------------------------------------
| MARK NOTIFICATIONS AS READ
|--------------------------------------------------------------------------
*/
if ($action === 'mark_notifications_read') {
    $notif_id = isset($_POST['notif_id']) ? (int)$_POST['notif_id'] : 0;
 
    if ($notif_id > 0) {
        // Mark specific notification read
        $stmt = $conn->prepare("
            UPDATE notifications SET is_read = 1
            WHERE id = ? AND user_id = ?
        ");
        $stmt->bind_param("ii", $notif_id, $current_user_id);
    } else {
        // Mark ALL unread notifications read for this user
        $stmt = $conn->prepare("
            UPDATE notifications SET is_read = 1
            WHERE user_id = ? AND is_read = 0
        ");
        $stmt->bind_param("i", $current_user_id);
    }
 
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to mark read']);
    }
    $stmt->close();
    exit;
}
 
echo json_encode(['success' => false, 'error' => 'Invalid action']);