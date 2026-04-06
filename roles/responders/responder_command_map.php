<!doctype html>
<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Responder'], '../../user_home.php');
$responderActivePage = 'command_map';
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Responder Command Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="../../assets/css/responder_dashboard.css" />
    <link rel="stylesheet" href="../../assets/css/responders/responder_command_map.css" />
    <link rel="stylesheet" href="../../assets/css/user_footer.css">
    <link rel="stylesheet" href="../../assets/css/responders/responder_header.css">
  </head>
  <body>
    <?php require __DIR__ . '/responder-header.php'; ?>

    <section id="responderPage" class="page active">
      <div class="dashboard">
        <?php require __DIR__ . '/responder-side-panel.php'; ?>

        <main class="portal-content">
          <div class="topbar">
            <div class="page-head">
              <h1>Command Map</h1>
              <p>
                Monitor incident location, route guidance, and responder progress in one live command view.
              </p>
            </div>
            <div class="topbar-actions">
              <span class="chip">Response Mode</span>
              <span class="chip">Live Monitoring</span>
            </div>
          </div>

          <section class="content-grid">
            <div class="panel span-12 command-map-panel">
              <div class="map-topbar">
                  <div class="map-inc-copy">
                  <div class="map-inc-title" id="mapIncidentTitle">Loading assignment...</div>
                  <div class="map-inc-sub" id="mapStatusLine">Status: Assigned - Update to On the Way to begin response</div>
                </div>
                <div class="status-chip map-chip" id="mapChip">
                  <div class="chip-dot"></div>
                  <span id="mapChipText">Assigned</span>
                </div>
              </div>

              <div class="map-container">
                <div class="map-area">
                  <div id="responderMap" class="responder-live-map" aria-label="Responder live map"></div>

                  <div class="map-eta" id="etaBox">
                    <div class="eta-label">Estimated arrival</div>
                    <div class="eta-val" id="etaVal">6 min</div>
                    <div class="eta-sub" id="etaSub">0.3 km - Route ready</div>
                  </div>

                  <div class="map-legend">
                    <div class="leg-row"><div class="leg-dot leg-dot-you"></div>Your location</div>
                    <div class="leg-row"><div class="leg-dot leg-dot-incident"></div>Incident location</div>
                    <div class="leg-row"><div class="leg-line"></div>Suggested route</div>
                  </div>
                </div>

                <aside class="map-side">
                  <div class="detail-section">
                    <div class="section-title">Incident Details</div>
                    <div class="detail-row"><div class="detail-label">Type</div><div class="detail-val detail-val-hl" id="mapDetailType">-</div></div>
                    <div class="detail-row"><div class="detail-label">Location</div><div class="detail-val detail-val-hl" id="mapDetailLocation">-</div></div>
                    <div class="detail-row"><div class="detail-label">Description</div><div class="detail-val" id="mapDetailDescription">-</div></div>
                    <div class="detail-row"><div class="detail-label">Assigned by</div><div class="detail-val" id="mapDetailAssignedBy">-</div></div>
                    <div class="detail-row"><div class="detail-label">Assigned at</div><div class="detail-val" id="mapDateTime">-</div></div>
                    <div class="detail-row"><div class="detail-label">Assignment ID</div><div class="detail-val" id="mapAssignmentId">-</div></div>
                  </div>

                  <div class="status-section">
                    <div class="section-title">Update Your Status</div>
                    <div class="status-steps" id="statusSteps"></div>
                  </div>

                  <button class="update-btn" id="updateBtn" type="button">Select next status above</button>

                </aside>
              </div>
            </div>
          </section>
        </main>
      </div>
    </section>

    <div class="responder-msg-modal" id="responderMsgModal" hidden>
      <div class="responder-msg-modal-card responder-msg-modal-card--info" id="responderMsgCard" role="alertdialog" aria-modal="true" aria-labelledby="responderMsgTitle" aria-describedby="responderMsgBody">
        <div class="responder-msg-modal-head">
          <div class="responder-msg-modal-icon" id="responderMsgIcon" aria-hidden="true">i</div>
          <div>
            <div class="responder-msg-modal-title" id="responderMsgTitle">Status Update</div>
            <div class="responder-msg-modal-subtitle" id="responderMsgSubtitle">Responder Command Map</div>
          </div>
        </div>
        <div class="responder-msg-modal-body" id="responderMsgBody">-</div>
        <div class="responder-msg-modal-actions">
          <button type="button" class="responder-msg-modal-btn" id="responderMsgOkBtn">Confirm</button>
        </div>
      </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="../../assets/js/responders/responder_command_map.js"></script>
    <script src="../../assets/js/responders/responder_header.js"></script>
    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>
  </body>
</html>
