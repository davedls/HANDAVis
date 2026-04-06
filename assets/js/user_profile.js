(function () {
  var profileEditMode = false;
	
  var photoEditMode = false;
  var pendingDataUrl = null;
  var pendingFile = null;
  var currentZoom = 100;
  var profileDraftSnapshot = null;

  function loadTheme() {
    if (localStorage.getItem("handavisTheme") === "light") {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }
  }

  function captureProfileSnapshot() {
    var panel = document.getElementById("profileInfoPanel");
    if (!panel) return null;
    var state = {};
    var fields = panel.querySelectorAll("input.field-input, select.field-select, textarea.field-textarea");
    fields.forEach(function (field) {
      if (!field.id) return;
      state[field.id] = field.value;
    });
    return state;
  }

  function restoreProfileSnapshot(state) {
    if (!state) return;
    Object.keys(state).forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = state[id];
    });
  }

  function setProfileEditMode(isEditable) {
    var panel = document.getElementById("profileInfoPanel");
    var editBtn = document.getElementById("editProfileBtn");
    var actions = document.getElementById("profileEditActions");

    profileEditMode = !!isEditable;

    if (panel) {
      panel.classList.toggle("is-editing", profileEditMode);
      var fields = panel.querySelectorAll("input.field-input, select.field-select, textarea.field-textarea");
      fields.forEach(function (field) {
        if (field.id === "inputUserId") { field.readOnly = true; field.disabled = true; return; }
        if (field.tagName === "SELECT") { field.disabled = !profileEditMode; }
        else { field.readOnly = !profileEditMode; }
      });
    }

    if (editBtn) editBtn.style.display = profileEditMode ? "none" : "inline-flex";
    if (actions) actions.style.display = profileEditMode ? "flex" : "none";
  }

  function toggleEditMode() {
    if (profileEditMode) return;
    profileDraftSnapshot = captureProfileSnapshot();
    setProfileEditMode(true);
  }

  function setPhotoEditMode(isEditable) {
    photoEditMode = !!isEditable;
    var wrap = document.querySelector(".avatar-wrap");
    var savePhotoBtn = document.getElementById("savePhotoBtn");
    var cancelPhotoBtn = document.getElementById("cancelPhotoBtn");
    var editPhotoBtn = document.getElementById("editPhotoBtn");
    if (wrap) wrap.classList.toggle("edit-mode", photoEditMode);
    if (savePhotoBtn) savePhotoBtn.style.display = photoEditMode ? "inline-flex" : "none";
    if (cancelPhotoBtn) cancelPhotoBtn.style.display = photoEditMode ? "inline-flex" : "none";
    if (editPhotoBtn) editPhotoBtn.style.display = photoEditMode ? "none" : "inline-flex";
  }

  function cancelEdit() {
    restoreProfileSnapshot(profileDraftSnapshot);
    reflectProfile();
    setProfileEditMode(false);
    toast("Changes discarded.");
  }

  // ── Avatar helpers ─────────────────────────────────────────────────────────

  function hasAvatar() {
    var el = document.getElementById("avatarEl");
    return el && el.getAttribute("data-has-avatar") === "1";
  }

  function setAvatarImage(url) {
    var el = document.getElementById("avatarEl");
    if (!el) return;
    el.setAttribute("data-has-avatar", "1");
    el.innerHTML = "";
    var img = document.createElement("img");
    img.id = "avatarImg";
    img.src = url;
    img.alt = "Profile photo";
img.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:50%;display:block;background:#0f1b2b;";
	  img.onerror = function () {
      el.setAttribute("data-has-avatar", "0");
      el.innerHTML = "";
      el.appendChild(buildInitialsSpan());
    };
    el.appendChild(img);
  }

  function buildInitialsSpan() {
    var fn = document.getElementById("inputFirstName");
    var ln = document.getElementById("inputLastName");
    var first = fn ? fn.value.trim() : "";
    var last = ln ? ln.value.trim() : "";
    var full = [first, last].filter(Boolean).join(" ");
    var parts = full.split(" ").filter(Boolean);
    var initials = parts.length >= 2
      ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
      : full ? full.slice(0, 2).toUpperCase() : "U";
    var span = document.createElement("span");
    span.id = "avatarInitialsEl";
    span.textContent = initials;
    return span;
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  function commitAvatarEdit() {
    if (!pendingFile) {
      toast("No new photo to save. Pick one using the camera icon first.");
      return;
    }
    var savePhotoBtn = document.getElementById("savePhotoBtn");
    var wasPhotoEditing = photoEditMode;
    setPhotoEditMode(false);

    if (savePhotoBtn) {
      savePhotoBtn.disabled = true;
      savePhotoBtn.style.opacity = "0.7";
      savePhotoBtn.textContent = "Saving...";
    }

    var formData = new FormData();
    formData.append("avatar", pendingFile);

    fetch("/HANDAVis/database/user_profile_upload_avatar.php", { method: "POST", body: formData })
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        if (!payload || !payload.ok) {
          toast(payload && payload.error ? payload.error : "Failed to save profile photo.");
          return;
        }
        setAvatarImage(payload.avatar_url);
        pendingFile = null;
        pendingDataUrl = null;
        if (savePhotoBtn) {
          savePhotoBtn.disabled = false;
          savePhotoBtn.style.opacity = "";
          savePhotoBtn.textContent = "Save Photo";
        }
        showAutoModal("Profile photo saved.");
		setTimeout(function () {
  location.reload();
}, 800);
      })
      .catch(function () { toast("Failed to upload photo. Please try again."); })
      .finally(function () {
        if (savePhotoBtn && wasPhotoEditing) {
          savePhotoBtn.disabled = false;
          savePhotoBtn.style.opacity = "";
          savePhotoBtn.textContent = "Save Photo";
        }
      });
  }

  function cancelPhotoEdit() {
    pendingFile = null;
    pendingDataUrl = null;
    closeAvatarModal();
    setPhotoEditMode(false);
    toast("Photo changes canceled.");
  }

  function onFileChosen(e) {
    var file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please select an image file."); return; }
    pendingFile = file;
    var reader = new FileReader();
    reader.onload = function (ev) { pendingDataUrl = ev.target.result; openModal(pendingDataUrl); };
    reader.readAsDataURL(file);
  }

  function openModal(src) {
    var overlay = document.getElementById("avatarModal");
    var img = document.getElementById("av-img");
    var zoom = document.getElementById("av-zoom");
    var zoomVal = document.getElementById("av-zoom-val");
    if (!overlay || !img) return;
    img.src = src;
    img.style.transform = "scale(1)";
    zoom.value = 100;
    zoomVal.textContent = "100%";
    currentZoom = 100;
    overlay.classList.add("is-open");
  }

  function closeAvatarModal() {
    var overlay = document.getElementById("avatarModal");
    if (overlay) overlay.classList.remove("is-open");
    pendingDataUrl = null;
  }

  function onZoomInput() {
    var zoom = document.getElementById("av-zoom");
    var zoomVal = document.getElementById("av-zoom-val");
    var img = document.getElementById("av-img");
    currentZoom = parseInt(zoom.value, 10);
    zoomVal.textContent = currentZoom + "%";
    img.style.transform = "scale(" + currentZoom / 100 + ")";
  }

  function applyAvatarPhoto() {
    var src = pendingDataUrl;
    if (!src) return;

    var img = new Image();
    img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        var finalDataUrl = canvas.toDataURL("image/jpeg", 0.95);

        // convert to file for upload
        var byteString = atob(finalDataUrl.split(",")[1]);
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);

        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        var blob = new Blob([ab], { type: "image/jpeg" });
        pendingFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });

        pendingDataUrl = finalDataUrl;

       setAvatarImage(finalDataUrl);
