<?php $activeRole = isset($activeRole) ? $activeRole : ''; ?>
<div class="top-switcher">
  <a class="switch-btn <?php echo $activeRole === 'barangay' ? 'active' : ''; ?>" href="../barangays/barangay_index.php" style="text-decoration:none">Barangay Portal</a>
  <a class="switch-btn <?php echo $activeRole === 'responder' ? 'active' : ''; ?>" href="../responders/responder_index.php" style="text-decoration:none">Responder Portal</a>
  <a class="switch-btn <?php echo $activeRole === 'admin' ? 'active' : ''; ?>" href="../admin/admin_index.php" style="text-decoration:none">Admin Portal</a>
</div>
