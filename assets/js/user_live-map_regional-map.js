(function () {
  var map = null;
  var routeLine = null;
  var userMarker = null;
  var placeMarkers = [];
  var weatherPanelMode = "details";
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

  var TYPHOON_FEED_URL = "process/typhoon_live_feed.php";

  var DEFAULT_USER_LOCATION = [10.6765, 122.9509];
  var EVACUATION_CENTERS = [
    { name: "Taculing Gymnasium", coords: [10.6760, 122.9398], capacity: 45 },
    { name: "Mandalagan Covered Court", coords: [10.6898, 122.9562], capacity: 62 },
    { name: "Barangay 30 Multi-Purpose Hall", coords: [10.6712, 122.9625], capacity: 58 },
  ];

  var HAZARD_REPORTS = [
    { id: "hz-flood-1", type: "flood", name: "Flood", area: "Barangay Tangub", coords: [10.7085, 122.9512] },
    { id: "hz-fire-1", type: "fire", name: "Fire", area: "Zone 2", coords: [10.6900, 122.9700] },
    { id: "hz-road-1", type: "road", name: "Road Block", area: "Main Road", coords: [10.6650, 122.9400] },
    { id: "hz-offline-1", type: "signal", name: "Offline Ready", area: "Cached Alert Area", coords: [10.6550, 122.9250] }
  ];

  var safetyCircleState = {
    panelOpen: false,
    layer: null,
    markersById: {},
    routeLine: null,
    userLocationMarker: null,
    userCoords: DEFAULT_USER_LOCATION.slice(),
    members: [
      {
        id: "mama",
        name: "Mama",
        relation: "Primary contact",
        coords: [10.6814, 122.9468],
        status: "safe",
        battery: 88,
        updated: "2 min ago",
        note: "Near home"
      },
      {
        id: "kyle",
        name: "Kyle",
        relation: "On the road",
        coords: [10.6942, 122.9589],
        status: "moving",
        battery: 63,
        updated: "Just now",
        note: "Heading north"
      },
      {
        id: "lola",
        name: "Lola",
        relation: "Priority contact",
        coords: [10.7051, 122.9527],
        status: "watch",
        battery: 41,
        updated: "4 min ago",
        note: "Close to reported flood"
      }
    ],
    lastSyncLabel: "Just now"
  };

  var WESTERN_VISAYAS_PROVINCES = ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"];
  var PLACE_COORD_CACHE_KEY = "handavisWesternVisayasPlaceCoords";
  var COORD_RESOLVE_CONCURRENCY = 8;
  var WEATHER_PROXY_URL = "process/weather_proxy.php";
  // Client-side weather cache and click cooldown to reduce API calls and avoid quota spikes haysss
  var WEATHER_CLIENT_CACHE_KEY = "handavisWeatherClientCacheV1";
  var WEATHER_CLICK_COOLDOWN_MS = 2500;
  var lastWeatherClickAtByPlace = {};

  var FALLBACK_CITY_COORDS = {
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


  var DEMO_RAIN_AREAS = [
    { name: "Iloilo Gulf Corridor", coords: [10.73, 122.56], weatherType: "rain" },
    { name: "Guimaras Channel", coords: [10.55, 122.61], weatherType: "thunderstorm" }
  ];

  function clearDemoWeatherIcons() {
    if (rainRadarState.demoWeatherIconsLayer && map && map.hasLayer(rainRadarState.demoWeatherIconsLayer)) {
      map.removeLayer(rainRadarState.demoWeatherIconsLayer);
    }
  }

  function ensureDemoWeatherIcons() {
    if (!rainRadarState.demoWeatherIconsLayer) {
      rainRadarState.demoWeatherIconsLayer = L.layerGroup();

      DEMO_RAIN_AREAS.forEach(function (area) {
        var icon = area.weatherType === "thunderstorm" ? getThunderstormIconSvg() : getRainIconSvg();
        var marker = L.marker(area.coords, {
          icon: L.divIcon({
            className: "hv-weather-icon-marker",
            html: '<div class="hv-weather-icon">' + icon + "</div>",
            iconSize: [52, 52],
            iconAnchor: [26, 26]
          })
        }).bindTooltip(area.name + " • " + (area.weatherType === "thunderstorm" ? "Thunderstorm" : "Rain"), { sticky: true });
        marker.addTo(rainRadarState.demoWeatherIconsLayer);
      });
    }

    if (map && !map.hasLayer(rainRadarState.demoWeatherIconsLayer)) {
      rainRadarState.demoWeatherIconsLayer.addTo(map);
    }
  }

  function getRainIconSvg() {
    return '' +
      '<svg class="hvwx hvwx-rain" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="hvwx-cloud" d="M22 63c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '<path class="hvwx-drop d1" d="M34 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '<path class="hvwx-drop d2" d="M50 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '<path class="hvwx-drop d3" d="M66 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      "</svg>";
  }

  function getThunderstormIconSvg() {
    return '' +
      '<svg class="hvwx hvwx-thunder" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="hvwx-cloud thunder-cloud" d="M22 63c-9 0-13-5-13-12 0-8 6-12 12-12 2-5 7-9 14-9 2-7 8-12 18-12 13 0 17 10 18 17 7 0 13 4 13 13 0 8-5 12-13 13-4 1-8 0-10-1-2 3-13 4-17 0-4 4-14 3-22 3z"/>' +
      '<polygon class="hvwx-bolt" points="45,61 39,78 47,78 43,92 59,73 51,73 58,61"/>' +
      '<path class="hvwx-drop d1" d="M34 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      '<path class="hvwx-drop d3" d="M66 66c0 0-9 12 0 12s0-12 0-12z"/>' +
      "</svg>";
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
      if (safetyCircleState.members[i].id === memberId) return safetyCircleState.members[i];
    }
    return null;
  }

  function getMemberStatusMeta(status) {
    if (status === "safe") return { label: "Safe", className: "safe" };
    if (status === "moving") return { label: "Moving", className: "moving" };
    if (status === "help") return { label: "Needs Help", className: "help" };
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

  function getSafetyCircleSummary() {
    var total = safetyCircleState.members.length;
    var riskCount = safetyCircleState.members.filter(function (member) {
      return getHazardRiskMeta(member.coords).isRisk;
    }).length;

    return {
      total: total,
      riskCount: riskCount,
      summaryText: riskCount > 0
        ? total + " trusted members • " + riskCount + " near hazard zones"
        : total + " trusted members • all currently clear"
    };
  }

  function getSafetyCircleMemberPopup(member) {
    var statusMeta = getMemberStatusMeta(member.status);
    var riskMeta = getHazardRiskMeta(member.coords);

    return '' +
      '<div class="circle-popup">' +
        '<strong>' + escapeHtml(member.name) + '</strong><br>' +
        '<span>' + escapeHtml(member.relation) + '</span><br>' +
        '<span>Status: ' + escapeHtml(statusMeta.label) + '</span><br>' +
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
      var marker = L.marker(member.coords, {
        icon: getSafetyCircleMarkerIcon(member),
        zIndexOffset: 450
      });

      marker.bindPopup(getSafetyCircleMemberPopup(member));
      marker.on("click", function () {
        highlightSafetyCircleMember(member.id);
      });

      safetyCircleState.layer.addLayer(marker);
      safetyCircleState.markersById[member.id] = marker;
    });
  }

  function highlightSafetyCircleMember(memberId) {
    safetyCircleState.activeMemberId = memberId;

    document.querySelectorAll(".circle-member-card").forEach(function (card) {
      card.classList.toggle("is-active", card.getAttribute("data-member-id") === memberId);
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

    listEl.innerHTML = safetyCircleState.members.map(function (member) {
      var statusMeta = getMemberStatusMeta(member.status);
      var riskMeta = getHazardRiskMeta(member.coords);

      return '' +
        '<article class="circle-member-card' + (member.id === safetyCircleState.activeMemberId ? ' is-active' : '') + '" data-member-id="' + escapeHtml(member.id) + '">' +
          '<div class="circle-member-top">' +
            '<div class="circle-member-avatar">' + escapeHtml(getInitials(member.name)) + '</div>' +
            '<div class="circle-member-copy">' +
              '<div class="circle-member-title-row">' +
                '<strong>' + escapeHtml(member.name) + '</strong>' +
                '<span class="circle-status-badge ' + statusMeta.className + '">' + escapeHtml(statusMeta.label) + '</span>' +
              '</div>' +
              '<p>' + escapeHtml(member.relation) + ' • ' + escapeHtml(member.note) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="circle-meta-row">' +
            '<span>Battery ' + escapeHtml(String(member.battery)) + '%</span>' +
            '<span>' + escapeHtml(member.updated) + '</span>' +
            '<span class="circle-risk-chip ' + riskMeta.className + '">' + escapeHtml(riskMeta.label) + '</span>' +
          '</div>' +
          '<div class="circle-action-row">' +
            '<button type="button" data-circle-action="focus" data-member-id="' + escapeHtml(member.id) + '">View</button>' +
            '<button type="button" data-circle-action="route" data-member-id="' + escapeHtml(member.id) + '">Route</button>' +
            '<button type="button" data-circle-action="ping" data-member-id="' + escapeHtml(member.id) + '">Ping</button>' +
          '</div>' +
        '</article>';
    }).join("");

    listEl.querySelectorAll("[data-circle-action]").forEach(function (button) {
      button.addEventListener("click", function () {
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
    if (!member || !map || !marker) return;

    setSafetyCircleMarkersVisible(true);
    highlightSafetyCircleMember(memberId);
    map.setView(member.coords, Math.max(13, map.getZoom()));
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

    var bounds = safetyCircleState.members.map(function (member) { return member.coords; });
    map.fitBounds(bounds, { padding: [54, 54] });
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
    var nodes = document.querySelectorAll("#meshGrid .mesh-node");
    var activeCount = 0;

    nodes.forEach(function (node) {
      if (Math.random() > 0.35) {
        node.classList.add("active");
        activeCount += 1;
      } else {
        node.classList.remove("active");
      }
    });

    if (activeCount >= 3) {
      setTextIfExists("meshStatusText", "Offline relay is stable. Community nodes can forward cached alerts even during temporary signal loss.");
      return;
    }

    if (activeCount === 2) {
      setTextIfExists("meshStatusText", "Partial relay available. Some cached alerts may still propagate through nearby connected nodes.");
      return;
    }

    setTextIfExists("meshStatusText", "Relay network is weak. Offline alert distribution may be delayed until more nodes reconnect.");
  }

  function formatTyphoonUpdated(value) {
    if (!value) return "--";
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function setTyphoonCard(statusClass, statusLabel, name, meta, wind, gust, movement, updated, note) {
    var card = document.getElementById("typhoonTrackerCard");
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

  function closeWeatherPanel() {
    var panel = document.getElementById("weatherPanel");
    var reopenBtn = document.getElementById("weatherReopenBtn");
    if (panel) {
      panel.classList.add("hidden");
    }
    if (reopenBtn) {
      reopenBtn.classList.remove("hidden");
    }
  }

  function openWeatherPanel() {
    var panel = document.getElementById("weatherPanel");
    var reopenBtn = document.getElementById("weatherReopenBtn");
    if (panel) {
      panel.classList.remove("hidden");
    }
    if (reopenBtn) {
      reopenBtn.classList.add("hidden");
    }
  }

  function reopenWeatherPanel(mode) {
    openWeatherPanel();
    setWeatherPanelMode(mode === "details" ? "details" : "forecast");
  }

  function setWeatherPanelMode(mode) {
    weatherPanelMode = mode === "forecast" ? "forecast" : "details";

    var detailsBody = document.getElementById("weatherBody");
    var forecastBody = document.getElementById("weatherForecastBody");
    var toggleBtn = document.getElementById("weatherModeToggle");

    if (detailsBody) {
      detailsBody.classList.toggle("hidden", weatherPanelMode !== "details");
    }
    if (forecastBody) {
      forecastBody.classList.toggle("hidden", weatherPanelMode !== "forecast");
    }
    if (toggleBtn) {
      toggleBtn.textContent = weatherPanelMode === "details" ? "Show Forecast" : "Show Details";
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

  function setWeatherIcon(conditionText) {
    var iconEl = document.getElementById("weatherIcon");
    if (!iconEl) return;

    var label = String(conditionText || "").toLowerCase();
    var iconType = "sun";
    if (label.indexOf("thunder") >= 0 || label.indexOf("storm") >= 0) iconType = "storm";
    else if (label.indexOf("shower") >= 0 || label.indexOf("rain") >= 0 || label.indexOf("drizzle") >= 0) iconType = "rain";
    else if (label.indexOf("fog") >= 0 || label.indexOf("haze") >= 0 || label.indexOf("mist") >= 0) iconType = "fog";
    else if (label.indexOf("partly") >= 0 || label.indexOf("intermittent") >= 0 || label.indexOf("mostly sunny") >= 0) iconType = "partly";
    else if (label.indexOf("cloud") >= 0 || label.indexOf("overcast") >= 0) iconType = "cloud";
    else if (label.indexOf("error") >= 0) iconType = "error";
    else if (label.indexOf("loading") >= 0 || label.indexOf("fetching") >= 0) iconType = "loading";

    iconEl.innerHTML = getWeatherSvg(iconType);
  }

  function getWeatherIconType(conditionText) {
    var label = String(conditionText || "").toLowerCase();
    if (label.indexOf("thunder") >= 0 || label.indexOf("storm") >= 0) return "storm";
    if (label.indexOf("shower") >= 0 || label.indexOf("rain") >= 0 || label.indexOf("drizzle") >= 0) return "rain";
    if (label.indexOf("fog") >= 0 || label.indexOf("haze") >= 0 || label.indexOf("mist") >= 0) return "fog";
    if (label.indexOf("partly") >= 0 || label.indexOf("intermittent") >= 0 || label.indexOf("mostly sunny") >= 0) return "partly";
    if (label.indexOf("cloud") >= 0 || label.indexOf("overcast") >= 0) return "cloud";
    if (label.indexOf("error") >= 0) return "error";
    if (label.indexOf("loading") >= 0 || label.indexOf("fetching") >= 0) return "loading";
    return "sun";
  }

  function setWeatherConditionBadge(type, conditionText) {
    var badge = document.getElementById("weatherConditionBadge");
    if (!badge) return;
    var friendlyLabels = {
      sun: "Sunny",
      partly: "Partly Cloudy",
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

  function setWeatherIcon(conditionText) {
    var type = getWeatherIconType(conditionText);
    var iconEl = document.getElementById("weatherIcon");
    if (iconEl) {
      iconEl.innerHTML = getWeatherSvg(type);
    }
    setWeatherConditionBadge(type, conditionText);
    setWeatherPanelTheme(type);
    return type;
  }

  function getWeatherSvg(type) {
    if (type === "partly") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="23" cy="22" r="10" fill="#FFD35A"/><path d="M18 42c0-7 5.7-12.7 12.7-12.7 4.3 0 8.2 2.1 10.6 5.6 1.4-.6 2.8-.9 4.4-.9 6 0 10.8 4.8 10.8 10.8H18z" fill="#EAF2FB" stroke="#D9E5F2" stroke-width="1.2"/></svg>';
    if (type === "cloud") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 43c0-6.9 5.6-12.5 12.5-12.5 1 0 2 .1 2.9.3 2.2-6.2 8.1-10.6 15-10.6 9 0 16.3 7.2 16.3 16.2 0 3.7-1.2 7.1-3.3 9.6H15z" fill="#EDF3FA" stroke="#D9E5F2" stroke-width="1.2"/></svg>';
    if (type === "rain") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 37c0-6.9 5.6-12.5 12.5-12.5 1 0 2 .1 2.9.3 2.2-6.2 8.1-10.6 15-10.6 9 0 16.3 7.2 16.3 16.2 0 3.7-1.2 7.1-3.3 9.6H15z" fill="#EDF3FA" stroke="#D9E5F2" stroke-width="1.2"/><path d="M24 44l-3 7M34 44l-3 7M44 44l-3 7" stroke="#57A9FF" stroke-width="3.2" stroke-linecap="round"/></svg>';
    if (type === "storm") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 37c0-6.9 5.6-12.5 12.5-12.5 1 0 2 .1 2.9.3 2.2-6.2 8.1-10.6 15-10.6 9 0 16.3 7.2 16.3 16.2 0 3.7-1.2 7.1-3.3 9.6H15z" fill="#E5ECF7" stroke="#D1DEEF" stroke-width="1.2"/><path d="M33 40l-5 8h4l-2 8 10-12h-4l3-4h-6z" fill="#FFD35A"/><path d="M20 46l-2 5M48 46l-2 5" stroke="#57A9FF" stroke-width="2.8" stroke-linecap="round"/></svg>';
    if (type === "fog") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 34c0-6.9 5.6-12.5 12.5-12.5 1 0 2 .1 2.9.3 2.2-6.2 8.1-10.6 15-10.6 9 0 16.3 7.2 16.3 16.2 0 3.7-1.2 7.1-3.3 9.6H15z" fill="#EDF3FA" stroke="#D9E5F2" stroke-width="1.2"/><path d="M20 44h24M17 50h30" stroke="#C7D5E5" stroke-width="3" stroke-linecap="round"/></svg>';
    if (type === "error") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="22" fill="#FFCECE"/><path d="M32 20v14M32 43.5h.01" stroke="#D64B4B" stroke-width="4" stroke-linecap="round"/></svg>';
    if (type === "loading") return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="20" stroke="#9FC7FF" stroke-width="5" stroke-linecap="round" stroke-dasharray="28 16"/></svg>';
    return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="14" fill="#FFD35A"/><path d="M32 7v7M32 50v7M57 32h-7M14 32H7M49.7 14.3l-5 5M19.3 44.7l-5 5M49.7 49.7l-5-5M19.3 19.3l-5-5" stroke="#FFD35A" stroke-width="3" stroke-linecap="round"/></svg>';
  }

  function getForecastIconType(text) {
    return getWeatherIconType(text);
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

    clearDemoWeatherIcons();

  }

  async function startRainRadarAnimation() {
    rainRadarState.active = true;
    ensureRainRadarTileLayer();

    // Temporary demo weather icons (Western Visayas) for rain/thunderstorm preview.
    ensureDemoWeatherIcons();

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

  async function fetchFiveDayForecastRows(currentConditionsUrl) {
    var locationKey = extractLocationKeyFromCurrentConditionsUrl(currentConditionsUrl);
    if (!locationKey) return null;

    try {
      var response = await fetch(buildWeatherProxyUrl("forecast", locationKey));
      if (!response.ok) return null;

      var payload = await response.json();
      if (!payload || !Array.isArray(payload.DailyForecasts) || !payload.DailyForecasts.length) return null;

      return payload.DailyForecasts.slice(0, 5).map(function (item, index) {
        var min = item && item.Temperature && item.Temperature.Minimum ? Number(item.Temperature.Minimum.Value) : NaN;
        var max = item && item.Temperature && item.Temperature.Maximum ? Number(item.Temperature.Maximum.Value) : NaN;
        var phrase = item && item.Day && item.Day.IconPhrase ? item.Day.IconPhrase : "Sunny";
        return {
          day: formatForecastDay(item.Date, index),
          min: isFinite(min) ? Math.round(min) : 0,
          max: isFinite(max) ? Math.round(max) : 0,
          text: phrase
        };
      });
    } catch (err) {
      return null;
    }
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

  function syncSelectedWeatherMarker(place, conditionText) {
    if (!map || !place || !Array.isArray(place.coords)) return;
    clearSelectedWeatherMarker();
    selectedPlaceWeatherMarker = L.marker(place.coords, {
      icon: L.divIcon({
        className: "selected-weather-marker-wrap",
        html: '<div class="selected-weather-marker">' + getWeatherSvg(getWeatherIconType(conditionText)) + '</div>',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      })
    }).bindTooltip(place.name + ' • ' + conditionText, { direction: 'top', offset: [0, -22], className: 'city-label' }).addTo(map);
  }

  function renderWeather(placeName, weatherRow, place) {
    var metricTemp = weatherRow && weatherRow.Temperature && weatherRow.Temperature.Metric ? weatherRow.Temperature.Metric.Value : null;
    var realFeel = weatherRow && weatherRow.RealFeelTemperature && weatherRow.RealFeelTemperature.Metric ? weatherRow.RealFeelTemperature.Metric.Value : null;
    var humidity = weatherRow && typeof weatherRow.RelativeHumidity === "number" ? weatherRow.RelativeHumidity : null;
    var wind = weatherRow && weatherRow.Wind && weatherRow.Wind.Speed && weatherRow.Wind.Speed.Metric ? weatherRow.Wind.Speed.Metric.Value : null;
    var uv = weatherRow && typeof weatherRow.UVIndex === "number" ? weatherRow.UVIndex : null;
    var observation = weatherRow && weatherRow.LocalObservationDateTime ? new Date(weatherRow.LocalObservationDateTime) : null;

    setTextIfExists("weatherCity", placeName);
    setTextIfExists("weatherUpdated", observation && !isNaN(observation.getTime()) ? "Updated " + observation.toLocaleString() : "Updated recently");
    var conditionText = weatherRow && weatherRow.WeatherText ? weatherRow.WeatherText : "No weather description";
    setTextIfExists("weatherCondition", conditionText);
    setWeatherIcon(conditionText);
    setTextIfExists("weatherTemp", metricTemp !== null ? Math.round(metricTemp) + "°C" : "--°C");
    setTextIfExists("weatherRealFeel", realFeel !== null ? Math.round(realFeel) + "°C" : "--°C");
    setTextIfExists("weatherHumidity", humidity !== null ? humidity + "%" : "--%");
    setTextIfExists("weatherWind", wind !== null ? Math.round(wind) + " km/h" : "-- km/h");
    setTextIfExists("weatherUv", uv !== null ? String(uv) : "--");
    syncSelectedWeatherMarker(place, conditionText);
    openWeatherPanel();
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
    setWeatherPanelMode("forecast");
    openWeatherPanel();
  }

  function getWeatherCacheKey(locationKey) {
    return "k_" + locationKey;
  }

  function savePlaceWeatherToClientCache(locationKey, currentPayload, forecastRows) {
    // Save latest successful response so UI can still render during 429/network failures.
    if (!locationKey) return;
    var cache = readWeatherClientCache();
    cache[getWeatherCacheKey(locationKey)] = {
      timestamp: Date.now(),
      currentPayload: currentPayload,
      forecastRows: Array.isArray(forecastRows) ? forecastRows : [],
    };
    writeWeatherClientCache(cache);
  }

  function readPlaceWeatherFromClientCache(locationKey) {
    if (!locationKey) return null;
    var cache = readWeatherClientCache();
    return cache[getWeatherCacheKey(locationKey)] || null;
  }

  function applyCachedWeather(place, cachedEntry) {
    if (!cachedEntry || !Array.isArray(cachedEntry.currentPayload) || !cachedEntry.currentPayload.length) {
      return false;
    }

    renderWeather(place.name, cachedEntry.currentPayload[0], place);
    if (Array.isArray(cachedEntry.forecastRows) && cachedEntry.forecastRows.length) {
      renderForecastList(cachedEntry.forecastRows);
      setWeatherPanelMode("forecast");
    } else {
      renderForecastError();
    }
    setTextIfExists("weatherUpdated", "Cached weather data");
    return true;
  }

  function isPlaceClickCoolingDown(place) {
    // Debounce repeated clicks on the same place to prevent request bursts.
    var key = place.province + "|" + place.name;
    var now = Date.now();
    var lastAt = lastWeatherClickAtByPlace[key] || 0;
    if (now - lastAt < WEATHER_CLICK_COOLDOWN_MS) {
      return true;
    }
    lastWeatherClickAtByPlace[key] = now;
    return false;
  }

  async function fetchAndRenderPlaceWeather(place) {
    var url = getPlaceWeatherUrl(place.name, place.province);
    if (!url) {
      renderWeatherError(place.name, "Weather API not configured for this place yet.", place);
      return;
    }
    var locationKey = extractLocationKeyFromCurrentConditionsUrl(url);
    if (!locationKey) {
      renderWeatherError(place.name, "Invalid location key for this place.", place);
      return;
    }
    if (isPlaceClickCoolingDown(place)) {
      return;
    }

    setTextIfExists("weatherCity", place.name);
    setTextIfExists("weatherUpdated", "Loading weather data...");
    setTextIfExists("weatherCondition", "Fetching current conditions");
    setWeatherIcon("loading");
    setWeatherPanelMode("forecast");
    openWeatherPanel();

    try {
      var response = await fetch(buildWeatherProxyUrl("current", locationKey));
      if (!response.ok) {
        var errorText = "Request failed: " + response.status;
        try {
          var errPayload = await response.json();
          if (errPayload && (errPayload.detail || errPayload.error)) {
            errorText = (errPayload.error || "Request failed") + (errPayload.detail ? " - " + errPayload.detail : "");
          }
        } catch (e) {
          try {
            var rawText = await response.text();
            if (rawText) {
              errorText = rawText.slice(0, 220);
            }
          } catch (ignore) {}
        }
        throw new Error(errorText);
      }

      var payload = await response.json();
      if (!Array.isArray(payload) || !payload.length) throw new Error("No weather rows returned");

      renderWeather(place.name, payload[0], place);
      var forecastRows = await fetchFiveDayForecastRows(url);
      if (forecastRows && forecastRows.length) {
        renderForecastList(forecastRows);
        setWeatherPanelMode("forecast");
        savePlaceWeatherToClientCache(locationKey, payload, forecastRows);
      } else {
        renderForecastError();
        savePlaceWeatherToClientCache(locationKey, payload, []);
      }
    } catch (err) {
      var cached = readPlaceWeatherFromClientCache(locationKey);
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
      var dot = el.querySelector(".city-dot");
      if (!dot) return;
      dot.style.transform = "scale(" + scale + ")";
      dot.style.transformOrigin = "center center";
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

    var placeIcon = L.divIcon({ className: "city-dot-wrapper", html: '<span class="city-dot"></span>', iconSize: [10, 10], iconAnchor: [5, 5] });

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

    if (markerBounds.length) {
      map.fitBounds(markerBounds, { padding: [30, 30] });
    }

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

    var floodIcon = L.divIcon({ className: "", html: '<div class="pulse-marker blue"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    var fireIcon = L.divIcon({ className: "", html: '<div class="pulse-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    var evacIcon = L.divIcon({ className: "", html: '<div class="pulse-marker green"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    var roadIcon = L.divIcon({ className: "", html: '<div class="pulse-marker orange"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    var offlineIcon = L.divIcon({ className: "", html: '<div class="pulse-marker yellow"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

    L.marker([10.7085, 122.9512], { icon: floodIcon }).addTo(map).bindPopup("Flood<br>Barangay Tangub");
    L.marker([10.6900, 122.9700], { icon: fireIcon }).addTo(map).bindPopup("Fire<br>Zone 2");
    EVACUATION_CENTERS.forEach(function (center) {
      L.marker(center.coords, { icon: evacIcon }).addTo(map).bindPopup("Evacuation<br>" + center.name + "<br>Capacity available: " + center.capacity + "%");
    });
    L.marker([10.6650, 122.9400], { icon: roadIcon }).addTo(map).bindPopup("Report<br>Road Block");
    L.marker([10.6550, 122.9250], { icon: offlineIcon }).addTo(map).bindPopup("Offline-ready<br>Last saved data view");

    addWesternVisayasPlaceMarkers();
    map.on("zoomend", updatePlaceMarkerScale);

    var typhoonLayer = L.layerGroup();
    typhoonState.layer = typhoonLayer;

    var layersControl = L.control.layers({ "Standard Map": baseMap }, { "Rain Radar": weatherRadar, "Typhoon Tracking": typhoonLayer }).addTo(map);

    // Default overlays: Rain Radar ON, Typhoon Tracking ON.
    weatherRadar.addTo(map);
    typhoonLayer.addTo(map);
    startRainRadarAnimation();

    map.on("overlayadd", function (event) {
      if (event && event.layer === weatherRadar) {
        startRainRadarAnimation();
      }
    });

    map.on("overlayremove", function (event) {
      if (event && event.layer === weatherRadar) {
        stopRainRadarAnimation();
      }
      // Keep typhoon overlay always on.
      if (event && event.layer === typhoonLayer) {
        typhoonLayer.addTo(map);
      }
    });

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

    // Add quick weather panel actions inside the layers dropdown so users can reopen it after closing.
    var layersContainer = layersControl && layersControl.getContainer ? layersControl.getContainer() : null;
    var listContainer = layersContainer ? layersContainer.querySelector(".leaflet-control-layers-list") : null;
    if (listContainer && !listContainer.querySelector(".hv-map-actions")) {
      var actionsWrap = document.createElement("div");
      actionsWrap.className = "hv-map-actions";

      var detailsBtn = document.createElement("button");
      detailsBtn.type = "button";
      detailsBtn.className = "hv-map-action-btn";
      detailsBtn.textContent = "Open Weather Details";
      detailsBtn.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        reopenWeatherPanel("details");
      });

      var forecastBtn = document.createElement("button");
      forecastBtn.type = "button";
      forecastBtn.className = "hv-map-action-btn";
      forecastBtn.textContent = "Open Weather Forecast";
      forecastBtn.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        reopenWeatherPanel("forecast");
      });

      var circleBtn = document.createElement("button");
      circleBtn.type = "button";
      circleBtn.className = "hv-map-action-btn";
      circleBtn.textContent = "Open Safety Circle";
      circleBtn.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        openSafetyCirclePanel();
      });

      actionsWrap.appendChild(detailsBtn);
      actionsWrap.appendChild(forecastBtn);
      actionsWrap.appendChild(circleBtn);
      listContainer.appendChild(actionsWrap);
    }

    var savedRoute = getSavedRouteRecommendation();
    if (savedRoute && Array.isArray(savedRoute.userCoords) && Array.isArray(savedRoute.centerCoords)) {
      if (routeLine) map.removeLayer(routeLine);
      if (userMarker) map.removeLayer(userMarker);
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
    if (closeBtn) closeBtn.addEventListener("click", closeWeatherPanel);

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
        openWeatherPanel();
      });
    }

    var modeBtn = document.getElementById("weatherModeToggle");
    if (modeBtn) {
      modeBtn.addEventListener("click", function () {
        setWeatherPanelMode(weatherPanelMode === "details" ? "forecast" : "details");
      });
    }

    setWeatherPanelMode("forecast");
    initMap();
    renderSafetyCirclePanel();
    fetchAndRenderPlaceWeather({ name: "Bacolod", province: "Negros Occidental", coords: [10.6765, 122.9509] });
    useBrowserLocationForSafetyCircle();

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
