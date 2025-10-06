// Three.js implementation of rotating squares in a helix pattern
let scene, camera, renderer, group;
let isRotating = true;

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;
    camera.position.y = 5;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('helix-container').appendChild(renderer.domElement);

    // Create group for all squares
    group = new THREE.Group();

    // Parameters for helix
    const radius = 5;
    const turns = 1;
    const total = 5; // Number of squares
    const angleStep = (2 * Math.PI * turns) / total;
    const heightStep = 2;

    // Create squares
    for (let i = 0; i < total; i++) {
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xF5F5F5,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });

        const plane = new THREE.Mesh(geometry, material);
        
        // Position in helix
        const angle = i * angleStep;
        const y = i * heightStep - (total * heightStep / 2); // Center vertically
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);

        plane.position.set(x, y, z);
        plane.lookAt(0, y, 0); // Face center

        // Add red border
        const borderGeometry = new THREE.EdgesGeometry(geometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0xFF3B30 });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        plane.add(border);

        // Store original position for hover effect
        plane.userData.originalPosition = { x, y, z };
        plane.userData.index = i;

        group.add(plane);
    }

    scene.add(group);

    // Add hover interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(group.children);

        group.children.forEach(square => {
            if (square.material) {
                square.material.color.setHex(0xF5F5F5);
            }
        });

        if (intersects.length > 0) {
            const square = intersects[0].object;
            if (square.material) {
                square.material.color.setHex(0xE5E5E5);
                isRotating = false;
            }
        } else {
            isRotating = true;
        }
    });

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (isRotating) {
        group.rotation.y += 0.005;
    }

    renderer.render(scene, camera);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 