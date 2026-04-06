<!doctype html>
<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Barangay Staff', 'Barangay'], '../../user_home.php');
require_once __DIR__ . '/../../database/barangay/barangay_profile_fetch_data.php';
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Barangay Profile</title>
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_header.css" />
    <link rel="stylesheet" href="../../assets/css/user_footer.css" />
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_profile.css" />
  </head>
  <body>
    <?php require __DIR__ . '/barangay-header.php'; ?>

    <main class="barangay-profile-main">
      <div class="back-bar">
        <a href="./barangay_index.php" class="back-btn">&larr; Back to Barangay Dashboard</a>
      </div>

      <section class="profile-hero">
        <div class="hero-cover"></div>
        <div class="hero-body">
          <div class="avatar-wrap">
            <div
              class="avatar"
              id="avatarEl"
              <?php if ($avatarUrl !== ''): ?>
                style="background-image:url('<?php echo htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8'); ?>');background-size:cover;background-position:center;background-repeat:no-repeat;font-size:0;"
              <?php endif; ?>
            ><?php echo htmlspecialchars($avatarInitials, ENT_QUOTES, 'UTF-8'); ?></div>
            <label class="avatar-cam-btn" for="avatarFileInput" title="Change photo">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </label>
            <input type="file" id="avatarFileInput" accept="image/*" hidden>
          </div>

          <div class="hero-info">
            <h1 id="profileNameDisplay"><?php echo htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8'); ?></h1>
            <p class="profile-id" id="profileIdDisplay">Barangay Account</p>
            <p class="profile-handle" id="profileHandleDisplay"><?php echo htmlspecialchars($handle, ENT_QUOTES, 'UTF-8'); ?> | <?php echo htmlspecialchars($locationText, ENT_QUOTES, 'UTF-8'); ?></p>
            <div class="profile-tags">
              <span class="badge badge-green" id="profileBadgeBarangay">Barangay <?php echo htmlspecialchars($barangay !== '' ? $barangay : 'Staff', ENT_QUOTES, 'UTF-8'); ?></span>
              <span class="badge badge-muted">Operations Account</span>
            </div>
          </div>

          <div class="hero-actions">
            <button type="button" class="btn btn-outline" id="editProfileBtn" onclick="toggleEditMode()">Edit Profile</button>
            <button type="button" class="btn btn-primary" id="saveProfileBtn" onclick="saveProfile()" hidden>Save</button>
            <button type="button" class="btn btn-outline" id="cancelProfileBtn" onclick="cancelEdit()" hidden>Cancel</button>
          </div>
        </div>
      </section>

      <section class="profile-grid">
        <article class="panel" id="profileInfoPanel">
          <h2>Barangay Information Card</h2>

          <div class="field-group">
            <label for="inputBarangayName">Barangay Name</label>
            <input id="inputBarangayName" class="field-input" type="text" value="<?php echo htmlspecialchars($barangay, ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputBarangayCode">Barangay Code / ID</label>
            <input id="inputBarangayCode" class="field-input" type="text" value="<?php echo htmlspecialchars((string)($profile['barangay_id'] ?? 0), ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputCity">Municipality / City</label>
            <input id="inputCity" class="field-input" type="text" value="<?php echo htmlspecialchars($municipality, ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputProvince">Province</label>
            <input id="inputProvince" class="field-input" type="text" value="<?php echo htmlspecialchars((string)($profile['province_name'] ?? ''), ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputPhone">Official Contact Number</label>
            <input id="inputPhone" class="field-input" type="tel" value="<?php echo htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputEmail">Official Email Address</label>
            <input id="inputEmail" class="field-input" type="email" value="<?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputHallAddress">Barangay Hall Address</label>
            <textarea id="inputHallAddress" class="field-textarea" readonly><?php echo htmlspecialchars($barangayHallAddress, ENT_QUOTES, 'UTF-8'); ?></textarea>
          </div>
        </article>

        <aside class="panel">
          <h2>Security</h2>
          <p class="panel-sub">Update password for this barangay operations account.</p>

          <div class="field-group">
            <label for="pwCurrent">Current Password</label>
            <input id="pwCurrent" class="field-input" type="password" placeholder="Current password">
          </div>

          <div class="field-group">
            <label for="pwNew">New Password</label>
            <input id="pwNew" class="field-input" type="password" placeholder="Minimum 8 characters">
          </div>

          <div class="field-group">
            <label for="pwConfirm">Confirm New Password</label>
            <input id="pwConfirm" class="field-input" type="password" placeholder="Repeat new password">
          </div>

          <button type="button" class="btn btn-primary full" onclick="updatePassword()">Update Password</button>
        </aside>
      </section>
    </main>

    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>

    <script src="../../assets/js/barangays/barangay_header.js"></script>
    <script src="../../assets/js/barangays/barangay_profile.js"></script>
  </body>
</html>
