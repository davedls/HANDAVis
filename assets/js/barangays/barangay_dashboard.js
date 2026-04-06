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
  if (target) {
    target.style.display = "block";
  }

  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active-link");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => (toast.style.display = "none"), 2400);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openConfirmModal(title, message, confirmLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(5, 10, 18, 0.62)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    const modal = document.createElement("div");
    modal.style.width = "min(92vw, 420px)";
    modal.style.background = "#0f1720";
    modal.style.border = "1px solid #223345";
    modal.style.borderRadius = "12px";
    modal.style.padding = "16px";
    modal.style.color = "#d9e7f5";
    modal.style.boxShadow = "0 16px 40px rgba(0,0,0,.45)";

    modal.innerHTML = `
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">${title}</div>
      <div style="font-size:13px;line-height:1.5;color:#9db0c8;margin-bottom:14px">${message}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="button" data-role="cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #2a3e53;background:#111a24;color:#d9e7f5;cursor:pointer">Cancel</button>
        <button type="button" data-role="confirm" style="padding:8px 12px;border-radius:8px;border:1px solid #2a3e53;background:#14b8a6;color:#062019;font-weight:700;cursor:pointer">${confirmLabel}</button>
      </div>
    `;

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    modal.querySelector("[data-role='cancel']").addEventListener("click", () => close(false));
    modal.querySelector("[data-role='confirm']").addEventListener("click", () => close(true));

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

function scrollToEl(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function extractNumericReportId(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function barangayReview(btn, approved) {
  const card   = btn.closest(".report-card, .list-item");
  const reportId = extractNumericReportId(
    btn?.dataset?.reportId || card?.dataset?.reportId || 0
  );
  if (!reportId) {
    showToast("Invalid report item.");
    return;
  }

  const confirmed = await openConfirmModal(
    approved ? "Verify Report" : "Reject Report",
    approved
      ? "Are you sure you want to verify this report and move it to Incident Monitoring?"
      : "Are you sure you want to reject this report? It will be removed from the pending list.",
    approved ? "Verify" : "Reject"
  );
  if (!confirmed) return;

  fetch("../../database/barangay/barangay_incident_reports.php?action=barangay_review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId, approved })
  })
    .then(r => r.json())
    .then(result => {
      if (!result?.ok) throw new Error("review failed");

      const status = card.querySelector(".report-status");
      if (status) status.textContent = `Status: ${result.statusLabel}`;

      const pending = document.getElementById("pendingReports");
      if (pending) {
        const nextPending = Math.max(0, parseInt(pending.textContent || "0", 10) - 1);
        pending.textContent = String(nextPending);
        setVerifyReportsBadge(nextPending);
      }

      if (approved) {
        card.style.borderColor = "var(--cyan)";
        card.remove();
        showToast("Report verified by barangay.");
        const incidentUrl = "barangay_incident-reporting.php?view=assign&report_id=" + encodeURIComponent(String(reportId));
        setTimeout(() => {
          window.location.href = incidentUrl;
        }, 250);
      } else {
        card.remove();
        showToast("Report rejected.");
      }

      card.querySelectorAll("button").forEach(b => (b.disabled = true));
    })
    .catch(() => showToast("Failed to update report review."));
}

function sendBroadcast() {
  const type    = document.getElementById("broadcastType").value;
  const message = document.getElementById("broadcastMessage").value.trim();

  if (!message) {
    showToast("Type the broadcast message first.");
    return;
  }

  const count = document.getElementById("broadcastCount");
  if (count) {
    count.textContent = String(parseInt(count.textContent, 10) + 1);
  }

  document.getElementById("broadcastStatus").textContent =
    `Latest broadcast: ${type} — "${message}"`;

  document.getElementById("broadcastMessage").value = "";
  showToast("Barangay emergency broadcast sent.");
}

let barangayReportsLoading = false;
let barangayReportsPollId = 0;

function setVerifyReportsBadge(count) {
  const badge = document.getElementById("verifyReportsBadge");
  if (!badge) return;

  const safeCount = Math.max(0, Number(count) || 0);
  if (safeCount <= 0) {
    badge.style.display = "none";
    badge.textContent = "0";
    return;
  }

  badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  badge.style.display = "inline-flex";
}

function setIncidentMonitoringBadge(count) {
  const badge = document.getElementById("incidentMonitoringBadge");
  if (!badge) return;

  const safeCount = Math.max(0, Number(count) || 0);
  if (safeCount <= 0) {
    badge.style.display = "none";
    badge.textContent = "0";
    return;
  }

  badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  badge.style.display = "inline-flex";
}

function loadIncidentMonitoringBadge(options = {}) {
  const silent = Boolean(options && options.silent);
  return fetch("../../database/barangay/barangay_incident_reports.php?action=barangay_feed&view=incident")
    .then((r) => r.json())
    .then((result) => {
      if (!result?.ok) throw new Error("incident feed failed");
      const count = Array.isArray(result.reports) ? result.reports.length : 0;
      setIncidentMonitoringBadge(count);
    })
    .catch(() => {
      if (!silent) {
        setIncidentMonitoringBadge(0);
      }
    });
}

function titleCaseWords(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}

function formatPeopleAffectedLabel(code) {
  const raw = String(code || "").trim().toLowerCase();
  if (!raw) return "";
  if (/^\d+_\d+$/.test(raw)) return raw.replace("_", "-");
  if (raw === "20_plus") return "20+";
  return titleCaseWords(raw);
}

function splitLocationParts(locationText) {
  const parts = String(locationText || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    primary: parts.slice(0, 2).join(", ") || "Location not specified",
    secondary: parts.slice(2).join(", ")
  };
}

function parseIncidentDate(createdAt) {
  const date = createdAt ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { dateLabel: "Unknown date", timeLabel: "Unknown time" };
  }
  return {
    dateLabel: date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
    timeLabel: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  };
}

