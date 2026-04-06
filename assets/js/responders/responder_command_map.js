(function initTheme() {
  const saved = localStorage.getItem("theme-preference");
  if (saved === "light") {
    document.body.classList.add("light-mode");
  }
  document.documentElement.classList.add("ready");
})();

const statusFlow = [
  { key: "assigned", label: "Assigned", note: "Barangay has assigned this incident to you." },
  { key: "on_the_way", label: "On the Way", note: "You are heading to the incident location." },
  { key: "arrived", label: "Arrived", note: "You have reached the incident area." },
  { key: "responding", label: "Responding", note: "You are actively handling the incident." },
  { key: "resolved", label: "Resolved", note: "Incident has been handled and closed." }
];

const statusIndexByCode = {
  assigned: 0,
  responders_assigned: 0,
  on_the_way: 1,
  arrived: 2,
  responding: 3,
  resolved: 4
};

const etaText = {
  assigned: { val: "6 min", sub: "Route ready" },
  on_the_way: { val: "4 min", sub: "Navigating to incident" },
  arrived: { val: "0 min", sub: "You have arrived - Update to Responding" },
  responding: { val: "On scene", sub: "Active response ongoing" },
  resolved: { val: "Done", sub: "Incident resolved" }
};

const mapStatusText = {
  assigned: "Status: Assigned - Update to On the Way to begin response",
  on_the_way: "Status: On the Way - Following route",
  arrived: "Status: Arrived - You are at incident location",
  responding: "Status: Responding - Active response on scene",
  resolved: "Status: Resolved - Waiting for barangay final confirmation"
};

const chipColors = {
  assigned: { bg: "rgba(73, 209, 125, 0.12)", color: "#49d17d", border: "rgba(73, 209, 125, 0.35)" },
  on_the_way: { bg: "rgba(79, 216, 255, 0.12)", color: "#4fd8ff", border: "rgba(79, 216, 255, 0.35)" },
  arrived: { bg: "rgba(255, 216, 77, 0.14)", color: "#ffd84d", border: "rgba(255, 216, 77, 0.35)" },
  responding: { bg: "rgba(255, 154, 61, 0.14)", color: "#ff9a3d", border: "rgba(255, 154, 61, 0.35)" },
  resolved: { bg: "rgba(73, 209, 125, 0.12)", color: "#49d17d", border: "rgba(73, 209, 125, 0.35)" }
};

let currentStepIdx = 0;
let pendingStepIdx = 0;
let routeLine = null;
let activeAssignment = null;
let mapInstance = null;
let responderMarker = null;
let incidentMarker = null;
let geoWatchId = null;
let assignmentPollId = null;
let routeRefreshId = null;
let etaTickId = null;
let lastLocationPushAt = 0;
let lastPushedLocation = null;

const LOCATION_PUSH_INTERVAL_MS = 15000;
const LOCATION_MIN_MOVE_METERS = 15;
const ROUTE_REFRESH_MIN_INTERVAL_MS = 10000;
const ROUTE_REFRESH_MIN_MOVE_METERS = 25;
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";

let responderLocation = [10.6765, 122.9543];
let incidentLocation = [10.6801, 122.9579];
let routeDistanceMeters = null;
let routeDurationSeconds = null;
let routeEtaCapturedAtMs = 0;
let lastRouteRequestedAt = 0;
let lastRouteOrigin = null;
let routeRequestToken = 0;
let messageModalEl = null;
let messageModalCardEl = null;
let messageModalBodyEl = null;
let messageModalOkBtnEl = null;
let messageModalIconEl = null;
let messageModalTitleEl = null;
let messageModalSubtitleEl = null;

