(function initTheme() {
  const saved = localStorage.getItem('theme-preference');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
  }
  document.documentElement.classList.add('ready');
})();

let dashboardPollId = null;

function formatDateTime(raw) {
  if (!raw) return '-';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return '-';
  return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} - ${d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`;
}

function relativeTime(raw) {
  if (!raw) return 'Just now';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return 'Just now';
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} day ago`;
}

function statusBadgeLabel(statusCode) {
  const key = String(statusCode || '').toLowerCase();
  if (key === 'on_the_way') return 'On the Way';
  if (key === 'arrived') return 'Arrived';
  if (key === 'responding') return 'Responding';
  if (key === 'resolved') return 'Resolved';
  return 'Assigned';
}

function recentActivityStatusLabel(statusCode) {
  const key = String(statusCode || '').toLowerCase();
  if (key === 'resolved') return 'Resolved';
  if (key === 'responding') return 'Responding';
  if (key === 'arrived') return 'Arrived';
  if (key === 'on_the_way') return 'On the Way';
  return 'Assigned';
}

function setDefaultEmpty() {
  const notifTitle = document.getElementById('notifTitle');
  const notifSub = document.getElementById('notifSub');
  const notifTime = document.getElementById('notifTime');
  const incidentName = document.getElementById('incidentName');
  const incidentCategory = document.getElementById('incidentCategory');
  const incidentLocation = document.getElementById('incidentLocation');
  const incidentRelativeTime = document.getElementById('incidentRelativeTime');
  const incidentBadge = document.getElementById('incidentBadge');
  const incidentDescription = document.getElementById('incidentDescription');
  const incidentLocationDetail = document.getElementById('incidentLocationDetail');
  const incidentAssignedBy = document.getElementById('incidentAssignedBy');
  const incidentDateTime = document.getElementById('incidentDateTime');

  if (notifTitle) notifTitle.textContent = 'No active assignment yet';
  if (notifSub) notifSub.textContent = 'You are currently in standby mode.';
  if (notifTime) notifTime.textContent = '-';
  if (incidentName) incidentName.textContent = 'Waiting for assignment';
  if (incidentCategory) incidentCategory.textContent = 'No active incident assigned';
  if (incidentLocation) incidentLocation.textContent = '-';
  if (incidentRelativeTime) incidentRelativeTime.textContent = '-';
  if (incidentBadge) incidentBadge.textContent = 'Standby';
  if (incidentDescription) incidentDescription.textContent = 'No incident is currently linked to your responder account.';
  if (incidentLocationDetail) incidentLocationDetail.textContent = '-';
  if (incidentAssignedBy) incidentAssignedBy.textContent = '-';
  if (incidentDateTime) incidentDateTime.textContent = '-';
}

function applyAssignment(assignment) {
  const notifTitle = document.getElementById('notifTitle');
  const notifSub = document.getElementById('notifSub');
  const notifTime = document.getElementById('notifTime');
  const assignmentLink = document.getElementById('activeAssignmentLink');
  const openIncidentBtn = document.getElementById('openIncidentBtn');

  const incidentName = document.getElementById('incidentName');
  const incidentCategory = document.getElementById('incidentCategory');
  const incidentLocation = document.getElementById('incidentLocation');
  const incidentRelativeTime = document.getElementById('incidentRelativeTime');
  const incidentBadge = document.getElementById('incidentBadge');
  const incidentDescription = document.getElementById('incidentDescription');
  const incidentLocationDetail = document.getElementById('incidentLocationDetail');
  const incidentAssignedBy = document.getElementById('incidentAssignedBy');
  const incidentDateTime = document.getElementById('incidentDateTime');

  if (!assignment) {
    setDefaultEmpty();
    return;
  }

  const mapHref = `./responder_command_map.php?assignment_id=${encodeURIComponent(String(assignment.assignmentId || ''))}`;
  if (assignmentLink) assignmentLink.setAttribute('href', mapHref);
  if (openIncidentBtn) openIncidentBtn.setAttribute('href', mapHref);

  const hazard = assignment.hazardType || 'Incident';
  const loc = assignment.location || 'Barangay area';
  const statusLabel = statusBadgeLabel(assignment.statusCode);

  if (notifTitle) notifTitle.textContent = `Active assignment - ${hazard} at ${loc}`;
  if (notifSub) notifSub.textContent = `Assigned by ${assignment.assignedBy || 'Barangay'}. Open Command Map for route details.`;
  if (notifTime) notifTime.textContent = relativeTime(assignment.assignedAt);

  if (incidentName) incidentName.textContent = hazard;
  if (incidentCategory) incidentCategory.textContent = `${statusLabel} - Assigned by ${assignment.assignedBy || 'Barangay'}`;
  if (incidentLocation) incidentLocation.textContent = loc;
  if (incidentRelativeTime) incidentRelativeTime.textContent = relativeTime(assignment.assignedAt);
  if (incidentBadge) incidentBadge.textContent = statusLabel;
  if (incidentDescription) incidentDescription.textContent = assignment.description || 'No additional description provided.';
  if (incidentLocationDetail) incidentLocationDetail.textContent = loc;
  if (incidentAssignedBy) incidentAssignedBy.textContent = assignment.assignedBy || 'Barangay';
  if (incidentDateTime) incidentDateTime.textContent = formatDateTime(assignment.assignedAt);
}

function loadResponderAssignment() {
  fetch('../../database/responder/responder_incident_reports.php?action=responder_active_assignment')
    .then((r) => r.json())
    .then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Failed to load assignment');
      applyAssignment(result.assignment || null);
    })
    .catch(() => {
      setDefaultEmpty();
    });
}

