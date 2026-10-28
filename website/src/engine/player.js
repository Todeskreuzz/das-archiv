import * as THREE from '../../vendor/three.module.js';
import { resolve } from './builder.js';

const EYE = 1.68;
const RADIUS = 0.34;
const WALK = 3.2;
const RUN = 6.6;
const ACCEL = 16;
const DAMP = 12;
const GRAVITY = 19;
const JUMP = 5.6;
const BASE_FOV = 74;
const RUN_FOV = 84;

export function createPlayer(camera, domElement) {
  camera.rotation.order = 'YXZ';

  const position = new THREE.Vector3(0, 0, 6.6);
  const velocity = new THREE.Vector3();
  let yaw = 0;
  let pitch = -0.02;
  let height = 0;
  let vertical = 0;
  let grounded = true;
  let bob = 0;
  let bobPhase = 0;
  let roll = 0;
  let fov = BASE_FOV;
  let locked = false;
  let enabled = true;
  let thirdPerson = false;
  let lookedAround = false;
  let dragging = false;

  const keys = new Set();
  const touchMove = { x: 0, y: 0 };

  const isCoarse = window.matchMedia('(pointer: coarse)').matches;

  function onKeyDown(event) {
    if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
    keys.add(event.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    if (!locked) return;
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.0022;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
  }

  // Maus ohne Zeigersperre: ziehen dreht die Sicht. Damit funktioniert es auch
  // in Browsern, die Pointer Lock verweigern.
  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && !locked) {
      dragging = true;
      lookedAround = false;
      event.preventDefault();
    }
  }
  function onPointerMove(event) {
    if (event.pointerType === 'mouse') {
      if (!dragging) return;
      yaw -= event.movementX * 0.0026;
      pitch -= event.movementY * 0.0026;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      if (Math.abs(event.movementX) + Math.abs(event.movementY) > 1) lookedAround = true;
      return;
    }
    if (!touchDrag) return;
    yaw -= (event.clientX - touchDrag.x) * 0.005;
    pitch -= (event.clientY - touchDrag.y) * 0.005;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    touchDrag = { x: event.clientX, y: event.clientY };
  }

  let touchDrag = null;

  function onTouchStart(event) {
    if (event.pointerType === 'mouse') return;
    touchDrag = { x: event.clientX, y: event.clientY };
  }
  function onPointerUp() {
    dragging = false;
    touchDrag = null;
  }

  function onLockChange() {
    locked = document.pointerLockElement === domElement;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerdown', onTouchStart);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerlockchange', onLockChange);

  function lock() {
    if (isCoarse) return;
    try {
      const request = domElement.requestPointerLock?.();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    } catch {
      /* Ohne Zeigersperre läuft die Welt trotzdem — dann per Ziehen. */
    }
  }

  function unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function toggleView() {
    thirdPerson = !thirdPerson;
    return thirdPerson;
  }

  const forwardVector = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();

  function update(dt) {
    const forward = enabled ? (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) : 0;
    const strafe = enabled ? (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) : 0;

    let inputX = strafe + touchMove.x;
    let inputZ = forward - touchMove.y;
    const length = Math.hypot(inputX, inputZ);
    if (length > 1) {
      inputX /= length;
      inputZ /= length;
    }

    const wantsSprint = enabled && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const sprinting = wantsSprint && length > 0.1;
    const speed = sprinting ? RUN : WALK;

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    const wishX = (inputX * cos - inputZ * sin) * speed;
    const wishZ = (-inputX * sin - inputZ * cos) * speed;

    velocity.x += (wishX - velocity.x) * Math.min(1, dt * ACCEL);
    velocity.z += (wishZ - velocity.z) * Math.min(1, dt * ACCEL);

    if (!length) {
      velocity.x -= velocity.x * Math.min(1, dt * DAMP);
      velocity.z -= velocity.z * Math.min(1, dt * DAMP);
    }

    const next = { x: position.x + velocity.x * dt, z: position.z + velocity.z * dt };
    resolve(next, RADIUS);

    next.x = Math.max(-21.4, Math.min(26.6, next.x));
    next.z = Math.max(-34.2, Math.min(7.4, next.z));

    position.x = next.x;
    position.z = next.z;

    // Springen
    if (enabled && keys.has('Space') && grounded) {
      vertical = JUMP;
      grounded = false;
    }
    if (!grounded) {
      vertical -= GRAVITY * dt;
      height += vertical * dt;
      if (height <= 0) {
        height = 0;
        vertical = 0;
        grounded = true;
      }
    }

    const moving = Math.hypot(velocity.x, velocity.z);
    const movingRatio = Math.min(1, moving / WALK);

    if (moving > 0.4) {
      bobPhase += dt * (sprinting ? moving * 3.4 : moving * 2.4);
      const amplitude = sprinting ? 0.055 : 0.026;
      bob = Math.sin(bobPhase * 2) * amplitude * movingRatio;
      roll += ((sprinting ? Math.sin(bobPhase) * 0.012 : 0) - roll) * Math.min(1, dt * 8);
    } else {
      bob *= 1 - Math.min(1, dt * 8);
      roll *= 1 - Math.min(1, dt * 8);
    }

    const breath = Math.sin(performance.now() * 0.0012) * 0.006;

    if (thirdPerson) {
      forwardVector.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      cameraTarget.set(position.x + rightX * 0.45, height + 1.35, position.z + rightZ * 0.45);
      desiredCamera.copy(cameraTarget).addScaledVector(forwardVector, -3.8);
      desiredCamera.x += rightX * 0.75;
      desiredCamera.z += rightZ * 0.75;
      desiredCamera.y = height + 2.35;

      camera.position.lerp(desiredCamera, Math.min(1, dt * 10));
      camera.lookAt(cameraTarget);
      camera.rotation.z = roll * 0.6;
    } else {
      camera.position.set(position.x, EYE + height + bob + breath, position.z);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      camera.rotation.z = roll;
    }

    const targetFov = sprinting ? RUN_FOV : BASE_FOV;
    if (Math.abs(fov - targetFov) > 0.05) {
      fov += (targetFov - fov) * Math.min(1, dt * 6);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  function consumeLook() {
    if (!lookedAround || dragging) return false;
    lookedAround = false;
    return true;
  }

  function lookAtPoint(point) {
    const dx = point.x - position.x;
    const dz = point.z - position.z;
    yaw = Math.atan2(-dx, -dz);
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointerdown', onTouchStart);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointerlockchange', onLockChange);
  }

  return {
    update,
    lock,
    unlock,
    dispose,
    lookAtPoint,
    toggleView,
    consumeLook,
    position,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get isLocked() { return locked; },
    get isThirdPerson() { return thirdPerson; },
    get isSprinting() { return enabled && Math.hypot(velocity.x, velocity.z) > WALK * 1.15; },
    get speed() { return Math.hypot(velocity.x, velocity.z); },
    setMoveVector(x, y) {
      touchMove.x = x;
      touchMove.y = y;
    },
    setYaw(value) {
      yaw = value;
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        velocity.set(0, 0, 0);
        keys.clear();
      }
    },
  };
}
