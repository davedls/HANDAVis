<?php


if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en">
	<head>

    <link rel="stylesheet" href="assets/css/user_footer.css?v=<?php echo filemtime(__DIR__ . '/assets/css/user_footer.css'); ?>">
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HANDAVis Landing Page</title>
    <link rel="icon" type="image/svg+xml" href="images/handa.svg?v=<?php echo filemtime(__DIR__ . '/images/handa.svg'); ?>">
    <link rel="stylesheet" href="assets/css/index.css?v=<?php echo filemtime(__DIR__ . '/assets/css/index.css'); ?>">
    <link rel="stylesheet" href="assets/css/login_modal.css?v=<?php echo filemtime(__DIR__ . '/assets/css/login_modal.css'); ?>">
    
    <link rel="stylesheet" href="assets/css/mobile_index.css">
</head>
<body>
  <div id="top"></div>

  <header class="main-header">
    <div class="container nav-wrap">
 <div class="brand">
  <a href="index.php#top" class="logo-link">
    <img src="images/handa.png" alt="HANDAVis Logo" class="header-logo">
  </a>
  
  <div class="brand-text">
    <h1>HANDAVis</h1>
    <span>Prepared Communities Across Western Visayas</span>
  </div>
</div>

      <nav class="nav-links">
        <a class="nav-scroll-link" href="#about">About</a>
        <a class="nav-scroll-link" href="#mission">Mission</a>
        <a class="nav-scroll-link" href="#features">Features</a>
        <a class="nav-scroll-link" href="#map">Map Preview</a>
        <a class="nav-scroll-link" href="#cta">Explore</a>
        <button type="button" id="openAuthBtn" class="btn">Login</button>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="video-bg-container">
<video autoplay muted loop playsinline class="hero-video">
    <source src="assets/handavisvid.mp4" type="video/mp4">
    Your browser does not support the video tag.
</video>
        <div class="video-overlay"></div>
      </div>

      <div class="container hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">Disaster Intelligence Platform</div>
          <h2>
            <span>HANDAVis</span><br>
            Stay Handa.<br>
            See Risk Clearly.
          </h2>
          <p>
            A disaster risk awareness and response platform designed to help
            communities across Western Visayas stay informed, prepared, and resilient.
          </p>

          <div class="hero-actions">
            <a href="#about" class="btn">Learn More</a>
            <a href="#map" class="btn secondary">View Risk Preview</a>
          </div>
        </div>
      </div>
    </section>

    <div class="separator" style="margin-bottom:-1px;">
     <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">

        <path d="M0 120L1440 120L1440 0C1320 60 1080 120 720 120C360 120 120 60 0 0L0 120Z" fill="rgba(8, 17, 27, 0.9)"/>
      </svg>
    </div>

    <section id="about" class="section">
      <div class="container">
        <div class="section-head">
          <h3>About HANDAVis</h3>
          <p>
            HANDAVis was created to make disaster information more visible, understandable,
            and useful for the people who need it most.
          </p>
        </div>

        <div class="feature-grid">
          <div class="card">
            <div class="label" style="color:var(--cyan); font-size:11px; font-weight:700; margin-bottom:10px;">MEANING</div>
            <h4>HANDA + Vis</h4>
            <p>“HANDA” means prepared, while “Vis” represents both visibility and Visayas — the core identity of the platform.</p>
          </div>

          <div class="card">
            <div class="label" style="color:var(--cyan); font-size:11px; font-weight:700; margin-bottom:10px;">PURPOSE</div>
            <h4>Preparedness First</h4>
            <p>Built to support safer communities through real-time awareness, visual risk mapping, and accessible guidance.</p>
          </div>

          <div class="card">
            <div class="label" style="color:var(--cyan); font-size:11px; font-weight:700; margin-bottom:10px;">AUDIENCE</div>
            <h4>For Communities</h4>
            <p>Designed for residents, responders, barangays, and decision-makers who need clearer disaster information.</p>
          </div>

          <div class="card">
            <div class="label" style="color:var(--cyan); font-size:11px; font-weight:700; margin-bottom:10px;">APPROACH</div>
            <h4>User Experience</h4>
            <p>HANDAVis provides a high-speed, intuitive interface designed to turn complex disaster data into clear, life-saving actions for every resident of Western Visayas.</p>
          </div>
        </div>
      </div>
    </section>

 <section id="mission" class="section">
    <div class="mission-wrapper">
        
    <div class="mission-text-group scroll-animate">
    <div class="rocket-icon">
        <div class="r-flame"></div> <div class="r-body">
            <div class="r-window"></div>
            <div class="r-fin r-fin-l"></div>
            <div class="r-fin r-fin-r"></div>
        </div>
    </div>

    <h2 class="big-text">MISSION</h2>
    <p class="mission-desc">
        To empower communities in Western Visayas with timely, understandable, and 
        visually accessible disaster-related information that supports readiness, 
        response, and resilience.
    </p>
