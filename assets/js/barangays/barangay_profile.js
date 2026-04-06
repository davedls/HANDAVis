(function () {
  var isEditing = false;
  var snapshot = null;

  function toast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    }
  }

  function editableFields() {
    return [
      document.getElementById('inputPhone'),
      document.getElementById('inputEmail'),
      document.getElementById('inputHallAddress')
    ].filter(Boolean);
  }

  function capture() {
    return {
      inputPhone: (document.getElementById('inputPhone') || {}).value || '',
      inputEmail: (document.getElementById('inputEmail') || {}).value || '',
      inputHallAddress: (document.getElementById('inputHallAddress') || {}).value || ''
    };
  }

  function restore(state) {
    if (!state) return;
    if (document.getElementById('inputPhone')) document.getElementById('inputPhone').value = state.inputPhone || '';
    if (document.getElementById('inputEmail')) document.getElementById('inputEmail').value = state.inputEmail || '';
    if (document.getElementById('inputHallAddress')) document.getElementById('inputHallAddress').value = state.inputHallAddress || '';
  }

  function setEditing(on) {
    isEditing = !!on;
    editableFields().forEach(function (el) {
      if (el.tagName === 'TEXTAREA') {
        el.readOnly = !isEditing;
      } else {
        el.readOnly = !isEditing;
      }
    });

    var editBtn = document.getElementById('editProfileBtn');
    var saveBtn = document.getElementById('saveProfileBtn');
    var cancelBtn = document.getElementById('cancelProfileBtn');
    if (editBtn) editBtn.hidden = isEditing;
    if (saveBtn) saveBtn.hidden = !isEditing;
    if (cancelBtn) cancelBtn.hidden = !isEditing;
  }

  function toggleEditMode() {
    if (isEditing) return;
    snapshot = capture();
    setEditing(true);
  }

  function cancelEdit() {
    restore(snapshot);
    setEditing(false);
    toast('Changes discarded.');
  }

  function saveProfile() {
    var payload = {
      phone: (document.getElementById('inputPhone') || {}).value || '',
      email: (document.getElementById('inputEmail') || {}).value || '',
      barangay_hall_address: (document.getElementById('inputHallAddress') || {}).value || ''
    };

    fetch('/HANDAVis/database/barangay/barangay_profile_update.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, payload: data || {} };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.payload.ok) {
          toast(result.payload.error || 'Failed to save profile.');
          return;
        }
        snapshot = capture();
        setEditing(false);
        toast('Barangay profile updated.');
      })
      .catch(function () {
        toast('Failed to save profile.');
      });
  }

  function updatePassword() {
    var current = document.getElementById('pwCurrent');
    var next = document.getElementById('pwNew');
    var confirm = document.getElementById('pwConfirm');
    if (!current || !next || !confirm) return;

    if (!current.value || !next.value || !confirm.value) {
      toast('Please fill in all password fields.');
      return;
    }
    if (next.value !== confirm.value) {
      toast('New passwords do not match.');
      return;
    }
    if (next.value.length < 8) {
      toast('Password must be at least 8 characters.');
      return;
    }

    var form = new FormData();
    form.append('current_password', current.value);
    form.append('new_password', next.value);
    form.append('confirm_password', confirm.value);

    fetch('/HANDAVis/database/barangay/barangay_profile_update_password.php', {
      method: 'POST',
      body: form,
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, payload: data || {} };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.payload.ok) {
          toast(result.payload.error || 'Failed to update password.');
          return;
        }
        current.value = '';
        next.value = '';
        confirm.value = '';
        toast('Password updated successfully.');
      })
      .catch(function () {
        toast('Failed to update password.');
      });
  }

  function uploadAvatar(file) {
    var form = new FormData();
    form.append('avatar', file);

    fetch('/HANDAVis/database/barangay/barangay_profile_upload_avatar.php', {
      method: 'POST',
      body: form,
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, payload: data || {} };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.payload.ok) {
          toast(result.payload.error || 'Failed to upload avatar.');
          return;
        }
        var avatar = document.getElementById('avatarEl');
        if (avatar && result.payload.avatar_url) {
          avatar.textContent = '';
          avatar.style.backgroundImage = "url('" + result.payload.avatar_url + "')";
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.backgroundRepeat = 'no-repeat';
          avatar.style.fontSize = '0';
        }
        toast('Profile photo updated.');
      })
      .catch(function () {
        toast('Failed to upload avatar.');
      });
  }

  function onAvatarSelected(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast('Please choose an image file.');
      return;
    }
    uploadAvatar(file);
  }

  document.addEventListener('DOMContentLoaded', function () {
    snapshot = capture();
    setEditing(false);

    var avatarInput = document.getElementById('avatarFileInput');
    if (avatarInput) avatarInput.addEventListener('change', onAvatarSelected);
  });

  window.toggleEditMode = toggleEditMode;
  window.cancelEdit = cancelEdit;
  window.saveProfile = saveProfile;
  window.updatePassword = updatePassword;
})();
