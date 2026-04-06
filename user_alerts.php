<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();
require_once __DIR__ . '/database/config.php';

$regional_alerts = [];
try {
    $stmt = $conn->prepare(
        'SELECT alert_id, title, description, alert_type, created_at
         FROM regional_alerts
         WHERE status = ?
         ORDER BY created_at DESC'
    );
    $active = 'active';
    $stmt->bind_param('s', $active);
    $stmt->execute();
    $regional_alerts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
} catch (Throwable $e) {
    $regional_alerts = [];
}

// ── Track alert views ──────────────────────────────────────────────────────
if (!empty($regional_alerts)) {
    try {
        foreach ($regional_alerts as $ralert) {
            $trackStmt = $conn->prepare(
                'INSERT IGNORE INTO user_alert_views (user_id, alert_id) VALUES (?, ?)'
            );
            $trackUserId = (int)$_SESSION['user_id'];
            $trackAlertId = (int)$ralert['alert_id'];
            $trackStmt->bind_param('ii', $trackUserId, $trackAlertId);
            $trackStmt->execute();
            $trackStmt->close();
        }
    } catch (Throwable $e) {}
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - Live Alerts</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo filemtime(__DIR__ . '/handav.png'); ?>">
  <link rel="stylesheet" href="assets/css/user_root.css">
  <link rel="stylesheet" href="assets/css/user_main_header.css">
  <link rel="stylesheet" href="assets/css/user_dashboard.css">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <link rel="stylesheet" href="assets/css/user_alerts.css?v=<?php echo filemtime(__DIR__ . '/assets/css/user_alerts.css'); ?>">
  <link rel="stylesheet" href="assets/css/user_watch.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/reduce_animation.css">
</head>
<body>

  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <div class="dashboard">
    <?php $activePage = 'alertsPage'; require __DIR__ . '/includes/user_dashboard.php'; ?>

    <main class="portal-content">
      <section id="alertsPage" class="page active">

        <div class="topbar">
          <div class="page-head">
            <h1>Live Alerts</h1>
            <p>Western Visayas only: live regional and local advisories, route support, and threat context tied to your selected city instead of generic national alerts.</p>
          </div>
          <div class="topbar-actions">
            <span class="chip">📍 Western Visayas Only</span>
            <span class="chip">🔔 Regional + Local Live Advisories</span>
          </div>
        </div>

        <!-- Regional Alerts Panel (DB-powered) -->
        <div class="panel" style="margin-bottom:16px;">
          <div class="eyebrow">Regional Alerts</div>
          <div id="regionalAlertList">
            <?php if (!empty($regional_alerts)): ?>
              <?php foreach ($regional_alerts as $ralert): ?>
                <div class="ra-banner" style="margin-bottom:10px;">
                  <div>
                    <strong>⚠ <?php echo htmlspecialchars($ralert['title']); ?></strong>
                    <span><?php echo htmlspecialchars($ralert['description']); ?></span>
                    <small class="ra-date">Published: <?php echo date('F j, Y g:i A', strtotime($ralert['created_at'])); ?></small>
                  </div>
                  <div class="ra-pill"><?php echo strtoupper(htmlspecialchars($ralert['alert_type'])); ?></div>
                </div>
              <?php endforeach; ?>
            <?php else: ?>
              <p style="color:var(--muted); font-size:0.875rem; margin-top:8px;">No active regional alerts at this time.</p>
            <?php endif; ?>
          </div>
        </div>

        <!-- AI Feed Banner (left alone) -->
        <div class="panel" style="margin-bottom:16px;">
          <div class="alert-banner">
            <div>
              <strong>⚠ Flood Alert Remains Elevated</strong>
              <span>Prepare for possible evacuation if rainfall intensity continues through the next weather cycle.</span>
            </div>
            <div class="alert-pill">LEVEL 2</div>
          </div>
        </div>

        <div class="content-grid">
          <div class="panel span-12 advisory-panel">
            <div class="eyebrow">Official Advisories</div>

            <div class="advisory-toolbar">
              <div>
                <strong>Western Visayas live advisory feed</strong>
                <small id="advisoryStatusText">Connecting to Western Visayas regional and local advisories…</small>
              </div>
              <button type="button" class="support-locate-btn advisory-refresh-btn" id="advisoryRefreshBtn">Refresh Feed</button>
            </div>

            <div class="advisory-list" id="liveAdvisoryList">
              <div class="advisory-item advisory-loading-card">
                <div class="advisory-meta">
                  <span class="advisory-dot dot-watch"></span>
                  <span class="advisory-badge badge-watch">LOADING</span>
                  <span class="advisory-source">Live Feed</span>
                </div>
                <div class="advisory-headline">Connecting to official advisories and outlet reports</div>
                <div class="advisory-body">HANDAVis is requesting the latest PAGASA / PHIVOLCS guidance and matching outlet stories for the selected location.</div>
                <div class="advisory-areas">Areas: Will update automatically</div>
              </div>
            </div>

          </div>
        </div>

      </section>
      <?php include __DIR__ . '/includes/user_watch.php'; ?>
    </main>

    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <div id="toast" class="toast"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="assets/js/user_dashboard.js?v=<?php echo filemtime(__DIR__ . '/assets/js/user_dashboard.js'); ?>"></script>
  <script src="assets/js/user_main_header.js?v=<?php echo filemtime(__DIR__ . '/assets/js/user_main_header.js'); ?>"></script>
  <script src="assets/js/user_alerts.js?v=<?php echo filemtime(__DIR__ . '/assets/js/user_alerts.js'); ?>"></script>
  <script src="assets/js/user_watch.js?v=<?php echo time(); ?>"></script>
  <script src="assets/js/user_settings.js"></script>
</body>
</html>