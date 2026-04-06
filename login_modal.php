<?php

$authError = $_SESSION['auth_error'] ?? null;
$authSuccess = $_SESSION['auth_success'] ?? null;
$authTab = $_SESSION['auth_tab'] ?? ($_GET['auth'] ?? 'login');
$notice = $_GET['notice'] ?? '';

if ($notice === 'login_required' && !$authError && !$authSuccess) {
  $authError = 'Please log in first to continue.';
  $authTab = 'login';
}

unset($_SESSION['auth_error'], $_SESSION['auth_success'], $_SESSION['auth_tab']);
?>

  <!-- LOGIN / REGISTER MODAL -->
  <div class="auth-modal" id="authModal" aria-hidden="true" data-auth-tab="<?php echo htmlspecialchars($authTab, ENT_QUOTES, 'UTF-8'); ?>" data-has-message="<?php echo ($authError || $authSuccess) ? '1' : '0'; ?>" data-server-message-type="<?php echo $authError ? 'error' : ($authSuccess ? 'success' : ''); ?>" data-server-message="<?php echo htmlspecialchars((string)($authError ?: $authSuccess ?: ''), ENT_QUOTES, 'UTF-8'); ?>">
    <div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <div class="auth-left">
        <div class="auth-brand">
 <div class="logo-animation-container">
	 <img src="images/123.png" alt="Background Pattern" class="pixel-bg">
	 <div class="radar-scan"></div>
	 <div class="shield-blocker"></div>
  <img src="images/handav.png" alt="HANDAVis Logo" class="auth-logo">

 
  
  <div class="blinking-dot red-dot"></div>
  <div class="blinking-dot green-dot"></div>
  <div class="blinking-dot yellow-dot"></div>
  <div class="blinking-dot orange-dot"></div>
			</div></div>
        

        

		</div>

      <div class="auth-right">
  <div class="auth-panel">
    <div class="auth-top">
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" data-tab="login">Login</button>
        <button type="button" class="auth-tab" data-tab="register">Register</button>
      </div>
      <button type="button" class="close-btn" id="closeAuthBtn" aria-label="Close modal">✕</button>
    </div>

    <div class="auth-scroll-area">
      <form class="auth-form active" id="loginForm" action="database/login.php" method="POST" novalidate>
        <div class="form-head">
          <h3>Sign in</h3>
          <p>Enter your account details to continue to HANDAVis.</p>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="loginEmail">Email address</label>
            <input type="email" id="loginEmail" name="email" placeholder="name@example.com" autocomplete="email" required/>
            <p id="loginEmailError" class="field-error" style="display:none;">Please enter a valid email address.</p>
          </div>
          <div class="field">
            <label for="loginPassword">Password</label>
            <div class="password-wrap">
              <input type="password" id="loginPassword" name="password" placeholder="Enter your password" autocomplete="current-password" required/>
              <button type="button" class="toggle-password" data-target="loginPassword">👁</button>
            </div>
          </div>
        </div>
        <div class="helper-row">
          <label class="checkbox">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <a href="#" class="mini-link">Forgot password?</a>
        </div>
        <button type="submit" id="loginSubmitBtn" class="btn submit-btn">Login to HANDAVis</button>
        <div class="fake-divider">or continue with</div>
        <div class="social-row">
          <button type="button" class="social-btn">Google</button>
          <button type="button" class="social-btn">Facebook</button>
        </div>
        <p class="form-note">
          Don’t have an account? <span class="switch-link" data-go="register">Create one here</span>
        </p>
      </form>

   <form class="auth-form" id="registerForm" action="database/register.php" method="POST">
  <div class="form-head">
    <h3>Create account</h3>
    <p>Register to access preparedness tools.</p>
  </div>

  <div class="form-grid two">
    <div class="field">
      <label for="regFirstName">First Name</label>
      <input type="text" id="regFirstName" name="first_name" placeholder="First Name" maxlength="100" required/>
    </div>
    <div class="field">
      <label for="regLastName">Last Name</label>
      <input type="text" id="regLastName" name="last_name" placeholder="Last Name" maxlength="100" required/>
    </div>
  </div>
	    <div class="form-grid">

              <div class="field">

                <label for="regEmail">Email address</label>

                <input type="email" id="regEmail" name="email" placeholder="name@example.com" autocomplete="email" required/>

              </div>

 <div class="field">
    <label for="regRegion">Province (Western Visayas)</label>
    <select id="regRegion" name="province" required>
      <option value="">Select Province</option>
      <option>Aklan</option>
      <option>Antique</option>
      <option>Capiz</option>
      <option>Guimaras</option>
      <option>Iloilo</option>
      <option>Negros Occidental</option>
    </select>
  </div>

  <div class="form-grid two">
    <div class="field">
      <label for="regMunicipality">Municipality</label>
      <select id="regMunicipality" name="municipality" required>
        <option value="">Select Municipality</option>
      </select>
    </div>
    <div class="field">
      <label for="regBarangay">Barangay</label>
      <select id="regBarangay" name="barangay" required>
        <option value="">Select Barangay</option>
      </select>
    </div>
  </div>

  <div class="field">
    <label for="regPhone">Phone Number</label>
    <input type="tel" id="regPhone" name="phone" placeholder="09XXXXXXXXX or +639XXXXXXXXX" inputmode="tel" maxlength="16" required/>
  </div>

  <div class="field">
    <label for="regRole">Account Type</label>
    <select id="regRole" name="role" required>
      <option value="">Select Account Type</option>
      <option value="User">User</option>
      <option value="Barangay Staff">Barangay Staff</option>
      <option value="Responder">Responder</option>
      <option value="Admin">Admin</option>
    </select>
  </div>

 <div class="field">
  <label for="regPassword">Password</label>
  <div class="password-wrap">
    <input type="password" id="regPassword" name="password" placeholder="Create a password" autocomplete="new-password" minlength="8" required/>
    <button type="button" class="toggle-password" data-target="regPassword">👁</button>
  </div>
</div>

<div class="field">
  <label for="regConfirmPassword">Confirm Password</label>
  <div class="password-wrap">
    <input type="password" id="regConfirmPassword" name="confirm_password" placeholder="Repeat your password" autocomplete="new-password" minlength="8" required/>
    <button type="button" class="toggle-password" data-target="regConfirmPassword">👁</button>
  </div>
</div>

  <div class="auth-terms-inline">
    <label class="checkbox">
      <input type="checkbox" id="regAgree" name="agree_terms" value="1" required/>
      <span>
        I agree to the <a href="#" class="blue-link">Terms of Service</a> 
        and <a href="#" class="blue-link">Privacy Policy</a>
      </span>
    </label>
  </div>

  <p id="regPasswordError" style="display:none; color:#ff6b6b; margin:0;">Passwords do not match.</p>

  <button type="submit" class="btn submit-btn">Create Account</button>
  
  <p class="form-note">
    Already have an account? <span class="switch-link" data-go="login">Login instead</span>
  </p>
</form>
