<!doctype html>
<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Responder'], '../../user_home.php');
$responderActivePage = 'dispatch_queue';
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Responder Dispatch Queue</title>
    <link rel="stylesheet" href="../../assets/css/responder_dashboard.css" />
    <link rel="stylesheet" href="../../assets/css/responders/responder_dispatch_queue.css" />
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
              <h1>Responder Dashboard</h1>
              <p>
                Operational dashboard for assignments, live dispatching, and response updates.
              </p>
            </div>
            <div class="topbar-actions">
              <span class="chip">Response Mode</span>
              <span class="chip">Live Monitoring</span>
            </div>
          </div>

          <div class="metrics">
            <div class="panel metric-card incidents-accent">
              <div class="eyebrow">My Status</div>
              <div class="metric-value" id="metricMyStatusValue">-</div>
              <div class="subtext" id="metricMyStatusSubtext">-</div>
            </div>
            <div class="panel metric-card dispatch-accent">
              <div class="eyebrow">Assignments Today</div>
              <div class="metric-value" id="metricAssignmentsTodayValue">0</div>
              <div class="subtext" id="metricAssignmentsTodaySubtext">0 resolved - 0 active</div>
            </div>
            <div class="panel metric-card sos-accent">
              <div class="eyebrow">Avg. Response</div>
              <div class="metric-value" id="metricAvgResponseValue">-</div>
              <div class="subtext" id="metricAvgResponseSubtext">This week</div>
            </div>
            <div class="panel metric-card equipment-accent">
              <div class="eyebrow">Handled Incidents</div>
              <div class="metric-value" id="metricHandledValue">0</div>
              <div class="subtext" id="metricHandledSubtext">Lifetime assignments completed</div>
            </div>
          </div>

          <div class="responder-dash-body">
            <a class="notif-bar notif-bar-alert" id="activeAssignmentLink" href="./responder_command_map.php">
              <div class="notif-icon">
                <div class="pulse-dot"></div>
              </div>
              <div class="notif-body">
                <div class="notif-title" id="notifTitle">Loading assignment...</div>
                <div class="notif-sub" id="notifSub">Checking your latest assignment.</div>
              </div>
              <div class="notif-time" id="notifTime">-</div>
              <div class="notif-arrow">&rsaquo;</div>
            </a>

            <section class="content-grid">
              <div class="panel span-7 incident-card">
                <div class="incident-head">
                  <div class="incident-icon">!</div>
                  <div class="incident-info">
                    <div class="incident-name" id="incidentName">-</div>
                    <div class="incident-cat" id="incidentCategory">-</div>
                    <div class="incident-meta-row">
                      <div class="incident-meta-item" id="incidentLocation">-</div>
                      <div class="incident-meta-item" id="incidentRelativeTime">-</div>
                      <span class="incident-badge incident-badge-urgent" id="incidentBadge">Assigned</span>
                    </div>
                  </div>
                </div>

                <div class="incident-fields">
                  <div class="incident-row"><div class="incident-label">Description</div><div class="incident-value" id="incidentDescription">-</div></div>
                  <div class="incident-row"><div class="incident-label">Location</div><div class="incident-value incident-value-highlight" id="incidentLocationDetail">-</div></div>
                  <div class="incident-row"><div class="incident-label">Assigned by</div><div class="incident-value" id="incidentAssignedBy">-</div></div>
                  <div class="incident-row"><div class="incident-label">Date &amp; Time</div><div class="incident-value" id="incidentDateTime">-</div></div>
                </div>

                <a class="open-inc-btn" id="openIncidentBtn" href="./responder_command_map.php">Open Incident Map &amp; Navigate</a>
              </div>

              <div class="panel span-5">
                <div class="panel-head">
                  <div class="panel-title">Recent Activity</div>
                  <span class="panel-badge">Today</span>
                </div>
                <div class="hist-list" id="recentActivityList"></div>
              </div>

            </section>
          </div>
        </main>
      </div>
    </section>

    <div id="toast" class="toast"></div>

    <script src="../../assets/js/responders/responder_dispatch_queue.js"></script>
    <script src="../../assets/js/responders/responder_header.js"></script>
    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>
  </body>
</html>