function reportTone(hazardType) {
  const key = String(hazardType || "").toLowerCase();
  if (key.includes("fire")) {
    return {
      rootClass: "tone-fire",
      icon: `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2C12 2 7 7.5 7 12.5C7 15.5 9.2 18 12 18C14.8 18 17 15.5 17 12.5C17 9.5 14 6 12 2Z" fill="currentColor"/>
          <path d="M12 8C12 8 9.5 10.5 9.5 13C9.5 14.4 10.6 15.5 12 15.5C13.4 15.5 14.5 14.4 14.5 13C14.5 10.5 12 8 12 8Z" fill="rgba(255,255,255,.55)"/>
          <rect x="10" y="18" width="4" height="3" rx="1" fill="currentColor"/>
        </svg>
      `
    };
  }
  if (key.includes("flood") || key.includes("storm") || key.includes("typhoon")) {
    return {
      rootClass: "tone-flood",
      icon: `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 11.5a4.5 4.5 0 0 1 1.1-8.85 5.5 5.5 0 0 1 10.8 1.2A4.25 4.25 0 1 1 18.25 12H6z" fill="currentColor"/>
          <path d="M7 16c1 .9 2 .9 3 0s2-.9 3 0 2 .9 3 0" stroke="rgba(255,255,255,.62)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M6 19c1 .9 2 .9 3 0s2-.9 3 0 2 .9 3 0" stroke="rgba(255,255,255,.42)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
      `
    };
  }
  return {
    rootClass: "tone-default",
    icon: `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3L2.7 19a1.2 1.2 0 0 0 1.04 1.8h16.52a1.2 1.2 0 0 0 1.04-1.8L12 3z" fill="currentColor"/>
        <rect x="11" y="8" width="2" height="6" rx="1" fill="rgba(255,255,255,.76)"/>
        <rect x="11" y="15.5" width="2" height="2" rx="1" fill="rgba(255,255,255,.76)"/>
      </svg>
    `
  };
}

function buildSituationChips(report) {
  const chips = [];

  if (report.hazardSpecificDetail) {
    chips.push({ label: titleCaseWords(report.hazardSpecificDetail), tone: "danger" });
  }
  if (report.injuryLevelCode) {
    const injuryKey = String(report.injuryLevelCode).toLowerCase();
    chips.push({
      label: injuryKey === "none" ? "No injuries reported" : `${titleCaseWords(report.injuryLevelCode)} injuries`,
      tone: injuryKey === "none" ? "good" : "warn"
    });
  }
  if (report.roadConditionCode) {
    const roadKey = String(report.roadConditionCode).toLowerCase();
    chips.push({
      label: roadKey.includes("pass") ? "Road passable" : `Road ${titleCaseWords(report.roadConditionCode)}`,
      tone: roadKey.includes("pass") ? "good" : "neutral"
    });
  }
  if (report.peopleAffectedCode) {
    chips.push({ label: `People affected: ${formatPeopleAffectedLabel(report.peopleAffectedCode)}`, tone: "info" });
  }
  if (report.rescueNeeded) {
    chips.push({ label: "Rescue needed", tone: "warn" });
  }
  if (report.hasPhoto) {
    chips.push({ label: "Photo attached", tone: "neutral" });
  }

  if (!chips.length) {
    chips.push({ label: "Community details pending", tone: "neutral" });
  }
  return chips;
}

