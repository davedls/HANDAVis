<?php

$activePage = $activePage ?? 'dashboardPage';

?>

<aside class="sidebar">

  <div class="sidebar-inner">

<div class="brand-box">

    <a href="user_home.php" class="logo-link">

        <img src="images/handav.png" alt="HANDAVis Logo" class="sidebar-logo-hero">

    </a>

</div>

  <div class="nav-section-title">Sections</div>



  <button class="sub-link<?= $activePage === 'dashboardPage' ? ' active' : '' ?>" data-page="dashboardPage" onclick="openPage(event,'dashboardPage')">

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>

    <span>Dashboard</span>

  </button>

  <button class="sub-link<?= $activePage === 'alertsPage' ? ' active' : '' ?>" data-page="alertsPage" onclick="openPage(event,'alertsPage')">

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>

    <span>Alerts</span>

  </button>

  <button class="sub-link<?= $activePage === 'mapPage' ? ' active' : '' ?>" data-page="mapPage" onclick="openPage(event,'mapPage')">

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>

    <span>Live Map</span>

  </button>

  <button class="sub-link<?= $activePage === 'reportPage' ? ' active' : '' ?>" data-page="reportPage" onclick="openPage(event,'reportPage')">

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>

    <span>Hazard Report</span>

  </button>

  <button class="sub-link<?= $activePage === 'safetyPage' ? ' active' : '' ?>" data-page="safetyPage" onclick="openPage(event,'safetyPage')">

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>

    <span>Household Safety</span>

  </button>

<button class="sub-link<?= $activePage === 'watchPage' ? ' active' : '' ?>" data-page="watchPage" onclick="openPage(event,'watchPage')">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
    <span>Watch</span>
  </button>

  <button class="sub-link<?= $activePage === 'aiPage' ? ' active' : '' ?>" data-page="aiPage" onclick="openPage(event,'aiPage')">

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>

    <span>AI Assistant</span>

  </button>

  </div>

</aside>