let allResponders = [];

let activeFilter = 'all';
let searchQuery = '';
let selectedReport = null;
let selectedResponder = null;
let reports = {};
let reportOrder = [];
let historyReports = {};
let historyOrder = [];
let deptResponders = buildDeptResponders(allResponders);
const INCIDENT_MAP_DEFAULT_CENTER = [10.7085, 122.9512];
let incidentMap = null;
let incidentMarkerLayer = null;
let incidentMapHasAutoBounds = false;
const reportHistoryById = {};
const FEED_REFRESH_MS = 15000;
const RESPONDER_REFRESH_MS = 45000;
let feedRefreshTimer = null;
let responderRefreshTimer = null;

function setVerifyReportsBadge(count){
  const badge = document.getElementById('verifyReportsBadge');
  if(!badge) return;
  const safeCount = Math.max(0, Number(count) || 0);
  if(safeCount <= 0){
    badge.style.display = 'none';
    badge.textContent = '0';
    return;
  }
  badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
  badge.style.display = 'inline-flex';
}

function setIncidentMonitoringBadge(count){
  const badge = document.getElementById('incidentMonitoringBadge');
  if(!badge) return;
  const safeCount = Math.max(0, Number(count) || 0);
  if(safeCount <= 0){
    badge.style.display = 'none';
    badge.textContent = '0';
    return;
  }
  badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
  badge.style.display = 'inline-flex';
}

const fallbackStepNotes = {
  pending_barangay: 'Waiting for barangay review.',
  verified_barangay: 'Barangay marked this report as verified.',
  on_the_way: 'Responder is on the way to the incident location.',
  arrived: 'Responder arrived at the incident location.',
  responding: 'Responder is actively responding on scene.',
  rejected_barangay: 'Barangay marked this report as rejected.',
  responders_assigned: 'Responder team assigned by barangay.',
  resolved: 'Hazard was marked as resolved.'
};

const timelineStatusMeta = {
  pending_barangay: { rank: 1, label: 'Pending Barangay Review' },
  verified_barangay: { rank: 2, label: 'Verified by Barangay' },
  responders_assigned: { rank: 3, label: 'Responders Assigned' },
  on_the_way: { rank: 4, label: 'On the Way' },
  arrived: { rank: 5, label: 'Arrived' },
  responding: { rank: 6, label: 'Responding' },
  resolved: { rank: 7, label: 'Resolved' },
  rejected_barangay: { rank: 7, label: 'Rejected by Barangay' }
};

function timelineStatusCode(rawCode){
  return String(rawCode || '').trim().toLowerCase();
}

function timelineStatusRank(rawCode){
  const code = timelineStatusCode(rawCode);
  return Number(timelineStatusMeta?.[code]?.rank || 999);
}

function timelineStatusLabel(rawCode, fallbackLabel){
  const code = timelineStatusCode(rawCode);
  return String(timelineStatusMeta?.[code]?.label || fallbackLabel || code || 'Status update');
}

function timelineStatusNote(rawCode, rawNote){
  const code = timelineStatusCode(rawCode);
  if (code === 'on_the_way') return 'Responder moved status to On the Way.';
  if (code === 'arrived') return 'Responder moved status to Arrived.';
  if (code === 'responding') return 'Responder moved status to Responding.';
  return String(rawNote || fallbackStepNotes[code] || 'Status updated.');
}

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message){
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 2600);
}

function statusBadgeHtml(s){
  if(s==='available') return '<span class="status-badge sb-avail"><span class="status-dot sd-on"></span>Available</span>';
  if(s==='deployed') return '<span class="status-badge sb-deployed"><span class="status-dot sd-off"></span>Deployed</span>';
  if(s==='standby') return '<span class="status-badge sb-standby"><span class="status-dot sd-idle"></span>Standby</span>';
  return '<span class="status-badge sb-offline"><span class="status-dot" style="background:#3a5060"></span>Offline</span>';
}

function updateTopDeptCards(){
  const depts = ['police','fire','medical','disaster'];
  depts.forEach((dk) => {
    const members = allResponders.filter((r) => r.dept === dk);
    const available = members.filter((r) => r.status === 'available').length;
    const totalEl = document.getElementById(`statTotal-${dk}`);
    const availEl = document.getElementById(`statAvail-${dk}`);
    if (totalEl) totalEl.textContent = String(members.length);
    if (availEl) availEl.textContent = `${available} available`;
  });
}

function buildAllDepts(){
  updateTopDeptCards();
  const depts = ['police','fire','medical','disaster'];
  const labels = {police:'Police',fire:'Fire Department',medical:'Medical / Ambulance',disaster:'Disaster Response Team'};
  const colors = {police:'#4a90d9',fire:'#f97316',medical:'#34d399',disaster:'#a78bfa'};
  const container = document.getElementById('allDeptSections');
  if(!container) return;
  container.innerHTML = '';
  depts.forEach(dk=>{
    const members = allResponders.filter(r=>r.dept===dk);
    const avail = members.filter(r=>r.status==='available').length;
    const sec = document.createElement('div');
    sec.className='dept-section';
    sec.dataset.dept = dk;
    sec.style.marginBottom='12px';
    sec.innerHTML=`
      <div class="dept-header-row">
        <div class="dept-color-bar" style="background:${colors[dk]}"></div>
        <div class="dept-title">${labels[dk]}</div>
        <div class="dept-stats-inline">
          <div class="dst"><div class="dst-dot sd-on"></div><span style="color:#34d399">${avail} available</span></div>
          <div class="dst"><div class="dst-dot sd-off"></div><span style="color:#5a7080">${members.filter(r=>r.status==='deployed').length} deployed</span></div>
          <div class="dst"><div class="dst-dot sd-idle"></div><span style="color:#5a7080">${members.filter(r=>r.status==='standby').length} standby</span></div>
        </div>
      </div>
      <table class="responder-table">
        <thead class="rt-head"><tr>
          <th style="width:34%">Responder</th>
          <th style="width:14%">Status</th>
          <th style="width:12%">Distance</th>
          <th style="width:20%">Current Task</th>
          <th style="width:20%">Assigned Report ID</th>
        </tr></thead>
        <tbody id="tbody-${dk}"></tbody>
      </table>
      <div class="no-results" id="noResults-${dk}" style="display:none">No responders match your filter.</div>
      <div class="no-results" id="noMembers-${dk}" style="display:${members.length ? 'none' : 'block'}">No responders in database for this department yet.</div>
    `;
    container.appendChild(sec);
    renderRows(dk, members);
  });
}