closeAvatarModal();
setPhotoEditMode(true);
    };

    img.src = src;
}
  // ── reflectProfile — never touches avatarEl directly ──────────────────────

function reflectProfile() {
    var fnInput = document.getElementById("inputFirstName");
    if (!fnInput) return; 

    var lnInput = document.getElementById("inputLastName");
    var city = document.getElementById("inputCity");
    var barangay = document.getElementById("inputBarangay");

    var first = fnInput.value.trim();
    var last = lnInput ? lnInput.value.trim() : "";
    var full = [first, last].filter(Boolean).join(" ");

    // Update Display Name
    var nameEl = document.getElementById("profileNameDisplay");
    if (nameEl && full !== "") {
        nameEl.textContent = full;
    }

    // Update ID Display
    var userIdInput = document.getElementById("inputUserId");
    var idEl = document.getElementById("profileIdDisplay");
    if (idEl && userIdInput) {
        var rawId = userIdInput.value.trim();
        if (rawId !== "") {
            idEl.textContent = "ID #U-" + rawId;
        }
    }

    // Update Initials (Only if no avatar exists)
    if (!hasAvatar() && full) {
      var initialsEl = document.getElementById("avatarInitialsEl");
      if (initialsEl) {
        var parts = full.split(" ").filter(Boolean);
        initialsEl.textContent = parts.length >= 2
          ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
          : full.slice(0, 2).toUpperCase();
      }
    }

    // Update Handle and Location Badge
    var handleEl = document.getElementById("profileHandleDisplay");
    if (handleEl) {
      var username = first
        ? "@" + first.toLowerCase().replace(/\s+/g, "") + (last ? last.toLowerCase().split(" ")[0] : "")
        : "@user";
      var bgyVal = barangay ? barangay.value : "Mandalagan";
      var cityVal = city ? city.value : "Bacolod City";
      handleEl.textContent = username + " · Barangay " + bgyVal + ", " + cityVal;
    }

    var bgyBadge = document.getElementById("profileBadgeBarangay");
    if (bgyBadge && barangay) bgyBadge.textContent = "🏘 " + barangay.value;
  }
  function setBarangayOptions(options, preferredValue) {
    var barangaySelect = document.getElementById("inputBarangay");
    if (!barangaySelect) return;
    barangaySelect.innerHTML = "";
    if (!Array.isArray(options) || options.length === 0) {
      var emptyOpt = document.createElement("option");
      emptyOpt.value = ""; emptyOpt.textContent = "No barangays found";
      barangaySelect.appendChild(emptyOpt); return;
    }
    options.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      barangaySelect.appendChild(opt);
    });
    if (preferredValue && options.indexOf(preferredValue) !== -1) barangaySelect.value = preferredValue;
    else barangaySelect.selectedIndex = 0;
}
  function syncBarangaysForCity() {
    var citySelect = document.getElementById("inputCity");
    var provinceSelect = document.getElementById("inputProvince");
    var barangaySelect = document.getElementById("inputBarangay");
    if (!citySelect || !barangaySelect || !provinceSelect) return;
    var city = (citySelect.value || "").trim();
    var province = (provinceSelect.value || "").trim();
    var currentBarangay = (barangaySelect.value || "").trim();
    if (!city) return;
    var url = "/HANDAVis/database/location_options.php?type=barangays&municipality=" + encodeURIComponent(city);
    if (province) url += "&province=" + encodeURIComponent(province);
    fetch(url, { credentials: "same-origin" })
      .then(function (res) { return res.json().then(function (p) { return { ok: res.ok, payload: p || {} }; }); })
      .then(function (result) {
        if (!result.ok || !Array.isArray(result.payload.data)) return;
        setBarangayOptions(result.payload.data, currentBarangay);
        reflectProfile();
      }).catch(function () {});
  }

  function setMunicipalityOptions(options, preferredValue) {
    var citySelect = document.getElementById("inputCity");
    if (!citySelect) return;
    citySelect.innerHTML = "";
    if (!Array.isArray(options) || options.length === 0) {
      var emptyOpt = document.createElement("option");
      emptyOpt.value = ""; emptyOpt.textContent = "No municipalities found";
      citySelect.appendChild(emptyOpt); return;
    }
    options.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      citySelect.appendChild(opt);
    });
    if (preferredValue && options.indexOf(preferredValue) !== -1) citySelect.value = preferredValue;
    else citySelect.selectedIndex = 0;
  }

  function syncMunicipalitiesForProvince() {
    var provinceSelect = document.getElementById("inputProvince");
    var citySelect = document.getElementById("inputCity");
    if (!provinceSelect || !citySelect) return;
    var province = (provinceSelect.value || "").trim();
    var currentCity = (citySelect.value || "").trim();
    if (!province) return;
    var url = "/HANDAVis/database/location_options.php?type=municipalities&province=" + encodeURIComponent(province);
    fetch(url, { credentials: "same-origin" })
      .then(function (res) { return res.json().then(function (p) { return { ok: res.ok, payload: p || {} }; }); })
      .then(function (result) {
        if (!result.ok || !Array.isArray(result.payload.data)) return;
        setMunicipalityOptions(result.payload.data, currentCity);
        syncBarangaysForCity();
        reflectProfile();
      }).catch(function () {});
  }

  function saveProfile() {
    reflectProfile();
    var payload = {
      first_name: (document.getElementById("inputFirstName") || {}).value || "",
      last_name: (document.getElementById("inputLastName") || {}).value || "",
      email: (document.getElementById("inputEmail") || {}).value || "",
      phone: (document.getElementById("inputPhone") || {}).value || "",
      province: (document.getElementById("inputProvince") || {}).value || "",
      municipality: (document.getElementById("inputCity") || {}).value || "",
      barangay: (document.getElementById("inputBarangay") || {}).value || "",
      emergency_contact_name: (document.getElementById("inputEmergencyContactName") || {}).value || "",
      emergency_contact_phone: (document.getElementById("inputEmergencyContactNumber") || {}).value || "",
      bio: (document.getElementById("inputBio") || {}).value || "",
    };
    fetch("/HANDAVis/database/user_profile_update.php", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin", body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json().then(function (p) { return { ok: res.ok, payload: p || {} }; }); })
      .then(function (result) {
        if (!result.ok || !result.payload.ok) { toast(result.payload.error || "Failed to save profile."); return; }
        profileDraftSnapshot = captureProfileSnapshot();
        setProfileEditMode(false);
        toast("Profile saved successfully.");
      })
      .catch(function () { toast("Failed to save profile. Please try again."); });
  }

  function saveNotifPrefs() { toast("Notification preferences saved."); }

  function updatePassword() {
    var c = document.getElementById("pwCurrent");
    var n = document.getElementById("pwNew");
    var r = document.getElementById("pwConfirm");
    if (!c.value || !n.value || !r.value) { toast("Please fill in all password fields."); return; }
    if (n.value !== r.value) { toast("New passwords do not match."); return; }
    if (n.value.length < 8) { toast("Password must be at least 8 characters."); return; }
    var formData = new FormData();
    formData.append("current_password", c.value);
    formData.append("new_password", n.value);
    formData.append("confirm_password", r.value);
    fetch("/HANDAVis/database/user_profile_update_password.php", { method: "POST", body: formData })
      .then(function (res) { return res.json().then(function (p) { return { ok: res.ok, payload: p }; }); })
      .then(function (result) {
        var payload = result.payload || {};
        if (!result.ok || !payload.ok) { toast(payload.error || "Failed to update password."); return; }
        showAutoModal("Password saved.");
        c.value = ""; n.value = ""; r.value = "";
      })
      .catch(function () { toast("Failed to update password. Please try again."); });
  }

  function deactivateAccount() {
    showConfirmModal("Deactivate Account", "Deactivate your account now? You will be logged out.", function () {
      fetch("/HANDAVis/database/user_profile_deactivate.php", { method: "POST" })
        .then(function (res) { return res.json().then(function (p) { return { ok: res.ok, payload: p }; }); })
        .then(function (result) {
          var payload = result.payload || {};
          if (!result.ok || !payload.ok) { toast(payload.error || "Failed to deactivate account."); return; }
          showAutoModal("Account deactivated.");
          setTimeout(function () { window.location.href = payload.redirect || "/HANDAVis/index.php"; }, 1200);
        })
        .catch(function () { toast("Failed to deactivate account."); });
    });
  }

  function deleteAccount() {
    showConfirmModal("Delete Account", "Delete your account permanently? This cannot be undone.", function () {
      fetch("/HANDAVis/database/user_profile_delete.php", { method: "POST" })
        .then(function (res) { return res.json().then(function (p) { return { ok: res.ok, payload: p }; }); })
        .then(function (result) {
          var payload = result.payload || {};
          if (!result.ok || !payload.ok) { toast(payload.error || "Failed to delete account."); return; }
          showAutoModal("Account deleted.");
          setTimeout(function () { window.location.href = payload.redirect || "/HANDAVis/index.php"; }, 1200);
        })
        .catch(function () { toast("Failed to delete account."); });
    });
  }

  function toast(msg) {
    if (typeof window.showToast === "function") { window.showToast(msg); return; }
    showAutoModal(msg);
  }

  function showAutoModal(message) {
    var modal = document.getElementById("profileAutoModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "profileAutoModal";
      modal.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);z-index:10001;";
      modal.innerHTML = '<div style="min-width:260px;max-width:90vw;background:#0f1b2b;color:#eaf4ff;border:1px solid rgba(79,216,255,0.25);border-radius:14px;padding:18px 20px;text-align:center;font-weight:700;"></div>';
      document.body.appendChild(modal);
    }
    var box = modal.firstElementChild;
    if (box) box.textContent = message;
    modal.style.display = "flex";
    clearTimeout(window.profileAutoModalTimeout);
    window.profileAutoModalTimeout = setTimeout(function () { modal.style.display = "none"; }, 1000);
  }

  function showConfirmModal(title, message, onConfirm) {
    var modal = document.getElementById("profileConfirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "profileConfirmModal";
      modal.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10002;";
      modal.innerHTML =
        '<div style="min-width:300px;max-width:92vw;background:#0f1b2b;color:#eaf4ff;border:1px solid rgba(79,216,255,0.25);border-radius:14px;padding:18px 20px;">' +
        '<div id="profileConfirmTitle" style="font-size:18px;font-weight:800;margin-bottom:8px;"></div>' +
        '<div id="profileConfirmMessage" style="font-size:14px;opacity:.9;line-height:1.45;margin-bottom:16px;"></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
        '<button type="button" id="profileConfirmCancel" style="padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;">Cancel</button>' +
        '<button type="button" id="profileConfirmOk" style="padding:10px 14px;border-radius:10px;border:none;background:#ff4d57;color:#fff;font-weight:700;cursor:pointer;">Confirm</button>' +
        "</div></div>";
      document.body.appendChild(modal);
    }
    var titleEl = document.getElementById("profileConfirmTitle");
    var msgEl = document.getElementById("profileConfirmMessage");
    var cancelBtn = document.getElementById("profileConfirmCancel");
    var okBtn = document.getElementById("profileConfirmOk");
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    modal.style.display = "flex";
    function closeModal() {
      modal.style.display = "none";
      if (cancelBtn) cancelBtn.onclick = null;
      if (okBtn) okBtn.onclick = null;
      modal.onclick = null;
    }
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (okBtn) { okBtn.onclick = function () { closeModal(); if (typeof onConfirm === "function") onConfirm(); }; }
    modal.onclick = function (e) { if (e.target === modal) closeModal(); };
  }
