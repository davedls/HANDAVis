document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu');
    const navLinks = document.getElementById('nav-links');

    menuToggle.addEventListener('click', () => {
        // Toggle the 'active' class to show/hide menu
        navLinks.classList.toggle('active');
        
        // Optional: Animate the hamburger into an 'X'
        menuToggle.classList.toggle('is-active');
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            // This is the trigger
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('is-active');
            
            console.log("Menu Toggled:", navLinks.classList.contains('active'));
        });
    }

    // Close menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('is-active');
        });
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            // Toggle classes for the menu and the icon animation
            navLinks.classList.toggle('active');
            this.classList.toggle('is-active');
            
            // Console log to check if click is working (Press F12 to see)
            console.log("Hamburger clicked!");
        });
    }
});