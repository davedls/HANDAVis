<?php
include __DIR__ . '/loader.php';
require_once __DIR__ . '/../database/config.php';
 
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
 
// 1. Get YOUR info from the Session (This is the "Logged In" user)
$headerFirstName = $_SESSION['user']['first_name'] ?? 'User';
$headerRawId     = (int) ($_SESSION['user_id'] ?? 0);
// We'll call this $myAvatar to keep it simple
$myAvatar = '';
$notifRows = [];
$notifCount = 0;
 
if (isset($conn) && $conn instanceof mysqli && $headerRawId > 0) {
    $stmt = $conn->prepare("SELECT avatar_path FROM user_profiles WHERE user_id = ? LIMIT 1");
    $stmt->bind_param("i", $headerRawId);
    $stmt->execute();
    $res = $stmt->get_result();
 
    if ($row = $res->fetch_assoc()) {
        $myAvatar = $row['avatar_path'] ?? '';
    }
 
    $stmt->close();
 
    $notifQuery = $conn->prepare("
        SELECT n.id, n.type, n.message, n.is_read, n.created_at, n.sender_id,
               CONCAT(u.first_name, ' ', u.last_name) AS sender_name,
               up.avatar_path AS sender_avatar
        FROM notifications n
        LEFT JOIN users u ON u.id = n.sender_id
        LEFT JOIN user_profiles up ON up.user_id = n.sender_id
        WHERE n.user_id = ? AND n.is_read = 0
        ORDER BY n.created_at DESC
        LIMIT 30
    ");
    $notifQuery->bind_param("i", $headerRawId);
    $notifQuery->execute();
    $notifResult = $notifQuery->get_result();
 
    while ($nr = $notifResult->fetch_assoc()) {
        $notifRows[] = $nr;
    }
 
    $notifCount = count($notifRows);
    $notifQuery->close();
}
// 2. Format the display variables for the header HTML
$headerDisplayName = htmlspecialchars($headerFirstName);
$headerDisplayId   = str_pad((string)$headerRawId, 5, '0', STR_PAD_LEFT);
 
// 3. Build the final Avatar URL
if (!empty($myAvatar)) {
    $cleanPath = ltrim(str_replace('\\', '/', $myAvatar), '/');
    
    // Check if the path in the DB already has "images/profile_avatars"
    if (strpos($cleanPath, 'images/profile_avatars') !== false) {
        $headerAvatarUrl = '/HANDAVis/' . $cleanPath;
    } else {
        $headerAvatarUrl = '/HANDAVis/images/profile_avatars/' . $cleanPath;
    }
    
    $headerAvatarUrl .= '?v=' . time(); 
} else {
    // If you have no photo, use the initials API
    $headerAvatarUrl = 'https://ui-avatars.com/api/?name=' . urlencode($headerFirstName) . '&background=0D8ABC&color=fff';
}
?>
 
<header class="main-header">
 
 
 
<div class="header-left">
    <a href="user_home.php" style="text-decoration: none; color: inherit; cursor: pointer;">
        <h1 class="logo-text" style="font-size:20px; letter-spacing:-.4px; margin: 0;">HANDAVis</h1>
    </a>
</div>
 
 
 
 
  <div class="header-right">
    <div class="theme-switch-wrapper" onclick="toggleTheme()">
        <div class="theme-switch-track">
            <div class="track-scenery">
                <div class="scenery-night"><span class="star" style="top:5px;left:40px;">✨</span></div>
                <div class="scenery-day"><span class="cloud" style="top:8px;right:40px;">☁️</span></div>
            </div>
            <div class="theme-switch-thumb shield-thumb">
                <svg viewBox="0 0 50 58" class="thumb-shield-svg">
                    <path d="M25 2L5 10v15c0 12 8 23 20 28 12-5 20-16 20-28V10L25 2z"/>
                </svg>
            </div>
        </div>
    </div>
 
    <button class="icon-btn" onclick="openSettings()" title="Settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    </button>
 
    <div class="friends-dropdown-wrapper">
        <button class="icon-btn" onclick="toggleNotifications(event)" title="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
<span id="notifBadge" 
      style="<?php echo ($notifCount > 0) ? 'display:block;' : 'display:none;'; ?> position:absolute; top:4px; right:4px; width:8px; height:8px; background:#ff4d57; border-radius:50%; border:2px solid var(--header-bg);">
</span>
        </button>
        <div id="notificationsDropdown" class="friends-dropdown-window" style="display: none;">
            <div class="dropdown-triangle"></div>
            <div style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 600;">Notifications</span>
            </div>
            <div id="notificationsList" class="friends-list">
<?php if ($notifCount > 0): ?>
    <?php foreach ($notifRows as $notif): ?>
        <?php
            $nSenderName = htmlspecialchars(trim($notif['sender_name'] ?? 'Someone'), ENT_QUOTES, 'UTF-8');
            $nMsg = htmlspecialchars($notif['message'] ?? '', ENT_QUOTES, 'UTF-8');
            $nType = $notif['type'] ?? 'system';
            $nId = (int)$notif['id'];
            $nSenderId = (int)$notif['sender_id'];
 
            // Avatar
            $nAvatar = $notif['sender_avatar'] ?? '';
            if (!empty($nAvatar)) {
                $nAvatarClean = ltrim(str_replace('\\', '/', $nAvatar), '/');
                $nAvatarUrl = (strpos($nAvatarClean, 'images/profile_avatars') !== false)
                    ? '/HANDAVis/' . $nAvatarClean
                    : '/HANDAVis/images/profile_avatars/' . basename($nAvatarClean);
            } else {
                $nAvatarUrl = '';
            }
            $nInitials = strtoupper(substr($notif['sender_name'] ?? 'U', 0, 1));
        ?>
        <div class="notif-item <?php echo $nType === 'friend_request' ? 'notif-friend-request' : ''; ?>"
             data-notif-id="<?php echo $nId; ?>"
             data-sender-id="<?php echo $nSenderId; ?>"
             data-type="<?php echo htmlspecialchars($nType, ENT_QUOTES, 'UTF-8'); ?>">
            <div class="notif-row">
                <div class="notif-avatar">
                    <?php if ($nAvatarUrl): ?>
                        <img src="<?php echo $nAvatarUrl; ?>" alt="<?php echo $nInitials; ?>">
                    <?php else: ?>
                        <span><?php echo $nInitials; ?></span>
                    <?php endif; ?>
                </div>
                <div class="notif-body">
                    <div class="notif-text">
                        <strong><?php echo $nSenderName; ?></strong>
                        <?php echo $nMsg; ?>
                    </div>
                    <?php if ($nType === 'friend_request'): ?>
                    <div class="notif-actions">
                        <button class="notif-btn notif-accept"
                            onclick="handleFriendRequest(<?php echo $nId; ?>, <?php echo $nSenderId; ?>, 'accept', this)">
                            Accept
                        </button>
                        <button class="notif-btn notif-decline"
                            onclick="handleFriendRequest(<?php echo $nId; ?>, <?php echo $nSenderId; ?>, 'decline', this)">
                            Decline
                        </button>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    <?php endforeach; ?>
<?php else: ?>
    <div class="notif-empty">No notifications</div>
<?php endif; ?>
</div>
        </div>
    </div>
 
    <div class="friends-dropdown-wrapper">
    <button type="button" class="icon-btn" onclick="toggleFriendsDropdown(event)" title="Friends">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
    </button>
 
    <div id="friendsDropdown" class="friends-v2-panel" onclick="event.stopPropagation()" style="display: none; flex-direction: column; position: absolute; right: 0; top: 100%; width: 300px; background: #0f1722; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; z-index: 9999; margin-top: 10px;">
    <div class="dropdown-triangle"></div>
    
    <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <input type="text" id="friendSearchInput" placeholder="Search..." onkeyup="searchFriends()" style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px; border-radius: 6px;">
    </div>
 
    <div class="friends-tabs-container" style="display: flex; justify-content: space-around; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <button id="btn-all" onclick="filterFriends('all', event)" class="friend-tab active" style="background:none; border:none; color:#4fd8ff; cursor:pointer; font-weight:bold; padding: 5px 10px;">All</button>
        <button id="btn-online" onclick="filterFriends('online', event)" class="friend-tab" style="background:none; border:none; color:#9db0c8; cursor:pointer; padding: 5px 10px;">Online</button>
        <button id="btn-offline" onclick="filterFriends('offline', event)" class="friend-tab" style="background:none; border:none; color:#9db0c8; cursor:pointer; padding: 5px 10px;">Offline</button>
    </div>
 
    <div id="friendsList" style="max-height: 300px; overflow-y: auto;">
        <div style="padding:20px; text-align:center; opacity:0.5;">Start typing...</div>
    </div>
</div>
</div>
 
<div class="user-id-card" onclick="location.href='/HANDAVis/user_profile.php'" title="View My Profile">
    <div class="user-id-photo">
        <img src="<?php echo $headerAvatarUrl; ?>"
             onerror="this.src='/HANDAVis/images/profile_avatars/default-avatar.png'" 
             alt="Profile">
    </div>
    <div class="user-id-details">
        <span class="user-id-name"><?php echo $headerDisplayName; ?></span>
        <span class="user-id-number">ID: #<?php echo $headerDisplayId; ?></span>
    </div>
    <div class="id-card-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    </div>
</div>
  <form id="logoutForm" action="database/logout.php" method="post" style="display:flex; align-items:center;">
    <button type="button" class="logout-btn" onclick="toggleLogoutModal()">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      <span>Logout</span>
    </button>
  </form>
</div>
 
 
 
  <button class="hamburger-btn" id="hamburgerBtn" onclick="toggleHamburger()" aria-label="Menu">
 
    <span></span>
 
    <span></span>
 
    <span></span>
 
  </button>
 
 
 
</header>
 
 
 
<div class="mobile-drawer" id="mobileDrawer">
    <div class="mobile-drawer-header" 
         onclick="window.location.href='/HANDAVis/user_profile.php';" 
         style="cursor: pointer;">
        <div class="user-id-photo">
            <img src="<?php echo $headerAvatarUrl; ?>" 
                 onerror="this.src='/HANDAVis/images/profile_avatars/default-avatar.png'" 
                 alt="Profile">
        </div>
        <div class="user-id-details">
            <span class="user-id-name"><?php echo $headerDisplayName; ?></span>
            <span class="user-id-number">View Profile #<?php echo $headerDisplayId; ?></span>
        </div>
    </div>

    <div class="mobile-drawer-divider"></div>

    <div class="mobile-nav-section" style="display: flex; flex-direction: column; gap: 5px; padding: 10px;">
        <button class="mobile-drawer-item <?= $activePage === 'dashboardPage' ? 'active' : '' ?>" onclick="openPage(event,'dashboardPage'); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Dashboard</span>
        </button>

        <button class="mobile-drawer-item <?= $activePage === 'alertsPage' ? 'active' : '' ?>" onclick="openPage(event,'alertsPage'); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <span>Alerts</span>
        </button>

        <button class="mobile-drawer-item <?= $activePage === 'mapPage' ? 'active' : '' ?>" onclick="openPage(event,'mapPage'); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
            <span>Live Map</span>
        </button>

        <button class="mobile-drawer-item <?= $activePage === 'reportPage' ? 'active' : '' ?>" onclick="openPage(event,'reportPage'); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            <span>Hazard Report</span>
        </button>

        <button class="mobile-drawer-item <?= $activePage === 'safetyPage' ? 'active' : '' ?>" onclick="openPage(event,'safetyPage'); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>Household Safety</span>
        </button>

        <button class="mobile-drawer-item <?= $activePage === 'watchPage' ? 'active' : '' ?>" onclick="openPage(event,'watchPage'); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            <span>Watch</span>
        </button>
    </div>

    <div class="mobile-drawer-divider"></div>

    <div class="mobile-utility-section" style="display: flex; flex-direction: column; gap: 5px; padding: 10px;">
        <button class="mobile-drawer-item" onclick="toggleFriendsDropdown(event); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Friends</span>
        </button>

        <button class="mobile-drawer-item" onclick="openSettings(); toggleHamburger();">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Settings</span>
        </button>
    </div>

    <div class="mobile-drawer-divider"></div>

    <div class="mobile-drawer-theme">
        <span class="mobile-drawer-label">Theme</span>
        <div class="theme-switch-wrapper" onclick="toggleTheme()">
            <div class="theme-switch-track">
                <div class="track-scenery">
                    <div class="scenery-night"><span class="star" style="top:5px;left:40px;">✨</span></div>
                    <div class="scenery-day"><span class="cloud" style="top:8px;right:40px;">☁️</span></div>
                </div>
                <div class="theme-switch-thumb shield-thumb">
                    <svg viewBox="0 0 50 58" class="thumb-shield-svg"><path d="M25 2L5 10v15c0 12 8 23 20 28 12-5 20-16 20-28V10L25 2z"/></svg>
                </div>
            </div>
        </div>
    </div>

    <button type="button" class="mobile-drawer-item mobile-drawer-logout" onclick="toggleLogoutModal()" style="color: #ff4d57; margin-top: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        <span>Logout</span>
    </button>
</div>
 
  
  
<!-- ── Regional Alert Modal ── -->
<div id="alertNotifModal" style="display:none; position:fixed; inset:0; z-index:99999;
  background:rgba(0,0,0,0.65); align-items:center; justify-content:center;">
  <div style="background:#0f1722; border:1px solid rgba(255,77,87,0.3);
    border-radius:24px; padding:28px; max-width:420px; width:90%; position:relative;
    box-shadow:0 24px 48px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,77,87,0.06);">
    <div style="font-size:0.6875rem; font-weight:900; letter-spacing:1px;
      color:#7fdfff; margin-bottom:12px; text-transform:uppercase;">🚨 Regional Alert</div>
    <strong id="alertNotifTitle" style="display:block; font-size:1.125rem;
      color:#f6fbff; margin-bottom:8px; line-height:1.3;"></strong>
    <p id="alertNotifDesc" style="font-size:0.875rem; color:#ffdce0;
      line-height:1.6; margin-bottom:6px;"></p>
    <small id="alertNotifDate" style="display:block; font-size:0.75rem;
      color:rgba(255,220,224,0.55); margin-bottom:18px;"></small>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <span id="alertNotifType" style="padding:6px 12px; border-radius:999px;
        background:#ff4d57; color:#fff; font-size:0.75rem; font-weight:900;
        letter-spacing:0.6px;"></span>
      <div style="display:flex; gap:8px;">
        <button onclick="document.getElementById('alertNotifModal').style.display='none'"
          style="padding:10px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.1);
          background:transparent; color:#9db0c8; cursor:pointer; font-size:0.875rem; font-family:inherit;">
          Dismiss
        </button>
        <a href="/HANDAVis/user_alerts.php"
          style="padding:10px 16px; border-radius:999px; background:#ff4d57;
          color:#fff; font-weight:800; font-size:0.875rem; text-decoration:none;
          display:inline-flex; align-items:center;">
          View Alert
        </a>
      </div>
    </div>
  </div>