function renderBarangayReports(reports) {
  const container = document.getElementById("barangayReports");
  if (!container) return;

  const pendingOnly = (reports || []).filter(r => r.statusCode === "pending_barangay");

  if (!pendingOnly.length) {
    container.innerHTML = '<div class="list-item"><strong>No reports yet</strong><span class="report-status">Status: No pending reports in your barangay.</span></div>';
    return;
  }

  container.innerHTML = pendingOnly.map(report => {
    const reportId = escapeHtml(String(report.id ?? ""));
    const tone = reportTone(report.hazardType);
    const statusLabelText = String(report.statusLabel || "").trim() || "Pending Verification";
    const location = splitLocationParts(report.locationText);
    const incidentTime = parseIncidentDate(report.createdAt);
    const statusTag = statusLabelText === "Pending Verification" ? "Pending Barangay Review" : statusLabelText;
    const chips = buildSituationChips(report);
    const safeTitle = escapeHtml(report.hazardType || report.title || "Incident Report");
    const safeDescription = escapeHtml(String(report.description || "").trim() || "No additional details from the reporter.");
    const safeReporter = escapeHtml(report.reporterName || "Community member");
    const safePrimaryLocation = escapeHtml(location.primary);
    const safeSecondaryLocation = escapeHtml(location.secondary);
    const safeDate = escapeHtml(incidentTime.dateLabel);
    const safeTime = escapeHtml(incidentTime.timeLabel);
    const safeStatusTag = escapeHtml(statusTag);
    const safeConfirmWeight = escapeHtml(String(report.confirmWeight ?? 0));
    const safeRejectWeight = escapeHtml(String(report.rejectWeight ?? 0));
    const chipHtml = chips.map((chip) =>
      `<span class="report-chip ${chip.tone}">${escapeHtml(chip.label)}</span>`
    ).join("");

    return `
      <article class="report-card ${tone.rootClass}" data-report-id="${reportId}">
        <header class="report-card-head">
          <div class="report-card-icon">${tone.icon}</div>
          <span class="report-card-title">${safeTitle} Report</span>
          <span class="report-status">${safeStatusTag}</span>
        </header>

        <div class="report-card-body">
          <section class="report-meta-grid">
            <div>
              <p class="report-label">Location</p>
              <p class="report-meta-strong">${safePrimaryLocation}</p>
              ${safeSecondaryLocation ? `<p class="report-meta-muted">${safeSecondaryLocation}</p>` : ""}
            </div>
            <div>
              <p class="report-label">Submitted</p>
              <p class="report-meta-strong">${safeDate}</p>
              <p class="report-meta-muted">${safeTime}</p>
            </div>
          </section>

          <section class="report-message">
            <p class="report-label">Reporter message</p>
            <p class="report-message-text">"${safeDescription}"</p>
          </section>

          <section class="report-divider">
            <p class="report-label">Situation details</p>
            <div class="report-chip-wrap">${chipHtml}</div>
          </section>

          <section class="report-divider report-footer">
            <div>
              <p class="report-label">Reporter</p>
              <p class="report-meta-strong">${safeReporter}</p>
            </div>
            <div class="report-votes">
              <div>
                <p class="report-vote-value confirm">${safeConfirmWeight}</p>
                <p class="report-vote-label">Confirm</p>
              </div>
              <div>
                <p class="report-vote-value reject">${safeRejectWeight}</p>
                <p class="report-vote-label">Reject</p>
              </div>
            </div>
          </section>

          <div class="report-actions">
            <button class="report-action verify" data-report-id="${reportId}" onclick="barangayReview(this, true)">Verify</button>
            <button class="report-action reject" data-report-id="${reportId}" onclick="barangayReview(this, false)">Reject</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function loadBarangayReports(options = {}) {
  const silent = Boolean(options && options.silent);
  if (barangayReportsLoading) return;
  barangayReportsLoading = true;

  fetch("../../database/barangay/barangay_incident_reports.php?action=barangay_feed")
    .then(r => r.json())
    .then(result => {
      if (!result?.ok) throw new Error("feed failed");
      const pending = document.getElementById("pendingReports");
      const sos = document.getElementById("barangaySOS");
      if (pending) pending.textContent = String(result.pendingCount || 0);
      setVerifyReportsBadge(result.pendingCount || 0);
      if (sos) sos.textContent = String(result.sosCount || 0);
      renderBarangayReports(result.reports || []);
    })
    .catch(() => {
      if (!silent) showToast("Failed to load barangay reports.");
    })
    .finally(() => {
      barangayReportsLoading = false;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  loadBarangayReports();
  loadIncidentMonitoringBadge({ silent: true });

  if (barangayReportsPollId) {
    clearInterval(barangayReportsPollId);
  }
  barangayReportsPollId = window.setInterval(() => {
    loadBarangayReports({ silent: true });
    loadIncidentMonitoringBadge({ silent: true });
  }, 15000);
});

window.addEventListener("focus", () => {
  loadBarangayReports({ silent: true });
  loadIncidentMonitoringBadge({ silent: true });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadBarangayReports({ silent: true });
    loadIncidentMonitoringBadge({ silent: true });
  }
});
