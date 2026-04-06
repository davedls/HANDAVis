<!doctype html>
<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Responder'], '../../user_home.php');
$responderActivePage = 'profile';
require_once __DIR__ . '/../../database/responder/responders_profile_fetch_data.php';
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Responder Profile</title>
    <link rel="stylesheet" href="../../assets/css/responders/responder_header.css" />
    <link rel="stylesheet" href="../../assets/css/user_footer.css" />
    <link rel="stylesheet" href="../../assets/css/responders/responders_profile.css" />
  </head>
  <body>
    <?php require __DIR__ . '/responder-header.php'; ?>

    <main class="responder-profile-main">
      <div class="back-bar">
        <a href="./index.php" class="back-btn">&larr; Back to Responder Dashboard</a>
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
            <h1 id="displayFullName"><?php echo htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8'); ?></h1>
            <p class="profile-id" id="displayResponderId">Responder ID: <?php echo htmlspecialchars($responderCode, ENT_QUOTES, 'UTF-8'); ?></p>
            <p class="profile-sub" id="displayDept"><?php echo htmlspecialchars($departmentName, ENT_QUOTES, 'UTF-8'); ?> | <?php echo htmlspecialchars($positionRole, ENT_QUOTES, 'UTF-8'); ?></p>
          </div>

          <div class="hero-actions">
            <button type="button" class="btn btn-outline" id="editProfileBtn" onclick="toggleEditMode()">Edit Personal Info</button>
            <button type="button" class="btn btn-primary" id="saveProfileBtn" onclick="saveProfile()" hidden>Save</button>
            <button type="button" class="btn btn-outline" id="cancelProfileBtn" onclick="cancelEdit()" hidden>Cancel</button>
          </div>
        </div>
      </section>

      <section class="grid-two">
        <article class="panel" id="personalPanel">
          <h2>Personal Information</h2>
          <div class="field-row">
            <div class="field-group">
              <label for="inputFirstName">First Name</label>
              <input id="inputFirstName" class="field-input" type="text" value="<?php echo htmlspecialchars((string)$profile['first_name'], ENT_QUOTES, 'UTF-8'); ?>" readonly>
            </div>
            <div class="field-group">
              <label for="inputLastName">Last Name</label>
              <input id="inputLastName" class="field-input" type="text" value="<?php echo htmlspecialchars((string)$profile['last_name'], ENT_QUOTES, 'UTF-8'); ?>" readonly>
            </div>
          </div>

          <div class="field-group">
            <label for="inputResponderId">Responder ID</label>
            <input id="inputResponderId" class="field-input" type="text" value="<?php echo htmlspecialchars($responderCode, ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputPhone">Contact Number</label>
            <input id="inputPhone" class="field-input" type="tel" value="<?php echo htmlspecialchars((string)$profile['phone'], ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputEmail">Email Address</label>
            <input id="inputEmail" class="field-input" type="email" value="<?php echo htmlspecialchars((string)$profile['email'], ENT_QUOTES, 'UTF-8'); ?>" readonly>
          </div>

          <div class="field-group">
            <label for="inputAddress">Address (optional)</label>
            <textarea id="inputAddress" class="field-textarea" readonly><?php echo htmlspecialchars((string)$profile['address'], ENT_QUOTES, 'UTF-8'); ?></textarea>
          </div>
        </article>

        <article class="panel">
          <h2>Department Information</h2>
          <div class="info-list">
            <div class="info-item"><span>Department</span><strong><?php echo htmlspecialchars($departmentName, ENT_QUOTES, 'UTF-8'); ?></strong></div>
            <div class="dept-chips">
              <span class="chip <?php echo $departmentCode === 'police' ? 'active' : ''; ?>">Police</span>
              <span class="chip <?php echo $departmentCode === 'fire' ? 'active' : ''; ?>">Fire Department</span>
              <span class="chip <?php echo ($departmentCode === 'medical' || $departmentCode === 'ambulance') ? 'active' : ''; ?>">Medical / Ambulance</span>
              <span class="chip <?php echo ($departmentCode === 'disaster' || $departmentCode === '') ? 'active' : ''; ?>">Disaster Response Team</span>
            </div>
            <div class="info-item"><span>Assigned Barangay</span><strong><?php echo htmlspecialchars($assignedBarangay, ENT_QUOTES, 'UTF-8'); ?></strong></div>
            <div class="info-item"><span>Position / Role</span><strong><?php echo htmlspecialchars($positionRole, ENT_QUOTES, 'UTF-8'); ?></strong></div>
          </div>
        </article>
      </section>

      <section class="grid-two">
        <article class="panel">
          <h2>Status Information</h2>
          <div class="activity-grid">
            <div class="activity-card"><span>Total incidents handled</span><strong><?php echo (int)$activity['total_handled']; ?></strong></div>
            <div class="activity-card"><span>Active assignments</span><strong><?php echo (int)$activity['active_assignments']; ?></strong></div>
            <div class="activity-card"><span>Resolved incidents</span><strong><?php echo (int)$activity['resolved_incidents']; ?></strong></div>
          </div>
          <div class="info-list">
            <div class="info-item"><span>Current Availability</span><strong class="status-pill status-<?php echo htmlspecialchars($availabilityCode, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($availabilityLabel, ENT_QUOTES, 'UTF-8'); ?></strong></div>
            <div class="info-item"><span>Current Incident Status</span><strong><?php echo htmlspecialchars($currentIncidentStatus, ENT_QUOTES, 'UTF-8'); ?></strong></div>
          </div>
        </article>

        <article class="panel">
          <h2>Account Security</h2>
          <div class="password-box">
            <h3>Change Password</h3>
            <div class="field-group"><label for="pwCurrent">Current Password</label><input id="pwCurrent" class="field-input" type="password"></div>
            <div class="field-group"><label for="pwNew">New Password</label><input id="pwNew" class="field-input" type="password"></div>
            <div class="field-group"><label for="pwConfirm">Confirm Password</label><input id="pwConfirm" class="field-input" type="password"></div>
            <button type="button" class="btn btn-primary full" onclick="updatePassword()">Update Password</button>
          </div>
        </article>
      </section>
    </main>

    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>

    <script src="../../assets/js/responders/responder_header.js"></script>
    <script src="../../assets/js/responders/responders_profile.js"></script>
  </body>
</html>
