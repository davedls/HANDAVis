(function initTheme() {
  const saved = localStorage.getItem('theme-preference');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
  }
  document.documentElement.classList.add('ready');
})();

function showSection(sectionId) {
  document.querySelectorAll(".section-view").forEach(el => {
    el.style.display = "none";
  });

  document.querySelectorAll(".sub-link").forEach(btn => {
    btn.classList.remove("active-link");
  });

  const target = document.getElementById("section-" + sectionId);
  if (target) target.style.display = "block";

  event.currentTarget.classList.add("active-link");

  const userView = document.getElementById("userView");
  if (userView) userView.style.display = "none";

  // hide any open inline views when switching sections
  ["manageUsersView", "manageBarangaysView", "manageAlertsView"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // restore the alert form grid if switching away
  const grid = document.getElementById("alertFormGrid");
  if (grid) grid.style.display = "";

  if (sectionId === "barangaylist") {
    renderBarangays(CITIES[currentCity].barangays);
  }
}

function buildUserView(html) {
  document.querySelector("#section-alert .content-grid").style.display = "none";
  const userView = document.getElementById("userView");
  userView.style.display = "block";
  userView.innerHTML = html;
  window.scrollTo(0, 0);
}

function goBack() {
  document.querySelector("#section-alert .content-grid").style.display = "grid";
  document.getElementById("userView").style.display = "none";
}

function scrollToEl(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => (toast.style.display = "none"), 2400);
}

function getUserItem(username) {
  return document.querySelector(`.list-item[data-user="${username}"]`);
}

function updateUserDisplay(item) {
  const userName = item.dataset.user;
  const verified = item.dataset.verified === "true";
  const active   = item.dataset.active   === "true";
  const role     = item.dataset.role;

  item.querySelector(".user-title").textContent =
    `${userName}${verified ? " | Verified" : ""}${active ? "" : " | Deactivated"}`;
  item.querySelector(".user-role").textContent = `Role: ${role}`;

  const verifyBtn   = item.querySelector(".verify-btn");
  const activateBtn = item.querySelector(".activate-btn");

  if (verifyBtn)   { verifyBtn.textContent = verified ? "Verified" : "Verify"; verifyBtn.disabled = verified; }
  if (activateBtn) { activateBtn.textContent = active ? "Deactivate" : "Reactivate"; }
}

function renderUserItem(user) {
  return `
    <div class="list-item"
         data-user="${user.username}"
         data-verified="${user.verified}"
         data-active="${user.active}"
         data-role="${user.role}">
      <strong class="user-title">${user.username}${user.verified ? " | Verified" : ""}${user.active ? "" : " | Deactivated"}</strong>
      <span class="user-role">Role: ${user.role}</span>
      <div class="action-row">
        <button class="btn soft verify-btn"   onclick="verifyUser('${user.username}')">${user.verified ? "Verified" : "Verify"}</button>
        <button class="btn soft activate-btn" onclick="deactivateUser('${user.username}')">${user.active ? "Deactivate" : "Reactivate"}</button>
        <button class="btn soft"              onclick="changeRole('${user.username}')">Change Role</button>
      </div>
    </div>
  `;
}

// ── handled by admin_dashboard.js ─────────────────────────────────────────
window.showUsers     = function () {};
window.showBarangays = function () {};

function verifyUser(username) {
  const item = getUserItem(username);
  if (!item) return;
  if (item.dataset.verified === "true") { showToast(`${username} is already verified.`); return; }
  item.dataset.verified = "true";
  updateUserDisplay(item);
  showToast(`${username} verified successfully.`);
}

function deactivateUser(username) {
  const item = getUserItem(username);
  if (!item) return;
  const currentlyActive = item.dataset.active === "true";
  item.dataset.active = currentlyActive ? "false" : "true";
  updateUserDisplay(item);
  showToast(currentlyActive ? `${username} has been deactivated.` : `${username} has been reactivated.`);
}

function changeRole(username) {
  const item = getUserItem(username);
  if (!item) return;
  const newRole = prompt(`Enter new role for ${username}:`);
  if (!newRole) return;
  item.dataset.role = newRole;
  updateUserDisplay(item);
  showToast(`${username}'s role has been changed successfully.`);
}

