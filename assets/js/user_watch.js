(function() {
    // 1. URL & Page Switching Logic
    window.updateURL = function(pageName) {
        const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname + '?page=' + pageName;
        window.history.pushState({path:newURL}, '', newURL);
    };

    const originalOpenPage = window.openPage;
    window.openPage = function(evt, pageName) {
        window.updateURL(pageName); 
        if (typeof originalOpenPage === 'function') {
            originalOpenPage(evt, pageName);
        }
    };

    // 2. Filter Function (Fixed Button Highlighting)
    window.filterVideos = function(category, event) {
        const btns = document.querySelectorAll('.filter-btn');
        btns.forEach(btn => btn.classList.remove('active'));

        if (event && event.currentTarget) {
            event.currentTarget.classList.add('active');
        }

        const cards = document.querySelectorAll('.video-card');
        cards.forEach(card => {
            const cardCategory = card.getAttribute('data-category');
            if (category === 'all' || cardCategory === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    };

    // 3. Video Player Logic (The version that fixes the "Black Screen")
    window.openVideoPlayer = function(id) {
        const modal = document.getElementById('videoModal');
        const frame = document.getElementById('playerFrame');
        
        if (modal && frame) {
            // We use absolute positioning here to ensure the iframe fills the black box
            frame.innerHTML = `<iframe 
                src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0" 
                style="width:100%; height:100%; position:absolute; top:0; left:0; border:none;" 
                allow="autoplay; encrypted-media" 
                allowfullscreen>
            </iframe>`;
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Stop background scrolling
        }
    };

    window.closeVideoPlayer = function() {
        const modal = document.getElementById('videoModal');
        const frame = document.getElementById('playerFrame');
        if (modal && frame) {
            modal.style.display = 'none';
            frame.innerHTML = ''; // Kill the video/audio
            document.body.style.overflow = 'auto';
        }
    };

    console.log("HANDAVis Watch Module: Initialized.");
})();

// 4. URL Params Check (Stays outside IIFE or inside, but this works fine here)
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    if (page) {
        openPage(null, page);
    }
});