import * as THREE from '../../vendor/three.module.js';
import { stoneFloorTexture, woodFloorTexture, checkerTexture, wallTexture, textTexture } from './textures.js';

export const colliders = [];

export function addCollider(x1, z1, x2, z2, tag = '') {
  const box = {
    x1: Math.min(x1, x2),
    x2: Math.max(x1, x2),
    z1: Math.min(z1, z2),
    z2: Math.max(z1, z2),
    tag,
  };
  colliders.push(box);
  return box;
}

function repeated(texture, x, y) {
  const tex = texture.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(x, y);
  tex.needsUpdate = true;
  return tex;
}

export function createMaterials() {
  const stone = stoneFloorTexture();
  const wood = woodFloorTexture();
  const woodLight = woodFloorTexture('#4a3218', '#2c1d0e');
  const checker = checkerTexture();
  const wall = wallTexture('#2b3a55');
  const wallWarm = wallTexture('#3a2c3e');
  const wallDark = wallTexture('#1c2433');

  const lambert = (options) => new THREE.MeshLambertMaterial(options);

  return {
    hallFloor: lambert({ map: repeated(stone, 5, 4), color: 0xffffff }),
    galleryFloor: lambert({ map: repeated(wood, 4, 4) }),
    libraryFloor: lambert({ map: repeated(woodLight, 5, 3) }),
    arcadeFloor: lambert({ map: repeated(checker, 4, 4) }),
    wall: lambert({ map: repeated(wall, 3, 2) }),
    wallWarm: lambert({ map: repeated(wallWarm, 3, 2) }),
    wallDark: lambert({ map: repeated(wallDark, 3, 2) }),
    ceiling: lambert({ color: 0x0a0e18 }),
    brass: lambert({ color: 0xd8a441, emissive: 0x2a1d06, emissiveIntensity: 1 }),
    brassDark: lambert({ color: 0x8a6a2a, emissive: 0x120c02, emissiveIntensity: 1 }),
    wood: lambert({ color: 0x3a2718 }),
    woodDark: lambert({ color: 0x1e140b }),
    paper: lambert({ color: 0xf1e8d4 }),
    ink: lambert({ color: 0x0a0d14 }),
    velvet: lambert({ color: 0x3a1220 }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x6ee7d7, toneMapped: false }),
    neon: new THREE.MeshBasicMaterial({ color: 0xff4d9d, toneMapped: false }),
    warm: new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }),
  };
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function cylinder(rTop, rBottom, h, segments, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function plane(w, h, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Wand zwischen zwei Punkten. Registriert automatisch einen Kollider.
 */
export function wall(parent, x1, z1, x2, z2, height, material, thickness = 0.26) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const mesh = box(length, height, thickness, material, (x1 + x2) / 2, height / 2, (z1 + z2) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.receiveShadow = true;
  parent.add(mesh);

  const half = thickness / 2 + 0.02;
  if (Math.abs(dx) > Math.abs(dz)) {
    addCollider(x1, z1 - half, x2, z1 + half);
  } else {
    addCollider(x1 - half, z1, x1 + half, z2);
  }
  return mesh;
}

/** Unbeleuchtete Schrift auf transparenter Fläche. */
export function label(text, { width = 4, color = '#f0c878', font, letterSpacing = 6, opacity = 1 } = {}) {
  const texture = textTexture(text, { width: 1024, height: 192, color, font, letterSpacing });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, (width * 192) / 1024),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  return mesh;
}

/** Punktlicht mit sichtbarer Deckenleuchte. */
export function lamp(parent, material, x, y, z, intensity = 1.2, distance = 14, color = 0xffc07a) {
  const light = new THREE.PointLight(color, intensity, distance, 1.6);
  light.position.set(x, y, z);
  parent.add(light);

  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.05, 14), material);
  shade.position.set(x, y, z);
  parent.add(shade);

  return light;
}

/** Steht der Punkt in einem der Kollider? */
export function blocked(x, z, radius = 0.34) {
  for (const c of colliders) {
    const cx = Math.max(c.x1, Math.min(x, c.x2));
    const cz = Math.max(c.z1, Math.min(z, c.z2));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/** Schiebt eine Position aus allen Kollidern heraus. */
export function resolve(position, radius = 0.34, list = colliders) {
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const c of list) {
      const cx = Math.max(c.x1, Math.min(position.x, c.x2));
      const cz = Math.max(c.z1, Math.min(position.z, c.z2));
      let dx = position.x - cx;
      let dz = position.z - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;

      if (d2 < 1e-6) {
        // Punkt liegt im Rechteck: zur nächsten Kante schieben
        const left = Math.abs(position.x - c.x1);
        const right = Math.abs(c.x2 - position.x);
        const back = Math.abs(position.z - c.z1);
        const front = Math.abs(c.z2 - position.z);
        const min = Math.min(left, right, back, front);
        if (min === left) position.x = c.x1 - radius;
        else if (min === right) position.x = c.x2 + radius;
        else if (min === back) position.z = c.z1 - radius;
        else position.z = c.z2 + radius;
      } else {
        const d = Math.sqrt(d2);
        position.x = cx + (dx / d) * radius;
        position.z = cz + (dz / d) * radius;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return position;
}
