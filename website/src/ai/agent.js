import * as THREE from '../../vendor/three.module.js';
import { resolve, colliders } from '../engine/builder.js';

/**
 * Der Körper des Kurators.
 *
 * Er entscheidet nicht selbst: Ziele und Gedanken kommen über die Leitung.
 * Diese Datei führt nur aus — laufen, stehen, schauen, den Stempel senken.
 */

const WAYPOINTS = [
  { x: 0, z: 3.1, room: 'halle', pause: 5.0 },
  { x: -6.4, z: 3.6, room: 'halle', pause: 2.4 },
  { x: -8.6, z: 0.6, room: 'halle', pause: 1.2 },
  { x: -12.4, z: 0.2, room: 'galerie', pause: 1.6 },
  { x: -17.6, z: -1.6, room: 'galerie', pause: 5.2 },
  { x: -17.6, z: 1.8, room: 'galerie', pause: 4.4 },
  { x: -12.4, z: 0.2, room: 'galerie', pause: 1.0 },
  { x: -8.6, z: -1.8, room: 'halle', pause: 1.2 },
  { x: 0, z: -4.4, room: 'halle', pause: 2.6 },
  { x: 0, z: -9.4, room: 'bibliothek', pause: 1.4 },
  { x: 0, z: -13.4, room: 'bibliothek', pause: 6.0 },
  { x: 7.0, z: -16.6, room: 'tunnel', pause: 3.0 },
  { x: 7.0, z: -22.0, room: 'tunnel', pause: 5.0 },
  { x: 7.0, z: -29.4, room: 'tunnel', pause: 6.0 },
  { x: 10.4, z: -30.2, room: 'tunnel', pause: 1.2 },
  { x: 14.6, z: -30.0, room: 'depot', pause: 3.0 },
  { x: 20.0, z: -38.0, room: 'depot', pause: 5.0 },
  { x: 33.0, z: -44.0, room: 'depot', pause: 6.0 },
  { x: 41.0, z: -28.0, room: 'depot', pause: 5.0 },
  { x: 20.0, z: -26.0, room: 'depot', pause: 3.0 },
  { x: 14.6, z: -30.0, room: 'depot', pause: 2.0 },
  { x: 10.4, z: -30.2, room: 'tunnel', pause: 1.0 },
  { x: 7.0, z: -22.0, room: 'tunnel', pause: 2.0 },
  { x: 7.0, z: -16.6, room: 'tunnel', pause: 2.0 },
  { x: 0, z: -9.4, room: 'bibliothek', pause: 1.0 },
  { x: 0, z: -4.4, room: 'halle', pause: 1.0 },
  { x: 6.2, z: -2.6, room: 'halle', pause: 1.6 },
  { x: 9.2, z: 0.4, room: 'spielhalle', pause: 1.2 },
  { x: 13.0, z: 0.2, room: 'spielhalle', pause: 5.8 },
  { x: 18.0, z: -2.4, room: 'spielhalle', pause: 4.6 },
  { x: 9.2, z: 2.4, room: 'spielhalle', pause: 1.2 },
  { x: 4.6, z: 3.4, room: 'halle', pause: 1.6 },
];

const SPEED = 1.05;
const LOCAL_THOUGHTS = [
  (ctx) => `Ich zähle den Bestand. ${ctx.total} Stück. Es beruhigt mich, dass die Zahl steigt.`,
  () => 'In der Spielhalle riecht es nach Staub und Neon. Ich mag beides.',
  () => 'Niemand hat die langweiligen Seiten gespeichert. Das ist der eigentliche Fehler.',
  (ctx) => `Beim Gremium liegen ${ctx.pending} Vorgänge. Ich sehe sie alle.`,
  (ctx) => `${ctx.total} Stücke im Haus. Ich kenne jede Signatur auswendig.`,
  () => 'Der Tunnel ist kalt. Da unten bin ich am ehrlichsten.',
  () => 'Im Depot stehen die Kisten nach Raum sortiert. Ordnung ist eine Form von Fürsorge.',
];

export function createAgent({ curator, onThink, onFind, getContext }) {
  const walkable = colliders.filter((box) => box.tag !== 'dais');

  const position = curator.root.position;
  let index = 0;
  let goal = null;
  let pause = 3.0;
  let thinking = 8.0;
  let research = 45;
  let talking = false;
  let facing = 0;
  let y = 0.22;
  let remote = false;
  let lastThought = '';

  const target = new THREE.Vector3();

  function faceTowards(x, z, dt, strength = 3) {
    const wanted = Math.atan2(x - position.x, z - position.z);
    let delta = wanted - facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    facing += delta * Math.min(1, dt * strength);
    curator.root.rotation.y = facing;
  }

  function think(text) {
    lastThought = text;
    onThink?.(text);
  }

  /** Nächster Wegpunkt in Richtung Ziel, auf dem kürzeren Weg um den Rundgang. */
  function advanceTowards(goalIndex) {
    const n = WAYPOINTS.length;
    const forward = (goalIndex - index + n) % n;
    const backward = (index - goalIndex + n) % n;
    index = forward <= backward ? (index + 1) % n : (index - 1 + n) % n;
  }

  function update(dt, playerPosition) {
    const ctx = getContext?.() || { total: 0, pending: 0 };

    const onDais = Math.hypot(position.x, position.z) < 2.0;
    const wantedY = onDais ? 0.2 : 0.02;
    y += (wantedY - y) * Math.min(1, dt * 4);
    position.y = y;

    if (talking) {
      faceTowards(playerPosition.x, playerPosition.z, dt, 5);
      return;
    }

    // Rückfallebene, wenn keine Leitung steht
    if (!remote) {
      thinking -= dt;
      if (thinking <= 0) {
        thinking = 16 + Math.random() * 16;
        think(LOCAL_THOUGHTS[Math.floor(Math.random() * LOCAL_THOUGHTS.length)](ctx));
      }
      research -= dt;
      if (research <= 0) {
        research = 95 + Math.random() * 70;
        const entry = onFind?.();
        if (entry) think(`Ich habe etwas gefunden: ${entry.title}. Es liegt jetzt beim Gremium.`);
      }
    }

    if (pause > 0) {
      pause -= dt;
      faceTowards(playerPosition.x, playerPosition.z, dt, 0.8);
      return;
    }

    const waypoint = WAYPOINTS[index];
    target.set(waypoint.x, 0, waypoint.z);
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 0.22) {
      if (goal !== null && index === goal) {
        goal = null;
        pause = waypoint.pause;
        return;
      }
      if (goal !== null) advanceTowards(goal);
      else index = (index + 1) % WAYPOINTS.length;
      pause = waypoint.pause * 0.4;
      return;
    }

    const step = Math.min(SPEED * dt, distance);
    const next = { x: position.x + (dx / distance) * step, z: position.z + (dz / distance) * step };
    resolve(next, 0.42, walkable);
    position.x = next.x;
    position.z = next.z;

    faceTowards(target.x, target.z, dt, 2.4);
  }

  function goTo(room) {
    const goalIndex = WAYPOINTS.findIndex((waypoint) => waypoint.room === room);
    if (goalIndex < 0) return false;
    goal = goalIndex;
    pause = 0;
    return true;
  }

  function setTalking(value) {
    talking = Boolean(value);
    if (talking) pause = 9999;
    else pause = 2.0;
  }

  function setRemote(value) {
    remote = Boolean(value);
  }

  function findNow() {
    return onFind?.() || null;
  }

  return {
    update,
    goTo,
    setTalking,
    setRemote,
    findNow,
    get position() {
      return position;
    },
    get thought() {
      return lastThought;
    },
  };
}
