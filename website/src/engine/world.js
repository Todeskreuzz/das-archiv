import * as THREE from '../../vendor/three.module.js';
import { box, cylinder, plane, wall, label, addCollider, lamp } from './builder.js';
import { createCurator } from './curator-npc.js';
import { plaqueTexture, glowTexture, consoleTexture, canvasTexture } from './textures.js';
import { byRoom } from '../data/seed.js';
import { propData } from '../data/props.js';
import { GRAFFITI_WALLS } from '../data/walls.js';

export const LAYOUT = {
  hall: { x1: -10, x2: 10, z1: -8, z2: 8, h: 9 },
  west: { x1: -22, x2: -10, z1: -6, z2: 6, h: 6.4 },
  east: { x1: 10, x2: 22, z1: -6, z2: 6, h: 6.4 },
  north: { x1: -10, x2: 10, z1: -18, z2: -8, h: 6.4 },
};

const GALLERY = byRoom('galerie');
const ARCADE = byRoom('spielhalle');
const LIBRARY = byRoom('bibliothek');

function rgbOf(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(',');
}

function floorAt(parent, mat, x1, x2, z1, z2, y = 0) {
  const mesh = plane(x2 - x1, z2 - z1, mat, (x1 + x2) / 2, y, (z1 + z2) / 2);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ceilingAt(parent, mat, x1, x2, z1, z2, y) {
  const mesh = plane(x2 - x1, z2 - z1, mat, (x1 + x2) / 2, y, (z1 + z2) / 2);
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

function shadowBlob(parent, x, z, radius, opacity = 0.45) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = plane(radius * 2, radius * 2, new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  }), x, 0.02, z);
  mesh.rotation.x = -Math.PI / 2;
  parent.add(mesh);
}

function posterMesh(texture, width, brightness = 1) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    color: new THREE.Color(brightness, brightness, brightness),
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width), material);
}

/* ================================================================== Welt */

