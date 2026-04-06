<!DOCTYPE html>
<html lang="en">
<head>
	
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HANDAVis | Regional Intelligence</title>
	
    
  <link rel="stylesheet" href="assets/css/mobile_index.css?v=<?php echo filemtime(BASE_PATH . '/assets/css/mobile_index.css'); ?>">
  <link rel="stylesheet" href="assets/css/login_modal.css?v=<?php echo filemtime(BASE_PATH . '/assets/css/login_modal.css'); ?>">
  <link rel="stylesheet" href="assets/css/user_footer.css?v=<?php echo filemtime(BASE_PATH . '/assets/css/user_footer.css'); ?>">
</head>
<body class="nerv-theme mobile-landing">
   <header class="main-header">
    <div class="header-container">
       <div class="logo-section">
    <img src="images/handa.png" alt="HANDAVis Shield" class="header-logo">
    <div class="logo-text">
        <h1>HANDA<span>Vis</span></h1>
    </div>
</div>

        <div class="header-actions">
            <div class="menu-toggle" id="mobile-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="nav-links">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>

        <nav class="nav-menu" id="nav-links">
            <a href="#about" class="nav-link">About</a>
            <a href="#mission" class="nav-link">Mission</a>
            <a href="#features" class="nav-link">Features</a>
            <a href="#map" class="nav-link">Map Preview</a>
            <a href="#cta" class="nav-link">Explore</a>
            <button type="button" class="nav-login-link" data-open-auth="login">Login</button>
        </nav>
    </div>
</header>

   <main>
  <section class="hero-full">
    <video autoplay muted loop playsinline class="hero-video">
        <source src="assets/handavisvid.mp4" type="video/mp4">
        Your browser does not support the video tag.
    </video>

    <div class="hero-content">
    <p class="hero-tagline">— DISASTER INTELLIGENCE PLATFORM</p>
    <h1 class="hero-title">
        <span class="branding-main">HANDAVis</span>
        <span class="catch-top">Stay Handa.</span>
        <span class="catch-bottom">See Risk Clearly.</span>
    </h1>
	  
        
        <p class="hero-description">
            A disaster risk awareness and response platform designed to help communities 
            across Western Visayas stay informed, prepared, and resilient.
        </p>

        <div class="hero-buttons">
            <a href="#" class="btn btn-solid">Learn More</a>
            <a href="#" class="btn btn-outline">View Risk Preview</a>
        </div>
    </div>
</section>

<div class="sep-horizontal"></div>

<section id="about" class="data-stream-section">
    <div class="intel-container">
        <div class="briefing-intel">
            <div class="intel-header">
                <span class="tag">[TACTICAL_MAP]</span>
                <h2>REGIONAL DEFENSE LAYER</h2>
            </div>
            
            <div class="intel-grid">
                <div class="intel-card">
                    <h3>01. PRECISION_GEO_LOCK</h3>
                    <p>High-resolution monitoring for all critical sectors. Track hazards at the street level with zero latency.</p>
                </div>
                <div class="intel-card">
                    <h3>02. MULTI-THREAT_OVERLAYS</h3>
                    <p>Toggle intelligence layers for Typhoons, Floods, and Fires to visualize the danger zone instantly.</p>
                </div>
                <div class="intel-card">
                    <h3>03. PRE-EMPTIVE_RADAR</h3>
                    <p>Integrated Rain Radar and predictive pathing allows you to see the storm before it arrives.</p>
                </div>
            </div>
        </div>

        <div class="briefing-visual">
            <img src="images/mobilemap.png" alt="HANDAVis Mobile App Preview" class="stream-visual">
        </div>
    </div>
</section>

<section id="mission" class="node">
    <div class="landing-briefing">
        <h2 class="node-main-header">OPERATIONAL READINESS & RESPONSE</h2>

        <div class="brief-item">
            <h3>01. INTELLIGENCE-DRIVEN RESPONSE</h3>
            <p>Access a centralized command hub featuring one-tap emergency hotlines and GPS-guided routing to the nearest safe zones. We transform static data into immediate, life-saving actions for every citizen in Western Visayas.</p>
        </div>

        <div class="brief-item">
            <h3>02. PRECISION IMPACT ANALYTICS</h3>
            <p>Move beyond general weather updates with localized risk assessments. Our system identifies specific high-threat drainage zones and provides clear, actionable checklists to ensure you are prepared before the first drop of rain falls.</p>
        </div>

        <div class="brief-item">
            <h3>03. REGIONAL RESILIENCE NETWORK</h3>
            <p>A seamless data pipeline connecting threat identification to resource allocation. By synchronizing real-time alerts with evacuation center logistics, we ensure that communities stay informed, prepared, and one step ahead of any disaster.</p>
        </div>
    </div>

    <div class="emergency-node-visual">
        <img src="images/mobilemap2.png" alt="HANDAVis Mobile App Preview 2" class="node-visual">
    </div>
</section>

   <section id="features" class="node node-strategic-view">
    <header class="strategic-status-header">
        <h2 class="status-title">REAL-TIME THREAT ASSESSMENT &<br>GUIDED EMERGENCY ROUTING</h2>
    </header>

    <div class="emergency-node-visual">
        <img src="images/mobilemap3.png" alt="Strategic Map 3" class="node-visual">
    </div>
</section>

 <section id="map" class="node-shelter-scribble">
    <div class="strategic-content-wrapper">
        <header class="strategic-status-header">
            <h2 class="status-title">
                One Tap Hazard Report &<br>
                Smart Emergency Checklist
            </h2>
            <p class="status-subline">
                Turning live intelligence into immediate, localized action for every citizen.
            </p>
        </header>

        <div class="emergency-node-visual">
            <img src="images/mobilemap4.png" alt="Shelter Status Map" class="node-visual">
            
           <div class="glow-laser-barrier"></div>
            
            
        </div>
    </div>
</section>
<section id="cta" class="node-ai-intelligence-fade">
    <div class="strategic-content-wrapper">
        
        <header class="strategic-status-header ai-header-top">
            <h2 class="status-title ai-title">
                Smart AI Assistant<br>
                Powered by HANDAm Intelligence
            </h2>
            <p class="status-subline ai-subline">
                An expert-trained intelligence layer engineered to provide instantaneous, localized guidance during critical disaster scenarios.
            </p>
        </header>

        <div class="ai-visual-container">
			
            <img src="images/mobilemap5.png" alt="Smart AI Assistant Interface" class="node-visual-fade-in">
        </div>

    </div>
</section>

    <div class="sep-diag diag-left-alt"></div> </main>

  <?php 
        // Include the footer and logout modal partials
        include 'includes/user_footer.php'; 
    ?>

    <?php require BASE_PATH . '/login_modal.php'; ?>
  
    <script src="assets/js/login_modal.js?v=<?php echo filemtime(BASE_PATH . '/assets/js/login_modal.js'); ?>"></script>
    <script src="assets/js/location.js?v=<?php echo filemtime(BASE_PATH . '/assets/js/location.js'); ?>"></script>
    <script src="assets/js/mobile_index.js?v=<?php echo filemtime(BASE_PATH . '/assets/js/mobile_index.js'); ?>"></script>
<script>
(() => {
    const check = () => {
        if (window.innerWidth >= 1024) {
            const BASE = location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);
            location.replace(BASE + "index.php" + location.hash);
        }
    };

    // Run on load and every time the window is resized
    check();
    window.addEventListener("resize", check);
})();
</script>
</body>
</html>