</div>
 
 <script src="assets/js/user_profile.js"></script>
<script>
// ── Notification System ──────────────────────────────────────────────────────
 
function toggleNotifications(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('notificationsDropdown');
    const friendsDropdown = document.getElementById('friendsDropdown');
    if (friendsDropdown) friendsDropdown.classList.remove('active');
    const isOpen = dropdown.classList.toggle('active');
    if (isOpen) markAllNotifsRead();
}
 
function markAllNotifsRead() {
    fetch('/HANDAVis/database/friends_handler.php', {
        method: 'POST',
        body: new URLSearchParams({ action: 'mark_notifications_read' })
    }).then(() => {
        const badge = document.getElementById('notifBadge');
        if (badge) badge.style.display = 'none';
    }).catch(() => {});
}
 
function handleFriendRequest(notifId, senderId, decision, btn) {
    const action = decision === 'accept' ? 'accept_friend' : 'reject_friend';
    const fd = new FormData();
    fd.append('action', action);
    fd.append('friend_id', senderId);
 
    btn.disabled = true;
    btn.textContent = '...';
 
    fetch('/HANDAVis/database/friends_handler.php', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(data => {
            const item = btn.closest('.notif-item');
            if (data.success) {
                if (decision === 'accept') {
                    item.querySelector('.notif-actions').innerHTML =
                        '<span class="notif-accepted">✓ Friend added!</span>';
                } else {
                    item.style.opacity = '0.4';
                    item.querySelector('.notif-actions').innerHTML =
                        '<span class="notif-declined">Declined</span>';
                }
                // mark this notif as read
                fetch('/HANDAVis/database/friends_handler.php', {
                    method: 'POST',
                    body: new URLSearchParams({ action: 'mark_notifications_read', notif_id: notifId })
                });
            } else {
                btn.disabled = false;
                btn.textContent = decision === 'accept' ? 'Accept' : 'Decline';
                alert(data.error || 'Something went wrong.');
            }
        })
        .catch(() => {
            btn.disabled = false;
            btn.textContent = decision === 'accept' ? 'Accept' : 'Decline';
        });
}
 
// Close dropdown when clicking outside
window.addEventListener('click', () => {
    const dd = document.getElementById('notificationsDropdown');
    if (dd) dd.classList.remove('active');
});
 
(function () {
  var path = window.location.pathname;
  if (
    path.indexOf('/roles/admin') !== -1 ||
    path.indexOf('/roles/barangay') !== -1 ||
    path.indexOf('/roles/responder') !== -1
  ) return;
 
  fetch('/HANDAVis/latest_alert.php')
    .then(function (r) { return r.json(); })
    .then(function (alert) {
      if (!alert) return;
 
      var lastSeen = localStorage.getItem('hv_last_alert_id');
      if (lastSeen === String(alert.alert_id)) return;
 
      var modal = document.getElementById('alertNotifModal');
      var title = document.getElementById('alertNotifTitle');
      var desc  = document.getElementById('alertNotifDesc');
      var type  = document.getElementById('alertNotifType');
      var date  = document.getElementById('alertNotifDate');
 
      if (!modal) return;
 
      title.textContent = '⚠ ' + alert.title;
      desc.textContent  = alert.description;
      type.textContent  = alert.alert_type.toUpperCase();
      date.textContent  = 'Published: ' + new Date(alert.created_at).toLocaleString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
 
      modal.style.display = 'flex';
      localStorage.setItem('hv_last_alert_id', String(alert.alert_id));
    })
    .catch(function () {});
})();
	
</script>