function applyDashboardMetrics(metrics) {
  const myStatusValue = document.getElementById('metricMyStatusValue');
  const myStatusSubtext = document.getElementById('metricMyStatusSubtext');
  const assignmentsTodayValue = document.getElementById('metricAssignmentsTodayValue');
  const assignmentsTodaySubtext = document.getElementById('metricAssignmentsTodaySubtext');
  const avgResponseValue = document.getElementById('metricAvgResponseValue');
  const avgResponseSubtext = document.getElementById('metricAvgResponseSubtext');
  const handledValue = document.getElementById('metricHandledValue');
  const handledSubtext = document.getElementById('metricHandledSubtext');

  const myStatusLabel = String(metrics?.myStatus?.label || 'No assignment');
  const myStatusLocation = String(metrics?.myStatus?.location || 'No active assignment');
  const assignmentsTotal = Number(metrics?.assignmentsToday?.total || 0);
  const assignmentsResolved = Number(metrics?.assignmentsToday?.resolved || 0);
  const assignmentsActive = Number(metrics?.assignmentsToday?.active || 0);
  const avgMinutesRaw = metrics?.avgResponse?.minutes;
  const avgMinutes = Number.isFinite(Number(avgMinutesRaw)) ? Math.max(0, Math.round(Number(avgMinutesRaw))) : null;
  const avgLabel = String(metrics?.avgResponse?.windowLabel || 'This week');
  const handledCount = Number(metrics?.handledIncidents?.count || 0);
  const handledDesc = String(metrics?.handledIncidents?.description || 'Lifetime assignments completed');
  const recentActivity = Array.isArray(metrics?.recentActivity) ? metrics.recentActivity : [];

  if (myStatusValue) myStatusValue.textContent = myStatusLabel;
  if (myStatusSubtext) myStatusSubtext.textContent = myStatusLocation;
  if (assignmentsTodayValue) assignmentsTodayValue.textContent = String(assignmentsTotal);
  if (assignmentsTodaySubtext) assignmentsTodaySubtext.textContent = `${assignmentsResolved} resolved - ${assignmentsActive} active`;
  if (avgResponseValue) avgResponseValue.textContent = avgMinutes === null ? '-' : `${avgMinutes}min`;
  if (avgResponseSubtext) avgResponseSubtext.textContent = avgLabel;
  if (handledValue) handledValue.textContent = String(handledCount);
  if (handledSubtext) handledSubtext.textContent = handledDesc;
  renderRecentActivity(recentActivity);
}

function makeRecentActivityItem(activity) {
  const item = document.createElement('div');
  item.className = 'hist-item';

  const dot = document.createElement('div');
  dot.className = 'hist-dot';

  const body = document.createElement('div');
  body.className = 'hist-body';

  const name = document.createElement('div');
  name.className = 'hist-name';
  const hazardType = String(activity?.hazardType || 'Incident');
  const location = String(activity?.location || 'Location not provided');
  name.textContent = `${hazardType} - ${location}`;

  const sub = document.createElement('div');
  sub.className = 'hist-sub';
  const resolvedMinutes = Number(activity?.resolvedMinutes);
  const resolvedAt = String(activity?.resolvedAt || activity?.assignedAt || '');
  if (Number.isFinite(resolvedMinutes) && resolvedMinutes >= 0) {
    sub.textContent = `Resolved in ${Math.round(resolvedMinutes)} min - ${relativeTime(resolvedAt)}`;
  } else {
    sub.textContent = `Updated ${relativeTime(resolvedAt)}`;
  }

  const badge = document.createElement('span');
  badge.className = 'hist-badge';
  badge.textContent = recentActivityStatusLabel(activity?.statusCode);

  body.appendChild(name);
  body.appendChild(sub);
  item.appendChild(dot);
  item.appendChild(body);
  item.appendChild(badge);
  return item;
}

function renderRecentActivity(list) {
  const container = document.getElementById('recentActivityList');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(list) || list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hist-item';
    const dot = document.createElement('div');
    dot.className = 'hist-dot';
    const body = document.createElement('div');
    body.className = 'hist-body';
    const name = document.createElement('div');
    name.className = 'hist-name';
    name.textContent = 'No resolved activity yet';
    const sub = document.createElement('div');
    sub.className = 'hist-sub';
    sub.textContent = 'Resolved incidents today will appear here.';
    const badge = document.createElement('span');
    badge.className = 'hist-badge';
    badge.textContent = '-';
    body.appendChild(name);
    body.appendChild(sub);
    empty.appendChild(dot);
    empty.appendChild(body);
    empty.appendChild(badge);
    container.appendChild(empty);
    return;
  }

  list.forEach((activity) => {
    container.appendChild(makeRecentActivityItem(activity));
  });
}

function setMetricsFallback() {
  applyDashboardMetrics({
    myStatus: { label: 'No assignment', location: 'No active assignment' },
    assignmentsToday: { total: 0, resolved: 0, active: 0 },
    avgResponse: { minutes: null, windowLabel: 'This week' },
    handledIncidents: { count: 0, description: 'Lifetime assignments completed' },
    recentActivity: [],
  });
}

function loadDashboardMetrics() {
  fetch('../../database/responder/responder_incident_reports.php?action=responder_dashboard_metrics')
    .then((r) => r.json())
    .then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Failed to load metrics');
      applyDashboardMetrics(result.metrics || {});
    })
    .catch(() => {
      setMetricsFallback();
    });
}

function startDashboardPolling() {
  loadResponderAssignment();
  loadDashboardMetrics();
  dashboardPollId = window.setInterval(() => {
    loadResponderAssignment();
    loadDashboardMetrics();
  }, 15000);
}

document.addEventListener('DOMContentLoaded', startDashboardPolling);

window.addEventListener('beforeunload', () => {
  if (dashboardPollId !== null) {
    window.clearInterval(dashboardPollId);
    dashboardPollId = null;
  }
});
