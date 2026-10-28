import * as THREE from '../../vendor/three.module.js';

/**
 * Bildnachbearbeitung im Stil eines alten Röhrenmonitors:
 * niedrige Auflösung, geordnetes Dithering, wenige Farbstufen, Scanlines.
 */

const BAYER_SIZE = 8;

function bayerTexture() {
  const matrix = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];

  const canvas = document.createElement('canvas');
  canvas.width = BAYER_SIZE;
  canvas.height = BAYER_SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(BAYER_SIZE, BAYER_SIZE);
  for (let i = 0; i < 64; i += 1) {
    const value = Math.round((matrix[i] / 63) * 255);
    image.data[i * 4 + 0] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
uniform sampler2D tDiffuse;
uniform sampler2D tBayer;
uniform vec2 uResolution;
uniform float uTime;
uniform float uLevels;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 color = texture2D(tDiffuse, uv).rgb;

  // Scanlines
  float scan = 0.92 + 0.08 * sin(uv.y * uResolution.y * 3.14159265);
  color *= scan;

  // Geordnetes Dithering + Farbstufen
  float threshold = texture2D(tBayer, gl_FragCoord.xy / 8.0).r - 0.5;
  color += threshold * (1.15 / uLevels);
  color = floor(color * uLevels + 0.5) / uLevels;

  // Vignette
  vec2 d = uv - 0.5;
  color *= 1.0 - dot(d, d) * 0.28;

  // Kalte Schatten, warme Lichter
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 cold = color * vec3(0.80, 0.90, 1.14);
  vec3 warm = color * vec3(1.10, 1.02, 0.90);
  color = mix(cold, warm, smoothstep(0.15, 0.75, luma));

  // Ganz leichte Körnung, damit nichts flächig wirkt
  float noise = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  color += (noise - 0.5) * 0.02;

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createPost(renderer, { height = 460, levels = 5 } = {}) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      tBayer: { value: bayerTexture() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uLevels: { value: levels },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize(width, heightPx) {
    const ratio = width / heightPx;
    const h = height;
    const w = Math.max(1, Math.round(h * ratio));
    target.setSize(w, h);
    material.uniforms.uResolution.value.set(w, h);
    renderer.setSize(width, heightPx, false);
  }

  function render(sceneToDraw, cameraToUse, time) {
    material.uniforms.uTime.value = time;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(sceneToDraw, cameraToUse);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  return { resize, render, target, material };
}
