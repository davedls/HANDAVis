(function () {
  function normalizeDeg(value) {
    var result = value % 360;
    return result < 0 ? result + 360 : result;
  }
  function shortestDeltaDeg(a, b) {
    var delta = Math.abs(a - b) % 360;
    return delta > 180 ? 360 - delta : delta;
  }
  function toCssAngleDeg(centerX, centerY, targetX, targetY) {
    var dx = targetX - centerX;
    var dy = targetY - centerY;
    return normalizeDeg(Math.atan2(dy, dx) * (180 / Math.PI) + 90);
  }
  function startRadarReportSync() {
    var radar = document.querySelector(".radar");
    if (!radar) return;
    var radarTags = radar.querySelectorAll(".radar-tag-flood, .radar-tag-storm, .radar-tag-reports, .radar-tag-capacity");
    if (!radarTags.length) return;
    var cycleMs = 4000;
    var beamPeakOffsetDeg = 46;
    var hitWindowDeg = 9;
    var reportHitWindowDeg = 13;
    var startTs = performance.now();
    function tick(now) {
      var radarRect = radar.getBoundingClientRect();
      var centerX = radarRect.left + radarRect.width / 2;
      var centerY = radarRect.top + radarRect.height / 2;
      var elapsed = (now - startTs) % cycleMs;
      var rotation = (elapsed / cycleMs) * 360;
      var sweepPeak = normalizeDeg(270 + rotation + beamPeakOffsetDeg);
      radarTags.forEach(function (tag) {
        var tagRect = tag.getBoundingClientRect();
        var tagX = tagRect.left + tagRect.width / 2;
        var tagY = tagRect.top + tagRect.height / 2;
        var tagAngle = toCssAngleDeg(centerX, centerY, tagX, tagY);
        var windowDeg = tag.classList.contains("radar-tag-reports") ? reportHitWindowDeg : hitWindowDeg;
        var isHit = shortestDeltaDeg(sweepPeak, tagAngle) <= windowDeg;
        tag.classList.toggle("radar-hit", isHit);
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () {
      toast.style.display = "none";
    }, 2400);
  }

  function publishAlert() {
    var titleEl = document.getElementById("alertTitle");
    var levelEl = document.getElementById("alertLevel");
    var messageEl = document.getElementById("alertMessage");
    var list = document.getElementById("adminLogList");
    var adminCount = document.getElementById("adminAlertCount");
    if (!titleEl || !levelEl || !messageEl || !list || !adminCount) return;
    var title = titleEl.value.trim();
    var level = levelEl.value;
    var message = messageEl.value.trim();
    if (!title || !message) { showToast("Complete the regional alert form."); return; }
    var item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = "<strong>" + level + ": " + title + "</strong><span>" + message + "</span>";
    list.prepend(item);
    adminCount.textContent = String(parseInt(adminCount.textContent, 10) + 1);
    titleEl.value = "";
    messageEl.value = "";
    showToast("Regional alert published.");
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  function hideAllViews() {
    ["manageUsersView", "manageBarangaysView", "manageAlertsView"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  function showAlertFormGrid() {
    var grid = document.getElementById("alertFormGrid");
    if (grid) grid.style.display = "";
  }

  function hideAlertFormGrid() {
    var grid = document.getElementById("alertFormGrid");
    if (grid) grid.style.display = "none";
  }

  // ── Manage Users ───────────────────────────────────────────────────────────

  var _allUsers = [];

  function showUsers() {
    hideAlertFormGrid();
    hideAllViews();
    var view = document.getElementById("manageUsersView");
    if (view) view.style.display = "block";
    loadUsersTable();
  }

  function hideManageUsers() {
    showAlertFormGrid();
    var view = document.getElementById("manageUsersView");
    if (view) view.style.display = "none";
    var input = document.getElementById("userSearchInput");
    if (input) input.value = "";
  }

  function loadUsersTable() {
    var tbody = document.getElementById("usersTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="padding:24px; text-align:center; color:var(--muted);">Loading users…</td></tr>';
    fetch("../../includes/get_users.php")
      .then(function (res) { return res.json(); })
      .then(function (users) {
        _allUsers = users;
        renderUsersTable(users);
      })
      .catch(function () {
        var el = document.getElementById("usersTableBody");
        if (el) el.innerHTML = '<tr><td colspan="8" style="padding:24px; text-align:center; color:var(--muted);">Failed to load users.</td></tr>';
      });
  }

  function renderUsersTable(users) {
    var tbody = document.getElementById("usersTableBody");
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding:24px; text-align:center; color:var(--muted);">No users found.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(function (u) {
      var isActive = u.is_active == 1;
      var activeBadge = isActive
        ? '<span class="user-status-badge user-status-active">Active</span>'
        : '<span class="user-status-badge user-status-inactive">Inactive</span>';
      var roleClass = (u.role_name || "user").toLowerCase().replace(/\s+/g, "-");
      var roleBadge = '<span class="user-role-badge user-role-' + htmlEsc(roleClass) + '">' + htmlEsc(u.role_name || "—") + "</span>";
      return '<tr style="border-bottom:1px solid var(--line);">'
        + '<td style="padding:12px 14px; color:var(--muted); font-size:13px;">' + htmlEsc(u.id) + '</td>'
        + '<td style="padding:12px 14px; font-weight:700; color:var(--text);">' + htmlEsc(u.first_name + " " + u.last_name) + '</td>'
        + '<td style="padding:12px 14px; color:var(--muted);">' + htmlEsc(u.email || "—") + '</td>'
        + '<td style="padding:12px 14px; color:var(--muted);">' + htmlEsc(u.phone || "—") + '</td>'
        + '<td style="padding:12px 14px;">' + roleBadge + '</td>'
        + '<td style="padding:12px 14px;">' + activeBadge + '</td>'
        + '<td style="padding:12px 14px; color:var(--muted); font-size:13px;">' + htmlEsc(u.created_at || "—") + '</td>'
        + '<td class="alerts-actions-cell">'
        +   '<button class="btn btn-danger" onclick="deleteUser(' + u.id + ')">Delete</button>'
        + '</td>'
        + '</tr>';
    }).join("");
  }

  function filterUsersTable() {
    var query = (document.getElementById("userSearchInput").value || "").toLowerCase();
    if (!query) { renderUsersTable(_allUsers); return; }
    var filtered = _allUsers.filter(function (u) {
      var name  = (u.first_name + " " + u.last_name).toLowerCase();
      var email = (u.email || "").toLowerCase();
      var role  = (u.role_name || "").toLowerCase();
      return name.indexOf(query) !== -1 || email.indexOf(query) !== -1 || role.indexOf(query) !== -1;
    });
    renderUsersTable(filtered);
  }

  // ── Delete User ────────────────────────────────────────────────────────────

  var _pendingDeleteUserId = null;

  function deleteUser(userId) {
    _pendingDeleteUserId = userId;
    var modal = document.getElementById("deleteUserModal");
    if (modal) modal.style.display = "flex";
  }

  function closeDeleteUserModal() {
    _pendingDeleteUserId = null;
    var modal = document.getElementById("deleteUserModal");
    if (modal) modal.style.display = "none";
  }

  function confirmDeleteUser() {
    if (!_pendingDeleteUserId) return;
    var userId = _pendingDeleteUserId;
    closeDeleteUserModal();
    fetch("../../includes/delete_user.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "user_id=" + encodeURIComponent(userId)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { showToast("User deleted."); loadUsersTable(); }
        else showToast(data.message || "Failed to delete user.");
      })
      .catch(function () { showToast("Failed to delete user."); });
  }

  // ── Manage Barangays ───────────────────────────────────────────────────────

  var _allBarangays = [];

  function showBarangays() {
    hideAlertFormGrid();
    hideAllViews();
    var view = document.getElementById("manageBarangaysView");
    if (view) view.style.display = "block";
    loadBarangaysTable();
  }

  function hideManageBarangays() {
    showAlertFormGrid();
    var view = document.getElementById("manageBarangaysView");
    if (view) view.style.display = "none";
    var input = document.getElementById("barangaySearchInput");
    if (input) input.value = "";
  }

  function loadBarangaysTable() {
    var tbody = document.getElementById("barangaysTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="padding:24px; text-align:center; color:var(--muted);">Loading barangays…</td></tr>';
    fetch("../../includes/get_barangays.php")
      .then(function (res) { return res.json(); })
      .then(function (barangays) {
        _allBarangays = barangays;
        renderBarangaysTable(barangays);
      })
      .catch(function () {
        var el = document.getElementById("barangaysTableBody");
        if (el) el.innerHTML = '<tr><td colspan="5" style="padding:24px; text-align:center; color:var(--muted);">Failed to load barangays.</td></tr>';
      });
  }

  function renderBarangaysTable(barangays) {
    var tbody = document.getElementById("barangaysTableBody");
    if (!tbody) return;
    if (!barangays.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:24px; text-align:center; color:var(--muted);">No barangays found.</td></tr>';
      return;
    }
    tbody.innerHTML = barangays.map(function (b) {
      return '<tr style="border-bottom:1px solid var(--line);">'
        + '<td style="padding:12px 14px; color:var(--muted); font-size:13px;">' + htmlEsc(b.id) + '</td>'
        + '<td style="padding:12px 14px; font-weight:700; color:var(--text);">' + htmlEsc(b.barangay_name) + '</td>'
        + '<td style="padding:12px 14px; color:var(--muted);">' + htmlEsc(b.municipality_name || "—") + '</td>'
        + '<td style="padding:12px 14px; color:var(--muted); font-size:13px;">' + htmlEsc(b.created_at || "—") + '</td>'
        + '<td class="alerts-actions-cell">'
        +   '<button class="btn btn-edit" onclick="openEditBarangayModal(' + b.id + ', \'' + htmlEsc(b.barangay_name) + '\')">Edit</button>'
        +   '<button class="btn btn-danger" onclick="deleteBarangay(' + b.id + ')">Delete</button>'
        + '</td>'
        + '</tr>';
    }).join("");
  }

  function filterBarangaysTable() {
    var query = (document.getElementById("barangaySearchInput").value || "").toLowerCase();
    if (!query) { renderBarangaysTable(_allBarangays); return; }
    var filtered = _allBarangays.filter(function (b) {
      return b.barangay_name.toLowerCase().indexOf(query) !== -1
          || (b.municipality_name || "").toLowerCase().indexOf(query) !== -1;
    });
    renderBarangaysTable(filtered);
  }

  // ── Delete Barangay ────────────────────────────────────────────────────────

  var _pendingDeleteBarangayId = null;

  function deleteBarangay(id) {
    _pendingDeleteBarangayId = id;
    var modal = document.getElementById("deleteBarangayModal");
    if (modal) modal.style.display = "flex";
  }

  function closeDeleteBarangayModal() {
    _pendingDeleteBarangayId = null;
    var modal = document.getElementById("deleteBarangayModal");
    if (modal) modal.style.display = "none";
  }

  function confirmDeleteBarangay() {
    if (!_pendingDeleteBarangayId) return;
    var id = _pendingDeleteBarangayId;
    closeDeleteBarangayModal();
    fetch("../../includes/delete_barangay.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "id=" + encodeURIComponent(id)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { showToast("Barangay deleted."); loadBarangaysTable(); }
        else showToast(data.message || "Failed to delete barangay.");
      })
      .catch(function () { showToast("Failed to delete barangay."); });
  }

  // ── Edit Barangay ──────────────────────────────────────────────────────────

  var _pendingEditBarangayId = null;

  function openEditBarangayModal(id, name) {
    _pendingEditBarangayId = id;
    document.getElementById("editBarangayId").value   = id;
    document.getElementById("editBarangayName").value = name;
    var modal = document.getElementById("editBarangayModal");
    if (modal) modal.style.display = "flex";
  }

  function closeEditBarangayModal() {
    _pendingEditBarangayId = null;
    var modal = document.getElementById("editBarangayModal");
    if (modal) modal.style.display = "none";
  }

  function confirmEditBarangay() {
    if (!_pendingEditBarangayId) return;
    var name = document.getElementById("editBarangayName").value.trim();
    if (!name) { showToast("Please enter a barangay name."); return; }
    var id = _pendingEditBarangayId;
    closeEditBarangayModal();
    fetch("../../includes/edit_barangay.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "id=" + encodeURIComponent(id) + "&barangay_name=" + encodeURIComponent(name)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { showToast("Barangay updated."); loadBarangaysTable(); }
        else showToast(data.message || "Failed to update barangay.");
      })
      .catch(function () { showToast("Failed to update barangay."); });
  }

  // ── Manage Alerts ──────────────────────────────────────────────────────────

  function showManageAlerts() {
    hideAlertFormGrid();
    hideAllViews();
    var view = document.getElementById("manageAlertsView");
    if (view) view.style.display = "block";
    loadAlertsTable();
  }

  function hideManageAlerts() {
    showAlertFormGrid();
    var view = document.getElementById("manageAlertsView");
    if (view) view.style.display = "none";
  }

  function statusBadge(status) {
    var map = {
      active:    { bg: "rgba(73,209,125,0.12)",  border: "rgba(73,209,125,0.3)",  color: "var(--green)",  label: "Active"    },
      expired:   { bg: "rgba(255,216,77,0.12)",  border: "rgba(255,216,77,0.3)",  color: "var(--yellow)", label: "Expired"   },
      cancelled: { bg: "rgba(255,77,87,0.12)",   border: "rgba(255,77,87,0.3)",   color: "var(--red)",    label: "Cancelled" }
    };
    var s = map[status] || { bg: "var(--surface-raised)", border: "var(--line)", color: "var(--muted)", label: status };
    return '<span style="padding:5px 10px; border-radius:999px; background:' + s.bg + '; border:1px solid ' + s.border + '; color:' + s.color + '; font-size:12px; font-weight:700;">' + s.label + '</span>';
  }

  function loadAlertsTable() {
    var tbody = document.getElementById("alertsTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px; text-align:center; color:var(--muted);">Loading alerts…</td></tr>';
    fetch("../../includes/get_alerts.php")
      .then(function (res) { return res.json(); })
      .then(function (alerts) {
        if (!alerts.length) {
          tbody.innerHTML = '<tr><td colspan="7" style="padding:24px; text-align:center; color:var(--muted);">No alerts found.</td></tr>';
          return;
        }
        tbody.innerHTML = alerts.map(function (a) {
          return '<tr style="border-bottom:1px solid var(--line);">'
            + '<td style="padding:12px 14px; color:var(--muted);">' + htmlEsc(a.alert_id) + '</td>'
            + '<td style="padding:12px 14px; font-weight:700; color:var(--text);">' + htmlEsc(a.title) + '</td>'
            + '<td style="padding:12px 14px;"><span class="alert-type-badge alert-type-' + htmlEsc(a.alert_type) + '">' + htmlEsc(a.alert_type) + '</span></td>'
            + '<td style="padding:12px 14px; color:var(--muted); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + htmlEsc(a.description) + '</td>'
            + '<td style="padding:12px 14px;">' + statusBadge(a.status) + '</td>'
            + '<td style="padding:12px 14px; color:var(--muted); font-size:13px;">' + htmlEsc(a.created_at || "") + '</td>'
            + '<td class="alerts-actions-cell">'
            +   '<button class="btn btn-edit" onclick="openEditModal(' + a.alert_id + ', \'' + htmlEsc(a.title) + '\', \'' + htmlEsc(a.description) + '\', \'' + htmlEsc(a.alert_type) + '\')">Edit</button>'
            +   '<button class="btn btn-status" onclick="openStatusModal(' + a.alert_id + ', \'' + htmlEsc(a.status) + '\')">Status</button>'
            +   '<button class="btn btn-danger" onclick="cancelAlert(' + a.alert_id + ')">Delete</button>'
            + '</td>'
            + '</tr>';
        }).join("");
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:24px; text-align:center; color:var(--muted);">Failed to load alerts.</td></tr>';
      });
  }

  // ── Delete Alert ───────────────────────────────────────────────────────────

  var _pendingCancelId = null;

  function cancelAlert(alertId) {
    _pendingCancelId = alertId;
    var modal = document.getElementById("cancelModal");
    if (modal) modal.style.display = "flex";
  }

  function closeCancelModal() {
    _pendingCancelId = null;
    var modal = document.getElementById("cancelModal");
    if (modal) modal.style.display = "none";
  }

  function confirmCancelAlert() {
    if (!_pendingCancelId) return;
    var alertId = _pendingCancelId;
    closeCancelModal();
    fetch("../../includes/cancel_alert.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "alert_id=" + encodeURIComponent(alertId)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { showToast("Alert deleted."); loadAlertsTable(); }
        else showToast("Failed to delete alert.");
      })
      .catch(function () { showToast("Failed to delete alert."); });
  }

  // ── Change Status ──────────────────────────────────────────────────────────

  var _pendingStatusId = null;

  function openStatusModal(alertId, currentStatus) {
    _pendingStatusId = alertId;
    document.querySelectorAll('input[name="alertStatus"]').forEach(function (r) {
      r.checked = r.value === currentStatus;
    });
    var modal = document.getElementById("statusModal");
    if (modal) modal.style.display = "flex";
  }

  function closeStatusModal() {
    _pendingStatusId = null;
    var modal = document.getElementById("statusModal");
    if (modal) modal.style.display = "none";
  }

  function confirmStatusChange() {
    if (!_pendingStatusId) return;
    var selected = document.querySelector('input[name="alertStatus"]:checked');
    if (!selected) { showToast("Please select a status."); return; }
    var alertId = _pendingStatusId;
    var status  = selected.value;
    closeStatusModal();
    fetch("../../includes/update_alert_status.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "alert_id=" + encodeURIComponent(alertId) + "&status=" + encodeURIComponent(status)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { showToast("Status updated to " + status + "."); loadAlertsTable(); }
        else showToast("Failed to update status.");
      })
      .catch(function () { showToast("Failed to update status."); });
  }

  // ── Edit Alert ─────────────────────────────────────────────────────────────

  var _pendingEditId = null;

  function openEditModal(alertId, title, description, alertType) {
    _pendingEditId = alertId;
    document.getElementById("editAlertId").value    = alertId;
    document.getElementById("editAlertTitle").value = title;
    document.getElementById("editAlertDesc").value  = description;
    document.getElementById("editAlertType").value  = alertType;
    var modal = document.getElementById("editModal");
    if (modal) modal.style.display = "flex";
  }

  function closeEditModal() {
    _pendingEditId = null;
    var modal = document.getElementById("editModal");
    if (modal) modal.style.display = "none";
  }

  function confirmEditAlert() {
    if (!_pendingEditId) return;
    var title       = document.getElementById("editAlertTitle").value.trim();
    var description = document.getElementById("editAlertDesc").value.trim();
    var alertType   = document.getElementById("editAlertType").value;
    if (!title || !description) { showToast("Please fill in all fields."); return; }
    fetch("../../includes/edit_alert.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "alert_id=" + encodeURIComponent(_pendingEditId)
          + "&title=" + encodeURIComponent(title)
          + "&description=" + encodeURIComponent(description)
          + "&alert_type=" + encodeURIComponent(alertType)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { showToast("Alert updated."); closeEditModal(); loadAlertsTable(); }
        else showToast("Failed to update alert.");
      })
      .catch(function () { showToast("Failed to update alert."); });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function htmlEsc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Expose globals ─────────────────────────────────────────────────────────

  window.showToast                = showToast;
  window.publishAlert             = publishAlert;
  window.showUsers                = showUsers;
  window.hideManageUsers          = hideManageUsers;
  window.filterUsersTable         = filterUsersTable;
  window.deleteUser               = deleteUser;
  window.closeDeleteUserModal     = closeDeleteUserModal;
  window.confirmDeleteUser        = confirmDeleteUser;
  window.showBarangays            = showBarangays;
  window.hideManageBarangays      = hideManageBarangays;
  window.filterBarangaysTable     = filterBarangaysTable;
  window.deleteBarangay           = deleteBarangay;
  window.closeDeleteBarangayModal = closeDeleteBarangayModal;
  window.confirmDeleteBarangay    = confirmDeleteBarangay;
  window.openEditBarangayModal    = openEditBarangayModal;
  window.closeEditBarangayModal   = closeEditBarangayModal;
  window.confirmEditBarangay      = confirmEditBarangay;
  window.showManageAlerts         = showManageAlerts;
  window.hideManageAlerts         = hideManageAlerts;
  window.cancelAlert              = cancelAlert;
  window.closeCancelModal         = closeCancelModal;
  window.confirmCancelAlert       = confirmCancelAlert;
  window.openStatusModal          = openStatusModal;
  window.closeStatusModal         = closeStatusModal;
  window.confirmStatusChange      = confirmStatusChange;
  window.openEditModal            = openEditModal;
  window.closeEditModal           = closeEditModal;
  window.confirmEditAlert         = confirmEditAlert;

  document.addEventListener("DOMContentLoaded", function () {
    startRadarReportSync();
  });
})();