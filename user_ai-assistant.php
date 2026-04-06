<?php
require_once __DIR__ . '/database/require_login.php';
hv_require_login();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HANDAVis - AI Assistant</title>
  <link rel="icon" type="image/png" href="images/handa.png?v=<?php echo file_exists(__DIR__ . '/images/handa.png') ? filemtime(__DIR__ . '/images/handa.png') : time(); ?>">

  <link rel="stylesheet" href="assets/css/user_root.css">
   <link rel="stylesheet" href="assets/css/user_main_header.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_main_header.css') ? filemtime(__DIR__ . '/assets/css/user_main_header.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_dashboard.css">
  <link rel="stylesheet" href="assets/css/user_footer.css">
  <link rel="stylesheet" href="assets/css/user_ai-assistant.css?v=<?php echo file_exists(__DIR__ . '/assets/css/user_ai-assistant.css') ? filemtime(__DIR__ . '/assets/css/user_ai-assistant.css') : time(); ?>">
  <link rel="stylesheet" href="assets/css/user_watch.css?v=<?php echo time(); ?>">
  <link rel="stylesheet" href="assets/css/font_sizes_option.css?v=<?php echo file_exists(__DIR__ . '/assets/css/font_sizes_option.css') ? filemtime(__DIR__ . '/assets/css/font_sizes_option.css') : time(); ?>">
    <link rel="stylesheet" href="assets/css/bigger_buttons.css">  
  <link rel="stylesheet" href="assets/css/reduce_animation.css">

</head>
<body>
  <?php require __DIR__ . '/includes/user_main_header.php'; ?>

  <div class="dashboard">
    <?php $activePage = 'aiPage'; require __DIR__ . '/includes/user_dashboard.php'; ?>

    <main class="portal-content">
      <section id="aiPage" class="page active">
        <div class="topbar">
          <div class="page-head">
            <h1>AI Disaster Assistant</h1>
            <p>Talk to HANDAm naturally for alerts, shelters, typhoon safety, flood guidance, emergency actions, and multilingual help.</p>
          </div>
          <div class="topbar-actions">
            <span class="chip">🧠 HANDAm Intelligence</span>
          </div>
        </div>

        <div class="panel">
          <div class="chat-wrap">
            <div class="chat-meta">
              <div>
                <h2>HANDAm Chat</h2>
                <p>Natural conversation • English • Tagalog • Hiligaynon • Cebuano</p>
              </div>
              <div class="chat-actions">
                <span id="languageBadge" class="language-badge">Language: Auto</span>
                <button class="btn soft mini-btn" type="button" onclick="clearChat()">Clear chat</button>
              </div>
            </div>

            <div id="chatBox" class="chat-box" aria-live="polite">
              <div class="bubble bot">
                Hello, I’m HANDAm. You can talk to me naturally in English, Tagalog, Hiligaynon, or Cebuano.
              </div>
              <div class="bubble bot">
                Ask me anything normally—greetings, language switching, flood safety, typhoon prep, shelters, hotlines, go-bags, evacuation, and local guidance.
              </div>
            </div>

            <div class="chat-input">
              <input id="chatInput" type="text" autocomplete="off" placeholder="Ask HANDAm anything... e.g. Hello, pwede ka mag hiligaynon?, ari ko sa Bacolod may baha ayhan diri?">
              <div class="prompt-row">
                <button class="btn" type="button" onclick="sendChat()">Send</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('Hello')">Hello</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('English please', 'en')">English</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('Tagalog please', 'tl')">Tagalog</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('Pwede ka mag Hiligaynon?', 'hil')">Hiligaynon</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('Bisaya please', 'ceb')">Cebuano</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('Nearest evacuation center?')">Nearest center</button>
                <button class="prompt-chip" type="button" onclick="setQuestion('Ari ko sa Bacolod, may baha ayhan sa area ko?')">Local flood check</button>
              </div>
            </div>

            <div class="voice-box">
              <span>Typing bubble + streamed feel enabled for a more natural chat flow</span>
              <div class="voice-wave"></div>
              <button class="btn soft" type="button" onclick="showToast('Voice mode UI is ready for your next integration.')">Voice mode</button>
            </div>
          </div>
        </div>
      </section>
		<?php include __DIR__ . '/includes/user_watch.php'; ?>
    </main>

    <?php require __DIR__ . '/includes/user_footer.php'; ?>
  </div>

  <div id="toast" class="toast"></div>

  <script src="assets/js/user_dashboard.js"></script>
 <script src="assets/js/user_main_header.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_main_header.js') ? filemtime(__DIR__ . '/assets/js/user_main_header.js') : time(); ?>"></script>

  <script src="assets/js/user_ai-assistant.js?v=<?php echo file_exists(__DIR__ . '/assets/js/user_ai-assistant.js') ? filemtime(__DIR__ . '/assets/js/user_ai-assistant.js') : time(); ?>"></script>
  <script src="assets/js/user_watch.js?v=<?php echo time(); ?>"></script>
  <script src="assets/js/user_settings.js"></script>
</body>
</html>
