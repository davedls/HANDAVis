
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
    return;
  }

  function setTextIfExists(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHtmlIfExists(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }


  function advisoryToneFor(level) {
    return {
      danger: { dot: 'dot-danger', badge: 'badge-danger', label: 'DANGER' },
      critical: { dot: 'dot-danger', badge: 'badge-danger', label: 'DANGER' },
      warning: { dot: 'dot-warning', badge: 'badge-warning', label: 'WARNING' },
      watch: { dot: 'dot-watch', badge: 'badge-watch', label: 'WATCH' },
      info: { dot: 'dot-watch', badge: 'badge-watch', label: 'INFO' }
    }[level] || { dot: 'dot-watch', badge: 'badge-watch', label: String(level || 'INFO').toUpperCase() };
  }

  function sourcePill(type) {
    return type === 'news' ? 'Outlet report' : 'Official';
  }

  function buildAdvisoryItemHtml(item, index) {
    var tone = advisoryToneFor(item.level || 'info');
    var body = item.summary || item.body || 'Open the source link for more details.';
    var metaArea = item.area ? 'Areas: ' + item.area : (item.published_at ? 'Updated: ' + item.published_at : 'Live feed');
    var link = item.url ? '<a class="advisory-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">Open source</a>' : '';
    return (
      '<div class="advisory-item">' +
        '<div class="advisory-meta">' +
          '<span class="advisory-dot ' + tone.dot + '"></span>' +
          '<span class="advisory-badge ' + tone.badge + '">' + escapeHtml(tone.label) + '</span>' +
          '<span class="advisory-source">' + escapeHtml(item.source || 'Feed') + '</span>' +
          '<span class="advisory-source advisory-source-type">' + escapeHtml(sourcePill(item.type)) + '</span>' +
        '</div>' +
        '<div class="advisory-headline">' + escapeHtml(item.title || 'Live advisory') + '</div>' +
        '<div class="advisory-body">' + escapeHtml(body) + '</div>' +
        '<div class="advisory-areas">' + escapeHtml(metaArea) + '</div>' +
        link +
      '</div>' +
      (index === -1 ? '' : '<div class="advisory-divider"></div>')
    );
  }

  async function fetchJson(url) {
    var response = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load live feed');
    return response.json();
  }

  function updateTopBannerFromFeed(items) {
    if (!items || !items.length) return;
    var top = items[0];
    var strongEl = document.querySelector('.alert-banner strong');
    var spanEl = document.querySelector('.alert-banner span');
    var pillEl = document.querySelector('.alert-pill');
    if (strongEl) strongEl.textContent = '⚠ ' + (top.title || 'Live advisory');
    if (spanEl) spanEl.textContent = top.summary || top.body || 'Open the advisory feed for details.';
    if (pillEl) pillEl.textContent = advisoryToneFor(top.level || 'info').label;
  }

  function updateLiveTriggerCard() {
    var officialItems = state.liveFeed.filter(function (item) { return item.type === 'official'; });
    var trigger = officialItems[0] || state.liveFeed[0] || null;
    if (!trigger) {
      setTextIfExists('radarLiveTrigger', 'Waiting for Western Visayas feed');
      setTextIfExists('radarLiveTriggerMeta', 'The strongest matching regional or local advisory will appear here.');
      return;
    }
    var triggerTitle = trigger.title || 'Western Visayas advisory';
    var triggerMeta = [trigger.source || 'Feed', trigger.area || locations[state.location].label].filter(Boolean).join(' • ');
    if (trigger.published_at) triggerMeta += ' • ' + trigger.published_at;
    setTextIfExists('radarLiveTrigger', triggerTitle);
    setTextIfExists('radarLiveTriggerMeta', triggerMeta || 'Western Visayas live feed');
  }

  function renderLiveAdvisories(payload) {
    var list = document.getElementById('liveAdvisoryList');
    if (!list) return;
    var items = Array.isArray(payload.items) ? payload.items : [];
    state.liveFeed = items;
    state.liveFeedMeta = payload.meta || null;
    state.liveFeedFetchedAt = payload.fetched_at || null;
    if (!items.length) {
      list.innerHTML = '<div class="advisory-item advisory-loading-card"><div class="advisory-meta"><span class="advisory-dot dot-watch"></span><span class="advisory-badge badge-watch">INFO</span><span class="advisory-source">Western Visayas Feed</span></div><div class="advisory-headline">No Western Visayas items returned</div><div class="advisory-body">The feed is reachable, but there are no matching Western Visayas items for the selected scenario and location right now.</div><div class="advisory-areas">Areas: ' + escapeHtml(locations[state.location].label) + '</div></div>';
      setTextIfExists('advisoryStatusText', 'Connected, but no matching Western Visayas items were returned for this filter.');
      updateLiveTriggerCard();
      return;
    }
    list.innerHTML = items.map(function (item, index) {
      var html = buildAdvisoryItemHtml(item, index < items.length - 1 ? index : -1);
      return html;
    }).join('');
    setTextIfExists('advisoryStatusText', (payload.meta && payload.meta.summary ? payload.meta.summary : 'Showing Western Visayas advisories for ') + locations[state.location].label + '.');
    updateTopBannerFromFeed(items);
    var officialCount = items.filter(function (item) { return item.type === 'official'; }).length;
    var newsCount = items.filter(function (item) { return item.type === 'news'; }).length;
    setTextIfExists('radarFeedStatus', 'WV only • ' + officialCount + ' official • ' + newsCount + ' regional');
    updateLiveTriggerCard();
    updateRadarDecision();
  }

  async function loadLiveAdvisories(force) {
    try {
      if (force) setTextIfExists('advisoryStatusText', 'Refreshing Western Visayas advisories…');
      var url = 'live_alerts_feed.php?location=' + encodeURIComponent(state.location) + '&scenario=' + encodeURIComponent(state.scenario) + '&severity=' + encodeURIComponent(state.severity);
      var payload = await fetchJson(url);
      renderLiveAdvisories(payload);
    } catch (err) {
      console.error(err);
      setTextIfExists('advisoryStatusText', 'Western Visayas live feed unavailable right now. Keeping the last visible state.');
      setTextIfExists('radarFeedStatus', 'Live feed unavailable');
    }
  }

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () {
      toast.style.display = 'none';
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var state = {
    scenario: 'flood',
    location: 'bacolod',
    severity: 'high',
    time: 'now',
    expanded: { impact: false, action: false },
    userPosition: null,
    lastRoute: null,
    routeOptions: [],
    activeRouteKey: null,
    routeBusy: false,
    mapReady: false,
    threatMapReady: false,
    routePreferredPlaceId: null,
    liveFeed: [],
    liveFeedMeta: null,
    liveFeedFetchedAt: null,
    radarFrames: [],
    radarHost: '',
    lastThreatRefreshAt: null
  };

  var severityLabels = {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
    critical: 'Critical'
  };

  var timeLabels = {
    now: 'Now',
    '6h': 'Next 6 Hours',
    '12h': 'Next 12 Hours',
    '24h': 'Next 24 Hours'
  };

  var scenarioThemes = {
    flood: { rgb: '95,216,255', soft: 'rgba(95,216,255,.14)', border: 'rgba(95,216,255,.28)', text: '#88d8ff' },
    fire: { rgb: '255,140,92', soft: 'rgba(255,140,92,.14)', border: 'rgba(255,140,92,.28)', text: '#ffb28c' },
    storm: { rgb: '170,163,255', soft: 'rgba(170,163,255,.14)', border: 'rgba(170,163,255,.28)', text: '#c5c1ff' }
  };

  var severityThemes = {
    low: { rgb: '85,214,118', soft: 'rgba(85,214,118,.14)', border: 'rgba(85,214,118,.28)', text: '#aaf3bd' },
    moderate: { rgb: '255,193,79', soft: 'rgba(255,193,79,.14)', border: 'rgba(255,193,79,.28)', text: '#ffe5a0' },
    high: { rgb: '255,144,77', soft: 'rgba(255,144,77,.14)', border: 'rgba(255,144,77,.28)', text: '#ffcfac' },
    critical: { rgb: '255,84,84', soft: 'rgba(255,84,84,.14)', border: 'rgba(255,84,84,.28)', text: '#ffb0b0' }
  };

  var locations = {
    bacolod: {
      label: 'Bacolod City',
      center: [10.6766, 122.9511],
      floodArea: 'Tangub, Mandalagan, Taculing, and nearby low-lying drainage zones',
      fireArea: 'dense roadside commercial strips, market-side stalls, and warehouse-adjacent blocks',
      stormArea: 'coastal barangays, exposed highways, and open drainage corridors',
      safePlaces: [
        {
          id: 'bcgc',
          name: 'Bacolod City Government Center',
          address: 'Circumferential Rd, Brgy. Villamonte, Bacolod City',
          note: 'Primary city government and response coordination point. Confirm your barangay-designated evacuation center here if relocation is advised.',
          kind: 'command',
          priority: { flood: 1, fire: 2, storm: 1 },
          query: 'Bacolod City Government Center, Villamonte, Bacolod City, Philippines'
        },
        {
          id: 'clmmrh',
          name: 'Corazon Locsin Montelibano Memorial Regional Hospital',
          address: 'Lacson St, Bacolod City',
          note: 'Best for urgent medical referral, smoke inhalation, burns, and flood-related trauma.',
          kind: 'medical',
          priority: { flood: 3, fire: 1, storm: 3 },
          query: 'Corazon Locsin Montelibano Memorial Regional Hospital, Bacolod City, Philippines'
        },
        {
          id: 'panaad',
          name: 'Panaad Park and Stadium',
          address: 'Brgy. Mansilingan, Bacolod City',
          note: 'Large open public complex useful for staging, relief distribution, and moving away from dense fire or flooded blocks.',
          kind: 'open',
          priority: { flood: 2, fire: 1, storm: 2 },
          query: 'Panaad Park and Stadium, Bacolod City, Philippines'
        }
      ],
      contacts: [
        { name: 'Bacolod DRRMO Hotline', number: '(034) 432-3871', call: '0344323871', detail: '24/7 city DRRMO hotline.' },
        { name: 'Bacolod DRRMO Mobile', number: '0930 243 4706', call: '+639302434706', sms: '+639302434706', detail: 'City DRRMO hotline cp number.' },
        { name: 'National Emergency Hotline', number: '911', call: '911', detail: 'Nationwide emergency dispatch.' },
        { name: 'Philippine Red Cross', number: '143', call: '143', detail: 'National rescue and ambulance hotline.' }
      ]
    },
    iloilo: {
      label: 'Iloilo City',
      center: [10.7202, 122.5621],
      floodArea: 'Molo, Jaro, La Paz, and river-adjacent roads',
      fireArea: 'dense commercial strips, market-side blocks, and warehouse corridors',
      stormArea: 'coastal barangays, open arterial roads, and low-drainage routes',
      safePlaces: [
        {
          id: 'icare',
          name: 'Iloilo CDRRMO Operations Center',
          address: 'Gaisano ICARE, Gaisano ICC Compound, Brgy. San Rafael, Mandurriao, Iloilo City',
          note: 'Official Iloilo City DRRMO support point and emergency coordination hub.',
          kind: 'command',
          priority: { flood: 1, fire: 2, storm: 1 },
          query: 'Gaisano ICARE, Gaisano ICC Compound, Barangay San Rafael, Mandurriao, Iloilo City, Philippines'
        },
        {
          id: 'wvmc',
          name: 'Western Visayas Medical Center',
          address: 'Q. Abeto St, Mandurriao, Iloilo City',
          note: 'Major medical referral center for injury, smoke inhalation, and storm trauma.',
          kind: 'medical',
          priority: { flood: 3, fire: 1, storm: 3 },
          query: 'Western Visayas Medical Center, Iloilo City, Philippines'
        },
        {
          id: 'cityhalliloilo',
          name: 'Iloilo City Hall',
          address: 'Plaza Libertad, Iloilo City',
          note: 'Central public assistance point and a good fallback civic landmark during disruptions.',
          kind: 'government',
          priority: { flood: 2, fire: 2, storm: 2 },
          query: 'Iloilo City Hall, Iloilo City, Philippines'
        }
      ],
      contacts: [
        { name: 'Iloilo City Operations Center', number: '0919 066 2333', call: '+639190662333', sms: '+639190662333', detail: 'Official Iloilo City Operations Center hotline.' },
        { name: 'ICER / USAR', number: '0919 066 1554', call: '+639190661554', sms: '+639190661554', detail: 'Iloilo City Emergency Response / Urban Search and Rescue.' },
        { name: 'BFP Search and Rescue', number: '(033) 337-3011', call: '0333373011', detail: 'Iloilo City BFP search and rescue line.' },
        { name: 'National Emergency Hotline', number: '911', call: '911', detail: 'Nationwide emergency dispatch.' }
      ]
    },
    capiz: {
      label: 'Roxas / Capiz',
      center: [11.5850, 122.7513],
      floodArea: 'riverbanks, low bridges, and low-lying residential roads',
      fireArea: 'dense settlement rows, port-adjacent stores, and public market blocks',
      stormArea: 'coastal communities, fish port approaches, and exposed road sections',
      safePlaces: [
        {
          id: 'roxascityhall',
          name: 'Roxas City Hall',
          address: 'Arnaldo Boulevard, Roxas City, Capiz',
          note: 'Main city government landmark and coordination point for public assistance.',
          kind: 'government',
          priority: { flood: 2, fire: 2, storm: 2 },
          query: 'Roxas City Hall, Roxas City, Capiz, Philippines'
        },
        {
          id: 'rmph',
          name: 'Roxas Memorial Provincial Hospital',
          address: 'Roxas Ave, Roxas City, Capiz',
          note: 'Medical referral center for burns, injuries, and emergency treatment.',
          kind: 'medical',
          priority: { flood: 3, fire: 1, storm: 3 },
          query: 'Roxas Memorial Provincial Hospital, Roxas City, Capiz, Philippines'
        },
        {
          id: 'villareal',
          name: 'Villareal Stadium',
          address: 'Roxas Ave, Roxas City, Capiz',
          note: 'Large open public space that can serve as a safer staging or relocation landmark away from dense hazard zones.',
          kind: 'open',
          priority: { flood: 1, fire: 1, storm: 1 },
          query: 'Villareal Stadium, Roxas City, Capiz, Philippines'
        }
      ],
      contacts: [
        { name: 'Roxas City CERT Landline', number: '(036) 522-7878', call: '0365227878', detail: 'Official Roxas City CERT line.' },
        { name: 'Roxas City CERT Globe', number: '0917 306 6741', call: '+639173066741', sms: '+639173066741', detail: 'Official Roxas City CERT mobile line.' },
        { name: 'Roxas City CERT Smart', number: '0912 472 2669', call: '+639124722669', sms: '+639124722669', detail: 'Official Roxas City CERT mobile line.' },
        { name: 'National Emergency Hotline', number: '911', call: '911', detail: 'Nationwide emergency dispatch.' }
      ]
    },
    antique: {
      label: 'Antique Coast',
      center: [10.7446, 121.9410],
      floodArea: 'coastal lowlands, river mouths, and overflow-prone access roads',
      fireArea: 'closely packed homes, roadside shops, and fishing-port service strips',
      stormArea: 'coastal barangays, exposed sea-facing roads, and hillside edge routes',
      safePlaces: [
        {
          id: 'sjhall',
          name: 'San Jose de Buenavista Municipal Hall',
          address: 'San Jose de Buenavista, Antique',
          note: 'Main municipal government landmark and public assistance point in the provincial capital area.',
          kind: 'government',
          priority: { flood: 2, fire: 2, storm: 2 },
          query: 'San Jose de Buenavista Municipal Hall, Antique, Philippines'
        },
        {
          id: 'angel',
          name: 'Angel Salazar Memorial General Hospital',
          address: 'San Jose de Buenavista, Antique',
          note: 'Medical referral point for injuries, storm trauma, and smoke exposure.',
          kind: 'medical',
          priority: { flood: 3, fire: 1, storm: 3 },
          query: 'Angel Salazar Memorial General Hospital, San Jose de Buenavista, Antique, Philippines'
        },
        {
          id: 'capitol',
          name: 'Antique Provincial Capitol',
          address: 'San Jose de Buenavista, Antique',
          note: 'Central provincial landmark that can serve as a safer inland support point during coastal or storm impact.',
          kind: 'command',
          priority: { flood: 1, fire: 2, storm: 1 },
          query: 'Antique Provincial Capitol, San Jose de Buenavista, Antique, Philippines'
        }
      ],
      contacts: [
        { name: 'San Jose MDRRMO', number: '0917 709 6603', call: '+639177096603', sms: '+639177096603', detail: 'Official San Jose de Buenavista MDRRMO hotline.' },
        { name: 'San Jose EMS', number: '0927 815 4185', call: '+639278154185', sms: '+639278154185', detail: 'Official emergency medical services hotline.' },
        { name: 'San Jose EMS Alt', number: '0919 286 8863', call: '+639192868863', sms: '+639192868863', detail: 'Alternate emergency medical services line.' },
        { name: 'National Emergency Hotline', number: '911', call: '911', detail: 'Nationwide emergency dispatch.' }
      ]
    }
  };

  var scenarios = {
    flood: {
      title: "Flood Scenario",
      radarLabel: "FLOOD",
      radarSub: {
        low: "Low Flood Watch",
        moderate: "Moderate Flood Risk",
        high: "High Flood Risk",
        critical: "Critical Flood Threat"
      },
      forecastShort: {
        low: "Minor ponding is possible in {location} if light rain persists.",
        moderate: "Floodwater may begin forming in vulnerable roads across {location}.",
        high: "Projected flood surge may affect low-lying roads in {location}.",
        critical: "Rapid flood rise is possible in the most exposed parts of {location}."
      },
      forecastWindow: {
        now: "Overflow pressure is active now in vulnerable drainage corridors.",
        "6h": "Peak flood spread is most likely within the next 6 hours if rain persists.",
        "12h": "Floodwater may continue rising through the next 12 hours.",
        "24h": "Extended monitoring is needed over the next 24 hours due to repeated rain bands."
      },
      priority: {
        low: "Priority watch areas: {floodArea}.",
        moderate: "Prepare low-lying households near {floodArea}.",
        high: "Highest priority zones: {floodArea}.",
        critical: "Immediate evacuation planning is advised in {floodArea}."
      },
      alertHeadline: {
        low: "Flood watch remains active in {location}.",
        moderate: "Localized flood risk is rising in {location}.",
        high: "Flood risk is high in vulnerable areas of {location}.",
        critical: "Immediate flood danger is possible in parts of {location}."
      },
      alertSummary: {
        low: "Keep monitoring advisories and prepare essentials in case conditions worsen.",
        moderate: "Move important items higher, review routes, and stay alert for evacuation instructions.",
        high: "Prepare your go bag, charge devices, and be ready to leave low-lying homes if advised.",
        critical: "Evacuation readiness should be immediate, especially for households with children, elderly, or PWDs."
      },
      notes: {
        now: "Flood simulation is focused on immediate response actions for the current hour.",
        "6h": "Use the next 6 hours to prepare valuables, supplies, and evacuation readiness.",
        "12h": "Preparedness actions should be completed before the 12-hour risk window.",
        "24h": "Plan for longer shelter, water, medicine, and device-charging needs."
      },
      impacts: {
        low: [
          "Localized ponding may affect parts of {floodArea}.",
          "Short travel delays are possible on drainage-heavy roads.",
          "Ground floors should remain monitored for sudden overflow.",
          "Evacuation is not yet urgent, but readiness should begin."
        ],
        moderate: [
          "Floodwater may affect low roads and homes nearest {floodArea}.",
          "Motorcycles and small vehicles could lose safe passage on selected streets.",
          "Power interruption risk increases in homes near drainage or overflow zones.",
          "Families in single-storey homes should prepare for possible transfer."
        ],
        high: [
          "1 to 3 ft floodwater may affect {floodArea}.",
          "Road access may become limited near riverbanks and drainage choke points.",
          "Power interruption is possible in homes with low ground-floor elevation.",
          "Pre-evacuation is strongly advised for elderly, children, and PWD households."
        ],
        critical: [
          "Fast-rising floodwater may isolate sections of {floodArea}.",
          "Roads and side streets can become impassable with little warning.",
          "Ground-floor living spaces may become unsafe for staying in place.",
          "Immediate evacuation is recommended once official local orders are issued."
        ]
      },
      actions: {
        low: [
          "Check drainage outside your home and bring emergency items together.",
          "Charge at least one phone and power bank.",
          "Monitor official advisories and barangay announcements.",
          "Review the nearest safe shelter before rain intensity increases."
        ],
        moderate: [
          "Move documents, medicines, and electronics above floor level.",
          "Prepare a go bag for at least 24 hours.",
          "Avoid parking or waiting in flood-prone streets.",
          "Make sure every family member knows the evacuation route."
        ],
        high: [
          "Move appliances, documents, and medicine above waist level.",
          "Charge phones and prepare a 24 to 48 hour go bag.",
          "Switch off the main breaker once water enters the home.",
          "Stand by for evacuation instructions and avoid flooded shortcuts."
        ],
        critical: [
          "Evacuate immediately once your barangay or DRRMO issues the order.",
          "Do not attempt to cross moving floodwater on foot or by motorcycle.",
          "Assist elderly, children, and PWD family members first.",
          "Bring only essentials and head to the nearest safe place."
        ]
      }
    },

    fire: {
      title: "Fire Scenario",
      radarLabel: "FIRE",
      radarSub: {
        low: "Low Fire Exposure",
        moderate: "Moderate Fire Risk",
        high: "High Fire Spread Risk",
        critical: "Critical Fire Emergency"
      },
      forecastShort: {
        low: "A small ignition can still spread if exits and wiring are unmanaged in {location}.",
        moderate: "Fire spread could accelerate in dense structures across {location}.",
        high: "High fire spread risk is projected in compact structures in {location}.",
        critical: "Flash spread and thick smoke are possible in the most exposed blocks of {location}."
      },
      forecastWindow: {
        now: "The first minutes after ignition are the most critical for safe exit.",
        "6h": "Any wind increase in the next 6 hours can worsen flame spread and smoke direction.",
        "12h": "Preventive checks should be completed before the next 12-hour window.",
        "24h": "Keep exits and extinguishing tools ready through the next 24 hours."
      },
      priority: {
        low: "Priority watch areas: {fireArea}.",
        moderate: "Reduce ignition risks in {fireArea}.",
        high: "Highest priority zones: {fireArea}.",
        critical: "Immediate evacuation and responder access are critical in {fireArea}."
      },
      alertHeadline: {
        low: "Fire safety monitoring is advised in {location}.",
        moderate: "Fire risk is elevated in dense structures in {location}.",
        high: "High fire spread risk is present in parts of {location}.",
        critical: "A severe fire emergency could develop rapidly in {location}."
      },
      alertSummary: {
        low: "Clear exits, check outlets, and keep extinguishers visible.",
        moderate: "Reduce clutter near exits and check LPG, breakers, and extension lines.",
        high: "Plan the fastest exit route now and keep all family members ready to leave.",
        critical: "Evacuate immediately, stay low beneath smoke, and do not return for valuables."
      },
      notes: {
        now: "Fire simulation emphasizes first-minute evacuation and shutdown decisions.",
        "6h": "Use the next 6 hours to reduce ignition risks and clear exits.",
        "12h": "Inspection and prevention should be finished before the 12-hour window.",
        "24h": "Maintain readiness for fire response and responder access during the next 24 hours."
      },
      impacts: {
        low: [
          "A small fire may still spread through cluttered rooms or exposed wiring.",
          "Smoke can reduce visibility before flames reach outer rooms.",
          "Poorly marked exits slow evacuation time.",
          "Prevention is the main goal at this level."
        ],
        moderate: [
          "Fire may spread more quickly across closely packed structures in {fireArea}.",
          "Smoke inhalation becomes the main danger before flames cross full rooms.",
          "Blocked gates and parked vehicles may slow responder access.",
          "LPG and overloaded extension lines raise ignition risk."
        ],
        high: [
          "Fire may spread quickly across closely packed structures in {fireArea}.",
          "Thick smoke can make hallways and doors unsafe within minutes.",
          "Evacuation routes may narrow if vehicles or gates block exits.",
          "Gas tanks and overloaded extension lines increase the chance of escalation."
        ],
        critical: [
          "Flash spread is possible across adjacent structures in {fireArea}.",
          "Smoke conditions may become life-threatening before responders fully arrive.",
          "People trapped on upper floors may require rescue support.",
          "Immediate evacuation is the safest choice once fire reaches structural materials."
        ]
      },
      actions: {
        low: [
          "Unplug unused appliances and avoid overloading outlets.",
          "Check that exits open fully and remain free of clutter.",
          "Keep a flashlight and extinguisher in an easy-to-reach spot.",
          "Review the family meeting point outside the home."
        ],
        moderate: [
          "Check LPG connections and turn off appliances that are not in use.",
          "Keep doors and hallways clear for a quick exit.",
          "Teach household members how to call for help and where to meet.",
          "Do not leave open flames or active cooking unattended."
        ],
        high: [
          "Evacuate through the nearest cool exit and stay low beneath smoke.",
          "If safe, shut off LPG and the main breaker.",
          "Do not reopen hot doors or return for valuables.",
          "Call responders and account for all household members at the assembly point."
        ],
        critical: [
          "Leave the structure immediately and warn nearby households.",
          "Use only safe exits and never pass through thick smoke.",
          "Keep the access road clear for fire responders.",
          "Wait for responders at the designated safe distance and do a headcount."
        ]
      }
    },

    storm: {
      title: "Storm Scenario",
      radarLabel: "STORM",
      radarSub: {
        low: "Low Storm Exposure",
        moderate: "Moderate Storm Risk",
        high: "High Storm Exposure",
        critical: "Critical Storm Threat"
      },
      forecastShort: {
        low: "Light wind and rain impacts may still affect exposed sections of {location}.",
        moderate: "Storm conditions may begin affecting vulnerable roads in {location}.",
        high: "Strong wind and rain exposure is projected in {location}.",
        critical: "Severe storm impact is possible in the most exposed routes and coastal zones of {location}."
      },
      forecastWindow: {
        now: "Outer rain bands and gusts are already influencing exposed routes.",
        "6h": "The next 6 hours are the most likely period for stronger gusts and debris.",
        "12h": "Storm impacts may intensify further over the next 12 hours.",
        "24h": "Longer outages and supply interruptions should be considered over the next 24 hours."
      },
      priority: {
        low: "Priority watch areas: {stormArea}.",
        moderate: "Secure outdoor items and prepare shelter plans in {stormArea}.",
        high: "Highest priority zones: {stormArea}.",
        critical: "Immediate shelter and coastal movement restrictions are advised in {stormArea}."
      },
      alertHeadline: {
        low: "Storm watch remains active in {location}.",
        moderate: "Storm risk is rising in exposed areas of {location}.",
        high: "High storm exposure is expected in {location}.",
        critical: "Severe storm impact is possible in parts of {location}."
      },
      alertSummary: {
        low: "Charge devices and monitor forecast updates as winds begin to shift.",
        moderate: "Bring loose items indoors and prepare for short outages or road changes.",
        high: "Secure the home, avoid non-essential travel, and be ready for evacuation if advised.",
        critical: "Move to the safest sheltered area available and avoid all exposed routes."
      },
      notes: {
        now: "Storm simulation is focused on immediate sheltering and road safety actions.",
        "6h": "Use the next 6 hours to finish securing the home and essential supplies.",
        "12h": "Travel and supply plans should be finalized before the 12-hour window.",
        "24h": "Prepare for extended outages, limited movement, and shelter support needs."
      },
      impacts: {
        low: [
          "Light roof and debris movement is possible in exposed sections of {stormArea}.",
          "Travel remains possible but should be monitored closely.",
          "Signal or power flickers may occur in open areas.",
          "Preparedness should begin before conditions intensify."
        ],
        moderate: [
          "Strong wind can affect exposed roofs and lightweight structures in {stormArea}.",
          "Falling branches and debris may block selected access roads.",
          "Power interruption becomes more likely if rain bands persist.",
          "Travel risk rises on open-road and coastal sections."
        ],
        high: [
          "Strong winds may affect exposed roofs in {stormArea}.",
          "Falling branches and debris can block road access.",
          "Power outage and weak signal are likely if rain bands intensify.",
          "Travel risk is high on coastal and open-road sections."
        ],
        critical: [
          "Roof failure or heavy debris impact is possible in the most exposed parts of {stormArea}.",
          "Road closures may isolate coastal or hillside communities.",
          "Extended power interruption is likely during the strongest impact window.",
          "Sheltering indoors or relocation is safer than travel once conditions worsen."
        ]
      },
      actions: {
        low: [
          "Charge phones, lamps, and one power bank.",
          "Bring in lightweight outdoor items before winds rise.",
          "Monitor official advisories and travel updates.",
          "Check food, medicine, and water for at least one day."
        ],
        moderate: [
          "Secure windows, roofing sheets, and outdoor objects.",
          "Store water and ready-to-eat food for at least 24 hours.",
          "Review the nearest safe shelter and who needs help first.",
          "Avoid unnecessary travel once gusts and rain strengthen."
        ],
        high: [
          "Bring loose outdoor items inside and secure lightweight roofing.",
          "Charge devices, lamps, and power banks.",
          "Store drinking water, medicines, and ready-to-eat food.",
          "Avoid non-essential travel and stay away from windows."
        ],
        critical: [
          "Move to the safest interior space or approved evacuation site.",
          "Do not travel through coastal, flooded, or debris-blocked routes.",
          "Keep emergency supplies and documents together in one carry bag.",
          "Wait for official clearance before leaving shelter."
        ]
      }
    }
  };

  var routeMap = null;
  var routeLine = null;
  var routeMarkers = [];
  var threatRadarMap = null;
  var threatRadarLayer = null;
  var threatRadarMarkers = [];
  var threatRadarRings = [];
  var threatRouteLine = null;
  var radarFrameTimer = null;
  var radarAnimationIndex = 0;
  var geocodeCache = {};

  function scenarioIconFor(key) {
    return { flood: '🌊', fire: '🔥', storm: '🌪' }[key] || '⚠';
  }

  function severityIconFor(key) {
    return { low: '🟢', moderate: '🟡', high: '🟠', critical: '🔴' }[key] || '⚠';
  }

  function timeIconFor(key) {
    return { now: '🕒', '6h': '⏳', '12h': '⌛', '24h': '📅' }[key] || '🕒';
  }

  function kindLabel(kind) {
    return { command: 'Command point', medical: 'Medical support', open: 'Open safe area', government: 'Government support' }[kind] || 'Support point';
  }

  function formatText(text, tokens) {
    return String(text).replace(/\{(\w+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : '';
    });
  }

  function getTokens() {
    var location = locations[state.location];
    return {
      location: location.label,
      severity: severityLabels[state.severity],
      time: timeLabels[state.time],
      floodArea: location.floodArea,
      fireArea: location.fireArea,
      stormArea: location.stormArea
    };
  }

  function updateSelectValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
  }

  function resetExpandedLists() {
    state.expanded.impact = false;
    state.expanded.action = false;
  }

  function renderCollapsibleList(id, items, itemClass, toggleId, expandedKey, limit) {
    var el = document.getElementById(id);
    var toggle = document.getElementById(toggleId);
    if (!el) return;

    var maxVisible = typeof limit === 'number' ? limit : 2;
    var expanded = !!state.expanded[expandedKey];
    var shouldCollapse = items.length > maxVisible;
    var visibleItems = shouldCollapse && !expanded ? items.slice(0, maxVisible) : items;

    el.innerHTML = visibleItems.map(function (item) {
      return '<li class="' + itemClass + '">' + escapeHtml(item) + '</li>';
    }).join('');

    if (!toggle) return;
    if (!shouldCollapse) {
      toggle.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    toggle.hidden = false;
    toggle.textContent = expanded ? 'See less' : 'See more';
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function applyThemeVars() {
    var simContainer = document.getElementById('scenarioSim');
    var preview = document.getElementById('scenarioPreview');
    var radarCard = document.getElementById('radarCard');
    var scenarioTheme = scenarioThemes[state.scenario];
    var severityTheme = severityThemes[state.severity];

    [simContainer, preview, radarCard].forEach(function (el) {
      if (!el) return;
      el.style.setProperty('--scenario-rgb', scenarioTheme.rgb);
      el.style.setProperty('--severity-rgb', severityTheme.rgb);
      el.dataset.scenario = state.scenario;
      el.dataset.severity = state.severity;
    });

    var severityField = document.querySelector('.scenario-field-severity');
    if (severityField) {
      severityField.style.setProperty('--field-rgb', severityTheme.rgb);
    }

    var routeCard = document.getElementById('advisorySupportCard');
    if (routeCard) {
      routeCard.style.setProperty('--scenario-rgb', scenarioTheme.rgb);
      routeCard.style.setProperty('--severity-rgb', severityTheme.rgb);
    }
  }

  function updateRiskBadge(levelKey) {
    var badge = document.getElementById('simRiskBadge');
    if (!badge) return;
    badge.textContent = severityLabels[levelKey].toUpperCase();
    badge.className = 'scenario-risk-pill ' + levelKey;
  }

  function getSeverityScore(levelKey) {
    return { low: 28, moderate: 52, high: 76, critical: 92 }[levelKey] || 50;
  }

  function getTimeScore(timeKey) {
    return { now: 8, '6h': 5, '12h': 3, '24h': 1 }[timeKey] || 0;
  }

  function getDecisionInfo() {
    var scenario = state.scenario;
    var location = locations[state.location];
    var primaryPlace = getPrimaryPlace(location.safePlaces);
    var primaryContact = location.contacts[0] || null;
    var baseScore = getSeverityScore(state.severity) + getTimeScore(state.time);
    var score = Math.max(18, Math.min(99, baseScore));

    var byScenario = {
      flood: {
        low: { status: 'Monitor drains', priority: 'Stay alert', note: 'Watch for road ponding and keep essentials ready.', why: 'Floodwater can rise fast in low-lying drainage corridors once rain bands repeat.', movement: 'Prefer higher roads', summary: 'Use elevated roads and avoid low crossings first.', exposure: 'Low-lying roads and drainage zones' },
        moderate: { status: 'Prepare to move', priority: 'Raise essentials', note: 'Move valuables higher and review your nearest safe route.', why: 'Water can begin collecting in road dips and near river-adjacent communities.', movement: 'Avoid flooded shortcuts', summary: 'Choose main roads with better drainage and avoid shortcuts.', exposure: 'Drainage chokepoints and river-adjacent streets' },
        high: { status: 'Pre-evacuate', priority: 'Ready go bag', note: 'Pre-position medicines, IDs, and chargers now.', why: 'High flood exposure can cut off low roads before a formal evacuation order reaches everyone.', movement: 'Leave before roads worsen', summary: 'Move early using the safest drivable route before water deepens.', exposure: 'Flood-prone residential pockets and low crossings' },
        critical: { status: 'Evacuate now', priority: 'Move immediately', note: 'Relocate vulnerable family members first.', why: 'Critical flood conditions can turn passable roads unsafe within minutes.', movement: 'Do not cross water', summary: 'Take the fastest dry route to the recommended support point now.', exposure: 'Fast-rising floodwater and trapped access roads' }
      },
      fire: {
        low: { status: 'Check exits', priority: 'Stay ready', note: 'Keep exits clear and monitor heat or smoke changes.', why: 'Small ignition sources become dangerous in dense commercial and residential blocks.', movement: 'Use open frontages', summary: 'Keep to wide roads and clear exits away from congested blocks.', exposure: 'Dense structures and electrical ignition points' },
        moderate: { status: 'Stand by to leave', priority: 'Clear exits', note: 'Prepare to move out if smoke or flames spread.', why: 'Fire spread risk increases quickly where buildings are closely spaced.', movement: 'Avoid narrow alleys', summary: 'Choose wide access roads and open gathering points first.', exposure: 'Market-side strips and warehouse-adjacent rows' },
        high: { status: 'Move to open area', priority: 'Evacuate block', note: 'Shift to a wide open landmark and wait for responders.', why: 'High fire spread can block escape paths, so open staging areas are safer than staying inside.', movement: 'Use clear outward lanes', summary: 'Use the fastest route toward an open or command point and stay out of smoke corridors.', exposure: 'Closely packed homes and shopfronts' },
        critical: { status: 'Leave immediately', priority: 'Life safety first', note: 'Do not return for belongings or vehicles.', why: 'Critical fire conditions can block exits, reduce visibility, and spread across adjacent roofs or stalls.', movement: 'Upwind, away from smoke', summary: 'Move immediately to the nearest open or medical support point via the clearest route.', exposure: 'Rapid fire spread and smoke-filled escape paths' }
      },
      storm: {
        low: { status: 'Secure property', priority: 'Monitor gusts', note: 'Tie down light items and review support points.', why: 'Even lower-level winds can down light materials and weaken temporary structures.', movement: 'Use protected roads', summary: 'Prefer sheltered roads and keep travel short.', exposure: 'Open roads and loose outdoor materials' },
        moderate: { status: 'Reduce travel', priority: 'Protect home', note: 'Charge devices and avoid exposed roads if weather worsens.', why: 'Moderate storm conditions often bring debris, short power interruptions, and poor visibility.', movement: 'Avoid coastal lanes', summary: 'Use inland roads when possible and avoid open coastal stretches.', exposure: 'Open coastal roads and tree-lined routes' },
        high: { status: 'Shelter or relocate early', priority: 'Travel now if needed', note: 'Finish travel before stronger winds and rain bands arrive.', why: 'High storm impact can isolate coastal or exposed communities once debris and flooding build up.', movement: 'Use inland route', summary: 'Take the quickest inland route to the safest support point before conditions peak.', exposure: 'Coastal barangays and debris-prone corridors' },
        critical: { status: 'Stay sheltered', priority: 'Move only if ordered', note: 'Relocate only before the strongest impact window or under official instruction.', why: 'Critical storm conditions can make travel unsafe because of debris, flooding, and low visibility.', movement: 'Avoid exposed travel', summary: 'Use the shortest protected route only if relocation is necessary right now.', exposure: 'Storm-surge or high-wind corridors' }
      }
    };

    var info = byScenario[scenario][state.severity];
    return {
      score: score,
      status: info.status,
      actionPriority: info.priority,
      actionNote: info.note,
      whyNow: info.why,
      movement: info.movement,
      movementNote: info.summary,
      exposure: info.exposure,
      safePlace: state.lastRoute && state.lastRoute.place ? state.lastRoute.place.name : (primaryPlace ? primaryPlace.name : 'Awaiting route selection'),
      primaryContact: primaryContact ? primaryContact.name + ' • ' + primaryContact.number : 'Use nearest DRRMO or 911',
      nextStep: info.note
    };
  }

  function haversineKm(a, b) {
    if (!a || !b) return null;
    var R = 6371;
    var dLat = (b[0] - a[0]) * Math.PI / 180;
    var dLng = (b[1] - a[1]) * Math.PI / 180;
    var lat1 = a[0] * Math.PI / 180;
    var lat2 = b[0] * Math.PI / 180;
    var sinDLat = Math.sin(dLat / 2);
    var sinDLng = Math.sin(dLng / 2);
    var h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function formatDistance(km) {
    if (km == null || !isFinite(km)) return 'Distance unavailable';
    return km < 1 ? Math.round(km * 1000) + ' m away' : km.toFixed(1) + ' km away';
  }

  function formatRouteDistance(km) {
    if (km == null || !isFinite(km)) return '--';
    return km < 1 ? Math.round(km * 1000) + ' m total' : km.toFixed(1) + ' km total';
  }

  function formatMinutes(minutes) {
    if (!isFinite(minutes)) return '--';
    if (minutes < 60) return Math.max(1, Math.round(minutes)) + ' min';
    var hrs = Math.floor(minutes / 60);
    var mins = Math.round(minutes % 60);
    return hrs + 'h ' + mins + 'm';
  }

  async function geocodePlace(place) {
    if (place.coords) return place.coords;
    if (geocodeCache[place.query]) {
      place.coords = geocodeCache[place.query];
      return place.coords;
    }

    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(place.query);
    var response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Unable to geocode destination');
    var results = await response.json();
    if (!results || !results.length) throw new Error('Destination not found');
    place.coords = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    geocodeCache[place.query] = place.coords;
    return place.coords;
  }

  async function ensurePlacesGeocoded(list) {
    for (var i = 0; i < list.length; i += 1) {
      try {
        await geocodePlace(list[i]);
      } catch (err) {
        console.warn(err);
      }
    }
  }

  function getPrimaryPlace(list) {
    var clone = list.slice().sort(function (a, b) {
      return (a.priority[state.scenario] || 9) - (b.priority[state.scenario] || 9);
    });
    return clone[0] || null;
  }

  function initRouteMap() {
    if (state.mapReady || typeof L === 'undefined') return;
    var mapEl = document.getElementById('routeMap');
    if (!mapEl) return;
    routeMap = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(locations[state.location].center, 12);
    setTimeout(function () { if (routeMap) routeMap.invalidateSize(); }, 80);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(routeMap);
    state.mapReady = true;
    updateRouteMapBase();
  }

  function clearRouteVisuals() {
    if (routeLine && routeMap) {
      routeMap.removeLayer(routeLine);
      routeLine = null;
    }
    routeMarkers.forEach(function (marker) {
      if (routeMap) routeMap.removeLayer(marker);
    });
    routeMarkers = [];
  }


  function clearThreatRadarVisuals() {
    if (threatRouteLine && threatRadarMap) {
      threatRadarMap.removeLayer(threatRouteLine);
      threatRouteLine = null;
    }
    threatRadarMarkers.forEach(function (marker) {
      if (threatRadarMap) threatRadarMap.removeLayer(marker);
    });
    threatRadarMarkers = [];
    threatRadarRings.forEach(function (ring) {
      if (threatRadarMap) threatRadarMap.removeLayer(ring);
    });
    threatRadarRings = [];
  }

  function initThreatRadarMap() {
    if (state.threatMapReady || typeof L === 'undefined') return;
    var mapEl = document.getElementById('threatRadarMap');
    if (!mapEl) return;
    threatRadarMap = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(locations[state.location].center, 11);
    setTimeout(function () { if (threatRadarMap) threatRadarMap.invalidateSize(); }, 80);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(threatRadarMap);
    state.threatMapReady = true;
    syncThreatRadarMap();
  }

  function getThreatCenter() {
    if (state.userPosition) return state.userPosition;
    return locations[state.location].center;
  }

  function addThreatRings(center) {
    if (!threatRadarMap || typeof L === 'undefined') return;
    var severityMeters = {
      low: [500, 1200, 2400],
      moderate: [700, 1800, 3200],
      high: [900, 2200, 4200],
      critical: [1200, 3000, 5200]
    }[state.severity] || [700, 1800, 3200];
    severityMeters.forEach(function (radius, idx) {
      var ring = L.circle(center, {
        radius: radius,
        weight: idx === severityMeters.length - 1 ? 2 : 1,
        color: idx === severityMeters.length - 1 ? 'rgba(' + scenarioThemes[state.scenario].rgb + ',0.95)' : 'rgba(255,255,255,0.35)',
        fillOpacity: idx === 0 ? 0.04 : 0,
        opacity: 0.7,
        dashArray: idx === severityMeters.length - 1 ? null : '6 10'
      }).addTo(threatRadarMap);
      threatRadarRings.push(ring);
    });
  }

  function makeDivIcon(label, className) {
    return L.divIcon({
      className: 'threat-pin ' + className,
      html: '<span>' + escapeHtml(label) + '</span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function syncThreatRadarMap() {
    if (!threatRadarMap || typeof L === 'undefined') return;
    clearThreatRadarVisuals();
    var location = locations[state.location];
    var center = getThreatCenter();
    threatRadarMap.setView(center, state.userPosition ? 12 : 11);
    addThreatRings(center);

    var userMarker = L.marker(center, { icon: makeDivIcon('YOU', 'threat-pin-user') }).addTo(threatRadarMap).bindPopup('Your current position or selected city center');
    threatRadarMarkers.push(userMarker);

    location.safePlaces.forEach(function (place) {
      if (!place.coords) return;
      var marker = L.marker(place.coords, { icon: makeDivIcon('SAFE', 'threat-pin-safe') }).addTo(threatRadarMap).bindPopup('<strong>' + escapeHtml(place.name) + '</strong><br>' + escapeHtml(place.address));
      threatRadarMarkers.push(marker);
    });

    if (state.lastRoute && state.lastRoute.route && state.lastRoute.route.geometry) {
      var coords = state.lastRoute.route.geometry.coordinates.map(function (pair) {
        return [pair[1], pair[0]];
      });
      threatRouteLine = L.polyline(coords, { weight: 5, opacity: 0.95 }).addTo(threatRadarMap);
      threatRadarMap.fitBounds(threatRouteLine.getBounds(), { padding: [24, 24] });
    }
  }

  async function refreshThreatRadar(force) {
    if (!document.getElementById('threatRadarMap')) {
      return;
    }
    try {
      initThreatRadarMap();
      syncThreatRadarMap();
      if (state.scenario === 'fire') {
        if (threatRadarLayer && threatRadarMap) {
          threatRadarMap.removeLayer(threatRadarLayer);
          threatRadarLayer = null;
        }
        if (radarFrameTimer) {
          clearInterval(radarFrameTimer);
          radarFrameTimer = null;
        }
        setTextIfExists('radarFrameTime', 'Fire view uses route rings plus Western Visayas local/official reports; no public live fire dispatch radar is available.');
        return;
      }
      var data = await fetchJson('https://api.rainviewer.com/public/weather-maps.json');
      var frames = (data && data.radar && data.radar.past) ? data.radar.past.slice(-4) : [];
      state.radarFrames = frames;
      state.radarHost = data && data.host ? data.host : '';
      if (!frames.length || !state.radarHost) {
        setTextIfExists('radarFrameTime', 'No radar frames available right now.');
        return;
      }
      function applyFrame(frame) {
        if (!threatRadarMap) return;
        if (threatRadarLayer) threatRadarMap.removeLayer(threatRadarLayer);
        var url = state.radarHost + frame.path + '/256/{z}/{x}/{y}/3/1_1.png';
        threatRadarLayer = L.tileLayer(url, { opacity: 0.58, zIndex: 320, attribution: 'RainViewer' }).addTo(threatRadarMap);
        var stamp = new Date(frame.time * 1000);
        setTextIfExists('radarFrameTime', 'Weather radar frame: ' + stamp.toLocaleString());
      }
      if (radarFrameTimer) clearInterval(radarFrameTimer);
      radarAnimationIndex = Math.max(0, frames.length - 1);
      applyFrame(frames[radarAnimationIndex]);
      radarFrameTimer = setInterval(function () {
        if (!state.radarFrames.length) return;
        radarAnimationIndex = (radarAnimationIndex + 1) % state.radarFrames.length;
        applyFrame(state.radarFrames[radarAnimationIndex]);
      }, 1200);
      state.lastThreatRefreshAt = new Date().toISOString();
    } catch (err) {
      console.error(err);
      setTextIfExists('radarFeedStatus', 'Radar source unavailable');
      setTextIfExists('radarFrameTime', 'Live radar could not be refreshed right now.');
    }
  }

  function updateRouteMapBase() {
    if (!routeMap) return;
    clearRouteVisuals();
    var location = locations[state.location];
    routeMap.setView(location.center, 12);
    var primary = getPrimaryPlace(location.safePlaces);
    if (primary && primary.coords) {
      var marker = L.marker(primary.coords).addTo(routeMap).bindPopup('<strong>' + escapeHtml(primary.name) + '</strong><br>' + escapeHtml(primary.address));
      routeMarkers.push(marker);
    }
    syncThreatRadarMap();
  }

  function simplifyStep(step) {
    var maneuver = step.maneuver || {};
    var type = maneuver.type || 'Continue';
    var modifier = maneuver.modifier ? String(maneuver.modifier).replace(/\w/g, function (c) { return c.toUpperCase(); }) : '';
    var roadName = step.name ? ' onto ' + step.name : '';
    var prefixMap = {
      depart: 'Start',
      arrive: 'Arrive',
      turn: 'Turn',
      newName: 'Continue',
      merge: 'Merge',
      roundabout: 'Enter the roundabout',
      rotary: 'Enter the rotary',
      fork: 'Keep',
      endOfRoad: 'At the end of the road turn',
      continue: 'Continue'
    };
    var label = prefixMap[type] || type;
    if (modifier) label += ' ' + modifier.toLowerCase();
    var distance = step.distance ? ' (' + formatRouteDistance(step.distance / 1000) + ')' : '';
    return label + roadName + distance;
  }

  function routeOptionTone(option) {
    if (!option) return 'default';
    if (state.activeRouteKey === option.key) return 'active';
    if (option.place && option.place.id === state.routePreferredPlaceId && option.routeIndex === 0) return 'preferred';
    if (option.routeIndex === 0) return 'primary';
    return 'alternate';
  }

  function routeOptionLabel(option, rank) {
    if (!option) return 'Route';
    if (rank === 0) return 'Best overall';
    if (option.place && option.place.id === state.routePreferredPlaceId && option.routeIndex === 0) return 'Selected destination';
    if (option.routeIndex === 0) return 'Other destination';
    return 'Alternate path';
  }

  function updateRouteSummaryFromOption(option, summary, hint) {
    if (!option) {
      updateRouteSummaryBase();
      return;
    }
    setTextIfExists('routeTargetName', option.place.name);
    setTextIfExists('routeTargetSub', option.place.address);
    setTextIfExists('routeEta', formatMinutes(option.route.duration / 60));
    setTextIfExists('routeDistance', formatRouteDistance(option.route.distance / 1000));
    setTextIfExists('routeAdvice', getDecisionInfo().movement);
    setTextIfExists('routeModeHint', getDecisionInfo().movementNote);
    setTextIfExists('routeSummary', summary || ('Showing the selected route option to ' + option.place.name + '.'));
    setTextIfExists('routeDirectionsHint', hint || 'Turn-by-turn steps below match the selected route option.');
  }

  function renderRouteOptions() {
    var wrap = document.getElementById('routeOptions');
    if (!wrap) return;
    if (!state.routeOptions || !state.routeOptions.length) {
      wrap.innerHTML = '<div class="route-option-empty">Tap <strong>Use My Location</strong> or <strong>Find Closest Safe Route</strong> to load multiple route choices.</div>';
      setTextIfExists('routeOptionsHint', 'Compare the recommended route with other nearby options.');
      return;
    }
    var visible = state.routeOptions.slice(0, 6);
    setTextIfExists('routeOptionsHint', 'Showing ' + visible.length + ' route option' + (visible.length > 1 ? 's' : '') + ' you can switch between.');
    wrap.innerHTML = visible.map(function (option, index) {
      var isActive = state.activeRouteKey === option.key;
      var eta = formatMinutes(option.route.duration / 60);
      var distance = formatRouteDistance(option.route.distance / 1000);
      var tone = routeOptionTone(option);
      var label = routeOptionLabel(option, index);
      var altText = option.routeIndex > 0 ? ('Alt path ' + option.routeIndex) : 'Main path';
      return (
        '<button type="button" class="route-option-card is-' + tone + (isActive ? ' is-current' : '') + '" data-route-option-key="' + escapeHtml(option.key) + '">' +
          '<span class="route-option-top">' +
            '<span class="route-option-badge">' + escapeHtml(label) + '</span>' +
            '<span class="route-option-path">' + escapeHtml(altText) + '</span>' +
          '</span>' +
          '<strong>' + escapeHtml(option.place.name) + '</strong>' +
          '<span class="route-option-meta">' + escapeHtml(eta + ' • ' + distance) + '</span>' +
          '<span class="route-option-note">' + escapeHtml(option.place.address) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function applyRouteOption(option, summary, hint) {
    if (!option) return;
    state.lastRoute = option;
    state.activeRouteKey = option.key;
    state.routePreferredPlaceId = option.place.id;
    drawRoute(state.userPosition || locations[state.location].center, option);
    renderRouteDirections(option.route.legs && option.route.legs[0] ? option.route.legs[0].steps : []);
    renderRouteOptions();
    renderPlaces(locations[state.location].safePlaces);
    updateRouteSummaryFromOption(option, summary, hint);
    updateRadarDecision();
  }

  function renderRouteDirections(steps) {
    var list = document.getElementById('routeDirections');
    if (!list) return;
    if (!steps || !steps.length) {
      list.innerHTML = '<li>Direction steps will appear after the route is calculated.</li>';
      return;
    }
    list.innerHTML = steps.slice(0, 6).map(function (step) {
      return '<li>' + escapeHtml(simplifyStep(step)) + '</li>';
    }).join('');
  }

  function updateRouteSummaryBase() {
    var location = locations[state.location];
    var primary = getPrimaryPlace(location.safePlaces);
    if (!primary) return;
    state.routeOptions = [];
    state.activeRouteKey = null;
    setTextIfExists('routeTargetName', primary.name);
    setTextIfExists('routeTargetSub', primary.address);
    setTextIfExists('routeEta', '--');
    setTextIfExists('routeDistance', primary.note);
    setTextIfExists('routeAdvice', getDecisionInfo().movement);
    setTextIfExists('routeModeHint', 'Recommended for ' + severityLabels[state.severity].toLowerCase() + ' ' + state.scenario + ' conditions.');
    setTextIfExists('routeSummary', getDecisionInfo().movementNote + ' Use your current location to calculate the nearest practical route.');
    setTextIfExists('routeDirectionsHint', 'Waiting for route calculation from your current location.');
    renderRouteOptions();
  }

  function renderPlaces(items) {
    var el = document.getElementById('simSafePlaces');
    if (!el) return;
    var origin = state.userPosition;
    var sorted = items.slice().sort(function (a, b) {
      var aPriority = (a.priority[state.scenario] || 9);
      var bPriority = (b.priority[state.scenario] || 9);
      if (aPriority !== bPriority) return aPriority - bPriority;
      var aDistance = origin && a.coords ? haversineKm(origin, a.coords) : Number.MAX_SAFE_INTEGER;
      var bDistance = origin && b.coords ? haversineKm(origin, b.coords) : Number.MAX_SAFE_INTEGER;
      return aDistance - bDistance;
    });

    el.innerHTML = sorted.map(function (item) {
      var approx = origin && item.coords ? formatDistance(haversineKm(origin, item.coords)) : 'Route estimate appears after location is shared';
      return (
        '<div class="scenario-place-card">' +
          '<div class="scenario-place-top">' +
            '<strong>' + escapeHtml(item.name) + '</strong>' +
            '<span class="place-kind-badge">' + escapeHtml(kindLabel(item.kind)) + '</span>' +
          '</div>' +
          '<span class="scenario-place-address">' + escapeHtml(item.address) + '</span>' +
          '<span>' + escapeHtml(item.note) + '</span>' +
          '<div class="scenario-place-footer">' +
            '<small>' + escapeHtml(approx) + '</small>' +
            '<button type="button" class="scenario-mini-btn" data-route-place="' + escapeHtml(item.id) + '">Route here</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderContacts(items) {
    var el = document.getElementById('simContacts');
    if (!el) return;
    el.innerHTML = items.map(function (item) {
      var actions = '<div class="scenario-contact-actions">';
      if (item.call) actions += '<a class="scenario-contact-btn" href="tel:' + encodeURIComponent(item.call) + '">Call</a>';
      if (item.sms) actions += '<a class="scenario-contact-btn secondary" href="sms:' + encodeURIComponent(item.sms) + '">Text</a>';
      actions += '</div>';
      return (
        '<div class="scenario-contact-item">' +
          '<div class="scenario-contact-top"><strong>' + escapeHtml(item.name) + '</strong><span class="scenario-contact-number">' + escapeHtml(item.number) + '</span></div>' +
          '<span>' + escapeHtml(item.detail) + '</span>' +
          actions +
        '</div>'
      );
    }).join('');
  }

  function setActiveScenarioButtons() {
    var buttons = document.querySelectorAll('.scenario-tab');
    buttons.forEach(function (button) {
      var isActive = button.getAttribute('data-scenario') === state.scenario;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function updateRadarDecision() {
    var scenario = scenarios[state.scenario];
    var location = locations[state.location];
    var decision = getDecisionInfo();
    var officialItems = state.liveFeed.filter(function (item) { return item.type === 'official'; });
    var leadItem = officialItems[0] || state.liveFeed[0] || null;
    var leadSummary = leadItem ? (leadItem.title || '') + (leadItem.summary ? ' — ' + leadItem.summary : '') : '';
    setTextIfExists('radarRegionLabel', 'Western Visayas • ' + location.label);
    setTextIfExists('radarRiskLabel', scenario.radarLabel);
    setTextIfExists('radarRiskSub', severityLabels[state.severity] + ' • ' + timeLabels[state.time]);
    setTextIfExists('radarScenarioTag', scenarioIconFor(state.scenario) + ' Scenario: ' + scenario.title.replace(/\s+Scenario$/i, ''));
    setTextIfExists('radarLocationTag', '📍 Location: ' + location.label);
    setTextIfExists('radarSeverityTag', severityIconFor(state.severity) + ' Severity: ' + severityLabels[state.severity]);
    setTextIfExists('radarTimeTag', timeIconFor(state.time) + ' Time: ' + timeLabels[state.time]);
    setTextIfExists('radarStatusPill', decision.status);
    setTextIfExists('radarRiskScore', decision.score + ' / 100');
    setTextIfExists('radarRiskScoreNote', decision.exposure);
    setTextIfExists('radarActionPriority', decision.actionPriority);
    setTextIfExists('radarActionNote', decision.actionNote);
    setTextIfExists('radarSafePlace', decision.safePlace);
    setTextIfExists('radarPrimaryContact', decision.primaryContact);
    setTextIfExists('radarDecisionText', leadSummary ? (leadSummary + ' ' + decision.movementNote) : (decision.whyNow + ' ' + decision.movementNote));
    updateLiveTriggerCard();
  }

  async function getCurrentPositionOrFallback() {
    var fallback = locations[state.location].center;
    if (!navigator.geolocation) {
      showToast('Location access is unavailable. Using the selected city center estimate.');
      return fallback;
    }

    return new Promise(function (resolve) {
      navigator.geolocation.getCurrentPosition(function (position) {
        var coords = [position.coords.latitude, position.coords.longitude];
        state.userPosition = coords;
        resolve(coords);
      }, function () {
        showToast('Unable to access your live location. Using the selected city center estimate.');
        resolve(fallback);
      }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 120000 });
    });
  }

  async function fetchRouteOptionsForPlace(origin, destination, place) {
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      origin[1] + ',' + origin[0] + ';' + destination[1] + ',' + destination[0] +
      '?alternatives=3&overview=full&geometries=geojson&steps=true';
    var response = await fetch(url);
    if (!response.ok) throw new Error('Route service unavailable');
    var data = await response.json();
    if (!data.routes || !data.routes.length) throw new Error('No route found');
    return data.routes.map(function (route, index) {
      return {
        key: place.id + '--' + index,
        place: place,
        route: route,
        routeIndex: index,
        score: route.duration + ((place.priority[state.scenario] || 1) - 1) * 150 + (index * 45)
      };
    });
  }

  function drawRoute(origin, result) {
    if (!routeMap || typeof L === 'undefined') return;
    clearRouteVisuals();

    var coords = result.route.geometry.coordinates.map(function (pair) {
      return [pair[1], pair[0]];
    });
    routeLine = L.polyline(coords, { weight: 5, opacity: 0.95 }).addTo(routeMap);
    var fromMarker = L.marker(origin).addTo(routeMap).bindPopup('Your position');
    var toMarker = L.marker(result.place.coords).addTo(routeMap).bindPopup('<strong>' + escapeHtml(result.place.name) + '</strong><br>' + escapeHtml(result.place.address));
    routeMarkers.push(fromMarker, toMarker);
    routeMap.fitBounds(routeLine.getBounds(), { padding: [26, 26] });
    syncThreatRadarMap();
  }

  async function calculateBestRoute(preferredPlaceId) {
    if (state.routeBusy) return;
    state.routeBusy = true;
    var location = locations[state.location];
    var routeBtn = document.getElementById('simRouteBtn');
    if (routeBtn) routeBtn.textContent = 'Calculating...';

    try {
      initRouteMap();
      await ensurePlacesGeocoded(location.safePlaces);
      renderPlaces(location.safePlaces);

      var origin = await getCurrentPositionOrFallback();
      state.userPosition = origin;

      var sortedCandidates = location.safePlaces.slice().sort(function (a, b) {
        var aPriority = (a.priority[state.scenario] || 9);
        var bPriority = (b.priority[state.scenario] || 9);
        if (preferredPlaceId) {
          if (a.id === preferredPlaceId) return -1;
          if (b.id === preferredPlaceId) return 1;
        }
        if (aPriority !== bPriority) return aPriority - bPriority;
        var aDistance = a.coords ? haversineKm(origin, a.coords) : Number.MAX_SAFE_INTEGER;
        var bDistance = b.coords ? haversineKm(origin, b.coords) : Number.MAX_SAFE_INTEGER;
        return aDistance - bDistance;
      }).slice(0, 3);

      var results = [];
      for (var i = 0; i < sortedCandidates.length; i += 1) {
        if (!sortedCandidates[i].coords) continue;
        try {
          var placeOptions = await fetchRouteOptionsForPlace(origin, sortedCandidates[i].coords, sortedCandidates[i]);
          results = results.concat(placeOptions);
        } catch (err) {
          console.warn(err);
        }
      }

      if (!results.length) throw new Error('No route could be calculated right now.');
      results.sort(function (a, b) { return a.score - b.score; });
      state.routeOptions = results;

      var active = null;
      if (preferredPlaceId) {
        active = results.find(function (item) { return item.place.id === preferredPlaceId; }) || null;
      }
      if (!active) active = results[0];

      applyRouteOption(
        active,
        preferredPlaceId
          ? ('Showing route choices for ' + active.place.name + '. Switch cards below to compare other paths and destinations.')
          : ('Fastest recommended route found from your current location. You can switch to other route cards below.'),
        preferredPlaceId
          ? 'Showing routes for the selected support point. Compare with the other cards below.'
          : 'Showing the best route now. Use the route cards below to view other paths.'
      );
      showToast('Route options loaded.');
      var supportCard = document.getElementById('advisorySupportCard');
      if (supportCard) supportCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Route calculation failed.');
    } finally {
      state.routeBusy = false;
      if (routeBtn) routeBtn.textContent = 'Find Closest Safe Route';
    }
  }

  function downloadPlan() {
    var scenario = scenarios[state.scenario];
    var location = locations[state.location];
    var tokens = getTokens();
    var decision = getDecisionInfo();
    var payload = {
      scenario: scenario.title,
      location: location.label,
      severity: severityLabels[state.severity],
      timeWindow: timeLabels[state.time],
      generatedAt: new Date().toLocaleString(),
      impacts: scenario.impacts[state.severity].map(function (item) { return formatText(item, tokens); }),
      actions: scenario.actions[state.severity].map(function (item) { return formatText(item, tokens); }),
      safePlaces: location.safePlaces.map(function (item) {
        return { name: item.name, address: item.address, phone: item.phone || '', note: item.note };
      }),
      contacts: location.contacts.map(function (item) {
        return { name: item.name, number: item.number, detail: item.detail };
      }),
      decision: {
        score: decision.score + ' / 100',
        status: decision.status,
        actionPriority: decision.actionPriority,
        actionNote: decision.actionNote,
        movement: decision.movement,
        movementNote: decision.movementNote,
        safePlace: decision.safePlace,
        primaryContact: decision.primaryContact,
        whyNow: decision.whyNow,
        exposure: decision.exposure,
        nextStep: decision.nextStep
      },
      route: state.lastRoute ? {
        destination: state.lastRoute.place.name,
        address: state.lastRoute.place.address,
        eta: formatMinutes(state.lastRoute.route.duration / 60),
        distance: formatRouteDistance(state.lastRoute.route.distance / 1000),
        note: 'Route generated from current location or selected city center estimate.'
      } : null,
      filename: 'handavis-' + state.scenario + '-' + state.location + '-plan.pdf'
    };

    var form = document.createElement('form');
    form.method = 'POST';
    form.action = 'generate_plan_pdf.php';
    form.target = '_blank';

    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'plan_data';
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    showToast('Emergency plan PDF is being prepared.');
  }

  function handleRouteClick() {
    calculateBestRoute();
  }

  function renderScenario() {
    var scenario = scenarios[state.scenario];
    var location = locations[state.location];
    var tokens = getTokens();
    var decision = getDecisionInfo();

    setTextIfExists('simScenarioTitle', scenario.title);
    setTextIfExists('simContext', location.label + ' • ' + severityLabels[state.severity] + ' severity • ' + timeLabels[state.time]);
    setTextIfExists('simTimeBadge', timeLabels[state.time]);
    setTextIfExists('simSummaryNote', scenario.notes[state.time]);

    applyThemeVars();
    updateRiskBadge(state.severity);

    renderCollapsibleList('simImpactList', scenario.impacts[state.severity].map(function (item) { return formatText(item, tokens); }), 'scenario-impact-item', 'simImpactToggle', 'impact', 2);
    renderCollapsibleList('simActionList', scenario.actions[state.severity].map(function (item) { return formatText(item, tokens); }), 'scenario-check-item', 'simActionToggle', 'action', 2);

    updateSelectValue('simLocation', state.location);
    updateSelectValue('simSeverity', state.severity);
    updateSelectValue('simTime', state.time);

    setActiveScenarioButtons();
    updateRadarDecision();
    updateRouteSummaryBase();
    initRouteMap();
    initThreatRadarMap();
    updateRouteMapBase();
    syncThreatRadarMap();
    renderPlaces(location.safePlaces);
    renderContacts(location.contacts);

    if (!state.lastRoute) {
      setTextIfExists('routeAdvice', decision.movement);
    }
  }

  function bindRoutePlaceButtons() {
    document.addEventListener('click', function (event) {
      var optionButton = event.target.closest('[data-route-option-key]');
      if (optionButton) {
        var selected = state.routeOptions.find(function (item) {
          return item.key === optionButton.getAttribute('data-route-option-key');
        });
        if (selected) {
          applyRouteOption(selected, 'Showing the selected route option to ' + selected.place.name + '.', 'Turn-by-turn steps below now match the selected route card.');
          showToast('Route view changed.');
        }
        return;
      }
      var button = event.target.closest('[data-route-place]');
      if (!button) return;
      calculateBestRoute(button.getAttribute('data-route-place'));
    });
  }

  function bindScenarioControls() {
    var locationSelect = document.getElementById('simLocation');
    var severitySelect = document.getElementById('simSeverity');
    var timeSelect = document.getElementById('simTime');
    var routeBtn = document.getElementById('simRouteBtn');
    var locateBtn = document.getElementById('routeLocateBtn');
    var planBtn = document.getElementById('simPlanBtn');
    var impactToggle = document.getElementById('simImpactToggle');
    var actionToggle = document.getElementById('simActionToggle');

    if (locationSelect) locationSelect.addEventListener('change', function () { state.location = this.value; state.lastRoute = null; state.routeOptions = []; state.activeRouteKey = null; resetExpandedLists(); renderScenario(); loadLiveAdvisories(true); refreshThreatRadar(true); });
    if (severitySelect) severitySelect.addEventListener('change', function () { state.severity = this.value; state.lastRoute = null; state.routeOptions = []; state.activeRouteKey = null; resetExpandedLists(); renderScenario(); loadLiveAdvisories(true); refreshThreatRadar(true); });
    if (timeSelect) timeSelect.addEventListener('change', function () { state.time = this.value; state.lastRoute = null; state.routeOptions = []; state.activeRouteKey = null; resetExpandedLists(); renderScenario(); refreshThreatRadar(true); });
    if (impactToggle) impactToggle.addEventListener('click', function () { state.expanded.impact = !state.expanded.impact; renderScenario(); });
    if (actionToggle) actionToggle.addEventListener('click', function () { state.expanded.action = !state.expanded.action; renderScenario(); });
    if (routeBtn) routeBtn.addEventListener('click', handleRouteClick);
    if (locateBtn) locateBtn.addEventListener('click', handleRouteClick);
    var advisoryRefreshBtn = document.getElementById('advisoryRefreshBtn');
    var radarRefreshBtn = document.getElementById('radarRefreshBtn');
    if (advisoryRefreshBtn) advisoryRefreshBtn.addEventListener('click', function () { loadLiveAdvisories(true); });
    if (radarRefreshBtn) radarRefreshBtn.addEventListener('click', function () { refreshThreatRadar(true); });
    if (planBtn) planBtn.addEventListener('click', downloadPlan);
  }

  async function warmGeocoding() {
    try {
      await ensurePlacesGeocoded(locations[state.location].safePlaces);
      renderPlaces(locations[state.location].safePlaces);
      updateRouteMapBase();
    } catch (err) {
      console.warn(err);
    }
  }

  function simulateFlood() { state.scenario = 'flood'; state.lastRoute = null; state.routeOptions = []; state.activeRouteKey = null; resetExpandedLists(); renderScenario(); loadLiveAdvisories(true); refreshThreatRadar(true); showToast('Flood simulation activated.'); }
  function simulateFire() { state.scenario = 'fire'; state.lastRoute = null; state.routeOptions = []; state.activeRouteKey = null; resetExpandedLists(); renderScenario(); loadLiveAdvisories(true); refreshThreatRadar(true); showToast('Fire simulation activated.'); }
  function simulateStorm() { state.scenario = 'storm'; state.lastRoute = null; state.routeOptions = []; state.activeRouteKey = null; resetExpandedLists(); renderScenario(); loadLiveAdvisories(true); refreshThreatRadar(true); showToast('Storm simulation activated.'); }

  window.showToast = showToast;
  window.simulateFlood = simulateFlood;
  window.simulateFire = simulateFire;
  window.simulateStorm = simulateStorm;

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.loadTheme === 'function') window.loadTheme();
    initRouteMap();
    initThreatRadarMap();
    bindScenarioControls();
    bindRoutePlaceButtons();
    renderScenario();
    warmGeocoding();
    loadLiveAdvisories(true);
    refreshThreatRadar(true);
    setInterval(function () { loadLiveAdvisories(false); }, 300000);
    setInterval(function () { refreshThreatRadar(false); }, 600000);
  });
})();
