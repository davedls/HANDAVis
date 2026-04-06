(function () {

  /* ─────────────────────────────────────────
     THEME
  ───────────────────────────────────────── */
  function loadTheme() {
    var saved = localStorage.getItem('handavisTheme');
    if (saved === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }

  /* ─────────────────────────────────────────
     TOAST NOTIFICATION MODAL
     Shows a small pill at the bottom-right.
     Reuses #toast if it exists (same as other pages),
     otherwise creates one on the fly.
  ───────────────────────────────────────── */
  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = [
        'position:fixed', 'right:1.125rem', 'bottom:1.125rem', 'z-index:9999',
        'display:none', 'max-width:20rem', 'padding:0.8125rem 1rem',
        'border-radius:1rem', 'border:1px solid rgba(255,255,255,.08)',
        'background:rgba(10,18,28,.92)', 'color:#f5fbff',
        'box-shadow:0 1.125rem 2.125rem rgba(0,0,0,.28)',
        'font-size:0.8125rem', 'line-height:1.5', 'font-family:inherit'
      ].join(';');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(function () {
      toast.style.display = 'none';
    }, 2600);
  }

  /* ─────────────────────────────────────────
     SAVE GENERIC (used by privacy + other btns)
  ───────────────────────────────────────── */
  function saveSettings(message) {
    showToast(message || 'Settings saved.');
  }

  /* ─────────────────────────────────────────
     VISUAL PREFERENCES — ids must match PHP
       toggleHighContrast
       toggleReduceMotion
       toggleLargeTouch
       toggleScreenReader
  ───────────────────────────────────────── */
  function applyDisplayPrefs(prefs) {
    document.documentElement.classList.toggle('high-contrast',  !!prefs.highContrast);
    document.documentElement.classList.toggle('reduce-motion',  !!prefs.reduceMotion);
    document.documentElement.classList.toggle('large-touch',    !!prefs.largeTouchTargets);
    document.documentElement.classList.toggle('screen-reader',  !!prefs.screenReader);
  }

  function saveDisplayPrefs() {
    var prefs = {
      highContrast:      !!(document.getElementById('toggleHighContrast')  || {}).checked,
      reduceMotion:      !!(document.getElementById('toggleReduceMotion')   || {}).checked,
      largeTouchTargets: !!(document.getElementById('toggleLargeTouch')     || {}).checked,
      screenReader:      !!(document.getElementById('toggleScreenReader')   || {}).checked
    };

    // read checked state properly
    var hc  = document.getElementById('toggleHighContrast');
    var rm  = document.getElementById('toggleReduceMotion');
    var lt  = document.getElementById('toggleLargeTouch');
    var sr  = document.getElementById('toggleScreenReader');

    prefs.highContrast      = hc  ? hc.checked  : false;
    prefs.reduceMotion      = rm  ? rm.checked   : false;
    prefs.largeTouchTargets = lt  ? lt.checked   : false;
    prefs.screenReader      = sr  ? sr.checked   : false;

    localStorage.setItem('handavisDisplayPrefs', JSON.stringify(prefs));
    applyDisplayPrefs(prefs);
    showToast('Display preferences saved.');
  }

  function restoreDisplayPrefs() {
    try {
      var saved = JSON.parse(localStorage.getItem('handavisDisplayPrefs') || '{}');
      var hc  = document.getElementById('toggleHighContrast');
      var rm  = document.getElementById('toggleReduceMotion');
      var lt  = document.getElementById('toggleLargeTouch');
      var sr  = document.getElementById('toggleScreenReader');
      if (hc)  hc.checked  = !!saved.highContrast;
      if (rm)  rm.checked   = !!saved.reduceMotion;
      if (lt)  lt.checked   = !!saved.largeTouchTargets;
      if (sr)  sr.checked   = !!saved.screenReader;
      applyDisplayPrefs(saved);
    } catch (e) {}
  }

  /* ─────────────────────────────────────────
     PRIVACY PREFERENCES
       togglePostPublicly
       toggleAnonymous
  ───────────────────────────────────────── */
  function savePrivacyPrefs() {
    var pp = document.getElementById('togglePostPublicly');
    var an = document.getElementById('toggleAnonymous');
    var prefs = {
      postPublicly: pp ? pp.checked : true,
      anonymous:    an ? an.checked : false
    };
    localStorage.setItem('handavisPrivacyPrefs', JSON.stringify(prefs));
    showToast('Privacy settings saved.');
  }

  function restorePrivacyPrefs() {
    try {
      var saved = JSON.parse(localStorage.getItem('handavisPrivacyPrefs') || 'null');
      if (!saved) return;
      var pp = document.getElementById('togglePostPublicly');
      var an = document.getElementById('toggleAnonymous');
      if (pp) pp.checked = !!saved.postPublicly;
      if (an) an.checked = !!saved.anonymous;
    } catch (e) {}
  }
  function selectLang(card, langName) {
    document.querySelectorAll('.lang-card').forEach(function (c) {
      c.classList.remove('active');
    });
    card.classList.add('active');
    localStorage.setItem('handavisLang', langName);

    var langMap = { English: 'en', Filipino: 'tl', Hiligaynon: 'hil' };
    var code = langMap[langName];

    if (code === 'en') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + location.hostname;
    } else {
      document.cookie = 'googtrans=/en/' + code + '; path=/';
      document.cookie = 'googtrans=/en/' + code + '; path=/; domain=' + location.hostname;
    }

    showToast('Language set to ' + langName + '.');
    setTimeout(function () { location.reload(); }, 600);
  }

  function restoreLang() {
    var saved = localStorage.getItem('handavisLang');
    if (!saved) return;
    document.querySelectorAll('.lang-card').forEach(function (c) {
      var strong = c.querySelector('strong');
      if (strong && strong.textContent.trim() === saved) {
        c.classList.add('active');
      }
    });
  }

  /* ─────────────────────────────────────────
     FONT SIZE
  ───────────────────────────────────────── */
  var FONT_SIZE_MAP = { small: '14px', medium: '16px', large: '18px' };

  function setFontSize(btn, size) {
    document.querySelectorAll('.font-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.documentElement.style.setProperty('--base-font-size', FONT_SIZE_MAP[size]);
    localStorage.setItem('handavisFontSize', size);
    showToast('Font size set to ' + size + '.');
  }

  function restoreFontSize() {
    var saved = localStorage.getItem('handavisFontSize');
    if (!saved) return;
    if (FONT_SIZE_MAP[saved]) {
      document.documentElement.style.setProperty('--base-font-size', FONT_SIZE_MAP[saved]);
    }
    var target = document.querySelector('[onclick*="' + saved + '"]');
    if (target) {
      document.querySelectorAll('.font-btn').forEach(function (b) { b.classList.remove('active'); });
      target.classList.add('active');
    }
  }

  /* ─────────────────────────────────────────
     MISC
  ───────────────────────────────────────── */
  function confirmClearCache() {
    var confirmed = window.confirm('Clear all offline data? You will need an internet connection to reload it.');
    if (confirmed) showToast('Cache cleared successfully.');
  }

  function submitFeedback() {
    var textarea = document.querySelector('.field-textarea');
    if (textarea && textarea.value.trim() === '') {
      showToast('Please write your feedback before submitting.');
      return;
    }
    showToast('Feedback submitted. Thank you!');
    if (textarea) textarea.value = '';
  }

  /* ─────────────────────────────────────────
     EXPOSE GLOBALS
  ───────────────────────────────────────── */
  window.showToast         = showToast;
  window.saveSettings      = saveSettings;
  window.saveDisplayPrefs  = saveDisplayPrefs;
  window.savePrivacyPrefs  = savePrivacyPrefs;
  window.selectLang        = selectLang;
  window.setFontSize       = setFontSize;
  window.confirmClearCache = confirmClearCache;
  window.submitFeedback    = submitFeedback;

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    loadTheme();
    restoreFontSize();
    restoreLang();
    restoreDisplayPrefs();
    restorePrivacyPrefs();
  });

})();