function toRad(v) {
  return (v * Math.PI) / 180;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceLabel(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return "- km";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDurationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "- min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function buildRoutePoints(from, to) {
  const latMid1 = from[0] + (to[0] - from[0]) * 0.33;
  const lngMid1 = from[1] + (to[1] - from[1]) * 0.33;
  const latMid2 = from[0] + (to[0] - from[0]) * 0.66;
  const lngMid2 = from[1] + (to[1] - from[1]) * 0.66;
  return [
    [from[0], from[1]],
    [latMid1, lngMid1],
    [latMid2, lngMid2],
    [to[0], to[1]]
  ];
}

function normalizeHazardType(value) {
  const hazard = String(value || "").trim().toLowerCase();
  if (hazard === "roadblock") return "Road Block";
  if (hazard === "storm surge" || hazard === "typhoon") return "Storm";
  if (hazard === "medical emergency") return "Medical";
  if (!hazard) return "Hazard";
  return String(value || "").trim();
}

function markerClassFromHazard(hazard) {
  const type = normalizeHazardType(hazard);
  if (type === "Flood") return "flood";
  if (type === "Fire") return "fire";
  if (type === "Storm") return "storm";
  if (type === "Road Block") return "roadblock";
  if (type === "Earthquake") return "earthquake";
  if (type === "Medical") return "medical";
  return "other";
}

function hazardIconSvg(hazard) {
  const type = normalizeHazardType(hazard);
  if (type === "Flood") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 10.5 12 5l7.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 9.8V15h10V9.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 15v-2.5h5V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 18c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 21c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === "Fire") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2.5c1.7 2.05 2.28 4 .94 5.93-.54.78-1.39 1.47-2.08 2.21C10.08 11.72 9 13.23 9 15a3 3 0 0 0 6 0c0-1.52-.74-2.62-1.77-3.84-.56-.67-.86-1.42-.74-2.36.08-.62.27-1.11.71-1.92Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.05 11.2c-1.46 1.07-2.05 2.05-2.05 3.15a2 2 0 0 0 4 0c0-.82-.33-1.45-1.05-2.25-.41-.46-.62-.98-.56-1.73-.13.15-.22.28-.34.41Z" fill="currentColor" opacity=".28"/><path d="M12 10.9c-1.25.98-1.8 1.86-1.8 2.88a1.8 1.8 0 0 0 3.6 0c0-.74-.31-1.31-.96-2.03-.36-.4-.56-.86-.52-1.5-.09.1-.18.2-.32.34Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (type === "Storm") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 16a4 4 0 1 1 .7-7.94A5 5 0 0 1 17 10a3.5 3.5 0 0 1-.5 6.97H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 12.5 10 17h2.2l-.7 3.5L15 15.5h-2.2l.7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  if (type === "Road Block") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.5 6h-11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 14v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 14v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 8 10 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 8l2.5 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 8 19 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === "Earthquake") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v14H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 9.5 12 12l-2 2.5L12 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 9h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 15h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === "Medical") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 12h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8.2v5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.2" fill="currentColor"/></svg>';
}

function incidentMarkerIconByHazard(hazardType) {
  const hazardClass = markerClassFromHazard(hazardType);
  const iconSvg = hazardIconSvg(hazardType);
  return L.divIcon({
    className: "incident-map-pin-wrap",
    html:
      `<div class="incident-map-pin incident-map-pin--${hazardClass}">` +
        `<div class="incident-map-pin-badge">${iconSvg}</div>` +
        '<div class="incident-map-pin-tip"></div>' +
      "</div>",
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -34]
  });
}

function updateIncidentMarkerIcon(hazardType) {
  if (!incidentMarker || typeof L === "undefined") return;
  incidentMarker.setIcon(incidentMarkerIconByHazard(hazardType));
}

function showToast(message) {
  if (!message) return;
  if (!messageModalEl || !messageModalBodyEl || !messageModalCardEl) return;
  const msg = String(message);
  const lower = msg.toLowerCase();
  const isError = lower.includes("failed") || lower.includes("error") || lower.includes("invalid") || lower.includes("not found");
  const isSuccess = !isError;

  messageModalCardEl.classList.remove("responder-msg-modal-card--info", "responder-msg-modal-card--success", "responder-msg-modal-card--error");
  messageModalCardEl.classList.add(isError ? "responder-msg-modal-card--error" : "responder-msg-modal-card--success");

  if (messageModalIconEl) messageModalIconEl.textContent = isError ? "!" : "✓";
  if (messageModalTitleEl) messageModalTitleEl.textContent = isError ? "Status Update Failed" : "Status Updated";
  if (messageModalSubtitleEl) messageModalSubtitleEl.textContent = isError ? "Please review and try again." : "Responder Command Map";

  messageModalBodyEl.textContent = String(message);
  messageModalEl.hidden = false;
  if (messageModalOkBtnEl) messageModalOkBtnEl.focus();
}

