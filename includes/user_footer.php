<div id="logoutModal" class="modal-overlay" style="display:none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Confirm Logout</h3>
            <span class="close-btn" onclick="toggleLogoutModal()">&times;</span>
        </div>
        <div class="modal-body">
            <p>Are you sure you want to log out of <strong>HANDAVis</strong>?</p>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn-no" onclick="toggleLogoutModal()">No, stay</button>
            <button type="button" class="btn-yes" onclick="confirmLogoutAction()">Yes, Logout</button>
        </div>
    </div>
</div>

<style>
.VIpgJd-ZVi9od-ORHb-OEVmcd { display: none !important; }

/* ── Modal Styles ── */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: none; 
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.modal-content {
    background: linear-gradient(135deg, #343e5b 0%, #000d2b 100%);
    color: #ffffff;
    padding: 35px;
    border-radius: 20px;
    width: 360px;
    text-align: center;
    position: relative;
    box-shadow: 0 15px 35px rgba(0,0,0,0.5), 0 0 15px rgba(65, 105, 225, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn {
    position: absolute;
    top: 12px; right: 20px;
    font-size: 28px;
    cursor: pointer;
    color: rgba(255,255,255,0.6);
    transition: 0.3s;
}
.close-btn:hover { color: #ffffff; }

.modal-body p {
    font-size: 1.05rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.9);
}

.modal-footer {
    margin-top: 30px;
    display: flex;
    gap: 12px;
}

.btn-yes {
    background: #ff4757;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 10px;
    flex: 1;
    cursor: pointer;
    font-weight: bold;
}
.btn-yes:hover { background: #ff3333; }

.btn-no {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 12px;
    border-radius: 10px;
    flex: 1;
    cursor: pointer;
}
.btn-no:hover { background: rgba(255, 255, 255, 0.2); }

/* ── Footer Styles ── */
.footer-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.footer-section ul li a {
    text-decoration: none;
    color: rgba(255, 255, 255, 0.75);
    font-size: 14px;
    transition: color 0.2s ease;
}

.footer-section ul li a:hover {
    color: #4fd8ff;
}
</style>

<footer class="main-footer">
  <div class="footer-container">

    <div class="footer-section brand-area">
      <div style="display:flex; gap:20px; align-items:flex-start;">
        <img src="/HANDAVis/images/handa.png" alt="Logo" style="height:65px;">
        
        <div>
          <h2 style="margin:0; color:#4fd8ff;">HANDAVis</h2>
          <p style="margin-top:8px; color:#9fb0c7;">
            Disaster Risk Reduction and Management platform featuring real-time monitoring and predictive analytics.
          </p>
        </div>
      </div>
    </div>

    <div class="footer-section">
      <h3>Quick Links</h3>
      <ul>
        <li><a href="#">About Us</a></li>
        <li><a href="#">Emergency Protocols</a></li>
        <li><a href="#">Community Reports</a></li>
      </ul>
    </div>

    <div class="footer-section">
      <h3>Social Media Links</h3>
      <div class="icon-group">
        <a href="https://www.facebook.com/handavis.westernvisayas/" target="_blank">
          <img src="/HANDAVis/images/fblogo.png">
        </a>
        <a href="#"><img src="/HANDAVis/images/iglogo.png"></a>
        <a href="#"><img src="/HANDAVis/images/ytlogo.png"></a>
      </div>
    </div>

    <div class="footer-section">
      <h3>Download Our App</h3>
      <div class="icon-group">
        <a href="#"><img src="/HANDAVis/images/windowslogo.png"></a>
        <a href="#"><img src="/HANDAVis/images/applelogo.png"></a>
        <a href="#"><img src="/HANDAVis/images/playstorelogo.png"></a>
      </div>
    </div>

  </div>
</footer>

<!-- Google Translate -->
<div id="google_translate_element" style="display:none"></div>

<script>
/* 🔥 HARD REMOVE Google bar */
function removeGoogleBar() {
    const frame = document.querySelector('iframe.goog-te-banner-frame');
    if (frame) frame.remove();
    document.body.style.top = "0px";
}
setInterval(removeGoogleBar, 300);
window.addEventListener("load", removeGoogleBar);

/* Google Translate init */
function googleTranslateElementInit() {
  new google.translate.TranslateElement({
    pageLanguage: 'en',
    includedLanguages: 'tl,hil',
    autoDisplay: false
  }, 'google_translate_element');
}

/* Restore language */
document.addEventListener("DOMContentLoaded", function () {
  const saved = localStorage.getItem("handavisLang");
  if (!saved || saved === "English") return;

  const langMap = { "Filipino": "tl", "Hiligaynon": "hil" };
  const code = langMap[saved];
  if (!code) return;

  if (!document.cookie.includes("googtrans=/en/" + code)) {
    document.cookie = "googtrans=/en/" + code + "; path=/";
    document.cookie = "googtrans=/en/" + code + "; path=/; domain=" + location.hostname;
    location.reload();
  }
});
</script>

<script src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>

<script>
/* Logout modal */
function toggleLogoutModal() {
    const modal = document.getElementById('logoutModal');
    modal.style.display = (modal.style.display === "flex") ? "none" : "flex";
}

function confirmLogoutAction() {
    const form = document.getElementById('logoutForm');
    if (form) form.submit();
}

window.onclick = function(event) {
    const modal = document.getElementById('logoutModal');
    if (event.target === modal) toggleLogoutModal();
}
</script>