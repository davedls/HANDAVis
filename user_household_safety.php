<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();
?>


<!DOCTYPE html>
<html lang="en">
<head>
	<style>
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
  <title>HANDAVis - Household Safety</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo filemtime(__DIR__ . '/handav.png'); ?>">
  <link rel="stylesheet" href="assets/css/user_root.css">
 <link rel="stylesheet" href="assets/css/user_main_header.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_main_header.css') ? filemtime(__DIR__ . '/assets/css/user_main_header.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_dashboard.css">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="assets/css/user_household_safety.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <link rel="stylesheet" href="assets/css/user_watch.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/bigger_buttons.css">    
  <link rel="stylesheet" href="assets/css/reduce_animation.css">
</head>
<body>

  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <div class="dashboard">
    <?php $activePage = 'safetyPage'; require __DIR__ . '/includes/user_dashboard.php'; ?>

    <main class="portal-content">
      <section id="safetyPage" class="page active">

        <div class="topbar">
          <div class="page-head">
            <h1>Household Safety + Smart Evacuation</h1>
            <p>Preparedness, route guidance, emergency contacts, SOS, and offline survival information in one place.</p>
          </div>
          <div class="topbar-actions">
            <span class="chip">🧰 Preparedness</span>
            <span class="chip">🚑 Emergency Ready</span>
          </div>
        </div>

        <!-- Preparedness Score + Checklist + SOS -->
        <div class="content-grid" style="margin-bottom:0;">

          <div class="panel span-4">
            <div class="prep-score-card">
              <div class="eyebrow" style="margin-bottom:6px;">Preparedness Score</div>
              <div class="prep-score-row">
                <div class="prep-score-pct" id="prepScorePct">0%</div>
              </div>
              <div class="prep-score-bar-wrap">
                <div class="prep-score-bar" id="prepScoreBar" style="width:0%"></div>
              </div>
              <div class="prep-score-sub" id="prepScoreSub">Start building your emergency readiness now</div>
            </div>

            <div class="eyebrow" style="margin-top:24px;">Emergency SOS</div>
            <div class="sos-wrap">
              <div class="sos-center">
                <div class="sos-helper-text">Press and hold for 5 seconds</div>

                <select id="sosReason" class="select sos-reason">
                  <option value="">Select emergency reason</option>
                  <option value="Flood Rescue">Flood Rescue</option>
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Fire Emergency">Fire Emergency</option>
                  <option value="Trapped / Cannot Evacuate">Trapped / Cannot Evacuate</option>
                </select>

                <button class="sos-btn" id="sosBtn" type="button">
                  <span id="sosLabel">HOLD SOS</span>
                  <small id="sosTimer">5</small>
                </button>

                <div id="sosConfirmBox" class="sos-confirm-box" style="display:none;">
                  <div class="sos-confirm-text">Confirm emergency signal?</div>
                  <div class="sos-confirm-actions">
                    <button class="btn" id="confirmSOSBtn" type="button">Confirm SOS</button>
                    <button class="btn secondary" id="cancelSOSBtn" type="button">Cancel</button>
                  </div>
                </div>

                <div id="sosStatusText" class="footer-note">
                  Nearby responders and barangay officials will be notified.
                </div>
              </div>
            </div>
          </div>

          <div class="panel span-8">
            <div class="eyebrow">Emergency Checklist</div>
            <div class="checklist" id="emergencyChecklist">

              <label class="checklist-item" data-key="kit">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Emergency Kit Ready</strong>
                  <span>Water, food, meds for 72hrs</span>
                </span>
              </label>

              <label class="checklist-item" data-key="documents">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Important Documents</strong>
                  <span>IDs, insurance, birth certs</span>
                </span>
              </label>

              <label class="checklist-item" data-key="contacts">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Emergency Contacts Saved</strong>
                  <span>Family, DRRMO, hospitals</span>
                </span>
              </label>

              <label class="checklist-item" data-key="evacroute">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Evacuation Route Known</strong>
                  <span>Nearest center identified and planned</span>
                </span>
              </label>

              <label class="checklist-item" data-key="meetingpoint">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Family Meeting Point Set</strong>
                  <span>Agreed location if separated during disaster</span>
                </span>
              </label>

              <label class="checklist-item" data-key="gobag">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Go-Bag Packed</strong>
                  <span>Ready-to-grab bag with essentials</span>
                </span>
              </label>

              <label class="checklist-item" data-key="powerbank">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>Devices Charged / Power Bank Ready</strong>
                  <span>Phone, radio, flashlight, power bank</span>
                </span>
              </label>

              <label class="checklist-item" data-key="firstaid">
                <input type="checkbox" class="checklist-check" onchange="updatePrepScore()">
                <span class="checklist-circle"></span>
                <span class="checklist-text">
                  <strong>First Aid Kit Available</strong>
                  <span>Bandages, antiseptic, prescription meds</span>
                </span>
              </label>

            </div>
          </div>

        </div>

        <!-- ═══════════════ SCENARIO SIMULATION ═══════════════ -->
        <h2 class="section-title">Scenario Simulation</h2>
        <div class="content-grid">
          <div class="panel span-12">
            <div class="eyebrow">Scenario Simulation</div>

            <div class="scenario-sim" id="scenarioSim" data-scenario="flood" data-severity="high">

              <div class="scenario-preview" id="scenarioPreview">
                <div class="scenario-preview-copy">
                  <strong id="simScenarioTitle">Flood Scenario</strong>
                  <span id="simContext">Bacolod City • High severity • Now</span>
                </div>
                <span class="scenario-time-badge" id="simTimeBadge">Now</span>
              </div>

              <div class="scenario-tabs" role="tablist" aria-label="Scenario Simulation">
                <button type="button" class="scenario-tab is-active" data-scenario="flood" aria-selected="true" >
                  <span class="scenario-icon">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 20c2-3 4-5 6-5s4 4 6 4 4-5 6-5 4 3 6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M4 26c2-3 4-5 6-5s4 4 6 4 4-5 6-5 4 3 6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>
                      <path d="M10 16V8l6-4 6 4v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span class="scenario-tab-label">Flood Scenario</span>
                </button>

                <button type="button" class="scenario-tab" data-scenario="fire" aria-selected="false" >
                  <span class="scenario-icon">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 28c6 0 10-4 10-9 0-3-2-6-4-8-1 3-2 4-4 4 1-4-2-8-4-11-2 5-6 8-6 15 0 5 4 9 8 9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M16 28c2 0 4-2 4-4 0-2-1-3-2-4-.5 1-1 2-2 2 .5-2-1-4-2-5-1 2-2 4-2 7 0 2 2 4 4 4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
                    </svg>
                  </span>
                  <span class="scenario-tab-label">Fire Scenario</span>
                </button>

                <button type="button" class="scenario-tab" data-scenario="storm" aria-selected="false" >
                  <span class="scenario-icon">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M6 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M4 24h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M20 6c3 0 6 2 6 6s-2 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span class="scenario-tab-label">Storm Scenario</span>
                </button>

                <button type="button" class="scenario-tab" data-scenario="roadblock" aria-selected="false" >
                  <span class="scenario-icon">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 22h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M9 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M23 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M9 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M11 14l2 2m0-2-2 2m8-2 2 2m0-2-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span class="scenario-tab-label">Roadblock</span>
                </button>

                <button type="button" class="scenario-tab" data-scenario="quake" aria-selected="false" >
                  <span class="scenario-icon">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 4l-4 10h5l-3 14 10-14h-5l3-10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span class="scenario-tab-label">Earthquake / Ashfall</span>
                </button>

                <button type="button" class="scenario-tab" data-scenario="medical" aria-selected="false" >
                  <span class="scenario-icon">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 8v16M8 16h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
                      <rect x="6" y="6" width="20" height="20" rx="6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </span>
                  <span class="scenario-tab-label">Medical</span>
                </button>
              </div>

              <div class="scenario-controls">
                <label class="scenario-field scenario-field-location" data-field="location">
                  <span>Location</span>
                  <select id="simLocation" title="Use Current Location">
                    <option value="current" selected>Use Current Location</option>
                  </select>
                </label>
                <label class="scenario-field scenario-field-severity" data-field="severity">
                  <span>Severity</span>
                  <select id="simSeverity">
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high" selected>High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label class="scenario-field scenario-field-time" data-field="time">
                  <span>Time Window</span>
                  <select id="simTime">
                    <option value="now" selected>Now</option>
                    <option value="6h">Next 6 Hours</option>
                    <option value="12h">Next 12 Hours</option>
                    <option value="24h">Next 24 Hours</option>
                  </select>
                </label>
              </div>

              <div class="scenario-radar-wrap">
                <div class="scenario-card command-card" id="radarCard" data-scenario="flood" data-severity="high">
                  <div class="scenario-card-head command-card-head">
                    <div>
                      <div class="scenario-card-title">Situation Assessment</div>
                      <p class="radar-card-subtitle">Current scenario, live trigger, best support point, action priority, and a route-ready decision for your selected Western Visayas location.</p>
                    </div>
                    <span class="radar-status-pill" id="radarStatusPill">Prepare to move</span>
                  </div>
                  <div class="command-summary-bar">
                    <div class="command-summary-main">
                      <small id="radarRegionLabel">Western Visayas • Bacolod City</small>
                      <strong id="radarRiskLabel">FLOOD</strong>
                      <small id="radarRiskSub">High • Now</small>
                    </div>
                    <div class="command-summary-tags">
                      <span class="command-tag" id="radarScenarioTag">🌊 Scenario: Flood</span>
                      <span class="command-tag" id="radarLocationTag">📍 Location: Bacolod City</span>
                      <span class="command-tag" id="radarSeverityTag">⚠ Severity: High</span>
                      <span class="command-tag" id="radarTimeTag">🕒 Time: Now</span>
                    </div>
                  </div>
                  <div class="radar-decision-grid">
                    <div class="radar-mini-card">
                      <span>Risk Score</span>
                      <strong id="radarRiskScore">78 / 100</strong>
                      <small id="radarRiskScoreNote">High attention needed.</small>
                    </div>
                    <div class="radar-mini-card">
                      <span>Action Priority</span>
                      <strong id="radarActionPriority">Pre-position essentials</strong>
                      <small id="radarActionNote">Prepare for fast movement.</small>
                    </div>
                    <div class="radar-mini-card">
                      <span>Safe Place Focus</span>
                      <strong id="radarSafePlace">Bacolod City Government Center</strong>
                      <small id="radarPrimaryContact">Primary contact: Bacolod DRRMO Mobile</small>
                    </div>
                    <div class="radar-mini-card">
                      <span>Live Trigger</span>
                      <strong id="radarLiveTrigger">Simulation mode active</strong>
                      <small id="radarLiveTriggerMeta">Connect to the Live Alerts page for real-time Western Visayas advisories.</small>
                    </div>
                  </div>
                  <div class="radar-decision-note" id="radarDecisionText">Low-lying roads may turn unsafe quickly, so move early and keep the best support point visible before conditions worsen.</div>
                </div>
              </div>

              <div class="scenario-main-grid">
                <div class="scenario-card">
                  <div class="scenario-card-title">Expected Impact</div>
                  <span class="scenario-risk-pill high" id="simRiskBadge">HIGH</span>
                  <ul class="scenario-bullets" id="simImpactList"></ul>
                  <button type="button" class="scenario-toggle-btn" id="simImpactToggle" aria-controls="simImpactList" aria-expanded="false" hidden>See more</button>
                </div>
                <div class="scenario-card">
                  <div class="scenario-card-title">What To Do Now</div>
                  <ul class="scenario-checklist" id="simActionList"></ul>
                  <button type="button" class="scenario-toggle-btn" id="simActionToggle" aria-controls="simActionList" aria-expanded="false" hidden>See more</button>
                </div>
                <div class="scenario-card">
                  <div class="scenario-card-title">Nearest Safe Places</div>
                  <div class="scenario-safe-list" id="simSafePlaces"></div>
                </div>
                <div class="scenario-card">
                  <div class="scenario-card-title">Emergency Contacts</div>
                  <div class="scenario-contact-list" id="simContacts"></div>
                </div>
              </div>

              <div class="scenario-footer">
                <div class="scenario-helper-note" id="simSummaryNote">Use this simulation as quick guidance and still follow official advisories.</div>
                <div class="scenario-footer-actions">
                  <button type="button" class="scenario-ghost-btn" id="simRouteBtn">Find Closest Safe Route</button>
                  <button type="button" class="scenario-primary-btn" id="simPlanBtn">Save Emergency Plan</button>
                </div>
              </div>

            </div>
          </div>
        </div>
        <!-- ═══════════════ END SCENARIO SIMULATION ═══════════════ -->

        <!-- ═══════════════ ACTION HUB ═══════════════ -->
        <h2 class="section-title">Route &amp; Action Hub</h2>
        <div class="content-grid">
          <div class="panel span-12 advisory-panel">

            <div class="advisory-support-card" id="advisorySupportCard">
  <div class="support-card-head">
    <div>
      <div class="support-card-kicker">Action Hub</div>
      <h3>Closest Route &amp; Priority Support</h3>
      <p id="routeSummary">Use your current location to draw the closest recommended route and surface the safest support point for the selected hazard.</p>
    </div>

    <button type="button" class="support-locate-btn" id="routeLocateBtn">Use My Location</button>

    <div id="locationSearchGroup" class="loc-search-container" style="display: none;">
      <div class="loc-input-wrapper">
        <div class="loc-row">
          <span class="dot blue"></span>
          <div class="pill-text">Current location</div>
          <i class="fas fa-globe-asia globe-icon"></i>
        </div>
        <div class="loc-connector"></div>
        <div class="loc-row">
          <span class="dot red"></span>
          <div class="pill-input-container">
            <input type="text" placeholder="Find airports or centers..." id="centerSearchInput">
            <i class="fas fa-camera camera-icon"></i>
          </div>
          <button class="add-btn"><i class="fas fa-plus"></i></button>
        </div>
      </div>
    </div>
  </div>
