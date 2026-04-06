<?php include __DIR__ . '/loader.php'; ?>

<header class="main-header barangay-main-header">
  <div class="header-left">
    <h1 class="logo-text" style="font-size:20px;letter-spacing:-.4px;">HANDAVis</h1>
  </div>

  <div class="search-container">
    <div class="search-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input type="text" id="dashboardSearch" placeholder="Search" onkeyup="handleSearch(this.value)">
    </div>
  </div>

  <div class="header-right">
    <div class="theme-switch-wrapper" onclick="toggleTheme()">
      <div class="theme-switch-track">
        <div class="track-scenery">
          <div class="scenery-night"><span class="star" style="top:5px;left:40px;">*</span></div>
          <div class="scenery-day"><span class="cloud" style="top:8px;right:40px;">o</span></div>
        </div>
        <div class="theme-switch-thumb shield-thumb">
          <svg viewBox="0 0 50 58" class="thumb-shield-svg">
            <path d="M25 2L5 10v15c0 12 8 23 20 28 12-5 20-16 20-28V10L25 2z"/>
          </svg>
        </div>
      </div>
    </div>

    <form id="logoutForm" action="/HANDAVis/database/logout.php" method="post" style="display:flex;align-items:center;">
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
  <div class="mobile-drawer-theme">
    <span class="mobile-drawer-label">Theme</span>
    <div class="theme-switch-wrapper" onclick="toggleTheme()">
      <div class="theme-switch-track">
        <div class="track-scenery">
          <div class="scenery-night"><span class="star" style="top:5px;left:40px;">*</span></div>
          <div class="scenery-day"><span class="cloud" style="top:8px;right:40px;">o</span></div>
        </div>
        <div class="theme-switch-thumb shield-thumb">
          <svg viewBox="0 0 50 58" class="thumb-shield-svg">
            <path d="M25 2L5 10v15c0 12 8 23 20 28 12-5 20-16 20-28V10L25 2z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <div class="mobile-drawer-divider"></div>

  <form action="/HANDAVis/database/logout.php" method="post">
    <button type="button" class="mobile-drawer-item mobile-drawer-logout" onclick="toggleLogoutModal()">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      <span>Logout</span>
    </button>
  </form>
</div>
