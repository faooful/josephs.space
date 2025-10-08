// Cursor animation only - removed THREE.js helix code

// Cursor animation
function initCursorAnimation() {
    const cursorContainer = document.querySelector('.cursor-container');
    if (!cursorContainer) {
        console.log('Cursor container not found');
        return;
    }

    let animationTimeout;

    function moveCursor() {
        // Get header element to determine boundaries
        const header = document.querySelector('header');
        if (!header) {
            console.log('Header not found');
            return;
        }

        // Calculate header bounds
        const headerRect = header.getBoundingClientRect();
        const headerBottom = headerRect.bottom;
        
        // Can move anywhere above the bottom of the header
        const maxTop = headerBottom; // Can go to the bottom of the header
        const minTop = 20; // Minimum 20px from top
        
        // Random target position within bounds
        const targetTop = Math.random() * (maxTop - minTop) + minTop;
        const targetRight = Math.random() * (window.innerWidth - 200); // Leave space for cursor width
        
        // Move cursor with smooth transition
        cursorContainer.style.top = targetTop + 'px';
        cursorContainer.style.right = targetRight + 'px';
        cursorContainer.style.left = 'auto';
        
        console.log('Cursor moving to:', targetTop, targetRight);
        
        // Schedule next move with random delay (0-10 seconds)
        const nextDelay = Math.random() * 10000; // 0-10 seconds in milliseconds
        console.log('Next move in:', nextDelay / 1000, 'seconds');
        animationTimeout = setTimeout(moveCursor, nextDelay);
    }

    // Start the animation after a short delay to ensure everything is loaded
    // The cursor starts from its current position (top-right corner from CSS)
    setTimeout(() => {
        console.log('Starting cursor animation from current position');
        // Add the animated class for smooth transitions BEFORE the first move
        cursorContainer.classList.add('animated');
        // Small delay to ensure transition is applied before moving
        setTimeout(() => {
            moveCursor();
        }, 100);
    }, 1000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (animationTimeout) {
            clearTimeout(animationTimeout);
        }
    });
}

// Mute toggle functionality
function toggleMute(videoId) {
    const video = document.getElementById(videoId);
    const button = video.parentElement.querySelector('.mute-toggle');
    const muteIcon = button.querySelector('.mute-icon');
    const unmuteIcon = button.querySelector('.unmute-icon');
    
    if (video.muted) {
        video.muted = false;
        muteIcon.style.display = 'none';
        unmuteIcon.style.display = 'block';
    } else {
        video.muted = true;
        muteIcon.style.display = 'block';
        unmuteIcon.style.display = 'none';
    }
}

// Make toggleMute globally available
window.toggleMute = toggleMute;

// Content toggle functionality
function switchContent(contentType) {
    const caseStudiesContent = document.getElementById('case-studies-content');
    const experimentsContent = document.getElementById('experiments-content');
    const toggleButtons = document.querySelectorAll('.toggle-option');
    
    // Remove active class from all buttons
    toggleButtons.forEach(button => button.classList.remove('active'));
    
    // Show/hide content based on selection
    if (contentType === 'case-studies') {
        caseStudiesContent.style.display = 'block';
        experimentsContent.style.display = 'none';
        // Add active class to case studies button
        document.querySelector('.toggle-option[onclick="switchContent(\'case-studies\')"]').classList.add('active');
    } else if (contentType === 'experiments') {
        caseStudiesContent.style.display = 'none';
        experimentsContent.style.display = 'block';
        // Add active class to experiments button
        document.querySelector('.toggle-option[onclick="switchContent(\'experiments\')"]').classList.add('active');
    }
}

// Make switchContent globally available
window.switchContent = switchContent;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initCursorAnimation();
    initCarousel();
    initDitherEffect();
});

// Initialize dither effect
function initDitherEffect() {
    const ditherContainer = document.getElementById('dither-header');
    if (ditherContainer && window.DitherEffect) {
        // Get brand color based on page
        let waveColor = [0.5, 0.5, 0.5]; // Default gray
        
        const path = window.location.pathname;
        if (path.includes('irm.html')) {
            // Google blue: #4285F4
            waveColor = [0.26, 0.52, 0.96]; // Convert hex to RGB (0-1)
        } else if (path.includes('spotify.html')) {
            // Spotify green: #1ED760
            waveColor = [0.12, 0.85, 0.38];
        } else if (path.includes('p44.html')) {
            // project44 blue: #0072E9
            waveColor = [0.0, 0.45, 0.91];
        } else if (path.includes('jaas.html')) {
            // Ubuntu orange: #dd4814
            waveColor = [0.87, 0.28, 0.08];
        } else if (path.includes('cell.html') || path.includes('hologram.html') || path.includes('slo.html')) {
            // Datadog purple: #632CA6
            waveColor = [0.39, 0.17, 0.65];
        }
        
        new DitherEffect('dither-header', {
            waveColor: waveColor,
            colorIntensity: 8.2,
            disableAnimation: false,
            enableMouseInteraction: false,
            mouseRadius: 0.3,
            colorNum: 4,
            waveAmplitude: 0,
            waveFrequency: 10,
            waveSpeed: 0.03,
            pixelSize: 2
        });
    }
}

// Carousel functionality
function initCarousel() {
    let currentSlideIndex = 0;
    const slides = document.querySelectorAll('.carousel-item');
    const dots = document.querySelectorAll('.dot');
    const track = document.querySelector('.carousel-track');

    function showSlide(index) {
        // Remove active class from all slides and dots
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        // Add active class to current slide
        if (slides[index]) {
            slides[index].classList.add('active');
        }
        if (dots[index]) {
            dots[index].classList.add('active');
        }
        
        // Calculate transform to show the selected slide
        const slideWidth = slides[0].offsetWidth + 20; // width + gap
        const translateX = -index * slideWidth;
        if (track) {
            track.style.transform = `translateX(${translateX}px)`;
        }
    }

    function changeSlide(direction) {
        currentSlideIndex += direction;
        
        // Handle wrapping
        if (currentSlideIndex >= slides.length) {
            currentSlideIndex = 0;
        } else if (currentSlideIndex < 0) {
            currentSlideIndex = slides.length - 1;
        }
        
        showSlide(currentSlideIndex);
    }

    function currentSlide(index) {
        currentSlideIndex = index - 1; // Convert to 0-based index
        showSlide(currentSlideIndex);
    }

    // Make functions globally available
    window.changeSlide = changeSlide;
    window.currentSlide = currentSlide;

    // Initialize carousel
    if (slides.length > 0) {
        showSlide(0);
    }
} 