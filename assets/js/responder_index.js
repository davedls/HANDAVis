(function () {
  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function () {
      toast.style.display = "none";
    }, 2400);
  }

  function dispatchTeam(btn) {
    if (!btn) {
      return;
    }

    btn.textContent = "Dispatched";
    btn.disabled = true;

    var listItem = btn.closest(".list-item");
    if (listItem) {
      var note = listItem.querySelector("span");
      if (note) {
        note.textContent += " Team dispatched.";
      }
    }

    showToast("Responder team dispatched.");
  }

  window.showToast = showToast;
  window.dispatchTeam = dispatchTeam;
})();
