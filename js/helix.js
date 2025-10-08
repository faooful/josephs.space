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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initCursorAnimation();
    initCarousel();
});

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
        
        // Add active class to current slide and dot
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

    // Auto-advance carousel every 5 seconds
    let carouselInterval;

    function startCarousel() {
        carouselInterval = setInterval(() => {
            changeSlide(1);
        }, 5000);
    }

    function stopCarousel() {
        clearInterval(carouselInterval);
    }

    // Make functions globally available
    window.changeSlide = changeSlide;
    window.currentSlide = currentSlide;

    // Initialize carousel
    if (slides.length > 0) {
        showSlide(0);
        startCarousel();
        
        // Pause auto-advance on hover
        const carouselContainer = document.querySelector('.carousel-container');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', stopCarousel);
            carouselContainer.addEventListener('mouseleave', startCarousel);
        }
    }
} 