function closeMessageModal() {
  if (!messageModalEl) return;
  messageModalEl.hidden = true;
}

function initMessageModal() {
  messageModalEl = document.getElementById("responderMsgModal");
  messageModalCardEl = document.getElementById("responderMsgCard");
  messageModalBodyEl = document.getElementById("responderMsgBody");
  messageModalOkBtnEl = document.getElementById("responderMsgOkBtn");
  messageModalIconEl = document.getElementById("responderMsgIcon");
  messageModalTitleEl = document.getElementById("responderMsgTitle");
  messageModalSubtitleEl = document.getElementById("responderMsgSubtitle");

  if (!messageModalEl) return;

  if (messageModalOkBtnEl) {
    messageModalOkBtnEl.addEventListener("click", closeMessageModal);
  }

  messageModalEl.addEventListener("click", (event) => {
    if (event.target === messageModalEl) closeMessageModal();
  });
}

function formatDateTime(raw) {
  if (!raw) return "-";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "-";
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} - ${d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`;
}

function setAssignmentDetails(assignment) {
  const title = document.getElementById("mapIncidentTitle");
  const type = document.getElementById("mapDetailType");
  const location = document.getElementById("mapDetailLocation");
  const desc = document.getElementById("mapDetailDescription");
  const assignedBy = document.getElementById("mapDetailAssignedBy");
  const assignedAt = document.getElementById("mapDateTime");
  const assignmentId = document.getElementById("mapAssignmentId");

  if (!assignment) {
    if (title) title.textContent = "No active assignment";
    if (type) type.textContent = "-";
    if (location) location.textContent = "-";
    if (desc) desc.textContent = "No assignment is currently linked to your account.";
    if (assignedBy) assignedBy.textContent = "-";
    if (assignedAt) assignedAt.textContent = "-";
    if (assignmentId) assignmentId.textContent = "-";
    return;
  }

  if (title) title.textContent = `${assignment.hazardType || "Incident"} - ${assignment.location || "Location"}`;
  if (type) type.textContent = assignment.hazardType || "-";
  if (location) location.textContent = assignment.location || "-";
  if (desc) desc.textContent = assignment.description || "No additional description provided.";
  if (assignedBy) assignedBy.textContent = assignment.assignedBy || "Barangay";
  if (assignedAt) assignedAt.textContent = formatDateTime(assignment.assignedAt);
  if (assignmentId) assignmentId.textContent = String(assignment.assignmentId || "-");
}

function renderStatusSteps() {
  const container = document.getElementById("statusSteps");
  if (!container) return;
  container.innerHTML = "";

  statusFlow.forEach((step, i) => {
    const done = i < currentStepIdx;
    const active = i === currentStepIdx;
    const isPending = i === pendingStepIdx && i !== currentStepIdx;
    const isNext = i === currentStepIdx + 1;

    const item = document.createElement("div");
    item.className = `status-step${done ? " done" : ""}${active ? " active-step" : ""}${isPending ? " current-sel" : ""}`;
    if (isNext) {
      item.onclick = () => selectStep(i);
      item.style.cursor = "pointer";
    } else {
      item.style.cursor = "default";
    }

    item.innerHTML = `
      <div class="ss-circle">${done ? "\u2713" : i + 1}</div>
      <div class="ss-label">${step.label}</div>
      ${done ? '<div class="ss-time">Done</div>' : active ? '<div class="ss-time">Current</div>' : ""}
    `;

    container.appendChild(item);
  });

  const btn = document.getElementById("updateBtn");
  if (!btn) return;

  if (!activeAssignment) {
    btn.disabled = true;
    btn.textContent = "No active assignment";
    return;
  }

  if (currentStepIdx >= statusFlow.length - 1) {
    btn.disabled = true;
    btn.textContent = "Incident Resolved";
    return;
  }

  btn.disabled = pendingStepIdx === currentStepIdx;
  btn.textContent = pendingStepIdx > currentStepIdx
    ? `Mark as "${statusFlow[pendingStepIdx].label}"`
    : "Select next status above";
}

function selectStep(i) {
  if (!activeAssignment) return;
  if (i !== currentStepIdx + 1) return;
  pendingStepIdx = i;
  renderStatusSteps();
}

function applyStatusUI() {
  const current = statusFlow[currentStepIdx] || statusFlow[0];
  const key = current.key;
  const color = chipColors[key] || chipColors.assigned;
  const chip = document.getElementById("mapChip");
  const chipText = document.getElementById("mapChipText");
  const statusLine = document.getElementById("mapStatusLine");
  const etaVal = document.getElementById("etaVal");
  const etaSub = document.getElementById("etaSub");

  if (chip) {
    chip.style.background = color.bg;
    chip.style.color = color.color;
    chip.style.borderColor = color.border;
  }
  if (chipText) chipText.textContent = current.label;
  if (statusLine) statusLine.textContent = mapStatusText[key] || mapStatusText.assigned;
  if (etaVal && etaSub) {
    const fallback = etaText[key] || etaText.assigned;
    const liveEtaSeconds = getLiveEtaSeconds();
    if (key === "on_the_way" && Number.isFinite(liveEtaSeconds) && liveEtaSeconds > 0) {
      etaVal.textContent = formatDurationLabel(liveEtaSeconds);
      etaSub.textContent = `${formatDistanceLabel(routeDistanceMeters)} - Fastest route`;
    } else if (key === "assigned" && Number.isFinite(liveEtaSeconds) && liveEtaSeconds > 0) {
      etaVal.textContent = formatDurationLabel(liveEtaSeconds);
      etaSub.textContent = `${formatDistanceLabel(routeDistanceMeters)} - Route ready`;
    } else {
      etaVal.textContent = fallback.val;
      etaSub.textContent = fallback.sub;
    }
  }

  if (routeLine) {
    routeLine.setStyle({ opacity: key === "resolved" ? 0.25 : 0.9 });
  }
}

function getLiveEtaSeconds() {
  if (!Number.isFinite(routeDurationSeconds) || routeDurationSeconds <= 0) return null;
  if (!Number.isFinite(routeEtaCapturedAtMs) || routeEtaCapturedAtMs <= 0) return routeDurationSeconds;
  const elapsed = Math.max(0, Math.round((Date.now() - routeEtaCapturedAtMs) / 1000));
  return Math.max(0, routeDurationSeconds - elapsed);
}

function refreshRouteLine() {
  if (!mapInstance || typeof L === "undefined") return;
  const points = buildRoutePoints(responderLocation, incidentLocation);
  if (routeLine) {
    routeLine.setLatLngs(points);
  } else {
    routeLine = L.polyline(points, {
      color: "#63a6ff",
      weight: 4,
      opacity: 0.9,
      dashArray: "8, 8"
    }).addTo(mapInstance);
  }
  if (responderMarker) responderMarker.setLatLng(responderLocation);
  if (incidentMarker) incidentMarker.setLatLng(incidentLocation);
}

function applyRouteGeometry(points) {
  if (!mapInstance || typeof L === "undefined" || !Array.isArray(points) || points.length < 2) return;
  const isFirstRender = !routeLine;
  if (routeLine) {
    routeLine.setLatLngs(points);
  } else {
    routeLine = L.polyline(points, {
      color: "#63a6ff",
      weight: 4,
      opacity: 0.9,
      dashArray: "8, 8"
    }).addTo(mapInstance);
  }
  if (routeLine && isFirstRender) {
    mapInstance.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  }
}

function shouldRefreshRoute(lat, lng) {
  const now = Date.now();
  if (!lastRouteOrigin) return true;
  if (now - lastRouteRequestedAt >= ROUTE_REFRESH_MIN_INTERVAL_MS) return true;
  const moved = distanceMeters(lastRouteOrigin[0], lastRouteOrigin[1], lat, lng);
  return moved >= ROUTE_REFRESH_MIN_MOVE_METERS;
}

function refreshRoadRoute(force = false) {
  if (!Number.isFinite(responderLocation[0]) || !Number.isFinite(responderLocation[1])) return;
  if (!Number.isFinite(incidentLocation[0]) || !Number.isFinite(incidentLocation[1])) return;
  if (!force && !shouldRefreshRoute(responderLocation[0], responderLocation[1])) return;

  const token = ++routeRequestToken;
  lastRouteRequestedAt = Date.now();
  lastRouteOrigin = [responderLocation[0], responderLocation[1]];

  const from = `${responderLocation[1]},${responderLocation[0]}`;
  const to = `${incidentLocation[1]},${incidentLocation[0]}`;
  const url = `${OSRM_ROUTE_URL}/${from};${to}?overview=full&geometries=geojson&steps=false&alternatives=false`;

  fetch(url)
    .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (token !== routeRequestToken) return;
      if (!ok || data?.code !== "Ok" || !Array.isArray(data?.routes) || data.routes.length === 0) {
        return;
      }

      const best = data.routes[0];
      const coords = Array.isArray(best?.geometry?.coordinates) ? best.geometry.coordinates : [];
      const latLngs = coords
        .map((pair) => [Number(pair?.[1]), Number(pair?.[0])])
        .filter((pair) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
      if (latLngs.length >= 2) {
        applyRouteGeometry(latLngs);
      }

      routeDistanceMeters = Number(best?.distance);
      routeDurationSeconds = Number(best?.duration);
      routeEtaCapturedAtMs = Date.now();
      applyStatusUI();
    })
    .catch(() => {});
}

function startRealtimeRouteUpdates() {
  if (routeRefreshId !== null) window.clearInterval(routeRefreshId);
  if (etaTickId !== null) window.clearInterval(etaTickId);

  routeRefreshId = window.setInterval(() => {
    if (!activeAssignment) return;
    refreshRoadRoute(true);
  }, 10000);

  etaTickId = window.setInterval(() => {
    if (!activeAssignment) return;
    applyStatusUI();
  }, 1000);
}

function initMap() {
  const mapEl = document.getElementById("responderMap");
  if (!mapEl || typeof L === "undefined") return;

  mapInstance = L.map("responderMap", {
    zoomControl: true,
    attributionControl: true
  }).setView([10.6786, 122.9561], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(mapInstance);

  const responderIcon = L.divIcon({
    className: "responder-pin",
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#63a6ff;border:2px solid #fff;box-shadow:0 0 0 4px rgba(99,166,255,.25);"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  const incidentIcon = incidentMarkerIconByHazard(null);

  responderMarker = L.marker(responderLocation, { icon: responderIcon })
    .addTo(mapInstance)
    .bindPopup("<strong>Your Team</strong><br>Current responder position");

  incidentMarker = L.marker(incidentLocation, { icon: incidentIcon })
    .addTo(mapInstance)
    .bindPopup("<strong>Incident Location</strong>");

  refreshRouteLine();
  refreshRoadRoute(true);
}

function setIncidentLocationFromAssignment(assignment) {
  if (!assignment) return;
  const lat = Number(assignment.latitude);
  const lng = Number(assignment.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  updateIncidentMarkerIcon(assignment.hazardType || "");
  incidentLocation = [lat, lng];
  routeDistanceMeters = null;
  routeDurationSeconds = null;
  refreshRouteLine();
  refreshRoadRoute(true);
}

function pushResponderLocation(lat, lng, accuracy) {
  return fetch("../../database/responder/responder_incident_reports.php?action=responder_update_location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: Number(lat),
      longitude: Number(lng),
      accuracy: Number.isFinite(accuracy) ? Number(accuracy) : null
    })
  }).catch(() => {});
}

function shouldPushLocation(lat, lng) {
  const now = Date.now();
  if (!lastPushedLocation) return true;
  if (now - lastLocationPushAt >= LOCATION_PUSH_INTERVAL_MS) return true;
  const moved = distanceMeters(lastPushedLocation[0], lastPushedLocation[1], lat, lng);
  return moved >= LOCATION_MIN_MOVE_METERS;
}

function handlePositionUpdate(position) {
  const lat = Number(position?.coords?.latitude);
  const lng = Number(position?.coords?.longitude);
  const accuracy = Number(position?.coords?.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  responderLocation = [lat, lng];
  refreshRouteLine();
  refreshRoadRoute();

  if (shouldPushLocation(lat, lng)) {
    lastPushedLocation = [lat, lng];
    lastLocationPushAt = Date.now();
    pushResponderLocation(lat, lng, accuracy);
  }
}

function startLiveLocationTracking() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    handlePositionUpdate,
    () => {},
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
  );

  geoWatchId = navigator.geolocation.watchPosition(
    handlePositionUpdate,
    () => {},
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

function fetchActiveAssignment(silent = false) {
  const params = new URLSearchParams(window.location.search);
  const requestedAssignmentId = Number(params.get("assignment_id") || 0);
  const query = requestedAssignmentId > 0 ? `&assignment_id=${encodeURIComponent(String(requestedAssignmentId))}` : "";
  return fetch(`../../database/responder/responder_incident_reports.php?action=responder_active_assignment${query}`)
    .then((r) => r.json())
    .then((result) => {
      if (!result?.ok) {
        throw new Error(result?.error || "Failed to load assignment.");
      }
      activeAssignment = result.assignment || null;
      if (!activeAssignment) {
        currentStepIdx = 0;
        pendingStepIdx = 0;
        setAssignmentDetails(null);
        applyStatusUI();
        renderStatusSteps();
        return;
      }

      setAssignmentDetails(activeAssignment);
      setIncidentLocationFromAssignment(activeAssignment);
      currentStepIdx = statusIndexByCode[String(activeAssignment.statusCode || "").toLowerCase()] ?? 0;
      pendingStepIdx = currentStepIdx;
      applyStatusUI();
      renderStatusSteps();
    })
    .catch((err) => {
      activeAssignment = null;
      setAssignmentDetails(null);
      applyStatusUI();
      renderStatusSteps();
      if (!silent) {
        showToast(err?.message || "Failed to load assignment.");
      }
    });
}

function confirmStatusUpdate() {
  if (!activeAssignment) return;
  if (pendingStepIdx <= currentStepIdx) return;

  const next = statusFlow[pendingStepIdx];
  fetch("../../database/responder/responder_incident_reports.php?action=responder_update_status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignmentId: Number(activeAssignment.assignmentId),
      statusCode: String(next.key)
    })
  })
    .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update responder status.");
      }
      currentStepIdx = statusIndexByCode[String(data.statusCode || next.key).toLowerCase()] ?? pendingStepIdx;
      pendingStepIdx = currentStepIdx;
      if (activeAssignment) {
        activeAssignment.statusCode = String(data.statusCode || next.key);
        activeAssignment.statusLabel = String(data.statusLabel || next.label);
      }
      applyStatusUI();
      renderStatusSteps();
      showToast(`Status updated to ${next.label}.`);
    })
    .catch((err) => {
      showToast(err?.message || "Failed to update responder status.");
    });
}

document.addEventListener("DOMContentLoaded", () => {
  initMessageModal();
  initMap();
  applyStatusUI();
  renderStatusSteps();
  fetchActiveAssignment();
  assignmentPollId = window.setInterval(() => {
    fetchActiveAssignment(true);
  }, 20000);
  startRealtimeRouteUpdates();
  startLiveLocationTracking();

  const btn = document.getElementById("updateBtn");
  if (btn) btn.addEventListener("click", confirmStatusUpdate);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && messageModalEl && !messageModalEl.hidden) {
    closeMessageModal();
  }
});

window.addEventListener("beforeunload", () => {
  if (geoWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatchId);
  }
  if (assignmentPollId !== null) {
    window.clearInterval(assignmentPollId);
  }
  if (routeRefreshId !== null) {
    window.clearInterval(routeRefreshId);
  }
  if (etaTickId !== null) {
    window.clearInterval(etaTickId);
  }
});
