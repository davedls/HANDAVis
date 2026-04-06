(function () {
  // --- 1. UI TOAST & THEME LOGIC ---
  function showHeaderToast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }
 
  function toggleTheme() {
    document.body.classList.toggle("light-mode");
    var isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("handavisTheme", isLight ? "light" : "dark");
    showHeaderToast(isLight ? "Light mode enabled." : "Dark mode enabled.");
 
    if (window.map && typeof window.map.invalidateSize === "function") {
      setTimeout(function () {
        window.map.invalidateSize();
      }, 180);
    }
  }
 
  function loadTheme() {
    var savedTheme = localStorage.getItem("handavisTheme");
    if (savedTheme === "light") {
      document.body.classList.add("light-mode");
    }
  }
 
  // --- 2. NAVIGATION FUNCTIONS ---
  function openSettings() {
    window.location.href = "/HANDAVis/user_settings.php";
  }
 
  function toggleProfileMenu() {
    window.location.href = "/HANDAVis/user_profile.php";
  }
 
  function toggleHamburger() {
    const btn = document.getElementById('hamburgerBtn');
    const drawer = document.getElementById('mobileDrawer');
    if (btn && drawer) {
      btn.classList.toggle('open');
      drawer.classList.toggle('open');
    }
  }
 
  // --- 3. FRIENDS DROPDOWN & SEARCH (THE MISSING PART) ---
  // ── Friends Dropdown ─────────────────────────────────────────────────────
 
  function toggleFriendsDropdown(event) {
    if (event) event.stopPropagation();
    const fDropdown = document.getElementById('friendsDropdown');
    const nDropdown = document.getElementById('notificationsDropdown');
    if (nDropdown) nDropdown.classList.remove('active');
    if (!fDropdown) return;
    const isHidden = (fDropdown.style.display === 'none' || fDropdown.style.display === '');
    fDropdown.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) loadFriendsList();
  }
 
  function loadFriendsList() {
    const list = document.getElementById('friendsList');
    if (!list) return;
    list.innerHTML = '<div style="padding:20px;text-align:center;opacity:0.5;font-size:12px;">Loading...</div>';
    fetch('/HANDAVis/database/friends_handler.php?action=get_friends')
      .then(res => res.json())
      .then(friends => renderFriendsList(friends))
      .catch(() => {
        list.innerHTML = '<div style="padding:20px;text-align:center;opacity:0.5;">Could not load friends.</div>';
      });
  }
 
  function renderFriendsList(friends) {
    const list = document.getElementById('friendsList');
    if (!list) return;
    if (!friends || friends.length === 0) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:#9db0c8;font-size:12px;">No friends yet.<br>Search to add someone!</div>';
      return;
    }
    list.innerHTML = friends.map(f => {
      const avatarHtml = f.avatar
        ? `<img src="${f.avatar}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span style="display:none;width:34px;height:34px;border-radius:50%;background:#1e3a5f;color:#7eb8f7;font-size:13px;font-weight:700;align-items:center;justify-content:center;">${f.initials}</span>`
        : `<span style="display:flex;width:34px;height:34px;border-radius:50%;background:#1e3a5f;color:#7eb8f7;font-size:13px;font-weight:700;align-items:center;justify-content:center;">${f.initials}</span>`;
      return `
        <div class="fl-item" data-name="${f.name.toLowerCase()}">
          <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;cursor:pointer;" onclick="location.href='/HANDAVis/user_profile.php?id=${f.id}'">
            <div style="flex-shrink:0;">${avatarHtml}</div>
            <span style="font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</span>
          </div>
          <button class="fl-unfriend-btn" onclick="confirmUnfriend(${f.id}, '${f.name}', this)" title="Unfriend">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </button>
        </div>`;
    }).join('');
  }
 
  function confirmUnfriend(targetId, name, btn) {
    if (!confirm('Unfriend ' + name + '?')) return;
    btn.disabled = true;
    btn.style.opacity = '0.4';
    const fd = new FormData();
    fd.append('action', 'unfriend');
    fd.append('friend_id', targetId);
    fetch('/HANDAVis/database/friends_handler.php', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const item = btn.closest('.fl-item');
          item.style.transition = 'opacity 0.3s';
          item.style.opacity = '0';
          setTimeout(() => {
            item.remove();
            const list = document.getElementById('friendsList');
            if (list && list.querySelectorAll('.fl-item').length === 0) {
              list.innerHTML = '<div style="padding:24px;text-align:center;color:#9db0c8;font-size:12px;">No friends yet.<br>Search to add someone!</div>';
            }
          }, 300);
        } else {
          btn.disabled = false;
          btn.style.opacity = '';
          alert(data.error || 'Could not unfriend. Try again.');
        }
      })
      .catch(() => { btn.disabled = false; btn.style.opacity = ''; });
  }
 
  function searchFriends() {
    const input = document.getElementById('friendSearchInput');
    const list = document.getElementById('friendsList');
    if (!input || !list) return;
    const term = input.value.trim().toLowerCase();
    if (term.length === 0) {
      list.querySelectorAll('.fl-item').forEach(el => el.style.display = '');
      return;
    }
    const items = list.querySelectorAll('.fl-item');
    if (items.length > 0) {
      items.forEach(el => {
        el.style.display = el.dataset.name.includes(term) ? '' : 'none';
      });
    }
  }
 
  function processFriendship(targetId, actionType, event) {
    if (event) event.stopPropagation();
    const fd = new FormData();
    fd.append('action', actionType);
    fd.append('friend_id', targetId);
    fetch('/HANDAVis/database/friends_handler.php', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => { if (data.success) loadFriendsList(); });
  }
 
  function filterFriends(type, event) {
    if (event) event.stopPropagation();
    const tabs = document.querySelectorAll('.friend-tab');
    tabs.forEach(tab => {
      tab.style.color = '#9db0c8';
      tab.style.fontWeight = 'normal';
    });
    const clickedTab = document.getElementById('btn-' + type);
    if (clickedTab) {
      clickedTab.style.color = '#4fd8ff';
      clickedTab.style.fontWeight = 'bold';
    }
  }
 
  // --- 4. GLOBAL EVENT LISTENERS ---
  document.addEventListener('click', function(event) {
    const fDropdown = document.getElementById('friendsDropdown');
    // If click is outside the dropdown, close it
    if (fDropdown && !fDropdown.contains(event.target)) {
      fDropdown.style.display = 'none';
    }
  });
 
  // Export functions to the window so HTML 'onclick' can find them
 function doUnfriend(userId) {
  if (!confirm("Are you sure you want to remove this friend?")) return;
  processFriendship(userId, 'remove_friend');
}
  window.toggleTheme = toggleTheme;
  window.loadTheme = loadTheme;
  window.openSettings = openSettings;
  window.toggleProfileMenu = toggleProfileMenu;
  window.toggleHamburger = toggleHamburger;
  window.toggleFriendsDropdown = toggleFriendsDropdown;
  window.searchFriends = searchFriends;
  window.processFriendship = processFriendship;
  window.filterFriends = filterFriends;
  window.confirmUnfriend = confirmUnfriend;
  window.loadFriendsList = loadFriendsList;
  window.doUnfriend = doUnfriend;
	
 
  // Initialize theme on load
  loadTheme();
})();
 
