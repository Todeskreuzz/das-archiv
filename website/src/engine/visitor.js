import * as THREE from '../../vendor/three.module.js';

/**
 * Die Besucherfigur — nur in der dritten Person sichtbar.
 * Ein Mantel, ein Schal, zwei Beine, die bei Sprint deutlich weiter ausschlagen.
 */
export function createVisitor() {
  const root = new THREE.Group();

  const coatMaterial = new THREE.MeshLambertMaterial({ color: 0x5b677d, emissive: 0x0f141c, emissiveIntensity: 1 });
  const darkMaterial = new THREE.MeshLambertMaterial({ color: 0x1c2230 });
  const skinMaterial = new THREE.MeshLambertMaterial({ color: 0xd0c6b4 });
  const scarfMaterial = new THREE.MeshLambertMaterial({ color: 0x9e2f38, emissive: 0x1a0507, emissiveIntensity: 1 });

  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 10), coatMaterial);
  torso.position.y = 1.1;
  body.add(torso);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.2, 10), coatMaterial);
  hips.position.y = 0.78;
  body.add(hips);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.032, 6, 16), scarfMaterial);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.47;
  body.add(scarf);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skinMaterial);
  neck.position.y = 1.5;
  body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skinMaterial);
  head.position.y = 1.64;
  body.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), darkMaterial);
  hair.position.y = 1.69;
  body.add(hair);

  // Beine — Drehpunkt an der Hüfte
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.78, 0);
    body.add(pivot);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.74, 0.16), darkMaterial);
    leg.position.y = -0.37;
    pivot.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.26), darkMaterial);
    shoe.position.set(0, -0.74, 0.05);
    pivot.add(shoe);

    legs.push(pivot);
  }

  // Arme — Drehpunkt an der Schulter
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.35, 1.38, 0);
    body.add(pivot);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.12), coatMaterial);
    arm.position.y = -0.31;
    pivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinMaterial);
    hand.position.y = -0.64;
    pivot.add(hand);

    arms.push(pivot);
  }

  let phase = 0;
  let lean = 0;

  function update(dt, { speed, sprinting, visible }) {
    root.visible = visible;
    if (!visible) return;

    const moving = speed > 0.35;
    if (moving) {
      phase += dt * (sprinting ? 9.5 : 6.2);
    } else {
      phase += dt * 1.4;
    }

    const amplitude = moving ? (sprinting ? 0.95 : 0.5) : 0.04;
    const swing = Math.sin(phase) * amplitude;

    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
    arms[0].rotation.z = 0.08;
    arms[1].rotation.z = -0.08;

    const targetLean = sprinting ? 0.20 : moving ? 0.06 : 0;
    lean += (targetLean - lean) * Math.min(1, dt * 8);
    body.rotation.x = lean;

    // leichte Hüftbewegung
    body.rotation.z = moving ? Math.sin(phase * 0.5) * 0.02 : 0;
    body.position.y = moving ? Math.abs(Math.sin(phase)) * (sprinting ? 0.05 : 0.025) : 0;
  }

  return { root, update };
}