export function createWorld({ materials, posterTextures, graffiti }) {
  const root = new THREE.Group();
  const interactables = [];

  const invisible = new THREE.MeshBasicMaterial({ visible: false });

  /** Unsichtbare Klickfläche für ein Möbelstück oder Bauteil. */
  function mark(parent, size, at, id, label) {
    const [w, h, d] = size;
    const [x, y, z] = at;
    // Etwas größer als das Objekt, damit man nicht pixelgenau zielen muss.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.6, d + 0.12), invisible);
    mesh.position.set(x, y + 0.3, z);
    const data = propData(id);
    mesh.userData.interact = { type: 'prop', id, label: label || data.title };
    interactables.push(mesh);
    parent.add(mesh);
    return mesh;
  }

  const H = LAYOUT.hall;
  const W = LAYOUT.west;
  const E = LAYOUT.east;
  const N = LAYOUT.north;

  /* ------------------------------------------------------------- Böden */

  floorAt(root, materials.hallFloor, H.x1, H.x2, H.z1, H.z2);
  floorAt(root, materials.galleryFloor, W.x1, W.x2, W.z1, W.z2);
  floorAt(root, materials.arcadeFloor, E.x1, E.x2, E.z1, E.z2);
  floorAt(root, materials.libraryFloor, N.x1, N.x2, N.z1, N.z2);

  // Teppichläufer vom Eingang zum Podest
  const runner = plane(2.6, 9.4, materials.velvet, 0, 0.015, 2.6);
  runner.rotation.x = -Math.PI / 2;
  root.add(runner);
  const runnerTrim = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 2.35, 48),
    new THREE.MeshBasicMaterial({ color: 0xd8a441, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  runnerTrim.rotation.x = -Math.PI / 2;
  runnerTrim.position.set(0, 0.02, 0);
  root.add(runnerTrim);

  /* ------------------------------------------------------------- Wände */

  // Halle Süd (Eingang)
  wall(root, H.x1, H.z2, -2.6, H.z2, H.h, materials.wall);
  wall(root, 2.6, H.z2, H.x2, H.z2, H.h, materials.wall);
  // Halle Nord (Bibliothek)
  wall(root, H.x1, H.z1, -3, H.z1, H.h, materials.wall);
  wall(root, 3, H.z1, H.x2, H.z1, H.h, materials.wall);
  // Halle West (Galerie)
  wall(root, H.x1, H.z1, H.x1, -3, H.h, materials.wall);
  wall(root, H.x1, 3, H.x1, H.z2, H.h, materials.wall);
  // Halle Ost (Spielhalle)
  wall(root, H.x2, H.z1, H.x2, -3, H.h, materials.wall);
  wall(root, H.x2, 3, H.x2, H.z2, H.h, materials.wall);

  // Stürze über den Durchgängen
  root.add(box(0.3, H.h - 5, 6, materials.wallDark, H.x1, 5 + (H.h - 5) / 2, 0));
  root.add(box(0.3, H.h - 5, 6, materials.wallDark, H.x2, 5 + (H.h - 5) / 2, 0));
  root.add(box(6, H.h - 5, 0.3, materials.wallDark, 0, 5 + (H.h - 5) / 2, H.z1));
  root.add(box(5.2, H.h - 4, 0.3, materials.wallDark, 0, 4 + (H.h - 4) / 2, H.z2));

  // Westraum
  wall(root, W.x1, W.z1, W.x1, W.z2, W.h, materials.wallWarm);
  wall(root, W.x1, W.z1, W.x2, W.z1, W.h, materials.wallWarm);
  wall(root, W.x1, W.z2, W.x2, W.z2, W.h, materials.wallWarm);

  // Ostraum
  wall(root, E.x1, E.z1, E.x2, E.z1, E.h, materials.wallDark);
  wall(root, E.x1, E.z2, E.x2, E.z2, E.h, materials.wallDark);
  wall(root, E.x2, E.z1, E.x2, E.z2, E.h, materials.wallDark);

  // Nordraum
  wall(root, N.x1, N.z1, 5, N.z1, N.h, materials.wallWarm);
  wall(root, 9, N.z1, N.x2, N.z1, N.h, materials.wallWarm);
  wall(root, N.x1, N.z1, N.x1, N.z2, N.h, materials.wallWarm);
  wall(root, N.x2, N.z1, N.x2, N.z2, N.h, materials.wallWarm);

  // Sturz über dem Tunnelzugang
  root.add(box(4, N.h - 2.6, 0.3, materials.wallDark, 7, 2.6 + (N.h - 2.6) / 2, N.z1));

  // Decken
  ceilingAt(root, materials.ceiling, H.x1, H.x2, H.z1, H.z2, H.h);
  ceilingAt(root, materials.ceiling, W.x1, W.x2, W.z1, W.z2, W.h);
  ceilingAt(root, materials.ceiling, E.x1, E.x2, E.z1, E.z2, E.h);
  ceilingAt(root, materials.ceiling, N.x1, N.x2, N.z1, N.z2, N.h);

  // Deckenbalken in der Halle
  for (let i = -3; i <= 3; i += 1) {
    root.add(box(20, 0.22, 0.28, materials.woodDark, 0, H.h - 0.2, i * 2.2));
  }

  /* ------------------------------------------------------------- Portal */

  const archTrim = (x, z, rotY) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5, 0.4), materials.brass);
    side.position.set(-3.05, 2.5, 0);
    g.add(side);
    const side2 = side.clone();
    side2.position.x = 3.05;
    g.add(side2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.16, 0.4), materials.brass);
    top.position.set(0, 5.02, 0);
    g.add(top);
    root.add(g);
  };

  archTrim(H.x1 + 0.05, 0, Math.PI / 2);
  archTrim(H.x2 - 0.05, 0, Math.PI / 2);
  archTrim(0, H.z1 + 0.05, 0);

  // Schilder über den Durchgängen
  const signGallery = label('GALERIE', { width: 3.4, letterSpacing: 12 });
  signGallery.position.set(H.x1 + 0.16, 6.3, 0);
  signGallery.rotation.y = Math.PI / 2;
  root.add(signGallery);

  const signArcade = label('SPIELHALLE', { width: 3.6, letterSpacing: 12, color: '#ff9ecb' });
  signArcade.position.set(H.x2 - 0.16, 6.3, 0);
  signArcade.rotation.y = -Math.PI / 2;
  root.add(signArcade);

  const signLibrary = label('BIBLIOTHEK', { width: 4, letterSpacing: 12 });
  signLibrary.position.set(0, 6.3, H.z1 + 0.16);
  root.add(signLibrary);

  const signEntrance = label('DAS ARCHIV', { width: 6.4, letterSpacing: 22, color: '#f0c878' });
  signEntrance.position.set(0, 6.5, H.z2 - 0.16);
  signEntrance.rotation.y = Math.PI;
  root.add(signEntrance);

  const signSub = label('DEUTSCHES INTERNET-MUSEUM', { width: 4.6, letterSpacing: 14, color: '#7f8aa3' });
  signSub.position.set(0, 5.85, H.z2 - 0.16);
  signSub.rotation.y = Math.PI;
  root.add(signSub);

  /* ------------------------------------------------------------- Eingang */

  const doorFrame = new THREE.Group();
  doorFrame.position.set(0, 0, H.z2 - 0.1);
  root.add(doorFrame);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x1a2233,
    roughness: 0.6,
    metalness: 0.3,
    emissive: 0x2a1a08,
    emissiveIntensity: 0.25,
  });
  const leftDoor = box(2.5, 4, 0.12, doorMat, -1.26, 2, 0);
  const rightDoor = box(2.5, 4, 0.12, doorMat, 1.26, 2, 0);
  doorFrame.add(leftDoor, rightDoor);
  doorFrame.add(box(5.2, 0.12, 0.16, materials.brass, 0, 4.02, 0));
  // Griffe
  for (const x of [-0.18, 0.18]) {
    doorFrame.add(cylinder(0.025, 0.025, 0.5, 8, materials.brass, x, 2.0, 0.12));
  }
  mark(root, [5.4, 4.2, 0.4], [0, 2, 7.85], 'tuer', 'Eingangstür');
  // warmes Licht hinter der Tür
  const doorGlow = plane(4.6, 3.6, new THREE.MeshBasicMaterial({
    color: 0xffb457,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), 0, 2, H.z2 + 0.02);
  doorGlow.rotation.y = Math.PI;
  root.add(doorGlow);

  // Fenster links und rechts
  for (const x of [-6.4, 6.4]) {
    const glass = plane(2.2, 3.4, new THREE.MeshBasicMaterial({
      color: 0x2a3f66,
      transparent: true,
      opacity: 0.75,
    }), x, 4, H.z2 - 0.16);
    glass.rotation.y = Math.PI;
    root.add(glass);
    const moon = plane(0.7, 0.7, new THREE.MeshBasicMaterial({
      color: 0xffe9b8,
      transparent: true,
      opacity: 0.85,
    }), x + 0.4, 4.8, H.z2 - 0.17);
    moon.rotation.y = Math.PI;
    root.add(moon);
    const bar = box(0.08, 3.4, 0.08, materials.ink, x, 4, H.z2 - 0.2);
    root.add(bar);
    mark(root, [2.3, 3.5, 0.25], [x, 4, H.z2 - 0.18], 'fenster', 'Fenster');
  }

  /* ------------------------------------------------------------- Licht */

  root.add(new THREE.AmbientLight(0x2a4468, 2.1));
  const hemi = new THREE.HemisphereLight(0x9ab8e4, 0x0d1016, 1.5);
  root.add(hemi);

  const key = new THREE.DirectionalLight(0x9fc0ff, 0.55);
  key.position.set(6, 14, 8);
  root.add(key);

  lamp(root, materials.warm, 0, 7.4, 3.2, 250, 30, 0xffd0a0);
  lamp(root, materials.warm, 0, 7.4, -3.2, 220, 30, 0xffd0a0);
  lamp(root, materials.warm, -15.5, 4.6, 0, 130, 20, 0xffd0a0);
  lamp(root, materials.neon, 18.5, 4.2, -2.5, 60, 14, 0xff6aa8);
  lamp(root, materials.neon, 18.5, 4.2, 2.5, 60, 14, 0xff6aa8);
  lamp(root, materials.warm, 0, 4.8, -13, 120, 20, 0xffd0a0);

  // Kühles Fülllicht in der Spielhalle
  const arcadeFill = new THREE.PointLight(0x8f7ad8, 150, 20, 1.4);
  arcadeFill.position.set(16, 4.8, 0);
  root.add(arcadeFill);

  const arcadeFill2 = new THREE.PointLight(0xff6aa8, 70, 12, 1.6);
  arcadeFill2.position.set(20.5, 2.6, 0);
  root.add(arcadeFill2);

  // Lichtkranz hinter dem Kurator
  const aura = new THREE.PointLight(0x6ee7d7, 40, 9, 2);
  aura.position.set(0, 2.1, -1.1);
  root.add(aura);

  // Fülllicht am Eingang
  const entryFill = new THREE.PointLight(0xffb457, 70, 14, 1.8);
  entryFill.position.set(0, 4.2, 6.4);
  root.add(entryFill);

  // Frontlicht für den Kurator
  const front = new THREE.PointLight(0xffe6c8, 55, 8, 1.8);
  front.position.set(0, 2.0, 2.2);
  root.add(front);

  // Wandleuchten in der Halle
  for (const [x, z, rotY] of [
    [-9.78, -4.5, Math.PI / 2],
    [-9.78, 4.5, Math.PI / 2],
    [9.78, -4.5, -Math.PI / 2],
    [9.78, 4.5, -Math.PI / 2],
  ]) {
    const sconce = new THREE.Group();
    sconce.position.set(x, 3.3, z);
    sconce.rotation.y = rotY;
    sconce.add(box(0.1, 0.34, 0.06, materials.brassDark, 0, 0, 0.03));
    sconce.add(cylinder(0.1, 0.14, 0.16, 12, materials.warm, 0, 0.18, 0.14));
    root.add(sconce);
  }

  // Kühles Gegenlicht, damit die Halle nicht ins Braune kippt
  const cool = new THREE.PointLight(0x4f7fc4, 90, 26, 1.5);
  cool.position.set(0, 8.2, 0);
  root.add(cool);

  /* ------------------------------------------------------------- Galerie */

  const gallerySpots = [
    // Fernwand
    { x: -21.86, z: -4.5, rot: Math.PI / 2 },
    { x: -21.86, z: -1.5, rot: Math.PI / 2 },
    { x: -21.86, z: 1.5, rot: Math.PI / 2 },
    { x: -21.86, z: 4.5, rot: Math.PI / 2 },
    // Nordwand
    { x: -20.2, z: -5.86, rot: 0 },
    { x: -17.4, z: -5.86, rot: 0 },
    { x: -14.6, z: -5.86, rot: 0 },
    { x: -11.8, z: -5.86, rot: 0 },
    // Südwand
    { x: -20.2, z: 5.86, rot: Math.PI },
    { x: -17.4, z: 5.86, rot: Math.PI },
    { x: -14.6, z: 5.86, rot: Math.PI },
    { x: -11.8, z: 5.86, rot: Math.PI },
  ];

  const glowMap = glowTexture('255,180,87');
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowMap,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  GALLERY.forEach((entry, index) => {
    const spot = gallerySpots[index];
    if (!spot) return;
    const texture = posterTextures.get(entry.id);
    const group = new THREE.Group();
    group.position.set(spot.x, 2.15, spot.z);
    group.rotation.y = spot.rot;
    root.add(group);

    // Lichtschein an der Wand
    const glow = plane(3.2, 3.2, glowMat, 0, 0, -0.015);
    group.add(glow);

    // Rahmen
    group.add(box(1.72, 1.72, 0.07, materials.brassDark, 0, 0, 0.03));
    group.add(box(1.58, 1.58, 0.08, materials.paper, 0, 0, 0.055));

    if (texture) {
      const art = posterMesh(texture, 1.42);
      art.position.z = 0.1;
      art.userData.interact = { type: 'exhibit', id: entry.id, label: entry.title };
      interactables.push(art);
      group.add(art);
    }

    // Schild
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.325),
      new THREE.MeshBasicMaterial({ map: plaqueTexture(entry.title, String(entry.year)), toneMapped: false }),
    );
    plaque.position.set(0, -1.06, 0.09);
    group.add(plaque);

    // Lampe über dem Bild
    const fixture = box(0.5, 0.08, 0.18, materials.warm, 0, 1.02, 0.16);
    group.add(fixture);

    shadowBlob(root, spot.x + Math.sin(spot.rot) * 0.6, spot.z + Math.cos(spot.rot) * 0.6, 0.9, 0.25);
  });

  // Sitzbank in der Galerie
  const bench = new THREE.Group();
  bench.position.set(-16, 0, 0);
  bench.rotation.y = Math.PI / 2;
  root.add(bench);
  bench.add(box(3.4, 0.16, 0.7, materials.wood, 0, 0.46, 0));
  bench.add(box(3.2, 0.08, 0.5, materials.velvet, 0, 0.56, 0));
  for (const x of [-1.4, 1.4]) bench.add(box(0.14, 0.46, 0.6, materials.woodDark, x, 0.23, 0));
  addCollider(-16.4, -1.8, -15.6, 1.8);
  shadowBlob(root, -16, 0, 1.8, 0.4);

  /* ------------------------------------------------------------- Spielhalle */

  const cabinetPositions = [
    { x: 21.3, z: -4.4, rot: -Math.PI / 2 },
    { x: 21.3, z: -2.2, rot: -Math.PI / 2 },
    { x: 21.3, z: 0, rot: -Math.PI / 2 },
    { x: 21.3, z: 2.2, rot: -Math.PI / 2 },
    { x: 21.3, z: 4.4, rot: -Math.PI / 2 },
    { x: 14.0, z: -5.3, rot: 0 },
    { x: 16.5, z: -5.3, rot: 0 },
    { x: 14.0, z: 5.3, rot: Math.PI },
    { x: 16.5, z: 5.3, rot: Math.PI },
  ];

  ARCADE.forEach((entry, index) => {
    const spot = cabinetPositions[index];
    if (!spot) return;
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = spot.rot;
    root.add(group);

    const accent = new THREE.Color(entry.accent || '#ff4d9d');
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: 0x3a3352,
      emissive: 0x0c0a16,
      emissiveIntensity: 1,
    });
    group.add(box(1.0, 1.95, 0.78, bodyMaterial, 0, 0.975, 0));

    // Lichtspur auf dem Boden
    const spill = plane(1.6, 1.6, new THREE.MeshBasicMaterial({
      map: glowTexture(rgbOf(entry.accent || '#ff4d9d')),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }), 0, 0.03, 0.85);
    spill.rotation.x = -Math.PI / 2;
    group.add(spill);

    // Marquee
    const marquee = box(0.92, 0.2, 0.06, new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.3,
      roughness: 0.5,
    }), 0, 1.78, 0.4);
    group.add(marquee);

    const title = label(entry.title.toUpperCase().slice(0, 18), { width: 0.82, color: '#05070c', letterSpacing: 4 });
    title.position.set(0, 1.83, 0.44);
    group.add(title);

    // Bildschirm
    group.add(box(0.72, 0.66, 0.04, materials.ink, 0, 1.36, 0.4));
    const texture = posterTextures.get(entry.id);
    if (texture) {
      const screen = posterMesh(texture, 0.62, 1.55);
      screen.position.set(0, 1.4, 0.425);
      screen.userData.interact = { type: 'exhibit', id: entry.id, label: entry.title };
      interactables.push(screen);
      group.add(screen);
    }

    // Bedienpult
    const deck = box(0.94, 0.12, 0.46, materials.woodDark, 0, 1.02, 0.3);
    deck.rotation.x = -0.22;
    group.add(deck);
    group.add(cylinder(0.03, 0.03, 0.16, 8, materials.brass, -0.22, 1.14, 0.32));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({
      color: 0xff6b6b, emissive: 0xff3333, emissiveIntensity: 1.2,
    })).translateX(0.16).translateY(1.14).translateZ(0.32));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({
      color: 0x7ee081, emissive: 0x33ff66, emissiveIntensity: 1.2,
    })).translateX(0.32).translateY(1.14).translateZ(0.32));

    const perpendicular = Math.abs(Math.sin(spot.rot)) > 0.5;
    const halfX = perpendicular ? 0.45 : 0.58;
    const halfZ = perpendicular ? 0.58 : 0.45;
    addCollider(spot.x - halfX, spot.z - halfZ, spot.x + halfX, spot.z + halfZ);
    shadowBlob(root, spot.x, spot.z, 0.9, 0.45);
    mark(group, [1.15, 2.05, 0.95], [0, 1.0, 0.05], 'automat', entry.title);
  });

  const neonSign = label('INSERT COIN', { width: 2.8, color: '#ff9ecb', letterSpacing: 14 });
  neonSign.position.set(21.4, 4.5, 0);
  neonSign.rotation.y = -Math.PI / 2;
  root.add(neonSign);

  shadowBlob(root, 16, 0, 3.5, 0.3);

  /* ------------------------------------------------------------- Bibliothek */

  function bookcase(x, z, rot, entries) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    root.add(group);

    const width = 4.8;
    const height = 3.4;
    const depth = 0.42;
    group.add(box(width, height, 0.08, materials.woodDark, 0, height / 2, -depth / 2));
    group.add(box(0.12, height, depth, materials.wood, -width / 2, height / 2, 0));
    group.add(box(0.12, height, depth, materials.wood, width / 2, height / 2, 0));
    for (let i = 0; i < 5; i += 1) {
      group.add(box(width, 0.08, depth, materials.wood, 0, 0.55 + i * 0.62, 0));
    }

    // Füllbände
    const filler = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      260,
    );
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let index = 0;
    for (let shelf = 0; shelf < 5; shelf += 1) {
      let cursor = -width / 2 + 0.22;
      while (cursor < width / 2 - 0.3 && index < 260) {
        const w = 0.07 + Math.random() * 0.09;
        const h = 0.3 + Math.random() * 0.15;
        if (entries.length && shelf === 2) {
          // Platz für die ausgestellten Bände lassen
          cursor += 0.98;
          continue;
        }
        matrix.makeScale(w, h, 0.28);
        matrix.setPosition(cursor + w / 2, 0.59 + shelf * 0.62 + h / 2, 0);
        filler.setMatrixAt(index, matrix);
        color.setHSL(Math.random(), 0.16 + Math.random() * 0.3, 0.18 + Math.random() * 0.22);
        filler.setColorAt(index, color);
        index += 1;
        cursor += w + 0.012;
      }
    }
    filler.count = index;
    filler.instanceMatrix.needsUpdate = true;
    if (filler.instanceColor) filler.instanceColor.needsUpdate = true;
    group.add(filler);

    // Ausgestellte Bände
    entries.forEach((entry, i) => {
      const bookX = -width / 2 + 0.62 + i * 0.98;
      const book = box(0.42, 0.86, 0.3, new THREE.MeshStandardMaterial({
        color: new THREE.Color(entry.accent || '#d8a441').multiplyScalar(0.85),
        roughness: 0.75,
        emissive: new THREE.Color(entry.accent || '#d8a441').multiplyScalar(0.14),
        emissiveIntensity: 1.1,
      }), bookX, 1.86, 0.02);
      book.userData.interact = { type: 'exhibit', id: entry.id, label: entry.title };
      interactables.push(book);
      group.add(book);

      const band = box(0.44, 0.06, 0.32, materials.brass, bookX, 2.18, 0.02);
      group.add(band);

      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.155),
        new THREE.MeshBasicMaterial({ map: plaqueTexture(entry.title, String(entry.year)), toneMapped: false }),
      );
      plaque.position.set(bookX, 1.36, 0.22);
      group.add(plaque);
    });

    mark(group, [width, 2.6, 0.95], [0, 1.75, 0.1], 'regal', 'Regal');

    return group;
  }

  bookcase(-7.6, -17.7, 0, LIBRARY.slice(0, 6));
  bookcase(-2.4, -17.7, 0, LIBRARY.slice(6, 12));
  bookcase(2.4, -17.7, 0, LIBRARY.slice(12, 17));
  bookcase(-9.7, -13, Math.PI / 2, []);
  bookcase(9.7, -13, -Math.PI / 2, []);

  addCollider(-9.2, -18, 4.9, -17.2);

  // Lesetisch
  const table = new THREE.Group();
  table.position.set(0, 0, -12.4);
  root.add(table);
  table.add(box(3.6, 0.1, 1.3, materials.wood, 0, 0.78, 0));
  for (const x of [-1.55, 1.55]) {
    for (const z of [-0.45, 0.45]) table.add(box(0.12, 0.78, 0.12, materials.woodDark, x, 0.39, z));
  }
  for (const x of [-1.1, 1.1]) {
    table.add(cylinder(0.03, 0.05, 0.42, 8, materials.brassDark, x, 1.04, 0));
    table.add(cylinder(0.16, 0.1, 0.18, 12, materials.warm, x, 1.3, 0));
  }
  const bookStack = [];
  for (let i = 0; i < 4; i += 1) {
    bookStack.push(box(0.34, 0.05, 0.24, materials.paper, 0.1 + i * 0.02, 0.86 + i * 0.05, 0.3));
  }
  table.add(...bookStack);
  addCollider(-1.9, -13.1, 1.9, -11.7);
  shadowBlob(root, 0, -12.4, 2.4, 0.4);
  mark(table, [3.7, 1.5, 1.4], [0, 0.75, 0], 'lesetisch', 'Lesetisch');

  /* ------------------------------------------------------------- Auditorium */

  // Podest
  const dais = cylinder(2.1, 2.25, 0.18, 64, materials.brassDark, 0, 0.09, 0);
  root.add(dais);
  const daisTop = cylinder(2.05, 2.05, 0.04, 64, new THREE.MeshStandardMaterial({
    color: 0x0c1420, roughness: 0.5, metalness: 0.3,
  }), 0, 0.2, 0);
  root.add(daisTop);
  const daisRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.16, 0.03, 8, 96),
    materials.brass,
  );
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = 0.19;
  root.add(daisRing);
  addCollider(-2.3, -2.3, 2.3, 2.3, 'dais');

  const curator = createCurator(materials);
  curator.root.position.set(0, 0.22, 0);
  root.add(curator.root);
  curator.root.userData.interact = { type: 'curator', label: 'Mit dem Kurator sprechen' };

  // Klickfläche für den Kurator
  const curatorHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.52, 2.3, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  curatorHit.position.set(0, 1.2, 0);
  curatorHit.userData.interact = { type: 'curator', label: 'Mit dem Kurator sprechen' };
  curator.root.add(curatorHit);
  interactables.push(curatorHit);

  // Stelen für Abstimmung und Einreichung
  function consoleAt(x, z, accentHex, titleText, subtitleText, type) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    root.add(group);

    group.add(box(1.12, 0.95, 0.58, materials.ink, 0, 0.475, 0));
    group.add(box(1.18, 0.06, 0.64, materials.brass, 0, 0.98, 0));
    group.add(box(1.0, 0.16, 0.02, materials.brassDark, 0, 0.7, 0.3));

    // Gehäuse und Bildschirm, leicht nach hinten geneigt
    const head = new THREE.Group();
    head.position.set(0, 1.32, 0.02);
    head.rotation.x = -0.34;
    group.add(head);
    head.add(box(1.02, 0.66, 0.07, materials.brassDark, 0, 0, 0));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.94, 0.58),
      new THREE.MeshBasicMaterial({
        map: consoleTexture(titleText, subtitleText, accentHex),
        toneMapped: false,
      }),
    );
    screen.position.z = 0.04;
    screen.userData.interact = { type, label: titleText };
    interactables.push(screen);
    head.add(screen);

    // Schild auf dem Sockel
    const title = label(titleText, { width: 0.9, color: '#f3ecdb', letterSpacing: 5 });
    title.position.set(0, 0.7, 0.315);
    group.add(title);

    const sub = label(subtitleText, { width: 0.86, color: accentHex, letterSpacing: 3 });
    sub.position.set(0, 0.55, 0.315);
    group.add(sub);

    addCollider(x - 0.6, z - 0.34, x + 0.6, z + 0.34);
    shadowBlob(root, x, z, 1.1, 0.35);

    // Großzügige Klickfläche, damit man nicht pixelgenau zielen muss
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.9, 0.8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(0, 0.95, 0.1);
    hit.userData.interact = { type, label: titleText };
    interactables.push(hit);
    group.add(hit);

    return group;
  }

  consoleAt(5.0, 0.7, '#6ee7d7', 'GREMIUM', 'Abstimmung', 'ballot');
  consoleAt(-5.0, 0.7, '#f0c878', 'EINREICHUNG', 'Fund vorlegen', 'submit');

  // Bänke — sechs Latten auf einem Gestell
  for (const x of [-4.2, 4.2]) {
    const b = new THREE.Group();
    b.position.set(x, 0, -6.2);
    root.add(b);

    for (let i = 0; i < 6; i += 1) {
      b.add(box(2.4, 0.045, 0.088, materials.wood, 0, 0.46, -0.27 + i * 0.108));
    }
    b.add(box(2.3, 0.07, 0.62, materials.woodDark, 0, 0.4, 0));
    for (const bx of [-0.95, 0.95]) {
      for (const bz of [-0.24, 0.24]) {
        b.add(box(0.09, 0.4, 0.09, materials.brassDark, bx, 0.2, bz));
      }
    }
    b.add(box(0.05, 0.02, 0.62, materials.brass, -1.16, 0.48, 0));
    b.add(box(0.05, 0.02, 0.62, materials.brass, 1.16, 0.48, 0));

    addCollider(x - 1.2, -6.5, x + 1.2, -5.9);
    mark(b, [2.5, 0.6, 0.75], [0, 0.3, 0], 'bank', 'Sitzbank');
  }

  // Pflanzen
  for (const [x, z] of [[-8.8, 6.9], [8.8, 6.9]]) {
    const plant = new THREE.Group();
    plant.position.set(x, 0, z);
    root.add(plant);

    plant.add(cylinder(0.3, 0.22, 0.46, 14, materials.woodDark, 0, 0.23, 0));
    plant.add(cylinder(0.32, 0.32, 0.04, 14, materials.brass, 0, 0.46, 0));
    plant.add(cylinder(0.27, 0.27, 0.03, 14, new THREE.MeshLambertMaterial({ color: 0x2a1d12 }), 0, 0.48, 0));
    plant.add(cylinder(0.035, 0.05, 0.85, 6, materials.woodDark, 0, 0.9, 0));

    const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2f5a3a, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.62), leafMaterial);
      leaf.position.set(Math.cos(angle) * 0.16, 1.16 + (i % 3) * 0.09, Math.sin(angle) * 0.16);
      leaf.rotation.y = angle;
      leaf.rotation.x = -0.42 + (i % 2) * 0.12;
      leaf.rotation.z = Math.cos(angle) * 0.18;
      plant.add(leaf);
    }

    addCollider(x - 0.32, z - 0.32, x + 0.32, z + 0.32);
    mark(plant, [0.7, 1.7, 0.7], [0, 0.85, 0], 'pflanze', 'Topfpflanze');
  }

  // Absperrseile um das Podest
  const posts = [[-3.4, -2.6], [3.4, -2.6], [3.4, 3.4], [-3.4, 3.4]];
  const ropeMaterial = new THREE.MeshLambertMaterial({ color: 0x6e1f27 });
  posts.forEach(([x, z], i) => {
    root.add(cylinder(0.15, 0.17, 0.035, 14, materials.brassDark, x, 0.018, z));
    root.add(cylinder(0.026, 0.032, 0.92, 10, materials.brass, x, 0.48, z));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), materials.brass);
    knob.position.set(x, 0.96, z);
    root.add(knob);

    const next = posts[(i + 1) % posts.length];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.9, z),
      new THREE.Vector3((x + next[0]) / 2, 0.76, (z + next[1]) / 2),
      new THREE.Vector3(next[0], 0.9, next[1]),
    ]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.014, 6, false), ropeMaterial));
  });
  mark(root, [0.5, 1.0, 0.5], [-3.4, 0.5, -2.6], 'absperrung', 'Absperrstange');

  // Kronleuchter
  const chandelier = new THREE.Group();
  chandelier.position.set(0, 8.05, 0);
  root.add(chandelier);

  chandelier.add(cylinder(0.02, 0.02, 0.95, 6, materials.brassDark, 0, 0.52, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 40), materials.brass);
  ring.rotation.x = Math.PI / 2;
  chandelier.add(ring);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const px = Math.cos(angle) * 1.15;
    const pz = Math.sin(angle) * 1.15;
    chandelier.add(cylinder(0.018, 0.02, 0.22, 6, materials.brass, px, 0.12, pz));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), materials.warm);
    bulb.position.set(px, -0.02, pz);
    chandelier.add(bulb);
  }
  mark(chandelier, [2.5, 0.6, 2.5], [0, 0.1, 0], 'kronleuchter', 'Kronleuchter');

  // Podest anfassbar — als Ring, damit der Kurator in der Mitte frei bleibt
  for (const [x, z, w, d] of [
    [0, 2.05, 3.6, 0.5],
    [0, -2.05, 3.6, 0.5],
    [2.05, 0, 0.5, 3.6],
    [-2.05, 0, 0.5, 3.6],
  ]) {
    mark(root, [w, 0.3, d], [x, 0.1, z], 'dais', 'Podest');
  }

  /* ------------------------------------------------------------- Tunnel */

  const T = { x1: 5, x2: 9, z1: -27, z2: -18, h: 3.1 };
  const V = { x1: 1, x2: 13, z1: -34, z2: -27, h: 4.2 };

  floorAt(root, materials.hallFloor, T.x1, T.x2, T.z1, T.z2);
  floorAt(root, materials.hallFloor, V.x1, V.x2, V.z1, V.z2);

  wall(root, T.x1, T.z2, T.x1, T.z1, T.h, materials.wall);
  wall(root, T.x2, T.z2, T.x2, T.z1, T.h, materials.wall);
  wall(root, V.x1, V.z2, T.x1, V.z2, V.h, materials.wall);
  wall(root, T.x2, V.z2, V.x2, V.z2, V.h, materials.wall);
  wall(root, V.x1, V.z1, V.x1, V.z2, V.h, materials.wall);
  wall(root, V.x2, V.z1, V.x2, V.z2, V.h, materials.wall);
  wall(root, V.x1, V.z1, V.x2, V.z1, V.h, materials.wall);

  ceilingAt(root, materials.ceiling, T.x1, T.x2, T.z1, T.z2, T.h);
  ceilingAt(root, materials.ceiling, V.x1, V.x2, V.z1, V.z2, V.h);
  root.add(box(4, V.h - T.h, 0.3, materials.wallDark, 7, T.h + (V.h - T.h) / 2, V.z2));

  // Stahltür, offen stehend
  const steelDoor = box(2.2, 2.5, 0.09, materials.ink, 0, 0, 0);
  steelDoor.position.set(8.7, 1.25, -17.75);
  steelDoor.rotation.y = 1.15;
  root.add(steelDoor);
  root.add(box(0.06, 0.5, 0.06, materials.brass, 0, 0, 0).translateX(8.3).translateY(1.3).translateZ(-17.95));
  mark(root, [2.3, 2.6, 0.4], [8.2, 1.25, -17.85], 'tunnel_tuer', 'Stahltür');

  const tunnelSign = label('VERBINDUNG', { width: 2.2, color: '#6ee7d7', letterSpacing: 12 });
  tunnelSign.position.set(7, 3.4, N.z1 + 0.18);
  root.add(tunnelSign);

  // Kabeltrassen
  for (const x of [5.55, 8.45]) {
    root.add(box(0.44, 0.04, 8.6, materials.ink, x, 2.86, -22.5));
    for (let i = 0; i < 4; i += 1) {
      const cable = cylinder(0.022, 0.022, 8.4, 6, i % 2 ? materials.woodDark : materials.ink, x - 0.15 + i * 0.1, 2.82, -22.5);
      cable.rotation.x = Math.PI / 2;
      root.add(cable);
    }
  }
  mark(root, [0.55, 0.25, 8.4], [8.45, 2.84, -22.5], 'kabel', 'Kabelkanal');

  // Rohre an der Ostwand
  for (const [y, r] of [[2.3, 0.05], [2.1, 0.035]]) {
    const pipe = cylinder(r, r, 8.4, 8, materials.ink, 8.78, y, -22.5);
    pipe.rotation.x = Math.PI / 2;
    root.add(pipe);
  }
  mark(root, [0.3, 0.5, 8.4], [8.8, 2.2, -22.5], 'rohr', 'Leitungsrohr');

  // Neonröhren
  for (const z of [-19.6, -22.4, -25.2]) {
    root.add(box(1.8, 0.05, 0.14, materials.cyan, 7, 3.02, z));
    const tubeLight = new THREE.PointLight(0x9fe8dd, 55, 11, 1.6);
    tubeLight.position.set(7, 2.9, z);
    root.add(tubeLight);
  }

  const tunnelFill = new THREE.PointLight(0xffd9b0, 40, 14, 1.6);
  tunnelFill.position.set(6.2, 2.2, -21.2);
  root.add(tunnelFill);

  // Wandleuchten
  for (const z of [-20.6, -23.6]) {
    root.add(box(0.16, 0.3, 0.06, materials.brassDark, 5.16, 2.1, z));
    root.add(box(0.08, 0.16, 0.08, materials.warm, 5.25, 2.12, z));
  }

  // Schachtluke
  const hatch = cylinder(0.55, 0.55, 0.04, 20, materials.ink, 3.6, 0.03, -31.4);
  root.add(hatch);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 20), materials.brass);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(3.6, 0.14, -31.4);
  root.add(wheel);
  mark(root, [1.2, 0.3, 1.2], [3.6, 0.1, -31.4], 'luke', 'Bodenluke');

  // Serverracks
  for (const [x, z] of [[11.4, -30.6], [11.4, -32.4]]) {
    const rack = new THREE.Group();
    rack.position.set(x, 0, z);
    root.add(rack);
    rack.add(box(1.1, 2.2, 0.9, new THREE.MeshLambertMaterial({ color: 0x2b3346 }), 0, 1.1, 0));
    rack.add(box(0.9, 1.9, 0.05, materials.wallDark, -0.55, 1.1, 0));
    for (let i = 0; i < 10; i += 1) {
      const led = box(0.06, 0.02, 0.02, i % 3 ? materials.cyan : materials.warm, -0.51, 0.4 + i * 0.16, 0.28);
      rack.add(led);
    }
    addCollider(x - 0.6, z - 0.5, x + 0.6, z + 0.5);
    mark(rack, [1.2, 2.3, 1.0], [0, 1.1, 0], 'server', 'Serverrack');
  }

  const rackLight = new THREE.PointLight(0x8fb8ff, 30, 8, 1.7);
  rackLight.position.set(10.4, 2.4, -31.4);
  root.add(rackLight);

  // Verbindungskern
  const core = new THREE.Group();
  core.position.set(4.4, 0, -30.2);
  root.add(core);
  core.add(cylinder(0.62, 0.7, 0.16, 24, materials.ink, 0, 0.08, 0));
  const coreColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 2.3, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x6ee7d7,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  coreColumn.position.y = 1.25;
  core.add(coreColumn);
  const coreInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8),
    new THREE.MeshBasicMaterial({ color: 0xd8fff8 }),
  );
  coreInner.position.y = 1.25;
  core.add(coreInner);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.016, 8, 32), materials.cyan);
  coreRing.rotation.x = Math.PI / 2;
  coreRing.position.y = 1.0;
  core.add(coreRing);
  const coreRing2 = coreRing.clone();
  coreRing2.scale.setScalar(0.72);
  coreRing2.position.y = 1.9;
  core.add(coreRing2);
  const coreLight = new THREE.PointLight(0x9ff0e4, 30, 9, 1.7);
  coreLight.position.set(0, 1.5, 0);
  core.add(coreLight);
  addCollider(3.7, -30.9, 5.1, -29.5);
  mark(core, [1.4, 2.4, 1.4], [0, 1.2, 0], 'prozessor', 'Verbindungskern');

  const vaultLight = new THREE.PointLight(0x8fb8ff, 110, 20, 1.4);
  vaultLight.position.set(6, 3.8, -30);
  root.add(vaultLight);

  // Terminal am Ende des Tunnels
  function linkTexture(main, sub, color) {
    return canvasTexture(
      (ctx, w, h) => {
        ctx.fillStyle = '#04070c';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.strokeRect(14, 14, w - 28, h - 28);
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.font = '700 92px "Cascadia Mono", Consolas, monospace';
        ctx.fillText(main, w / 2, h / 2 - 4);
        ctx.font = '24px "Cascadia Mono", Consolas, monospace';
        ctx.fillStyle = '#8b96ae';
        ctx.fillText(sub, w / 2, h / 2 + 58);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      },
      768,
      384,
    );
  }

  const linkTextures = {
    live: linkTexture('LIVE', 'VERBINDUNG STEHT', '#6ee7d7'),
    local: linkTexture('LOKAL', 'OHNE SCHLUESSEL', '#ffcf6a'),
    offline: linkTexture('OFFLINE', 'KEINE LEITUNG', '#ff5a4a'),
  };

  const terminalGroup = new THREE.Group();
  terminalGroup.position.set(7, 0, -33.6);
  root.add(terminalGroup);
  terminalGroup.add(box(2.9, 2.6, 0.5, materials.ink, 0, 1.3, 0));
  terminalGroup.add(box(3.0, 0.08, 0.56, materials.brass, 0, 2.62, 0));
  const linkScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 1.25),
    new THREE.MeshBasicMaterial({ map: linkTextures.local, toneMapped: false }),
  );
  linkScreen.position.set(0, 1.7, 0.27);
  linkScreen.userData.interact = { type: 'prop', id: 'verbindungsterminal', label: 'Verbindungsterminal' };
  interactables.push(linkScreen);
  terminalGroup.add(linkScreen);
  addCollider(5.5, -33.9, 8.5, -33.3);
  mark(terminalGroup, [3.0, 2.7, 0.6], [0, 1.35, 0], 'verbindungsterminal', 'Verbindungsterminal');

  const terminalLight = new THREE.PointLight(0x6ee7d7, 45, 8, 1.6);
  terminalLight.position.set(7, 2.3, -32.6);
  root.add(terminalLight);

  /* ------------------------------------------------------- Beschreibbare Wände */

  for (const wall of GRAFFITI_WALLS) {
    const group = new THREE.Group();
    group.position.set(wall.x, 1.75, wall.z);
    group.rotation.y = wall.rot;
    root.add(group);

    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(wall.w, wall.h),
      new THREE.MeshBasicMaterial({
        map: graffiti.textureFor(wall.id),
        transparent: true,
        depthWrite: false,
      }),
    );
    art.position.z = 0.016;
    group.add(art);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(wall.w + 0.4, wall.h + 0.4, 0.45), invisible);
    hit.position.z = 0.1;
    hit.userData.interact = { type: 'wall', id: wall.id, label: 'Wand beschreiben' };
    interactables.push(hit);
    group.add(hit);
  }

  /* ------------------------------------------------------------- Animation */

  let linkMode = 'local';
  let clock = 0;

  function setLinkMode(next) {
    if (!linkTextures[next]) return;
    linkMode = next;
    linkScreen.material.map = linkTextures[next];
    linkScreen.material.needsUpdate = true;
    const color = next === 'live' ? 0x6ee7d7 : next === 'local' ? 0xffcf6a : 0xff5a4a;
    coreLight.color.set(color);
    terminalLight.color.set(color);
  }

  function update(dt, focusPoint) {
    clock += dt;
    curator.update(dt, focusPoint);

    coreRing.scale.setScalar(1 + Math.sin(clock * 1.4) * 0.04);
    coreRing2.scale.setScalar(0.75 + Math.sin(clock * 1.9 + 1) * 0.05);
    coreInner.material.opacity = 0.72 + Math.sin(clock * 3.1) * 0.18;
    coreColumn.material.opacity = 0.22 + Math.sin(clock * 1.2) * 0.07;
    coreLight.intensity = linkMode === 'live' ? 55 + Math.sin(clock * 4) * 10 : 32;
  }

  return { root, interactables, curator, update, setLinkMode };
}
