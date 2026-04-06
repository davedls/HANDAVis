<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();
?>

<!DOCTYPE html>
<html lang="en">
<head>
	<style>
		@media (max-width: 940px) {
    /* Hide the specific back button link on mobile */
    .settings-hero .back-btn {
        display: none !important;
    }

    /* Optional: Remove any extra gap left at the top of the title */
    .settings-hero {
        padding-top: 10px !important;
    }
}
  @media (max-width: 940px) {
    /* Hides the redundant logo, sections title, and extra logout */
    .sidebar { 
      display: none !important; 
    }
    /* Forces the settings content to fill the screen width */
    .settings-main { 
      padding-left: 0 !important; 
      margin-left: 0 !important; 
      width: 100%;
    }
  }
</style>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - Settings</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo filemtime(__DIR__ . '/handav.png'); ?>">

  <link rel="stylesheet" href="assets/css/font_sizes_option.css">
  <link rel="stylesheet" href="assets/css/user_home.css">
  <link rel="stylesheet" href="assets/css/user_main_header.css">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="assets/css/bigger_buttons.css">
  <link rel="stylesheet" href="assets/css/reduce_animation.css">
  <link rel="stylesheet" href="assets/css/user_settings.css">
</head>
<body>

  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <main class="settings-main">

    <!-- ── Back + Title ── -->
    <div class="settings-hero">
      <a href="user_home.php" class="back-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Back to Dashboard
      </a>
      <h1 class="settings-title">Settings</h1>
      <p class="settings-sub">Manage your display preferences, privacy, and app information.</p>
    </div>

    <!-- ── Section 1: Display & Accessibility ── -->
    <div class="settings-section">
      <div class="section-eyebrow">
        <span class="section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </span>
        Display &amp; Accessibility
      </div>

      <div class="settings-grid">

        <div class="panel">
          <div class="eyebrow">Language</div>
          <div class="section-label">Preferred Language</div>
          <div class="lang-warning">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
           A stable internet connection is recommended. Translation quality and speed depend on your network.
          </div>
          <div class="lang-grid">
            <div class="lang-card" onclick="selectLang(this, 'English')">
              <img src="images/us_flag.png" class="lang-flag-img" alt="English">
              <strong>English</strong>
              <span>Default</span>
            </div>
            <div class="lang-card" onclick="selectLang(this, 'Filipino')">
              <img src="images/ph_flag.png" alt="PH Flag" class="lang-flag-img">
              <strong>Filipino</strong>
              <span>Tagalog</span>
            </div>
            <div class="lang-card" onclick="selectLang(this, 'Hiligaynon')">
              <img src="images/ph_flag.png" alt="PH Flag" class="lang-flag-img">
              <strong>Hiligaynon</strong>
              <span>Ilonggo</span>
            </div>
          </div>
          <div class="eyebrow" style="margin-top:1.375rem;">Font Size</div>
          <div class="font-size-row">
            <button class="font-btn" onclick="setFontSize(this, 'small')">A<span>Small</span></button>
            <button class="font-btn active" onclick="setFontSize(this, 'medium')">A<span>Medium</span></button>
            <button class="font-btn font-lg" onclick="setFontSize(this, 'large')">A<span>Large</span></button>
          </div>
        </div>

        <div class="panel">
          <div class="eyebrow">Accessibility</div>
          <div class="section-label">Visual Preferences</div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>High Contrast Mode</strong>
              <span>Increase text and border contrast for readability</span>
            </div>
            <label class="toggle"><input type="checkbox" id="toggleHighContrast" /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>Reduce Animations</strong>
              <span>Minimize motion effects across the app</span>
            </div>
            <label class="toggle"><input type="checkbox" id="toggleReduceMotion" /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>Large Touch Targets</strong>
              <span>Bigger buttons and tap areas for easier use</span>
            </div>
            <label class="toggle"><input type="checkbox" id="toggleLargeTouch" /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>Screen Reader Support</strong>
              <span>Optimize layout for assistive technologies</span>
            </div>
            <label class="toggle"><input type="checkbox" id="toggleScreenReader" /><span class="toggle-slider"></span></label>
          </div>

          <div class="panel-footer">
            <button class="btn btn-primary" onclick="saveDisplayPrefs()">Save Preferences</button>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Section 2: Privacy ── -->
    <div class="settings-section">
      <div class="section-eyebrow">
        <span class="section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        Privacy
      </div>

      <div class="panel privacy-solo">
        <div class="eyebrow">Report Visibility</div>
        <div class="section-label">Who Sees Your Reports</div>

        <div class="toggle-row">
          <div class="toggle-info">
            <strong>Post Reports Publicly</strong>
            <span>Your hazard reports appear on the community map</span>
          </div>
          <label class="toggle"><input type="checkbox" id="togglePostPublicly" checked /><span class="toggle-slider"></span></label>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <strong>Anonymous Reporting</strong>
            <span>Hide your name from public reports</span>
          </div>
          <label class="toggle"><input type="checkbox" id="toggleAnonymous" /><span class="toggle-slider"></span></label>
        </div>

        <div class="panel-footer">
          <button class="btn btn-primary" onclick="savePrivacyPrefs()">Save Privacy Settings</button>
        </div>
      </div>
    </div>

    <!-- ── Section 3: About ── -->
    <div class="settings-section">
      <div class="section-eyebrow">
        <span class="section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </span>
        About
      </div>

      <div class="about-grid">

        <div class="panel about-panel">
          <div class="about-logo">HANDAVis</div>
          <div class="about-version">Version 1.0.0 — Beta</div>
          <p class="about-desc">HANDAVis is a real-time disaster awareness and response platform for Western Visayas. Built to empower communities, barangay officials, and responders with fast, reliable, and accessible emergency tools.</p>
          <div class="about-links">
            <a href="#" class="about-link" onclick="showToast('Opening Privacy Policy...')">Privacy Policy</a>
            <span class="about-sep">·</span>
            <a href="#" class="about-link" onclick="showToast('Opening Terms of Service...')">Terms of Service</a>
            <span class="about-sep">·</span>
            <a href="#" class="about-link" onclick="showToast('Opening Changelog...')">Changelog</a>
          </div>
        </div>

        <div class="panel about-credits">
          <div class="eyebrow">System Info</div>
          <div class="info-row"><span>Platform</span><strong>HANDAVis Web</strong></div>
          <div class="info-row"><span>Region</span><strong>Western Visayas (Region VI)</strong></div>
          <div class="info-row"><span>Build</span><strong>2025.01 Beta</strong></div>
          <div class="info-row"><span>Last Updated</span><strong>January 2025</strong></div>
          <div class="info-row"><span>Powered By</span><strong>HANDAm Intelligence</strong></div>
          <div class="info-row"><span>Status</span><strong class="status-online">● Online</strong></div>
        </div>

      </div>
    </div>

  </main>

  <?php require __DIR__ . '/includes/user_footer.php'; ?>

  <script src="assets/js/user_main_header.js"></script>
  <script src="assets/js/user_settings.js"></script>
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