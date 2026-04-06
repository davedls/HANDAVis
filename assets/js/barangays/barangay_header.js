(function () {
  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    var isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('handavisTheme', isLight ? 'light' : 'dark');
    if (typeof window.showToast === 'function') {
      window.showToast(isLight ? 'Light mode enabled.' : 'Dark mode enabled.');
    }
  }

  function loadTheme() {
    var savedTheme = localStorage.getItem('handavisTheme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
    }
  }

  function handleSearch(query) {
    var term = (query || '').trim().toLowerCase();
    if (!term) {
      return;
    }

    var navButtons = Array.from(document.querySelectorAll('.sub-link, .tab, button'));
    var hit = navButtons.find(function (btn) {
      return (btn.textContent || '').toLowerCase().includes(term);
    });

    if (hit && typeof hit.click === 'function') {
      hit.click();
    }
  }

  function toggleHamburger() {
    var btn = document.getElementById('hamburgerBtn');
    var drawer = document.getElementById('mobileDrawer');
    if (btn) btn.classList.toggle('open');
    if (drawer) drawer.classList.toggle('open');
  }

  function openBarangayProfile() {
    window.location.href = '/HANDAVis/roles/barangays/barangay-profile.php';
  }

  function updateSearchPlaceholder() {
    var input = document.getElementById('dashboardSearch');
    if (!input) return;
    input.placeholder = window.innerWidth <= 940 ? 'Search' : 'Search reports, broadcasts, or sections...';
  }

  window.toggleTheme = toggleTheme;
  window.handleSearch = handleSearch;
  window.toggleHamburger = toggleHamburger;
  window.openBarangayProfile = openBarangayProfile;

  loadTheme();
  updateSearchPlaceholder();
  window.addEventListener('resize', updateSearchPlaceholder);
})();
