// script.js
function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const overlay = document.getElementById('overlay');
    const body = document.body;

    // Replace 'your_password' with the correct password value
    if (passwordInput.value === 'ginger cat') {
        overlay.style.display = 'none';
        body.classList.remove('modal-open');
    } else {
        alert('Incorrect password. Please try again.');
        passwordInput.value = ''; // Clear the input field
    }
}

function openOverlay() {
    const overlay = document.getElementById('overlay');
    const body = document.body;

    overlay.style.display = 'flex';
    body.classList.add('modal-open');
}

function closeOverlay() {
    const overlay = document.getElementById('overlay');
    const body = document.body;

    overlay.style.display = 'none';
    body.classList.remove('modal-open');
}
