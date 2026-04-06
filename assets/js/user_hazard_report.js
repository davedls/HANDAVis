(function () {
  "use strict";

  var selectedHazard = "Flood";
  var rescueNeeded = false;
  var reverseGeocodeTimer = null;

  var hazardConfigs = {
    "Flood": { label: "FLOOD DEPTH", options: ["Ankle-deep", "Knee-deep", "Waist-deep", "Above waist"] },
    "Fire": { label: "FIRE STATUS", options: ["Smoke only", "Active flames", "Spreading"] },
    "Storm": { label: "STORM IMPACT", options: ["Strong winds", "Heavy rain", "Flying debris"] },
    "Road Block": { label: "ROAD BLOCK TYPE", options: ["Partial blockage", "Full blockage", "Unsafe to cross"] },
    "Earthquake": { label: "EARTHQUAKE EFFECT", options: ["Minor cracks", "Structure damage", "Collapsed debris"] },
    "Medical": { label: "MEDICAL NEED", options: ["First aid", "Transport needed", "Emergency care"] }
  };

  var detailState = {
    peopleAffected: "1-5",
    injuries: "None",
    roadStatus: "Passable",
    hazardDetail: "Ankle-deep"
  };

  var ROLE_WEIGHT = {
    resident: 1,
    verified_resident: 2,
    barangay: 3,
    responder: 4,
    admin: 5
  };

  var defaultContext = {
    userId: "resident-demo-01",
    displayName: "You",
    role: "resident",
    verified: false,
    province: "",
    city: "",
    barangay: "",
    lat: null,
    lng: null,
    coverageLevel: "city",
    coverageRadiusKm: 10,
    locationSource: "profile"
  };

  var currentContext = sanitizeContext(window.HANDAVIS_CURRENT_CONTEXT || defaultContext);

  var defaultReports = [
    {
      id: "rep-bcd-001",
      hazard: "Flood",
      province: "Negros Occidental",
      city: "Bacolod",
      barangay: "Mansilingan",
      location: "Brgy. Mansilingan, Bacolod",
      description: "Knee-deep flood near the covered court. Small vehicles are starting to slow down.",
      author: "Anonymous",
      role: "resident",
      lat: 10.6426,
      lng: 122.9631,
      hasPhoto: false,
      rescueNeeded: false,
      confirmWeight: 8,
      rejectWeight: 1,
      createdAt: Date.now() - 5 * 60 * 1000,
      status: "Under Verification"
    },
    {
      id: "rep-bcd-002",
      hazard: "Fire",
      province: "Negros Occidental",
      city: "Bacolod",
      barangay: "Estefania",
      location: "Brgy. Estefania, Bacolod",
      description: "Thick smoke visible behind the market strip. Residents are moving away from the area.",
      author: "Barangay Desk",
      role: "barangay",
      lat: 10.6827,
      lng: 122.9502,
      hasPhoto: true,
      rescueNeeded: true,
      confirmWeight: 16,
      rejectWeight: 0,
      createdAt: Date.now() - 14 * 60 * 1000,
      status: "Responders Assigned"
    },
    {
      id: "rep-ilo-001",
      hazard: "Road Block",
      province: "Iloilo",
      city: "Iloilo City",
      barangay: "Molo",
      location: "Molo, Iloilo City",
      description: "Part of the road is blocked by debris. One lane remains passable for motorcycles.",
      author: "Responder 12",
      role: "responder",
      lat: 10.6931,
      lng: 122.5482,
      hasPhoto: false,
      rescueNeeded: false,
      confirmWeight: 12,
      rejectWeight: 1,
      createdAt: Date.now() - 22 * 60 * 1000,
      status: "In Progress"
    }
  ];

  var reports = sanitizeReports(window.HANDAVIS_INITIAL_REPORTS || defaultReports);
  var localVotes = readLocalVotes();

  function sanitizeContext(context) {
    context = context || {};
    return {
      userId: context.userId || defaultContext.userId,
      displayName: context.displayName || defaultContext.displayName,
      role: normalizeRole(context.role || defaultContext.role),
      verified: !!context.verified,
      province: titleCase(normalizeProvinceName(context.province || "")),
      city: titleCase(normalizeCityName(context.city || "")),
      barangay: titleCase(context.barangay || ""),
      lat: isFiniteNumber(context.lat) ? Number(context.lat) : null,
      lng: isFiniteNumber(context.lng) ? Number(context.lng) : null,
      coverageLevel: context.coverageLevel || defaultContext.coverageLevel,
      coverageRadiusKm: isFiniteNumber(context.coverageRadiusKm) ? Number(context.coverageRadiusKm) : defaultContext.coverageRadiusKm,
      locationSource: context.locationSource || defaultContext.locationSource
    };
  }

  function sanitizeReports(inputReports) {
    return (inputReports || []).map(function (report, index) {
      var clean = Object.assign({}, report);
      clean.id = clean.id || ("report-" + (index + 1));
      clean.hazard = normalizeHazard(clean.hazard || "Flood");
      clean.province = titleCase(normalizeProvinceName(clean.province || ""));
      clean.city = titleCase(normalizeCityName(clean.city || ""));
      clean.barangay = titleCase(clean.barangay || "");
      clean.location = clean.location || buildLocationLabel(clean.barangay, clean.city, clean.province);
      clean.description = clean.description || "No additional description provided.";
      clean.author = clean.author || "Anonymous";
      clean.role = normalizeRole(clean.role || "resident");
      clean.lat = isFiniteNumber(clean.lat) ? Number(clean.lat) : null;
      clean.lng = isFiniteNumber(clean.lng) ? Number(clean.lng) : null;
      clean.hasPhoto = !!clean.hasPhoto;
      clean.rescueNeeded = !!clean.rescueNeeded;
      clean.confirmWeight = isFiniteNumber(clean.confirmWeight) ? Number(clean.confirmWeight) : 1;
      clean.rejectWeight = isFiniteNumber(clean.rejectWeight) ? Number(clean.rejectWeight) : 0;
      clean.createdAt = isFiniteNumber(clean.createdAt) ? Number(clean.createdAt) : Date.now();
      clean.status = clean.status || "Under Verification";
      return clean;
    });
  }

  function isFiniteNumber(value) {
    return value !== null && value !== "" && isFinite(value);
  }

  function normalizeRole(role) {
    var value = String(role || "resident").toLowerCase().replace(/\s+/g, "_");
    if (!ROLE_WEIGHT[value]) return "resident";
    return value;
  }

  function normalizeHazard(hazard) {
    var value = String(hazard || "Flood").trim().toLowerCase();
    if (value === "roadblock") return "Road Block";
    if (value === "storm surge") return "Storm";
    if (value === "medical emergency") return "Medical";

    switch (value) {
      case "flood":
        return "Flood";
      case "fire":
        return "Fire";
      case "storm":
      case "typhoon":
        return "Storm";
      case "road block":
        return "Road Block";
      case "earthquake":
        return "Earthquake";
      case "medical":
        return "Medical";
      default:
        return titleCase(hazard || "Flood");
    }
  }

  function normalizeProvinceName(province) {
    var value = String(province || "").trim();
    if (!value) return "";
    var lower = value.toLowerCase();

    if (lower === "negros occidental province") return "Negros Occidental";
    if (lower === "province of negros occidental") return "Negros Occidental";
    if (lower === "iloilo province") return "Iloilo";
    if (lower === "province of iloilo") return "Iloilo";

    return value;
  }

  function normalizeCityName(city) {
    var value = String(city || "").trim();
    if (!value) return "";
    var lower = value.toLowerCase();

    if (lower === "bacolod city") return "Bacolod";
    if (lower === "iloilo city proper") return "Iloilo City";

    return value;
  }

  function titleCase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      })
      .replace(/\bNg\b/g, "ng")
      .replace(/\bOf\b/g, "of")
      .trim();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function truncateText(text, maxLength) {
    var clean = String(text || "").trim();
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength).trim() + "...";
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () {
      toast.classList.remove("show");
    }, 2600);
  }

  function readLocalVotes() {
    try {
      return JSON.parse(localStorage.getItem("handavis_local_votes") || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeLocalVotes() {
    try {
      localStorage.setItem("handavis_local_votes", JSON.stringify(localVotes));
    } catch (error) {
      // Ignore storage errors.
    }
  }

  function selectQuick(el, value) {
    selectedHazard = normalizeHazard(value);

    var buttons = document.querySelectorAll("#quickTypes .hazard-card, #quickTypes .quick-type");
    buttons.forEach(function (btn) {
      btn.classList.remove("active");
    });

    if (el) {
      el.classList.add("active");
    }

    renderHazardSpecificOptions();
    toggleHazardSpecificFields();
  }

  function renderHazardSpecificOptions() {
    var config = hazardConfigs[selectedHazard] || hazardConfigs["Flood"];
    var wrap = document.getElementById("hazardSpecificWrap");
    var label = document.getElementById("hazardSpecificLabel");
    var row = document.getElementById("hazardSpecificRow");

    if (wrap) {
      wrap.style.display = "";
    }

    if (label) {
      label.textContent = config.label;
    }

    if (!row) {
      return;
    }

    if (config.options.indexOf(detailState.hazardDetail) === -1) {
      detailState.hazardDetail = config.options[0];
    }

    row.innerHTML = "";

    config.options.forEach(function (option) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "detail-chip" + (detailState.hazardDetail === option ? " active" : "");
      btn.textContent = option;
      btn.addEventListener("click", function () {
        selectDetail(btn, "hazardDetail", option);
      });
      row.appendChild(btn);
    });
  }

  function toggleHazardSpecificFields() {
    var floodDepthWrap = document.querySelector("[data-hazard-only='Flood']");
    var fireStateWrap = document.querySelector("[data-hazard-only='Fire']");

    if (floodDepthWrap) {
      floodDepthWrap.style.display = selectedHazard === "Flood" ? "" : "none";
    }

    if (fireStateWrap) {
      fireStateWrap.style.display = selectedHazard === "Fire" ? "" : "none";
    }

    var hazardSpecificWrap = document.getElementById("hazardSpecificWrap");
    if (hazardSpecificWrap) {
      hazardSpecificWrap.style.display = "";
    }
  }

  function selectDetail(el, group, value) {
    detailState[group] = value;

    var rowMap = {
      peopleAffected: "#peopleAffectedRow",
      injuries: "#injuriesRow",
      roadStatus: "#roadStatusRow",
      hazardDetail: "#hazardSpecificRow"
    };

    var rowSelector = rowMap[group];
    if (rowSelector) {
      document.querySelectorAll(rowSelector + " .detail-chip").forEach(function (chip) {
        chip.classList.remove("active");
      });
    }

    if (el) {
      el.classList.add("active");
    }
  }

  function toggleRescueNeeded(el) {
    rescueNeeded = !rescueNeeded;
    if (el) {
      el.classList.toggle("active", rescueNeeded);
    }
  }

  function handlePhotoName(input) {
    var label = document.getElementById("photoLabelText");
    if (!label) return;

    if (input && input.files && input.files[0]) {
      var name = input.files[0].name;
      label.textContent = name.length > 22 ? name.slice(0, 22) + "..." : name;
    } else {
      label.textContent = "ADD PHOTO";
    }
  }

  function getSelectedValue(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var el = document.querySelector(selectors[i]);
      if (el && typeof el.value === "string" && el.value.trim()) {
        return el.value.trim();
      }
      if (el && el.dataset && el.dataset.value) {
        return el.dataset.value.trim();
      }
    }
    return "";
  }

  function getQuickDetails() {
    var hasChipUi = document.getElementById("peopleAffectedRow") || document.getElementById("hazardSpecificRow");

    if (hasChipUi) {
      return {
        peopleAffected: detailState.peopleAffected,
        injuries: detailState.injuries,
        roadStatus: detailState.roadStatus,
        hazardDetail: detailState.hazardDetail
      };
    }

    return {
      peopleAffected: getSelectedValue(["#quickPeopleAffected", "[name='quickPeopleAffected']:checked"]),
      injuries: getSelectedValue(["#quickInjuries", "[name='quickInjuries']:checked"]),
      roadStatus: getSelectedValue(["#quickRoadStatus", "[name='quickRoadStatus']:checked"]),
      floodDepth: getSelectedValue(["#quickFloodDepth", "[name='quickFloodDepth']:checked"]),
      fireState: getSelectedValue(["#quickFireState", "[name='quickFireState']:checked"]),
      hazardDetail: getSelectedValue(["#quickHazardDetail", "[name='quickHazardDetail']:checked"])
    };
  }

  function getQuickSummary(details) {
    var parts = [];

    if (details.peopleAffected) parts.push(details.peopleAffected + " affected");
    if (details.injuries) parts.push("Injuries: " + details.injuries);
    if (details.roadStatus) parts.push("Road: " + details.roadStatus);

    if (details.hazardDetail) {
      var config = hazardConfigs[selectedHazard] || hazardConfigs["Flood"];
      if (config.label === "FLOOD DEPTH") parts.push("Depth: " + details.hazardDetail);
      else if (config.label === "FIRE STATUS") parts.push(details.hazardDetail);
      else parts.push(details.hazardDetail);
    } else if (selectedHazard === "Flood" && details.floodDepth) {
      parts.push("Depth: " + details.floodDepth);
    } else if (selectedHazard === "Fire" && details.fireState) {
      parts.push(details.fireState);
    }

    if (rescueNeeded) parts.push("Rescue requested");

    return parts;
  }

  function buildLocationLabel(barangay, city, province) {
    var parts = [];
    if (barangay) parts.push("Brgy. " + barangay.replace(/^Brgy\.?\s*/i, ""));
    if (city) parts.push(city);
    if (province && province !== city) parts.push(province);
    return parts.join(", ") || "Location not specified";
  }

  function getRoleWeight(role) {
    return ROLE_WEIGHT[normalizeRole(role)] || 1;
  }

  function getRoleLabel(role) {
    switch (normalizeRole(role)) {
      case "verified_resident":
        return "Verified Resident";
      case "barangay":
        return "Barangay";
      case "responder":
        return "Responder";
      case "admin":
        return "Admin";
      default:
        return "Resident";
    }
  }

  function computeConfidence(report) {
    var total = Math.max(1, Number(report.confirmWeight || 0) + Number(report.rejectWeight || 0));
    var confidence = Math.round((Number(report.confirmWeight || 0) / total) * 100);

    if (report.role === "barangay" || report.role === "responder" || report.role === "admin") {
      confidence = Math.max(confidence, 82);
    }

    if (report.hasPhoto) confidence = Math.min(99, confidence + 4);
    if (report.rescueNeeded) confidence = Math.min(99, confidence + 2);

    return Math.max(10, Math.min(99, confidence));
  }

  function getConfidenceClass(confidence) {
    if (confidence >= 75) return "confidence-high";
    if (confidence >= 50) return "confidence-medium";
    return "confidence-low";
  }

  function getTimeAgo(timestamp) {
    var diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    var mins = Math.round(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + "m ago";
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.round(hours / 24);
    return days + "d ago";
  }

  function distanceKm(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(isFiniteNumber)) return Infinity;

    var toRad = function (deg) {
      return deg * Math.PI / 180;
    };

    var earthRadius = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function inferAreaFromKnownReports(lat, lng) {
    var nearest = null;
    reports.forEach(function (report) {
      if (!isFiniteNumber(report.lat) || !isFiniteNumber(report.lng)) return;
      var dist = distanceKm(lat, lng, report.lat, report.lng);
      if (!nearest || dist < nearest.distance) {
        nearest = {
          distance: dist,
          province: report.province,
          city: report.city,
          barangay: report.barangay,
          lat: report.lat,
          lng: report.lng
        };
      }
    });

    if (!nearest || nearest.distance > 25) return null;
    return nearest;
  }

  function pickFirstValue(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = values[i];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  }

  function uniqueTextParts(parts) {
    var seen = {};
    return (parts || []).filter(function (part) {
      var value = String(part || "").trim();
      if (!value) return false;
      var key = value.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function cleanBarangayLabel(value) {
    var clean = String(value || "").trim();
    if (!clean) return "";
    clean = clean.replace(/^brgy\.?\s*/i, "").replace(/^barangay\s+/i, "");
    clean = titleCase(clean);
    return clean ? "Brgy. " + clean : "";
  }

  function buildStreetLabel(address) {
    var houseNumber = pickFirstValue([address.house_number]);
    var road = pickFirstValue([
      address.road,
      address.pedestrian,
      address.footway,
      address.residential,
      address.path,
      address.cycleway
    ]);

    if (houseNumber && road) return titleCase(houseNumber + " " + road);
    if (road) return titleCase(road);
    return "";
  }

  function buildLandmarkLabel(address) {
    return titleCase(pickFirstValue([
      address.amenity,
      address.attraction,
      address.building,
      address.shop,
      address.tourism,
      address.leisure,
      address.office,
      address.historic,
      address.man_made,
      address.commercial,
      address.retail
    ]));
  }

  function buildDisplayNameFallback(data) {
    var raw = String((data && data.display_name) || "").trim();
    if (!raw) return "";

    return uniqueTextParts(raw.split(",").map(function (part) {
      return String(part || "").trim();
    }).filter(function (part) {
      if (!part) return false;
      if (/^\d{4,}$/.test(part)) return false;
      return part.toLowerCase() !== "philippines";
    })).slice(0, 5).join(", ");
  }

  function buildAutofillLocationString(data, context, lat, lng) {
    var address = (data && data.address) || {};
    var landmark = buildLandmarkLabel(address);
    var street = buildStreetLabel(address);
    var barangay = cleanBarangayLabel(pickFirstValue([
      address.suburb,
      address.village,
      address.neighbourhood,
      address.quarter,
      address.hamlet,
      context && context.barangay
    ]));
    var city = titleCase(normalizeCityName(pickFirstValue([
      address.city,
      address.town,
      address.municipality,
      address.city_district,
      address.state_district,
      context && context.city
    ])));
    var province = titleCase(normalizeProvinceName(pickFirstValue([
      address.province,
      address.state,
      address.region,
      address.county,
      context && context.province
    ])));
    var fallbackDisplayName = buildDisplayNameFallback(data);

    var exactParts = uniqueTextParts([landmark, street, barangay, city, province]);
    if (exactParts.length) return exactParts.join(", ");
    if (fallbackDisplayName) return fallbackDisplayName;

    var coordText = (isFiniteNumber(lat) && isFiniteNumber(lng))
      ? Number(lat).toFixed(5) + ", " + Number(lng).toFixed(5)
      : "";

    var contextParts = uniqueTextParts([barangay, city, province]);
    if (contextParts.length && coordText) return contextParts.join(", ") + " (" + coordText + ")";
    if (contextParts.length) return contextParts.join(", ");
    if (coordText) return "Pinned location (" + coordText + ")";
    return "";
  }

  function applyAutofillLocationToInput(data, context, lat, lng) {
    var locationInput = document.getElementById("reportLocation");
    if (!locationInput) return;

    var address = (data && data.address) || {};
    var locationValue = buildAutofillLocationString(data, context, lat, lng);
    var landmark = buildLandmarkLabel(address);

    if (locationValue) {
      locationInput.value = locationValue;
    }

    if (landmark) {
      locationInput.setAttribute("data-current-landmark", landmark);
    } else {
      locationInput.removeAttribute("data-current-landmark");
    }

    if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
      locationInput.setAttribute("data-lat", String(lat));
      locationInput.setAttribute("data-lng", String(lng));
    }

    locationInput.dispatchEvent(new Event("input", { bubbles: true }));
    locationInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyGpsFallbackLocationToInput(context, lat, lng) {
    applyAutofillLocationToInput({
      display_name: "",
      address: {
        suburb: context && context.barangay,
        city: context && context.city,
        province: context && context.province
      }
    }, context, lat, lng);
  }

  function extractContextFromReverseData(data, lat, lng, previousContext) {
    var address = (data && data.address) || {};
    var inferred = inferAreaFromKnownReports(lat, lng) || {};

    var province = pickFirstValue([
      address.province,
      address.state,
      address.region,
      address.county,
      inferred.province,
      previousContext && previousContext.province
    ]);

    var city = pickFirstValue([
      address.city,
      address.town,
      address.municipality,
      address.city_district,
      address.state_district,
      inferred.city,
      previousContext && previousContext.city
    ]);

    var barangay = pickFirstValue([
      address.suburb,
      address.village,
      address.neighbourhood,
      address.quarter,
      address.hamlet,
      inferred.barangay,
      previousContext && previousContext.barangay
    ]);

    return sanitizeContext({
      userId: currentContext.userId,
      displayName: currentContext.displayName,
      role: currentContext.role,
      verified: currentContext.verified,
      province: province,
      city: city,
      barangay: barangay,
      lat: lat,
      lng: lng,
      coverageLevel: currentContext.coverageLevel,
      coverageRadiusKm: currentContext.coverageRadiusKm,
      locationSource: "gps"
    });
  }

  function updateLocationLabels() {
    var label = buildLocationLabel(currentContext.barangay, currentContext.city, currentContext.province);

    ["currentLocationLabel", "communityAreaLabel", "currentAreaBadge"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = label;
    });

    var cityEl = document.getElementById("currentCityLabel");
    if (cityEl) cityEl.textContent = currentContext.city || "Unknown city";

    var barangayEl = document.getElementById("currentBarangayLabel");
    if (barangayEl) barangayEl.textContent = currentContext.barangay || "Unknown barangay";
  }

  function isSameArea(report) {
    if (!report) return false;

    if (currentContext.city && report.city && normalizeCityName(report.city).toLowerCase() === normalizeCityName(currentContext.city).toLowerCase()) {
      if (!currentContext.barangay || !report.barangay) return true;
      if (report.barangay.toLowerCase() === currentContext.barangay.toLowerCase()) return true;
    }

    if (isFiniteNumber(currentContext.lat) && isFiniteNumber(currentContext.lng) && isFiniteNumber(report.lat) && isFiniteNumber(report.lng)) {
      return distanceKm(currentContext.lat, currentContext.lng, report.lat, report.lng) <= Number(currentContext.coverageRadiusKm || 10);
    }

    if (!currentContext.city && !currentContext.barangay) return true;
    return false;
  }

  function getVisibleReports() {
    return reports.filter(isSameArea).sort(function (a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  }

  function getUserVote(reportId) {
    return localVotes[String(reportId)] || "";
  }

  function canVerifyReport(report) {
    if (!report) return false;
    if (!isSameArea(report)) return false;
    if (getUserVote(report.id)) return false;
    return true;
  }

  function getHazardToneClass(hazard) {
    var value = normalizeHazard(hazard);

    if (value === "Flood") return "hazard-tone-flood";
    if (value === "Fire") return "hazard-tone-fire";
    if (value === "Storm") return "hazard-tone-storm";
    if (value === "Road Block") return "hazard-tone-roadblock";
    if (value === "Earthquake") return "hazard-tone-earthquake";
    return "hazard-tone-medical";
  }

  function getHazardIconSvg(hazard) {
    var value = normalizeHazard(hazard);

    if (value === "Flood") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 15c-.9 0-1.74-.26-2.45-.72A4.98 4.98 0 0 1 2 10c0-2.76 2.24-5 5-5 .34 0 .68.03 1.01.1A5.99 5.99 0 0 1 19 8a4 4 0 0 1 1 7.87" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0 2 .8 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 21c1 .8 2 .8 3 0s2-.8 3 0 2 .8 3 0 2-.8 3 0 2 .8 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }

    if (value === "Fire") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2.5c1.7 2.05 2.28 4 .94 5.93-.54.78-1.39 1.47-2.08 2.21C10.08 11.72 9 13.23 9 15a3 3 0 0 0 6 0c0-1.52-.74-2.62-1.77-3.84-.56-.67-.86-1.42-.74-2.36.08-.62.27-1.11.71-1.92Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.05 11.2c-1.46 1.07-2.05 2.05-2.05 3.15a2 2 0 0 0 4 0c0-.82-.33-1.45-1.05-2.25-.41-.46-.62-.98-.56-1.73-.13.15-.22.28-.34.41Z" fill="currentColor" opacity=".28"/><path d="M12 10.9c-1.25.98-1.8 1.86-1.8 2.88a1.8 1.8 0 0 0 3.6 0c0-.74-.31-1.31-.96-2.03-.36-.4-.56-.86-.52-1.5-.09.1-.18.2-.32.34Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    if (value === "Storm") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 13h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 17h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 6c1.1 0 2-.9 2-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 6c2.21 0 4 1.79 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }

    if (value === "Road Block") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.5 8 8 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.5 8 16 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 13h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 18h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m5 5 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }

    if (value === "Earthquake") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 19h18L12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg>';
    }

    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  }

  function getMetaChips(report) {
    var chips = [];
    if (report.quickSummary && report.quickSummary.length) {
      chips = chips.concat(report.quickSummary);
    }
    if (report.hasPhoto) chips.push("Photo attached");
    if (report.status) chips.push(report.status);
    return chips.slice(0, 4);
  }

  function renderVerificationList() {
    var verificationList = document.getElementById("verificationList");
    if (!verificationList) return;

    var visibleReports = getVisibleReports();
    if (!visibleReports.length) {
      verificationList.innerHTML = '<div class="verification-card confidence-low"><h3>No nearby community alerts yet</h3><p class="verification-author">Reports will appear once your area is detected or when users near you submit reports.</p></div>';
      return;
    }

    verificationList.innerHTML = visibleReports.map(function (report) {
      var confidence = computeConfidence(report);
      var confidenceClass = getConfidenceClass(confidence);
      var chips = getMetaChips(report);
      var voteState = getUserVote(report.id);
      var canVote = canVerifyReport(report);

      return '' +
        '<div class="verification-card ' + confidenceClass + '" data-report-id="' + escapeHtml(report.id) + '" data-confidence="' + confidence + '">' +
          '<div class="verification-top">' +
            '<div class="verification-meta-left">' +
              '<span class="verification-type-badge ' + getHazardToneClass(report.hazard) + '"><span class="verification-type-icon hazard-badge-icon">' + getHazardIconSvg(report.hazard) + '</span><span>' + escapeHtml(report.hazard.toUpperCase()) + '</span></span>' +
              '<span class="verification-time">' + escapeHtml(getTimeAgo(report.createdAt)) + '</span>' +
            '</div>' +
            '<div class="verification-score-wrap">' +
              '<span class="verification-score-label">CONFIDENCE</span>' +
              '<strong class="verification-score">' + confidence + '%</strong>' +
            '</div>' +
          '</div>' +
          '<h3>' + escapeHtml(report.location) + '</h3>' +
          '<p class="verification-author">by ' + escapeHtml(report.author) + ' • ' + escapeHtml(getRoleLabel(report.role)) + '</p>' +
          '<p class="verification-desc">' + escapeHtml(truncateText(report.description, 150)) + '</p>' +
          (chips.length ? '<div class="verification-chip-row">' + chips.map(function (chip) {
            return '<span class="verification-chip">' + escapeHtml(chip) + '</span>';
          }).join("") + '</div>' : '') +
          '<div class="confidence-bar"><span class="confidence-fill" style="width:' + confidence + '%"></span></div>' +
          '<div class="verification-actions">' +
            '<button type="button" class="verify-btn confirm-btn' + (voteState === 'confirm' ? ' active' : '') + '" data-action="confirm" ' + (!canVote ? 'disabled' : '') + ' onclick="verifyCommunity(this, true)"><span>👍</span> CONFIRM (' + Math.round(report.confirmWeight) + ')</button>' +
            '<button type="button" class="verify-btn reject-btn' + (voteState === 'reject' ? ' active' : '') + '" data-action="reject" ' + (!canVote ? 'disabled' : '') + ' onclick="verifyCommunity(this, false)"><span>👎</span> REJECT (' + Math.round(report.rejectWeight) + ')</button>' +
          '</div>' +
        '</div>';
    }).join("");
  }
  function applyCurrentContext(context, options) {
    currentContext = sanitizeContext(context);
    window.HANDAVIS_CURRENT_CONTEXT = currentContext;
    updateLocationLabels();
    renderVerificationList();

    if (!(options && options.silent)) {
      showToast("Showing community alerts near " + buildLocationLabel(currentContext.barangay, currentContext.city, currentContext.province) + ".");
    }
  }

  function findPotentialDuplicate(hazard, location, description) {
    var cleanLocation = String(location || "").toLowerCase();
    var cleanDescription = String(description || "").toLowerCase();

    for (var i = 0; i < reports.length; i += 1) {
      var report = reports[i];
      var recentEnough = Date.now() - Number(report.createdAt || 0) <= 90 * 60 * 1000;
      if (!recentEnough) continue;
      if (normalizeHazard(report.hazard) !== normalizeHazard(hazard)) continue;

      var sameCity = currentContext.city && report.city && report.city.toLowerCase() === currentContext.city.toLowerCase();
      var closeBy = isFiniteNumber(currentContext.lat) && isFiniteNumber(currentContext.lng) && isFiniteNumber(report.lat) && isFiniteNumber(report.lng) && distanceKm(currentContext.lat, currentContext.lng, report.lat, report.lng) <= 1.5;
      var textMatch = report.location.toLowerCase().indexOf(cleanLocation) !== -1 || cleanLocation.indexOf(report.location.toLowerCase()) !== -1 || report.description.toLowerCase().indexOf(cleanDescription.slice(0, 25)) !== -1;

      if ((sameCity || closeBy) && textMatch) {
        return report;
      }
    }

    return null;
  }

  function submitUserReport() {
    var locationInput = document.getElementById("reportLocation");
    var descriptionInput = document.getElementById("reportDescription");
    var photoInput = document.getElementById("reportPhoto");

    var location = locationInput ? locationInput.value.trim() : "";
    var description = descriptionInput ? descriptionInput.value.trim() : "";
    var hasPhoto = !!(photoInput && photoInput.files && photoInput.files[0]);
    var details = getQuickDetails();
    var quickSummary = getQuickSummary(details);

    if (!location) {
      showToast("Please enter the exact location or barangay.");
      if (locationInput) locationInput.focus();
      return;
    }

    if (!description) {
      showToast("Please enter a short but clear description.");
      if (descriptionInput) descriptionInput.focus();
      return;
    }

    var duplicate = findPotentialDuplicate(selectedHazard, location, description);
    if (duplicate) {
      var mergeVote = window.confirm("A similar report already exists nearby. Press OK to confirm that report instead, or Cancel to submit a separate one.");
      if (mergeVote) {
        castVote(duplicate.id, true);
        return;
      }
    }

    var payload = {
      hazard: normalizeHazard(selectedHazard),
      location: location,
      description: description,
      rescueNeeded: rescueNeeded,
      lat: currentContext.lat,
      lng: currentContext.lng,
      province: currentContext.province || "",
      city: currentContext.city || "",
      barangay: currentContext.barangay || "",
      peopleAffected: details.peopleAffected || "",
      injuries: details.injuries || "",
      roadStatus: details.roadStatus || "",
      hazardDetail: details.hazardDetail || ""
    };

    var newReport = {
      id: "rep-user-" + Date.now(),
      hazard: normalizeHazard(selectedHazard),
      province: currentContext.province,
      city: currentContext.city,
      barangay: currentContext.barangay,
      location: location,
      description: description,
      author: currentContext.displayName || "Anonymous",
      role: currentContext.verified ? "verified_resident" : currentContext.role,
      lat: currentContext.lat,
      lng: currentContext.lng,
      hasPhoto: hasPhoto,
      rescueNeeded: rescueNeeded,
      confirmWeight: getRoleWeight(currentContext.verified ? "verified_resident" : currentContext.role),
      rejectWeight: 0,
      createdAt: Date.now(),
      quickSummary: quickSummary,
      status: "Pending Verification"
    };

    fetch("database/hazard_reports.php?action=submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (result) {
          if (!response.ok || !result || !result.ok) {
            var message = (result && result.error) ? result.error : "Failed to save report to database.";
            throw new Error(message);
          }
          return result;
        });
      })
      .then(function (result) {
        if (result.id) {
          newReport.id = result.id;
        }

        reports.unshift(newReport);
        resetReportForm();
        renderVerificationList();
        if (result.statusLabel) {
          newReport.status = String(result.statusLabel);
        }
        showToast("Hazard report submitted. Status: " + (newReport.status || "Pending Verification") + ".");
      })
      .catch(function (error) {
        showToast((error && error.message) ? error.message : "Failed to save report to database.");
      });
  }

  function resetDetailSelections() {
    detailState.peopleAffected = "1-5";
    detailState.injuries = "None";
    detailState.roadStatus = "Passable";
    detailState.hazardDetail = (hazardConfigs[selectedHazard] || hazardConfigs["Flood"]).options[0];

    selectDetail(document.querySelector("#peopleAffectedRow .detail-chip"), "peopleAffected", detailState.peopleAffected);
    selectDetail(document.querySelector("#injuriesRow .detail-chip"), "injuries", detailState.injuries);
    selectDetail(document.querySelector("#roadStatusRow .detail-chip"), "roadStatus", detailState.roadStatus);
    renderHazardSpecificOptions();
  }

  function resetReportForm() {
    var locationInput = document.getElementById("reportLocation");
    var descInput = document.getElementById("reportDescription");
    var photoInput = document.getElementById("reportPhoto");
    var photoLabel = document.getElementById("photoLabelText");
    var rescueBtn = document.getElementById("rescueNeededBtn");

    if (locationInput) {
      locationInput.value = "";
      locationInput.removeAttribute("data-current-landmark");
      locationInput.removeAttribute("data-lat");
      locationInput.removeAttribute("data-lng");
    }
    if (descInput) descInput.value = "";
    if (photoInput) photoInput.value = "";
    if (photoLabel) photoLabel.textContent = "ADD PHOTO";

    rescueNeeded = false;
    if (rescueBtn) rescueBtn.classList.remove("active");

    resetDetailSelections();
  }

  function findReportById(reportId) {
    for (var i = 0; i < reports.length; i += 1) {
      if (String(reports[i].id) === String(reportId)) return reports[i];
    }
    return null;
  }

  function castVote(reportId, accepted) {
    var report = findReportById(reportId);
    if (!report) {
      showToast("Report not found.");
      return;
    }

    if (!canVerifyReport(report)) {
      showToast("You can only verify nearby alerts once.");
      return;
    }

    var effectiveRole = currentContext.verified ? "verified_resident" : currentContext.role;
    var weight = getRoleWeight(effectiveRole);

    fetch("database/hazard_reports.php?action=verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: String(reportId),
        action: accepted ? "confirm" : "reject"
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (!result || !result.ok) {
          throw new Error("vote failed");
        }

        if (accepted) {
          report.confirmWeight += weight;
          localVotes[String(reportId)] = "confirm";
        } else {
          report.rejectWeight += weight;
          localVotes[String(reportId)] = "reject";
        }

        writeLocalVotes();
        renderVerificationList();
        showToast(accepted ? "Local confirmation added." : "Marked for local review.");
      })
      .catch(function () {
        showToast("Failed to save verification.");
      });
  }

  function verifyCommunity(btn, accepted) {
    var card = btn && btn.closest ? btn.closest(".verification-card") : null;
    if (!card) return;

    var reportId = card.getAttribute("data-report-id");
    castVote(reportId, accepted);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      showToast("Your browser does not support current location.");
      return;
    }

    showToast("Getting your current location...");

    navigator.geolocation.getCurrentPosition(function (position) {
      var lat = position.coords.latitude;
      var lng = position.coords.longitude;
      var accuracy = Number(position.coords.accuracy || 0);

      if (accuracy > 3000) {
        showToast("Your browser location is very approximate. Try enabling more precise location first.");
      }

      var inferred = inferAreaFromKnownReports(lat, lng);
      var nextBaseContext;

      if (inferred) {
        nextBaseContext = Object.assign({}, currentContext, inferred, {
          lat: lat,
          lng: lng,
          locationSource: "gps"
        });
      } else {
        nextBaseContext = Object.assign({}, currentContext, {
          lat: lat,
          lng: lng,
          locationSource: "gps"
        });
      }

      applyCurrentContext(nextBaseContext, { silent: true });
      applyGpsFallbackLocationToInput(nextBaseContext, lat, lng);

      if (reverseGeocodeTimer) clearTimeout(reverseGeocodeTimer);
      reverseGeocodeTimer = setTimeout(function () {
        fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng) + "&zoom=18&addressdetails=1", {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        })
          .then(function (response) {
            if (!response.ok) throw new Error("Reverse geocode failed");
            return response.json();
          })
          .then(function (data) {
            var nextContext = extractContextFromReverseData(data, lat, lng, currentContext);
            applyCurrentContext(nextContext, { silent: true });
            applyAutofillLocationToInput(data, nextContext, lat, lng);
            showToast("Current location added to the report field.");
          })
          .catch(function () {
            applyGpsFallbackLocationToInput(currentContext, lat, lng);
            showToast("GPS location added. Exact landmark was not found.");
            renderVerificationList();
          });
      }, 100);
    }, function () {
      showToast("Unable to get your current location.");
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    });
  }

  function bindLocationButton() {
    ["useCurrentLocationBtn", "currentLocationBtn", "detectLocationBtn"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", useCurrentLocation);
      }
    });
  }

  function bootstrapFromActiveHazard() {
    var activeHazard = document.querySelector("#quickTypes .hazard-card.active, #quickTypes .quick-type.active");
    if (activeHazard) {
      selectedHazard = normalizeHazard(activeHazard.textContent || "Flood");
    }
  }

  function init() {
    if (typeof window.loadTheme === "function") {
      window.loadTheme();
    }

    bootstrapFromActiveHazard();
    bindLocationButton();
    renderHazardSpecificOptions();
    toggleHazardSpecificFields();
    resetDetailSelections();
    updateLocationLabels();
    renderVerificationList();
  }

  window.showToast = showToast;
  window.selectQuick = selectQuick;
  window.selectDetail = selectDetail;
  window.toggleRescueNeeded = toggleRescueNeeded;
  window.handlePhotoName = handlePhotoName;
  window.submitUserReport = submitUserReport;
  window.verifyCommunity = verifyCommunity;
  window.useCurrentLocation = useCurrentLocation;
  window.HANDAVIS = window.HANDAVIS || {};
  window.HANDAVIS.getContext = function () { return currentContext; };
  window.HANDAVIS.setContext = function (context) { applyCurrentContext(context); };
  window.HANDAVIS.setReports = function (nextReports) {
    reports = sanitizeReports(nextReports || []);
    renderVerificationList();
  };
  window.HANDAVIS.refreshReportsByContext = renderVerificationList;

  document.addEventListener("DOMContentLoaded", init);
})();