</div>

        <div class="vision-text-group scroll-animate">
    <div class="eye-icon">
        <div class="eye-outer">
            <div class="eye-iris">
                <div class="eye-pupil"></div>
                <div class="eye-shutter"></div>
            </div>
        </div>
        <div class="eye-scan-line"></div> </div>
            <p class="mission-desc">
                To create a safer and more prepared Visayas where residents, 
                responders, and local leaders can act with confidence because 
                risk is no longer hidden, delayed, or difficult to understand.
            </p>
            <h2 class="big-text">VISION</h2>
        </div>

    </div>
</section>

  <section id="features" class="features-diagonal-container">
    
    <div class="split-part part-1">
        <div class="split-content">
            <h3>Risk Mapping</h3>
            <p>Visualizing geospatial data to map high-risk zones, turning complex hazard statistics into clear, actionable preparedness for Western Visayas.</p>
        </div>
    </div>

    <div class="split-part part-2">
        <div class="split-content">
            <h3>Live Monitoring</h3>
            <p>Delivering precision-driven alerts by tracking active environmental shifts—from flood levels to seismic activity—to keep every resident informed.</p>
        </div>
    </div>

    <div class="split-part part-3">
        <div class="split-content">
            <h3>Preparedness</h3>
            <p>Empowering local resilience through structured guidance and resource awareness, bridging the gap between information and life-saving action.</p>
        </div>
    </div>

</section>
    <section id="map" class="section">
  <div class="container">
    <div class="section-head">
      <h3>Regional Risk Preview</h3>
      <p>
        HANDAVis is built around the idea that risk should be seen clearly. A visual map-based
        preview makes hazard awareness faster, easier, and more useful for both communities
        and local response teams.
      </p>
    </div>

    <div class="map-preview">
      <div class="atmosphere"></div>
      <div class="radar-sweep"></div>
		<div class="radar-hub"></div>
      <div class="lcd-overlay"></div>
      
      <div class="map-dot red" style="top:40%; left:54%;"></div>
      <div class="map-dot cyan" style="top:45%; left:46%;"></div>
      <div class="map-dot orange" style="top:60%; left:62%;"></div>
      <div class="map-dot green" style="top:74%; left:59%;"></div>
    </div>
  </div>
</section>

    <section id="cta" class="section">
      <div class="container cta-grid">
        <div class="glass cta-card" style="background:transparent; border:none; backdrop-filter:none; box-shadow:none;">
          <h3>
            <span>HANDAVis means being prepared</span><br>
            <span>before disaster strikes.</span>
          </h3>
          <p>
            With HANDAVis, the goal is simple: help communities move from uncertainty to
            awareness, and from awareness to action. Stay handa. Protect Visayas.
          </p>

          <div class="hero-actions" style="justify-content:flex-start;">
            <a href="#about" class="btn secondary">Read About Us</a>
          </div>
        </div>

        <div class="card">
          <h4 style="color:#fff; margin-bottom:15px; font-size:1.5rem;">Catchphrase</h4>
          <p>
            <strong style="color:#fff; font-size:1.1rem;">HANDAVis — Stay Handa, Visayas.</strong><br><br>
            A name that reflects both preparedness and visibility, grounded in the people
            and communities of Western Visayas.
          </p>
        </div>
      </div>
    </section>
  </main>

 <div class="landing-footer-wrapper">
    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <?php require __DIR__ . '/login_modal.php'; ?>

  <script src="assets/js/index_nav.js?v=<?php echo filemtime(__DIR__ . '/assets/js/index_nav.js'); ?>"></script>
  <script src="assets/js/login_modal.js?v=<?php echo filemtime(__DIR__ . '/assets/js/login_modal.js'); ?>"></script>
  <script src="assets/js/location.js?v=<?php echo filemtime(__DIR__ . '/assets/js/location.js'); ?>"></script>
<script>
(() => {
    const check = () => {
        if (window.innerWidth < 1024) {
            const BASE = location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);
            location.replace(BASE + "mobile_index.php" + location.hash);
        }
    };

    // Run on load and every time the window is resized
    check();
    window.addEventListener("resize", check);
})();
</script>

</body>
</html>