</div>

              <div class="support-stats">
                <div class="support-stat">
                  <span>Destination</span>
                  <strong id="routeTargetName">Waiting for route</strong>
                  <small id="routeTargetSub">Choose a scenario, then find a route.</small>
                </div>
                <div class="support-stat">
                  <span>ETA</span>
                  <strong id="routeEta">--</strong>
                  <small id="routeDistance">Distance will appear here.</small>
                </div>
                <div class="support-stat">
                  <span>Travel Advice</span>
                  <strong id="routeAdvice">Stand by</strong>
                  <small id="routeModeHint">Fastest guide updates after your location is shared.</small>
                </div>
              </div>

              <div class="route-options-wrap">
                <div class="route-directions-head">
                  <span class="route-directions-title">Route Options</span>
                  <span class="route-directions-hint" id="routeOptionsHint">Compare the recommended route with other nearby options.</span>
                </div>
                <div class="route-options" id="routeOptions">
                  <div class="route-option-empty">Tap <strong>Use My Location</strong> to load multiple route choices.</div>
                </div>
              </div>

              <div class="route-map-wrap">
                <div class="route-map" id="routeMap" aria-label="Recommended route map"></div>
              </div>

              <div class="route-directions-wrap">
                <div class="route-directions-head">
                  <span class="route-directions-title">Direction Guide</span>
                  <span class="route-directions-hint" id="routeDirectionsHint">The line guide appears after route calculation.</span>
                </div>
                <ol class="route-directions" id="routeDirections">
                  <li>Tap <strong>Use My Location</strong> to calculate the fastest route from your current position.</li>
                </ol>
              </div>
            </div>

          </div>
		  
        <!-- ═══════════════ END ACTION HUB ═══════════════ -->

      </section>
		 <?php include __DIR__ . '/includes/user_watch.php'; ?>
    </main>

    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <div id="toast" class="toast"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="assets/js/user_dashboard.js"></script>
	 <script src="assets/js/user_main_header.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_main_header.js') ? filemtime(__DIR__ . '/assets/js/user_main_header.js') : time(); ?>"></script>
<script>
    // Tells JS which town the user belongs to as a backup
    window.USER_REGISTERED_TOWN = "<?php echo $_SESSION['user_municipality'] ?? 'Bacolod'; ?>";
  window.USER_REGISTERED_BARANGAY = "<?php echo $_SESSION['user_barangay'] ?? ($_SESSION['user_municipality'] ?? ''); ?>";
  window.USER_REGISTERED_BARANGAY_ID = "<?php echo $_SESSION['barangay_id'] ?? ($_SESSION['user_barangay_id'] ?? ''); ?>";
  </script>

  <script src="assets/js/user_household_safety.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_household_safety.js') ? filemtime(__DIR__ . '/assets/js/user_household_safety.js') : time(); ?>"></script>

  <script src="assets/js/user_checklist.js"></script>
  <script src="assets/js/user_watch.js?v=<?php echo time(); ?>"></script>
  <script src="assets/js/user_settings.js"></script>
</body>
</html>