// Loader control
function hideLoader() {
  var loader = document.getElementById("shield-loader-overlay");
  if (loader) loader.style.display = "none";
}
window.addEventListener("load", function () {
  setTimeout(hideLoader, 1000);
});
window.searchFriends = function() {
    const input = document.getElementById('friendSearchInput');
    const list = document.getElementById('friendsList');
    
    if (!input || !list) return;
 
    const term = input.value.trim();
 
    if (term.length < 2) {
        list.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5; font-size:12px;">Start typing...</div>';
        return;
    }
 
    fetch(`/HANDAVis/database/friends_handler.php?action=search&query=${encodeURIComponent(term)}`)
        .then(res => res.json())
        .then(users => {
            list.innerHTML = ''; 
            
            if (!users || users.length === 0 || users.error) {
                list.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5;">No users found</div>';
                return;
            }
 
            users.forEach(user => {
                // UPDATE: Using your specific image path
                // If avatar_path is empty in DB, it falls back to a default image
                const imgPath = user.avatar_path 
                    ? `/HANDAVis/images/profile_avatars/${user.avatar_path}` 
                    : `/HANDAVis/images/profile_avatars/default-avatar.png`;
                
                const fullName = `${user.first_name} ${user.last_name}`;
 
                list.innerHTML += `
                    <div class="friend-item" 
                         onclick="window.location.href='/HANDAVis/user_profile.php?id=${user.id}'"
                         style="display:flex; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); gap: 12px; cursor: pointer; transition: background 0.2s;">
                        
                        <img src="${imgPath}" 
                             onerror="this.src='/HANDAVis/images/profile_avatars/default-avatar.png'" 
                             style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 1px solid rgba(255,255,255,0.1);">
                        
                        <div style="flex:1; display:flex; flex-direction:column;">
                            <span style="font-size:13px; color:white; font-weight:600; line-height:1.2;">${fullName}</span>
                            <span style="font-size:10px; color:#4fd8ff; margin-top:2px;">User ID: #${user.id}</span>
                        </div>
 
                 <div style="font-size: 11px; color: #4fd8ff; opacity: 0.7;">View Profile</div>
                    </div>`;
            });
        })
        .catch(err => {
            console.error("Search error:", err);
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#ff4d57;">Server error</div>';
        });
};