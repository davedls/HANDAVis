const FEED_CACHE_KEY = "handavis-live-dashboard-feed-v3";
const BACOLOD_LAT = 10.6407;
const BACOLOD_LON = 122.9457;

const WMO_MAP = {
  0: { label: "Clear Sky", icon: "sunny" },
  1: { label: "Mainly Clear", icon: "sunny" },
  2: { label: "Partly Cloudy", icon: "cloudy" },
  3: { label: "Overcast", icon: "cloudy" },
  45: { label: "Foggy", icon: "cloudy" },
  48: { label: "Icy Fog", icon: "cloudy" },
  51: { label: "Light Drizzle", icon: "rain" },
  53: { label: "Drizzle", icon: "rain" },
  55: { label: "Heavy Drizzle", icon: "rain" },
  61: { label: "Light Rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy Rain", icon: "rain" },
  80: { label: "Light Showers", icon: "rain" },
  81: { label: "Showers", icon: "rain" },
  82: { label: "Heavy Showers", icon: "rain" },
  95: { label: "Thunderstorm", icon: "storm" },
  96: { label: "Thunderstorm", icon: "storm" },
  99: { label: "Severe Thunderstorm", icon: "storm" },
};

const WEATHER_ICONS = {
  sunny: `<svg id="pagasaWeatherIcon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="pagasa-weather-svg">
    <circle cx="32" cy="32" r="10" stroke="#ffd84d" stroke-width="2.5" fill="rgba(255,216,77,0.10)"/>
    <line x1="32" y1="8"  x2="32" y2="14" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="50" x2="32" y2="56" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="8"  y1="32" x2="14" y2="32" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="50" y1="32" x2="56" y2="32" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="15.5" y1="15.5" x2="19.7" y2="19.7" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="44.3" y1="44.3" x2="48.5" y2="48.5" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="48.5" y1="15.5" x2="44.3" y2="19.7" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="19.7" y1="44.3" x2="15.5" y2="48.5" stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  cloudy: `<svg id="pagasaWeatherIcon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="pagasa-weather-svg">
    <path d="M46 28a10 10 0 0 0-19.6-2.8A8 8 0 1 0 20 41h26a8 8 0 0 0 0-16z"
          stroke="#4fd8ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          fill="rgba(79,216,255,0.08)"/>
  </svg>`,
  rain: `<svg id="pagasaWeatherIcon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="pagasa-weather-svg">
    <path d="M46 28a10 10 0 0 0-19.6-2.8A8 8 0 1 0 20 41h26a8 8 0 0 0 0-16z"
          stroke="#4fd8ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          fill="rgba(79,216,255,0.08)"/>
    <line x1="26" y1="47" x2="24" y2="54" stroke="#4fd8ff" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="47" x2="30" y2="54" stroke="#4fd8ff" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="47" x2="36" y2="54" stroke="#4fd8ff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  storm: `<svg id="pagasaWeatherIcon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="pagasa-weather-svg">
    <path d="M46 28a10 10 0 0 0-19.6-2.8A8 8 0 1 0 20 41h26a8 8 0 0 0 0-16z"
          stroke="#ffd84d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          fill="rgba(255,216,77,0.06)"/>
    <polyline points="35,44 29,53 34,53 28,62" stroke="#ffd84d" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.style.display = "none";
  }, 2400);
}

function toggleTheme() {
  const isLightMode = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme-preference", isLightMode ? "light" : "dark");
}

(function initTheme() {
  const savedTheme = localStorage.getItem("theme-preference");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
  }
})();

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function jumpToAnchor(selector) {
  const target = document.querySelector(selector);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  return false;
}

