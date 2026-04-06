<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();
require_once __DIR__ . '/database/user_profile_fetch_data.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - User Profile</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo filemtime(__DIR__ . '/handav.png'); ?>">
  <link rel="stylesheet" href="assets/css/user_home.css">
  <link rel="stylesheet" href="assets/css/user_main_header.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_main_header.css') ? filemtime(__DIR__ . '/assets/css/user_main_header.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="assets/css/user_profile.css">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/reduce_animation.css">
</head>
<body>

  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <main class="profile-main">

    <div class="back-bar">
      <a href="user_home.php" class="back-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Back to Dashboard
      </a>
    </div>

    <div class="profile-hero">
      <div class="hero-cover"></div>
      <div class="hero-body">

        <div class="avatar-wrap">
          <div class="avatar"
            id="avatarEl"
            data-has-avatar="<?php echo $avatarUrl !== '' ? '1' : '0'; ?>"
            <?php if ($avatarUrl !== ''): ?>
              style="background-image:url('<?php echo htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8'); ?>');background-size:cover;background-position:center;background-repeat:no-repeat;font-size:0;">
            <?php endif; ?>
          ><?php if ($avatarUrl === ''): echo htmlspecialchars($avatarInitials, ENT_QUOTES, 'UTF-8'); endif; ?></div>
          <div class="avatar-dot"></div>
          <?php if ($isOwnProfile): ?>
          <label class="avatar-cam-btn" id="avatarCamBtn" for="avatarFileInput" title="Change photo">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </label>
          <input type="file" id="avatarFileInput" accept="image/*" style="display:none">
          <?php endif; ?>
        </div>

        <div class="hero-info">
          <div class="profile-name" id="profileNameDisplay">
            <?php echo !empty($fullName) ? htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') : 'User'; ?>
          </div>
          <div class="profile-id" id="profileIdDisplay">ID #U-<?php echo htmlspecialchars($safeUserId, ENT_QUOTES, 'UTF-8'); ?></div>
          <div class="profile-handle" id="profileHandleDisplay"><?php echo htmlspecialchars($handle, ENT_QUOTES, 'UTF-8'); ?> · <?php echo htmlspecialchars($locationText, ENT_QUOTES, 'UTF-8'); ?></div>
          <div class="profile-tags">
            <span class="badge badge-cyan" id="profileBadgeBarangay">🏘 Barangay User</span>
            <span class="badge badge-green">● Online</span>
            <span class="badge badge-muted">Member since <?php echo $memberSince; ?></span>
          </div>
        </div>

        <div class="hero-actions">
          <?php if ($isOwnProfile): ?>
            <button class="btn btn-secondary" id="editPhotoBtn" onclick="togglePhotoEditMode()">Edit Photo</button>
            <button class="btn btn-primary" id="savePhotoBtn" style="display:none;" onclick="commitAvatarEdit()">Save Photo</button>
            <button class="btn btn-secondary" id="cancelPhotoBtn" style="display:none;" onclick="cancelPhotoEdit()">Cancel</button>
          <?php else: ?>
            <?php if ($friendship_status === 'friends'): ?>
              <button class="btn btn-secondary" id="friend-action-btn" onclick="processFriendshipProfile(<?= $profile_user_id ?>, 'unfriend')">✓ Friends</button>
            <?php elseif ($friendship_status === 'outgoing'): ?>
              <button class="btn btn-secondary" id="friend-action-btn" disabled>Request Sent</button>
            <?php elseif ($friendship_status === 'incoming'): ?>
              <button class="btn btn-primary" id="friend-action-btn" onclick="processFriendshipProfile(<?= $profile_user_id ?>, 'accept_friend')">Accept Request</button>
              <button class="btn btn-secondary" id="friend-decline-btn" onclick="processFriendshipProfile(<?= $profile_user_id ?>, 'reject_friend')">Decline</button>
            <?php else: ?>
              <button class="btn btn-primary" id="friend-action-btn" onclick="processFriendshipProfile(<?= $profile_user_id ?>, 'add_friend')">+ Add Friend</button>
            <?php endif; ?>
          <?php endif; ?>
        </div>

      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-eyebrow">Role</div>
        <div class="stat-value"><?php echo htmlspecialchars($userRole, ENT_QUOTES, 'UTF-8'); ?></div>
        <div class="stat-sub">Account type in HANDAVis</div>
      </div>
      <div class="stat-card">
        <div class="stat-eyebrow">Reports Filed</div>
        <div class="stat-value"><?php echo $reportsFiled; ?></div>
        <div class="stat-sub">Flood, fire &amp; road hazards</div>
      </div>
      <div class="stat-card">
        <div class="stat-eyebrow">Alerts Viewed</div>
        <div class="stat-value"><?php echo $alertsViewed; ?></div>
        <div class="stat-sub">Official advisories read</div>
      </div>
      <div class="stat-card">
        <div class="stat-eyebrow">Days Active</div>
        <div class="stat-value"><?php echo $daysActive; ?></div>
        <div class="stat-sub">Since <?php echo $memberSince; ?></div>
      </div>
    </div>

    <?php if ($isOwnProfile): ?>
    <div class="two-col">

      <div class="panel" id="profileInfoPanel">
        <div class="eyebrow">Profile Information</div>
        <div class="section-label">Personal Details</div>

        <div class="field-group">
          <label class="field-label">User ID</label>
          <input class="field-input field-id" id="inputUserId" type="text" value="<?php echo htmlspecialchars($safeUserId, ENT_QUOTES, 'UTF-8'); ?>" placeholder="User ID" oninput="reflectProfile()" />
        </div>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label">First Name</label>
            <input class="field-input" id="inputFirstName" type="text" value="<?php echo htmlspecialchars($firstName, ENT_QUOTES, 'UTF-8'); ?>" placeholder="First name" oninput="reflectProfile()" />
          </div>
          <div class="field-group">
            <label class="field-label">Last Name</label>
            <input class="field-input" id="inputLastName" type="text" value="<?php echo htmlspecialchars($lastName, ENT_QUOTES, 'UTF-8'); ?>" placeholder="Last name" oninput="reflectProfile()" />
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Email Address</label>
          <input class="field-input" id="inputEmail" type="email" value="<?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?>" oninput="reflectProfile()" />
        </div>

        <div class="field-group">
          <label class="field-label">Contact Number</label>
          <input class="field-input" id="inputPhone" type="tel" value="<?php echo htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'); ?>" />
        </div>

        <div class="field-group">
          <label class="field-label">Province</label>
          <select class="field-select" id="inputProvince" onchange="reflectProfile()">
            <?php foreach ($provinceOptions as $provinceOption): ?>
              <option<?php echo $provinceOption === (string)($profile['province_name'] ?? '') ? ' selected' : ''; ?>>
                <?php echo htmlspecialchars($provinceOption, ENT_QUOTES, 'UTF-8'); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label">City / Municipality</label>
            <select class="field-select" id="inputCity" onchange="reflectProfile()">
              <?php foreach ($municipalityOptions as $cityOption): ?>
                <option<?php echo $cityOption === $municipality ? ' selected' : ''; ?>>
                  <?php echo htmlspecialchars($cityOption, ENT_QUOTES, 'UTF-8'); ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Barangay</label>
            <select class="field-select" id="inputBarangay" onchange="reflectProfile()">
              <?php foreach ($barangayOptions as $barangayOption): ?>
                <option<?php echo $barangayOption === $barangay ? ' selected' : ''; ?>>
                  <?php echo htmlspecialchars($barangayOption, ENT_QUOTES, 'UTF-8'); ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Emergency Contact Name</label>
          <input class="field-input" id="inputEmergencyContactName" type="text" value="<?php echo htmlspecialchars($emergencyContactName, ENT_QUOTES, 'UTF-8'); ?>" />
        </div>

        <div class="field-group">
          <label class="field-label">Emergency Contact Number</label>
          <input class="field-input" id="inputEmergencyContactNumber" type="tel" value="<?php echo htmlspecialchars($emergencyContactPhone, ENT_QUOTES, 'UTF-8'); ?>" />
        </div>

        <div class="field-group">
          <label class="field-label">Short Bio</label>
          <textarea class="field-textarea" id="inputBio"><?php echo htmlspecialchars($bio, ENT_QUOTES, 'UTF-8'); ?></textarea>
        </div>

        <div class="btn-row">
          <button type="button" class="btn btn-secondary" id="editProfileBtn" onclick="toggleEditMode()">Edit Personal Info</button>
        </div>
        <div class="btn-row profile-edit-actions" id="profileEditActions">
          <button type="button" class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
          <button type="button" class="btn btn-secondary" onclick="cancelEdit()">Discard</button>
        </div>
      </div>

      <div class="col-stack">

        <div class="panel">
          <div class="eyebrow">Notification Settings</div>
          <div class="section-label">Preferences</div>
          <div class="toggle-row">
            <div class="toggle-info"><strong>Emergency SOS Alerts</strong><span>Immediate SOS notifications</span></div>
            <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
          </div>
          <div class="toggle-row">
            <div class="toggle-info"><strong>Regional Broadcasts</strong><span>Alerts from your barangay and region</span></div>
            <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
          </div>
          <div class="toggle-row">
            <div class="toggle-info"><strong>Evacuation Notices</strong><span>Updates on open and closed centers</span></div>
            <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
          </div>
          <div class="toggle-row">
            <div class="toggle-info"><strong>Weekly Summary Email</strong><span>Digest of your area's disaster activity</span></div>
            <label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label>
          </div>
          <button class="btn btn-primary" style="margin-top:12px" onclick="saveNotifPrefs()">Save Preferences</button>
        </div>

        <div class="panel rs-panel">
          <div class="eyebrow">Relief Support</div>
          <div class="section-label">Verified Relief Drives</div>
          <div class="rs-verified-banner">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <div>
              <strong>Verified Relief Drives</strong>
              <p>All campaigns are verified by local government units and partner organizations. 100% of donations go to relief efforts.</p>
            </div>
          </div>
          <div class="rs-list">
            <div class="rs-card">
              <div class="rs-img-wrap">
                <img src="images/relief_typhoon.jpg" alt="Typhoon Relief Fund" onerror="this.style.display='none'; this.parentElement.classList.add('rs-img-missing')">
              </div>
              <div class="rs-card-body">
                <div class="rs-meta-row"><span class="rs-verified-pill">VERIFIED</span><span class="rs-days">18 days left</span></div>
                <div class="rs-title">Typhoon Relief Fund – Iloilo</div>
                <div class="rs-desc">Emergency supplies and shelter for families affected by Typhoon Aghon in Iloilo Province.</div>
                <div class="rs-amounts"><span class="rs-raised">₱245,000</span><span class="rs-goal">of ₱500,000</span></div>
                <div class="rs-progress-bar"><div class="rs-progress-fill" style="width:49%"></div></div>
                <div class="rs-stats-row">
                  <span class="rs-donors"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 312 donors</span>
                  <span class="rs-pct">49% funded</span>
                </div>
                <a href="#" class="rs-donate-btn" onclick="showToast('Opening donation page...')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  Donate Now
                </a>
              </div>
            </div>
            <div class="rs-card">
              <div class="rs-img-wrap">
                <img src="images/relief_flood.jpg" alt="Flood Relief Negros" onerror="this.style.display='none'; this.parentElement.classList.add('rs-img-missing')">
              </div>
              <div class="rs-card-body">
                <div class="rs-meta-row"><span class="rs-verified-pill">VERIFIED</span><span class="rs-days">9 days left</span></div>
                <div class="rs-title">Flood Relief – Negros Occidental</div>
                <div class="rs-desc">Food packs and clean water for displaced residents in low-lying barangays of Bacolod City.</div>
                <div class="rs-amounts"><span class="rs-raised">₱88,500</span><span class="rs-goal">of ₱200,000</span></div>
                <div class="rs-progress-bar"><div class="rs-progress-fill" style="width:44%"></div></div>
                <div class="rs-stats-row">
                  <span class="rs-donors"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 147 donors</span>
                  <span class="rs-pct">44% funded</span>
                </div>
                <a href="#" class="rs-donate-btn" onclick="showToast('Opening donation page...')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  Donate Now
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    <?php endif; ?>

    <?php if ($isOwnProfile): ?>
    <div class="panel ec-panel">
      <div class="eyebrow">Emergency Contacts</div>
      <div class="section-label">Quick Response Directory</div>
      <div class="ec-banner">
        <strong>🚨 In an emergency? Call 911</strong>
        <p>For life-threatening situations, call immediately.</p>
        <a href="tel:911" class="ec-call-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          Call 911 Now
        </a>
      </div>
      <div class="ec-filter-row">
        <button class="ec-filter-btn active" onclick="filterContacts(this, 'all')">All</button>
        <button class="ec-filter-btn" onclick="filterContacts(this, 'barangay')">Barangay</button>
        <button class="ec-filter-btn" onclick="filterContacts(this, 'fire')">Fire</button>
        <button class="ec-filter-btn" onclick="filterContacts(this, 'government')">Government</button>
        <button class="ec-filter-btn" onclick="filterContacts(this, 'hospital')">Hospital</button>
      </div>
      <div class="ec-list" id="ecList">
        <div class="ec-card" data-category="barangay">
          <div class="ec-icon ec-icon-barangay"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>
          <div class="ec-info"><strong>Barangay Mansaya Hall</strong><span class="ec-number">(033) 320-4567</span><span class="ec-address">📍 Brgy. Mansaya, Jaro</span></div>
          <a href="tel:0333204567" class="ec-dial-btn" title="Call"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
        </div>
        <div class="ec-card" data-category="fire">
          <div class="ec-icon ec-icon-fire"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg></div>
          <div class="ec-info"><strong>BFP Iloilo City</strong><span class="ec-number">(033) 337-2442 <span class="ec-24">24/7</span></span><span class="ec-address">📍 JM Basa St, Iloilo City</span></div>
          <a href="tel:0333372442" class="ec-dial-btn" title="Call"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
        </div>
        <div class="ec-card" data-category="government">
          <div class="ec-icon ec-icon-government"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
          <div class="ec-info"><strong>OCD Region VI</strong><span class="ec-number">(033) 509-7000 <span class="ec-24">24/7</span></span><span class="ec-address">📍 RDRRMC Building, Iloilo City</span></div>
          <a href="tel:0335097000" class="ec-dial-btn" title="Call"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
        </div>
        <div class="ec-card" data-category="hospital">
          <div class="ec-icon ec-icon-hospital"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div>
          <div class="ec-info"><strong>Western Visayas Medical Center</strong><span class="ec-number">(033) 321-2841 <span class="ec-24">24/7</span></span><span class="ec-address">📍 Q. Abeto St, Mandurriao, Iloilo City</span></div>
          <a href="tel:0333212841" class="ec-dial-btn" title="Call"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
        </div>
        <div class="ec-card" data-category="government">
          <div class="ec-icon ec-icon-government"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
          <div class="ec-info"><strong>Philippine Red Cross — Region VI</strong><span class="ec-number">143 <span class="ec-24">24/7</span></span><span class="ec-address">📍 Iloilo City Chapter</span></div>
          <a href="tel:143" class="ec-dial-btn" title="Call"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
        </div>
        <div class="ec-card" data-category="fire">
          <div class="ec-icon ec-icon-fire"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg></div>
          <div class="ec-info"><strong>BFP Bacolod City</strong><span class="ec-number">0921-341-7002 <span class="ec-24">24/7</span></span><span class="ec-address">📍 Bacolod City Fire Station</span></div>
          <a href="tel:09213417002" class="ec-dial-btn" title="Call"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
        </div>
      </div>
    </div>

    <div class="panel sg-panel">
      <div class="eyebrow">Preparedness</div>
      <div class="section-label">Safety Guides</div>
      <div class="sg-banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        <div>
          <strong>Safety Guides</strong>
          <p>Learn how to stay safe before, during, and after disasters. Knowledge saves lives.</p>
        </div>
      </div>
      <div class="sg-filter-row">
        <button class="sg-filter-btn active" onclick="filterGuides(this, 'all')">All</button>
        <button class="sg-filter-btn" onclick="filterGuides(this, 'emergency-kit')">Emergency Kit</button>
        <button class="sg-filter-btn" onclick="filterGuides(this, 'during')">During Disaster</button>
        <button class="sg-filter-btn" onclick="filterGuides(this, 'before')">Before Disaster</button>
        <button class="sg-filter-btn" onclick="filterGuides(this, 'after')">After Disaster</button>
      </div>
      <div class="sg-list" id="sgList">
        <div class="sg-item" data-category="emergency-kit">
          <div class="sg-item-header" onclick="toggleGuide(this)">
            <div class="sg-icon sg-icon-blue"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
            <div class="sg-item-info"><strong>Prepare a Go Bag</strong><span>Emergency Kit</span></div>
            <svg class="sg-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="sg-item-body">
            <p>A Go Bag is a portable kit with essential supplies to last 72 hours during an evacuation. Pack the following:</p>
            <ul>
              <li>Water (1 liter per person per day)</li>
              <li>Non-perishable food and manual can opener</li>
              <li>First aid kit and prescription medications</li>
              <li>Flashlight, batteries, and portable charger</li>
              <li>Copies of important documents (IDs, birth certificates)</li>
              <li>Extra clothing and sturdy shoes</li>
              <li>Whistle to signal for help</li>
              <li>Cash in small bills</li>
            </ul>
            <p>Store your Go Bag near the exit and review it every 6 months.</p>
          </div>
        </div>
        <div class="sg-item" data-category="during">
          <div class="sg-item-header" onclick="toggleGuide(this)">
            <div class="sg-icon sg-icon-purple"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg></div>
            <div class="sg-item-info"><strong>During a Typhoon</strong><span>During Disaster</span></div>
            <svg class="sg-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="sg-item-body">
            <p>When a typhoon is active in your area, take these steps immediately:</p>
            <ul>
              <li>Stay indoors and away from windows and glass doors</li>
              <li>Turn off utilities if instructed by authorities</li>
              <li>Do not go outside during the eye of the storm, it will resume</li>
              <li>Listen to PAGASA updates via battery-powered radio</li>
              <li>Move to a higher floor if flooding begins inside your home</li>
              <li>Avoid floodwaters, even 15cm can knock you down</li>
              <li>Keep your Go Bag accessible at all times</li>
            </ul>
          </div>
        </div>
        <div class="sg-item" data-category="during">
          <div class="sg-item-header" onclick="toggleGuide(this)">
            <div class="sg-icon sg-icon-orange"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
            <div class="sg-item-info"><strong>Earthquake Safety</strong><span>During Disaster</span></div>
            <svg class="sg-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="sg-item-body">
            <p>When the ground starts shaking, remember: Drop, Cover, Hold On.</p>
            <ul>
              <li><strong>Drop</strong> to your hands and knees immediately</li>
              <li><strong>Cover</strong> your head and neck under a sturdy table or desk</li>
              <li><strong>Hold On</strong> until shaking stops</li>
              <li>Stay away from windows, shelves, and heavy furniture</li>
              <li>If outdoors, move away from buildings, trees, and power lines</li>
              <li>If in a vehicle, pull over safely away from overpasses</li>
              <li>Expect aftershocks and remain alert after initial shaking stops</li>
            </ul>
          </div>
        </div>
        <div class="sg-item" data-category="before">
          <div class="sg-item-header" onclick="toggleGuide(this)">
            <div class="sg-icon sg-icon-cyan"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg></div>
            <div class="sg-item-info"><strong>Flood Preparedness</strong><span>Before Disaster</span></div>
            <svg class="sg-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="sg-item-body">
            <p>Before flood season, take these precautions to protect your household:</p>
            <ul>
              <li>Know your flood risk zone, if not be sure to ask your barangay office</li>
              <li>Identify your nearest evacuation center and multiple routes to reach it</li>
              <li>Elevate electrical appliances and important documents off the floor</li>
              <li>Clear drains and gutters near your home regularly</li>
              <li>Prepare a waterproof bag for your documents and Go Bag</li>
              <li>Agree on a family meeting point in case you get separated</li>
              <li>Register vulnerable family members with your barangay DRRMO</li>
            </ul>
          </div>
        </div>
        <div class="sg-item" data-category="after">
          <div class="sg-item-header" onclick="toggleGuide(this)">
            <div class="sg-icon sg-icon-green"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
            <div class="sg-item-info"><strong>After a Disaster</strong><span>After Disaster</span></div>
            <svg class="sg-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="sg-item-body">
            <p>Once the immediate danger has passed, take these steps carefully:</p>
            <ul>
              <li>Do not return home until authorities declare it safe</li>
              <li>Check for structural damage before entering any building</li>
              <li>Do not use tap water until it is declared safe, use bottled water instead</li>
              <li>Avoid downed power lines and report them to authorities</li>
              <li>Document property damage with photos for insurance or aid claims</li>
              <li>Watch for signs of stress or trauma in family members and seek help early</li>
              <li>Report missing persons to your barangay or local DRRMO immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