function togglePhotoEditMode() {
  var fileInput = document.getElementById("avatarFileInput");
  if (fileInput) {
    fileInput.click();
  }
}
	
  document.addEventListener("DOMContentLoaded", function () {
    loadTheme();
    profileDraftSnapshot = captureProfileSnapshot();
    reflectProfile();
    setProfileEditMode(false);
    setPhotoEditMode(false);

    var fileInput = document.getElementById("avatarFileInput");
    if (fileInput) fileInput.addEventListener("change", onFileChosen);

    var zoomSlider = document.getElementById("av-zoom");
    if (zoomSlider) zoomSlider.addEventListener("input", onZoomInput);

    var overlay = document.getElementById("avatarModal");
    if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeAvatarModal(); });

    var citySelect = document.getElementById("inputCity");
    var provinceSelect = document.getElementById("inputProvince");
    if (provinceSelect) provinceSelect.addEventListener("change", syncMunicipalitiesForProvince);
    if (citySelect) citySelect.addEventListener("change", syncBarangaysForCity);
 

  window.toggleEditMode      = toggleEditMode;
  window.togglePhotoEditMode = togglePhotoEditMode;
  window.cancelEdit          = cancelEdit;
  window.commitAvatarEdit    = commitAvatarEdit;
  window.cancelPhotoEdit     = cancelPhotoEdit;
  window.closeAvatarModal    = closeAvatarModal;
  window.applyAvatarPhoto    = applyAvatarPhoto;
  window.reflectProfile      = reflectProfile;
  window.saveProfile         = saveProfile;
  window.saveNotifPrefs      = saveNotifPrefs;
  window.updatePassword      = updatePassword;
  window.deactivateAccount   = deactivateAccount;
  window.deleteAccount       = deleteAccount;

  }); // end DOMContentLoaded

