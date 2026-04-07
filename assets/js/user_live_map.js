(function () {
  var map = null;
  var routeLine = null;
  var userMarker = null;
  var placeMarkers = [];
  var weatherPanelMode = "details";
  var weatherPanelMinimized = false;
  var rainRadarState = {
    tileLayer: null,
    demoWeatherIconsLayer: null,
    frameUrls: [],
    frameIndex: 0,
    animationTimer: null,
    refreshTimer: null,
    active: false,
    fallbackMode: false
  };
  var selectedPlaceWeatherMarker = null;
  var typhoonState = {
    layer: null,
    refreshTimer: null,
    active: false,
    hasAutoFit: false
  };
  var dayNightState = {
    overlayEl: null,
    terminatorLine: null,
    nightMask: null,
    refreshTimer: null,
    sampleCount: 180
  };

  var TYPHOON_FEED_URL = "process/typhoon_live_feed.php";

  var DEFAULT_USER_LOCATION = [10.6765, 122.9509];
  var EVACUATION_CENTERS = [];

  var HAZARD_REPORTS = [
    { id: "hz-flood-1", type: "flood", name: "Flood", area: "Barangay Tangub", coords: [10.7085, 122.9512] },
    { id: "hz-fire-1", type: "fire", name: "Fire", area: "Zone 2", coords: [10.6900, 122.9700] },
    { id: "hz-road-1", type: "road", name: "Road Block", area: "Main Road", coords: [10.6650, 122.9400] }
  ];

  var safetyCircleState = {
    panelOpen: false,
    layer: null,
    markersById: {},
    routeLine: null,
    userLocationMarker: null,
    userCoords: DEFAULT_USER_LOCATION.slice(),
    members: [],
    places: [],
    recentActivity: [],
    memberSearchResults: [],
    memberSearchBusy: false,
    memberSearchMessage: "Search by name or email to add people.",
    lastSyncLabel: "Just now"
  };

  var WESTERN_VISAYAS_PROVINCES = ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"];
  var PLACE_COORD_CACHE_KEY = "handavisWesternVisayasPlaceCoords";
  var COORD_RESOLVE_CONCURRENCY = 8;
  var WEATHER_PROXY_URL = "process/weather_proxy.php";
  var WEATHER_REALTIME_PROXY_URL = "process/weather_realtime.php";
  var PHIVOLCS_EARTHQUAKE_FEED_URL = "process/phivolcs_earthquake_feed.php";
  var WEATHER_CLIENT_CACHE_KEY = "handavisWeatherClientCacheV2";
  var WEATHER_CLICK_COOLDOWN_MS = 1800;
  var lastWeatherClickAtByPlace = {};
  var weatherCoverageState = {
    mappedCount: 0,
    lastSyncLabel: "--",
    modeLabel: "Realtime",
    commonType: "sun",
    weatherSamples: {}
  };
  var SAFETY_STATUS_STORAGE_KEY = "handavisSafetyCircleStatusV1";
  var userLocationAutoFocusState = {
    requested: false,
    completed: false
  };

  var FALLBACK_CITY_COORDS = {
    "Aklan|Kalibo": [11.7016, 122.3647],
    "Antique|Laua-an": [11.14149, 122.04319],
    "Antique|San Jose de Buenavista": [10.7450, 121.9410],
    "Capiz|Roxas City": [11.5853, 122.7511],
    "Iloilo|Iloilo City": [10.7202, 122.5621],
    "Iloilo|Passi": [11.1078, 122.6411],
    "Negros Occidental|Bacolod": [10.6765, 122.9509],
    "Negros Occidental|Bago": [10.5370, 122.8348],
    "Negros Occidental|Cadiz": [10.9465, 123.2880],
    "Negros Occidental|Escalante": [10.8405, 123.4998],
    "Negros Occidental|Himamaylan": [10.0985, 122.8709],
    "Negros Occidental|Kabankalan": [9.9903, 122.8144],
    "Negros Occidental|La Carlota": [10.4240, 122.9200],
    "Negros Occidental|Sagay": [10.8965, 123.4165],
    "Negros Occidental|San Carlos": [10.4956, 123.4208],
    "Negros Occidental|Silay": [10.8000, 122.9700],
    "Negros Occidental|Sipalay": [9.7514, 122.4690],
    "Negros Occidental|Talisay": [10.7378, 122.9672],
    "Negros Occidental|Victorias": [10.9000, 123.0700],
  };

  function setTextIfExists(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function getSavedRouteRecommendation() {
    try {
      return JSON.parse(localStorage.getItem("handavisRouteRecommendation") || "null");
    } catch (err) {
      return null;
    }
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () {
      toast.style.display = "none";
    }, 2400);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getInitials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join("") || "?";
  }

  function getSafetyCircleMemberById(memberId) {
    for (var i = 0; i < safetyCircleState.members.length; i += 1) {
      if (String(safetyCircleState.members[i].id) === String(memberId)) return safetyCircleState.members[i];
    }
    return null;
  }

  function getMemberStatusMeta(status) {
    if (status === "safe") return { label: "Safe", className: "safe" };
    if (status === "moving") return { label: "Moving", className: "moving" };
    if (status === "help") return { label: "Needs Help", className: "help" };
    if (status === "sos") return { label: "SOS", className: "help" };
    return { label: "Watch", className: "watch" };
  }

  function getHazardRiskMeta(coords) {
    var nearest = Infinity;
    var nearestHazard = null;

    HAZARD_REPORTS.forEach(function (hazard) {
      var dist = getDistanceMeters(coords, hazard.coords);
      if (dist < nearest) {
        nearest = dist;
        nearestHazard = hazard;
      }
    });

    if (!nearestHazard || !isFinite(nearest)) {
      return { label: "Unknown", className: "neutral", isRisk: false };
    }

    if (nearest <= 1200) {
      return { label: "Near " + nearestHazard.type, className: "danger", isRisk: true };
    }

    if (nearest <= 2600) {
      return { label: "Watch zone", className: "watch", isRisk: true };
    }

    return { label: "Clear", className: "clear", isRisk: false };
  }

  function getDistanceMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
    if (map && typeof map.distance === "function") {
      return map.distance(a, b);
    }

    var rad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * rad;
    var dLon = (b[1] - a[1]) * rad;
    var lat1 = a[0] * rad;
    var lat2 = b[0] * rad;
    var sinLat = Math.sin(dLat / 2);
    var sinLon = Math.sin(dLon / 2);
    var calc = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
    return 6371000 * 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
  }

  function setSafetyCircleText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderSafetyCircleMemberSearchResults() {
    var resultsEl = document.getElementById("circleAddMemberResults");
    if (!resultsEl) return;

    if (safetyCircleState.memberSearchBusy) {
      resultsEl.innerHTML = '<div class="circle-add-empty">Searching users…</div>';
      return;
    }

    if (!safetyCircleState.memberSearchResults.length) {
      resultsEl.innerHTML = '<div class="circle-add-empty">' + escapeHtml(safetyCircleState.memberSearchMessage || "Search by name or email to add people.") + '</div>';
      return;
    }

    resultsEl.innerHTML = safetyCircleState.memberSearchResults.map(function (user) {
      var isConnected = !!user.is_connected;
      return '' +
        '<div class="circle-add-result">' +
          '<div class="circle-add-result-copy">' +
            '<strong>' + escapeHtml(user.name || ("User #" + user.user_id)) + '</strong>' +
            '<span>' + escapeHtml(user.email || "No email listed") + '</span>' +
          '</div>' +
          '<button type="button" data-circle-add-user="' + escapeHtml(String(user.user_id || 0)) + '" data-circle-add-name="' + escapeHtml(user.name || "User") + '"' + (isConnected ? ' disabled' : '') + '>' + (isConnected ? 'Added' : 'Add') + '</button>' +
        '</div>';
    }).join("");

    resultsEl.querySelectorAll("[data-circle-add-user]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.hasAttribute("disabled")) return;
        addMemberToSafetyCircle(button.getAttribute("data-circle-add-user"), button.getAttribute("data-circle-add-name") || "User");
      });
    });
  }

  async function searchSafetyCircleUsers() {
    var input = document.getElementById("circleMemberSearchInput");
    var searchBtn = document.getElementById("circleSearchMemberBtn");
    var query = input ? input.value.trim() : "";

    if (query.length < 2) {
      safetyCircleState.memberSearchResults = [];
      safetyCircleState.memberSearchBusy = false;
      safetyCircleState.memberSearchMessage = "Type at least 2 characters to search for someone.";
      renderSafetyCircleMemberSearchResults();
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = "Search";
      }
      return;
    }

    safetyCircleState.memberSearchBusy = true;
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.textContent = "Searching...";
    }
    renderSafetyCircleMemberSearchResults();

    try {
      var response = await fetch(SAFETY_CIRCLE_API_URL + "?action=search-users&q=" + encodeURIComponent(query) + "&t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      if (!payload || !payload.ok) throw new Error(payload && payload.message ? payload.message : "Search failed.");

      safetyCircleState.memberSearchResults = Array.isArray(payload.results) ? payload.results : [];
      safetyCircleState.memberSearchMessage = safetyCircleState.memberSearchResults.length ? "" : "No matching users found yet.";
    } catch (err) {
      safetyCircleState.memberSearchResults = [];
      safetyCircleState.memberSearchMessage = "Could not search users right now.";
      showToast("Could not search Safety Circle users.");
    } finally {
      safetyCircleState.memberSearchBusy = false;
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = "Search";
      }
      renderSafetyCircleMemberSearchResults();
    }
  }

  async function addMemberToSafetyCircle(memberUserId, memberName) {
    var relationInput = document.getElementById("circleMemberRelationInput");
    var relation = relationInput ? relationInput.value.trim() : "";

    try {
      var payload = await postSafetyCircleAction("add-member", {
        member_user_id: Number(memberUserId) || 0,
        relation: relation
      });
      applySafetyCirclePayload(payload);
      safetyCircleState.memberSearchResults = safetyCircleState.memberSearchResults.map(function (entry) {
        if (String(entry.user_id) === String(memberUserId)) {
          return Object.assign({}, entry, { is_connected: true });
        }
        return entry;
      });
      safetyCircleState.memberSearchMessage = (memberName || "User") + " is now in your Safety Circle.";
      if (relationInput) relationInput.value = "";
      renderSafetyCircleMemberSearchResults();
      showToast((memberName || "User") + " added to your Safety Circle.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not add that person right now.");
    }
  }

  function renderSafetyCirclePlaceList() {
    var placeListEl = document.getElementById("circlePlaceList");
    if (!placeListEl) return;

    if (!Array.isArray(safetyCircleState.places) || !safetyCircleState.places.length) {
      placeListEl.innerHTML = '<div class="circle-add-empty">No saved places yet. Save Home, School, or Work to get arrival and departure alerts.</div>';
      return;
    }

    placeListEl.innerHTML = safetyCircleState.places.map(function (place) {
      return '' +
        '<div class="circle-place-item">' +
          '<div class="circle-place-copy">' +
            '<strong>' + escapeHtml(place.label || "Saved place") + '</strong>' +
            '<span>Radius ' + escapeHtml(String(place.radiusMeters || place.radius_meters || 250)) + 'm • ' + escapeHtml(place.createdLabel || place.created_label || "Recently added") + '</span>' +
          '</div>' +
          '<button type="button" data-circle-place-delete="' + escapeHtml(String(place.id || 0)) + '">Remove</button>' +
        '</div>';
    }).join("");

    placeListEl.querySelectorAll("[data-circle-place-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteSafetyCirclePlace(button.getAttribute("data-circle-place-delete"));
      });
    });
  }

  function renderSafetyCircleActivityList() {
    var activityEl = document.getElementById("circleActivityList");
    if (!activityEl) return;

    if (!Array.isArray(safetyCircleState.recentActivity) || !safetyCircleState.recentActivity.length) {
      activityEl.innerHTML = '<div class="circle-add-empty">Recent circle activity will appear here once locations and alerts start syncing.</div>';
      return;
    }

    activityEl.innerHTML = safetyCircleState.recentActivity.slice(0, 8).map(function (item) {
      var lat = item.lat != null ? String(item.lat) : "";
      var lng = item.lng != null ? String(item.lng) : "";
      var clickable = lat !== "" && lng !== "";
      return '' +
        '<div class="circle-activity-item' + (clickable ? ' is-clickable' : '') + '" data-circle-activity-lat="' + escapeHtml(lat) + '" data-circle-activity-lng="' + escapeHtml(lng) + '">' +
          '<strong>' + escapeHtml(item.title || "Safety Circle update") + '</strong>' +
          '<span>' + escapeHtml(item.summary || "") + '</span>' +
          '<small>' + escapeHtml(item.createdLabel || item.created_label || item.created_at || "Just now") + '</small>' +
        '</div>';
    }).join("");

    activityEl.querySelectorAll(".circle-activity-item.is-clickable").forEach(function (itemEl) {
      itemEl.addEventListener("click", function () {
        var lat = Number(itemEl.getAttribute("data-circle-activity-lat"));
        var lng = Number(itemEl.getAttribute("data-circle-activity-lng"));
        if (isFinite(lat) && isFinite(lng) && map) {
          map.flyTo([lat, lng], Math.max(15, map.getZoom()), { duration: 0.6 });
        }
      });
    });
  }

  async function saveCurrentLocationAsCirclePlace() {
    var labelInput = document.getElementById("circlePlaceLabelInput");
    var radiusInput = document.getElementById("circlePlaceRadiusInput");
    var saveBtn = document.getElementById("circleSavePlaceBtn");
    var label = labelInput ? labelInput.value.trim() : "";
    var radiusMeters = radiusInput ? Number(radiusInput.value) || 250 : 250;
    radiusMeters = Math.max(100, Math.min(2000, radiusMeters));
    if (radiusInput) radiusInput.value = String(radiusMeters);

    if (!label) {
      if (labelInput) labelInput.focus();
      showToast("Enter a place label first.");
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    var coords = safetyCircleState.userCoords;
    try {
      coords = await ensureBrowserLocation();
      safetyCircleState.userCoords = coords;
      setSafetyCircleUserMarker(coords);
    } catch (err) {}

    if (!Array.isArray(coords) || coords.length !== 2) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Current Place";
      }
      showToast("Current location is required to save a place.");
      return;
    }

    try {
      var payload = await postSafetyCircleAction("save-place", {
        label: label,
        radius_meters: radiusMeters,
        lat: coords[0],
        lng: coords[1]
      });
      applySafetyCirclePayload(payload);
      if (labelInput) labelInput.value = "";
      showToast(label + " saved for arrival and departure alerts.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not save that place right now.");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Current Place";
      }
    }
  }

  async function deleteSafetyCirclePlace(placeId) {
    if (!placeId) return;
    try {
      var payload = await postSafetyCircleAction("delete-place", { place_id: Number(placeId) || 0 });
      applySafetyCirclePayload(payload);
      showToast("Saved place removed.");
    } catch (err) {
      showToast(err && err.message ? err.message : "Could not remove that place right now.");
    }
  }

  function readOwnSafetyStatus() {
    try {
      return JSON.parse(localStorage.getItem(SAFETY_STATUS_STORAGE_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function saveOwnSafetyStatus(status) {
    try {
      localStorage.setItem(SAFETY_STATUS_STORAGE_KEY, JSON.stringify(status));
    } catch (err) {}
  }

  function updateOwnSafetyStatusUI() {
    var saved = readOwnSafetyStatus() || {};
    var label = saved.label || "Not checked in yet";
    var time = saved.timeLabel || "--";
    setSafetyCircleText("circleCheckinStatusLabel", label);
    setSafetyCircleText("circleCheckinTime", time);
    setTextIfExists("safetyCircleStatusCard", label);
  }

  function setOwnSafetyStatus(type) {
    var now = new Date();
    var payload = {
      type: type,
      label: type === "safe" ? "I'm Safe" : (type === "help" ? "Need Help" : "SOS Active"),
      timeLabel: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      updatedAt: now.toISOString()
    };
    saveOwnSafetyStatus(payload);
    updateOwnSafetyStatusUI();
    refreshSafetyCircleSummary();
    if (type === "safe") {
      showToast("Your Safety Circle was updated: I'm Safe.");
    } else if (type === "help") {
      showToast("Your Safety Circle was updated: Need Help.");
    } else {
      showToast("SOS status activated for your Safety Circle.");
    }
  }

  function getSafetyCircleSummary() {
    var total = safetyCircleState.members.length;
    var liveCount = safetyCircleState.members.filter(function (member) {
      return Array.isArray(member.coords) && member.coords.length === 2;
    }).length;
    var riskCount = safetyCircleState.members.filter(function (member) {
      return Array.isArray(member.coords) && getHazardRiskMeta(member.coords).isRisk;
    }).length;

    return {
      total: total,
      riskCount: riskCount,
      summaryText: total === 0
        ? "Search and add people to start your Safety Circle."
        : (liveCount + " sharing live location • " + riskCount + " near hazard zones")
    };
  }

  function getSafetyCircleMemberPopup(member) {
    var statusMeta = getMemberStatusMeta(member.status);
    var hasCoords = Array.isArray(member.coords) && member.coords.length === 2;
    var riskMeta = hasCoords ? getHazardRiskMeta(member.coords) : { label: "Waiting for location", className: "neutral", isRisk: false };

    return '' +
      '<div class="circle-popup">' +
        '<strong>' + escapeHtml(member.name) + '</strong><br>' +
        '<span>' + escapeHtml(member.relation) + '</span><br>' +
        '<span>Status: ' + escapeHtml(statusMeta.label) + '</span><br>' +
        '<span>Location: ' + escapeHtml(hasCoords ? 'Live on map' : 'Not shared yet') + '</span><br>' +
        '<span>Risk: ' + escapeHtml(riskMeta.label) + '</span>' +
      '</div>';
  }

  function getSafetyCircleMarkerIcon(member) {
    var statusMeta = getMemberStatusMeta(member.status);
    return L.divIcon({
      className: "circle-marker-wrapper",
      html: '' +
        '<div class="circle-marker ' + statusMeta.className + '">' +
          '<span class="circle-marker-ping"></span>' +
          '<span class="circle-marker-core">' + escapeHtml(getInitials(member.name)) + '</span>' +
        '</div>',
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -18]
    });
  }

  function ensureSafetyCircleLayer() {
    if (!map || safetyCircleState.layer) return;

    safetyCircleState.layer = L.layerGroup();

    safetyCircleState.members.forEach(function (member) {
      if (!Array.isArray(member.coords) || member.coords.length !== 2) return;

      var marker = L.marker(member.coords, {
        icon: getSafetyCircleMarkerIcon(member),
        zIndexOffset: 450
      });

      marker.bindPopup(getSafetyCircleMemberPopup(member));
      marker.on("click", function () {
        focusSafetyCircleMember(member.id);
      });

      safetyCircleState.layer.addLayer(marker);
      safetyCircleState.markersById[member.id] = marker;
    });
  }

  function highlightSafetyCircleMember(memberId) {
    safetyCircleState.activeMemberId = String(memberId);

    document.querySelectorAll(".circle-member-card").forEach(function (card) {
      card.classList.toggle("is-active", card.getAttribute("data-member-id") === String(memberId));
    });
  }

  function renderSafetyCirclePanel() {
    var listEl = document.getElementById("circleMemberList");
    if (!listEl) return;

    var summary = getSafetyCircleSummary();
    setSafetyCircleText("circleFabCount", String(summary.total));
    setSafetyCircleText("circleTrackedCount", String(summary.total));
    setSafetyCircleText("circleRiskCount", String(summary.riskCount));
    setSafetyCircleText("circleSummaryText", summary.summaryText);
    setSafetyCircleText("circleSyncText", safetyCircleState.lastSyncLabel);
    updateOwnSafetyStatusUI();
    renderSafetyCircleMemberSearchResults();
    renderSafetyCirclePlaceList();
    renderSafetyCircleActivityList();

    if (!safetyCircleState.members.length) {
      listEl.innerHTML = '<div class="circle-add-empty">No one is in your Safety Circle yet. Search and add people above so you can track their location, safe check-ins, and SOS alerts.</div>';
      return;
    }

    listEl.innerHTML = safetyCircleState.members.map(function (member) {
      var statusMeta = getMemberStatusMeta(member.status);
      var hasCoords = Array.isArray(member.coords) && member.coords.length === 2;
      var riskMeta = hasCoords ? getHazardRiskMeta(member.coords) : { label: "Awaiting location", className: "neutral" };

      return '' +
        '<article class="circle-member-card' + (member.id === safetyCircleState.activeMemberId ? ' is-active' : '') + '" data-member-id="' + escapeHtml(member.id) + '">' +
          '<div class="circle-member-top">' +
            '<div class="circle-member-avatar">' + escapeHtml(getInitials(member.name)) + '</div>' +
            '<div class="circle-member-copy">' +
              '<div class="circle-member-title-row">' +
                '<strong>' + escapeHtml(member.name) + '</strong>' +
                '<span class="circle-status-badge ' + statusMeta.className + '">' + escapeHtml(statusMeta.label) + '</span>' +
              '</div>' +
              '<p>' + escapeHtml(member.relation) + ' • ' + escapeHtml(member.note || (hasCoords ? 'Live location shared' : 'Waiting for live location')) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="circle-meta-row">' +
            '<span>' + escapeHtml(hasCoords ? 'Location shared' : 'Location pending') + '</span>' +
            '<span>' + escapeHtml(member.updated || '--') + '</span>' +
            '<span class="circle-risk-chip ' + riskMeta.className + '">' + escapeHtml(riskMeta.label) + '</span>' +
          '</div>' +
          '<div class="circle-action-row">' +
            '<button type="button" data-circle-action="focus" data-member-id="' + escapeHtml(member.id) + '"' + (hasCoords ? '' : ' disabled') + '>View</button>' +
            '<button type="button" data-circle-action="route" data-member-id="' + escapeHtml(member.id) + '"' + (hasCoords ? '' : ' disabled') + '>Route</button>' +
            '<button type="button" data-circle-action="ping" data-member-id="' + escapeHtml(member.id) + '">Ping</button>' +
          '</div>' +
        '</article>';
    }).join("");

    listEl.querySelectorAll("[data-circle-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.hasAttribute("disabled")) return;
        var action = button.getAttribute("data-circle-action");
        var memberId = button.getAttribute("data-member-id");
        if (action === "focus") {
          focusSafetyCircleMember(memberId);
          return;
        }
        if (action === "route") {
          routeToSafetyCircleMember(memberId);
          return;
        }
        if (action === "ping") {
          pingSafetyCircleMember(memberId);
        }
      });
    });

    listEl.querySelectorAll(".circle-member-card").forEach(function (card) {
      card.addEventListener("click", function (event) {
        if (event.target && event.target.closest("[data-circle-action]")) {
          return;
        }
        var memberId = card.getAttribute("data-member-id");
        if (!memberId) return;
        focusSafetyCircleMember(memberId);
      });
    });
  }

  function openSafetyCirclePanel() {
    var panel = document.getElementById("circlePanel");
    var fab = document.getElementById("circleFab");
    if (panel) panel.classList.remove("hidden");
    if (fab) {
      fab.classList.add("is-active");
      fab.setAttribute("aria-expanded", "true");
    }
    safetyCircleState.panelOpen = true;
    setSafetyCircleMarkersVisible(true);
    renderSafetyCirclePanel();
  }

  function closeSafetyCirclePanel() {
    var panel = document.getElementById("circlePanel");
    var fab = document.getElementById("circleFab");
    if (panel) panel.classList.add("hidden");
    if (fab) {
      fab.classList.remove("is-active");
      fab.setAttribute("aria-expanded", "false");
    }
    safetyCircleState.panelOpen = false;
    setSafetyCircleMarkersVisible(false);
    clearSafetyCircleRoute();
  }

  function toggleSafetyCirclePanel() {
    if (safetyCircleState.panelOpen) {
      closeSafetyCirclePanel();
      return;
    }
    openSafetyCirclePanel();
  }

  function setSafetyCircleMarkersVisible(isVisible) {
    ensureSafetyCircleLayer();
    if (!map || !safetyCircleState.layer) return;

    if (isVisible) {
      if (!map.hasLayer(safetyCircleState.layer)) {
        safetyCircleState.layer.addTo(map);
      }
      return;
    }

    if (map.hasLayer(safetyCircleState.layer)) {
      map.removeLayer(safetyCircleState.layer);
    }
  }

  function focusSafetyCircleMember(memberId) {
    var member = getSafetyCircleMemberById(memberId);
    var marker = safetyCircleState.markersById[memberId];
    if (!member || !map) return;

    highlightSafetyCircleMember(memberId);
    if (!Array.isArray(member.coords) || member.coords.length !== 2 || !marker) {
      showToast(member.name + " has not shared live location yet.");
      return;
    }

    setSafetyCircleMarkersVisible(true);
    map.flyTo(member.coords, Math.max(15, map.getZoom()), { duration: 0.65 });
    marker.openPopup();
    showToast(member.name + " is now focused on the map.");
  }

  function clearSafetyCircleRoute() {
    if (!map) return;
    if (safetyCircleState.routeLine && map.hasLayer(safetyCircleState.routeLine)) {
      map.removeLayer(safetyCircleState.routeLine);
    }
    if (safetyCircleState.userLocationMarker && map.hasLayer(safetyCircleState.userLocationMarker)) {
      map.removeLayer(safetyCircleState.userLocationMarker);
    }
    safetyCircleState.routeLine = null;
    safetyCircleState.userLocationMarker = null;
  }

  function routeToSafetyCircleMember(memberId) {
    var member = getSafetyCircleMemberById(memberId);
    if (!member || !map) return;

    if (!Array.isArray(member.coords) || member.coords.length !== 2) {
      showToast(member.name + " has not shared live location yet.");
      return;
    }

    if (!Array.isArray(safetyCircleState.userCoords) || safetyCircleState.userCoords.length !== 2) {
      showToast("Sync your location first to preview a route.");
      useBrowserLocationForSafetyCircle();
      return;
    }

    clearSafetyCircleRoute();
    highlightSafetyCircleMember(memberId);

    safetyCircleState.userLocationMarker = L.marker(safetyCircleState.userCoords, {
      icon: L.divIcon({
        className: "circle-user-marker-wrap",
        html: '<div class="circle-user-marker"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
      zIndexOffset: 430
    }).addTo(map).bindPopup("Your location");

    safetyCircleState.routeLine = L.polyline([safetyCircleState.userCoords, member.coords], {
      color: "#7ce8ff",
      weight: 4,
      opacity: 0.95,
      dashArray: "10 10"
    }).addTo(map);

    map.fitBounds(safetyCircleState.routeLine.getBounds(), { padding: [54, 54] });
    showToast("Route preview ready for " + member.name + ".");
  }

  function pingSafetyCircleMember(memberId) {
    var member = getSafetyCircleMemberById(memberId);
    if (!member) return;
    highlightSafetyCircleMember(memberId);
    showToast("Ping sent to " + member.name + ".");
  }

  function fitSafetyCircleMembers() {
    ensureSafetyCircleLayer();
    if (!map || !safetyCircleState.members.length) return;

    var visibleCoords = safetyCircleState.members
      .map(function (member) { return Array.isArray(member.coords) && member.coords.length === 2 ? member.coords : null; })
      .filter(function (coords) { return Array.isArray(coords); });

    if (!visibleCoords.length) {
      showToast("No live Safety Circle locations are available yet.");
      return;
    }

    var bounds = L.latLngBounds(visibleCoords);
    if (Array.isArray(safetyCircleState.userCoords) && safetyCircleState.userCoords.length === 2) {
      bounds.extend(safetyCircleState.userCoords);
    }
    map.fitBounds(bounds, { padding: [54, 54], maxZoom: 15 });
    showToast("Safety Circle members are now in view.");
  }

  function useBrowserLocationForSafetyCircle() {
    if (!navigator.geolocation) {
      showToast("Browser location is unavailable.");
      return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
      safetyCircleState.userCoords = [position.coords.latitude, position.coords.longitude];
      safetyCircleState.lastSyncLabel = "Live";
      setSafetyCircleText("circleSyncText", "Live");
      showToast("Current location synced for Safety Circle.");
    }, function () {
      showToast("Could not get your current location. Using Bacolod fallback.");
    }, {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 120000
    });
  }

  function refreshSafetyCircleSummary() {
    renderSafetyCirclePanel();
  }

  window.showToast = showToast;
  window.refreshSafetyCircleSummary = refreshSafetyCircleSummary;
  window.hvToggleSafetyCirclePanel = toggleSafetyCirclePanel;

  function cycleConfidence() {
    var tangub = Math.floor(78 + Math.random() * 18);
    var road = Math.floor(38 + Math.random() * 24);

    setTextIfExists("confidenceTangubLabel", tangub + "%");
    setTextIfExists("confidenceRoadLabel", road + "%");

    var tangubBar = document.getElementById("confidenceTangubBar");
    if (tangubBar) {
      tangubBar.style.width = tangub + "%";
    }

    var roadBar = document.getElementById("confidenceRoadBar");
    if (roadBar) {
      roadBar.style.width = road + "%";
    }
  }

  function cycleMeshNetwork() {
    setTextIfExists("weatherCoverageCount", String(weatherCoverageState.mappedCount || 0));
    setTextIfExists("weatherCoverageMode", weatherCoverageState.modeLabel || "Realtime");
    setTextIfExists("lastWeatherSyncCard", weatherCoverageState.lastSyncLabel || "--");
    updateOwnSafetyStatusUI();
    setTextIfExists(
      "meshStatusText",
      "Realtime weather now uses live coordinate-based requests. Add a full barangay centroid dataset to the map layer when you are ready for complete per-barangay coverage."
    );
  }

  function formatTyphoonUpdated(value) {
    if (!value) return "--";
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function setTyphoonCard(statusClass, statusLabel, name, meta, wind, gust, movement, updated, note) {
    var card = document.getElementById("weatherTyphoonSection");
    var pill = document.getElementById("typhoonStormStatus");
    if (card) {
      card.classList.remove("is-active", "is-inactive");
      card.classList.add(statusClass === "active" ? "is-active" : "is-inactive");
    }
    if (pill) {
      pill.className = "typhoon-status-pill " + (statusClass === "active" ? "active" : "inactive");
      pill.textContent = statusLabel;
    }
    setTextIfExists("typhoonStormName", name);
    setTextIfExists("typhoonStormMeta", meta);
    setTextIfExists("typhoonWind", wind);
    setTextIfExists("typhoonGust", gust);
    setTextIfExists("typhoonMovement", movement);
    setTextIfExists("typhoonUpdated", updated);
    setTextIfExists("typhoonSourceNote", note);
  }

  function setForecastCards(shortText, landfallText, priorityText, noteText) {
    setTextIfExists("forecastShort", shortText);
    setTextIfExists("forecastLandfall", landfallText);
    setTextIfExists("forecastPriority", priorityText);
    setTextIfExists("forecastNote", noteText);
  }

  function clearTyphoonLayer() {
    if (typhoonState.layer) {
      typhoonState.layer.clearLayers();
    }
  }

  function offsetLatLngByKm(latlng, angleRad, km) {
    var lat = Number(latlng[0]);
    var lon = Number(latlng[1]);
    var latOffset = (Math.sin(angleRad) * km) / 110.574;
    var lonScale = 111.320 * Math.cos(lat * Math.PI / 180);
    var lonOffset = lonScale ? (Math.cos(angleRad) * km) / lonScale : 0;
    return [lat + latOffset, lon + lonOffset];
  }

  function getTrackAngle(track, index) {
    var prev = track[Math.max(0, index - 1)];
    var next = track[Math.min(track.length - 1, index + 1)];
    var avgLat = ((Number(prev.lat) || 0) + (Number(next.lat) || 0)) / 2;
    var dx = ((Number(next.lon) || 0) - (Number(prev.lon) || 0)) * Math.cos(avgLat * Math.PI / 180);
    var dy = (Number(next.lat) || 0) - (Number(prev.lat) || 0);
    return Math.atan2(dy, dx);
  }

  function getTyphoonPointRadiusKm(point, index) {
    var explicit = Number(point && (point.cone_radius_km || point.radius_km));
    if (isFinite(explicit) && explicit > 0) return explicit;
    var defaults = [35, 55, 80, 105, 130, 155, 180];
    return defaults[Math.min(index, defaults.length - 1)];
  }

  function buildTyphoonConePolygon(track, scale) {
    if (!Array.isArray(track) || track.length < 2) return [];
    var left = [];
    var right = [];
    track.forEach(function (point, index) {
      var latlng = [Number(point.lat), Number(point.lon)];
      if (!isFinite(latlng[0]) || !isFinite(latlng[1])) return;
      var angle = getTrackAngle(track, index);
      var radiusKm = getTyphoonPointRadiusKm(point, index) * scale;
      left.push(offsetLatLngByKm(latlng, angle + Math.PI / 2, radiusKm));
      right.push(offsetLatLngByKm(latlng, angle - Math.PI / 2, radiusKm));
    });
    return left.concat(right.reverse());
  }

  function getTyphoonPointLabel(point, index) {
    if (point && point.label) return String(point.label);
    if (index === 0) return "Now";
    var offset = Number(point && point.hour_offset);
    return isFinite(offset) ? "+" + offset + "h" : "+" + (index * 12) + "h";
  }

  function getTyphoonPointPopup(storm, point, label) {
    return '<div class="circle-popup"><strong>' + escapeHtml(storm.name || "Tropical Cyclone") + '</strong><span>' +
      escapeHtml(label) + ' • ' + escapeHtml(point.category || storm.category || "Forecast point") + '</span></div>';
  }

  function drawTyphoonOverlay(storm) {
    if (!map || !typhoonState.layer || !Array.isArray(storm.track) || !storm.track.length) return;

    clearTyphoonLayer();

    var cleanTrack = storm.track.filter(function (point) {
      return isFinite(Number(point.lat)) && isFinite(Number(point.lon));
    });

    if (cleanTrack.length < 1) return;

    if (cleanTrack.length > 1) {
      var outerCone = buildTyphoonConePolygon(cleanTrack, 1);
      var innerCone = buildTyphoonConePolygon(cleanTrack, 0.55);

      if (outerCone.length >= 3) {
        L.polygon(outerCone, {
          stroke: false,
          fillColor: "#cfd6df",
          fillOpacity: 0.18,
          interactive: false
        }).addTo(typhoonState.layer);
      }

      if (innerCone.length >= 3) {
        L.polygon(innerCone, {
          color: "#f3f7fb",
          weight: 1.2,
          opacity: 0.55,
          fillColor: "#aebbc9",
          fillOpacity: 0.12,
          interactive: false
        }).addTo(typhoonState.layer);
      }

      L.polyline(cleanTrack.map(function (point) { return [Number(point.lat), Number(point.lon)]; }), {
        color: "#f6fbff",
        weight: 2.4,
        opacity: 0.96,
        dashArray: "8 10"
      }).addTo(typhoonState.layer);
    }

    cleanTrack.forEach(function (point, index) {
      var label = getTyphoonPointLabel(point, index);
      if (index === 0) {
        L.marker([Number(point.lat), Number(point.lon)], {
          icon: L.divIcon({
            className: "typhoon-eye-wrap",
            html: '<div class="typhoon-eye-marker"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).bindPopup(getTyphoonPointPopup(storm, point, label)).addTo(typhoonState.layer);
        return;
      }

      L.marker([Number(point.lat), Number(point.lon)], {
        icon: L.divIcon({
          className: "typhoon-point-marker-wrap",
          html: '<div class="typhoon-point-marker"><span class="typhoon-point-label">' + escapeHtml(label) + '</span></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        })
      }).bindPopup(getTyphoonPointPopup(storm, point, label)).addTo(typhoonState.layer);
    });

    if (!typhoonState.hasAutoFit && cleanTrack.length > 1) {
      typhoonState.hasAutoFit = true;
      map.fitBounds(L.latLngBounds(cleanTrack.map(function (point) { return [Number(point.lat), Number(point.lon)]; })), {
        padding: [42, 42],
        maxZoom: 7
      });
    }
  }

  function renderTyphoonInactiveState(message, note) {
    typhoonState.active = false;
    clearTyphoonLayer();
    setTyphoonCard(
      "inactive",
      "Inactive",
      "No active tropical cyclone",
      message || "Waiting for the next official advisory.",
      "-- km/h",
      "-- km/h",
      "--",
      formatTyphoonUpdated(new Date().toISOString()),
      note || "Tracker stays live and will switch to a cone view once your feed provides active storm points."
    );
    setForecastCards(
      "No active tropical cyclone within PAR right now.",
      "Live cone forecast will appear here once an active storm feed is available.",
      "Keep watching heavy rain, flood, and local hazard layers in the meantime.",
      "The tracker checks your live typhoon feed automatically and swaps from idle state to cone view when new advisory data arrives."
    );
  }

  function normalizeTyphoonPayload(payload) {
    var track = Array.isArray(payload && payload.track) ? payload.track : [];
    return {
      active: !!(payload && payload.active),
      name: payload && (payload.name || payload.storm_name) ? String(payload.name || payload.storm_name) : "Tropical Cyclone",
      category: payload && payload.category ? String(payload.category) : "Tropical Cyclone",
      movement: payload && payload.movement ? String(payload.movement) : "--",
      windKph: payload && isFinite(Number(payload.wind_kph)) ? Math.round(Number(payload.wind_kph)) : null,
      gustKph: payload && isFinite(Number(payload.gust_kph)) ? Math.round(Number(payload.gust_kph)) : null,
      updatedAt: payload && (payload.updated_at || payload.advisory_time) ? String(payload.updated_at || payload.advisory_time) : new Date().toISOString(),
      source: payload && payload.source ? String(payload.source) : "Typhoon feed",
      meta: payload && payload.meta ? String(payload.meta) : "Waiting for advisory data.",
      priority: payload && payload.priority ? String(payload.priority) : "Monitor official advisories and rainfall conditions.",
      landfall: payload && payload.landfall ? String(payload.landfall) : "Awaiting the latest landfall assessment.",
      note: payload && payload.note ? String(payload.note) : "Track cone is refreshed automatically whenever the feed updates.",
      track: track.map(function (point, index) {
        return {
          lat: Number(point.lat),
          lon: Number(point.lon),
          label: point.label || point.time_label || null,
          hour_offset: isFinite(Number(point.hour_offset)) ? Number(point.hour_offset) : (index === 0 ? 0 : index * 12),
          cone_radius_km: isFinite(Number(point.cone_radius_km || point.radius_km)) ? Number(point.cone_radius_km || point.radius_km) : null,
          category: point.category || null
        };
      })
    };
  }

  function renderTyphoonActiveState(storm) {
    typhoonState.active = true;
    drawTyphoonOverlay(storm);
    setTyphoonCard(
      "active",
      storm.category || "Active",
      storm.name,
      storm.meta || (storm.category + " advisory is active."),
      storm.windKph !== null ? storm.windKph + " km/h" : "-- km/h",
      storm.gustKph !== null ? storm.gustKph + " km/h" : "-- km/h",
      storm.movement || "--",
      formatTyphoonUpdated(storm.updatedAt),
      (storm.source || "Typhoon feed") + " • Forecast cone updates when new track points arrive."
    );
    setForecastCards(
      storm.name + " is moving " + (storm.movement || "with no movement data yet") + ".",
      storm.landfall || "Awaiting the latest landfall assessment.",
      storm.priority || "Monitor official advisories and rainfall conditions.",
      storm.note || "Cone widths widen further out to reflect increasing forecast uncertainty, similar to modern typhoon trackers."
    );
  }

  async function refreshTyphoonTracker(showFeedback) {
    try {
      var response = await fetch(TYPHOON_FEED_URL + "?t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      var storm = normalizeTyphoonPayload(payload);
      if (storm.active && storm.track.length) {
        renderTyphoonActiveState(storm);
      } else {
        renderTyphoonInactiveState(payload && payload.message ? payload.message : "No active tropical cyclone within PAR.", payload && payload.source ? String(payload.source) : undefined);
      }
      if (showFeedback) {
        showToast("Typhoon tracker updated.");
      }
    } catch (err) {
      renderTyphoonInactiveState("Typhoon feed is unavailable right now.", "Connect process/typhoon_live_feed.php to a parsed PAGASA or JTWC track feed for full live cone rendering.");
      if (showFeedback) {
        showToast("Typhoon tracker could not refresh.");
      }
    }
  }

  window.refreshTyphoonTracker = function () {
    return refreshTyphoonTracker(true);
  };

  function syncWeatherPanelButtons() {
    var closeBtn = document.getElementById("weatherClose");
    var reopenBtn = document.getElementById("weatherReopenBtn");
    if (closeBtn) {
      closeBtn.setAttribute("aria-label", "Minimize weather panel");
      closeBtn.setAttribute("title", "Minimize Weather");
    }
    if (reopenBtn) {
      reopenBtn.setAttribute("aria-label", "Maximize weather panel");
      reopenBtn.setAttribute("title", "Maximize Weather");
      reopenBtn.classList.toggle("hidden", !weatherPanelMinimized);
      reopenBtn.hidden = !weatherPanelMinimized;
    }
  }

  function closeWeatherPanel() {
    var panel = document.getElementById("weatherPanel");
    weatherPanelMinimized = true;
    setWeatherPanelMode("details");
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    }
    syncWeatherPanelButtons();
  }

  function openWeatherPanel(options) {
    options = options || {};
    var panel = document.getElementById("weatherPanel");
    weatherPanelMinimized = false;
    if (panel) {
      panel.hidden = false;
      panel.classList.remove("hidden");
      panel.setAttribute("aria-hidden", "false");
    }
    setWeatherPanelMode(options.mode === "forecast" ? "forecast" : "details");
    syncWeatherPanelButtons();
  }

  function toggleWeatherPanel() {
    if (weatherPanelMinimized) {
      openWeatherPanel({ mode: "details" });
    } else {
      closeWeatherPanel();
    }
  }

  function reopenWeatherPanel(mode) {
    openWeatherPanel({ mode: mode === "forecast" ? "forecast" : "details" });
  }

  function setWeatherPanelMode(mode) {
    weatherPanelMode = mode === "forecast" ? "forecast" : "details";

    var detailsBody = document.getElementById("weatherBody");
    var forecastBody = document.getElementById("weatherForecastBody");
    var toggleBtn = document.getElementById("weatherModeToggle");
    var showDetails = weatherPanelMode === "details";
    var showForecast = weatherPanelMode === "forecast";

    if (detailsBody) {
      detailsBody.classList.toggle("hidden", !showDetails);
      detailsBody.hidden = !showDetails;
      detailsBody.setAttribute("aria-hidden", showDetails ? "false" : "true");
    }
    if (forecastBody) {
      forecastBody.classList.toggle("hidden", !showForecast);
      forecastBody.hidden = !showForecast;
      forecastBody.setAttribute("aria-hidden", showForecast ? "false" : "true");
    }
    if (toggleBtn) {
      toggleBtn.textContent = showDetails ? "Show Forecast" : "Show Details";
      toggleBtn.setAttribute("aria-pressed", showForecast ? "true" : "false");
      toggleBtn.setAttribute("title", showDetails ? "Show daily forecast" : "Show weather details");
    }
  }

  function getProvinceWeatherUrlGroup(groupName, provinceName) {
    if (!window.WEATHER_API || !window.WEATHER_API[groupName]) {
      return null;
    }
    return window.WEATHER_API[groupName][provinceName] || null;
  }

  function getPlaceWeatherUrl(placeName, provinceName) {
    var citiesByProvince = getProvinceWeatherUrlGroup("cities", provinceName);
    if (citiesByProvince && citiesByProvince[placeName]) {
      return citiesByProvince[placeName];
    }

    var municipalitiesByProvince = getProvinceWeatherUrlGroup("municipalities", provinceName);
    if (municipalitiesByProvince && municipalitiesByProvince[placeName]) {
      return municipalitiesByProvince[placeName];
    }

    return null;
  }

  function extractLocationKeyFromCurrentConditionsUrl(url) {
    if (!url) {
      return null;
    }

    var match = String(url).match(/currentconditions\/v1\/([^/?]+)/i);
    return match && match[1] ? match[1] : null;
  }

  function buildWeatherProxyUrl(type, locationKey) {
    return WEATHER_PROXY_URL + "?type=" + encodeURIComponent(type) + "&locationKey=" + encodeURIComponent(locationKey);
  }

  function buildRealtimeWeatherUrl(place) {
    return WEATHER_REALTIME_PROXY_URL
      + "?lat=" + encodeURIComponent(place.coords[0])
      + "&lon=" + encodeURIComponent(place.coords[1])
      + "&label=" + encodeURIComponent(place.name || "Selected place");
  }

  function readCoordCache() {
    try {
      return JSON.parse(localStorage.getItem(PLACE_COORD_CACHE_KEY) || "{}");
    } catch (err) {
      return {};
    }
  }

  function readWeatherClientCache() {
    // Reads per-location weather cache from localStorage.
    try {
      return JSON.parse(localStorage.getItem(WEATHER_CLIENT_CACHE_KEY) || "{}");
    } catch (err) {
      return {};
    }
  }

  function writeWeatherClientCache(cache) {
    // Persists per-location weather cache to localStorage.
    try {
      localStorage.setItem(WEATHER_CLIENT_CACHE_KEY, JSON.stringify(cache));
    } catch (err) {}
  }

  function writeCoordCache(cache) {
    try {
      localStorage.setItem(PLACE_COORD_CACHE_KEY, JSON.stringify(cache));
    } catch (err) {}
  }

  function getPlaceCacheKey(place) {
    return place.province + "|" + place.name;
  }

  function buildWesternVisayasPlaces() {
    var places = [];
    var seen = {};

    WESTERN_VISAYAS_PROVINCES.forEach(function (province) {
      var cities = getProvinceWeatherUrlGroup("cities", province) || {};
      Object.keys(cities).forEach(function (name) {
        var cacheKey = province + "|" + name;
        if (seen[cacheKey]) return;
        seen[cacheKey] = true;
        places.push({ name: name, province: province, type: "city", weatherUrl: cities[name], locationKey: extractLocationKeyFromCurrentConditionsUrl(cities[name]) });
      });

      var municipalities = getProvinceWeatherUrlGroup("municipalities", province) || {};
      Object.keys(municipalities).forEach(function (name) {
        var cacheKey = province + "|" + name;
        if (seen[cacheKey]) return;
        seen[cacheKey] = true;
        places.push({ name: name, province: province, type: "municipality", weatherUrl: municipalities[name], locationKey: extractLocationKeyFromCurrentConditionsUrl(municipalities[name]) });
      });
    });

    return places;
  }

  async function fetchCoordsFromAccuWeather(place) {
    if (!place.locationKey) return null;
    try {
      var response = await fetch(buildWeatherProxyUrl("location", place.locationKey));
      if (!response.ok) return null;

      var payload = await response.json();
      if (!payload || !payload.GeoPosition) return null;

      var lat = Number(payload.GeoPosition.Latitude);
      var lon = Number(payload.GeoPosition.Longitude);
      if (!isFinite(lat) || !isFinite(lon)) return null;
      return [lat, lon];
    } catch (err) {
      return null;
    }
  }

  async function fetchCoordsFromNominatim(place) {
    try {
      var query = place.name + ", " + place.province + ", Western Visayas, Philippines";
      var response = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=" + encodeURIComponent(query));
      if (!response.ok) return null;

      var payload = await response.json();
      if (!Array.isArray(payload) || !payload.length) return null;

      var lat = Number(payload[0].lat);
      var lon = Number(payload[0].lon);
      if (!isFinite(lat) || !isFinite(lon)) return null;
      return [lat, lon];
    } catch (err) {
      return null;
    }
  }

  async function resolvePlaceCoords(place, cache) {
    var cacheKey = getPlaceCacheKey(place);
    if (Array.isArray(cache[cacheKey]) && cache[cacheKey].length === 2) return cache[cacheKey];
    if (Array.isArray(FALLBACK_CITY_COORDS[cacheKey])) {
      cache[cacheKey] = FALLBACK_CITY_COORDS[cacheKey];
      writeCoordCache(cache);
      return cache[cacheKey];
    }

    var fromAccu = await fetchCoordsFromAccuWeather(place);
    if (fromAccu) {
      cache[cacheKey] = fromAccu;
      writeCoordCache(cache);
      return fromAccu;
    }

    var fromNominatim = await fetchCoordsFromNominatim(place);
    if (fromNominatim) {
      cache[cacheKey] = fromNominatim;
      writeCoordCache(cache);
      return fromNominatim;
    }

    return null;
  }
  function isNightObservation(observedAt) {
    var d = observedAt ? new Date(observedAt) : new Date();
    if (isNaN(d.getTime())) {
      d = new Date();
    }
    var hour = d.getHours();
    return hour < 6 || hour >= 18;
  }

  function normalizeWeatherThemeForFilter(type) {
    return type === "night-partly" ? "moon" : (type || "sun");
  }

  function refreshWeatherFilterAppearance() {
    var btn = document.getElementById("mapWeatherFilterBtn");
    if (!btn) return;

    ["weather-theme-sun", "weather-theme-moon", "weather-theme-cloud", "weather-theme-rain", "weather-theme-storm", "weather-theme-fog"].forEach(function (cls) {
      btn.classList.remove(cls);
    });

    var activeTheme = normalizeWeatherThemeForFilter(weatherCoverageState.commonType || "sun");
    btn.classList.add("weather-theme-" + activeTheme);

    var themeLabels = {
      sun: "Mostly sunny",
      moon: "Clear night",
      cloud: "Cloudy",
      rain: "Rain-dominant",
      storm: "Storm-prone",
      fog: "Low visibility"
    };
    btn.setAttribute("title", "Weather • prevailing pattern: " + (themeLabels[activeTheme] || "Live conditions"));
  }

  function rememberPlaceWeatherTheme(place, themeType) {
    if (!place || !themeType || themeType === "loading" || themeType === "error") return;

    var sampleKey = getWeatherCacheKey(place);
    if (!weatherCoverageState.weatherSamples) {
      weatherCoverageState.weatherSamples = {};
    }
    weatherCoverageState.weatherSamples[sampleKey] = normalizeWeatherThemeForFilter(themeType);

    var counts = {};
    Object.keys(weatherCoverageState.weatherSamples).forEach(function (key) {
      var sampleType = weatherCoverageState.weatherSamples[key];
      counts[sampleType] = (counts[sampleType] || 0) + 1;
    });

    var dominantType = "sun";
    var dominantCount = 0;
    Object.keys(counts).forEach(function (type) {
      if (counts[type] > dominantCount) {
        dominantType = type;
        dominantCount = counts[type];
      }
    });

    weatherCoverageState.commonType = dominantType;
    refreshWeatherFilterAppearance();
  }

  function getWeatherIconType(conditionText, observedAt) {
    var label = String(conditionText || "").toLowerCase();
    var isNight = isNightObservation(observedAt);

    if (label.indexOf("error") >= 0) return "error";
    if (label.indexOf("loading") >= 0 || label.indexOf("fetching") >= 0) return "loading";
    if (label.indexOf("thunder") >= 0 || label.indexOf("storm") >= 0) return "storm";
    if (label.indexOf("shower") >= 0 || label.indexOf("rain") >= 0 || label.indexOf("drizzle") >= 0) return "rain";
    if (label.indexOf("fog") >= 0 || label.indexOf("haze") >= 0 || label.indexOf("mist") >= 0) return "fog";
    if (label.indexOf("partly") >= 0 || label.indexOf("intermittent") >= 0 || label.indexOf("mostly sunny") >= 0 || label.indexOf("mostly clear") >= 0) {
      return isNight ? "night-partly" : "partly";
    }
    if (label.indexOf("cloud") >= 0 || label.indexOf("overcast") >= 0) return "cloud";
    return isNight ? "moon" : "sun";
  }

  function setWeatherConditionBadge(type, conditionText) {
    var badge = document.getElementById("weatherConditionBadge");
    if (!badge) return;
    var friendlyLabels = {
      sun: "Sunny",
      moon: "Clear Night",
      partly: "Partly Cloudy",
      "night-partly": "Cloudy Night",
      cloud: "Cloudy",
      rain: "Raining",
      storm: "Storm Risk",
      fog: "Low Visibility",
      error: "Weather Unavailable",
      loading: "Loading Weather"
    };
    badge.className = "weather-condition-badge " + (type || "neutral");
    badge.textContent = friendlyLabels[type] || conditionText || "Live Conditions";
  }

  function setWeatherPanelTheme(type) {
    var panel = document.getElementById("weatherPanel");
    if (panel) {
      panel.setAttribute("data-weather-theme", type || "sun");
    }
  }

  function setWeatherIcon(conditionText, observedAt) {
    var type = getWeatherIconType(conditionText, observedAt);
    var iconEl = document.getElementById("weatherIcon");
    if (iconEl) {
      iconEl.innerHTML = getWeatherSvg(type);
    }
    setWeatherConditionBadge(type, conditionText);
    setWeatherPanelTheme(type);
    refreshWeatherFilterAppearance();
    return type;
  }

  function getWeatherSvg(type) {
    if (type === "moon") return '' +
      '<svg class="hvwx hvwx-moon" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="62" cy="34" r="15" fill="#d9e7ff" opacity=".25" />' +
      '<path d="M64 17c-12 2-20 13-18 25 2 12 12 20 24 20 8 0 14-3 19-9-2 1-5 1-7 1-13 0-24-10-24-24 0-5 2-9 6-13Z" fill="#dbe7ff">' +
      '<animate attributeName="opacity" values=".88;1;.88" dur="4s" repeatCount="indefinite"/>' +
      '</path>' +
      '<g fill="#f8fbff">' +
      '<circle cx="27" cy="23" r="2"><animate attributeName="opacity" values=".4;1;.4" dur="2.3s" repeatCount="indefinite"/></circle>' +
      '<circle cx="18" cy="39" r="1.6"><animate attributeName="opacity" values="1;.35;1" dur="2.8s" repeatCount="indefinite"/></circle>' +
      '<circle cx="33" cy="48" r="1.4"><animate attributeName="opacity" values=".35;1;.35" dur="2.1s" repeatCount="indefinite"/></circle>' +
      '</g>' +
      '</svg>';
    if (type === "night-partly") return '' +
      '<svg class="hvwx hvwx-night-partly" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path d="M62 18c-9 2-16 10-15 20 1 10 9 17 19 17 6 0 11-2 15-7-2 .8-3 .9-5 .9-11 0-19-8-19-19 0-4 1-8 5-12Z" fill="#dbe7ff" opacity=".92"/>' +
      '<path class="hvwx-cloud" d="M28 70c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '</svg>';
    if (type === "partly") return '' +
      '<svg class="hvwx hvwx-partly" viewBox="0 0 100 100" aria-hidden="true">' +
      '<g>' +
      '<animateTransform attributeName="transform" type="rotate" from="0 34 34" to="360 34 34" dur="18s" repeatCount="indefinite"/>' +
      '<path d="M34 11v9M34 49v9M11 34h9M49 34h9M18 18l6 6M44 44l6 6M50 18l-6 6M24 44l-6 6" stroke="#FFD35A" stroke-width="4" stroke-linecap="round"/>' +
      '</g>' +
      '<circle cx="34" cy="34" r="12" fill="#FFD35A"><animate attributeName="r" values="12;13.5;12" dur="3.6s" repeatCount="indefinite"/></circle>' +
      '<path class="hvwx-cloud" d="M28 70c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '</svg>';
    if (type === "cloud") return '' +
      '<svg class="hvwx hvwx-cloudy" viewBox="0 0 100 100" aria-hidden="true">' +
      '<g><animateTransform attributeName="transform" type="translate" values="0 0;2 -1;0 0;-2 1;0 0" dur="8s" repeatCount="indefinite"/>' +
      '<path class="hvwx-cloud" d="M22 63c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '</g></svg>';
    if (type === "rain") return '' +
      '<svg class="hvwx hvwx-rain" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="hvwx-cloud" d="M22 63c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '<path class="hvwx-drop d1" d="M34 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '<path class="hvwx-drop d2" d="M50 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '<path class="hvwx-drop d3" d="M66 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '</svg>';
    if (type === "storm") return '' +
      '<svg class="hvwx hvwx-thunder" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="hvwx-cloud thunder-cloud" d="M22 63c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '<polygon class="hvwx-bolt" points="45,61 39,78 47,78 43,92 59,73 51,73 58,61"/>' +
      '<path class="hvwx-drop d1" d="M34 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '<path class="hvwx-drop d3" d="M66 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '</svg>';
    if (type === "fog") return '' +
      '<svg class="hvwx hvwx-fog" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="hvwx-cloud" d="M22 58c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '<g stroke="#C7D5E5" stroke-width="4" stroke-linecap="round">' +
      '<path d="M22 71h48"><animate attributeName="opacity" values=".35;1;.35" dur="2.4s" repeatCount="indefinite"/></path>' +
      '<path d="M16 80h58"><animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite"/></path>' +
      '</g></svg>';
    if (type === "error") return '' +
      '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="22" fill="#FFCECE"><animate attributeName="opacity" values=".7;1;.7" dur="1.8s" repeatCount="indefinite"/></circle>' +
      '<path d="M32 20v14M32 43.5h.01" stroke="#D64B4B" stroke-width="4" stroke-linecap="round"/>' +
      '</svg>';
    if (type === "loading") return '' +
      '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g><animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="1s" repeatCount="indefinite"/>' +
      '<circle cx="32" cy="32" r="20" stroke="#9FC7FF" stroke-width="5" stroke-linecap="round" stroke-dasharray="28 16"/>' +
      '</g></svg>';
    return '' +
      '<svg class="hvwx hvwx-sun" viewBox="0 0 100 100" aria-hidden="true">' +
      '<g><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="16s" repeatCount="indefinite"/>' +
      '<path d="M50 12v11M50 77v11M12 50h11M77 50h11M24 24l8 8M68 68l8 8M76 24l-8 8M32 68l-8 8" stroke="#FFD35A" stroke-width="5" stroke-linecap="round"/>' +
      '</g>' +
      '<circle cx="50" cy="50" r="16" fill="#FFD35A"><animate attributeName="r" values="16;18;16" dur="3.4s" repeatCount="indefinite"/></circle>' +
      '</svg>';
  }

  function getForecastIconType(text) {
    var type = getWeatherIconType(text, "2026-01-01T12:00:00");
    if (type === "moon") return "sun";
    if (type === "night-partly") return "partly";
    return type;
  }

  function formatForecastDay(dateText, index) {
    if (index === 0) return "Today";
    var d = new Date(dateText);
    if (isNaN(d.getTime())) return "Day " + (index + 1);
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  function buildRainViewerFrameUrl(path) {
    return "https://tilecache.rainviewer.com" + path + "/256/{z}/{x}/{y}/2/1_1.png";
  }

  function ensureRainRadarTileLayer() {
    if (!rainRadarState.tileLayer) {
      rainRadarState.tileLayer = L.tileLayer("https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=439d4b804bc8187953eb36d2a8c26a02", {
        opacity: 0.52,
        className: "hv-rain-radar-tile"
      });
    }
  }

  async function loadRealtimeRadarFrames() {
    // Temporarily disable RainViewer animated frames because some areas return
    // "Zoom Level Not Supported" tiles. Keep stable radar tiles instead.
    return false;
  }

  function renderCurrentRadarFrame() {
    if (!rainRadarState.tileLayer || !rainRadarState.frameUrls.length) return;
    rainRadarState.tileLayer.setUrl(rainRadarState.frameUrls[rainRadarState.frameIndex]);
  }

  function stopRainRadarAnimation() {
    rainRadarState.active = false;

    if (rainRadarState.animationTimer) {
      clearInterval(rainRadarState.animationTimer);
      rainRadarState.animationTimer = null;
    }

    if (rainRadarState.refreshTimer) {
      clearInterval(rainRadarState.refreshTimer);
      rainRadarState.refreshTimer = null;
    }

  }

  async function startRainRadarAnimation() {
    rainRadarState.active = true;
    ensureRainRadarTileLayer();

    var loadedRealtime = await loadRealtimeRadarFrames();
    if (!loadedRealtime) {
      rainRadarState.fallbackMode = true;
      rainRadarState.frameUrls = [];
      if (rainRadarState.tileLayer) {
        rainRadarState.tileLayer.setUrl("https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=439d4b804bc8187953eb36d2a8c26a02");
      }
      return;
    }

    renderCurrentRadarFrame();

    if (rainRadarState.animationTimer) {
      clearInterval(rainRadarState.animationTimer);
    }
    rainRadarState.animationTimer = setInterval(function () {
      if (!rainRadarState.active || rainRadarState.fallbackMode || !rainRadarState.frameUrls.length) return;
      rainRadarState.frameIndex = (rainRadarState.frameIndex + 1) % rainRadarState.frameUrls.length;
      renderCurrentRadarFrame();
    }, 850);

    if (rainRadarState.refreshTimer) {
      clearInterval(rainRadarState.refreshTimer);
    }
    rainRadarState.refreshTimer = setInterval(async function () {
      if (!rainRadarState.active) return;
      var ok = await loadRealtimeRadarFrames();
      if (ok) {
        renderCurrentRadarFrame();
      }
    }, 5 * 60 * 1000);
  }

  function getWeatherCodeLabel(code) {
    var mapLabels = {
      0: "Clear",
      1: "Mainly Clear",
      2: "Partly Cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Fog",
      51: "Light Drizzle",
      53: "Drizzle",
      55: "Heavy Drizzle",
      61: "Light Rain",
      63: "Rain",
      65: "Heavy Rain",
      66: "Freezing Rain",
      67: "Heavy Freezing Rain",
      71: "Light Snow",
      73: "Snow",
      75: "Heavy Snow",
      80: "Rain Showers",
      81: "Rain Showers",
      82: "Violent Rain Showers",
      95: "Thunderstorm",
      96: "Thunderstorm with Hail",
      99: "Severe Thunderstorm"
    };
    return mapLabels[Number(code)] || "Live Conditions";
  }

  function getWeatherCacheKey(place) {
    var lat = Array.isArray(place.coords) ? Number(place.coords[0]).toFixed(4) : "0";
    var lon = Array.isArray(place.coords) ? Number(place.coords[1]).toFixed(4) : "0";
    return "k_" + lat + "_" + lon;
  }

  function normalizeRealtimeWeatherPayload(payload) {
    var current = payload && payload.current ? payload.current : {};
    var daily = payload && payload.daily ? payload.daily : {};
    return {
      conditionText: getWeatherCodeLabel(current.weather_code),
      observedAt: current.time || "",
      metricTemp: typeof current.temperature_2m === "number" ? current.temperature_2m : null,
      realFeel: typeof current.apparent_temperature === "number" ? current.apparent_temperature : null,
      humidity: typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
      wind: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
      uv: typeof current.uv_index === "number" ? current.uv_index : null,
      forecastRows: Array.isArray(daily.time) ? daily.time.slice(0, 5).map(function (dateText, index) {
        return {
          day: formatForecastDay(dateText, index),
          min: Array.isArray(daily.temperature_2m_min) && typeof daily.temperature_2m_min[index] === "number" ? Math.round(daily.temperature_2m_min[index]) : 0,
          max: Array.isArray(daily.temperature_2m_max) && typeof daily.temperature_2m_max[index] === "number" ? Math.round(daily.temperature_2m_max[index]) : 0,
          text: getWeatherCodeLabel(Array.isArray(daily.weather_code) ? daily.weather_code[index] : 0)
        };
      }) : []
    };
  }

  function renderForecastList(rows) {
    var listEl = document.getElementById("weatherForecastList");
    if (!listEl) return;
    if (!Array.isArray(rows) || !rows.length) {
      renderForecastError();
      return;
    }

    var minAll = rows.reduce(function (a, r) { return Math.min(a, r.min); }, rows[0].min);
    var maxAll = rows.reduce(function (a, r) { return Math.max(a, r.max); }, rows[0].max);
    var spread = Math.max(1, maxAll - minAll);

    listEl.innerHTML = rows.map(function (row) {
      var iconSvg = getWeatherSvg(getForecastIconType(row.text));
      var widthPct = Math.max(20, Math.round(((row.max - minAll) / spread) * 100));
      return '<div class="forecast-item"><span class="forecast-day">' + row.day + '</span><span class="weather-icon" aria-hidden="true">' + iconSvg + '</span><div class="forecast-minmax"><span>' + row.min + '°</span><div class="forecast-bar"><span style="width:' + widthPct + '%"></span></div><span>' + row.max + '°</span></div></div>';
    }).join("");
  }

  function renderForecastError() {
    var listEl = document.getElementById("weatherForecastList");
    if (listEl) {
      listEl.innerHTML = '<div class="forecast-item"><span class="forecast-day">No forecast</span><span class="weather-icon">' + getWeatherSvg("error") + '</span><div class="forecast-minmax"><span>--°</span><div class="forecast-bar"><span style="width:25%"></span></div><span>--°</span></div></div>';
    }
  }

  function clearSelectedWeatherMarker() {
    if (selectedPlaceWeatherMarker && map && map.hasLayer(selectedPlaceWeatherMarker)) {
      map.removeLayer(selectedPlaceWeatherMarker);
    }
    selectedPlaceWeatherMarker = null;
  }

  function syncSelectedWeatherMarker(place, conditionText, observedAt) {
    if (!map || !place || !Array.isArray(place.coords)) return;
    clearSelectedWeatherMarker();
    selectedPlaceWeatherMarker = L.marker(place.coords, {
      icon: L.divIcon({
        className: "selected-weather-marker-wrap",
        html: '<div class="selected-weather-marker">' + getWeatherSvg(getWeatherIconType(conditionText, observedAt)) + '</div>',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      })
    }).bindTooltip(place.name + ' • ' + conditionText, { direction: 'top', offset: [0, -22], className: 'city-label' }).addTo(map);
  }

  function buildWeatherPlaceIcon(weatherType, sizePx) {
    var size = Number(sizePx) || 34;
    var half = Math.round(size / 2);
    return L.divIcon({
      className: "hv-place-weather-icon-wrap",
      html: '<div class="hv-place-weather-icon">' + getWeatherSvg(weatherType || "cloud") + '</div>',
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -10]
    });
  }

  function renderWeather(placeName, weatherData, place) {
    var observation = weatherData && weatherData.observedAt ? new Date(weatherData.observedAt) : null;
    setTextIfExists("weatherCity", placeName);
    setTextIfExists("weatherUpdated", observation && !isNaN(observation.getTime()) ? "Updated " + observation.toLocaleString() : "Updated recently");
    var conditionText = weatherData && weatherData.conditionText ? weatherData.conditionText : "No weather description";
    var observedAt = weatherData && weatherData.observedAt ? weatherData.observedAt : "";
    setTextIfExists("weatherCondition", conditionText);
    var activeWeatherType = setWeatherIcon(conditionText, observedAt);
    setTextIfExists("weatherTemp", weatherData && weatherData.metricTemp !== null ? Math.round(weatherData.metricTemp) + "°C" : "--°C");
    setTextIfExists("weatherRealFeel", weatherData && weatherData.realFeel !== null ? Math.round(weatherData.realFeel) + "°C" : "--°C");
    setTextIfExists("weatherHumidity", weatherData && weatherData.humidity !== null ? Math.round(weatherData.humidity) + "%" : "--%");
    setTextIfExists("weatherWind", weatherData && weatherData.wind !== null ? Math.round(weatherData.wind) + " km/h" : "-- km/h");
    setTextIfExists("weatherUv", weatherData && weatherData.uv !== null ? String(Math.round(weatherData.uv)) : "--");
    rememberPlaceWeatherTheme(place, activeWeatherType);
    syncSelectedWeatherMarker(place, conditionText, observedAt);
    openWeatherPanel();
  }

  function applyPlaceWeatherIcon(place, conditionText, observedAt) {
    if (!place || !place._marker) return;
    if (place.type === "barangay") return;

    var weatherType = getWeatherIconType(conditionText, observedAt);
    place._marker.setIcon(buildWeatherPlaceIcon(weatherType, 34));
    rememberPlaceWeatherTheme(place, weatherType);
  }

  function renderWeatherError(placeName, message, place) {
    setTextIfExists("weatherCity", placeName);
    setTextIfExists("weatherUpdated", message);
    setTextIfExists("weatherCondition", "Unable to load weather");
    setWeatherIcon("error");
    setTextIfExists("weatherTemp", "--°C");
    setTextIfExists("weatherRealFeel", "--°C");
    setTextIfExists("weatherHumidity", "--%");
    setTextIfExists("weatherWind", "-- km/h");
    setTextIfExists("weatherUv", "--");
    if (place) clearSelectedWeatherMarker();
    renderForecastError();
    setWeatherPanelMode("details");
    openWeatherPanel();
  }

  function savePlaceWeatherToClientCache(place, payload) {
    if (!place || !Array.isArray(place.coords)) return;
    var cache = readWeatherClientCache();
    cache[getWeatherCacheKey(place)] = {
      timestamp: Date.now(),
      payload: payload
    };
    writeWeatherClientCache(cache);
  }

  function readPlaceWeatherFromClientCache(place) {
    if (!place) return null;
    var cache = readWeatherClientCache();
    return cache[getWeatherCacheKey(place)] || null;
  }

  function applyCachedWeather(place, cachedEntry) {
    if (!cachedEntry || !cachedEntry.payload) {
      return false;
    }
    var normalized = normalizeRealtimeWeatherPayload(cachedEntry.payload);
    renderWeather(place.name, normalized, place);
    if (Array.isArray(normalized.forecastRows) && normalized.forecastRows.length) {
      renderForecastList(normalized.forecastRows);
      setWeatherPanelMode("details");
    } else {
      renderForecastError();
    }
    setTextIfExists("weatherUpdated", "Cached weather data");
    return true;
  }

  function isPlaceClickCoolingDown(place) {
    var key = place.province + "|" + place.name;
    var now = Date.now();
    var lastAt = lastWeatherClickAtByPlace[key] || 0;
    if (now - lastAt < WEATHER_CLICK_COOLDOWN_MS) {
      return true;
    }
    lastWeatherClickAtByPlace[key] = now;
    return false;
  }

  async function fetchAndRenderPlaceWeather(place, options) {
    options = options || {};
    var panelMode = options.panelMode === "forecast" ? "forecast" : "details";

    if (!place || !Array.isArray(place.coords) || place.coords.length !== 2) {
      renderWeatherError("Selected place", "Missing coordinates for realtime weather.", place);
      return;
    }
    if (isPlaceClickCoolingDown(place)) {
      return;
    }

    setTextIfExists("weatherCity", place.name);
    setTextIfExists("weatherUpdated", "Loading realtime weather...");
    setTextIfExists("weatherCondition", "Fetching current conditions");
    setWeatherIcon("loading");
    setWeatherPanelMode(panelMode);
    openWeatherPanel();

    try {
      var response = await fetch(buildRealtimeWeatherUrl(place), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Request failed: " + response.status);
      }
      var payload = await response.json();
      var normalized = normalizeRealtimeWeatherPayload(payload);
      renderWeather(place.name, normalized, place);
      applyPlaceWeatherIcon(place, normalized.conditionText);
      if (normalized.forecastRows && normalized.forecastRows.length) {
        renderForecastList(normalized.forecastRows);
        setWeatherPanelMode(panelMode);
      } else {
        renderForecastError();
      }
      savePlaceWeatherToClientCache(place, payload);
      weatherCoverageState.lastSyncLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      cycleMeshNetwork();
    } catch (err) {
      var cached = readPlaceWeatherFromClientCache(place);
      if (applyCachedWeather(place, cached)) {
        return;
      }
      renderWeatherError(place.name, err && err.message ? err.message : "Could not fetch weather.", place);
    }
  }

  function getMarkerScaleByZoom(zoom) {
    if (zoom <= 7) return 0.55;
    if (zoom <= 8) return 0.7;
    if (zoom <= 9) return 0.85;
    if (zoom <= 10) return 1;
    if (zoom <= 11) return 1.15;
    return 1.3;
  }

  function updatePlaceMarkerScale() {
    if (!map || !placeMarkers.length) return;
    var scale = getMarkerScaleByZoom(map.getZoom());
    placeMarkers.forEach(function (marker) {
      var el = marker.getElement();
      if (!el) return;
      var icon = el.querySelector(".hv-place-marker");
      if (!icon) return;
      icon.style.transform = "scale(" + scale + ")";
      icon.style.transformOrigin = "center center";
    });
  }

  function clampMapValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function toDegrees(value) {
    return value * 180 / Math.PI;
  }

  function normalizeMapLongitude(value) {
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  }

  function getDayOfYearUtc(date) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 0);
    var now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor((now - start) / 86400000);
  }

  function crossVector(a, b) {
    return [
      (a[1] * b[2]) - (a[2] * b[1]),
      (a[2] * b[0]) - (a[0] * b[2]),
      (a[0] * b[1]) - (a[1] * b[0])
    ];
  }

  function normalizeVector(vector) {
    var magnitude = Math.sqrt((vector[0] * vector[0]) + (vector[1] * vector[1]) + (vector[2] * vector[2])) || 1;
    return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
  }

  function getSolarSubpoint(date) {
    var utcMinutes = (date.getUTCHours() * 60) + date.getUTCMinutes() + (date.getUTCSeconds() / 60);
    var gamma = (2 * Math.PI / 365) * (getDayOfYearUtc(date) - 1 + ((utcMinutes - 720) / 1440));
    var declination = 0.006918
      - (0.399912 * Math.cos(gamma))
      + (0.070257 * Math.sin(gamma))
      - (0.006758 * Math.cos(2 * gamma))
      + (0.000907 * Math.sin(2 * gamma))
      - (0.002697 * Math.cos(3 * gamma))
      + (0.00148 * Math.sin(3 * gamma));
    var equationOfTime = 229.18 * (
      0.000075
      + (0.001868 * Math.cos(gamma))
      - (0.032077 * Math.sin(gamma))
      - (0.014615 * Math.cos(2 * gamma))
      - (0.040849 * Math.sin(2 * gamma))
    );

    return {
      lat: toDegrees(declination),
      lon: normalizeMapLongitude((720 - utcMinutes - equationOfTime) / 4)
    };
  }

  function getSolarAltitude(lat, lon, solar) {
    var latRad = toRadians(lat);
    var solarLatRad = toRadians(solar.lat);
    var hourAngle = toRadians(normalizeMapLongitude(lon - solar.lon));
    return Math.asin(
      (Math.sin(latRad) * Math.sin(solarLatRad)) +
      (Math.cos(latRad) * Math.cos(solarLatRad) * Math.cos(hourAngle))
    );
  }

  function findTerminatorLatitude(lon, solar) {
    var low = -89.5;
    var high = 89.5;
    var lowAlt = getSolarAltitude(low, lon, solar);

    for (var i = 0; i < 20; i += 1) {
      var mid = (low + high) / 2;
      var midAlt = getSolarAltitude(mid, lon, solar);
      if ((lowAlt <= 0 && midAlt <= 0) || (lowAlt >= 0 && midAlt >= 0)) {
        low = mid;
        lowAlt = midAlt;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  function buildNightMaskPolygon(points, solar) {
    var poleLat = solar.lat >= 0 ? -89.5 : 89.5;
    return [[poleLat, -180]].concat(points).concat([[poleLat, 180]]);
  }

  function buildDayNightTerminator(date, sampleCount) {
    var solar = getSolarSubpoint(date);
    var total = Math.max(48, sampleCount || 180);
    var points = [];

    for (var i = 0; i <= total; i += 1) {
      var lon = -180 + ((360 * i) / total);
      var lat = findTerminatorLatitude(lon, solar);
      points.push([clampMapValue(lat, -85, 85), lon]);
    }

    return {
      solar: solar,
      points: points,
      nightPolygon: buildNightMaskPolygon(points, solar)
    };
  }

  function ensureDayNightCycleOverlay() {
    if (!map) return;

    var container = map.getContainer();
    if (!container) return;

    if (!dayNightState.overlayEl) {
      dayNightState.overlayEl = document.createElement("div");
      dayNightState.overlayEl.className = "map-daynight-overlay";
      dayNightState.overlayEl.setAttribute("aria-hidden", "true");
      container.appendChild(dayNightState.overlayEl);
    }

    if (!dayNightState.nightMask) {
      dayNightState.nightMask = L.polygon([], {
        pane: "dayNightPane",
        stroke: false,
        fillColor: "#081320",
        fillOpacity: 0.42,
        interactive: false,
        smoothFactor: 1,
        noClip: true,
        className: "hv-day-night-mask"
      }).addTo(map);
    }

    if (!dayNightState.terminatorLine) {
      dayNightState.terminatorLine = L.polyline([], {
        pane: "dayNightPane",
        color: "#ffd27c",
        weight: 2,
        opacity: 0.65,
        interactive: false,
        className: "hv-day-night-line",
        smoothFactor: 1.2,
        noClip: true
      }).addTo(map);
    }

    if (dayNightState.refreshTimer) {
      clearInterval(dayNightState.refreshTimer);
    }
    dayNightState.refreshTimer = window.setInterval(updateDayNightCycleOverlay, 60000);

    map.on("moveend zoomend resize", updateDayNightCycleOverlay);
    updateDayNightCycleOverlay();
  }

  function updateDayNightCycleOverlay() {
    if (!map) return;

    var model = buildDayNightTerminator(new Date(), dayNightState.sampleCount);
    var solarPoint = map.latLngToContainerPoint([model.solar.lat, model.solar.lon]);
    var viewCenter = map.getCenter();
    var solarAltitude = getSolarAltitude(viewCenter.lat, viewCenter.lng, model.solar);
    var overlayOpacity = solarAltitude >= 0
      ? clampMapValue(0.16 + ((1 - clampMapValue(solarAltitude / (Math.PI / 2), 0, 1)) * 0.14), 0.16, 0.30)
      : clampMapValue(0.38 + (clampMapValue(Math.abs(solarAltitude) / (Math.PI / 2), 0, 1) * 0.26), 0.38, 0.64);
    var container = map.getContainer();

    if (container && dayNightState.overlayEl) {
      container.style.setProperty("--hv-sun-x", solarPoint.x.toFixed(2) + "px");
      container.style.setProperty("--hv-sun-y", solarPoint.y.toFixed(2) + "px");
      container.style.setProperty("--hv-daynight-opacity", overlayOpacity.toFixed(2));
    }

    if (dayNightState.nightMask) {
      dayNightState.nightMask.setLatLngs(model.nightPolygon);
      dayNightState.nightMask.setStyle({ fillOpacity: overlayOpacity });
      if (typeof dayNightState.nightMask.bringToBack === "function") {
        dayNightState.nightMask.bringToBack();
      }
    }

    if (dayNightState.terminatorLine) {
      dayNightState.terminatorLine.setLatLngs(model.points);
      if (typeof dayNightState.terminatorLine.bringToFront === "function") {
        dayNightState.terminatorLine.bringToFront();
      }
    }
  }

  window.refreshDayNightCycleOverlay = updateDayNightCycleOverlay;

  function getMarkerGlyphSvg(type) {
    if (type === "flood") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 15c1.4 1.2 2.8 1.8 4.2 1.8S10 16.2 11.4 15c1.4 1.2 2.8 1.8 4.2 1.8s2.8-.6 4.4-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10c1.3 1.1 2.6 1.6 4 1.6s2.7-.5 4-1.6c1.3 1.1 2.6 1.6 4 1.6s2.7-.5 4-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (type === "fire") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.3 3c.9 2.7-.8 4.2-2 5.6-1.2 1.4-2.1 2.7-2.1 4.7 0 2.3 1.7 4.2 3.8 4.2 2.4 0 4.3-1.9 4.3-4.3 0-1.4-.7-2.6-1.8-3.9-.8-1-1.5-2.1-1.3-3.5 1.9 1.1 4.8 3.9 4.8 7.8A6 6 0 1 1 6 13.1C6 8.9 9.2 5.3 12.3 3Z" fill="currentColor"/></svg>';
    }
    if (type === "evac") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-4.5h-5V20H5a1 1 0 0 1-1-1v-7.5Z" fill="currentColor"/></svg>';
    }
    if (type === "road") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4h4l2 16h-4l-2-16Z" fill="currentColor" opacity=".9"/><path d="M8.5 10.5h7" stroke="#0a1220" stroke-width="2" stroke-linecap="round"/><path d="M9.2 15h5.6" stroke="#0a1220" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5a5.5 5.5 0 0 0-5.5 5.5c0 4.1 5.5 9.5 5.5 9.5s5.5-5.4 5.5-9.5A5.5 5.5 0 0 0 12 4.5Zm0 7.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" fill="currentColor"/></svg>';
  }

  function buildMapMarkerIcon(type, size) {
    var cls = type === "weather" ? "hv-place-marker" : "hv-hazard-marker " + type;
    var html = '<div class="' + cls + '">' + getMarkerGlyphSvg(type) + '</div>';
    return L.divIcon({
      className: type === "weather" ? "hv-place-marker-wrap" : "hv-hazard-marker-wrap",
      html: html,
      iconSize: size || (type === "weather" ? [26, 26] : [32, 32]),
      iconAnchor: type === "weather" ? [13, 13] : [16, 16],
      popupAnchor: [0, -12]
    });
  }

  async function addWesternVisayasPlaceMarkers() {
    if (!window.WEATHER_API) {
      showToast("Weather API catalog is not loaded.");
      return;
    }

    var places = buildWesternVisayasPlaces();
    var cache = readCoordCache();
    var markerBounds = [];
    var renderedCount = 0;
    var pendingPlaces = [];

    var placeIcon = buildMapMarkerIcon("weather", [26, 26]);

    function addPlaceMarker(place, coords) {
      place.coords = coords;
      var marker = L.marker(coords, { icon: placeIcon }).addTo(map);
      placeMarkers.push(marker);
      marker.bindTooltip(place.name, { permanent: false, direction: "top", offset: [0, -8], className: "city-label" });
      marker.on("click", (function (selectedPlace) {
        return function () {
          fetchAndRenderPlaceWeather(selectedPlace);
        };
      })(place));
      updatePlaceMarkerScale();
    }

    for (var i = 0; i < places.length; i += 1) {
      var place = places[i];
      var cacheKey = getPlaceCacheKey(place);
      var cachedCoords = Array.isArray(cache[cacheKey]) ? cache[cacheKey] : null;
      var fallbackCoords = Array.isArray(FALLBACK_CITY_COORDS[cacheKey]) ? FALLBACK_CITY_COORDS[cacheKey] : null;
      var immediateCoords = cachedCoords || fallbackCoords;

      if (immediateCoords) {
        renderedCount += 1;
        markerBounds.push(immediateCoords);
        addPlaceMarker(place, immediateCoords);
      } else {
        pendingPlaces.push(place);
      }
    }

    if (markerBounds.length && !userLocationAutoFocusState.requested && !userLocationAutoFocusState.completed) {
      map.fitBounds(markerBounds, { padding: [30, 30] });
    }

    weatherCoverageState.mappedCount = renderedCount;
    cycleMeshNetwork();
    showToast("Mapped " + renderedCount + " places. Resolving the rest...");

    async function runWorker() {
      while (pendingPlaces.length) {
        var nextPlace = pendingPlaces.shift();
        if (!nextPlace) return;
        var coords = await resolvePlaceCoords(nextPlace, cache);
        if (!coords) continue;
        renderedCount += 1;
        markerBounds.push(coords);
        addPlaceMarker(nextPlace, coords);
      }
    }

    var workers = [];
    var workerCount = Math.min(COORD_RESOLVE_CONCURRENCY, pendingPlaces.length);
    for (var w = 0; w < workerCount; w += 1) {
      workers.push(runWorker());
    }
    await Promise.all(workers);

    weatherCoverageState.mappedCount = renderedCount;
    cycleMeshNetwork();
    showToast("Mapped " + renderedCount + " Western Visayas cities/municipalities.");
  }

  function initMap() {
    if (map) return;

    if (typeof L === "undefined") {
      showToast("Map library is unavailable.");
      return;
    }

    var mapEl = document.getElementById("map");
    if (!mapEl) return;

    map = L.map("map").setView(DEFAULT_USER_LOCATION, 9);
    window.map = map;

    var baseMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    var weatherRadar = L.tileLayer("https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=439d4b804bc8187953eb36d2a8c26a02", {
      opacity: 0.52,
      className: "hv-rain-radar-tile",
      // Avoid unsupported zoom errors from radar providers by reusing native tiles at higher zoom.
      maxNativeZoom: 10,
      maxZoom: 18
    });
    rainRadarState.tileLayer = weatherRadar;

    var floodIcon = buildMapMarkerIcon("flood");
    var fireIcon = buildMapMarkerIcon("fire");
    var evacIcon = buildMapMarkerIcon("evac");
    var roadIcon = buildMapMarkerIcon("road");

    L.marker([10.7085, 122.9512], { icon: floodIcon }).addTo(map).bindPopup("Flood<br>Barangay Tangub");
    L.marker([10.6900, 122.9700], { icon: fireIcon }).addTo(map).bindPopup("Fire<br>Zone 2");
    EVACUATION_CENTERS.forEach(function (center) {
      L.marker(center.coords, { icon: evacIcon }).addTo(map).bindPopup("Evacuation<br>" + center.name + "<br>Capacity available: " + center.capacity + "%");
    });
    L.marker([10.6650, 122.9400], { icon: roadIcon }).addTo(map).bindPopup("Report<br>Road Block");

    addWesternVisayasPlaceMarkers();
    map.on("click", function (event) {
      if (!event || !event.latlng) return;
      fetchAndRenderPlaceWeather({
        name: "Selected point",
        province: "Western Visayas",
        coords: [event.latlng.lat, event.latlng.lng]
      });
    });
    map.on("zoomend", updatePlaceMarkerScale);

    var typhoonLayer = L.layerGroup();
    typhoonState.layer = typhoonLayer;

    // Keep the weather and typhoon overlays active without showing a floating Leaflet control box.
    weatherRadar.addTo(map);
    typhoonLayer.addTo(map);
    startRainRadarAnimation();

    window.refreshRainRadarOverlay = async function () {
      if (!rainRadarState.active) return;
      var ok = await loadRealtimeRadarFrames();
      if (ok) {
        renderCurrentRadarFrame();
        showToast("Rain radar updated to latest frame.");
      } else {
        showToast("Unable to fetch latest rain radar right now.");
      }
    };

    var savedRoute = getSavedRouteRecommendation();
    if (savedRoute && Array.isArray(savedRoute.userCoords) && Array.isArray(savedRoute.centerCoords)) {
      if (routeLine) map.removeLayer(routeLine);
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker(savedRoute.userCoords).addTo(map).bindPopup("Your location");
      routeLine = L.polyline([savedRoute.userCoords, savedRoute.centerCoords], { color: "green", weight: 5 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
    }
  }



  /* === HANDAVis functional map + safety circle upgrade === */
  var WESTERN_VISAYAS_PSGC_URL = "process/western_visayas_psgc.php";
  var SAFETY_CIRCLE_API_URL = "process/safety_circle_api.php";
  var EVAC_CENTERS_API_URL = "process/evacuation_centers_map.php";
  var placeMarkerLayer = null;
  var hazardMarkerLayer = null;
  var hazardMarkerEntries = [];
  var placeMarkerIndex = {};
  var mapFilterState = { active: "all" };
  var westernVisayasDatasetPromise = null;
  var westernVisayasDataset = null;
  var selectedBarangayMarker = null;
  var evacuationCenterLoadPromise = null;
  var phivolcsEarthquakeLoadPromise = null;
  var circleAlertPollTimer = null;
  var lastSeenCircleAlertId = Number(localStorage.getItem("handavisLastSeenCircleAlertId") || "0") || 0;
  var buildWesternVisayasPlacesFromWeatherApi = buildWesternVisayasPlaces;
  var DEMO_CIRCLE_MEMBERS = [];

  HAZARD_REPORTS = [
    {
      id: "hz-flood-1",
      type: "flood",
      name: "River Flooding",
      area: "Barangay Tangub, Bacolod",
      coords: [10.7085, 122.9512],
      severity: "High",
      floodHeight: "0.8 m to 1.3 m",
      affectedRange: "Approx. 1.9 km flood stretch",
      affectedAreas: "Tangub riverside puroks, low-lying homes near the creek, and access roads toward the barangay hall",
      note: "Water is still moving toward the downstream residential strip."
    },
    {
      id: "hz-fire-1",
      type: "fire",
      name: "Structural Fire",
      area: "Zone 2, Bacolod",
      coords: [10.6900, 122.9700],
      severity: "Critical",
      alertLevel: "3rd Alarm",
      affectedRange: "Approx. 300 m active heat/smoke zone",
      affectedAreas: "Warehouse row, adjacent homes, and the nearby roadside market strip",
      note: "Dense smoke reported downwind of the main fire block."
    },
    { id: "hz-road-1", type: "roadblock", name: "Road Block", area: "Main Highway, Bacolod", coords: [10.6650, 122.9400], severity: "Moderate" },
    { id: "hz-earthquake-1", type: "earthquake", name: "Earthquake Damage", area: "San Carlos City", coords: [10.4850, 123.4185], severity: "High", note: "Roadside structures and weak masonry walls are under inspection." },
    { id: "hz-landslide-1", type: "landslide", name: "Landslide", area: "Patnongon, Antique", coords: [10.9127, 121.9940], severity: "Moderate" },
    { id: "hz-medical-1", type: "medical", name: "Medical Emergency", area: "Iloilo City", coords: [10.7074, 122.5456], severity: "High" }
  ];

  function injectFunctionalMapStyles() {
    if (document.getElementById("hvFunctionalMapStyles")) return;
    var style = document.createElement("style");
    style.id = "hvFunctionalMapStyles";
    style.textContent = [
      '.hv-map-directory{padding:12px;width:min(320px,72vw);border-radius:18px;border:1px solid rgba(124,232,255,.20);background:rgba(7,19,32,.92);backdrop-filter:blur(10px);box-shadow:0 18px 38px rgba(0,0,0,.28);color:#eef7ff;}',
      '.hv-map-directory h4{margin:0 0 4px;font-size:.95rem;color:#f7fbff;}',
      '.hv-map-directory p{margin:0 0 10px;font-size:.68rem;line-height:1.45;color:#bcd3e8;}',
      '.hv-map-directory .hv-dir-grid{display:grid;gap:8px;}',
      '.hv-map-directory select,.hv-map-directory input{width:100%;min-height:40px;padding:10px 12px;border-radius:12px;border:1px solid rgba(160,215,255,.18);background:rgba(255,255,255,.05);color:#eef8ff;outline:none;}',
      '.hv-map-directory option{color:#102033;}',
      '.hv-map-directory .hv-dir-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:2px;}',
      '.hv-map-directory button{min-height:40px;border-radius:12px;border:1px solid rgba(160,215,255,.18);background:rgba(255,255,255,.06);color:#eef8ff;font-weight:800;cursor:pointer;}',
      '.hv-map-directory button:hover{background:rgba(124,232,255,.12);border-color:rgba(124,232,255,.35);}',
      '.hv-map-directory .hv-dir-meta{margin-top:8px;font-size:.66rem;color:#bcd3e8;line-height:1.45;}',
      '.hv-map-directory .hv-dir-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;background:rgba(124,232,255,.12);color:#9ff0ff;font-size:.64rem;font-weight:800;margin-bottom:8px;}',
      '.hv-circle-alert-chip{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 8px;border-radius:999px;background:rgba(255,77,87,.18);color:#ffb0b5;font-size:.66rem;font-weight:900;}',
      '.hv-hazard-marker.earthquake{box-shadow:0 0 0 6px rgba(168,85,247,.14), 0 10px 18px rgba(0,0,0,.25);}',
      '.hv-hazard-marker.earthquake svg{color:#d7a5ff;}',
      '.hv-hazard-marker.landslide{box-shadow:0 0 0 6px rgba(180,120,56,.14), 0 10px 18px rgba(0,0,0,.25);}',
      '.hv-hazard-marker.landslide svg{color:#d9ab72;}',
      '.hv-hazard-marker.medical{box-shadow:0 0 0 6px rgba(239,68,68,.14), 0 10px 18px rgba(0,0,0,.25);}',
      '.hv-hazard-marker.medical svg{color:#ff9a9a;}',
      '.hv-hazard-marker.roadblock{box-shadow:0 0 0 6px rgba(245,158,11,.14), 0 10px 18px rgba(0,0,0,.25);}',
      '.hv-hazard-marker.roadblock svg{color:#ffcd72;}',
      '.hv-hazard-marker.typhoon{box-shadow:0 0 0 6px rgba(56,189,248,.14), 0 10px 18px rgba(0,0,0,.25);}',
      '.hv-hazard-marker.typhoon svg{color:#8be2ff;}',
      '.hv-barangay-marker-wrap,.hv-user-pin-wrap{background:transparent;border:0;}',
      '.hv-barangay-marker,.hv-user-pin{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:3px solid rgba(255,255,255,.88);box-shadow:0 8px 18px rgba(0,0,0,.25);}',
      '.hv-barangay-marker{background:linear-gradient(135deg,#22c55e,#0f766e);}',
      '.hv-user-pin{background:linear-gradient(135deg,#7ce8ff,#3b82f6);}',
      '.hv-place-weather-icon-wrap{background:transparent;border:0;}',
      '.hv-place-weather-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid rgba(255,255,255,.78);background:rgba(10,28,50,.74);box-shadow:0 10px 20px rgba(0,0,0,.28);overflow:hidden;}',
      '.hv-eq-popup{min-width:min(290px,72vw);display:grid;gap:7px;}',
      '.hv-eq-popup-time{text-align:center;font-weight:900;color:#f8fcff;font-size:.84rem;padding-bottom:6px;border-bottom:1px solid rgba(159,216,255,.18);}',
      '.hv-eq-popup-line{font-size:.78rem;line-height:1.5;color:#e7f3ff;}',
      '.hv-eq-popup-line strong{color:#9fd8ff;font-weight:800;}',
      '.hv-eq-popup-note{font-size:.77rem;line-height:1.5;color:#dcecff;}',
      '.hv-eq-badge{display:inline-flex;align-items:center;justify-content:center;padding:3px 8px;border-radius:999px;font-size:.72rem;font-weight:900;color:#071521;vertical-align:middle;}',
      '.hv-eq-badge.mag-low{background:#93c5fd;}.hv-eq-badge.mag-moderate{background:#fde68a;}.hv-eq-badge.mag-high{background:#fdba74;}.hv-eq-badge.mag-critical{background:#fca5a5;}',
      '.hv-eq-badge.int-low{background:#bfdbfe;}.hv-eq-badge.int-moderate{background:#fde68a;}.hv-eq-badge.int-high{background:#fdba74;}.hv-eq-badge.int-critical{background:#fca5a5;}',
      '.hv-eq-inline-sep{opacity:.75;margin:0 5px;}',
      'body.light-mode .hv-place-weather-icon{background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(239,246,255,.96));border-color:rgba(86,122,165,.24);box-shadow:0 10px 22px rgba(61,92,133,.16);}',
      'body.light-mode .hv-place-weather-icon svg{color:#2b6ea7;}',
      'body.light-mode .hv-map-directory{background:rgba(252,254,255,.95);color:#163149;border-color:rgba(54,99,145,.14);box-shadow:0 16px 30px rgba(33,53,79,.12);}',
      'body.light-mode .hv-map-directory h4{color:#163149;}',
      'body.light-mode .hv-map-directory p,body.light-mode .hv-map-directory .hv-dir-meta{color:#5e7086;}',
      'body.light-mode .hv-map-directory select,body.light-mode .hv-map-directory input{background:rgba(244,248,252,.92);border-color:rgba(54,99,145,.14);color:#163149;}',
      'body.light-mode .hv-map-directory button{background:rgba(244,248,252,.92);border-color:rgba(54,99,145,.14);color:#163149;}'
    ].join("");
    document.head.appendChild(style);
  }

  function getCircleRelativeTime(value) {
    if (!value) return "Just now";
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    var diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diff < 45) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
    return Math.floor(diff / 86400) + " day ago";
  }

  function ensurePlaceMarkerLayer() {
    if (!map) return;
    if (!placeMarkerLayer) {
      placeMarkerLayer = L.layerGroup().addTo(map);
    }
  }

  function ensureHazardMarkerLayer() {
    if (!map) return;
    if (!hazardMarkerLayer) {
      hazardMarkerLayer = L.layerGroup().addTo(map);
    }
  }

  function clearPlaceMarkers() {
    if (placeMarkerLayer) placeMarkerLayer.clearLayers();
    placeMarkers = [];
    placeMarkerIndex = {};
  }

  function clearHazardMarkers() {
    if (hazardMarkerLayer) hazardMarkerLayer.clearLayers();
    hazardMarkerEntries = [];
  }

  function getMarkerGlyphSvg(type) {
    if (type === "flood") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 15c1.4 1.2 2.8 1.8 4.2 1.8S10 16.2 11.4 15c1.4 1.2 2.8 1.8 4.2 1.8s2.8-.6 4.4-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10c1.3 1.1 2.6 1.6 4 1.6s2.7-.5 4-1.6c1.3 1.1 2.6 1.6 4 1.6s2.7-.5 4-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (type === "fire") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.3 3c.9 2.7-.8 4.2-2 5.6-1.2 1.4-2.1 2.7-2.1 4.7 0 2.3 1.7 4.2 3.8 4.2 2.4 0 4.3-1.9 4.3-4.3 0-1.4-.7-2.6-1.8-3.9-.8-1-1.5-2.1-1.3-3.5 1.9 1.1 4.8 3.9 4.8 7.8A6 6 0 1 1 6 13.1C6 8.9 9.2 5.3 12.3 3Z" fill="currentColor"/></svg>';
    }
    if (type === "evac") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-4.5h-5V20H5a1 1 0 0 1-1-1v-7.5Z" fill="currentColor"/></svg>';
    }
    if (type === "road" || type === "roadblock") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4h4l2 16h-4l-2-16Z" fill="currentColor" opacity=".9"/><path d="M8.5 10.5h7" stroke="#0a1220" stroke-width="2" stroke-linecap="round"/><path d="M9.2 15h5.6" stroke="#0a1220" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    if (type === "earthquake") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 14h4l2.2-4.5 2.6 8 2.1-5 1.8 2.5H21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M8 20l1.5-2.2L11 20l1.6-3 1.4 3 1.8-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (type === "landslide") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 18 10 8l4 5 3-3 4 8H3Z" fill="currentColor"/><circle cx="8" cy="17" r="1.7" fill="#0a1220"/><circle cx="12" cy="19" r="1.4" fill="#0a1220"/></svg>';
    }
    if (type === "medical") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4h4v5h5v4h-5v5h-4v-5H5V9h5V4Z" fill="currentColor"/></svg>';
    }
    if (type === "typhoon") {
      return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4c2 0 3.5 1.2 3.5 3 0 1.4-.9 2.5-2.2 3 .5-.1 1-.2 1.5-.2 2.5 0 4.2 1.4 4.2 3.6 0 2.5-2 4.4-4.8 4.4-2 0-3.6-.9-4.3-2.3.1.4.1.8.1 1.2 0 2.2-1.6 3.8-3.9 3.8-2.4 0-4.1-1.6-4.1-3.9 0-2.7 2.1-4.7 5.2-4.7 1.5 0 2.7.4 3.6 1.1-.7-.8-1.1-1.8-1.1-3 0-2.1 1.5-4 4.1-5Z" fill="currentColor"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5a5.5 5.5 0 0 0-5.5 5.5c0 4.1 5.5 9.5 5.5 9.5s5.5-5.4 5.5-9.5A5.5 5.5 0 0 0 12 4.5Zm0 7.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" fill="currentColor"/></svg>';
  }

  function getPlaceTitle(place) {
    if (!place) return "Unknown place";
    var bits = [place.name];
    if (place.cityMunicipality && place.cityMunicipality !== place.name) bits.push(place.cityMunicipality);
    if (place.province && place.province !== place.name && place.province !== place.cityMunicipality) bits.push(place.province);
    return bits.join(", ");
  }

  function focusPlaceOnMap(coords, placeType) {
    if (!map || !Array.isArray(coords) || coords.length !== 2) return;
    var targetZoom = placeType === "barangay" ? 14 : 11;
    map.flyTo(coords, Math.max(targetZoom, map.getZoom()), { duration: 0.6 });
  }

  function buildPlaceQuery(place) {
    var bits = [];
    if (place.barangay && place.barangay !== place.name) bits.push(place.barangay);
    bits.push(place.name);
    if (place.cityMunicipality && place.cityMunicipality !== place.name) bits.push(place.cityMunicipality);
    if (place.province) bits.push(place.province);
    bits.push("Western Visayas", "Philippines");
    return bits.filter(Boolean).join(", ");
  }

  function normalizePlaceNameForMatch(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/^city of\s+/i, "")
      .replace(/^municipality of\s+/i, "")
      .replace(/\s+city$/i, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getFallbackCityCoords(place) {
    if (!place || place.barangay) return null;
    var province = String(place.province || "").trim();
    var sourceName = String(place.cityMunicipality || place.name || "").trim();
    if (!province || !sourceName) return null;

    var variants = [
      sourceName,
      sourceName.replace(/^City of\s+/i, "").trim(),
      sourceName.replace(/^Municipality of\s+/i, "").trim(),
      sourceName.replace(/\s+City$/i, "").trim()
    ];

    for (var i = 0; i < variants.length; i += 1) {
      var candidate = variants[i];
      var key = province + "|" + candidate;
      if (Array.isArray(FALLBACK_CITY_COORDS[key]) && FALLBACK_CITY_COORDS[key].length === 2) {
        return FALLBACK_CITY_COORDS[key];
      }
    }

    var normalizedSource = normalizePlaceNameForMatch(sourceName);
    var keys = Object.keys(FALLBACK_CITY_COORDS);
    for (var k = 0; k < keys.length; k += 1) {
      var keyParts = keys[k].split("|");
      if (keyParts.length !== 2) continue;
      if (normalizePlaceNameForMatch(keyParts[0]) !== normalizePlaceNameForMatch(province)) continue;
      if (normalizePlaceNameForMatch(keyParts[1]) === normalizedSource) {
        return FALLBACK_CITY_COORDS[keys[k]];
      }
    }

    return null;
  }

  async function fetchCoordsFromNominatim(place) {
    try {
      var query = buildPlaceQuery(place);
      var response = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=" + encodeURIComponent(query), {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) return null;
      var payload = await response.json();
      if (!Array.isArray(payload) || !payload.length) return null;
      var lat = Number(payload[0].lat);
      var lon = Number(payload[0].lon);
      if (!isFinite(lat) || !isFinite(lon)) return null;
      return [lat, lon];
    } catch (err) {
      return null;
    }
  }

  async function fetchCoordsFromOpenMeteoGeocoding(place) {
    try {
      var cityName = String(place.cityMunicipality || place.name || "").trim();
      if (!cityName) return null;

      var response = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=" + encodeURIComponent(cityName));
      if (!response.ok) return null;

      var payload = await response.json();
      var results = Array.isArray(payload && payload.results) ? payload.results : [];
      if (!results.length) return null;

      var targetProvince = normalizePlaceNameForMatch(place.province || "");
      var best = null;
      var bestScore = -1;

      results.forEach(function (row) {
        if (String(row.country_code || "").toUpperCase() !== "PH") return;
        var lat = Number(row.latitude);
        var lon = Number(row.longitude);
        if (!isFinite(lat) || !isFinite(lon)) return;

        var score = 1;
        var admin1 = normalizePlaceNameForMatch(row.admin1 || "");
        var admin2 = normalizePlaceNameForMatch(row.admin2 || "");
        if (targetProvince && (admin1.indexOf(targetProvince) >= 0 || admin2.indexOf(targetProvince) >= 0)) {
          score += 4;
        }

        if (!best || score > bestScore) {
          best = [lat, lon];
          bestScore = score;
        }
      });

      return best;
    } catch (err) {
      return null;
    }
  }

  async function fetchCoordsForPlace(place, cache) {
    var cacheKey = getPlaceCacheKey(place);
    var fallbackCoords = getFallbackCityCoords(place);
    if (!place.barangay && Array.isArray(fallbackCoords)) {
      cache[cacheKey] = fallbackCoords;
      writeCoordCache(cache);
      return fallbackCoords;
    }
    if (Array.isArray(cache[cacheKey]) && cache[cacheKey].length === 2) {
      return cache[cacheKey];
    }
    if (!place.barangay && place.locationKey) {
      var fromAccu = await fetchCoordsFromAccuWeather(place);
      if (fromAccu) {
        cache[cacheKey] = fromAccu;
        writeCoordCache(cache);
        return fromAccu;
      }
    }
    if (!place.barangay) {
      var fromOpenMeteo = await fetchCoordsFromOpenMeteoGeocoding(place);
      if (fromOpenMeteo) {
        cache[cacheKey] = fromOpenMeteo;
        writeCoordCache(cache);
        return fromOpenMeteo;
      }
    }
    var fromNominatim = await fetchCoordsFromNominatim(place);
    if (fromNominatim) {
      cache[cacheKey] = fromNominatim;
      writeCoordCache(cache);
      return fromNominatim;
    }
    return null;
  }

  function getPlaceCacheKey(place) {
    return [place.province || "", place.cityMunicipality || place.name || "", place.barangay || ""].join("|");
  }

  async function getWesternVisayasDataset() {
    if (westernVisayasDataset) return westernVisayasDataset;
    if (!westernVisayasDatasetPromise) {
      westernVisayasDatasetPromise = fetch(WESTERN_VISAYAS_PSGC_URL + "?action=bootstrap&t=" + Date.now(), { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then(function (payload) {
          if (!payload || !payload.ok) throw new Error(payload && payload.message ? payload.message : "Unable to load Region VI list.");
          westernVisayasDataset = payload;
          return payload;
        })
        .catch(function (err) {
          westernVisayasDatasetPromise = null;
          throw err;
        });
    }
    return westernVisayasDatasetPromise;
  }

  function createDirectoryControl(dataset) {
    if (!map || !dataset || document.getElementById("hvProvinceSelect")) return;
    injectFunctionalMapStyles();

    var control = L.control({ position: "topleft" });
    control.onAdd = function () {
      var wrap = L.DomUtil.create("div", "hv-map-directory");
      wrap.innerHTML = '' +
        '<span class="hv-dir-badge">Region VI Directory</span>' +
        '<h4>Find any city or barangay</h4>' +
        '<p>All Western Visayas provinces, cities / municipalities, and barangay names are loaded from PSGC.</p>' +
        '<div class="hv-dir-grid">' +
          '<select id="hvProvinceSelect"><option value="">Select province</option></select>' +
          '<select id="hvCitySelect" disabled><option value="">Select city / municipality</option></select>' +
          '<input id="hvBarangayInput" type="text" list="hvBarangayList" placeholder="Type a barangay name" disabled>' +
          '<datalist id="hvBarangayList"></datalist>' +
        '</div>' +
        '<div class="hv-dir-actions">' +
          '<button type="button" id="hvLocatePlaceBtn">Locate</button>' +
          '<button type="button" id="hvResetPlaceBtn">Reset</button>' +
        '</div>' +
        '<div class="hv-dir-meta" id="hvDirectoryMeta">' + escapeHtml(String(dataset.city_count || 0)) + ' cities / municipalities • ' + escapeHtml(String(dataset.barangay_count || 0)) + ' barangays loaded</div>';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);
      return wrap;
    };
    control.addTo(map);

    var provinceSelect = document.getElementById("hvProvinceSelect");
    var citySelect = document.getElementById("hvCitySelect");
    var barangayInput = document.getElementById("hvBarangayInput");
    var barangayList = document.getElementById("hvBarangayList");
    var locateBtn = document.getElementById("hvLocatePlaceBtn");
    var resetBtn = document.getElementById("hvResetPlaceBtn");

    function populateProvinces() {
      provinceSelect.innerHTML = '<option value="">Select province</option>' + (dataset.provinces || []).map(function (province) {
        return '<option value="' + escapeHtml(province.name) + '">' + escapeHtml(province.name) + '</option>';
      }).join("");
    }

    function getProvinceEntry(name) {
      return (dataset.provinces || []).filter(function (province) { return province.name === name; })[0] || null;
    }

    function populateCities(provinceName) {
      var province = getProvinceEntry(provinceName);
      citySelect.disabled = !province;
      citySelect.innerHTML = '<option value="">Select city / municipality</option>';
      barangayInput.disabled = true;
      barangayInput.value = "";
      barangayList.innerHTML = "";
      if (!province) return;
      var cities = province.cities || [];
      citySelect.innerHTML += cities.map(function (city) {
        return '<option value="' + escapeHtml(city.name) + '">' + escapeHtml(city.name) + '</option>';
      }).join("");
    }

    function populateBarangays(provinceName, cityName) {
      var province = getProvinceEntry(provinceName);
      var city = null;
      barangayInput.disabled = true;
      barangayInput.value = "";
      barangayList.innerHTML = "";
      if (!province) return;
      (province.cities || []).some(function (item) {
        if (item.name === cityName) {
          city = item;
          return true;
        }
        return false;
      });
      if (!city) return;
      barangayInput.disabled = false;
      barangayList.innerHTML = (city.barangays || []).map(function (barangay) {
        return '<option value="' + escapeHtml(barangay.name) + '"></option>';
      }).join("");
    }

    async function locateSelectedPlace() {
      var provinceName = provinceSelect.value;
      var cityName = citySelect.value;
      var barangayName = barangayInput.value.trim();

      if (!provinceName) {
        showToast("Select a province first.");
        return;
      }

      if (!cityName) {
        showToast("Select a city or municipality first.");
        return;
      }

      var cityKey = provinceName + "|" + cityName + "|";
      var cityMarker = placeMarkerIndex[cityKey];
      if (barangayName) {
        var place = {
          name: barangayName,
          barangay: barangayName,
          cityMunicipality: cityName,
          province: provinceName
        };
        var cache = readCoordCache();
        var coords = await fetchCoordsForPlace(place, cache);
        if (!coords) {
          showToast("Could not locate that barangay yet.");
          return;
        }

        if (selectedBarangayMarker && map.hasLayer(selectedBarangayMarker)) {
          map.removeLayer(selectedBarangayMarker);
        }

        selectedBarangayMarker = L.marker(coords, {
          icon: L.divIcon({
            className: "hv-barangay-marker-wrap",
            html: '<div class="hv-barangay-marker"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          }),
          zIndexOffset: 520
        }).addTo(map).bindPopup(
          "<strong>" + escapeHtml(barangayName) + "</strong><br>" +
          escapeHtml(cityName) + ", " + escapeHtml(provinceName)
        );

        map.setView(coords, 14);
        selectedBarangayMarker.openPopup();
        fetchAndRenderPlaceWeather({
          name: barangayName,
          barangay: barangayName,
          cityMunicipality: cityName,
          province: provinceName,
          coords: coords
        });
        showToast("Barangay located on the map.");
        return;
      }

      if (cityMarker) {
        map.setView(cityMarker.getLatLng(), Math.max(11, map.getZoom()));
        cityMarker.openTooltip();
        fetchAndRenderPlaceWeather({
          name: cityName,
          cityMunicipality: cityName,
          province: provinceName,
          coords: [cityMarker.getLatLng().lat, cityMarker.getLatLng().lng]
        }, { panelMode: "details" });
        showToast("City or municipality focused on the map.");
        return;
      }

      var cityCoords = await fetchCoordsForPlace({
        name: cityName,
        cityMunicipality: cityName,
        province: provinceName
      }, readCoordCache());

      if (!cityCoords) {
        showToast("Could not locate that city or municipality yet.");
        return;
      }

      map.setView(cityCoords, 11);
      fetchAndRenderPlaceWeather({
        name: cityName,
        cityMunicipality: cityName,
        province: provinceName,
        coords: cityCoords
      }, { panelMode: "details" });
    }

    if (provinceSelect) {
      provinceSelect.addEventListener("change", function () {
        populateCities(provinceSelect.value);
      });
    }

    if (citySelect) {
      citySelect.addEventListener("change", function () {
        populateBarangays(provinceSelect.value, citySelect.value);
      });
    }

    if (locateBtn) locateBtn.addEventListener("click", locateSelectedPlace);
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        provinceSelect.value = "";
        populateCities("");
        if (selectedBarangayMarker && map.hasLayer(selectedBarangayMarker)) {
          map.removeLayer(selectedBarangayMarker);
        }
        selectedBarangayMarker = null;
        showToast("Directory selection cleared.");
      });
    }

    populateProvinces();
  }

  function buildPlacesFromDataset(dataset) {
    var places = [];

    (dataset.provinces || []).forEach(function (province) {
      (province.cities || []).forEach(function (city) {
        var lat = Number(city.lat != null ? city.lat : city.latitude);
        var lng = Number(city.lng != null ? city.lng : city.longitude);
        places.push({
          name: city.name,
          cityMunicipality: city.name,
          province: province.name,
          type: city.type || "municipality",
          locationKey: city.locationKey || null,
          coords: (isFinite(lat) && isFinite(lng)) ? [lat, lng] : null
        });
      });
    });

    return places;
  }

  function getSafePlaceTooltip(place) {
    if (place.type === "city" || place.type === "municipality") {
      return place.name;
    }
    return getPlaceTitle(place);
  }

  async function primeCityWeatherIcons(places) {
    if (!Array.isArray(places) || !places.length) return;

    var queue = places.filter(function (place) {
      return place && place._marker && (place.type === "city" || place.type === "municipality") && Array.isArray(place.coords);
    }).slice();
    if (!queue.length) return;

    var concurrency = 3;

    async function worker() {
      while (queue.length) {
        var place = queue.shift();
        if (!place) continue;

        try {
          var cached = readPlaceWeatherFromClientCache(place);
          var cacheFresh = cached && cached.payload && cached.timestamp && (Date.now() - Number(cached.timestamp) < 30 * 60 * 1000);
          var payload = cacheFresh ? cached.payload : null;

          if (!payload) {
            var response = await fetch(buildRealtimeWeatherUrl(place), { cache: "no-store" });
            if (!response.ok) {
              continue;
            }
            payload = await response.json();
            savePlaceWeatherToClientCache(place, payload);
          }

          var normalized = normalizeRealtimeWeatherPayload(payload);
          if (normalized && normalized.conditionText) {
            applyPlaceWeatherIcon(place, normalized.conditionText, normalized.observedAt);
          }
        } catch (err) {
          // Skip failures silently to keep map responsive.
        }

        await new Promise(function (resolve) { setTimeout(resolve, 120); });
      }
    }

    var workers = [];
    for (var i = 0; i < Math.min(concurrency, queue.length); i += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  async function addWesternVisayasPlaceMarkers() {
    ensurePlaceMarkerLayer();
    clearPlaceMarkers();

    var places = [];
    var dataset = null;

    try {
      dataset = await getWesternVisayasDataset();
      places = buildPlacesFromDataset(dataset);
      createDirectoryControl(dataset);
    } catch (err) {
      places = buildWesternVisayasPlacesFromWeatherApi();
      showToast("Using fallback place list while PSGC directory is unavailable.");
    }

    var cache = readCoordCache();
    var markerBounds = [];
    var renderedCount = 0;
    var pendingPlaces = [];
    var renderedPlaces = [];

    function addPlaceMarker(place, coords) {
      place.coords = coords;
      var marker = L.marker(coords, { icon: buildWeatherPlaceIcon("cloud", 34) });
      place._marker = marker;
      marker.addTo(placeMarkerLayer);
      placeMarkers.push(marker);
      renderedPlaces.push(place);
      placeMarkerIndex[(place.province || "") + "|" + (place.cityMunicipality || place.name) + "|" + (place.barangay || "")] = marker;
      marker.bindTooltip(getSafePlaceTooltip(place), { permanent: false, direction: "top", offset: [0, -8], className: "city-label" });
      marker.on("click", (function (selectedPlace) {
        return function () {
          focusPlaceOnMap(selectedPlace.coords, selectedPlace.type);
          fetchAndRenderPlaceWeather(selectedPlace, {
            panelMode: "details"
          });
        };
      })(place));
      updatePlaceMarkerScale();
    }

    for (var i = 0; i < places.length; i += 1) {
      var place = places[i];
      var cacheKey = getPlaceCacheKey(place);
      var cachedCoords = Array.isArray(cache[cacheKey]) ? cache[cacheKey] : null;
      var fallbackCoords = getFallbackCityCoords(place);
      var immediateCoords = place.coords || fallbackCoords || cachedCoords;
      if (immediateCoords) {
        renderedCount += 1;
        markerBounds.push(immediateCoords);
        addPlaceMarker(place, immediateCoords);
      } else {
        pendingPlaces.push(place);
      }
    }

    if (markerBounds.length) {
      map.fitBounds(markerBounds, { padding: [30, 30] });
    }

    weatherCoverageState.mappedCount = renderedCount;
    cycleMeshNetwork();

    async function runWorker() {
      while (pendingPlaces.length) {
        var nextPlace = pendingPlaces.shift();
        if (!nextPlace) return;
        var coords = await fetchCoordsForPlace(nextPlace, cache);
        if (!coords) continue;
        renderedCount += 1;
        markerBounds.push(coords);
        addPlaceMarker(nextPlace, coords);
      }
    }

    var workers = [];
    var workerCount = Math.min(COORD_RESOLVE_CONCURRENCY, pendingPlaces.length);
    for (var w = 0; w < workerCount; w += 1) {
      workers.push(runWorker());
    }
    await Promise.all(workers);

    weatherCoverageState.mappedCount = renderedCount;
    weatherCoverageState.modeLabel = dataset ? "PSGC (Cities only)" : "Realtime";
    cycleMeshNetwork();
    primeCityWeatherIcons(renderedPlaces);
    showToast("Mapped " + renderedCount + " Western Visayas cities/municipalities.");
  }

  function getHazardIconType(type) {
    if (type === "road") return "roadblock";
    if (type === "evacuation" || type === "evacuation_center" || type === "evacuation-center") return "evac";
    return type;
  }

  function getEarthquakeMagnitudeClass(value) {
    var amount = Number(value);
    if (!isFinite(amount)) return 'mag-low';
    if (amount >= 6) return 'mag-critical';
    if (amount >= 5) return 'mag-high';
    if (amount >= 4) return 'mag-moderate';
    return 'mag-low';
  }

  function getEarthquakeIntensityValue(value) {
    var roman = String(value || '').toUpperCase().trim();
    var map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
    return map[roman] || 0;
  }

  function getEarthquakeIntensityClass(value) {
    var amount = getEarthquakeIntensityValue(value);
    if (amount >= 7) return 'int-critical';
    if (amount >= 5) return 'int-high';
    if (amount >= 3) return 'int-moderate';
    return 'int-low';
  }

  function getEarthquakeBadgeHtml(label, className) {
    return '<span class="hv-eq-badge ' + className + '">' + escapeHtml(label) + '</span>';
  }

  function getEarthquakeImpactMessage(report) {
    var damageExpected = !!report.damageExpected;
    var aftershocksExpected = !!report.aftershocksExpected;
    if (damageExpected && aftershocksExpected) return 'Damage and aftershocks are expected.';
    if (damageExpected) return 'Damage is expected.';
    if (aftershocksExpected) return 'Aftershocks are expected.';
    return '';
  }

  function getEarthquakeTsunamiMessage(report) {
    var tsunamiFlag = String(report.tsunami || 'No').toLowerCase();
    if (tsunamiFlag === 'yes') {
      if (report.tsunamiHeight) {
        return 'Tsunamis reaching ' + String(report.tsunamiHeight) + ' are expected to hit.';
      }
      return 'Tsunamis are expected to hit.';
    }
    return 'There is no tsunami warning due to this earthquake.';
  }

  function getHazardPopupHtml(report) {
    if (report.type === 'earthquake') {
      var magnitudeValue = isFinite(Number(report.magnitudeValue)) ? Number(report.magnitudeValue) : NaN;
      var highestIntensity = report.highestIntensity || report.intensity || 'Not stated';
      var impactMessage = getEarthquakeImpactMessage(report);
      var tsunamiMessage = getEarthquakeTsunamiMessage(report);
      var eqRows = [
        '<div class="hv-eq-popup">',
        '<div class="hv-eq-popup-time">' + escapeHtml(report.reportedAt || 'Recent PHIVOLCS bulletin') + '</div>',
        '<div class="hv-eq-popup-line"><strong>Epicenter</strong><br>' + escapeHtml(report.epicenter || report.area || 'Not stated') + '</div>',
        '<div class="hv-eq-popup-line"><strong>Depth</strong><br>' + escapeHtml(report.depth || 'Not stated') + '</div>',
        '<div class="hv-eq-popup-line"><strong>Magnitude:</strong> ' + getEarthquakeBadgeHtml(report.magnitude || 'Not stated', getEarthquakeMagnitudeClass(magnitudeValue)) + '<span class="hv-eq-inline-sep">|</span><strong>Intensity</strong> ' + getEarthquakeBadgeHtml(highestIntensity, getEarthquakeIntensityClass(highestIntensity)) + '</div>'
      ];

      if (impactMessage) {
        eqRows.push('<div class="hv-eq-popup-note">' + escapeHtml(impactMessage) + '</div>');
      }

      eqRows.push('<div class="hv-eq-popup-note">' + escapeHtml(tsunamiMessage) + '</div>');
      eqRows.push('</div>');
      return eqRows.join('');
    }

    var rows = [
      '<strong>' + escapeHtml(report.name || 'Hazard') + '</strong>',
      escapeHtml(report.area || 'Affected area'),
      'Severity: ' + escapeHtml(report.severity || 'Monitor')
    ];

    if (report.type === 'flood') {
      if (report.floodHeight) rows.push('Flood Height: ' + escapeHtml(report.floodHeight));
      if (report.affectedRange) rows.push('Flood Range: ' + escapeHtml(report.affectedRange));
      if (report.affectedAreas) rows.push('Affected Areas: ' + escapeHtml(report.affectedAreas));
    }

    if (report.type === 'fire') {
      if (report.alertLevel) rows.push('Fire Alarm Level: ' + escapeHtml(report.alertLevel));
      if (report.affectedRange) rows.push('Fire Range: ' + escapeHtml(report.affectedRange));
      if (report.affectedAreas) rows.push('Affected Areas: ' + escapeHtml(report.affectedAreas));
    }

    if (report.note) {
      rows.push('Note: ' + escapeHtml(report.note));
    }

    return rows.join('<br>');
  }

  function getEvacuationLocationText(center) {
    return [center.barangay || center.area || '', center.cityMunicipality || center.city || '', center.province || '']
      .filter(Boolean)
      .join(', ');
  }

  function getEvacuationCenterPopupHtml(center) {
    var rows = [
      '<strong>' + escapeHtml(center.name || 'Evacuation Center') + '</strong>',
      escapeHtml(getEvacuationLocationText(center) || 'Western Visayas'),
      escapeHtml(center.facilityType || 'Evacuation Center')
    ];

    if (center.priorityTier) rows.push('Priority Tier: ' + escapeHtml(center.priorityTier));
    if (center.hazardFocus) rows.push('Hazard Focus: ' + escapeHtml(center.hazardFocus));
    if (center.coordinateBasis) rows.push('Coordinate Basis: ' + escapeHtml(center.coordinateBasis));
    if (center.validationStatus) rows.push('Map Status: ' + escapeHtml(center.validationStatus));
    if (center.dataConfidence) rows.push('Data Confidence: ' + escapeHtml(center.dataConfidence));
    if (center.notes) rows.push('Notes: ' + escapeHtml(center.notes));
    if (center.sourceUrl) rows.push('<a href="' + escapeHtml(center.sourceUrl) + '" target="_blank" rel="noopener">View source reference</a>');
    if (center.mapsLink) rows.push('<a href="' + escapeHtml(center.mapsLink) + '" target="_blank" rel="noopener">Open in Google Maps</a>');

    return rows.join('<br>');
  }

  async function loadEvacuationCenters(forceRefresh) {
    if (evacuationCenterLoadPromise && !forceRefresh) {
      return evacuationCenterLoadPromise;
    }

    evacuationCenterLoadPromise = fetch(EVAC_CENTERS_API_URL + '?limit=350&t=' + Date.now(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !payload.ok || !Array.isArray(payload.centers)) {
          throw new Error(payload && payload.message ? payload.message : 'Could not load evacuation centers.');
        }

        EVACUATION_CENTERS = payload.centers
          .map(function (center, index) {
            return {
              id: center.id || ('ec-' + index),
              type: 'evac',
              name: center.name || 'Evacuation Center',
              area: getEvacuationLocationText(center),
              coords: Array.isArray(center.coords) ? center.coords : [Number(center.lat), Number(center.lng)],
              facilityType: center.facilityType || 'Evacuation Center',
              hazardFocus: center.hazardFocus || '',
              priorityTier: center.priorityTier || '',
              validationStatus: center.validationStatus || '',
              dataConfidence: center.dataConfidence || '',
              coordinateBasis: center.coordinateBasis || '',
              notes: center.notes || '',
              sourceUrl: center.sourceUrl || '',
              mapsLink: center.mapsLink || '',
              barangay: center.barangay || '',
              cityMunicipality: center.cityMunicipality || '',
              province: center.province || ''
            };
          })
          .filter(function (center) {
            return Array.isArray(center.coords) && isFinite(Number(center.coords[0])) && isFinite(Number(center.coords[1]));
          });

        renderHazardMarkers();
        if (forceRefresh) {
          showToast('Evacuation centers synced from the latest database table.');
        }
        return EVACUATION_CENTERS;
      })
      .catch(function () {
        renderHazardMarkers();
        if (forceRefresh) {
          showToast('Using the current evacuation center markers for now.');
        }
        return EVACUATION_CENTERS;
      });

    return evacuationCenterLoadPromise;
  }

  async function loadPhivolcsEarthquakes(forceRefresh) {
    if (phivolcsEarthquakeLoadPromise && !forceRefresh) {
      return phivolcsEarthquakeLoadPromise;
    }

    phivolcsEarthquakeLoadPromise = fetch(PHIVOLCS_EARTHQUAKE_FEED_URL + '?limit=30&t=' + Date.now(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !payload.ok || !Array.isArray(payload.earthquakes)) {
          throw new Error(payload && payload.message ? payload.message : 'Could not load PHIVOLCS earthquake records.');
        }

        var earthquakeReports = payload.earthquakes
          .map(function (quake, index) {
            var coords = Array.isArray(quake.coords) ? quake.coords : [Number(quake.lat), Number(quake.lng)];
            return {
              id: quake.id || ('phivolcs-eq-' + index),
              type: 'earthquake',
              name: quake.name || 'PHIVOLCS Earthquake',
              area: quake.area || quake.epicenter || 'Philippines',
              coords: coords,
              severity: quake.severity || 'Monitor',
              reportedAt: quake.reportedAt || '',
              epicenter: quake.epicenter || quake.area || '',
              depth: quake.depth || '',
              magnitude: quake.magnitude || '',
              magnitudeValue: quake.magnitudeValue,
              intensity: quake.intensity || 'Not stated',
              highestIntensity: quake.highestIntensity || quake.intensity || 'Not stated',
              intensityValue: quake.intensityValue || 0,
              damageExpected: !!quake.damageExpected,
              aftershocksExpected: !!quake.aftershocksExpected,
              tsunami: quake.tsunami || 'No',
              tsunamiHeight: quake.tsunamiHeight || null,
              origin: quake.origin || '',
              note: quake.note || '',
              source: quake.source || 'PHIVOLCS',
              sourceUrl: quake.sourceUrl || ''
            };
          })
          .filter(function (quake) {
            return Array.isArray(quake.coords) && isFinite(Number(quake.coords[0])) && isFinite(Number(quake.coords[1]));
          });

        HAZARD_REPORTS = HAZARD_REPORTS.filter(function (report) {
          return report.type !== 'earthquake';
        }).concat(earthquakeReports);

        renderHazardMarkers();
        if (forceRefresh) {
          showToast('Earthquake markers synced from PHIVOLCS.');
        }
        return earthquakeReports;
      })
      .catch(function () {
        renderHazardMarkers();
        if (forceRefresh) {
          showToast('Using the current earthquake markers for now.');
        }
        return HAZARD_REPORTS.filter(function (report) { return report.type === 'earthquake'; });
      });

    return phivolcsEarthquakeLoadPromise;
  }

  function renderHazardMarkers() {
    ensureHazardMarkerLayer();
    clearHazardMarkers();

    HAZARD_REPORTS.forEach(function (report) {
      var iconType = getHazardIconType(report.type);
      var marker = L.marker(report.coords, {
        icon: buildMapMarkerIcon(iconType, [32, 32]),
        zIndexOffset: 410
      }).bindPopup(getHazardPopupHtml(report));
      hazardMarkerEntries.push({ id: report.id, type: report.type, marker: marker });
    });

    (EVACUATION_CENTERS || []).forEach(function (center, index) {
      if (!Array.isArray(center.coords) || center.coords.length !== 2) return;
      var marker = L.marker(center.coords, {
        icon: buildMapMarkerIcon('evac', [32, 32]),
        zIndexOffset: 390
      }).bindPopup(getEvacuationCenterPopupHtml(center));
      hazardMarkerEntries.push({ id: center.id || ('evac-' + index), type: 'evac', marker: marker });
    });

    applyMapFilter(mapFilterState.active || 'all');
  }

  function applyMapFilter(type) {
    ensureHazardMarkerLayer();
    mapFilterState.active = type || 'all';

    var showWeatherLayer = mapFilterState.active === 'all' || mapFilterState.active === 'weather';
    if (placeMarkerLayer) {
      if (showWeatherLayer) {
        if (!map.hasLayer(placeMarkerLayer)) placeMarkerLayer.addTo(map);
      } else if (map.hasLayer(placeMarkerLayer)) {
        map.removeLayer(placeMarkerLayer);
      }
    }

    hazardMarkerEntries.forEach(function (entry) {
      var shouldShow = mapFilterState.active === 'all'
        || entry.type === mapFilterState.active
        || (mapFilterState.active === 'roadblock' && (entry.type === 'road' || entry.type === 'roadblock'));

      if (shouldShow) {
        if (!hazardMarkerLayer.hasLayer(entry.marker)) {
          entry.marker.addTo(hazardMarkerLayer);
        }
      } else if (hazardMarkerLayer.hasLayer(entry.marker)) {
        hazardMarkerLayer.removeLayer(entry.marker);
      }
    });

    if (typhoonState.layer) {
      if (mapFilterState.active === 'all' || mapFilterState.active === 'typhoon' || mapFilterState.active === 'weather') {
        if (!map.hasLayer(typhoonState.layer)) typhoonState.layer.addTo(map);
      } else if (map.hasLayer(typhoonState.layer)) {
        map.removeLayer(typhoonState.layer);
      }
    }
  }

  function setMapFilter(btn, type) {
    var labels = {
      all: 'All Types',
      weather: 'Weather',
      flood: 'Flood',
      typhoon: 'Typhoon',
      earthquake: 'Earthquake',
      fire: 'Fire',
      landslide: 'Landslide',
      medical: 'Medical',
      evac: 'Evacuation Centers'
    };

    document.querySelectorAll('.map-filter-tab').forEach(function (tab) {
      tab.classList.remove('mft-active');
    });
    if (btn && btn.classList) btn.classList.add('mft-active');
    applyMapFilter(type || 'all');
    showToast((type || 'all') === 'all' ? 'Showing all map layers.' : 'Filter applied: ' + (labels[type] || type) + '.');
  }

  async function refreshMap() {
    if (map && typeof map.invalidateSize === 'function') {
      map.invalidateSize();
    }
    updatePlaceMarkerScale();
    renderHazardMarkers();
    await Promise.all([
      loadEvacuationCenters(true),
      loadPhivolcsEarthquakes(true)
    ]);
    if (typeof window.refreshRainRadarOverlay === 'function') {
      window.refreshRainRadarOverlay();
    }
    refreshTyphoonTracker(true);
    if (typeof window.refreshDayNightCycleOverlay === 'function') {
      window.refreshDayNightCycleOverlay();
    }
    showToast('Map refreshed.');
  }

  window.setMapFilter = setMapFilter;
  window.refreshMap = refreshMap;

  function getMemberCoordsFromApiRow(member) {
    if (Array.isArray(member.coords) && member.coords.length === 2) return member.coords;
    var lat = Number(member.lat);
    var lng = Number(member.lng);
    if (isFinite(lat) && isFinite(lng)) return [lat, lng];
    return null;
  }

  function shapeMemberFromApi(member, index) {
    var coords = getMemberCoordsFromApiRow(member);
    return {
      id: String(member.user_id || member.id || ("member-" + index)),
      userId: Number(member.user_id || member.id || 0) || null,
      name: member.name || [member.first_name || "", member.last_name || ""].join(" ").trim() || ("Member " + (index + 1)),
      email: member.email || "",
      relation: member.relation || "Safety Circle member",
      coords: coords ? coords.slice() : null,
      status: member.status || "watch",
      battery: member.battery != null ? Number(member.battery) : null,
      updated: member.updated_label || getCircleRelativeTime(member.updated_at),
      note: member.note || (coords ? "Shared live location" : "Waiting for live location")
    };
  }

  function resetSafetyCircleLayerMarkers() {
    if (!safetyCircleState.layer) return;
    safetyCircleState.layer.clearLayers();
    safetyCircleState.markersById = {};

    safetyCircleState.members.forEach(function (member) {
      if (!Array.isArray(member.coords) || member.coords.length !== 2) return;

      var marker = L.marker(member.coords, {
        icon: getSafetyCircleMarkerIcon(member),
        zIndexOffset: 450
      });

      marker.bindPopup(getSafetyCircleMemberPopup(member));
      marker.on("click", function () {
        focusSafetyCircleMember(member.id);
      });

      safetyCircleState.layer.addLayer(marker);
      safetyCircleState.markersById[member.id] = marker;
    });
  }

  function applySafetyCirclePayload(payload) {
    if (payload && Array.isArray(payload.members)) {
      safetyCircleState.members = payload.members.map(shapeMemberFromApi);
    }

    if (payload && Array.isArray(payload.places)) {
      safetyCircleState.places = payload.places.map(function (place, index) {
        return {
          id: Number(place.id || index + 1) || (index + 1),
          label: place.label || ("Place " + (index + 1)),
          lat: Number(place.lat),
          lng: Number(place.lng),
          radiusMeters: Number(place.radius_meters || place.radiusMeters || 250) || 250,
          createdAt: place.created_at || "",
          createdLabel: place.created_label || getCircleRelativeTime(place.created_at)
        };
      });
    }

    if (payload && Array.isArray(payload.recent_activity)) {
      safetyCircleState.recentActivity = payload.recent_activity.map(function (item, index) {
        return {
          id: Number(item.id || index + 1) || (index + 1),
          title: item.title || "Safety Circle update",
          summary: item.summary || "",
          createdAt: item.created_at || "",
          createdLabel: item.created_label || getCircleRelativeTime(item.created_at),
          lat: item.lat != null ? Number(item.lat) : null,
          lng: item.lng != null ? Number(item.lng) : null
        };
      });
    }

    if (payload && payload.self && Array.isArray(payload.self.coords) && payload.self.coords.length === 2) {
      safetyCircleState.userCoords = payload.self.coords.slice();
      setSafetyCircleUserMarker(safetyCircleState.userCoords);
    } else if (!safetyCircleState.userLocationMarker) {
      setSafetyCircleUserMarker(safetyCircleState.userCoords);
    }

    if (payload && payload.self && payload.self.status) {
      var statusType = String(payload.self.status).toLowerCase();
      var statusLabel = statusType === "safe" ? "I'm Safe" : (statusType === "help" ? "Need Help" : (statusType === "sos" ? "SOS Active" : "Watch"));
      saveOwnSafetyStatus({
        type: statusType,
        label: statusLabel,
        timeLabel: getCircleRelativeTime(payload.self.updated_at),
        updatedAt: payload.self.updated_at || new Date().toISOString()
      });
    }

    if (payload && Number(payload.latest_alert_id || 0) > 0) {
      storeLastSeenCircleAlertId(payload.latest_alert_id);
    }

    ensureSafetyCircleLayer();
    resetSafetyCircleLayerMarkers();
    refreshSafetyCircleSummary();
    if (payload && payload.unread_alerts) {
      notifyIncomingCircleAlerts(payload.unread_alerts || []);
    }
    if (payload && payload.alerts) {
      notifyIncomingCircleAlerts(payload.alerts || []);
    }
  }

  function setSafetyCircleUserMarker(coords) {
    if (!map || !Array.isArray(coords) || coords.length !== 2) return;
    if (safetyCircleState.userLocationMarker && map.hasLayer(safetyCircleState.userLocationMarker)) {
      map.removeLayer(safetyCircleState.userLocationMarker);
    }
    safetyCircleState.userLocationMarker = L.marker(coords, {
      icon: L.divIcon({
        className: "hv-user-pin-wrap",
        html: '<div class="hv-user-pin"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      zIndexOffset: 520
    });
    if (safetyCircleState.panelOpen) {
      safetyCircleState.userLocationMarker.addTo(map);
    }
  }

  function ensureBrowserLocation() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("Browser location is unavailable."));
        return;
      }
      navigator.geolocation.getCurrentPosition(function (position) {
        resolve([position.coords.latitude, position.coords.longitude]);
      }, function (error) {
        reject(error || new Error("Could not get current location."));
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 120000
      });
    });
  }

  async function useBrowserLocationForSafetyCircle() {
	  userLocationAutoFocusState.requested = true;
	  
    try {
      var coords = await ensureBrowserLocation();
      safetyCircleState.userCoords = coords;
      safetyCircleState.lastSyncLabel = "Live";
      setSafetyCircleText("circleSyncText", "Live");
      setSafetyCircleUserMarker(coords);
      if (safetyCircleState.panelOpen && safetyCircleState.userLocationMarker && !map.hasLayer(safetyCircleState.userLocationMarker)) {
        safetyCircleState.userLocationMarker.addTo(map);
      }
      if (map) {
        map.flyTo(coords, Math.max(15, map.getZoom()), { duration: 0.8 });
      }
	  userLocationAutoFocusState.completed = true;
      showToast("Current location synced for Safety Circle.");
    } catch (err) {
      showToast("Could not get your current location. Using Bacolod fallback.");
    }
  }

  function setSafetyCircleMarkersVisible(isVisible) {
    ensureSafetyCircleLayer();
    if (!map || !safetyCircleState.layer) return;

    if (isVisible) {
      if (!map.hasLayer(safetyCircleState.layer)) {
        safetyCircleState.layer.addTo(map);
      }
      if (safetyCircleState.userLocationMarker && !map.hasLayer(safetyCircleState.userLocationMarker)) {
        safetyCircleState.userLocationMarker.addTo(map);
      }
      return;
    }

    if (map.hasLayer(safetyCircleState.layer)) {
      map.removeLayer(safetyCircleState.layer);
    }
    if (safetyCircleState.userLocationMarker && map.hasLayer(safetyCircleState.userLocationMarker)) {
      map.removeLayer(safetyCircleState.userLocationMarker);
    }
  }

  function ensureNotificationPermission() {
    if (!("Notification" in window)) return Promise.resolve("unsupported");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return Notification.requestPermission();
  }

  function storeLastSeenCircleAlertId(alertId) {
    if (!alertId) return;
    lastSeenCircleAlertId = Math.max(lastSeenCircleAlertId, Number(alertId) || 0);
    try {
      localStorage.setItem("handavisLastSeenCircleAlertId", String(lastSeenCircleAlertId));
    } catch (err) {}
  }

  function notifyIncomingCircleAlerts(alerts) {
    if (!Array.isArray(alerts) || !alerts.length) return;
    alerts.forEach(function (alert) {
      storeLastSeenCircleAlertId(alert.id);
      var alertType = String(alert.alert_type || "").toLowerCase();
      var title = alert.sender_name ? alert.sender_name + " triggered " + String(alert.alert_type || "an alert").toUpperCase() : "Safety Circle alert";
      var body = alert.message || "Open your Safety Circle panel to review the alert.";

      if (alertType === "ping" && body) {
        title = alert.sender_name ? (alert.sender_name + ": " + body) : body;
      }

      showToast(title);
      ensureNotificationPermission().then(function (result) {
        if (result === "granted") {
          try {
            new Notification(title, { body: body });
          } catch (err) {}
        }
      });
    });
  }

  async function bootstrapSafetyCircleFromApi() {
    try {
      var response = await fetch(SAFETY_CIRCLE_API_URL + "?action=bootstrap&t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      if (!payload || !payload.ok) throw new Error(payload && payload.message ? payload.message : "Safety Circle bootstrap failed.");

      applySafetyCirclePayload(payload);
    } catch (err) {
      safetyCircleState.members = [];
      setSafetyCircleUserMarker(safetyCircleState.userCoords);
      ensureSafetyCircleLayer();
      resetSafetyCircleLayerMarkers();
      refreshSafetyCircleSummary();
      showToast("Safety Circle API unavailable. Check your login session and database setup.");
    }
  }

  async function postSafetyCircleAction(action, data) {
    var response = await fetch(SAFETY_CIRCLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, data || {}))
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    var payload = await response.json();
    if (!payload || !payload.ok) throw new Error(payload && payload.message ? payload.message : "Safety Circle request failed.");
    return payload;
  }

  async function setOwnSafetyStatus(type) {
    var coords = safetyCircleState.userCoords;
    try {
      coords = await ensureBrowserLocation();
      safetyCircleState.userCoords = coords;
      setSafetyCircleUserMarker(coords);
    } catch (err) {}

    var label = type === "safe" ? "I'm Safe" : (type === "help" ? "Need Help" : "SOS Active");
    var nowIso = new Date().toISOString();

    try {
      var payload = await postSafetyCircleAction("set-status", {
        status: type,
        lat: coords[0],
        lng: coords[1]
      });

      applySafetyCirclePayload(payload);
      saveOwnSafetyStatus({
        type: type,
        label: label,
        timeLabel: getCircleRelativeTime(payload.self && payload.self.updated_at ? payload.self.updated_at : nowIso),
        updatedAt: payload.self && payload.self.updated_at ? payload.self.updated_at : nowIso
      });
      updateOwnSafetyStatusUI();
      refreshSafetyCircleSummary();

      if (type === "sos") {
        showToast("SOS sent to your Safety Circle members.");
      } else if (type === "help") {
        showToast("Need Help was sent to your Safety Circle members.");
      } else {
        showToast("Your Safety Circle was updated: I'm Safe.");
      }
    } catch (err) {
      saveOwnSafetyStatus({
        type: type,
        label: label,
        timeLabel: getCircleRelativeTime(nowIso),
        updatedAt: nowIso
      });
      updateOwnSafetyStatusUI();
      refreshSafetyCircleSummary();
      if (type === "sos") {
        showToast("SOS saved locally. Finish the API setup to notify other members.");
      } else if (type === "help") {
        showToast("Need Help saved locally. Finish the API setup to notify other members.");
      } else {
        showToast("Your Safety Circle was updated locally.");
      }
    }
  }

  async function syncOwnLocationSilently() {
    var current = readOwnSafetyStatus() || {};
    var statusType = current.type || "watch";

    try {
      var coords = await ensureBrowserLocation();
      safetyCircleState.userCoords = coords;
      setSafetyCircleUserMarker(coords);

      var payload = await postSafetyCircleAction("set-status", {
        status: statusType,
        lat: coords[0],
        lng: coords[1]
      });

      applySafetyCirclePayload(payload);
      safetyCircleState.lastSyncLabel = "Live";
      setSafetyCircleText("circleSyncText", "Live");
    } catch (err) {
      // Silent sync should not spam users with toast errors.
    }
  }

  async function pingSafetyCircleMember(memberId) {
    var member = getSafetyCircleMemberById(memberId);
    if (!member) return;
    highlightSafetyCircleMember(memberId);

    try {
      await postSafetyCircleAction("ping-member", { member_user_id: member.userId || Number(member.id) || 0 });
      showToast("Ping sent to " + member.name + ".");
    } catch (err) {
      showToast("Ping saved locally. Finish the API setup to notify " + member.name + ".");
    }
  }

  async function pollSafetyCircleAlerts() {
    try {
      var response = await fetch(SAFETY_CIRCLE_API_URL + "?action=poll&since_id=" + encodeURIComponent(lastSeenCircleAlertId) + "&t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      var payload = await response.json();
      if (!payload || !payload.ok) return;
      applySafetyCirclePayload(payload);
    } catch (err) {}
  }

  function routeToSafetyCircleMember(memberId) {
    var member = getSafetyCircleMemberById(memberId);
    if (!member || !map) return;

    highlightSafetyCircleMember(memberId);
    if (!Array.isArray(member.coords) || member.coords.length !== 2) {
      showToast(member.name + " has not shared live location yet.");
      return;
    }

    clearSafetyCircleRoute();

    if (!safetyCircleState.userLocationMarker) {
      setSafetyCircleUserMarker(safetyCircleState.userCoords);
    }

    if (safetyCircleState.userLocationMarker && !map.hasLayer(safetyCircleState.userLocationMarker)) {
      safetyCircleState.userLocationMarker.addTo(map);
    }

    safetyCircleState.routeLine = L.polyline([safetyCircleState.userCoords, member.coords], {
      color: "#7ce8ff",
      weight: 4,
      opacity: 0.95,
      dashArray: "10 10"
    }).addTo(map);

    map.fitBounds(safetyCircleState.routeLine.getBounds(), { padding: [54, 54] });
    showToast("Route preview ready for " + member.name + ".");
  }

  function fitSafetyCircleMembers() {
    ensureSafetyCircleLayer();
    if (!map || !safetyCircleState.members.length) return;

    var bounds = safetyCircleState.members
      .map(function (member) { return member.coords; })
      .filter(function (coords) { return Array.isArray(coords) && coords.length === 2; });

    if (Array.isArray(safetyCircleState.userCoords) && safetyCircleState.userCoords.length === 2) {
      bounds.push(safetyCircleState.userCoords);
    }

    if (!bounds.length) {
      showToast("No live member locations are available yet.");
      return;
    }

    map.fitBounds(bounds, { padding: [54, 54] });
  }

  function cycleMeshNetwork() {
    setTextIfExists("weatherCoverageCount", String(weatherCoverageState.mappedCount || 0));
    setTextIfExists("weatherCoverageMode", weatherCoverageState.modeLabel || "Realtime");
    setTextIfExists("lastWeatherSyncCard", weatherCoverageState.lastSyncLabel || "--");
    updateOwnSafetyStatusUI();
    setTextIfExists(
      "meshStatusText",
      "All Western Visayas cities and barangays are plotted on the map, and every marker click pulls realtime weather automatically."
    );
  }

  function initMap() {
    if (map) return;

    if (typeof L === "undefined") {
      showToast("Map library is unavailable.");
      return;
    }

    var mapEl = document.getElementById("map");
    if (!mapEl) return;

    injectFunctionalMapStyles();

    map = L.map("map").setView(DEFAULT_USER_LOCATION, 9);
    window.map = map;

    if (!map.getPane("dayNightPane")) {
      map.createPane("dayNightPane");
      map.getPane("dayNightPane").style.zIndex = 350;
      map.getPane("dayNightPane").style.pointerEvents = "none";
    }

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    var weatherRadar = L.tileLayer("https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=439d4b804bc8187953eb36d2a8c26a02", {
      opacity: 0.52,
      className: "hv-rain-radar-tile",
      maxNativeZoom: 10,
      maxZoom: 18
    });
    rainRadarState.tileLayer = weatherRadar;

    ensurePlaceMarkerLayer();
    ensureHazardMarkerLayer();
    renderHazardMarkers();
    loadEvacuationCenters(false);
    loadPhivolcsEarthquakes(false);
    addWesternVisayasPlaceMarkers();

    map.on("click", function (event) {
      if (!event || !event.latlng) return;
      fetchAndRenderPlaceWeather({
        name: "Selected point",
        province: "Western Visayas",
        coords: [event.latlng.lat, event.latlng.lng]
      });
    });
    map.on("zoomend", updatePlaceMarkerScale);

    var typhoonLayer = L.layerGroup();
    typhoonState.layer = typhoonLayer;
    weatherRadar.addTo(map);
    typhoonLayer.addTo(map);
    ensureDayNightCycleOverlay();
    startRainRadarAnimation();

    window.refreshRainRadarOverlay = async function () {
      if (!rainRadarState.active) return;
      var ok = await loadRealtimeRadarFrames();
      if (ok) {
        renderCurrentRadarFrame();
        showToast("Rain radar updated to latest frame.");
      } else {
        showToast("Unable to fetch latest rain radar right now.");
      }
    };

    var savedRoute = getSavedRouteRecommendation();
    if (savedRoute && Array.isArray(savedRoute.userCoords) && Array.isArray(savedRoute.centerCoords)) {
      if (routeLine) map.removeLayer(routeLine);
      userMarker = L.marker(savedRoute.userCoords).addTo(map).bindPopup("Your location");
      routeLine = L.polyline([savedRoute.userCoords, savedRoute.centerCoords], { color: "green", weight: 5 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.loadTheme === "function") {
      window.loadTheme();
    }

    var closeBtn = document.getElementById("weatherClose");
    if (closeBtn) closeBtn.addEventListener("click", toggleWeatherPanel);

    var circleFab = document.getElementById("circleFab");
    if (circleFab) {
      circleFab.addEventListener("click", toggleSafetyCirclePanel);
    }

    var circleCloseBtn = document.getElementById("circlePanelClose");
    if (circleCloseBtn) {
      circleCloseBtn.addEventListener("click", closeSafetyCirclePanel);
    }

    var circleLocateBtn = document.getElementById("circleLocateBtn");
    if (circleLocateBtn) {
      circleLocateBtn.addEventListener("click", useBrowserLocationForSafetyCircle);
    }

    var circleSearchBtn = document.getElementById("circleSearchMemberBtn");
    if (circleSearchBtn) {
      circleSearchBtn.addEventListener("click", searchSafetyCircleUsers);
    }

    var circleSearchInput = document.getElementById("circleMemberSearchInput");
    if (circleSearchInput) {
      circleSearchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          searchSafetyCircleUsers();
        }
      });
    }

    var circleRelationInput = document.getElementById("circleMemberRelationInput");
    if (circleRelationInput) {
      circleRelationInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (Array.isArray(safetyCircleState.memberSearchResults) && safetyCircleState.memberSearchResults.length) {
            var firstAvailable = safetyCircleState.memberSearchResults.find(function (entry) {
              return !entry.is_connected;
            });
            if (firstAvailable) {
              addMemberToSafetyCircle(firstAvailable.user_id, firstAvailable.name || "User");
              return;
            }
          }
          searchSafetyCircleUsers();
        }
      });
    }

    var circleSavePlaceBtn = document.getElementById("circleSavePlaceBtn");
    if (circleSavePlaceBtn) {
      circleSavePlaceBtn.addEventListener("click", saveCurrentLocationAsCirclePlace);
    }

    var circlePlaceLabelInput = document.getElementById("circlePlaceLabelInput");
    if (circlePlaceLabelInput) {
      circlePlaceLabelInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          saveCurrentLocationAsCirclePlace();
        }
      });
    }

    var circlePlaceRadiusInput = document.getElementById("circlePlaceRadiusInput");
    if (circlePlaceRadiusInput) {
      circlePlaceRadiusInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          saveCurrentLocationAsCirclePlace();
        }
      });
    }

    var circleSafeBtn = document.getElementById("circleSafeBtn");
    if (circleSafeBtn) {
      circleSafeBtn.addEventListener("click", function () { setOwnSafetyStatus("safe"); });
    }

    var circleHelpBtn = document.getElementById("circleHelpBtn");
    if (circleHelpBtn) {
      circleHelpBtn.addEventListener("click", function () { setOwnSafetyStatus("help"); });
    }

    var circleSosBtn = document.getElementById("circleSosBtn");
    if (circleSosBtn) {
      circleSosBtn.addEventListener("click", function () { setOwnSafetyStatus("sos"); });
    }

    var circleFitAllBtn = document.getElementById("circleFitAllBtn");
    if (circleFitAllBtn) {
      circleFitAllBtn.addEventListener("click", fitSafetyCircleMembers);
    }

    var circleClearRouteBtn = document.getElementById("circleClearRouteBtn");
    if (circleClearRouteBtn) {
      circleClearRouteBtn.addEventListener("click", clearSafetyCircleRoute);
    }

    var reopenBtn = document.getElementById("weatherReopenBtn");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", function () {
        openWeatherPanel({ mode: "details" });
      });
    }

    var modeBtn = document.getElementById("weatherModeToggle");
    if (modeBtn) {
      modeBtn.addEventListener("click", function () {
        setWeatherPanelMode(weatherPanelMode === "details" ? "forecast" : "details");
      });
    }

    setWeatherPanelMode("details");
    syncWeatherPanelButtons();
    updateOwnSafetyStatusUI();
    refreshWeatherFilterAppearance();
    renderSafetyCircleMemberSearchResults();
    renderSafetyCirclePlaceList();
    renderSafetyCircleActivityList();
    initMap();
    renderSafetyCirclePanel();
    fetchAndRenderPlaceWeather({ name: "Bacolod", province: "Negros Occidental", coords: [10.6765, 122.9509] });
    useBrowserLocationForSafetyCircle();
    bootstrapSafetyCircleFromApi();
    syncOwnLocationSilently();
    ensureNotificationPermission();
    circleAlertPollTimer = setInterval(pollSafetyCircleAlerts, 15000);
    setInterval(syncOwnLocationSilently, 60000);

    setTimeout(function () {
      if (map && typeof map.invalidateSize === "function") {
        map.invalidateSize();
      }
    }, 250);

    cycleConfidence();
    cycleMeshNetwork();
    refreshTyphoonTracker(false);

    setInterval(cycleConfidence, 5000);
    setInterval(cycleMeshNetwork, 6000);
    typhoonState.refreshTimer = setInterval(function () { refreshTyphoonTracker(false); }, 5 * 60 * 1000);
  });
})();
