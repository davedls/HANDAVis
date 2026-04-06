(function () {
  var editMode = false;
  var snapshot = null;

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function editableFields() {
    return [
      document.getElementById('inputFirstName'),
      document.getElementById('inputLastName'),
      document.getElementById('inputPhone'),
      document.getElementById('inputEmail'),
      document.getElementById('inputAddress')
    ].filter(Boolean);
  }

  function capture() {
    return {
      first: (document.getElementById('inputFirstName') || {}).value || '',
      last: (document.getElementById('inputLastName') || {}).value || '',
      phone: (document.getElementById('inputPhone') || {}).value || '',
      email: (document.getElementById('inputEmail') || {}).value || '',
      address: (document.getElementById('inputAddress') || {}).value || ''
    };
  }

  function restore(data) {
    if (!data) return;
    if (document.getElementById('inputFirstName')) document.getElementById('inputFirstName').value = data.first || '';
    if (document.getElementById('inputLastName')) document.getElementById('inputLastName').value = data.last || '';
    if (document.getElementById('inputPhone')) document.getElementById('inputPhone').value = data.phone || '';
    if (document.getElementById('inputEmail')) document.getElementById('inputEmail').value = data.email || '';
    if (document.getElementById('inputAddress')) document.getElementById('inputAddress').value = data.address || '';
    reflectName();
  }

  function setEditMode(on) {
    editMode = !!on;
    editableFields().forEach(function (el) {
      el.readOnly = !editMode;
    });

    var editBtn = document.getElementById('editProfileBtn');
    var saveBtn = document.getElementById('saveProfileBtn');
    var cancelBtn = document.getElementById('cancelProfileBtn');

    if (editBtn) editBtn.hidden = editMode;
    if (saveBtn) saveBtn.hidden = !editMode;
    if (cancelBtn) cancelBtn.hidden = !editMode;
  }

  function reflectName() {
    var first = (document.getElementById('inputFirstName') || {}).value || '';
    var last = (document.getElementById('inputLastName') || {}).value || '';
    var full = (first + ' ' + last).trim() || 'Responder';
    var display = document.getElementById('displayFullName');
    if (display) display.textContent = full;
  }

  function toggleEditMode() {
    if (editMode) return;
    snapshot = capture();
    setEditMode(true);
  }

  function cancelEdit() {
    restore(snapshot);
    setEditMode(false);
    toast('Changes discarded.');
  }

  function saveProfile() {
    var payload = {
      first_name: (document.getElementById('inputFirstName') || {}).value || '',
      last_name: (document.getElementById('inputLastName') || {}).value || '',
      phone: (document.getElementById('inputPhone') || {}).value || '',
      email: (document.getElementById('inputEmail') || {}).value || '',
      address: (document.getElementById('inputAddress') || {}).value || ''
    };

    fetch('/HANDAVis/database/responder/responders_profile_update.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, payload: data || {} }; });
      })
      .then(function (result) {
        if (!result.ok || !result.payload.ok) {
          toast(result.payload.error || 'Failed to save profile.');
          return;
        }
        snapshot = capture();
        setEditMode(false);
        reflectName();
        toast('Responder profile updated.');
      })
      .catch(function () { toast('Failed to save profile.'); });
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

    var form = new FormData();
    form.append('current_password', current.value);
    form.append('new_password', next.value);
    form.append('confirm_password', confirm.value);

    fetch('/HANDAVis/database/responder/responders_profile_update_password.php', {
      method: 'POST',
      body: form,
      credentials: 'same-origin'
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, payload: d || {} }; }); })
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
      .catch(function () { toast('Failed to update password.'); });
  }

  function uploadAvatar(file) {
    var form = new FormData();
    form.append('avatar', file);

    fetch('/HANDAVis/database/responder/responders_profile_upload_avatar.php', {
      method: 'POST',
      body: form,
      credentials: 'same-origin'
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, payload: d || {} }; }); })
      .then(function (result) {
        if (!result.ok || !result.payload.ok) {
          toast(result.payload.error || 'Failed to upload photo.');
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
      .catch(function () { toast('Failed to upload photo.'); });
  }

  function onAvatarPicked(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast('Please select an image file.');
      return;
    }
    uploadAvatar(file);
  }

  document.addEventListener('DOMContentLoaded', function () {
    snapshot = capture();
    setEditMode(false);
    reflectName();

    var fileInput = document.getElementById('avatarFileInput');
    if (fileInput) fileInput.addEventListener('change', onAvatarPicked);
  });

  window.toggleEditMode = toggleEditMode;
  window.cancelEdit = cancelEdit;
  window.saveProfile = saveProfile;
  window.updatePassword = updatePassword;
})();
