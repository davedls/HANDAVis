(function () {
  function setResponderHeaderChips(primary, secondary) {
    var chips = document.querySelectorAll(".topbar-actions .chip");
    if (chips.length < 2) {
      return;
    }

    if (typeof primary === "string" && primary.length) {
      chips[0].textContent = primary;
    }

    if (typeof secondary === "string" && secondary.length) {
      chips[1].textContent = secondary;
    }
  }

  window.setResponderHeaderChips = setResponderHeaderChips;
})();
