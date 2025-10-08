// Dithered Wave Effect - Vanilla JS + Three.js
class DitherEffect {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.options = {
      waveSpeed: options.waveSpeed !== undefined ? options.waveSpeed : 0.03,
      waveFrequency: options.waveFrequency !== undefined ? options.waveFrequency : 10,
      waveAmplitude: options.waveAmplitude !== undefined ? options.waveAmplitude : 0,
      waveColor: options.waveColor || [0.5, 0.5, 0.5],
      colorIntensity: options.colorIntensity !== undefined ? options.colorIntensity : 8.2,
      colorNum: options.colorNum !== undefined ? options.colorNum : 4,
      pixelSize: options.pixelSize !== undefined ? options.pixelSize : 2,
      disableAnimation: options.disableAnimation || false,
      enableMouseInteraction: options.enableMouseInteraction !== undefined ? options.enableMouseInteraction : true,
      mouseRadius: options.mouseRadius !== undefined ? options.mouseRadius : 0.3
    };

    this.mouse = new THREE.Vector2(0, 0);
    this.init();
  }

  init() {
    // Setup scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(
          window.innerWidth * window.devicePixelRatio,
          window.innerHeight * window.devicePixelRatio
        )},
        waveSpeed: { value: this.options.waveSpeed },
        waveFrequency: { value: this.options.waveFrequency },
        waveAmplitude: { value: this.options.waveAmplitude },
        waveColor: { value: new THREE.Vector3(...this.options.waveColor) },
        colorIntensity: { value: this.options.colorIntensity },
        mousePos: { value: new THREE.Vector2(0, 0) },
        enableMouseInteraction: { value: this.options.enableMouseInteraction ? 1 : 0 },
        mouseRadius: { value: this.options.mouseRadius },
        colorNum: { value: this.options.colorNum },
        pixelSize: { value: this.options.pixelSize }
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      transparent: true
    });

    // Create plane
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    // Event listeners
    if (this.options.enableMouseInteraction) {
      document.addEventListener('mousemove', this.onMouseMove.bind(this));
    }
    window.addEventListener('resize', this.onResize.bind(this));

    // Start animation
    this.clock = new THREE.Clock();
    this.animate();
  }

  getVertexShader() {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  getFragmentShader() {
    return `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float waveSpeed;
      uniform float waveFrequency;
      uniform float waveAmplitude;
      uniform vec3 waveColor;
      uniform float colorIntensity;
      uniform vec2 mousePos;
      uniform int enableMouseInteraction;
      uniform float mouseRadius;
      uniform float colorNum;
      uniform float pixelSize;

      vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

      float cnoise(vec2 P) {
        vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
        vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
        Pi = mod289(Pi);
        vec4 ix = Pi.xzxz;
        vec4 iy = Pi.yyww;
        vec4 fx = Pf.xzxz;
        vec4 fy = Pf.yyww;
        vec4 i = permute(permute(ix) + iy);
        vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
        vec4 gy = abs(gx) - 0.5;
        vec4 tx = floor(gx + 0.5);
        gx = gx - tx;
        vec2 g00 = vec2(gx.x, gy.x);
        vec2 g10 = vec2(gx.y, gy.y);
        vec2 g01 = vec2(gx.z, gy.z);
        vec2 g11 = vec2(gx.w, gy.w);
        vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
        g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
        float n00 = dot(g00, vec2(fx.x, fy.x));
        float n10 = dot(g10, vec2(fx.y, fy.y));
        float n01 = dot(g01, vec2(fx.z, fy.z));
        float n11 = dot(g11, vec2(fx.w, fy.w));
        vec2 fade_xy = fade(Pf.xy);
        vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
        return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 1.0;
        float freq = waveFrequency;
        for (int i = 0; i < 4; i++) {
          value += amp * abs(cnoise(p));
          p *= freq;
          amp *= waveAmplitude;
        }
        return value;
      }

      float pattern(vec2 p) {
        vec2 p2 = p - time * waveSpeed;
        return fbm(p + fbm(p2)); 
      }

      vec3 dither(vec2 uv, vec3 color) {
        const float bayerMatrix8x8[64] = float[64](
          0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
          32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
          8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
          40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
          2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
          34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
          10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
          42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
        );
        
        vec2 scaledCoord = floor(uv * resolution / pixelSize);
        int x = int(mod(scaledCoord.x, 8.0));
        int y = int(mod(scaledCoord.y, 8.0));
        float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
        float step = 1.0 / (colorNum - 1.0);
        color += threshold * step;
        float bias = 0.2;
        color = clamp(color - bias, 0.0, 1.0);
        return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 centeredUv = uv - 0.5;
        centeredUv.x *= resolution.x / resolution.y;
        
        float f = pattern(centeredUv);
        
        if (enableMouseInteraction == 1) {
          vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
          mouseNDC.x *= resolution.x / resolution.y;
          float dist = length(centeredUv - mouseNDC);
          float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
          f -= 0.5 * effect;
        }
        
        // Apply color intensity - use brand color as background, white for waves
        vec3 col = mix(waveColor, vec3(1.0), f * colorIntensity);
        col = clamp(col, 0.0, 1.0);
        col = dither(gl_FragCoord.xy, col);
        
        // Vertical fade: fade from top (1.0) to bottom (0.0)
        // Start fading at 40% down the screen, fully transparent at 80%
        float fadeStart = 0.4;
        float fadeEnd = 0.8;
        float fade = 1.0 - smoothstep(fadeStart, fadeEnd, 1.0 - uv.y);
        
        gl_FragColor = vec4(col, fade);
      }
    `;
  }

  onMouseMove(event) {
    const x = event.clientX * window.devicePixelRatio;
    const y = event.clientY * window.devicePixelRatio;
    this.mouse.set(x, y);
    this.material.uniforms.mousePos.value.copy(this.mouse);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.renderer.setSize(width, height);
    this.material.uniforms.resolution.value.set(
      width * window.devicePixelRatio,
      height * window.devicePixelRatio
    );
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    if (!this.options.disableAnimation) {
      this.material.uniforms.time.value = this.clock.getElapsedTime();
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  updateOptions(newOptions) {
    Object.assign(this.options, newOptions);
    if (newOptions.waveSpeed !== undefined) this.material.uniforms.waveSpeed.value = newOptions.waveSpeed;
    if (newOptions.waveFrequency !== undefined) this.material.uniforms.waveFrequency.value = newOptions.waveFrequency;
    if (newOptions.waveAmplitude !== undefined) this.material.uniforms.waveAmplitude.value = newOptions.waveAmplitude;
    if (newOptions.waveColor !== undefined) this.material.uniforms.waveColor.value.set(...newOptions.waveColor);
    if (newOptions.colorIntensity !== undefined) this.material.uniforms.colorIntensity.value = newOptions.colorIntensity;
    if (newOptions.colorNum !== undefined) this.material.uniforms.colorNum.value = newOptions.colorNum;
    if (newOptions.pixelSize !== undefined) this.material.uniforms.pixelSize.value = newOptions.pixelSize;
    if (newOptions.mouseRadius !== undefined) this.material.uniforms.mouseRadius.value = newOptions.mouseRadius;
    if (newOptions.enableMouseInteraction !== undefined) {
      this.material.uniforms.enableMouseInteraction.value = newOptions.enableMouseInteraction ? 1 : 0;
    }
  }

  destroy() {
    window.removeEventListener('resize', this.onResize.bind(this));
    if (this.options.enableMouseInteraction) {
      document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    }
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}

// Make it globally available
window.DitherEffect = DitherEffect;

