<aside class="sidebar">
  <div class="brand-box">
    <h2>HANDAVis</h2>
    <p>Barangay Operations Portal</p>
    <p>Powered by HANDAm Intelligence</p>
  </div>

  <div class="nav-section-title">Sections</div>
  <?php
  $hvCurrentPage = basename($_SERVER['PHP_SELF'] ?? '');
  $hvIsIncidentPage = ($hvCurrentPage === 'barangay_incident-reporting.php');
  $hvIncidentView = (string)($_GET['view'] ?? '');
  $hvIsIncidentRespondersView = $hvIsIncidentPage && ($hvIncidentView === 'responders');
  ?>
  <button
    class="sub-link<?php echo $hvIsIncidentPage ? '' : ' active-link'; ?>"
    onclick="<?php echo $hvIsIncidentPage ? "window.location.href='barangay_index.php'" : "showSection('reports')"; ?>"
  >Verify Reports <span id="verifyReportsBadge" class="sub-link-badge" style="display:none;" aria-label="Pending verify reports count">0</span></button>
  <button
    class="sub-link"
    onclick="<?php echo $hvIsIncidentPage ? "window.location.href='barangay_index.php'" : "showSection('broadcast')"; ?>"
  >Broadcast &amp; Evacuation</button>
  <button
    class="sub-link<?php echo ($hvIsIncidentPage && !$hvIsIncidentRespondersView) ? ' active-link' : ''; ?>"
    onclick="window.location.href='barangay_incident-reporting.php'"
  >Incident Monitoring <span id="incidentMonitoringBadge" class="sub-link-badge" style="display:none;" aria-label="Active incident monitoring count">0</span></button>
  <button
    class="sub-link<?php echo $hvIsIncidentRespondersView ? ' active-link' : ''; ?>"
    onclick="window.location.href='barangay_incident-reporting.php?view=responders'"
  >All Responders</button>
</aside>
