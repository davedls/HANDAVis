(function initTheme() {
  const saved = localStorage.getItem('theme-preference');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
  }
  document.documentElement.classList.add('ready');
})();