// --- 1. Filter and Guide Functions ---
function filterContacts(btn, category) {
  document.querySelectorAll(".ec-filter-btn").forEach(function (b) { b.classList.remove("active"); });
  btn.classList.add("active");
  document.querySelectorAll(".ec-card").forEach(function (card) {
    card.style.display = (category === "all" || card.getAttribute("data-category") === category) ? "grid" : "none";
  });
}

function filterGuides(btn, category) {
  document.querySelectorAll(".sg-filter-btn").forEach(function (b) { b.classList.remove("active"); });
  btn.classList.add("active");
  document.querySelectorAll(".sg-item").forEach(function (item) {
    item.style.display = (category === "all" || item.getAttribute("data-category") === category) ? "block" : "none";
  });
}

function toggleGuide(header) {
  var item = header.closest(".sg-item");
  var isOpen = item.classList.contains("is-open");
  document.querySelectorAll(".sg-item.is-open").forEach(function (el) { el.classList.remove("is-open"); });
  if (!isOpen) item.classList.add("is-open");
}

// --- 2. Search Function (Fixed Brackets) ---
function searchPortalUsers() {
    const query = document.getElementById('friendSearchInput').value;
    const listContainer = document.getElementById('friendsList');

    if (!query || query.length < 2) return; 

    fetch(`database/friends_handler.php?action=search&query=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            listContainer.innerHTML = '';
            if (!data || data.length === 0) {
                listContainer.innerHTML = '<div class="empty-msg">No users found.</div>';
                return;
            }

            data.forEach(user => {
                let actionHTML = '';
                if (user.rel_status === 'accepted') {
                    actionHTML = `<button class="btn-unfriend" onclick="processFriendship(${user.id}, 'unfriend')">Unfriend</button>`;
                } else if (user.rel_status === 'outgoing_pending') {
                    actionHTML = `<button class="btn-pending" disabled>Request Sent</button>`;
                } else if (user.rel_status === 'incoming_pending') {
                    actionHTML = `
                        <button class="btn-accept" onclick="processFriendship(${user.id}, 'accept_friend')">Accept</button>
                        <button class="btn-reject" onclick="processFriendship(${user.id}, 'reject_friend')">Reject</button>`;
                } else {
                    actionHTML = `<button class="btn-add" id="add-btn-${user.id}" onclick="processFriendship(${user.id}, 'add_friend')">Add Friend</button>`;
                }

                listContainer.innerHTML += `
                    <div class="friend-item">
                        <div class="user-info"><strong>${user.username}</strong></div>
                        ${actionHTML}
                    </div>`;
            }); 
        }) 
        .catch(err => console.error('Search error:', err));
}

// --- 3. Centralized Friendship Function ---
function processFriendship(targetId, actionType) {
    const formData = new FormData();
    formData.append('action', actionType);
    formData.append('friend_id', targetId);

    fetch('database/friends_handler.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const btn = document.getElementById(`add-btn-${targetId}`);
            if (btn) {
                btn.innerText = (actionType === 'add_friend') ? "Request Sent" : "Done";
                btn.disabled = true;
            } else {
                location.reload();
            }
        } else {
            alert(data.error || "Action failed");
        }
    })
    .catch(err => console.error('Fetch error:', err));
}

// --- 4. Global Export & Final Closure ---
                window.processFriendship = processFriendship;
                   window.searchPortalUsers = searchPortalUsers;
                        window.filterContacts = filterContacts;
                                  window.filterGuides = filterGuides;
                                        window.toggleGuide = toggleGuide;

                                          })(); // <--- IIFE END

 
                                             function processFriendshipProfile(targetId, actionType) {
                                                    const formData = new FormData();
    formData.append('action', actionType);
    formData.append('friend_id', targetId);

    fetch('database/friends_handler.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.error || 'Action failed. Please try again.');
        }
    })
    .catch(err => console.error('Fetch error:', err));
}