function showResponderLogs() {
  buildUserView(`
    <div class="panel">
      <button class="btn secondary" onclick="goBack()" style="margin-bottom:15px;">← Back</button>
      <div class="eyebrow">Responder Logs</div>
      <h2 style="margin-bottom:15px;">Activity Logs</h2>
      <div class="list">
        <div class="list-item"><strong>Responder01</strong><span>Responded to flood alert at Barangay 2</span></div>
        <div class="list-item"><strong>Responder02</strong><span>Assisted evacuation at Barangay 5</span></div>
        <div class="list-item"><strong>Responder03</strong><span>Submitted incident report (Fire)</span></div>
      </div>
    </div>
  `);
}

function showAnalytics() {
  buildUserView(`
    <div class="panel">
      <button class="btn secondary" onclick="goBack()" style="margin-bottom:15px;">← Back</button>
      <div class="eyebrow">Analytics Dashboard</div>
      <h2 style="margin-bottom:15px;">System Overview</h2>
      <div class="mini-grid">
        <div class="mini-box"><strong>12,430</strong><span>Total Registered Users</span></div>
        <div class="mini-box"><strong>67%</strong>   <span>Increase in Reports</span></div>
        <div class="mini-box"><strong>24</strong>    <span>Active Incidents Today</span></div>
        <div class="mini-box"><strong>9</strong>     <span>High Risk Barangays</span></div>
      </div>
      <h3 style="margin:20px 0 10px;">System Performance</h3>
      <div class="score"><div><strong>Response Time</strong><small>Average responder arrival time</small></div><strong>Good</strong></div>
      <div class="progress"><div style="width:75%"></div></div>
      <div class="score"><div><strong>Alert Effectiveness</strong><small>User engagement with alerts</small></div><strong>Moderate</strong></div>
      <div class="progress"><div style="width:60%"></div></div>
      <div class="score"><div><strong>System Stability</strong><small>Uptime and reliability</small></div><strong>Excellent</strong></div>
      <div class="progress"><div style="width:90%"></div></div>
    </div>
  `);
  updateProgressBarColors();
}

function setProgressBarColor(el) {
  const w = parseInt(el.style.width, 10) || 0;
  let color = "#ef4444";
  if (w > 75)      color = "#22c55e";
  else if (w > 50) color = "#eab308";
  else if (w > 25) color = "#f97316";
  el.style.background = color;
}

function updateProgressBarColors() {
  document.querySelectorAll(".progress > div").forEach(setProgressBarColor);
}

function publishAlert() {
  const title   = document.getElementById("alertTitle").value.trim();
  const level   = document.getElementById("alertLevel").value;
  const message = document.getElementById("alertMessage").value.trim();

  if (!title || !message) { showToast("Complete the regional alert form."); return; }

  const list = document.getElementById("adminLogList");
  const item = document.createElement("div");
  item.className = "list-item";
  item.innerHTML = `<strong>${level}: ${title}</strong><span>${message}</span>`;
  list.prepend(item);

  const counter = document.getElementById("adminAlertCount");
  counter.textContent = String(parseInt(counter.textContent, 10) + 1);

  document.getElementById("alertTitle").value   = "";
  document.getElementById("alertMessage").value = "";

  showToast("Regional alert published.");
}

