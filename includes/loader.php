<div id="shield-loader-overlay">
    <div class="loader-content">
        <svg class="shield-svg" viewBox="0 0 50 58">
            <path class="shield-bg" d="M25 2L5 10v15c0 12 8 23 20 28 12-5 20-16 20-28V10L25 2z"/>
            <path class="shield-trace" d="M25 2L5 10v15c0 12 8 23 20 28 12-5 20-16 20-28V10L25 2z"/>
        </svg>
        <p class="loader-text">HANDAVis Loading...</p>
    </div>
</div>

<style>
/* 1. The Full-Screen Container */
#shield-loader-overlay {
    position: fixed;
    /* Use 'inset: 0' to ensure it covers 100% of the screen */
    inset: 0; 
    width: 100vw;
    height: 100vh;
    background: rgba(10, 15, 25, 0.98); 
    backdrop-filter: blur(10px);
    display: flex;
    justify-content: center; /* Horizontal Center */
    align-items: center;     /* Vertical Center */
    z-index: 99999;
}

/* 2. The Shield SVG Scaling */
.shield-svg {
    width: 70px;
    height: 80px;
}

/* 3. The Static Background Path */

/* 4. The TRACING Animation Logic */
.shield-trace {
    fill: none;
    stroke: #00BFFF; /* Deep Sky Blue */
    stroke-width: 3;
    stroke-linecap: round;
    
    /* Tracing effect settings */
    stroke-dasharray: 60, 140; 
    animation: trace-shield 1.5s linear infinite;
}

.shield-bg {
    fill: none;
    stroke: rgba(0, 191, 255, 0.15); /* Faint Sky Blue background */
    stroke-width: 2;
}

@keyframes trace-shield {
    0% { stroke-dashoffset: 200; }
    100% { stroke-dashoffset: 0; }
}

.loader-text {
    color: white;
    font-family: 'Inter', sans-serif;
    margin-top: 15px;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
}
	
	.loader-content {
    display: flex;
    flex-direction: column;
    align-items: center; /* This centers the text under the shield */
    text-align: center;
}
</style>

<script>
	
// This is the "Sample" logic. 
// It hides the shield after 1.5 seconds regardless of actual page speed.
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('shield-loader-overlay');
        if(loader) {
            loader.style.transition = "opacity 0.5s ease";
            loader.style.opacity = "0";
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }, 1500); 
});
</script>