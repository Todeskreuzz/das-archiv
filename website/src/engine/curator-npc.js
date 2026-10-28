import * as THREE from '../../vendor/three.module.js';
import { faceTexture, coatTexture, plateTexture, glowTexture } from './textures.js';

/**
 * Der Kurator — mein Avatar.
 *
 * Ein langer Mantel aus Punktmatrix-Stoff, der unten in Papierbahnen ausfranst.
 * Statt eines Gesichts ein Bildschirm mit einem grob gerasterten Porträt,
 * das alle paar Sekunden die Miene wechselt. In der rechten Hand ein Stempel.
 */
export function createCurator(materials) {
  const root = new THREE.Group();
  root.name = 'kurator';

  const hover = new THREE.Group();
  root.add(hover);

  /* ------------------------------------------------------------ Materialien */

  const cloth = new THREE.MeshLambertMaterial({
    map: coatTexture(),
    side: THREE.DoubleSide,
    color: 0xd8e0ee,
    emissive: 0x121a26,
    emissiveIntensity: 1,
  });
  cloth.map.repeat.set(3, 2);
  cloth.map.wrapS = THREE.RepeatWrapping;
  cloth.map.wrapT = THREE.RepeatWrapping;

  const inner = new THREE.MeshLambertMaterial({ color: 0x05070c });
  const paper = new THREE.MeshLambertMaterial({ color: 0xd9d2bf, side: THREE.DoubleSide });
  const brass = new THREE.MeshLambertMaterial({ color: 0xd8a441, emissive: 0x2a1d06, emissiveIntensity: 1 });
  const ink = new THREE.MeshLambertMaterial({ color: 0x0a0e16 });

  /* ------------------------------------------------------------------ Mantel */

  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.52, 1.55, 16, 1, true), cloth);
  coat.position.y = 0.78;
  hover.add(coat);

  const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 1.55, 16, 1, true), inner);
  lining.position.y = 0.78;
  hover.add(lining);

  // Ausgefranste Papierbahnen am Saum
  const sheets = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.32), paper);
    sheet.position.set(Math.sin(angle) * 0.55, 0.13, Math.cos(angle) * 0.55);
    sheet.rotation.y = angle;
    sheet.rotation.x = -0.12;
    hover.add(sheet);
    sheets.push(sheet);
  }

  // Gürtel
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.018, 6, 28), brass);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.04;
  hover.add(belt);

  // Kragen
  for (const side of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.06), paper);
    collar.position.set(side * 0.11, 1.52, 0.1);
    collar.rotation.z = side * -0.32;
    collar.rotation.x = -0.18;
    hover.add(collar);
  }

  const shoulders = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 24), brass);
  shoulders.rotation.x = Math.PI / 2;
  shoulders.position.y = 1.5;
  hover.add(shoulders);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 10), brass);
  neck.position.y = 1.6;
  hover.add(neck);

  /* -------------------------------------------------------------------- Kopf */

  const head = new THREE.Group();
  head.position.y = 1.84;
  head.scale.setScalar(1.22);
  hover.add(head);

  const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.2), brass);
  head.add(visorFrame);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.23), ink);
  visor.position.z = 0.005;
  head.add(visor);

  const faceMaterials = {
    neutral: new THREE.MeshBasicMaterial({ map: faceTexture('neutral'), toneMapped: false }),
    streng: new THREE.MeshBasicMaterial({ map: faceTexture('streng'), toneMapped: false }),
    freundlich: new THREE.MeshBasicMaterial({ map: faceTexture('freundlich'), toneMapped: false }),
    closed: new THREE.MeshBasicMaterial({ map: faceTexture('closed'), toneMapped: false }),
  };

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.39), faceMaterials.neutral);
  face.position.set(0, 0, 0.129);
  head.add(face);

  // Wandernde Scanzeile über dem Gesicht
  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(0.31, 0.018),
    new THREE.MeshBasicMaterial({
      color: 0x6ee7d7,
      transparent: true,
      opacity: 0.5,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  scan.position.set(0, 0.16, 0.132);
  head.add(scan);

  const headGlow = new THREE.PointLight(0x6ee7d7, 2.4, 3.4, 2);
  headGlow.position.set(0, 0, 0.3);
  head.add(headGlow);

  // Antenne mit Aufnahmelicht
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), brass);
  antenna.position.set(0.1, 0.32, 0);
  head.add(antenna);
  const recLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff5a4a, toneMapped: false }),
  );
  recLight.position.set(0.1, 0.41, 0);
  head.add(recLight);

  /* -------------------------------------------------------------------- Arme */

  const armGeometry = new THREE.CylinderGeometry(0.035, 0.03, 0.62, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, cloth);
    arm.position.set(side * 0.34, 1.2, 0.02);
    arm.rotation.z = side * 0.22;
    hover.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), brass);
    hand.position.set(side * 0.41, 0.9, 0.05);
    hover.add(hand);
  }

  // Stempel in der rechten Hand
  const stamp = new THREE.Group();
  stamp.position.set(0.46, 0.92, 0.24);
  stamp.rotation.z = -0.12;
  hover.add(stamp);

  const stampBase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), brass);
  stamp.add(stampBase);
  const stampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 8), brass);
  stampBody.position.y = 0.12;
  stamp.add(stampBody);
  const stampKnob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), brass);
  stampKnob.position.y = 0.23;
  stamp.add(stampKnob);

  // Karte in der linken Hand
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), new THREE.MeshBasicMaterial({
    map: plateTexture(['FUND', '0.9.4'], { width: 256, height: 352, border: true }),
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  }));
  card.position.set(-0.45, 0.94, 0.12);
  card.rotation.y = 0.4;
  card.rotation.z = 0.08;
  hover.add(card);

  // Brustschild
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.09),
    new THREE.MeshBasicMaterial({ map: plateTexture('KURATOR', { width: 512, height: 200 }), transparent: true, toneMapped: false }),
  );
  badge.position.set(0.1, 1.34, 0.38);
  hover.add(badge);

  /* ------------------------------------------------------------- Bodensockel */

  const marker = new THREE.Group();
  marker.position.y = 0.015;
  root.add(marker);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xe8e2d0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const half = 0.85;
  for (const [w, d, x, z] of [
    [half * 2, 0.02, 0, -half],
    [half * 2, 0.02, 0, half],
    [0.02, half * 2, -half, 0],
    [0.02, half * 2, half, 0],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.005, d), markerMaterial);
    bar.position.set(x, 0, z);
    marker.add(bar);
  }

  // Halo
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('110,231,215'),
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  halo.scale.set(3.2, 3.2, 1);
  halo.position.set(0, 1.2, -0.5);
  hover.add(halo);

  /* --------------------------------------------------------------- Schild */

  // Der Name steht im HUD und im Zielrahmen — im Raum braucht es kein Schild.

  /* ------------------------------------------------------------ Animation */

  let time = 0;
  let speaking = 0;
  let slamT = 0;
  let moodTimer = 0;
  let mood = 'neutral';
  let blinkTimer = 0;
  let blinking = false;

  const MOODS = ['neutral', 'streng', 'neutral', 'freundlich'];

  function update(dt, focusPoint) {
    time += dt;
    speaking = Math.max(0, speaking - dt * 1.3);

    hover.position.y = Math.sin(time * 0.85) * 0.03;

    // Saum weht leicht
    sheets.forEach((sheet, i) => {
      sheet.rotation.x = -0.08 + Math.sin(time * 1.1 + i * 0.7) * 0.05;
      sheet.position.y = 0.12 + Math.sin(time * 0.9 + i) * 0.012;
    });

    // Miene
    moodTimer -= dt;
    if (moodTimer <= 0) {
      moodTimer = 5.5 + Math.random() * 4;
      mood = MOODS[Math.floor(Math.random() * MOODS.length)];
      if (!blinking) face.material = faceMaterials[mood];
    }

    // Blinzeln
    blinkTimer -= dt;
    if (blinkTimer <= 0 && !blinking) {
      blinking = true;
      blinkTimer = 2.8 + Math.random() * 2.4;
      face.material = faceMaterials.closed;
      setTimeout(() => {
        blinking = false;
        face.material = faceMaterials[mood];
      }, 130);
    }

    // Scanzeile
    const t = (time % 2.6) / 2.6;
    scan.position.y = 0.18 - t * 0.36;
    scan.material.opacity = 0.18 + Math.sin(t * Math.PI) * 0.45;

    // Aufnahmelicht
    recLight.material.color.setHex(Math.sin(time * 3) > 0 ? 0xff5a4a : 0x3a1814);

    // Blick
    if (focusPoint) {
      const dx = focusPoint.x - root.position.x;
      const dz = focusPoint.z - root.position.z;
      const targetYaw = Math.atan2(dx, dz);
      let delta = targetYaw - head.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      head.rotation.y += delta * Math.min(1, dt * 3);
    }

    // Stempel
    if (slamT > 0) {
      slamT = Math.max(0, slamT - dt * 2.4);
      const punch = Math.sin((1 - slamT) * Math.PI * 2.2);
      stamp.position.y = 0.92 - Math.max(0, punch) * 0.34;
      stamp.rotation.z = -0.12 - Math.max(0, punch) * 0.2;
    } else {
      stamp.position.y = 0.92;
      stamp.rotation.z = -0.12;
    }

    headGlow.intensity = 1.8 + speaking * 4 + Math.sin(time * 2.2) * 0.3;
    halo.material.opacity = 0.22 + speaking * 0.2 + Math.sin(time * 1.4) * 0.04;
    markerMaterial.opacity = 0.16 + speaking * 0.12 + Math.sin(time * 1.2) * 0.03;
  }

  function setSpeaking(value = 1) {
    speaking = value;
  }

  function slam() {
    slamT = 1;
    setSpeaking(0.8);
  }

  return { root, hover, head, update, setSpeaking, slam };
}