function goToPanel(pageId, anchorSelector = "") {
  if (typeof window.setActivePage === "function") {
    window.setActivePage(pageId);
    requestAnimationFrame(() => {
      if (anchorSelector) {
        const target = document.querySelector(anchorSelector);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    return;
  }

  const page = document.getElementById(pageId);
  if (page) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    page.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (anchorSelector && jumpToAnchor(anchorSelector)) {
    return;
  }

  showToast("That panel is not available in this page yet.");
}

function setActivePageSafe(pageId) {
  if (typeof window.setActivePage === "function") {
    window.setActivePage(pageId);
    return;
  }
  const page = document.getElementById(pageId);
  if (page) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    page.classList.add("active");
    return;
  }
  showToast("Target panel is not available yet.");
}

function goToUserAlerts() {
  window.location.href = "user_alerts.php";
}

function jumpToAlerts() {
  goToUserAlerts();
}

function jumpToMap() {
  goToPanel("mapPage", "#liveMap");
}

function openHouseholdSafety() {
  window.location.href = "house_safety.php";
  return true;
}

function jumpToSafety() {
  window.location.href = "house_safety.php";
}

function jumpToNews() {
  jumpToAnchor("#newsTop");
}

function jumpToWeatherSection() {
  jumpToAnchor("#weatherTop");
}

function windDirection(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function rainRisk(prob) {
  if (prob >= 60) return { text: "HIGH", cls: "risk-high" };
  if (prob >= 30) return { text: "MOD", cls: "risk-mod" };
  return { text: "LOW", cls: "risk-low" };
}

function formatTime(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `Updated at ${h}:${m < 10 ? "0" + m : m} ${ampm}`;
}

function formatTimelineTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Live";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m < 10 ? "0" + m : m} ${ampm}`;
}

function formatStatusUpdated(value) {
  if (!value) return "Live source";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const month = parsed.toLocaleString("en-US", { month: "short" });
  const day = parsed.getDate();
  let h = parsed.getHours();
  const m = parsed.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${month} ${day} · ${h}:${m < 10 ? "0" + m : m} ${ampm}`;
}

function feedEndpoint() {
  const url = new URL(window.location.href);
  url.searchParams.set("ajax", "live_dashboard_feed");
  return url.toString();
}

function cacheFeed(data) {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Could not cache feed:", error);
  }
}

function readCachedFeed() {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not read cached feed:", error);
    return null;
  }
}

function createTagButton(label, actionName, url) {
  if (actionName === "openLink" && url) {
    return `<a class="tag" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }
  if (actionName === "goToUserAlerts") {
    return `<button class="tag" onclick="goToUserAlerts()">${escapeHtml(label)}</button>`;
  }
  return `<button class="tag" onclick="${escapeHtml(actionName || "jumpToAlerts")}()">${escapeHtml(label)}</button>`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function summarizeText(text, maxLength = 150) {
  const clean = String(text ?? "").trim();
  if (clean.length <= maxLength) {
    return { short: clean, rest: "" };
  }
  const cut = clean.slice(0, maxLength);
  const safeCut = cut.slice(0, Math.max(cut.lastIndexOf(" "), maxLength - 18));
  return {
    short: `${safeCut.trim()}…`,
    rest: clean.slice(safeCut.length).trim(),
  };
}

function getSourceIcon(label = "") {
  const key = String(label).toLowerCase();
  if (key.includes("phivolcs")) {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 18c.4-3 1.7-4.8 3.6-7.2 1.3 1 2.2 2.2 2.7 3.8.8-1 1.7-1.8 3-2.8.8 1.9 1.3 3.4 1.7 6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }
  if (key.includes("advisory") || key.includes("pagasa")) {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 1 1 0 6H7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 15.5l3-3 3 2 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="8" r="1.4" fill="currentColor"/></svg>`;
}

function getStatusTone(status = "") {
  const key = String(status).toLowerCase();
  if (key.includes("warning")) return { cls: "is-warning", icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 21 19H3L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.5" r=".9" fill="currentColor"/></svg>` };
  if (key.includes("watch") || key.includes("advisory")) return { cls: "is-watch", icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8"/></svg>` };
  if (key.includes("clear") || key.includes("quiet")) return { cls: "is-clear", icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` };
  return { cls: "is-live", icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M5 12a7 7 0 0 1 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 12a7 7 0 0 0-7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 12a7 7 0 0 0 7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 12a7 7 0 0 1-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` };
}

function getContactIcon(iconName) {
  const icons = {
    shield: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    fire: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12.5 2.5c.8 2.4-.4 4.1-1.7 5.4-1.6 1.7-3.3 3.2-3.3 6.1a4.5 4.5 0 0 0 9 0c0-1.8-.8-3.1-2-4.6-.9-1.1-1.8-2.2-2-3.9z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12.5c.6 1 .4 1.9-.2 2.5-.6.7-1.3 1.2-1.3 2.3a1.8 1.8 0 0 0 3.6 0c0-.8-.4-1.4-.9-2-.4-.5-.9-1-.9-1.8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.4-9-8.6C1.6 8.3 3.2 5 6.7 5c2 0 3.2 1 4.3 2.5C12.1 6 13.3 5 15.3 5 18.8 5 20.4 8.3 21 11.4 19 15.6 12 20 12 20z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.2 19.2 0 0 1-5.9-5.9A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.8 2.6a2 2 0 0 1-.5 2.2L8 10a16 16 0 0 0 6 6l1.5-1.3a2 2 0 0 1 2.2-.5c.8.4 1.7.7 2.6.8A2 2 0 0 1 22 16.9z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  return icons[iconName] || icons.phone;
}

function toggleNewsCard(button) {
  const card = button.closest(".news-card");
  if (!card) return;
  const isExpanded = card.classList.toggle("expanded");
  button.textContent = isExpanded ? "See less" : "See more";
}
window.toggleNewsCard = toggleNewsCard;
window.toggleNewsList = toggleNewsList;

function renderAlertList(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = `
      <div class="list-item">
        <strong>${escapeHtml(emptyMessage.title)}</strong>
        <span>${escapeHtml(emptyMessage.summary)}</span>
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const buttonLabel =
        item.action === "openLink" ? "Open source" :
        item.action === "jumpToMap" ? "View map" :
        item.action === "jumpToSafety" ? "Safety guide" :
        item.action === "goToUserAlerts" ? "Open alerts page" :
        "View details";

      return `
        <div class="list-item live-alert-item">
          <div class="live-alert-row">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="live-alert-pill ${escapeHtml(item.badgeClass || "pill-blue")}">${escapeHtml(item.badge || "LIVE")}</span>
          </div>
          <span>${escapeHtml(item.summary)}</span>
          <div class="link-row">
            <span class="source-chip">${escapeHtml(item.source || "Live source")}</span>
            ${createTagButton(buttonLabel, item.action, item.url)}
          </div>
        </div>
      `;
    })
    .join("");
}

function toggleNewsList(button) {
  const container = document.getElementById("regionalNewsList");
  if (!container || !button) return;

  const expanded = container.classList.toggle("news-list-collapsed") === false;
  button.textContent = expanded ? "Show fewer headlines" : "Show more headlines";
}

function renderNewsList(items) {
  const container = document.getElementById("regionalNewsList");
  if (!container) return;

  if (!Array.isArray(items) || !items.length) {
    container.classList.remove("news-list-collapsed");
    container.innerHTML = `
      <div class="list-item">
        <strong>No disaster or weather news synced</strong>
        <span>Try refreshing the page or check your server if external requests are blocked.</span>
      </div>
    `;
    return;
  }

  const cards = items
    .map((item) => {
      const summary = summarizeText(item.summary || "Summarized update", 150);
      const hasMore = Boolean(summary.rest);

      return `
        <div class="list-item news-card">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="news-summary-short">${escapeHtml(summary.short)}</span>
          ${hasMore ? `<span class="news-summary-full">${escapeHtml(item.summary || "Summarized update")}</span>` : ``}
          <div class="link-row">
            <span class="source-chip">${escapeHtml(item.source || "Regional source")}</span>
            <span class="muted-inline">${escapeHtml(formatTimelineTime(item.timestamp || new Date().toISOString()))}</span>
          </div>
          ${hasMore ? `<button type="button" class="tag news-toggle" onclick="toggleNewsCard(this)">See more</button>` : ``}
        </div>
      `;
    })
    .join("");

  container.classList.toggle("news-list-collapsed", items.length > 3);
  container.innerHTML = cards + (items.length > 3
    ? `<div class="news-more-row"><button type="button" class="btn secondary" onclick="toggleNewsList(this)">Show more headlines</button></div>`
    : ``);
}

function renderSourceStatuses(sources) {
  const grid = document.getElementById("sourceStatusGrid");
  if (!grid) return;

  const items = Array.isArray(sources) ? sources.slice(0, 4) : [];
  grid.innerHTML = items
    .map((source) => {
      const tone = getStatusTone(source.status || "LIVE");
      return `
        <article class="status-card ${tone.cls}">
          <div class="status-top">
            <div class="status-source">
              <span class="status-source-icon">${getSourceIcon(source.label || "Source")}</span>
              <div class="status-source-copy">
                <div class="status-label">${escapeHtml(source.label || "Source")}</div>
                <div class="status-updated">${escapeHtml(formatStatusUpdated(source.updated || "Live source"))}</div>
              </div>
            </div>
            <span class="status-badge">
              <span class="status-badge-icon">${tone.icon}</span>
              ${escapeHtml(source.status || "LIVE")}
            </span>
          </div>
          <div class="status-summary">${escapeHtml(source.summary || "Summary unavailable.")}</div>
        </article>
      `;
    })
    .join("");
}

function renderContacts(contacts) {
  const list = document.getElementById("contactList");
  if (!list || !Array.isArray(contacts)) return;

  list.innerHTML = contacts
    .map((item) => `
      <div class="contact-card ${escapeHtml((item.accent || "cyan") + "-accent")}">
        <div class="contact-icon">${getContactIcon(item.icon || "phone")}</div>
        <div class="contact-copy">
          <strong>${escapeHtml(item.label || "Emergency Contact")}</strong>
          <span>${escapeHtml(item.value || "--")}</span>
          <small>${escapeHtml(item.description || "Add a verified local description.")}</small>
        </div>
      </div>
    `)
    .join("");
}

function renderTimeline(items) {
  const container = document.getElementById("userTimeline");
  if (!container) return;

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = `
      <div class="timeline-item">
        <div class="timeline-time">--</div>
        <div>
          <strong>No live timeline yet</strong>
          <span>Refresh the page after your server connects to the live sources.</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item) => `
      <div class="timeline-item">
        <div class="timeline-time">${escapeHtml(formatTimelineTime(item.timestamp || new Date().toISOString()))}</div>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.summary)}</span>
        </div>
      </div>
    `)
    .join("");
}

function renderHero(hero) {
  if (!hero) return;

  setText("heroAlertTitle", hero.title || "No active official advisory");
  setText("heroAlertMeta", `${hero.source || "Live source"} · ${hero.timeLabel || "Live"}`);
  setText("dashboardAlertHeadline", hero.title || "No active official advisory");
  setText("dashboardAlertSummary", hero.summary || "Continue monitoring official Western Visayas sources.");
  const heroContext = hero.context || {};
  setText("heroAffectedAreas", heroContext.affected || "Western Visayas");
  setText("heroActionNow", heroContext.action || "Monitor official alerts and follow local instructions.");
  setText("heroSourceCheck", heroContext.sourceCheck || `${hero.source || "Official sources"} • ${hero.timeLabel || "Live"}`);
  const pill = document.getElementById("heroAlertPill");
  if (pill) {
    pill.textContent = hero.badge || "LIVE";
    pill.className = `alert-pill ${hero.badgeClass || ""}`.trim();
  }
}

function renderMetrics(data) {
  const dbCount = window.hvRegionalAlertCount ?? 0;
  setText("userAlertCount", String(dbCount));

  const weather = data?.weather || {};
  setText("metricWeatherValue", weather.temperature != null ? `${weather.temperature}°C` : "--°C");
  setText(
    "metricWeatherText",
    weather.ok
      ? `${weather.condition || "Weather"} now`
      : "View forecast"
  );

  setText(
    "metricAlertText",
    (window.hvRegionalAlertCount ?? 0) > 0
      ? "Tap to open alerts."
      : "No active alert"
  );
}

function renderSnapshot(snapshot) {
  if (!snapshot) return;
  setText("snapshotRegion", snapshot.region || "Western Visayas only");
  setText("snapshotStatus", snapshot.status || "Waiting for live status.");
  setText("snapshotGuidance", snapshot.guidance || "Open the map and follow official updates.");
  setText("snapshotCenterTitle", "Verified evacuation center");
  setText("snapshotCenterText", snapshot.center || "Connect your verified center dataset.");
  renderContacts(snapshot.contacts || []);
}

function renderPagasaAlerts(officialAlerts) {
  renderAlertList("pagasaAlertsList", officialAlerts?.slice(0, 3) || [], {
    title: "No official alerts available",
    summary: "Check back after the live feed refreshes."
  });
}

function renderRegionalWeather(weather) {
  if (!weather) return;

  setText("pagasaTemp", weather.temperature != null ? `${weather.temperature}°C` : "--°C");
  setText("pagasaCondition", weather.condition || "Loading");
  setText("pagasaFeels", weather.feels_like != null ? `${weather.feels_like}°C` : "--°C");
  setText("pagasaWind", weather.wind_speed != null ? `${weather.wind_speed} km/h ${weather.wind_direction || ""}`.trim() : "--");
  setText("pagasaHumidity", weather.humidity != null ? `${weather.humidity}%` : "--%");
  setText("pagasaLastUpdated", formatTime(new Date(weather.last_updated || new Date())));

  const iconWrapper = document.getElementById("pagasaWeatherIcon");
  if (iconWrapper && WEATHER_ICONS[weather.icon]) {
    iconWrapper.outerHTML = WEATHER_ICONS[weather.icon];
  }

  const forecast = Array.isArray(weather.forecast) ? weather.forecast : [];
  forecast.slice(0, 3).forEach((day, idx) => {
    const dayNum = idx + 1;
    setText(`pagasaDay${dayNum}Label`, day.label || (dayNum === 1 ? "Tomorrow" : "--"));
    setText(`pagasaDay${dayNum}Temp`, day.temp_max != null ? `${day.temp_max}°C` : "--°C");
    setText(`pagasaDay${dayNum}Risk`, day?.risk?.text || "LOW");

    const riskEl = document.getElementById(`pagasaDay${dayNum}Risk`);
    if (riskEl) {
      riskEl.className = `pagasa-rain-risk ${(day?.risk?.class) || "risk-low"}`;
    }
  });
}

function renderLiveFeed(data) {
  renderHero({ ...(data.hero || {}), context: data.hero_context || {} });
  renderMetrics(data);
  renderSourceStatuses(data.sources || []);
  renderSnapshot(data.snapshot);
  renderPagasaAlerts((data.official_alerts || []).slice(0, 3));
  renderRegionalWeather(data.weather || {});
  setText("sourceStatusNote", `Last sync: ${formatTime(new Date(data.generated_at || new Date()))}`);
}

async function loadLiveDashboardFeed() {
  const cached = readCachedFeed();

  try {
    const response = await fetch(feedEndpoint(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.ok) {
      throw new Error("Live feed payload was not valid.");
    }

    cacheFeed(data);
    renderLiveFeed(data);
  } catch (error) {
    console.warn("HANDAVis: live feed failed —", error);
    if (cached) {
      renderLiveFeed(cached);
      showToast("Showing last saved live feed.");
    } else {
      showToast("Could not load live feeds.");
    }
  }
}

function enableKeyboardForClickablePanels() {
  document.querySelectorAll(".clickable-panel").forEach((panel) => {
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        panel.click();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  enableKeyboardForClickablePanels();
  loadLiveDashboardFeed();
});

setInterval(() => {
  loadLiveDashboardFeed();
}, 10 * 60 * 1000);

window.showToast = showToast;
window.toggleTheme = toggleTheme;
window.goToUserAlerts = goToUserAlerts;
window.jumpToAlerts = jumpToAlerts;
window.jumpToMap = jumpToMap;
window.jumpToSafety = jumpToSafety;
window.jumpToNews = jumpToNews;
window.jumpToWeatherSection = jumpToWeatherSection;
window.setActivePageSafe = setActivePageSafe;
