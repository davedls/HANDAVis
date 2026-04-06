<aside class="sidebar">
  <div class="brand-box">
    <h2>HANDAVis</h2>
    <p>Responder Command Portal</p>
    <p>Powered by HANDAm Intelligence</p>
  </div>

  <div class="nav-section-title">Sections</div>
  <?php $responderActivePage = $responderActivePage ?? 'dispatch_queue'; ?>
  <a class="sub-link <?php echo $responderActivePage === 'dispatch_queue' ? 'active-link' : ''; ?>" href="./index.php">Dispatch Queue</a>
  <a class="sub-link <?php echo $responderActivePage === 'command_map' ? 'active-link' : ''; ?>" href="./responder_command_map.php">Command Map</a>
  <a class="sub-link <?php echo $responderActivePage === 'resources' ? 'active-link' : ''; ?>" href="./responder_resources.php">Resources</a>
</aside>
