(function initTheme() {
  const saved = localStorage.getItem('theme-preference');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
  }
  document.documentElement.classList.add('ready');
})();

function showSection(sectionId) {
  document.querySelectorAll(".section-view").forEach(el => {
    el.style.display = "none";
  });

  document.querySelectorAll(".sub-link").forEach(btn => {
    btn.classList.remove("active-link");
  });

  const target = document.getElementById("section-" + sectionId);
  if (target) target.style.display = "block";

  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active-link");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => (toast.style.display = "none"), 2400);
}

function dispatchTeam(btn) {
  btn.textContent = "Dispatched";
  btn.disabled = true;
  btn.closest(".list-item").querySelector("span").textContent += " Team dispatched.";
  showToast("Responder team dispatched.");
}
