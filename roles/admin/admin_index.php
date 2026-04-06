<?php
require_once __DIR__ . '/../../database/require_login.php';
require_once __DIR__ . '/../../database/require_role.php';
require_once __DIR__ . '/../../database/config.php';
hv_require_login('../../index.php?auth=login&notice=login_required');
hv_require_role(['Admin'], '../../user_home.php');
?>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Admin Portal</title>
	<link rel="icon" type="image/png" href="../../images/handa.png?v=<?php echo file_exists(__DIR__ . '/../../images/handa.png') ? filemtime(__DIR__ . '/../../images/handa.png') : time(); ?>" />
    <link rel="stylesheet" href="../../assets/css/admin_dashboard.css" />
    <link rel="stylesheet" href="../../assets/css/user_footer.css">
    <link rel="stylesheet" href="../../assets/css/user_main_header.css">
  </head>
  <body>
    <?php require __DIR__ . '/../../includes/user_main_header.php'; ?>
    <section id="adminPage" class="page active">
      <div class="dashboard">

        <aside class="sidebar">
          <div class="brand-box">
            <h2>HANDAVis</h2>
            <p>Regional Admin Portal</p>
            <p>Powered by HANDAm Intelligence</p>
          </div>

          <div class="nav-section-title">Sections</div>
          <button class="sub-link active-link" onclick="showSection('radar')">Risk Radar</button>
          <button class="sub-link" onclick="showSection('alert')">Publish Alert</button>
          <button class="sub-link" onclick="showSection('logs')">System Logs</button>
          <button class="sub-link" onclick="showSection('barangaylist')">Barangay List</button>
        </aside>

        <main class="portal-content">

          <div class="topbar">
            <div class="page-head">
              <h1>Admin Dashboard</h1>
              <p>
                Regional oversight portal for alert publishing, analytics,
                system logs, user management overview, and cross-LGU disaster
                intelligence.
              </p>
            </div>
            <div class="topbar-actions">
              <span class="chip">🛠 Regional Control</span>
              <span class="chip">📊 Analytics Ready</span>
            </div>
          </div>

          <div class="metrics">
            <div class="panel metric-card users-accent">
              <div class="eyebrow">Total Users</div>
              <div class="metric-value">
                <?php
                  $userCount = $conn->query("SELECT COUNT(*) AS total FROM users");
                  $userRow = $userCount->fetch_assoc();
                  echo number_format((int)$userRow['total']);
                ?>
              </div>
              <div class="subtext">Registered platform users</div>
            </div>
            <div class="panel metric-card alerts-accent">
              <div class="eyebrow">Regional Alerts</div>
              <div id="adminAlertCount" class="metric-value">
                <?php
                  $countResult = $conn->query("SELECT COUNT(*) AS total FROM regional_alerts WHERE status = 'active'");
                  $countRow = $countResult->fetch_assoc();
                  echo (int)$countRow['total'];
                ?>
              </div>
              <div class="subtext">Current official alerts</div>
            </div>
            <div class="panel metric-card reports-accent">
              <div class="eyebrow">Verified Reports</div>
              <div id="adminVerifiedReports" class="metric-value">0</div>
              <div class="subtext">Validated incidents</div>
            </div>
            <div class="panel metric-card status-accent">
              <div class="eyebrow">System Status</div>
              <div class="metric-value">Online</div>
              <div class="subtext">Core platform running normally</div>
            </div>
          </div>

          <div id="section-radar" class="section-view">
            <div class="content-grid">

              <div class="panel span-7">
                <div class="eyebrow">Regional Risk Radar</div>
                <div class="radar">
                  <div class="radar-core">
                    <div>
                      <small style="color:var(--muted);">Admin Overview</small>
                      <strong>RISK</strong>
                      <small style="color:var(--muted);">Elevated</small>
                    </div>
                  </div>
                  <div class="radar-tag-iloilo"   style="left:18px;  top:28px;    animation-delay:-9s;">   Iloilo: Moderate</div>
                  <div class="radar-tag-negros"   style="right:22px; top:78px;    animation-delay:-7.5s;"> Negros Occ.: High</div>
                  <div class="radar-tag-capiz"    style="left:42px;  bottom:28px; animation-delay:-9.7s;"> Capiz: Watch</div>
                  <div class="radar-tag-guimaras" style="right:24px; bottom:32px; animation-delay:-7s;">   Guimaras: Low</div>
                </div>
              </div>

              <div class="panel span-5">
                <div class="eyebrow">Analytics Snapshot</div>
                <div class="mini-grid">
                  <div class="mini-box"><strong>14</strong>   <span>Most affected barangays today</span></div>
                  <div class="mini-box"><strong>8</strong>    <span>Centers with high occupancy</span></div>
                  <div class="mini-box"><strong>61%</strong>  <span>Community report increase</span></div>
                  <div class="mini-box"><strong>High</strong> <span>Storm communication priority</span></div>
                </div>
              </div>

            </div>
          </div>

          <div id="section-alert" class="section-view" style="display:none;">
            <div class="content-grid" id="alertFormGrid">

              <div class="panel span-6">
                <div class="eyebrow">Publish Regional Alert</div>

                <?php if (!empty($_SESSION['alert_success'])): ?>
                  <div class="alert-feedback alert-feedback--success">
                    <?php echo htmlspecialchars($_SESSION['alert_success']); unset($_SESSION['alert_success']); ?>
                  </div>
                <?php endif; ?>

                <?php if (!empty($_SESSION['alert_error'])): ?>
                  <div class="alert-feedback alert-feedback--error">
                    <?php echo htmlspecialchars($_SESSION['alert_error']); unset($_SESSION['alert_error']); ?>
                  </div>
                <?php endif; ?>

                <form method="POST" action="../../includes/publish_alert.php">
                  <input
                    type="text"
                    name="title"
                    class="input"
                    placeholder="Alert title"
                    style="margin-bottom:10px;"
                    required
                  />
                  <select name="alert_type" class="select" style="margin-bottom:10px;" required>
                    <option value="emergency">Emergency</option>
                    <option value="typhoon">Typhoon</option>
                    <option value="flood">Flood</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="fire">Fire</option>
                    <option value="tsunami">Tsunami</option>
                    <option value="landslide">Landslide</option>
                    <option value="drought">Drought</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea
                    name="description"
                    class="textarea"
                    placeholder="Type official regional alert..."
                    required
                  ></textarea>
                  <button type="submit" class="btn" style="margin-top:10px;">Publish Alert</button>
                </form>
              </div>

              <div class="panel span-6">
                <div class="eyebrow">Admin Action Center</div>
                <div class="toolbar">
                  <button class="btn secondary" onclick="showUsers()">Manage Users</button>
                  <button class="btn secondary" onclick="showBarangays()">Manage Barangays</button>
                  <button class="btn secondary" onclick="showManageAlerts()">Manage Alerts</button>
                </div>
              </div>

            </div>

            <!-- Manage Users inline table view -->
            <div id="manageUsersView" style="display:none; margin-top:18px;">
              <div class="panel span-12">
                <div class="alerts-panel-header">
                  <div class="eyebrow" style="margin-bottom:0;">Users — Database</div>
                  <button class="btn secondary" onclick="hideManageUsers()">← Back</button>
                </div>
                <div class="users-table-toolbar">
                  <input type="text" id="userSearchInput" class="input" placeholder="Search by name, email or role…" oninput="filterUsersTable()" style="max-width:320px;" />
                </div>
                <div style="overflow-x:auto;">
                  <table id="usersTable" style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                      <tr class="alerts-table-head">
                        <th class="alerts-th">ID</th>
                        <th class="alerts-th">Name</th>
                        <th class="alerts-th">Email</th>
                        <th class="alerts-th">Phone</th>
                        <th class="alerts-th">Role</th>
                        <th class="alerts-th">Status</th>
                        <th class="alerts-th">Joined</th>
                        <th class="alerts-th">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="usersTableBody">
                      <tr>
                        <td colspan="8" style="padding:24px; text-align:center; color:var(--muted);">Loading users…</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Manage Barangays inline table view -->
            <div id="manageBarangaysView" style="display:none; margin-top:18px;">
              <div class="panel span-12">
                <div class="alerts-panel-header">
                  <div class="eyebrow" style="margin-bottom:0;">Barangays — Database</div>
                  <button class="btn secondary" onclick="hideManageBarangays()">← Back</button>
                </div>
                <div class="users-table-toolbar">
                  <input type="text" id="barangaySearchInput" class="input" placeholder="Search by barangay or municipality…" oninput="filterBarangaysTable()" style="max-width:360px;" />
                </div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                      <tr class="alerts-table-head">
                        <th class="alerts-th">ID</th>
                        <th class="alerts-th">Barangay Name</th>
                        <th class="alerts-th">Municipality</th>
                        <th class="alerts-th">Created</th>
                        <th class="alerts-th">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="barangaysTableBody">
                      <tr>
                        <td colspan="5" style="padding:24px; text-align:center; color:var(--muted);">Loading barangays…</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Manage Alerts inline table view -->
            <div id="manageAlertsView" style="display:none; margin-top:18px;">
              <div class="panel span-12">
                <div class="alerts-panel-header">
                  <div class="eyebrow" style="margin-bottom:0;">Regional Alerts — Database</div>
                  <button class="btn secondary" onclick="hideManageAlerts()">← Back</button>
                </div>
                <div style="overflow-x:auto;">
                  <table id="alertsTable" style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                      <tr class="alerts-table-head">
                        <th class="alerts-th">ID</th>
                        <th class="alerts-th">Title</th>
                        <th class="alerts-th">Type</th>
                        <th class="alerts-th">Description</th>
                        <th class="alerts-th">Status</th>
                        <th class="alerts-th">Published</th>
                        <th class="alerts-th">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="alertsTableBody">
                      <tr>
                        <td colspan="7" style="padding:24px; text-align:center; color:var(--muted);">Loading alerts…</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div id="userView" style="display:none;"></div>
          </div>

          <div id="section-logs" class="section-view" style="display:none;">
            <div class="panel span-12">
              <div class="eyebrow">System Activity Log</div>
              <div id="adminLogList" class="list">
                <div class="list-item">
                  <strong>System Log</strong>
                  <span>Regional monitoring and alert pipeline initialized successfully.</span>
                </div>
              </div>
            </div>
          </div>

          <div id="section-barangaylist" class="section-view" style="display:none;">
            <div class="content-grid">

              <div class="panel span-12">
                <div class="eyebrow">Barangay List — Western Visayas</div>
                <div class="city-tabs" id="cityTabs">
                  <button class="city-tab active" data-city="bacolod" onclick="switchCity(this)">Bacolod City</button>
                </div>
                <input class="bgy-search" id="bgySearch" placeholder="Search barangay…" oninput="filterBarangays()" />
                <div class="bgy-count" id="bgyCount"><span id="bgyShown">0</span> barangays</div>
                <div class="bgy-grid" id="bgyGrid"></div>
              </div>

            </div>
          </div>

        </main>
      </div>
    </section>

    <div id="toast" class="toast"></div>

    <!-- Delete Alert Confirmation Modal -->
    <div id="cancelModal" class="modal-overlay">
      <div class="modal-box">
        <div class="cancel-modal-icon">⚠️</div>
        <h3 class="modal-title">Delete this alert?</h3>
        <p class="modal-body">This alert will be permanently <strong>deleted</strong> and will no longer be visible to the public.</p>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeCancelModal()">Go Back</button>
          <button class="btn btn-danger" onclick="confirmCancelAlert()">Yes, Delete It</button>
        </div>
      </div>
    </div>

    <!-- Change Status Modal -->
    <div id="statusModal" class="modal-overlay">
      <div class="modal-box">
        <div class="status-modal-icon">📋</div>
        <h3 class="modal-title">Change Alert Status</h3>
        <p class="modal-body">Select a new status for this alert.</p>
        <div class="status-options">
          <label class="status-option">
            <input type="radio" name="alertStatus" value="active" />
            <span class="status-option-box">
              <span class="status-option-dot status-dot-active"></span>
              <span class="status-option-label">Active</span>
              <span class="status-option-desc">Visible to all users</span>
            </span>
          </label>
          <label class="status-option">
            <input type="radio" name="alertStatus" value="expired" />
            <span class="status-option-box">
              <span class="status-option-dot status-dot-expired"></span>
              <span class="status-option-label">Expired</span>
              <span class="status-option-desc">No longer relevant</span>
            </span>
          </label>
          <label class="status-option">
            <input type="radio" name="alertStatus" value="cancelled" />
            <span class="status-option-box">
              <span class="status-option-dot status-dot-cancelled"></span>
              <span class="status-option-label">Cancelled</span>
              <span class="status-option-desc">Withdrawn by admin</span>
            </span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeStatusModal()">Go Back</button>
          <button class="btn" onclick="confirmStatusChange()">Update Status</button>
        </div>
      </div>
    </div>

    <!-- Edit Alert Modal -->
    <div id="editModal" class="modal-overlay">
      <div class="modal-box modal-box--wide">
        <div class="edit-modal-icon">✏️</div>
        <h3 class="modal-title">Edit Alert</h3>
        <p class="modal-body">Update the details of this alert.</p>
        <div class="edit-form">
          <input type="hidden" id="editAlertId" />
          <div class="edit-field">
            <label class="edit-label">Title</label>
            <input type="text" id="editAlertTitle" class="input" placeholder="Alert title" />
          </div>
          <div class="edit-field">
            <label class="edit-label">Type</label>
            <select id="editAlertType" class="select">
              <option value="emergency">Emergency</option>
              <option value="typhoon">Typhoon</option>
              <option value="flood">Flood</option>
              <option value="earthquake">Earthquake</option>
              <option value="fire">Fire</option>
              <option value="tsunami">Tsunami</option>
              <option value="landslide">Landslide</option>
              <option value="drought">Drought</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="edit-field">
            <label class="edit-label">Description</label>
            <textarea id="editAlertDesc" class="textarea" placeholder="Alert description..."></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeEditModal()">Cancel</button>
          <button class="btn" onclick="confirmEditAlert()">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Delete User Confirmation Modal -->
    <div id="deleteUserModal" class="modal-overlay">
      <div class="modal-box">
        <div class="cancel-modal-icon">⚠️</div>
        <h3 class="modal-title">Delete this user?</h3>
        <p class="modal-body">This user will be permanently <strong>deleted</strong> from the database. This action cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeDeleteUserModal()">Go Back</button>
          <button class="btn btn-danger" onclick="confirmDeleteUser()">Yes, Delete User</button>
        </div>
      </div>
    </div>

    <!-- Delete Barangay Modal -->
    <div id="deleteBarangayModal" class="modal-overlay">
      <div class="modal-box">
        <div class="cancel-modal-icon">⚠️</div>
        <h3 class="modal-title">Delete this barangay?</h3>
        <p class="modal-body">This barangay will be permanently <strong>deleted</strong> from the database.</p>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeDeleteBarangayModal()">Go Back</button>
          <button class="btn btn-danger" onclick="confirmDeleteBarangay()">Yes, Delete It</button>
        </div>
      </div>
    </div>

    <!-- Edit Barangay Modal -->
    <div id="editBarangayModal" class="modal-overlay">
      <div class="modal-box">
        <div class="edit-modal-icon">✏️</div>
        <h3 class="modal-title">Edit Barangay Name</h3>
        <p class="modal-body">Update the name of this barangay.</p>
        <div class="edit-form">
          <input type="hidden" id="editBarangayId" />
          <div class="edit-field">
            <label class="edit-label">Barangay Name</label>
            <input type="text" id="editBarangayName" class="input" placeholder="Barangay name" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" onclick="closeEditBarangayModal()">Cancel</button>
          <button class="btn" onclick="confirmEditBarangay()">Save Changes</button>
        </div>
      </div>
    </div>

    <script src="../../assets/js/admin_index.js"></script>
    <script src="../../assets/js/admin_dashboard.js"></script>
    <script src="../../assets/js/user_main_header.js"></script>
    <?php require __DIR__ . '/../../includes/user_footer.php'; ?>
  </body>
</html>