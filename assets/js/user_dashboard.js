(function () {
var PAGE_ROUTES = {
    dashboardPage: "user_home.php",
    alertsPage: "user_alerts.php",
    mapPage: "user_live_map.php",
    reportPage: "user_hazard_report.php",
    safetyPage: "user_household_safety.php",
    aiPage: "user_ai-assistant.php",
};

  function goToPageRoute(pageId) {
    var route = PAGE_ROUTES[pageId];
    if (route) {
      window.location.href = route;
      return true;
    }

    if (typeof window.showToast === "function") {
      window.showToast("This page is not available yet.");
    }
    return false;
  }

  function setActivePage(pageId) {
    var targetPage = document.getElementById(pageId);
    if (!targetPage) {
      goToPageRoute(pageId);
      return;
    }

    document.querySelectorAll(".page").forEach(function (page) {
      page.classList.remove("active");
    });
    targetPage.classList.add("active");

    document.querySelectorAll(".sub-link").forEach(function (btn) {
      btn.classList.remove("active");
    });

    var navBtn = document.querySelector('.sub-link[data-page="' + pageId + '"]');
    if (navBtn) {
      navBtn.classList.add("active");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "mapPage" && typeof window.initMap === "function") {
      window.initMap();
      setTimeout(function () {
        if (window.map && typeof window.map.invalidateSize === "function") {
          window.map.invalidateSize();
        }
      }, 250);
    }
  }

  function openPage(event, pageId) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    setActivePage(pageId);
  }

  function jumpToMap() {
    setActivePage("mapPage");
  }

  function jumpToSafety() {
    setActivePage("safetyPage");
  }

  function jumpToAlerts() {
    setActivePage("alertsPage");
  }

  window.setActivePage = setActivePage;
  window.openPage = openPage;
  window.jumpToMap = jumpToMap;
  window.jumpToSafety = jumpToSafety;
  window.jumpToAlerts = jumpToAlerts;
})();