function renderRows(dk, members){
  const tbody = document.getElementById('tbody-'+dk);
  if(!tbody) return;
  tbody.innerHTML='';
  members.forEach(r=>{
    const tr = document.createElement('tr');
    tr.className='rt-row';
    tr.dataset.status=r.status;
    const searchBlob = [
      r.name,
      r.rank,
      r.deptLabel,
      r.dept,
      r.searchAliases,
      r.status,
      r.availabilityLabel,
      r.currentTask,
      r.assignedReportId,
      r.dist,
      r.barangay,
      r.city,
      r.province,
      r.roleName,
      r.roleCode,
      String(r.userId || '')
    ]
      .map((v) => String(v || '').toLowerCase().trim())
      .filter(Boolean)
      .join(' ');
    tr.dataset.search = searchBlob;
    tr.dataset.dept=r.dept;
    tr.innerHTML=`
      <td><div class="resp-id-cell"><div class="resp-av-lg ${r.avCls}">${r.av}</div><div><div class="resp-name-full">${r.name}</div><div class="resp-rank">${r.rank}</div></div></div></td>
      <td>${statusBadgeHtml(r.status)}</td>
      <td class="dist-cell">${r.dist}</td>
      <td style="font-size:11px;color:#5a7080">${r.currentTask}</td>
      <td style="font-size:11px;color:#9db0c8">${escapeHtml(r.assignedReportId || '-')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterResponders(){
  const searchEl = document.getElementById('arSearch');
  searchQuery = (searchEl?.value || '').toLowerCase();
  applyFilters();
}

function setFilter(el, f){
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  applyFilters();
}

function applyFilters(){
  const depts = ['police','fire','medical','disaster'];
  depts.forEach(dk=>{
    const tbody = document.getElementById('tbody-'+dk);
    const noRes = document.getElementById('noResults-'+dk);
    const section = tbody ? tbody.closest('.dept-section') : null;
    if(!tbody || !noRes) return;
    let visible = 0;
    tbody.querySelectorAll('tr').forEach(tr=>{
      const statusOk = activeFilter==='all' || tr.dataset.status===activeFilter;
      const searchOk = !searchQuery || String(tr.dataset.search || '').includes(searchQuery);
      const show = statusOk && searchOk;
      tr.classList.toggle('hidden', !show);
      if(show) visible++;
    });
    noRes.style.display = visible===0?'block':'none';
    if (section) {
      if (!searchQuery && activeFilter === 'all') {
        section.style.display = '';
      } else {
        section.style.display = visible > 0 ? '' : 'none';
      }
    }
  });
}

function switchPage(p){
  const pageAssign = document.getElementById('pageAssign');
  const pageHistory = document.getElementById('pageHistory');
  const pageAll = document.getElementById('pageAll');
  const tabAssign = document.getElementById('tabAssign');
  const tabHistory = document.getElementById('tabHistory');
  const incidentTabs = document.getElementById('incidentTabs');
  if(pageAssign) pageAssign.classList.toggle('active', p==='assign');
  if(pageHistory) pageHistory.classList.toggle('active', p==='history');
  if(pageAll) pageAll.classList.toggle('active', p==='all');
  if(tabAssign) tabAssign.classList.toggle('on', p==='assign');
  if(tabHistory) tabHistory.classList.toggle('on', p==='history');
  if(incidentTabs) incidentTabs.style.display = (p === 'all') ? 'none' : 'flex';

  const title = document.getElementById('pageTitle');
  const desc = document.getElementById('pageDesc');
  if(title) {
    if (p === 'assign') title.textContent = 'Hazard Report Triage';
    else if (p === 'history') title.textContent = 'Recent Activity / History';
    else title.textContent = 'All Responders';
  }
  if(desc) {
    if (p === 'assign') {
      desc.textContent = 'Review community hazard reports from One-Tap Hazard Report and dispatch the right responder team.';
    } else if (p === 'history') {
      desc.textContent = 'Resolved incidents confirmed by barangay are stored here for records and monitoring history.';
    } else {
      desc.textContent = 'View, search, and filter responder accounts from your database.';
    }
  }
  if (p === 'assign' && incidentMap) {
    setTimeout(() => {
      if (incidentMap) incidentMap.invalidateSize();
    }, 80);
  }
}

function toRelativeTime(createdAt){
  if(!createdAt) return '-';
  const ts = new Date(createdAt).getTime();
  if(!Number.isFinite(ts)) return '-';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if(mins < 1) return 'Just now';
  if(mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if(hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day ago`;
}

function buildDeptResponders(source){
  const map = { police: [], fire: [], medical: [], disaster: [] };
  (source || []).forEach((r) => {
    const item = {
      id: r.id,
      userId: r.userId,
      av: r.av,
      name: r.name,
      dist: r.dist || 'Unknown',
      distanceKm: null,
      cls: r.avCls || 'av-p',
      status: r.status || 'offline',
      availabilityLabel: r.availabilityLabel || 'Offline',
      isDispatchable: !!r.isDispatchable,
      canReceiveAssignment: !!r.canReceiveAssignment,
      activeAssignmentCount: Number(r.activeAssignmentCount || 0),
      maxActiveAssignments: Number(r.maxActiveAssignments || 1),
      latitude: Number.isFinite(r.latitude) ? Number(r.latitude) : null,
      longitude: Number.isFinite(r.longitude) ? Number(r.longitude) : null,
      busy: r.status !== 'available',
      selectable: r.status === 'available' && !!r.isDispatchable && !!r.canReceiveAssignment,
      nearest: false
    };
    if (map[r.dept]) {
      map[r.dept].push(item);
    }
  });
  return map;
}

function deptKeyFromHazard(hazard){
  const h = String(hazard || '').toLowerCase();
  if(h.includes('fire')) return 'fire';
  if(h.includes('medical')) return 'medical';
  if(h.includes('flood') || h.includes('storm') || h.includes('earthquake') || h.includes('road')) return 'disaster';
  return 'police';
}

function deptColorByKey(key){
  if(key === 'police') return '#4a90d9';
  if(key === 'fire') return '#f97316';
  if(key === 'medical') return '#34d399';
  return '#a78bfa';
}

function deptBadgeByKey(key){
  if(key === 'police') return 'PO';
  if(key === 'fire') return 'FD';
  if(key === 'medical') return 'AM';
  return 'DRT';
}

function deptAvClassByKey(key){
  if(key === 'police') return 'av-p';
  if(key === 'fire') return 'av-f';
  if(key === 'medical') return 'av-m';
  return 'av-d';
}

function deptLabelFromKey(key){
  if(key === 'fire') return 'Fire Department';
  if(key === 'medical') return 'Medical / Ambulance';
  if(key === 'disaster') return 'Disaster Response Team';
  return 'Police';
}

function toNumberOrNull(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(lat1, lon1, lat2, lon2){
  const d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r;
  const dLon = (lon2 - lon1) * d2r;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function formatDistanceKm(value){
  if(!Number.isFinite(value)) return 'Unknown';
  if(value < 1) return `${Math.round(value * 1000)} m`;
  return `${value.toFixed(1)} km`;
}

function ensureIncidentMap(){
  const mapEl = document.getElementById('incidentMap');
  const statusEl = document.getElementById('incidentMapStatus');
  if(!mapEl) return null;
  if(typeof window.L === 'undefined'){
    if(statusEl) statusEl.textContent = 'Map unavailable (Leaflet not loaded)';
    return null;
  }
  if(incidentMap) return incidentMap;

  incidentMap = L.map('incidentMap', {
    zoomControl: true,
    attributionControl: true
  }).setView(INCIDENT_MAP_DEFAULT_CENTER, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(incidentMap);

  incidentMarkerLayer = L.layerGroup().addTo(incidentMap);
  setTimeout(() => {
    if(incidentMap) incidentMap.invalidateSize();
  }, 50);

  return incidentMap;
}

function markerClassFromHazard(hazard){
  const type = normalizeHazardType(hazard);
  if(type === 'Flood') return 'flood';
  if(type === 'Fire') return 'fire';
  if(type === 'Storm') return 'storm';
  if(type === 'Road Block') return 'roadblock';
  if(type === 'Earthquake') return 'earthquake';
  if(type === 'Medical') return 'medical';
  return 'other';
}

function incidentMarkerIcon(report, isSelected){
  const hazardClass = markerClassFromHazard(report?.hazard || '');
  const selectedClass = isSelected ? ' incident-map-pin--selected' : '';
  const iconSvg = hazardIconSvg(report?.hazard || '');
  return L.divIcon({
    className: 'incident-map-pin-wrap',
    html:
      `<div class="incident-map-pin incident-map-pin--${hazardClass}${selectedClass}">` +
        `<div class="incident-map-pin-badge">${iconSvg}</div>` +
        '<div class="incident-map-pin-tip"></div>' +
      '</div>',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -34]
  });
}

function incidentPopupHtml(report){
  return (
    '<div class="incident-popup">' +
      `<div class="incident-popup-title">${escapeHtml(report?.name || 'Hazard')}</div>` +
      `<div class="incident-popup-meta">${escapeHtml(report?.loc || 'Location not specified')}</div>` +
      `<div class="incident-popup-meta">${escapeHtml(report?.pillLabel || 'Status unknown')} - ${escapeHtml(report?.time || '-')}</div>` +
    '</div>'
  );
}

function updateIncidentMapMarkers(options = {}){
  const map = ensureIncidentMap();
  const statusEl = document.getElementById('incidentMapStatus');
  if(!map || !incidentMarkerLayer){
    return;
  }

  const focusSelected = options.focusSelected === true;
  const rows = reportOrder.map((id) => reports[id]).filter(Boolean);
  const mapped = rows.filter((r) => toNumberOrNull(r.latitude) !== null && toNumberOrNull(r.longitude) !== null);
  const markers = [];
  incidentMarkerLayer.clearLayers();

  mapped.forEach((report) => {
    const lat = toNumberOrNull(report.latitude);
    const lng = toNumberOrNull(report.longitude);
    if(lat === null || lng === null) return;
    const isSelected = String(selectedReport || '') === String(report.id || '');
    const marker = L.marker([lat, lng], { icon: incidentMarkerIcon(report, isSelected) })
      .addTo(incidentMarkerLayer)
      .bindPopup(incidentPopupHtml(report));
    marker.on('click', () => {
      selectReport(String(report.id));
    });
    markers.push(marker);
  });

  const withoutCoordinates = Math.max(0, rows.length - mapped.length);
  if(statusEl){
    if(!rows.length){
      statusEl.textContent = 'No active reports';
    } else if(!mapped.length){
      statusEl.textContent = 'No reports with coordinates yet';
    } else if(withoutCoordinates > 0){
      statusEl.textContent = `${mapped.length} mapped - ${withoutCoordinates} without coordinates`;
    } else {
      statusEl.textContent = `${mapped.length} mapped reports`;
    }
  }

  if(!markers.length){
    if(!incidentMapHasAutoBounds){
      map.setView(INCIDENT_MAP_DEFAULT_CENTER, 13);
      incidentMapHasAutoBounds = true;
    }
    return;
  }

  const selected = reports[String(selectedReport || '')];
  const selectedLat = toNumberOrNull(selected?.latitude);
  const selectedLng = toNumberOrNull(selected?.longitude);
  if(focusSelected && selected && selectedLat !== null && selectedLng !== null){
    map.flyTo([selectedLat, selectedLng], Math.max(14, map.getZoom()), { duration: 0.35 });
    return;
  }

  if(!incidentMapHasAutoBounds){
    const bounds = L.latLngBounds(markers.map((marker) => marker.getLatLng()));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    incidentMapHasAutoBounds = true;
  }
}

function mapAvailabilityToUi(availabilityCode, isActive){
  const code = String(availabilityCode || '').toLowerCase().trim();
  if(!isActive) return 'offline';
  if(code === 'available') return 'available';
  if(code === 'standby') return 'standby';
  if(code === 'busy' || code === 'deployed' || code === 'on_mission') return 'deployed';
  return 'offline';
}

function statusToUi(statusCode, statusLabel){
  const label = String(statusLabel || '').toLowerCase();
  if(statusCode === 'pending_barangay') return {status:'verification', pill:'p-verify', pillLabel:'Needs verification', listLine:'Pending barangay verification'};
  if(statusCode === 'rejected_barangay') return {status:'resolved', pill:'p-responding', pillLabel:'Closed', listLine:'Report closed'};
  if(statusCode === 'verified_barangay') return {status:'pending', pill:'p-pending', pillLabel:'Needs assignment', listLine:'Verified - waiting for assignment'};
  if(statusCode === 'responders_assigned') return {status:'assigned', pill:'p-assigned', pillLabel:'Assigned', listLine:statusLabel || 'Barangay verified'};
  if(statusCode === 'on_the_way') return {status:'onway', pill:'p-onway', pillLabel:'On the way', listLine:'Responder team - on the way'};
  if(statusCode === 'arrived') return {status:'arrived', pill:'p-onway', pillLabel:'Arrived', listLine:'Responder team - arrived on scene'};
  if(statusCode === 'responding') return {status:'responding', pill:'p-responding', pillLabel:'Responding', listLine:'Responder team - responding'};
  if(statusCode === 'resolved') return {status:'resolved', pill:'p-assigned', pillLabel:'Resolved', listLine:'Awaiting barangay confirmation'};
  if(label.includes('assigned')) return {status:'assigned', pill:'p-assigned', pillLabel:'Assigned', listLine:statusLabel || 'Barangay verified'};
  if(label.includes('on the way')) return {status:'onway', pill:'p-onway', pillLabel:'On the way', listLine:'Responder team - on the way'};
  if(label.includes('arrived')) return {status:'arrived', pill:'p-onway', pillLabel:'Arrived', listLine:'Responder team - arrived on scene'};
  if(label.includes('responding')) return {status:'responding', pill:'p-responding', pillLabel:'Responding', listLine:'Responder team - responding'};
  if(label.includes('resolved')) return {status:'resolved', pill:'p-assigned', pillLabel:'Resolved', listLine:'Awaiting barangay confirmation'};
  return {status:'assigned', pill:'p-assigned', pillLabel:'Assigned', listLine:statusLabel || 'Barangay verified'};
}

function iconClassForHazard(hazard){
  const type = normalizeHazardType(hazard);
  if(type === 'Flood') return 'ic-flood';
  if(type === 'Fire') return 'ic-fire';
  if(type === 'Storm') return 'ic-storm';
  if(type === 'Road Block') return 'ic-roadblock';
  if(type === 'Earthquake') return 'ic-earthquake';
  if(type === 'Medical') return 'ic-med';
  return 'ic-crime';
}

function hazardIconSvg(hazard){
  const type = normalizeHazardType(hazard);
  if (type === 'Flood') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 10.5 12 5l7.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 9.8V15h10V9.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 15v-2.5h5V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 18c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 21c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === 'Fire') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2.5c1.7 2.05 2.28 4 .94 5.93-.54.78-1.39 1.47-2.08 2.21C10.08 11.72 9 13.23 9 15a3 3 0 0 0 6 0c0-1.52-.74-2.62-1.77-3.84-.56-.67-.86-1.42-.74-2.36.08-.62.27-1.11.71-1.92Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.05 11.2c-1.46 1.07-2.05 2.05-2.05 3.15a2 2 0 0 0 4 0c0-.82-.33-1.45-1.05-2.25-.41-.46-.62-.98-.56-1.73-.13.15-.22.28-.34.41Z" fill="currentColor" opacity=".28"/><path d="M12 10.9c-1.25.98-1.8 1.86-1.8 2.88a1.8 1.8 0 0 0 3.6 0c0-.74-.31-1.31-.96-2.03-.36-.4-.56-.86-.52-1.5-.09.1-.18.2-.32.34Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (type === 'Storm') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 16a4 4 0 1 1 .7-7.94A5 5 0 0 1 17 10a3.5 3.5 0 0 1-.5 6.97H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 12.5 10 17h2.2l-.7 3.5L15 15.5h-2.2l.7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  if (type === 'Road Block') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.5 6h-11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 14v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 14v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 8 10 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 8l2.5 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 8 19 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === 'Earthquake') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v14H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 9.5 12 12l-2 2.5L12 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 9h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 15h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === 'Medical') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 12h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8.2v5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.2" fill="currentColor"/></svg>';
}

function extractHazardAndLocation(title){
  const raw = String(title || '');
  const parts = raw.split(' - ');
  if(parts.length >= 2) {
    return { hazard: parts[0].trim(), location: parts.slice(1).join(' - ').trim() };
  }
  return { hazard: 'Hazard', location: raw.trim() };
}

function peopleAffectedLabel(code){
  const value = String(code || '').toLowerCase().trim();
  if(!value) return '';
  if(value === '1_5') return '1-5';
  if(value === '1-5') return '1-5';
  if(value === '6_20') return '6-20';
  if(value === '6-20') return '6-20';
  if(value === '20_plus') return '20+';
  if(value === '20+') return '20+';
  if(value === 'unknown') return 'Unknown';
  return String(code || '').trim().replace(/_/g, ' ');
}

function injuryLabel(code){
  const value = String(code || '').toLowerCase().trim();
  if(!value) return '';
  if(value === 'none') return 'None';
  if(value === 'possible') return 'Possible';
  if(value === 'confirmed') return 'Confirmed';
  return '';
}

function roadConditionLabel(code){
  const value = String(code || '').toLowerCase().trim();
  if(!value) return '';
  if(value === 'passable') return 'Passable';
  if(value === 'slow') return 'Slow';
  if(value === 'blocked') return 'Blocked';
  return String(code || '').trim();
}

function normalizeHazardType(value){
  const hazard = String(value || '').trim().toLowerCase();
  if(hazard === 'roadblock') return 'Road Block';
  if(hazard === 'storm surge' || hazard === 'typhoon') return 'Storm';
  if(hazard === 'medical emergency') return 'Medical';
  if(!hazard) return 'Hazard';
  return String(value || '').trim();
}

function hazardDetailLabelByType(hazard){
  const type = normalizeHazardType(hazard);
  if(type === 'Flood') return 'Flood depth';
  if(type === 'Fire') return 'Fire status';
  if(type === 'Storm') return 'Storm impact';
  if(type === 'Road Block') return 'Road block type';
  if(type === 'Earthquake') return 'Earthquake effect';
  if(type === 'Medical') return 'Medical need';
  return 'Hazard detail';
}

function renderSituationDetails(report){
  const grid = document.getElementById('detailSituationGrid');
  if(!grid) return;

  const hazard = normalizeHazardType(report && report.hazard ? report.hazard : '');
  const safe = (value, fallback) => {
    const clean = String(value || '').trim();
    return clean ? clean : fallback;
  };

  const rows = [
    {label: 'People affected', value: safe(report.peopleAffected, 'Not specified')},
    {label: 'Injuries', value: safe(report.injuries, 'Not specified')},
    {label: 'Road status', value: safe(report.roadStatus, 'Not specified')},
    {label: hazardDetailLabelByType(hazard), value: safe(report.hazardDetail, 'Not specified')},
    {label: 'Coordinates', value: (Number.isFinite(report.latitude) && Number.isFinite(report.longitude)) ? `${Number(report.latitude).toFixed(6)}, ${Number(report.longitude).toFixed(6)}` : 'Not available'},
    {label: 'Rescue needed', value: safe(report.rescueNeededLabel, 'No')}
  ];

  const photoPath = String(report.photoPath || '').trim();
  const photoUrl = photoPath ? (`/HANDAVis/${photoPath.replace(/^\/+/, '')}`) : '';
  const photoContent = photoUrl
    ? `<img class="id-photo-img" src="${escapeHtml(photoUrl)}" alt="Incident photo evidence" loading="lazy" />`
    : '<div class="id-photo-empty-text">No photo attached</div>';
  const photoCardClass = photoUrl ? 'id-photo-card' : 'id-photo-card id-photo-empty';
  const photoHtml =
    `<div class="${photoCardClass}">` +
      '<div class="id-photo-head">Photo Evidence</div>' +
      photoContent +
    '</div>';

  grid.innerHTML = photoHtml + rows.map((row) => (
    '<div class="id-meta-item">' +
      '<div class="id-meta-label">' + escapeHtml(row.label) + '</div>' +
      '<div class="id-meta-value">' + escapeHtml(row.value) + '</div>' +
    '</div>'
  )).join('');
}

function mapFeedReport(feed, options = {}){
  const isHistory = options.history === true;
  const id = String(feed.id);
  const parsed = extractHazardAndLocation(feed.title);
  const hazard = normalizeHazardType(feed.hazard || parsed.hazard || 'Hazard');
  const locationText = (feed.locationText || parsed.location || 'Barangay area').trim();
  const deptKey = deptKeyFromHazard(hazard);
  const deptLabel = deptLabelFromKey(deptKey);
  const statusUi = statusToUi(feed.statusCode, feed.statusLabel);
  const peopleCode = feed.peopleAffectedCode || feed.people_affected_code || feed.peopleAffected || '';
  const injuryCode = feed.injuryLevelCode || feed.injury_level_code || feed.injuries || '';
  const roadCode = feed.roadConditionCode || feed.road_condition_code || feed.roadStatus || '';
  const hazardDetail = String(feed.hazardSpecificDetail || feed.hazard_specific_detail || feed.hazardDetail || '').trim();
  const lat = toNumberOrNull(feed.latitude ?? feed.lat);
  const lng = toNumberOrNull(feed.longitude ?? feed.lng);

  return {
    id,
    name: hazard,
    loc: locationText,
    time: toRelativeTime(feed.createdAt),
    dept: deptLabel,
    desc: `Reported by ${feed.reporterName || 'Community member'}. ${feed.description || 'No additional description provided.'}`,
    status: statusUi.status,
    pill: statusUi.pill,
    pillLabel: statusUi.pillLabel,
    listLine: isHistory ? 'Barangay confirmed as resolved' : statusUi.listLine,
    cat: `Hazard type: ${hazard}`,
    responder: String(feed.activeResponderName || '').trim() || null,
    deptKey,
    reporterName: feed.reporterName || 'Community member',
    hazard: hazard,
    latitude: lat,
    longitude: lng,
    peopleAffected: peopleAffectedLabel(peopleCode),
    injuries: injuryLabel(injuryCode),
    roadStatus: roadConditionLabel(roadCode),
    hazardDetail: hazardDetail,
    rescueNeededLabel: feed.rescueNeeded ? 'Yes' : 'No',
    photoLabel: feed.hasPhoto ? 'Attached' : 'None',
    photoPath: String(feed.photoPath || ''),
    confirmWeight: feed.confirmWeight || 0,
    rejectWeight: feed.rejectWeight || 0,
    rawStatusLabel: feed.statusLabel || '',
    statusCode: feed.statusCode || '',
    createdAtRaw: feed.createdAt || '',
    closedAtRaw: feed.closedAt || '',
    hasActiveAssignment: !!feed.hasActiveAssignment,
    assignmentId: feed.activeAssignmentId ? Number(feed.activeAssignmentId) : null
  };
}

function reportIdLabel(id){
  const clean = String(id || '').trim();
  return clean ? `Report ID: HR-${clean}` : 'Report ID: -';
}

function shouldShowAssignedResponder(report){
  const statusCode = String(report?.statusCode || '').toLowerCase().trim();
  const responderName = String(report?.responder || '').trim();
  if (!responderName) return false;
  return ['responders_assigned', 'on_the_way', 'arrived', 'responding', 'resolved'].includes(statusCode);
}

function renderDeptCardValue(report){
  const labelEl = document.getElementById('detailDeptLabel');
  const valueEl = document.getElementById('detailDept');
  if (!labelEl || !valueEl) return;
  if (shouldShowAssignedResponder(report)) {
    labelEl.textContent = 'Assigned responder';
    valueEl.textContent = String(report.responder || '-');
    return;
  }
  labelEl.textContent = 'Dept. needed';
  valueEl.textContent = String(report.dept || '-');
}

function renderReportList(){
  const list = document.getElementById('reportList');
  const badge = document.getElementById('reportCountBadge');
  if(!list) return;

  const items = reportOrder.map(id => reports[id]).filter(Boolean);
  if(badge) badge.textContent = `${items.length} report${items.length === 1 ? '' : 's'}`;

  if(!items.length){
    list.innerHTML = `<div class="r-item"><div class="r-body"><div class="r-name">No hazard reports found</div><div class="r-loc">Your barangay feed is currently empty.</div></div></div>`;
    return;
  }

  list.innerHTML = items.map(r => {
    const iconCls = iconClassForHazard(r.hazard);
    const iconSvg = hazardIconSvg(r.hazard);
    const selectedCls = selectedReport === r.id ? ' selected' : '';
    return `
      <div class="r-item${selectedCls}" data-id="${escapeHtml(r.id)}" onclick="selectReport('${escapeHtml(r.id)}')">
        <div class="r-ico ${iconCls}">${iconSvg}</div>
        <div class="r-body">
          <div class="r-name">${escapeHtml(r.name)}</div>
          <div class="r-loc">${escapeHtml(r.loc)} - ${escapeHtml(r.time)}</div>
          <div class="r-status-line"><span style="color:#9db0c8;font-size:11px">${escapeHtml(r.listLine)}</span></div>
        </div>
        <div class="r-meta"><span class="pill ${r.pill}">${escapeHtml(r.pillLabel)}</span><span class="time">${escapeHtml(r.time)}</span></div>
      </div>
    `;
  }).join('');
}

function updateUrgentBar(){
  const urgentBar = document.getElementById('urgentBar');
  if(!urgentBar) return;
  const pendingItems = reportOrder.map(id => reports[id]).filter(r => r && String(r.statusCode || '').toLowerCase() === 'verified_barangay');
  if(!pendingItems.length){
    urgentBar.style.display = 'none';
    return;
  }
  urgentBar.style.display = 'flex';
  const text = urgentBar.querySelector('.ub-text');
  const sub = urgentBar.querySelector('.ub-sub');
  if(text) text.textContent = `${pendingItems.length} hazard report${pendingItems.length === 1 ? '' : 's'} need assignment - ${pendingItems[0].name.toLowerCase()} is verified`;
  if(sub) sub.textContent = 'Select a verified report to review quick details and assign a responder team';
}

function formatAbsoluteDateTime(raw){
  if(!raw) return '-';
  const d = new Date(raw);
  if(!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString();
}

function formatDateOnly(raw){
  if(!raw) return '-';
  const d = new Date(raw);
  if(!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOnly(raw){
  if(!raw) return '-';
  const d = new Date(raw);
  if(!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function durationLabel(fromRaw, toRaw){
  const from = new Date(fromRaw || '').getTime();
  const to = new Date(toRaw || '').getTime();
  if(!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 'Duration unavailable';
  const mins = Math.max(1, Math.round((to - from) / 60000));
  if(mins < 60) return `~${mins} minutes`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if(rem === 0) return `~${hrs} hour${hrs > 1 ? 's' : ''}`;
  return `~${hrs}h ${rem}m`;
}

function initialsFromName(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'HR';
  const first = parts[0].charAt(0) || '';
  const second = parts.length > 1 ? (parts[parts.length - 1].charAt(0) || '') : '';
  const out = (first + second).toUpperCase();
  return out || 'HR';
}

function sevChip(label, cls){
  return `<span class="d-val">${escapeHtml(label)}</span>`;
}

function peopleAffectedChip(value){
  const v = String(value || '').toLowerCase();
  if(v.includes('20')) return sevChip('20+ people');
  if(v.includes('6-20') || v.includes('6')) return sevChip('6-20 people');
  if(v.includes('1-5') || v.includes('1')) return sevChip('1-5 people');
  return sevChip('Not specified');
}

function injuriesChip(value){
  const v = String(value || '').toLowerCase();
  if(v.includes('confirmed')) return sevChip('Confirmed');
  if(v.includes('possible')) return sevChip('Possible');
  if(v.includes('none')) return sevChip('None');
  return sevChip('Not specified');
}

function roadStatusChip(value){
  const v = String(value || '').toLowerCase();
  if(v.includes('blocked')) return sevChip('Blocked');
  if(v.includes('slow')) return sevChip('Slow');
  if(v.includes('passable')) return sevChip('Passable');
  return sevChip('Not specified');
}

function genericValueChip(value){
  const v = String(value || '').trim();
  if(!v) return sevChip('Not specified');
  return sevChip(v);
}

function rescueChip(value){
  const v = String(value || '').toLowerCase();
  if(v === 'yes') return sevChip('Yes');
  if(v === 'no') return sevChip('No');
  return sevChip('Not specified');
}

function photoChip(photoPath){
  return sevChip(photoPath ? 'Attached' : 'None submitted');
}

function renderHistoryList(){
  const list = document.getElementById('historyList');
  const badge = document.getElementById('historyCountBadge');
  if(!list) return;

  const items = historyOrder.map(id => historyReports[id]).filter(Boolean);
  if(badge) badge.textContent = `${items.length} incident${items.length === 1 ? '' : 's'}`;

  if(!items.length){
    list.innerHTML = '<div class="history-empty">No resolved incidents in history yet.</div>';
    return;
  }

  list.innerHTML = items.map((r) => {
    const iconCls = iconClassForHazard(r.hazard);
    const iconSvg = hazardIconSvg(r.hazard);
    const closedAtRaw = r.closedAtRaw || r.createdAtRaw;
    const reportedAtRaw = r.createdAtRaw;
    const finalStatusLabel = String(r.rawStatusLabel || r.pillLabel || 'Resolved');
    const reporter = String(r.reporterName || 'Community member');
    const reporterInitials = initialsFromName(reporter);
    const hazardLabel = normalizeHazardType(r.hazard || 'Hazard') + ' Incident';
    const resolvedBy = String(r.dept || 'Responder Team').trim();
    const detailLabel = hazardDetailLabelByType(r.hazard || 'Hazard');
    const locationLine = String(r.loc || 'Barangay area');
    const duration = durationLabel(reportedAtRaw, closedAtRaw);
    return `
      <div class="history-item hx-card">
        <div class="hx-hero">
          <div class="hx-hero-top">
            <div class="r-ico ${iconCls}">${iconSvg}</div>
            <div class="hx-hero-text">
              <div class="hx-hero-type">${escapeHtml(hazardLabel)}</div>
              <div class="hx-hero-title">${escapeHtml(locationLine)}</div>
              <div class="hx-hero-loc">${escapeHtml('Reported ' + r.time)}</div>
            </div>
            <div class="hx-hero-right">
              <div class="resolved-badge"><div class="resolved-dot"></div><div class="resolved-label">${escapeHtml(finalStatusLabel)}</div></div>
              <div class="report-id">Report ID: HR-${escapeHtml(r.id)}</div>
            </div>
          </div>
          <div class="hero-timeline">
            <div class="tl-cell">
              <div class="tl-label">Reported</div>
              <div class="tl-val">${escapeHtml(formatDateOnly(reportedAtRaw))}</div>
              <div class="tl-sub">${escapeHtml(formatTimeOnly(reportedAtRaw))}</div>
              <div class="duration-chip">${escapeHtml('Duration: ' + duration)}</div>
            </div>
            <div class="tl-divider"></div>
            <div class="tl-cell completed">
              <div class="tl-label">Completed</div>
              <div class="tl-val">${escapeHtml(formatDateOnly(closedAtRaw))}</div>
              <div class="tl-sub">${escapeHtml(formatTimeOnly(closedAtRaw))}</div>
              <div class="duration-chip duration-chip-resolved">${escapeHtml('Resolved by ' + resolvedBy)}</div>
            </div>
          </div>
        </div>

        <div class="desc-card">
          <div class="desc-head">
            <div class="section-bar"></div>
            <div class="section-title">Reporter Message</div>
          </div>
          <div class="desc-body">
            <div class="desc-quote">${escapeHtml(r.desc)}</div>
            <div class="reporter-line">
              <div class="reporter-av">${escapeHtml(reporterInitials)}</div>
              <div class="reporter-name">Reported by <span class="reporter-name-val">${escapeHtml(reporter)}</span></div>
            </div>
          </div>
        </div>

        <div class="details-card">
          <div class="desc-head">
            <div class="section-bar"></div>
            <div class="section-title">Incident Details</div>
          </div>
          <div class="details-grid">
            <div class="dept-row">
              <div class="d-label"><div class="d-label-dot"></div>Department assigned</div>
              ${sevChip(resolvedBy, 'sev-drt')}
            </div>
            <div class="detail-row">
              <div class="d-label"><div class="d-label-dot"></div>People affected</div>
              ${peopleAffectedChip(r.peopleAffected)}
            </div>
            <div class="detail-row">
              <div class="d-label"><div class="d-label-dot"></div>Injuries</div>
              ${injuriesChip(r.injuries)}
            </div>
            <div class="detail-row">
              <div class="d-label"><div class="d-label-dot"></div>Road status</div>
              ${roadStatusChip(r.roadStatus)}
            </div>
            <div class="detail-row">
              <div class="d-label"><div class="d-label-dot"></div>${escapeHtml(detailLabel)}</div>
              ${genericValueChip(r.hazardDetail)}
            </div>
            <div class="detail-row">
              <div class="d-label"><div class="d-label-dot"></div>Rescue needed</div>
              ${rescueChip(r.rescueNeededLabel)}
            </div>
            <div class="detail-row">
              <div class="d-label"><div class="d-label-dot"></div>Photo evidence</div>
              ${photoChip(r.photoPath)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function clearDetailState(){
  const emptyState = document.getElementById('emptyState');
  const detailCard = document.getElementById('detailCard');
  const deptPanel = document.getElementById('deptPanel');
  const assignFooter = document.getElementById('assignFooter');
  const trackerPanel = document.getElementById('trackerPanel');
  if(emptyState) emptyState.style.display = 'block';
  if(detailCard) detailCard.style.display = 'none';
  if(deptPanel) deptPanel.style.display = 'none';
  if(assignFooter) assignFooter.style.display = 'none';
  if(trackerPanel) trackerPanel.style.display = 'none';
}

function selectReport(id){
  selectedReport = id;
  selectedResponder = null;
  const r = reports[id];
  renderReportList();
  if(!r){
    clearDetailState();
    updateIncidentMapMarkers();
    return;
  }

  document.getElementById('emptyState').style.display='none';
  document.getElementById('detailCard').style.display='block';
  document.getElementById('detailName').textContent = reportIdLabel(r.id);
  const pill=document.getElementById('detailPill');
  pill.className='pill '+r.pill;
  pill.textContent=r.pillLabel;
  document.getElementById('detailCat').textContent=r.cat;
  document.getElementById('detailLoc').textContent=r.loc;
  document.getElementById('detailTime').textContent=r.time;
  renderDeptCardValue(r);
  document.getElementById('detailDesc').textContent=r.desc;
  renderSituationDetails(r);

  const canAssign = String(r.statusCode || '').toLowerCase() === 'verified_barangay';
  const resp=(deptResponders[r.deptKey] || []).map((item) => ({...item}));
  const reportLat = toNumberOrNull(r.latitude);
  const reportLng = toNumberOrNull(r.longitude);
  let nearest = null;
  if (reportLat !== null && reportLng !== null) {
    resp.forEach((item) => {
      const lat = toNumberOrNull(item.latitude);
      const lng = toNumberOrNull(item.longitude);
      if (item.selectable && lat !== null && lng !== null) {
        item.distanceKm = haversineKm(reportLat, reportLng, lat, lng);
      }
    });
    resp.sort((a, b) => {
      const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
      const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
      return ad - bd;
    });
    nearest = resp.find((item) => item.selectable && Number.isFinite(item.distanceKm)) || null;
  }
  if (!nearest) {
    nearest = resp.find((item) => item.selectable) || null;
  }
  const sugWrap=document.getElementById('suggestedWrap');
  if(canAssign && nearest){
    sugWrap.style.display='block';
    document.getElementById('sugAv').textContent=nearest.av;
    document.getElementById('sugName').textContent=nearest.name+' - '+r.dept;
    const nearestDistance = Number.isFinite(nearest.distanceKm) ? `${formatDistanceKm(nearest.distanceKm)} away` : 'Distance unavailable';
    document.getElementById('sugDist').textContent=`${nearestDistance} - Nearest available`;
  } else {
    sugWrap.style.display='none';
  }

  renderDept(id);
  renderTracker(id);
  loadReportHistory(id);
  if(canAssign){
    document.getElementById('deptPanel').style.display='block';
    document.getElementById('assignFooter').style.display='flex';
    document.getElementById('trackerPanel').style.display='none';
  } else {
    document.getElementById('deptPanel').style.display='none';
    document.getElementById('assignFooter').style.display='none';
    document.getElementById('trackerPanel').style.display='block';
  }
  updateIncidentMapMarkers({ focusSelected: true });
}

function updateStepBanner(){
  return;
}

function renderDept(id){
  const r=reports[id];
  const resp=(deptResponders[r.deptKey] || []).map((item) => ({...item}));
  const reportLat = toNumberOrNull(r.latitude);
  const reportLng = toNumberOrNull(r.longitude);
  let nearestId = null;
  let nearestDistance = null;
  resp.forEach((item) => {
    const lat = toNumberOrNull(item.latitude);
    const lng = toNumberOrNull(item.longitude);
    if(reportLat !== null && reportLng !== null && lat !== null && lng !== null){
      item.distanceKm = haversineKm(reportLat, reportLng, lat, lng);
      item.dist = formatDistanceKm(item.distanceKm);
    } else {
      item.distanceKm = null;
      item.dist = 'Unknown';
    }
    if(item.selectable && Number.isFinite(item.distanceKm)){
      if(nearestDistance === null || item.distanceKm < nearestDistance){
        nearestDistance = item.distanceKm;
        nearestId = item.id;
      }
    }
  });
  resp.forEach((item) => {
    item.nearest = nearestId !== null && item.id === nearestId;
  });
  resp.sort((a, b) => {
    if(a.selectable !== b.selectable) return a.selectable ? -1 : 1;
    const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
    const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
    if(ad !== bd) return ad - bd;
    return String(a.name).localeCompare(String(b.name));
  });
  document.getElementById('deptPanelTitle').textContent=r.dept+' - available responders';
  const list=document.getElementById('deptList');
  list.innerHTML='';
  if(!resp.length){
    list.innerHTML = '<div style="padding:12px 16px;color:#89a2b5;font-size:12px">No responder accounts found in database for this area.</div>';
    return;
  }
  const rl=document.createElement('div');
  rl.className='resp-list-small';
  rl.style.padding='6px 16px 10px';
  resp.forEach(rs=>{
    const row=document.createElement('div');
    row.className='rr'+(rs.busy?' busy':'');
    row.id='rr-'+rs.id;
    row.innerHTML=`<div class="r-av ${rs.cls}">${rs.av}</div><div class="r-rname">${rs.name}</div>${rs.nearest&&rs.selectable?'<span class="near-tag">Nearest</span>':''}<div class="r-rdist">${rs.dist}</div><div class="status-dot ${rs.status==='available'?'sd-on':'sd-off'}"></div>`;
    if(rs.selectable) row.onclick=()=>pickResponder(rs);
    rl.appendChild(row);
  });
  list.appendChild(rl);
}

function pickResponder(rs){
  selectedResponder=rs;
  document.querySelectorAll('.rr').forEach(el=>el.classList.remove('picked'));
  const el=document.getElementById('rr-'+rs.id);
  if(el) el.classList.add('picked');
  document.getElementById('assignBtn').disabled=false;
}

function confirmSuggested(){
  const r=reports[selectedReport];
  if(!r) return;
  const resp=(deptResponders[r.deptKey] || []).map((item) => ({...item}));
  const reportLat = toNumberOrNull(r.latitude);
  const reportLng = toNumberOrNull(r.longitude);
  let nearest = null;
  if (reportLat !== null && reportLng !== null) {
    resp.forEach((item) => {
      const lat = toNumberOrNull(item.latitude);
      const lng = toNumberOrNull(item.longitude);
      if (item.selectable && lat !== null && lng !== null) {
        item.distanceKm = haversineKm(reportLat, reportLng, lat, lng);
      }
    });
    resp.sort((a, b) => {
      const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
      const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
      return ad - bd;
    });
    nearest = resp.find((item) => item.selectable && Number.isFinite(item.distanceKm)) || null;
  }
  if (!nearest) {
    nearest = resp.find((item) => item.selectable) || null;
  }
  if(nearest){ pickResponder(nearest); doAssign(); }
}

function doAssign(){
  if(!selectedReport||!selectedResponder) return;
  const r=reports[selectedReport];
  if(!r) return;
  if(String(r.statusCode || '').toLowerCase() !== 'verified_barangay'){
    showToast('Only verified reports can be assigned.');
    return;
  }

  fetch('../../database/barangay/barangay_incident_reports.php?action=barangay_assign', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      reportId: Number(r.id),
      responderUserId: Number(selectedResponder.userId || 0)
    })
  })
    .then((res) => res.json().catch(() => ({})).then((data) => ({ok: res.ok, data})))
    .then(({ok, data}) => {
      if(!ok || !data?.ok){
        throw new Error(data?.error || 'Failed to update report status');
      }

      r.status='assigned';
      r.statusCode = data?.statusCode || 'responders_assigned';
      r.responder=selectedResponder.name;
      r.pill='p-assigned';
      r.pillLabel='Assigned';
      r.listLine = `${selectedResponder.name} - assignment sent`;
      if (data?.assignmentId) {
        r.assignmentId = Number(data.assignmentId);
      }
      const assignedId = `HR-${String(r.id)}`;
      allResponders = allResponders.map((item) => {
        if (item.id !== selectedResponder.id) return item;
        return {
          ...item,
          status: 'deployed',
          currentTask: `Assigned to ${assignedId}`,
          assignedReportId: assignedId
        };
      });
      deptResponders = buildDeptResponders(allResponders);
      buildAllDepts();

      document.getElementById('detailPill').className='pill p-assigned';
      document.getElementById('detailPill').textContent='Assigned';
      renderDeptCardValue(r);
      document.getElementById('suggestedWrap').style.display='none';
      document.getElementById('deptPanel').style.display='none';
      document.getElementById('assignFooter').style.display='none';
      document.getElementById('trackerPanel').style.display='block';

      updateUrgentBar();
      renderReportList();
      renderTracker(selectedReport);
      loadReportHistory(selectedReport);
      updateStepBanner('assigned');
      showToast('Report status updated in database.');
    })
    .catch((err) => {
      showToast(err?.message || 'Failed to update report status.');
    });
}

function renderTracker(id){
  const r=reports[id];
  if(!r) return;
  const history = Array.isArray(reportHistoryById[String(id)]) ? [...reportHistoryById[String(id)]] : [];
  history.sort((a, b) => {
    const ta = new Date(a?.createdAt || '').getTime();
    const tb = new Date(b?.createdAt || '').getTime();
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    if (va !== vb) return va - vb;

    const ra = timelineStatusRank(a?.statusCode);
    const rb = timelineStatusRank(b?.statusCode);
    if (ra !== rb) return ra - rb;

    return Number(a?.id || 0) - Number(b?.id || 0);
  });
  document.getElementById('trackerName').textContent=r.responder?'- '+r.responder:'';
  const el=document.getElementById('stepsEl');
  el.innerHTML='';
  if(!history.length){
    el.innerHTML = '<div style="padding:8px 2px;color:#89a2b5;font-size:12px">No status history available yet for this report.</div>';
  } else {
    history.forEach((h, i) => {
      const last = i === history.length - 1;
      const row = document.createElement('div');
      row.className='step-row';
      const code = timelineStatusCode(h?.statusCode);
      const note = timelineStatusNote(code, h?.note);
      const label = timelineStatusLabel(code, h?.statusLabel);
      row.innerHTML = `<div class="step-left"><div class="step-circle sc-done">${i+1}</div>${!last?'<div class="step-line sl-done"></div>':''}</div><div class="step-content"><div class="sc-label done">${escapeHtml(label)}</div><div class="sc-time">${escapeHtml(toRelativeTime(h.createdAt))}</div><div class="sc-note">${escapeHtml(note)}${h.updatedBy ? ` by ${escapeHtml(h.updatedBy)}` : ''}</div></div>`;
      el.appendChild(row);
    });
  }

  const confirmWrap = document.getElementById('resolutionActionWrap');
  const confirmBtn = document.getElementById('confirmResolvedBtn');
  const canConfirm = String(r.statusCode || '').toLowerCase() === 'resolved' && !!r.hasActiveAssignment;
  if (confirmWrap) confirmWrap.style.display = canConfirm ? 'block' : 'none';
  if (confirmBtn) confirmBtn.disabled = !canConfirm;
}
function loadReportHistory(reportId){
  return fetch(`../../database/barangay/barangay_incident_reports.php?action=barangay_report_history&report_id=${encodeURIComponent(reportId)}`)
    .then((r) => r.json())
    .then((result) => {
      if(!result?.ok){
        throw new Error(result?.error || 'history load failed');
      }
      reportHistoryById[String(reportId)] = Array.isArray(result.history) ? result.history : [];
      if(String(selectedReport) === String(reportId)){
        renderTracker(reportId);
      }
    })
    .catch(() => {
      reportHistoryById[String(reportId)] = [];
      if(String(selectedReport) === String(reportId)){
        renderTracker(reportId);
      }
    });
}

function confirmResolvedByBarangay(){
  if(!selectedReport) return;
  const r = reports[selectedReport];
  if(!r) return;
  if(!(String(r.statusCode || '').toLowerCase() === 'resolved' && r.hasActiveAssignment)){
    showToast('This incident is not waiting for final barangay confirmation.');
    return;
  }

  fetch('../../database/barangay/barangay_incident_reports.php?action=barangay_confirm_resolved', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      reportId: Number(r.id),
      assignmentId: r.assignmentId ? Number(r.assignmentId) : 0
    })
  })
    .then((res) => res.json().catch(() => ({})).then((data) => ({ok: res.ok, data})))
    .then(({ok, data}) => {
      if(!ok || !data?.ok){
        throw new Error(data?.error || 'Failed to confirm resolved incident');
      }

      Promise.all([
        loadIncidentReports({ preserveSelection: false, silent: true }),
        loadHistoryReports({ silent: true })
      ]).then(() => {
        showToast('Incident confirmed and moved out of active monitoring.');
      });
    })
    .catch((err) => {
      showToast(err?.message || 'Failed to confirm resolved incident.');
    });
}
function mapResponder(user){
  const deptKey = user?.deptKey || 'disaster';
  const idNum = Number(user?.id || 0);
  const availabilityCode = String(user?.availabilityCode || '').toLowerCase().trim();
  const uiStatus = mapAvailabilityToUi(availabilityCode, !!user?.isActive);
  const activeAssignmentCount = Number(user?.activeAssignmentCount || 0);
  const maxActiveAssignments = Number(user?.maxActiveAssignments || 1);
  const canReceiveAssignment = user?.canReceiveAssignment !== false;
  const isDispatchable = user?.isDispatchable === true;
  const busyByLoad = maxActiveAssignments > 0 && activeAssignmentCount >= maxActiveAssignments;
  const activeReportId = Number(user?.activeReportId || 0);
  const activeStatusLabel = String(user?.activeAssignmentStatusLabel || '').trim();
  const activeStatusCode = String(user?.activeAssignmentStatusCode || '').trim();
  const reportTag = activeReportId > 0 ? `HR-${String(activeReportId)}` : 'None';
  const taskStatus = activeStatusLabel || activeStatusCode || 'Assigned';
  let searchAliases = '';
  if (deptKey === 'police') searchAliases = 'police pnp law enforcement peace order department dept';
  if (deptKey === 'fire') searchAliases = 'fire fire dept fire department bfp bureau of fire protection department dept';
  if (deptKey === 'medical') searchAliases = 'medical med ambulance ems paramedic health department dept';
  if (deptKey === 'disaster') searchAliases = 'disaster drrm rescue response team department dept';
  let finalStatus = uiStatus;
  if (uiStatus === 'available' && (!canReceiveAssignment || !isDispatchable || busyByLoad)) {
    finalStatus = 'deployed';
  }
  return {
    dept: deptKey,
    deptLabel: deptLabelFromKey(deptKey),
    color: deptColorByKey(deptKey),
    avCls: deptAvClassByKey(deptKey),
    id: `resp-${idNum || Math.floor(Math.random() * 100000)}`,
    userId: idNum || 0,
    roleName: user?.roleName || 'Responder',
    roleCode: user?.roleCode || 'responder',
    av: deptBadgeByKey(deptKey),
    name: user?.name || 'Unnamed responder',
    rank: user?.roleName || 'Responder',
    barangay: user?.barangay || '',
    city: user?.city || '',
    province: user?.province || '',
    searchAliases: searchAliases,
    dist: 'Unknown',
    status: finalStatus,
    availabilityLabel: user?.availabilityLabel || 'Offline',
    canReceiveAssignment: canReceiveAssignment,
    isDispatchable: isDispatchable && !busyByLoad,
    activeAssignmentCount: activeAssignmentCount,
    maxActiveAssignments: maxActiveAssignments,
    latitude: toNumberOrNull(user?.latitude),
    longitude: toNumberOrNull(user?.longitude),
    currentTask: activeReportId > 0 ? taskStatus : 'None',
    assignedReportId: reportTag
  };
}

function loadResponders(options = {}){
  const silent = options.silent === true;
  return fetch('../../database/barangay/barangay_incident_reports.php?action=barangay_responders')
    .then((r) => r.json())
    .then((result) => {
      if(!result?.ok){
        throw new Error(result?.error || 'responder load failed');
      }
      const responders = Array.isArray(result.responders) ? result.responders : [];
      allResponders = responders.map(mapResponder);
      deptResponders = buildDeptResponders(allResponders);
      buildAllDepts();

      if(!allResponders.length && !silent){
        showToast('No responder accounts found in database. Add users with Responder role to enable assignment.');
      }
    })
    .catch(() => {
      allResponders = [];
      deptResponders = buildDeptResponders(allResponders);
      buildAllDepts();
      if(!silent) showToast('Failed to load responder accounts.');
    });
}

function loadIncidentReports(options = {}){
  const preserveSelection = options.preserveSelection !== false;
  const silent = options.silent === true;
  return fetch('../../database/barangay/barangay_incident_reports.php?action=barangay_feed&view=incident')
    .then(r => r.json())
    .then(result => {
      if(!result?.ok) throw new Error('feed failed');
      setVerifyReportsBadge(result.pendingCount || 0);
      const nextReports = {};
      const nextOrder = [];
      (result.reports || []).forEach(feed => {
        const mapped = mapFeedReport(feed, { history: false });
        nextReports[mapped.id] = mapped;
        nextOrder.push(mapped.id);
      });
      const previousSelected = String(selectedReport || '');
      reports = nextReports;
      reportOrder = nextOrder;
      setIncidentMonitoringBadge(nextOrder.length);

      renderReportList();
      updateUrgentBar();

      if(reportOrder.length){
        const forcedReportId = String(new URLSearchParams(window.location.search).get('report_id') || '');
        const hasForced = forcedReportId && reportOrder.includes(forcedReportId);
        const keepSelected = preserveSelection && previousSelected && reportOrder.includes(previousSelected);
        const selectedId = hasForced ? forcedReportId : (keepSelected ? previousSelected : reportOrder[0]);
        selectReport(selectedId);
        loadReportHistory(selectedId);
      } else {
        clearDetailState();
        updateIncidentMapMarkers();
      }
    })
    .catch(() => {
      setVerifyReportsBadge(0);
      setIncidentMonitoringBadge(0);
      if(!silent) showToast('Failed to load hazard reports.');
      reports = {};
      reportOrder = [];
      renderReportList();
      updateUrgentBar();
      clearDetailState();
      updateIncidentMapMarkers();
    });
}

function loadHistoryReports(options = {}){
  const silent = options.silent === true;
  return fetch('../../database/barangay/barangay_incident_reports.php?action=barangay_feed&view=history')
    .then((r) => r.json())
    .then((result) => {
      if(!result?.ok) throw new Error('history feed failed');
      const nextReports = {};
      const nextOrder = [];
      (result.reports || []).forEach((feed) => {
        const mapped = mapFeedReport(feed, { history: true });
        nextReports[mapped.id] = mapped;
        nextOrder.push(mapped.id);
      });
      historyReports = nextReports;
      historyOrder = nextOrder;
      renderHistoryList();
    })
    .catch(() => {
      historyReports = {};
      historyOrder = [];
      renderHistoryList();
      if(!silent) showToast('Failed to load incident history.');
    });
}

const hvView = new URLSearchParams(window.location.search).get('view');
if (hvView === 'responders') {
  switchPage('all');
} else if (hvView === 'history') {
  switchPage('history');
}

function startAutoRefresh(){
  if(feedRefreshTimer) clearInterval(feedRefreshTimer);
  if(responderRefreshTimer) clearInterval(responderRefreshTimer);
  feedRefreshTimer = setInterval(() => {
    loadIncidentReports({ preserveSelection: true, silent: true });
    loadHistoryReports({ silent: true });
  }, FEED_REFRESH_MS);
  responderRefreshTimer = setInterval(() => {
    loadResponders({ silent: true });
  }, RESPONDER_REFRESH_MS);
}

loadResponders()
  .then(() => Promise.all([
    loadIncidentReports({ preserveSelection: true }),
    loadHistoryReports({ silent: true })
  ]))
  .then(startAutoRefresh);
