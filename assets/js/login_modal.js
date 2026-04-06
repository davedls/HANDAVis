document.addEventListener('DOMContentLoaded', function () {
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const authModal = document.getElementById('authModal');
  const openAuthBtn = document.getElementById('openAuthBtn');
  const closeAuthBtn = document.getElementById('closeAuthBtn');
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  const switchLinks = document.querySelectorAll('.switch-link');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const regAgree = document.getElementById('regAgree');
  const regPassword = document.getElementById('regPassword');
  const regConfirmPassword = document.getElementById('regConfirmPassword');
  const regPasswordError = document.getElementById('regPasswordError');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginEmailError = document.getElementById('loginEmailError');

  function markInvalid(input) {
    if (!input) return;
    input.classList.add('auth-input-invalid');
  }

  function clearInvalid(input) {
    if (!input) return;
    input.classList.remove('auth-input-invalid');
  }

  function markPasswordWrapInvalid(input) {
    if (!input) return;
    const wrap = input.closest('.password-wrap');
    if (wrap) {
      wrap.classList.add('auth-password-invalid');
    }
  }

  function clearPasswordWrapInvalid(input) {
    if (!input) return;
    const wrap = input.closest('.password-wrap');
    if (wrap) {
      wrap.classList.remove('auth-password-invalid');
    }
  }

  function vibrateOnError() {
    if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(1000);
  }

  function markLoginFieldsInvalid() {
    markInvalid(loginEmailInput);
    markInvalid(loginPasswordInput);
    markPasswordWrapInvalid(loginPasswordInput);
  }

  function clearLoginFieldErrors() {
    clearInvalid(loginEmailInput);
    clearInvalid(loginPasswordInput);
    clearPasswordWrapInvalid(loginPasswordInput);
    if (loginEmailError) {
      loginEmailError.style.display = 'none';
    }
  }

  function setAuthLeftMode(tabName) {
    const authLeft = document.querySelector('.auth-left');
    const authPoints = document.querySelector('.auth-points');
    const authTermsCard = document.getElementById('authTermsCard');

    if (!authLeft) return;

    if (tabName === 'register') {
      authLeft.classList.add('fixed');
      if (authPoints) authPoints.style.display = 'none';
      if (authTermsCard) authTermsCard.style.display = 'block';
    } else {
      authLeft.classList.remove('fixed');
      if (authPoints) authPoints.style.display = 'grid';
      if (authTermsCard) authTermsCard.style.display = 'none';
    }
  }

  function switchTab(tabName) {
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    forms.forEach(form => {
      const isTarget =
        (tabName === 'login' && form.id === 'loginForm') ||
        (tabName === 'register' && form.id === 'registerForm');

      form.classList.toggle('active', isTarget);
      form.style.display = isTarget ? 'block' : 'none';
    });

    const scrollArea = document.querySelector('.auth-scroll-area');
    if (scrollArea) {
      scrollArea.scrollTop = 0;
    }

    setAuthLeftMode(tabName);
  }

  function openModal(tabName = 'login') {
    if (!authModal) return;
    authModal.classList.add('active');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    switchTab(tabName);
  }

  function closeModal() {
    if (!authModal) return;
    authModal.classList.remove('active');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showAuthAutoModal(message) {
    if (!message) return;
    let modal = document.getElementById('authAutoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'authAutoModal';
      modal.className = 'auth-auto-modal';
      modal.innerHTML = '<div class="auth-auto-modal-box" role="alert" aria-live="assertive"></div>';
      document.body.appendChild(modal);
    }

    const box = modal.firstElementChild;
    if (box) box.textContent = message;
    modal.classList.remove('is-visible');
    void modal.offsetHeight;
    modal.classList.add('is-visible');

    clearTimeout(window.authAutoModalTimeout);
    window.authAutoModalTimeout = setTimeout(function () {
      modal.classList.remove('is-visible');
    }, 2200);
  }

  if (openAuthBtn) {
    openAuthBtn.addEventListener('click', function () {
      openModal('login');
    });
  }

  document.querySelectorAll('[data-open-auth]').forEach(btn => {
    btn.addEventListener('click', function () {
      openModal(this.dataset.openAuth || 'login');
    });
  });

  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', closeModal);
  }

  if (authModal) {
    authModal.addEventListener('click', function (e) {
      if (e.target === authModal) closeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('active')) {
      closeModal();
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      switchTab(this.dataset.tab);
    });
  });

  switchLinks.forEach(link => {
    link.addEventListener('click', function () {
      switchTab(this.dataset.go);
    });
  });

  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('data-target');
      const input = document.getElementById(targetId);

      if (input) {
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        this.textContent = isHidden ? 'Hide' : 'Show';
      }
    });
  });

  if (loginForm) {
    [loginEmailInput, loginPasswordInput].forEach(input => {
      if (!input) return;
      input.addEventListener('input', function () {
        clearInvalid(input);
        if (input === loginPasswordInput) {
          clearPasswordWrapInvalid(input);
        }
        if (input === loginEmailInput && loginEmailError) {
          loginEmailError.style.display = 'none';
        }
      });
    });

    loginForm.addEventListener('submit', function (e) {
      clearLoginFieldErrors();

      const email = loginEmailInput ? loginEmailInput.value.trim() : '';
      const password = loginPasswordInput ? loginPasswordInput.value : '';

      if (email === '' || password === '') {
        e.preventDefault();
        if (email === '') {
          markInvalid(loginEmailInput);
        }
        if (password === '') {
          markInvalid(loginPasswordInput);
          markPasswordWrapInvalid(loginPasswordInput);
        }
        return;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        e.preventDefault();
        markInvalid(loginEmailInput);
        if (loginEmailError) {
          loginEmailError.style.display = 'block';
        }
        if (loginEmailInput) {
          loginEmailInput.focus();
        }
        return;
      }

      if (!password) {
        e.preventDefault();
        markInvalid(loginPasswordInput);
        markPasswordWrapInvalid(loginPasswordInput);
        if (loginPasswordInput) {
          loginPasswordInput.focus();
        }
      }
    });
  }

  function normalizePhoneValue(rawPhone) {
    const cleaned = String(rawPhone || '')
      .trim()
      .replace(/[\s\-()]/g, '')
      .replace(/(?!^)\+/g, '');

    if (/^639\d{9}$/.test(cleaned)) {
      return `+${cleaned}`;
    }

    if (/^9\d{9}$/.test(cleaned)) {
      return `0${cleaned}`;
    }

    return cleaned;
  }

  if (registerForm) {
    const registerFields = [
      document.getElementById('regFirstName'),
      document.getElementById('regLastName'),
      document.getElementById('regEmail'),
      document.getElementById('regRegion'),
      document.getElementById('regMunicipality'),
      document.getElementById('regBarangay'),
      document.getElementById('regPhone'),
      document.getElementById('regRole'),
      regPassword,
      regConfirmPassword,
    ].filter(Boolean);

    function clearRegisterFieldErrors() {
      registerFields.forEach((input) => {
        clearInvalid(input);
        clearPasswordWrapInvalid(input);
      });

      if (regPasswordError) {
        regPasswordError.style.display = 'none';
      }
    }

    registerFields.forEach((input) => {
      const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(eventName, function () {
        clearInvalid(input);
        clearPasswordWrapInvalid(input);
        if (input === regConfirmPassword || input === regPassword) {
          if (regPasswordError) {
            regPasswordError.style.display = 'none';
          }
        }
      });
    });

    registerForm.addEventListener('submit', function (e) {
      clearRegisterFieldErrors();

      const firstNameInput = document.getElementById('regFirstName');
      const lastNameInput = document.getElementById('regLastName');
      const regEmailInput = document.getElementById('regEmail');
      const regRegion = document.getElementById('regRegion');
      const regMunicipality = document.getElementById('regMunicipality');
      const regBarangay = document.getElementById('regBarangay');
      const regPhone = document.getElementById('regPhone');
      const regRole = document.getElementById('regRole');

      const firstName = firstNameInput ? firstNameInput.value.trim() : '';
      const lastName = lastNameInput ? lastNameInput.value.trim() : '';
      const email = regEmailInput ? regEmailInput.value.trim() : '';
      const province = regRegion ? regRegion.value.trim() : '';
      const municipality = regMunicipality ? regMunicipality.value.trim() : '';
      const barangay = regBarangay ? regBarangay.value.trim() : '';
      const phone = regPhone ? normalizePhoneValue(regPhone.value) : '';
      const role = regRole ? regRole.value.trim() : '';

      if (regPhone) {
        regPhone.value = phone;
      }

      const requiredFields = [
        { input: firstNameInput, value: firstName, message: 'Please enter your first name.' },
        { input: lastNameInput, value: lastName, message: 'Please enter your last name.' },
        { input: regEmailInput, value: email, message: 'Please enter your email address.' },
        { input: regRegion, value: province, message: 'Please select your province.' },
        { input: regMunicipality, value: municipality, message: 'Please select your municipality.' },
        { input: regBarangay, value: barangay, message: 'Please select your barangay.' },
        { input: regPhone, value: phone, message: 'Please enter your phone number.' },
        { input: regRole, value: role, message: 'Please choose an account type.' },
      ];

      const missingField = requiredFields.find((field) => !field.value);
      if (missingField) {
        e.preventDefault();
        markInvalid(missingField.input);
        showAuthAutoModal(missingField.message);
        if (missingField.input) {
          missingField.input.focus();
        }
        return;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        e.preventDefault();
        markInvalid(regEmailInput);
        showAuthAutoModal('Please enter a valid email address.');
        if (regEmailInput) {
          regEmailInput.focus();
        }
        return;
      }

      const phonePattern = /^(09\d{9}|\+639\d{9})$/;
      if (!phonePattern.test(phone)) {
        e.preventDefault();
        markInvalid(regPhone);
        showAuthAutoModal('Please use a valid PH mobile number like 09123456789 or +639123456789.');
        if (regPhone) {
          regPhone.focus();
        }
        return;
      }

      if (regPassword && regPassword.value.length < 8) {
        e.preventDefault();
        markInvalid(regPassword);
        markPasswordWrapInvalid(regPassword);
        showAuthAutoModal('Password must be at least 8 characters long.');
        regPassword.focus();
        return;
      }

      if (regPassword && regConfirmPassword && regPassword.value !== regConfirmPassword.value) {
        e.preventDefault();
        markInvalid(regPassword);
        markInvalid(regConfirmPassword);
        markPasswordWrapInvalid(regPassword);
        markPasswordWrapInvalid(regConfirmPassword);
        if (regPasswordError) {
          regPasswordError.style.display = 'block';
        }
        showAuthAutoModal('Passwords do not match.');
        regConfirmPassword.focus();
        return;
      }

      if (regAgree && !regAgree.checked) {
        e.preventDefault();
        showAuthAutoModal('Please agree to the Terms of Service and Privacy Policy.');
        regAgree.focus();
      }
    });
  }

  const initialTab = authModal ? authModal.dataset.authTab || 'login' : 'login';
  const hasMessage = authModal ? authModal.dataset.hasMessage === '1' : false;
  const serverMessageType = authModal ? authModal.dataset.serverMessageType || 'error' : 'error';
  const serverMessage = authModal ? (authModal.dataset.serverMessage || '').trim() : '';

  switchTab(initialTab);

  if (hasMessage) {
    openModal(initialTab);
    showAuthAutoModal(serverMessage);
    if (initialTab === 'login' && serverMessageType === 'error') {
      markLoginFieldsInvalid();
      const normalizedMessage = serverMessage.toLowerCase();
      if (normalizedMessage.includes('invalid email or password')) {
        vibrateOnError();
        if (loginPasswordInput) {
          loginPasswordInput.focus();
        }
      }
    }
  }
});