const CITIES = {
  bacolod: {
    label: "Bacolod City",
    barangays: [
      { name: "Alijis",              district: "1", status: "normal"  },
      { name: "Banago",              district: "1", status: "watch"   },
      { name: "Bata",                district: "1", status: "warning" },
      { name: "Cabug",               district: "1", status: "normal"  },
      { name: "Estefania",           district: "1", status: "normal"  },
      { name: "Granada",             district: "1", status: "normal"  },
      { name: "Handumanan",          district: "1", status: "normal"  },
      { name: "Mandalagan",          district: "1", status: "watch"   },
      { name: "Mansilingan",         district: "1", status: "warning" },
      { name: "Montevista",          district: "1", status: "normal"  },
      { name: "Punta Taytay",        district: "1", status: "normal"  },
      { name: "Singcang-Airport",    district: "1", status: "watch"   },
      { name: "Sum-ag",              district: "1", status: "normal"  },
      { name: "Taculing",            district: "1", status: "normal"  },
      { name: "Tangub",              district: "1", status: "danger"  },
      { name: "Tanza",               district: "1", status: "normal"  },
      { name: "Villamonte",          district: "1", status: "normal"  },
      { name: "Vista Alegre",        district: "1", status: "normal"  },
      { name: "Bacolod Reclamation", district: "1", status: "normal"  },
      { name: "Alangilan",           district: "2", status: "normal"  },
      { name: "Bagumbayan",          district: "2", status: "normal"  },
      { name: "Bugo",                district: "2", status: "normal"  },
      { name: "Bulldog",             district: "2", status: "watch"   },
      { name: "Caduhaan",            district: "2", status: "normal"  },
      { name: "Campolaga",           district: "2", status: "normal"  },
      { name: "Capitan Ramon",       district: "2", status: "normal"  },
      { name: "Dulao",               district: "2", status: "normal"  },
      { name: "Felisa",              district: "2", status: "warning" },
      { name: "Gold Camp",           district: "2", status: "normal"  },
      { name: "Ilang",               district: "2", status: "normal"  },
      { name: "Lamigas",             district: "2", status: "normal"  },
      { name: "Loma de Gonzaga",     district: "2", status: "normal"  },
      { name: "Lopez Jaena",         district: "2", status: "normal"  },
      { name: "Lupit",               district: "2", status: "normal"  },
      { name: "Mailum",              district: "2", status: "normal"  },
      { name: "Maug",                district: "2", status: "normal"  },
      { name: "Municipio",           district: "2", status: "normal"  },
      { name: "Pahanocoy",           district: "2", status: "watch"   },
      { name: "Punta",               district: "2", status: "warning" },
      { name: "Quirino",             district: "2", status: "normal"  },
      { name: "Rapport",             district: "2", status: "normal"  },
      { name: "Reclamation",         district: "2", status: "normal"  },
      { name: "Sampinit",            district: "2", status: "normal"  },
      { name: "Sipit",               district: "2", status: "normal"  },
      { name: "Taculing Norte",      district: "2", status: "normal"  },
      { name: "Taculing Sur",        district: "2", status: "normal"  },
      { name: "Talok",               district: "2", status: "normal"  },
      { name: "Tapia",               district: "2", status: "normal"  },
      { name: "Trinidad",            district: "2", status: "normal"  },
      { name: "Visayan Village",     district: "2", status: "normal"  },
      { name: "Waguisan",            district: "2", status: "normal"  },
    ],
  },
};

const STATUS_LABELS = { normal: "Normal", watch: "Watch", warning: "Warning", danger: "Danger" };

let currentCity = "bacolod";
let selectedBgy = null;

function loadAdminReportSummary() {
  fetch("../../database/hazard_reports.php?action=admin_summary")
    .then(r => r.json())
    .then(result => {
      if (!result?.ok) throw new Error("summary failed");
      const verified = document.getElementById("adminVerifiedReports");
      if (verified) verified.textContent = String(result.metrics?.verifiedReports ?? 0);
    })
    .catch(() => {});
}

function renderBarangays(list) {
  const grid    = document.getElementById("bgyGrid");
  const shownEl = document.getElementById("bgyShown");
  if (!grid || !shownEl) return;

  if (!list.length) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:13px;grid-column:1/-1;padding:12px 0">No barangays found.</div>`;
    shownEl.textContent = "0";
    return;
  }

  shownEl.textContent = list.length;
  grid.innerHTML = list.map(b => `
    <div class="bgy-card${selectedBgy === b.name ? " selected" : ""}"
         onclick="selectBgy(this, '${b.name}')">
      <div class="bgy-name">${b.name}</div>
      <div class="bgy-meta">District ${b.district}</div>
      <span class="bgy-status ${b.status}">${STATUS_LABELS[b.status]}</span>
    </div>
  `).join("");
}

function filterBarangays() {
  const q   = document.getElementById("bgySearch").value.toLowerCase();
  const all = CITIES[currentCity].barangays;
  renderBarangays(q ? all.filter(b => b.name.toLowerCase().includes(q)) : all);
}

function switchCity(tab) {
  document.querySelectorAll(".city-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  currentCity = tab.dataset.city;
  selectedBgy = null;
  document.getElementById("bgySearch").value = "";
  renderBarangays(CITIES[currentCity].barangays);
}

function selectBgy(card, name) {
  const deselecting = selectedBgy === name;
  selectedBgy = deselecting ? null : name;
  document.querySelectorAll(".bgy-card").forEach(c => c.classList.remove("selected"));
  if (selectedBgy) {
    card.classList.add("selected");
    showToast("Selected barangay: " + name);
  }
}

document.addEventListener("DOMContentLoaded", loadAdminReportSummary);