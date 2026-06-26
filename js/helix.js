// Cursor animation only - removed THREE.js helix code

// Cursor animation
function initCursorAnimation() {
    const cursorContainer = document.querySelector('.cursor-container');
    if (!cursorContainer) {
        return;
    }

    let animationTimeout;

    function pinCurrentCursorPosition() {
        const header = cursorContainer.closest('header');
        if (!header) {
            return false;
        }

        const headerRect = header.getBoundingClientRect();
        const cursorRect = cursorContainer.getBoundingClientRect();
        cursorContainer.classList.remove('animated');
        cursorContainer.style.top = (cursorRect.top - headerRect.top) + 'px';
        cursorContainer.style.left = (cursorRect.left - headerRect.left) + 'px';
        cursorContainer.style.right = 'auto';
        return true;
    }

    function moveCursor() {
        const header = cursorContainer.closest('header');
        if (!header) {
            return;
        }

        const headerWidth = header.clientWidth;
        const headerHeight = header.clientHeight;
        const cursorWidth = cursorContainer.offsetWidth || 150;
        const cursorHeight = cursorContainer.offsetHeight || 44;
        const minTop = 8;
        const maxTop = Math.max(minTop, headerHeight - cursorHeight - 8);
        const minLeft = 4;
        const maxLeft = Math.max(minLeft, headerWidth - cursorWidth - 4);
        const validTopRange = Math.max(0, maxTop - minTop);
        const validLeftRange = Math.max(0, maxLeft - minLeft);
        const targetTop = validTopRange > 0 ? Math.random() * validTopRange + minTop : minTop;
        const targetLeft = validLeftRange > 0 ? Math.random() * validLeftRange + minLeft : minLeft;

        cursorContainer.style.top = targetTop + 'px';
        cursorContainer.style.left = targetLeft + 'px';
        cursorContainer.style.right = 'auto';

        const nextDelay = Math.random() * 10000;
        animationTimeout = setTimeout(moveCursor, nextDelay);
    }

    if (pinCurrentCursorPosition()) {
        requestAnimationFrame(() => {
            cursorContainer.classList.add('animated');
            animationTimeout = setTimeout(moveCursor, 1000);
        });
    }

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

// Store reference to case studies content
let caseStudiesElement = null;

// Content toggle functionality
function switchContent(contentType) {
    const experimentsContent = document.getElementById('experiments-content');
    const toggleButtons = document.querySelectorAll('.toggle-option');
    
    // Remove active class from all buttons
    toggleButtons.forEach(button => button.classList.remove('active'));
    
    // Show/hide content based on selection
    if (contentType === 'case-studies') {
        // Restore case studies content if it was removed
        if (!caseStudiesElement || !caseStudiesElement.parentNode) {
            const main = document.querySelector('main');
            const experimentsContent = document.getElementById('experiments-content');
            if (!caseStudiesElement) {
                caseStudiesElement = document.getElementById('case-studies-content');
            }
            main.insertBefore(caseStudiesElement, experimentsContent);
        }
        caseStudiesElement.style.display = 'block';
        caseStudiesElement.classList.remove('hidden');
        experimentsContent.style.display = 'none';
        experimentsContent.classList.add('hidden');
        // Add active class to case studies button
        document.querySelector('.toggle-option[onclick="switchContent(\'case-studies\')"]').classList.add('active');
    } else if (contentType === 'experiments') {
        // Remove case studies content from DOM completely
        if (!caseStudiesElement) {
            caseStudiesElement = document.getElementById('case-studies-content');
        }
        if (caseStudiesElement && caseStudiesElement.parentNode) {
            caseStudiesElement.remove();
        }
        caseStudiesElement.style.display = 'none';
        caseStudiesElement.classList.add('hidden');
        experimentsContent.style.display = 'block';
        experimentsContent.classList.remove('hidden');
        // Add active class to experiments button
        document.querySelector('.toggle-option[onclick="switchContent(\'experiments\')"]').classList.add('active');
    }
}

// Make switchContent globally available
window.switchContent = switchContent;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initCursorAnimation();
    initCaseStudiesToggle();
    initSideProjectsToggle();
    initCarousel();
    initDitherEffect();
});

function initExpandableSection(sectionSelector, toggleSelector) {
    const section = document.querySelector(sectionSelector);
    const toggle = document.querySelector(toggleSelector);
    const collapseDuration = 220;
    let collapseTimeout;

    if (!section || !toggle) {
        return;
    }

    function updateLabel(isExpanded) {
        toggle.textContent = isExpanded ? 'Less' : 'More';
        toggle.setAttribute('aria-expanded', String(isExpanded));
    }

    updateLabel(section.classList.contains('is-expanded'));

    toggle.addEventListener('click', () => {
        const isExpanded = section.classList.contains('is-expanded');
        clearTimeout(collapseTimeout);

        if (isExpanded) {
            section.classList.add('is-collapsing');
            updateLabel(false);
            collapseTimeout = setTimeout(() => {
                section.classList.remove('is-expanded', 'is-collapsing');
            }, collapseDuration);
            return;
        }

        section.classList.remove('is-collapsing');
        section.classList.add('is-expanded');
        updateLabel(true);
    });
}

function initCaseStudiesToggle() {
    initExpandableSection('.case-studies-section', '.case-studies-toggle');
}

function initSideProjectsToggle() {
    initExpandableSection('.side-projects-section', '.side-projects-toggle');
}

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
