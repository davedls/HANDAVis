<!doctype html>
<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Responder'], '../../user_home.php');
$responderActivePage = 'resources';
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Responder Resources</title>
    <link rel="stylesheet" href="../../assets/css/responder_dashboard.css" />
    <link rel="stylesheet" href="../../assets/css/responders/responder_resources.css" />
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
              <h1>Resources</h1>
              <p>
                Track team readiness, assets, and recent operational timeline updates.
              </p>
            </div>
            <div class="topbar-actions">
              <span class="chip">Response Mode</span>
              <span class="chip">Live Monitoring</span>
            </div>
          </div>

          <section class="content-grid">
            <div class="panel span-6">
              <div class="eyebrow">Resource Tracking</div>
              <div class="mini-grid">
                <div class="mini-box"><strong>4</strong><span>Rescue Teams</span></div>
                <div class="mini-box"><strong>2</strong><span>Ambulances</span></div>
                <div class="mini-box"><strong>5</strong><span>Boats Ready</span></div>
                <div class="mini-box"><strong>6</strong><span>First Aid Units</span></div>
              </div>
            </div>

            <div class="panel span-6">
              <div class="eyebrow">Incident Timeline</div>
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-time">3:22 PM</div>
                  <div>
                    <strong>SOS escalated</strong>
                    <span>Barangay Bata flagged for rescue action.</span>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-time">3:15 PM</div>
                  <div>
                    <strong>Flood hotspot verified</strong>
                    <span>Barangay Tangub reached confidence HIGH.</span>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-time">2:59 PM</div>
                  <div>
                    <strong>Responder standby notice</strong>
                    <span>Teams moved to elevated readiness level.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </section>

    <script src="../../assets/js/responders/responder_resources.js"></script>
    <script src="../../assets/js/responders/responder_header.js"></script>
    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>
  </body>
</html>
