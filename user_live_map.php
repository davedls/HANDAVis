<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - Live Disaster Map</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo file_exists(__DIR__ . '/images/handa.png') ? filemtime(__DIR__ . '/images/handa.png') : time(); ?>">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="assets/css/user_root.css">
  <link rel="stylesheet" href="assets/css/user_main_header.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_main_header.css') ? filemtime(__DIR__ . '/assets/css/user_main_header.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_dashboard.css">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="assets/css/user_live_map.css?v=<?php echo filemtime(__DIR__ . '/assets/css/user_live_map.css'); ?>">
	<link rel="stylesheet" href="assets/css/user_watch.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/bigger_buttons.css">
  <link rel="stylesheet" href="assets/css/reduce_animation.css">

</head>
<body>
  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <div class="dashboard">
    <?php $activePage = 'mapPage'; require __DIR__ . '/includes/user_dashboard.php'; ?>

    <main class="portal-content">
      <section id="mapPage" class="page active">

        <div class="topbar">
          <div class="page-head">
            <h1>Live Disaster Map</h1>
            <p>Map-first view for nearby hazards, open centers, route guidance, forecast overlays, live Western Visayas weather, and an organized Safety Circle with SOS and Safe Check-In.</p>
          </div>
          <div class="topbar-actions">
            <span class="chip">🌦 Live Weather + Typhoon</span>
            <span class="chip">👥 Safety Circle</span>
          </div>
        </div>

        <div class="content-grid">

          <div class="panel span-12 map-panel-full">
            <div class="eyebrow">Regional Map View</div>

            <!-- ── Map Filter Bar ── -->
            <div class="map-filter-wrap">
              <div class="map-filter-scroll" id="mapFilterTabs">

                <button class="map-filter-tab mft-active" data-type="all" onclick="setMapFilter(this,'all')">
                  🌐 All Types
                </button>
                <button id="mapWeatherFilterBtn" class="map-filter-tab mft-weather weather-theme-sun" data-type="weather" onclick="setMapFilter(this,'weather')">
                  🌦 Weather
                </button>
                <button class="map-filter-tab mft-flood" data-type="flood" onclick="setMapFilter(this,'flood')">
                  💧 Flood
                </button>
                <button class="map-filter-tab mft-typhoon" data-type="typhoon" onclick="setMapFilter(this,'typhoon')">
                  🌀 Typhoon
                </button>
                <button class="map-filter-tab mft-earthquake" data-type="earthquake" onclick="setMapFilter(this,'earthquake')">
                  🌍 Earthquake
                </button>
                <button class="map-filter-tab mft-fire" data-type="fire" onclick="setMapFilter(this,'fire')">
                  🔥 Fire
                </button>
                <button class="map-filter-tab mft-landslide" data-type="landslide" onclick="setMapFilter(this,'landslide')">
                  ⛰ Landslide
                </button>
                <button class="map-filter-tab mft-medical" data-type="medical" onclick="setMapFilter(this,'medical')">
                  🏥 Medical
                </button>
                <button class="map-filter-tab mft-evac" data-type="evac" onclick="setMapFilter(this,'evac')">
                  🏠 Evacuation Centers
                </button>

              </div>
              <button class="map-refresh-btn" onclick="refreshMap()" title="Refresh map">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  <polyline points="12,2 12.5,4.8 9.7,5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <div class="map-shell">
              <div id="map" class="map"></div>

              <button id="circleFab" class="circle-fab" type="button" aria-expanded="false">
                <span class="circle-fab-icon">◎</span>
                <span>Safety Circle</span>
                <span id="circleFabCount" class="circle-fab-count">0</span>
              </button>

              <aside id="circlePanel" class="circle-panel hidden" aria-live="polite">
                <div class="circle-panel-head">
                  <div>
                    <h3>Safety Circle</h3>
                    <p id="circleSummaryText">Trusted member map is ready.</p>
                  </div>
                  <div class="circle-panel-tools">
                    <button id="circleLocateBtn" class="circle-head-btn" type="button">Use My Location</button>
                    <button id="circlePanelClose" class="circle-panel-close panel-window-btn panel-window-btn-minimize" type="button" aria-label="Minimize safety circle" title="Minimize Safety Circle">
                      <span class="panel-window-icon" aria-hidden="true"></span>
                    </button>
                  </div>
                </div>

                <div class="circle-summary-strip">
                  <div class="circle-summary-pill">
                    <span>Tracked</span>
                    <strong id="circleTrackedCount">0</strong>
                  </div>
                  <div class="circle-summary-pill">
                    <span>Near Hazard</span>
                    <strong id="circleRiskCount">0</strong>
                  </div>
                  <div class="circle-summary-pill">
                    <span>Last Sync</span>
                    <strong id="circleSyncText">--</strong>
                  </div>
                </div>

                <div class="circle-self-status-card">
                  <div class="circle-self-status-top">
                    <div>
                      <span class="circle-self-kicker">My Safety Status</span>
                      <strong id="circleCheckinStatusLabel">Not checked in yet</strong>
                    </div>
                    <span id="circleCheckinTime" class="circle-checkin-time">--</span>
                  </div>
                  <div class="circle-self-actions">
                    <button id="circleSafeBtn" class="circle-self-btn safe" type="button">I'm Safe</button>
                    <button id="circleHelpBtn" class="circle-self-btn warn" type="button">Need Help</button>
                    <button id="circleSosBtn" class="circle-self-btn danger" type="button">SOS</button>
                  </div>
                  <p class="circle-self-note">Use these quick actions to update your Safety Circle instantly. Safe, help, and SOS updates now notify connected people in the circle.</p>
                </div>

                <div class="circle-add-card">
                  <div class="circle-add-card-top">
                    <div>
                      <span class="circle-self-kicker">Add People</span>
                      <strong>Build your own Safety Circle</strong>
                    </div>
                    <button id="circleSearchMemberBtn" class="circle-head-btn" type="button">Search</button>
                  </div>
                  <div class="circle-add-form">
                    <input id="circleMemberSearchInput" type="text" placeholder="Search by name or email" autocomplete="off">
                    <input id="circleMemberRelationInput" type="text" placeholder="Relation label (optional)">
                  </div>
                  <div id="circleAddMemberResults" class="circle-add-results" aria-live="polite"></div>
                </div>

                <div class="circle-insights-grid">
                  <section class="circle-mini-card">
                    <div class="circle-mini-head">
                      <div>
                        <span class="circle-self-kicker">Saved Places</span>
                        <strong>Arrival & departure alerts</strong>
                      </div>
                      <button id="circleSavePlaceBtn" class="circle-head-btn" type="button">Save Current Place</button>
                    </div>
                    <div class="circle-place-form">
                      <input id="circlePlaceLabelInput" type="text" placeholder="Place name (Home, School, Work)">
                      <input id="circlePlaceRadiusInput" type="number" min="100" max="2000" step="50" value="250" placeholder="Radius in meters">
                    </div>
                    <div id="circlePlaceList" class="circle-place-list" aria-live="polite"></div>
                  </section>

                  <section class="circle-mini-card">
                    <div class="circle-mini-head">
                      <div>
                        <span class="circle-self-kicker">Recent Activity</span>
                        <strong>Live circle timeline</strong>
                      </div>
                    </div>
                    <div id="circleActivityList" class="circle-activity-list" aria-live="polite"></div>
                  </section>
                </div>

                <div id="circleMemberList" class="circle-member-list"></div>

                <div class="circle-panel-footer">
                  <div class="circle-footer-note">Members only appear on the map while this panel is open so your disaster map stays clean.</div>
                  <div class="circle-footer-actions">
                    <button id="circleFitAllBtn" class="circle-footer-btn" type="button">View All</button>
                    <button id="circleClearRouteBtn" class="circle-footer-btn ghost" type="button">Clear Route</button>
                  </div>
                </div>
              </aside>

              <button id="weatherReopenBtn" class="weather-reopen-btn panel-window-btn panel-window-btn-maximize hidden" type="button" aria-label="Maximize weather panel" title="Maximize Weather" hidden>
                <span class="panel-window-icon" aria-hidden="true"></span>
              </button>
              <aside id="weatherPanel" class="weather-panel" aria-live="polite">
                <div class="weather-panel-head">
                  <div>
                    <h3 id="weatherCity">Select a city</h3>
                    <p id="weatherUpdated">Click a city marker to load weather</p>
                  </div>
                  <div class="weather-panel-actions">
                    <button id="weatherModeToggle" class="weather-mode-btn" type="button" aria-pressed="false">Show Forecast</button>
                    <button id="weatherClose" class="weather-close panel-window-btn panel-window-btn-minimize" type="button" aria-label="Minimize weather panel" title="Minimize Weather">
                      <span class="panel-window-icon" aria-hidden="true"></span>
                    </button>
                  </div>
                </div>
                <div id="weatherBody" class="weather-body">
                  <div class="weather-hero">
                    <div class="weather-hero-left">
                      <span id="weatherIcon" class="weather-icon weather-icon-large" aria-hidden="true"></span>
                      <div class="weather-hero-copy">
                        <span id="weatherConditionBadge" class="weather-condition-badge neutral">Live Conditions</span>
                        <span id="weatherCondition" class="weather-hero-condition">No city selected</span>
                      </div>
                    </div>
                    <strong id="weatherTemp">--°C</strong>
                  </div>
                  <div class="weather-detail-grid">
                    <div><span>RealFeel</span><strong id="weatherRealFeel">--°C</strong></div>
                    <div><span>Humidity</span><strong id="weatherHumidity">--%</strong></div>
                    <div><span>Wind</span><strong id="weatherWind">-- km/h</strong></div>
                    <div><span>UV Index</span><strong id="weatherUv">--</strong></div>
                  </div>

                  <div id="weatherTyphoonSection" class="weather-typhoon-section is-inactive">
                    <div class="weather-typhoon-head">
                      <div>
                        <span class="typhoon-card-kicker">Typhoon Tracker</span>
                        <strong id="typhoonStormName">No active tropical cyclone</strong>
                        <p id="typhoonStormMeta">Waiting for live advisory data.</p>
                      </div>
                      <span id="typhoonStormStatus" class="typhoon-status-pill inactive">Inactive</span>
                    </div>
                    <div class="weather-typhoon-grid">
                      <div><span>Wind</span><strong id="typhoonWind">-- km/h</strong></div>
                      <div><span>Gust</span><strong id="typhoonGust">-- km/h</strong></div>
                      <div><span>Movement</span><strong id="typhoonMovement">--</strong></div>
                      <div><span>Updated</span><strong id="typhoonUpdated">--</strong></div>
                    </div>
                    <div id="typhoonSourceNote" class="weather-typhoon-note">Pulls the latest typhoon status from your live feed and renders a cone on the map when track points are available.</div>
                  </div>
                </div>
                <div id="weatherForecastBody" class="weather-forecast-body hidden" hidden>
                  <div class="forecast-header-row">
                    <span>DAILY FORECAST</span>
                    <span>TEMP. °C</span>
                  </div>
                  <div class="forecast-list" id="weatherForecastList"></div>
                </div>
              </aside>
            </div>
          </div>

        </div>

        <h2 class="section-title">Crowdsourced Disaster Confidence System</h2>
        <div class="confidence-board">
          <div class="confidence-card">
            <div class="confidence-top">
              <strong>Flood Report — Tangub</strong>
              <div class="confidence-value" id="confidenceTangubLabel">84%</div>
            </div>
            <div class="confidence-bar">
              <div id="confidenceTangubBar" style="width:84%"></div>
            </div>
            <div class="footer-note">Based on nearby users, barangay confirmations, and repeated incident matching.</div>
          </div>

          <div class="confidence-card">
            <div class="confidence-top">
              <strong>Road Block — Main Highway</strong>
              <div class="confidence-value" id="confidenceRoadLabel">46%</div>
            </div>
            <div class="confidence-bar">
              <div id="confidenceRoadBar" style="width:46%"></div>
            </div>
            <div class="footer-note">Confidence rises as more users confirm, upload evidence, or matching reports appear.</div>
          </div>
        </div>

        <h2 class="section-title">Safety Circle + Live Weather Coverage</h2>
        <div class="panel">
          <div class="eyebrow">Real-time Readiness</div>
          <div class="mesh-grid" id="weatherCoverageGrid">
            <div class="mesh-node active">
              <strong id="weatherCoverageCount">0</strong>
              <span>Live mapped places</span>
            </div>
            <div class="mesh-node active">
              <strong id="weatherCoverageMode">Realtime</strong>
              <span>Weather source mode</span>
            </div>
            <div class="mesh-node active">
              <strong id="safetyCircleStatusCard">Stand By</strong>
              <span>My circle status</span>
            </div>
            <div class="mesh-node active">
              <strong id="lastWeatherSyncCard">--</strong>
              <span>Last weather sync</span>
            </div>
          </div>
          <div class="footer-note" id="meshStatusText">
            Western Visayas city and municipality markers are rendered on the map, while a live PSGC-backed finder loads all Region VI barangays so you can jump to any barangay without overcrowding the map.
          </div>
        </div>

      </section>
		<?php include __DIR__ . '/includes/user_watch.php'; ?>
    </main>
    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <div id="toast" class="toast"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="assets/js/user_dashboard.js"></script>
 <script src="assets/js/user_main_header.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_main_header.js') ? filemtime(__DIR__ . '/assets/js/user_main_header.js') : time(); ?>"></script>
  <script src="assets/api/weather-api.js"></script>
  <script src="assets/js/user_live_map.js?v=<?php echo filemtime(__DIR__ . '/assets/js/user_live_map.js'); ?>"></script>
	<script src="assets/js/user_watch.js?v=<?php echo time(); ?>"></script>
    <script src="assets/js/user_settings.js"></script>
</body>
</html>
