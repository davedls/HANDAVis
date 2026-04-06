<!doctype html>
<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
require_once __DIR__ . '/../../database/config.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Barangay Staff', 'Barangay'], '../../user_home.php');

$currentBarangayName = 'Barangay';
try {
    $uid = (int)($_SESSION['user_id'] ?? 0);
    if ($uid > 0) {
        $stmt = $conn->prepare(
            'SELECT b.barangay_name
             FROM users u
             INNER JOIN barangays b ON b.id = u.barangay_id
             WHERE u.id = ?
             LIMIT 1'
        );
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!empty($row['barangay_name'])) {
            $currentBarangayName = (string)$row['barangay_name'];
        }
    }
} catch (Throwable $e) {
}
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Barangay Portal</title>
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_dashboard.css" />
    <link rel="stylesheet" href="../../assets/css/user_footer.css">
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_header.css">
  </head>
  <body>
    <?php require __DIR__ . '/barangay-header.php'; ?>

    <section id="barangayPage" class="page active">
      <div class="dashboard">

        <?php require __DIR__ . '/../../includes/barangay_side-panel.php'; ?>

        <main class="portal-content">

          <div class="topbar">
            <div class="page-head">
              <h1>Barangay Dashboard</h1>
              <p>
                Local operations portal for report verification, emergency
                broadcasting, voice-ready alerts, and evacuation center updates.
              </p>
            </div>
            <div class="topbar-actions">
              <span class="chip">Barangay <?php echo htmlspecialchars($currentBarangayName, ENT_QUOTES, 'UTF-8'); ?></span>
              <span class="chip">Broadcast Ready</span>
            </div>
          </div>

          <div class="metrics">
            <div class="panel metric-card reports-accent">
              <div class="eyebrow">Pending Reports</div>
              <div id="pendingReports" class="metric-value">0</div>
              <div class="subtext">Waiting for barangay review</div>
            </div>
            <div class="panel metric-card requests-accent">
              <div class="eyebrow">SOS Requests</div>
              <div id="barangaySOS" class="metric-value">0</div>
              <div class="subtext">Urgent community requests</div>
            </div>
            <div class="panel metric-card occupancy-accent">
              <div class="eyebrow">Evacuation Occupancy</div>
              <div class="metric-value">-</div>
              <div class="subtext">Current residents in shelter</div>
            </div>
            <div class="panel metric-card broadcasts-accent">
              <div class="eyebrow">Broadcasts</div>
              <div id="broadcastCount" class="metric-value">0</div>
              <div class="subtext">Emergency notices sent today</div>
            </div>
          </div>

          <div id="section-reports" class="section-view">
            <div class="content-grid">
              <div class="panel span-12">
                <div class="eyebrow">Verify Community Reports</div>
                <div id="barangayReports" class="list">
                  <div class="list-item">
                    <strong>No reports yet</strong>
                    <span class="report-status">Status: No pending reports in your barangay.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="section-broadcast" class="section-view" style="display:none;">
            <div class="content-grid">
              <div class="panel span-6">
                <div class="eyebrow">Barangay Emergency Broadcast</div>
                <select id="broadcastType" class="select" style="margin-bottom:10px;">
                  <option>Flood Warning</option>
                  <option>Storm Advisory</option>
                  <option>Evacuation Notice</option>
                  <option>Road Closure</option>
                </select>
                <textarea id="broadcastMessage" class="textarea" placeholder="Type barangay emergency message..."></textarea>
                <button class="btn" onclick="sendBroadcast()">Broadcast Alert</button>
                <div id="broadcastStatus" class="footer-note">No recent barangay broadcast sent.</div>
              </div>

              <div class="panel span-6">
                <div class="eyebrow">Voice Alert Preview</div>
                <div class="voice-box">
                  <div>
                    <strong style="display:block;margin-bottom:4px;">Voice Announcement</strong>
                    <span class="voice-desc">"Attention residents. Water level is rising. Please prepare for possible evacuation."</span>
                  </div>
                  <div class="voice-wave"></div>
                  <button class="btn secondary" onclick="showToast('Playing voice alert preview...')">Play</button>
                </div>
              </div>

              <div class="panel span-12">
                <div class="eyebrow">Evacuation Center Management</div>
                <div class="list">
                  <div class="list-item">
                    <strong>No evacuation center data yet</strong>
                    <span>Capacity and occupancy data will appear once configured.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </section>

    <div id="toast" class="toast"></div>

    <script src="../../assets/js/barangays/barangay_dashboard.js"></script>
    <script src="../../assets/js/barangays/barangay_header.js"></script>
    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>
  </body>
</html>
