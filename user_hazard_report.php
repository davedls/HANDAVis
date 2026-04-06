<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();

require_once __DIR__ . '/database/hazard_reports.php';
$hazardBootstrap = ['context' => null, 'reports' => null];
try {
  $hazardUser = hv_get_current_user();
  $hazardBootstrap['context'] = hv_context_payload($hazardUser);
  $hazardBootstrap['reports'] = hv_fetch_reports_by_barangay_scope($hazardUser);
} catch (Throwable $e) {
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - Hazard Report</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo filemtime(__DIR__ . '/images/handa.png'); ?>">

  <link rel="stylesheet" href="assets/css/user_root.css">
 <link rel="stylesheet" href="assets/css/user_main_header.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_main_header.css') ? filemtime(__DIR__ . '/assets/css/user_main_header.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_dashboard.css">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="assets/css/user_hazard_report.css?v=<?php echo filemtime(__DIR__ . '/assets/css/user_hazard_report.css'); ?>">
  <link rel="stylesheet" href="assets/css/user_watch.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/bigger_buttons.css">  
  <link rel="stylesheet" href="assets/css/reduce_animation.css">

</head>
<body>
  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <div class="dashboard">
    <?php $activePage = 'reportPage'; require __DIR__ . '/includes/user_dashboard.php'; ?>

    <main class="portal-content">
      <section id="reportPage" class="page active report-page-wrap">
        <div class="report-app-shell">

          <div class="report-hero report-surface">
            <span class="report-eyebrow">COMMUNITY REPORTING</span>
            <h1>One-Tap Hazard Report</h1>
            <p>Fast, clear, and location-aware reporting for Western Visayas communities.</p>
          </div>

          <div class="report-block">
            <div class="report-label">SELECT HAZARD TYPE</div>

            <div id="quickTypes" class="hazard-grid">
              <button type="button" class="hazard-card hazard-flood active" onclick="selectQuick(this, 'Flood')">
                <span class="hazard-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.5 10.5 12 5l7.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7 9.8V15h10V9.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M9.5 15v-2.5h5V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M4 18c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M4 21c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </span>
                <span>FLOOD</span>
              </button>

              <button type="button" class="hazard-card hazard-fire" onclick="selectQuick(this, 'Fire')">
                <span class="hazard-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.2 2.5c1.7 2.05 2.28 4 .94 5.93-.54.78-1.39 1.47-2.08 2.21C10.08 11.72 9 13.23 9 15a3 3 0 0 0 6 0c0-1.52-.74-2.62-1.77-3.84-.56-.67-.86-1.42-.74-2.36.08-.62.27-1.11.71-1.92Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12.05 11.2c-1.46 1.07-2.05 2.05-2.05 3.15a2 2 0 0 0 4 0c0-.82-.33-1.45-1.05-2.25-.41-.46-.62-.98-.56-1.73-.13.15-.22.28-.34.41Z" fill="currentColor" opacity=".28"/>
                    <path d="M12 10.9c-1.25.98-1.8 1.86-1.8 2.88a1.8 1.8 0 0 0 3.6 0c0-.74-.31-1.31-.96-2.03-.36-.4-.56-.86-.52-1.5-.09.1-.18.2-.32.34Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
                <span>FIRE</span>
              </button>

              <button type="button" class="hazard-card hazard-storm" onclick="selectQuick(this, 'Storm')">
                <span class="hazard-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 16a4 4 0 1 1 .7-7.94A5 5 0 0 1 17 10a3.5 3.5 0 0 1-.5 6.97H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M12.5 12.5 10 17h2.2l-.7 3.5L15 15.5h-2.2l.7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
                  </svg>
                </span>
                <span>STORM</span>
              </button>

              <button type="button" class="hazard-card hazard-roadblock" onclick="selectQuick(this, 'Road Block')">
                <span class="hazard-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 8h14l-1.5 6h-11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M8 14v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M16 14v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M7.5 8 10 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M12 8l2.5 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M16.5 8 19 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </span>
                <span>ROAD BLOCK</span>
              </button>

              <button type="button" class="hazard-card hazard-earthquake" onclick="selectQuick(this, 'Earthquake')">
                <span class="hazard-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 5h10v14H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M9.5 9.5 12 12l-2 2.5L12 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M17 9h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M17 15h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </span>
                <span>EARTHQUAKE</span>
              </button>

              <button type="button" class="hazard-card hazard-medical" onclick="selectQuick(this, 'Medical')">
                <span class="hazard-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M12 8.5v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M8.5 12h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </span>
                <span>MEDICAL</span>
              </button>
            </div>
          </div>

          <div class="report-block">
            <div class="report-label">EXACT LOCATION / BARANGAY</div>
            <p class="report-helper">Add the barangay plus a street, purok, school, bridge, or nearest landmark.</p>

            <div class="field-wrap icon-left">
              <span class="field-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
                </svg>
              </span>
              <input id="reportLocation" class="report-input" type="text" placeholder="Brgy. Name, City/Municipality, nearest landmark">
            </div>

            <div class="location-tools-row">
              <button type="button" class="mini-action-btn" onclick="useCurrentLocation()">
                <span class="mini-action-icon">📍</span>
                <span>USE CURRENT LOCATION</span>
              </button>
              <span id="locationStatus" class="location-status">No GPS location used yet. Alerts still use your saved area.</span>
            </div>
          </div>

          <div class="report-block">
            <div class="report-label">QUICK DETAILS</div>
            <p class="report-helper">These taps are faster for users and easier for responders to scan than long paragraphs.</p>

            <div class="detail-group">
              <span class="detail-group-title">PEOPLE AFFECTED</span>
              <div class="detail-chip-row" id="peopleAffectedRow">
                <button type="button" class="detail-chip active" onclick="selectDetail(this, 'peopleAffected', '1–5')">1–5</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'peopleAffected', '6–20')">6–20</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'peopleAffected', '20+')">20+</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'peopleAffected', 'Unknown')">Unknown</button>
              </div>
            </div>

            <div class="detail-group">
              <span class="detail-group-title">INJURIES</span>
              <div class="detail-chip-row" id="injuriesRow">
                <button type="button" class="detail-chip active" onclick="selectDetail(this, 'injuries', 'None')">None</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'injuries', 'Possible')">Possible</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'injuries', 'Confirmed')">Confirmed</button>
              </div>
            </div>

            <div class="detail-group">
              <span class="detail-group-title">ROAD STATUS</span>
              <div class="detail-chip-row" id="roadStatusRow">
                <button type="button" class="detail-chip active" onclick="selectDetail(this, 'roadStatus', 'Passable')">Passable</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'roadStatus', 'Slow')">Slow</button>
                <button type="button" class="detail-chip" onclick="selectDetail(this, 'roadStatus', 'Blocked')">Blocked</button>
              </div>
            </div>

            <div class="detail-group" id="hazardSpecificWrap">
              <span class="detail-group-title" id="hazardSpecificLabel">FLOOD DEPTH</span>
              <div class="detail-chip-row" id="hazardSpecificRow"></div>
            </div>
          </div>

          <div class="report-block">
            <div class="report-label">WHAT'S HAPPENING</div>
            <p class="report-helper">Add only the most important context that chips cannot cover.</p>

            <div class="field-wrap">
              <textarea id="reportDescription" class="report-textarea" placeholder="Example: Flood water is entering houses beside the barangay hall. Elderly residents need assistance."></textarea>
            </div>
          </div>

          <div id="duplicateAlert" class="duplicate-alert" hidden>
            <div class="duplicate-alert-icon">⚠️</div>
            <div class="duplicate-alert-content">
              <strong>Possible duplicate report found</strong>
              <p id="duplicateAlertText">A similar report is already listed nearby.</p>
            </div>
            <div class="duplicate-alert-actions">
              <button type="button" class="duplicate-btn secondary" onclick="focusDuplicateCard()">REVIEW EXISTING</button>
              <button type="button" class="duplicate-btn primary" onclick="confirmDuplicateSubmit()">SUBMIT ANYWAY</button>
            </div>
          </div>

          <div class="report-actions-grid">
            <button type="button" id="rescueNeededBtn" class="action-tile" onclick="toggleRescueNeeded(this)">
              <span class="tile-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 3 19h18L12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  <path d="M12 9v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
                </svg>
              </span>
              <span>RESCUE NEEDED?</span>
            </button>

            <label for="reportPhoto" class="action-tile upload-tile">
              <span class="tile-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h4l1.2-2h5.6L16 7h4v11H4V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  <circle cx="12" cy="12.5" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>
                </svg>
              </span>
              <span id="photoLabelText">ADD PHOTO</span>
              <input id="reportPhoto" type="file" accept="image/*" hidden onchange="handlePhotoName(this)">
            </label>
          </div>

          <button type="button" class="submit-report-btn" onclick="submitUserReport()">
            <span class="submit-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21 3-9 18-2.7-7.3L2 11 21 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>SUBMIT HAZARD REPORT</span>
          </button>

          <div class="report-block verification-block">
            <div class="verification-head">
              <div class="verification-head-copy">
                <div class="report-label">COMMUNITY VERIFICATION</div>
                <p class="report-helper">Only nearby users can verify, and the alerts shown here follow your current area. Barangay, responder, and admin confirmations weigh more than normal community taps.</p>
              </div>

              <div class="scope-panel">
                <div id="verificationScopeSummary" class="scope-summary">Loading local coverage…</div>

                <div class="scope-filter-row">
                  <button type="button" id="filterAssignedBtn" class="scope-filter-btn active" onclick="setVerificationFilter('assigned')">ASSIGNED COVERAGE</button>
                  <button type="button" id="filterCityBtn" class="scope-filter-btn" onclick="setVerificationFilter('city')">SAME CITY</button>
                  <button type="button" id="filterBarangayBtn" class="scope-filter-btn" onclick="setVerificationFilter('barangay')">SAME BARANGAY</button>
                </div>

                <div id="trustStatusStrip" class="trust-status-strip"></div>
              </div>
            </div>

            <div id="verificationList" class="verification-list"></div>

            <div id="verificationEmpty" class="verification-empty" hidden>
              <div class="verification-empty-icon">📡</div>
              <strong>No local alerts match this scope yet.</strong>
              <p>When barangay, responder, or nearby community alerts match your assigned area, they will appear here.</p>
            </div>
          </div>

        </div>
      </section>
		<?php include __DIR__ . '/includes/user_watch.php'; ?>
    </main>

    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    window.HANDAVIS_CURRENT_CONTEXT = <?php echo json_encode($hazardBootstrap['context']); ?>;
    window.HANDAVIS_INITIAL_REPORTS = <?php echo json_encode($hazardBootstrap['reports']); ?>;
  </script>
  <script src="assets/js/user_dashboard.js"></script>
 <script src="assets/js/user_main_header.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_main_header.js') ? filemtime(__DIR__ . '/assets/js/user_main_header.js') : time(); ?>"></script>
  <script src="assets/js/user_hazard_report.js?v=<?php echo filemtime(__DIR__ . '/assets/js/user_hazard_report.js'); ?>"></script>
  <script src="assets/js/user_watch.js?v=<?php echo time(); ?>"></script>
  <script src="assets/js/user_settings.js"></script>
</body>
</html>
