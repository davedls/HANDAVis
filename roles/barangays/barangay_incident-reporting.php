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
    <title>HANDAVis Barangay Incident Reporting</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_side-panel.css?v=20260401a" />
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_incident-reporting.css?v=20260403a" />
    <link rel="stylesheet" href="../../assets/css/user_footer.css">
    <link rel="stylesheet" href="../../assets/css/barangays/barangay_header.css">
  </head>
  <body>
    <?php require __DIR__ . '/barangay-header.php'; ?>

    <section id="barangayPage" class="page active">
      <div class="dashboard">
        <?php require __DIR__ . '/../../includes/barangay_side-panel.php'; ?>

        <main class="portal-content">
<div class="main">
    <div class="topbar">
      <div class="tb-row">
        <div class="tb-left">
          <h1 id="pageTitle">Hazard Report</h1>
          <p id="pageDesc">Review community hazard reports from One-Tap Hazard Report and dispatch the right responder team.</p>
        </div>
        <div class="tb-right">
          <div class="brgy-chip"><div class="brgy-dot"></div>Barangay <?php echo htmlspecialchars($currentBarangayName, ENT_QUOTES, 'UTF-8'); ?></div>
        </div>
      </div>
      <div class="tabs" id="incidentTabs">
        <div class="tab on" id="tabAssign" onclick="switchPage('assign')">Active Reports</div>
        <div class="tab" id="tabHistory" onclick="switchPage('history')">History</div>
      </div>
    </div>

    <!-- ACTIVE REPORTS PAGE -->
    <div class="page active" id="pageAssign">
      <div class="urgent-bar" id="urgentBar">
        <div class="ub-pulse"></div>
        <div style="flex:1">
          <div class="ub-text">1 hazard report needs action - road blockage at Purok 1 is unassigned</div>
          <div class="ub-sub">Select a report to review quick details and assign a responder team</div>
        </div>
      </div>

      <div class="panel incident-map-panel">
        <div class="ph">
          <div class="ph-title"><div class="ph-bar"></div>Incident map</div>
          <span class="ph-badge" id="incidentMapStatus">No mapped locations yet</span>
        </div>
        <div class="incident-map-wrap">
          <div id="incidentMap" class="incident-map-canvas" aria-label="Incident report map"></div>
          <div class="incident-map-legend" aria-label="Incident marker legend">
            <div class="incident-legend-row"><span class="incident-legend-dot lg-flood"></span>Flood</div>
            <div class="incident-legend-row"><span class="incident-legend-dot lg-fire"></span>Fire</div>
            <div class="incident-legend-row"><span class="incident-legend-dot lg-storm"></span>Storm</div>
            <div class="incident-legend-row"><span class="incident-legend-dot lg-road"></span>Road Block</div>
            <div class="incident-legend-row"><span class="incident-legend-dot lg-earthquake"></span>Earthquake</div>
            <div class="incident-legend-row"><span class="incident-legend-dot lg-medical"></span>Medical</div>
            <div class="incident-legend-row"><span class="incident-legend-dot lg-other"></span>Other</div>
          </div>
        </div>
      </div>
      <div class="two-col">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="panel">
            <div class="ph">
              <div class="ph-title"><div class="ph-bar"></div>Hazard reports <span id="stepArrow" style="font-size:10px;color:#34d399;margin-left:4px">&larr; Select one to begin</span></div>
              <span class="ph-badge" id="reportCountBadge">0 reports</span>
            </div>
                        <div class="reports" id="reportList">
              <div class="r-item">
                <div class="r-body">
                  <div class="r-name">Loading hazard reports...</div>
                  <div class="r-loc">Please wait</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="right-panel" id="rightPanel">
          <div class="incident-detail" id="detailCard" style="display:none">
            <div class="id-head">
              <div class="id-head-top"><div class="id-title" id="detailName">-</div><span class="pill" id="detailPill">-</span></div>
              <div class="id-category" id="detailCat">-</div>
            </div>
            <div class="id-fields">
              <div class="id-priority-grid">
                <div class="id-kpi k-location">
                  <div class="id-kpi-label">Location</div>
                  <div class="id-kpi-value" id="detailLoc">-</div>
                </div>
                <div class="id-kpi">
                  <div class="id-kpi-label">Reported</div>
                  <div class="id-kpi-value" id="detailTime">-</div>
                </div>
                <div class="id-kpi k-dept">
                  <div class="id-kpi-label" id="detailDeptLabel">Dept. needed</div>
                  <div class="id-kpi-value" id="detailDept">-</div>
                </div>
              </div>

              <div class="id-section">
                <div class="id-section-title">Description</div>
                <div class="id-desc-card" id="detailDesc">-</div>
              </div>

              <div class="id-section">
                <div class="id-section-title">Situation details</div>
                <div class="id-meta-grid" id="detailSituationGrid"></div>
              </div>
            </div>
            <div class="suggested" id="suggestedWrap" style="display:none">
              <div class="sug-label">System suggestion - nearest available</div>
              <div class="sug-row">
                <div class="sug-av" id="sugAv">-</div>
                <div><div class="sug-name" id="sugName">-</div><div style="font-size:10px;color:#2a5035" id="sugDist">-</div></div>
                <button class="sug-confirm" onclick="confirmSuggested()">Confirm &amp; assign</button>
              </div>
            </div>
          </div>
          <div id="emptyState" style="background:#0d1219;border:1px solid #1a2430;border-radius:10px;padding:32px 16px;text-align:center">
            <div style="font-size:12px;color:#2a3a48;font-weight:500">No report selected</div>
            <div style="font-size:11px;color:#1e2a36;margin-top:4px">Select a hazard report on the left to review it and assign a responder</div>
          </div>
          <div class="dept-responders-panel" id="deptPanel" style="display:none">
            <div class="ph"><div class="ph-title"><div class="ph-bar"></div><span id="deptPanelTitle">Available responders</span></div><span class="ph-hint">Click a row to select</span></div>
            <div id="deptList"></div>
          </div>
          <div class="tracker" id="trackerPanel" style="display:none">
            <div class="track-title">Hazard response progress <span id="trackerName">-</span></div>
            <div class="steps" id="stepsEl"></div>
            <div id="resolutionActionWrap" style="display:none;padding-top:10px">
              <button class="btn-assign" id="confirmResolvedBtn" type="button" onclick="confirmResolvedByBarangay()">Confirm Resolved</button>
            </div>
          </div>
          <div class="assign-footer" id="assignFooter" style="display:none">
            <button class="btn-assign" id="assignBtn" onclick="doAssign()" disabled>Send Assignment</button>
          </div>
        </div>
      </div>
    </div>

    <!-- HISTORY PAGE -->
    <div class="page" id="pageHistory">
      <div class="panel">
        <div class="ph">
          <div class="ph-title"><div class="ph-bar"></div>Recent Activity / History</div>
          <span class="ph-badge" id="historyCountBadge">0 incidents</span>
        </div>
        <div class="history-list" id="historyList">
          <div class="history-empty">Loading history...</div>
        </div>
      </div>
    </div>

    <!-- ALL RESPONDERS PAGE -->
    <div class="page" id="pageAll">
      <div class="ar-controls">
        <input class="ar-search" id="arSearch" placeholder="Search name, dept, status, task, report ID, role, or area..." oninput="filterResponders()">
        <div class="ar-filter-wrap">
          <div class="filter-btn on" data-f="all" onclick="setFilter(this,'all')">All</div>
          <div class="filter-btn" data-f="available" onclick="setFilter(this,'available')">Available</div>
          <div class="filter-btn" data-f="deployed" onclick="setFilter(this,'deployed')">Deployed</div>
          <div class="filter-btn" data-f="standby" onclick="setFilter(this,'standby')">Standby</div>
        </div>
      </div>

      <div class="ar-stats-row">
        <div class="ar-stat">
          <div class="ar-stat-icon si-pol"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 4h4l-3.2 2.3 1.2 4L8 9l-3.5 2.3 1.2-4L2.5 5h4L8 1z" fill="#4a90d9"/></svg></div>
          <div class="ar-stat-body"><div class="ar-stat-num sn-pol" id="statTotal-police">0</div><div class="ar-stat-label">Police</div><div class="ar-stat-avail"><span id="statAvail-police" style="color:#34d399">0 available</span></div></div>
        </div>
        <div class="ar-stat">
          <div class="ar-stat-icon si-fire"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#f97316" d="M12.832 21.801c3.126-.626 7.168-2.875 7.168-8.69c0-5.291-3.873-8.815-6.658-10.434c-.619-.36-1.342.113-1.342.828v1.828c0 1.442-.606 4.074-2.29 5.169c-.86.559-1.79-.278-1.894-1.298l-.086-.838c-.1-.974-1.092-1.565-1.87-.971C4.461 8.46 3 10.33 3 13.11C3 20.221 8.289 22 10.933 22q.232 0 .484-.015C10.111 21.874 8 21.064 8 18.444c0-2.05 1.495-3.435 2.631-4.11c.306-.18.663.055.663.41v.59c0 .45.175 1.155.59 1.637c.47.546 1.159-.026 1.214-.744c.018-.226.246-.37.442-.256c.641.375 1.46 1.175 1.46 2.473c0 2.048-1.129 2.99-2.168 3.357"/></svg></div>
          <div class="ar-stat-body"><div class="ar-stat-num sn-fire" id="statTotal-fire">0</div><div class="ar-stat-label">Fire dept.</div><div class="ar-stat-avail"><span id="statAvail-fire" style="color:#34d399">0 available</span></div></div>
        </div>
        <div class="ar-stat">
          <div class="ar-stat-icon si-med"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.2" stroke="#34d399" stroke-width="1.4"/><path d="M8 4.8v6.4M4.8 8h6.4" stroke="#34d399" stroke-width="1.8" stroke-linecap="round"/></svg></div>
          <div class="ar-stat-body"><div class="ar-stat-num sn-med" id="statTotal-medical">0</div><div class="ar-stat-label">Medical</div><div class="ar-stat-avail"><span id="statAvail-medical" style="color:#34d399">0 available</span></div></div>
        </div>
        <div class="ar-stat">
          <div class="ar-stat-icon si-dis"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 13h14L8 1z" stroke="#a78bfa" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6v3M8 11v.5" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          <div class="ar-stat-body"><div class="ar-stat-num sn-dis" id="statTotal-disaster">0</div><div class="ar-stat-label">Disaster response</div><div class="ar-stat-avail"><span id="statAvail-disaster" style="color:#34d399">0 available</span></div></div>
        </div>
      </div>

      <div id="allDeptSections"></div>
    </div>
  </div>
        </main>
      </div>
    </section>

    <div id="toast" class="toast"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="../../assets/js/barangays/barangay_incident-reporting.js?v=20260403a"></script>
    <script src="../../assets/js/barangays/barangay_header.js"></script>
    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>
  </body>
</html>