<?php endif; ?>    
<?php if ($isOwnProfile): ?>
    <div class="two-col">
      <div class="panel">
        <div class="eyebrow">Account Security</div>
        <div class="section-label">Change Password</div>
        <div class="field-group">
          <label class="field-label">Current Password</label>
          <input class="field-input" id="pwCurrent" type="password" placeholder="••••••••••">
        </div>
        <div class="field-group">
          <label class="field-label">New Password</label>
          <input class="field-input" id="pwNew" type="password" placeholder="Min. 8 characters">
        </div>
        <div class="field-group">
          <label class="field-label">Confirm New Password</label>
          <input class="field-input" id="pwConfirm" type="password" placeholder="Repeat new password">
        </div>
        <button class="btn btn-primary" onclick="updatePassword()">Update Password</button>
      </div>
      <div class="panel">
        <div class="eyebrow">Danger Zone</div>
        <div class="section-label danger-label">Irreversible Actions</div>
        <div class="danger-item">
          <div><strong>Deactivate Account</strong><span>Temporarily suspend. Contact admin to reactivate.</span></div>
          <button class="btn btn-danger" onclick="deactivateAccount()">Deactivate</button>
        </div>
        <div class="danger-item">
          <div><strong>Delete Account</strong><span>Permanently erase all your data. Cannot be undone.</span></div>
          <button class="btn btn-danger" onclick="deleteAccount()">Delete</button>
        </div>
      </div>
    </div>

    <div id="avatarModal" class="av-overlay">
      <div class="av-modal">
        <div class="av-modal-header">
          <strong>Update Profile Photo</strong>
          <button class="av-close-btn" onclick="closeAvatarModal()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="av-preview-wrap">
          <div class="av-ring"><img id="av-img" src="" alt="Preview"></div>
        </div>
        <div class="av-ctrl-group">
          <label class="av-ctrl-label">Zoom</label>
          <div class="av-range-row">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="range" id="av-zoom" class="av-range" min="100" max="220" value="100" step="1">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <span class="av-range-val" id="av-zoom-val">100%</span>
          </div>
        </div>
        <div class="av-footer">
          <button class="btn btn-secondary" onclick="closeAvatarModal()">Cancel</button>
          <button class="btn btn-primary" onclick="applyAvatarPhoto()">Apply Photo</button>
        </div>
      </div>
    </div>
    <?php endif; ?>

  </main>

  <?php require __DIR__ . '/includes/user_footer.php'; ?>

  <script src="assets/js/user_main_header.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_main_header.js') ? filemtime(__DIR__ . '/assets/js/user_main_header.js') : time(); ?>"></script>
  <script src="assets/js/user_settings.js"></script>
  <script src="assets/js/user_profile.js"></script>
	<script>
function smartNavigate(pageId) {
    // Check if we are on the dashboard/home page
    const isHomePage = window.location.pathname.includes('user_home.php');

    if (isHomePage && typeof openPage === 'function') {
        // If already home, just switch the tab
        openPage(null, pageId);
    } else {
        // If on Settings or Profile, redirect to home with a 'show' parameter
        window.location.href = 'user_home.php?show=' + pageId;
    }
    
    // Close the hamburger menu
    if (typeof toggleHamburger === 'function') toggleHamburger();
}

// Automatically update your header buttons to use this new logic
document.addEventListener("DOMContentLoaded", function() {
    const mobileButtons = document.querySelectorAll('.mobile-drawer-item');
    mobileButtons.forEach(btn => {
        const currentClick = btn.getAttribute('onclick');
        if (currentClick && currentClick.includes('openPage')) {
            // Extracts 'alertsPage', 'mapPage', etc. from the old onclick
            const match = currentClick.match(/'([^']+)'/);
            if (match) {
                btn.setAttribute('onclick', `smartNavigate('${match[1]}')`);
            }
        }
    });
});
</script>
</body>
</html>