import * as THREE from '../vendor/three.module.js';
import { byRoom, EXHIBITS } from './data/seed.js';
import { poster } from './data/art.js';
import { svgTexture } from './engine/textures.js';
import { createMaterials } from './engine/builder.js';
import { createWorld } from './engine/world.js';
import { createPlayer } from './engine/player.js';
import { createVisitor } from './engine/visitor.js';
import { createPost } from './engine/post.js';
import { createGraffiti } from './engine/graffiti.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createChat } from './ui/chat.js';
import { wallPanel, mountWall } from './ui/wall.js';
import { wallById } from './data/walls.js';
import {
  exhibitPanel,
  propPanel,
  curatorPanel,
  ballotPanel,
  submitPanel,
  judgmentPanel,
  allPanel,
  logPanel,
  aboutPanel,
  anonPanel,
  accountPanel,
} from './ui/panels.js';
import {
  state,
  restore,
  castVote,
  submit,
  resetAll,
  entryById,
  liveEntries,
  pendingCandidates,
  addCuratorFind,
} from './state.js';
import { briefing, react } from './curator.js';
import { createAgent } from './ai/agent.js';
import { reply as curatorReply, greeting as curatorGreeting, SUGGESTIONS } from './ai/dialogue.js';
import { pickFind, RESEARCH_POOL } from './ai/research.js';
import { createLink } from './ai/link.js';

const canvas = document.querySelector('#scene');
const hud = createHud();
const menu = createMenu();
let graffiti = null;

/* ------------------------------------------------------------ Renderer */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (error) {
  document.body.innerHTML = '<p style="padding:40px;font-family:monospace">Kein WebGL. Das Archiv bleibt verschlossen.</p>';
  throw error;
}

renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const post = createPost(renderer, { height: 460, levels: 5 });
post.resize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070c);
scene.fog = new THREE.FogExp2(0x060a12, 0.018);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 90);

/* --------------------------------------------------------------- Welt */

const materials = createMaterials();

const needed = [...byRoom('galerie'), ...byRoom('spielhalle')];
const posterTextures = new Map();
await Promise.all(
  needed.map(async (entry) => {
    const texture = await svgTexture(poster(entry), 512);
    if (texture) posterTextures.set(entry.id, texture);
  }),
);

graffiti = createGraffiti();
await graffiti.load();

const world = createWorld({ materials, posterTextures, graffiti });
scene.add(world.root);

const player = createPlayer(camera, canvas);
const visitor = createVisitor();
scene.add(visitor.root);

const interactables = world.interactables;

/* ------------------------------------------------------ Touch-Steuerknüppel */

const stick = document.querySelector('#stick');
if (stick) {
  const knob = stick.querySelector('.stick__knob');
  let activePointer = null;

  const applyStick = (event) => {
    const rect = stick.getBoundingClientRect();
    let dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > 1 ? 1 / length : 1;
    dx *= scale;
    dy *= scale;
    player.setMoveVector(dx, dy);
    knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
  };

  const releaseStick = () => {
    activePointer = null;
    player.setMoveVector(0, 0);
    knob.style.transform = '';
  };

  stick.addEventListener('pointerdown', (event) => {
    activePointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    applyStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === activePointer) applyStick(event);
  });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);
}

/* ------------------------------------------------------------- Zustand */

const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
let mode = 'boot';
let lastFind = null;
let suppressResume = false;
let link = null;
const sprintBadge = document.querySelector('#sprint');

function chatContext() {
  return {
    state,
    entries: liveEntries(),
    pending: pendingCandidates(),
    total: liveEntries().length,
    secured: liveEntries().filter((entry) => state.restored[entry.id]).length,
    lastFind,
  };
}

function updateHud() {
  const entries = liveEntries();
  hud.setStats({
    total: entries.length,
    secured: entries.filter((entry) => state.restored[entry.id]).length,
    notes: graffiti?.noteCount?.() || 0,
    marks: graffiti?.strokeCount?.() || 0,
  });
  syncLink();
}

function syncLink() {
  if (!link) return;
  link.pushState({
    total: liveEntries().length,
    pending: pendingCandidates().length,
    restored: Object.keys(state.restored).length,
    used: [...EXHIBITS, ...state.submissions].map((entry) => entry.id),
  });
}

/* --------------------------------------------------------------- Agent */

const agent = createAgent({
  curator: world.curator,
  getContext: () => ({
    total: liveEntries().length,
    pending: pendingCandidates().length,
  }),
  onThink: (text) => {
    hud.say(text, 'DENKT');
  },
  onFind: () => {
    const used = [...EXHIBITS, ...state.submissions].map((entry) => entry.id);
    const entry = pickFind(used);
    if (!entry) return null;
    const candidate = addCuratorFind(entry);
    if (!candidate) return null;
    lastFind = candidate;
    updateHud();
    hud.say(`Ich habe ${candidate.title} gefunden. Es liegt jetzt beim Gremium.`, 'FUND');
    hud.toast(`Neuer Fund: ${candidate.title}`);
    return candidate;
  },
});

/* -------------------------------------------------------------- Leitung */

if (!params.has('nolink')) {
  link = createLink({
  onEvent: (event) => {
    if (event.type === 'thought') {
      hud.say(event.text, 'DENKT');
      agent.setRemote(true);
      return;
    }
    if (event.type === 'go') {
      agent.goTo(event.target);
      return;
    }
    if (event.type === 'find') {
      const entry = RESEARCH_POOL.find((item) => item.id === event.id);
      if (!entry) return;
      const candidate = addCuratorFind(entry);
      if (!candidate) return;
      lastFind = candidate;
      updateHud();
      hud.say(`Ich habe ${candidate.title} gefunden. Es liegt jetzt beim Gremium.`, 'FUND');
      hud.toast(`Neuer Fund: ${candidate.title}`);
      return;
    }
    if (event.type === 'notice') {
      hud.toast(event.text);
    }
    if (event.type === 'graffiti') {
      graffiti?.apply(event);
      updateHud();
      hud.toast('Jemand hat an die Wand geschrieben');
    }
  },
  onStatus: (status) => {
    hud.setLink(status.mode);
    world.setLinkMode(status.mode === 'live' ? 'live' : status.mode === 'local' ? 'local' : 'offline');
    agent.setRemote(status.mode === 'live' || status.mode === 'local');
    if (status.mode === 'live') hud.toast(`Leitung steht · ${status.model}`);
  },
  });
}

async function askCurator(text) {
  const entries = liveEntries();
  const context = {
    total: entries.length,
    pending: pendingCandidates().length,
    secured: entries.filter((entry) => state.restored[entry.id]).length,
    restoredIds: Object.keys(state.restored),
    entries: entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      year: entry.year,
      host: entry.host,
      kind: entry.kind,
      room: entry.room,
      text: entry.text,
      note: entry.note,
    })),
  };

  if (link) {
    const remote = await link.send(text, context);
    if (remote && remote.text) {
      if (remote.action === 'find') agent.findNow();
      return remote;
    }
  }

  return curatorReply(text, chatContext());
}

/* --------------------------------------------------------------- Chat */

const chat = createChat({
  onSend: async (text) => {
    const result = await askCurator(text);
    chat.add('curator', result.text);
    hud.say(result.text, 'SPRICHT');

    if (result.action === 'find') {
      agent.findNow();
      return;
    }
    if (result.action === 'ballot') {
      closeChat();
      openPanel(ballotPanel());
      return;
    }
    if (result.action && result.action.startsWith('open:')) {
      const entry = entryById(result.action.slice(5));
      if (entry) {
        closeChat();
        openPanel(exhibitPanel(entry));
      }
    }
  },
  onClose: () => {
    if (suppressResume) return;
    resumeWorld();
  },
});

function openChat() {
  if (mode === 'chat') return;
  if (hud.isOpen) {
    suppressResume = true;
    hud.closePanel();
    suppressResume = false;
  }
  menu.hide();
  hud.show();
  mode = 'chat';
  player.setEnabled(false);
  player.unlock();
  agent.setTalking(true);
  world.curator.setSpeaking(1);
  hud.say('Ich höre.', 'SPRICHT');
  chat.show();
  if (!chat.hasHistory()) {
    chat.add('curator', curatorGreeting(chatContext()));
    chat.setSuggestions(SUGGESTIONS);
  }
}

function closeChat() {
  chat.hide();
  agent.setTalking(false);
  world.curator.setSpeaking(0.5);
}

/* ------------------------------------------------------------- Zustände */

function enterWorld() {
  menu.hide();
  hud.show();
  player.setEnabled(true);
  mode = 'world';
  updateHud();
  if (!isCoarse) player.lock();
}

function resumeWorld() {
  if (suppressResume) return;
  mode = 'world';
  player.setEnabled(true);
  updateHud();
  if (!isCoarse) player.lock();
}

function openMenu(which = 'pause') {
  if (mode === 'panel' || mode === 'chat') return;
  mode = 'menu';
  player.setEnabled(false);
  player.unlock();
  hud.clearTarget();
  menu.show(which);
}

function openPanel(html) {
  wallCleanup?.();
  wallCleanup = null;
  menu.hide();
  hud.show();
  mode = 'panel';
  player.setEnabled(false);
  player.unlock();
  hud.openPanel(html, { onClose: () => resumeWorld() });
}

let wallCleanup = null;

function openWall(wallId) {
  const wall = wallById(wallId);
  if (!wall) return;
  openPanel(wallPanel(wall));
  wallCleanup = mountWall(graffiti, wallId, { onChange: () => updateHud() });
}

menu.onAction((action) => {
  if (action === 'close') return enterWorld();
  if (action === 'ballot') return openPanel(ballotPanel());
  if (action === 'submit') return openPanel(submitPanel());
  if (action === 'alles') return openPanel(allPanel());
  if (action === 'log') return openPanel(logPanel());
  if (action === 'about') return openPanel(aboutPanel());
  if (action === 'anon') return openPanel(anonPanel());
  if (action === 'account') return openPanel(accountPanel());
  return undefined;
});

/* ------------------------------------------------------------ Interaktion */

const raycaster = new THREE.Raycaster();
raycaster.far = 3.6;
const center = new THREE.Vector2(0, 0);
const bounds = new THREE.Box3();
const corner = new THREE.Vector3();

let hovered = null;

function findTarget() {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  for (const hit of hits) {
    const data = hit.object.userData.interact;
    if (data) return { data, object: hit.object };
  }
  return null;
}

function screenRect(object) {
  bounds.setFromObject(object);
  const { min, max } = bounds;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < 8; i += 1) {
    corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
    corner.project(camera);
    if (corner.z > 1) return null;
    const x = (corner.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-corner.y * 0.5 + 0.5) * window.innerHeight;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    w: Math.min(window.innerWidth, maxX) - Math.max(0, minX),
    h: Math.min(window.innerHeight, maxY) - Math.max(0, minY),
  };
}

function targetValue(data) {
  if (data.type === 'exhibit') {
    const entry = entryById(data.id);
    return entry ? `${entry.year || '—'} · ${entry.rarity}` : '';
  }
  if (data.type === 'prop') return 'Objekt';
  if (data.type === 'wall') return 'beschreibbar';
  if (data.type === 'curator') return 'v0.9.4';
  if (data.type === 'ballot') return 'Abstimmung';
  if (data.type === 'submit') return 'Fund vorlegen';
  return '';
}

function interact() {
  if (mode !== 'world' || !hovered) return;
  const { data } = hovered;

  if (data.type === 'exhibit') {
    const entry = entryById(data.id);
    if (entry) openPanel(exhibitPanel(entry));
    return;
  }
  if (data.type === 'prop') {
    openPanel(propPanel(data.id));
    return;
  }
  if (data.type === 'wall') {
    openWall(data.id);
    return;
  }
  if (data.type === 'curator') {
    openChat();
    return;
  }
  if (data.type === 'ballot') return openPanel(ballotPanel());
  if (data.type === 'submit') return openPanel(submitPanel());
  return undefined;
}

/* ---------------------------------------------------------------- Ereignisse */

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-close], [data-restore], [data-vote], [data-open-ballot], [data-open-submit], [data-entry], [data-reset], [data-open-chat]');
  if (!target) return;

  if (target.matches('[data-close]')) {
    hud.closePanel();
    return;
  }

  if (target.matches('[data-open-chat]')) {
    openChat();
    return;
  }

  if (target.matches('[data-open-ballot]')) {
    openPanel(ballotPanel());
    return;
  }
  if (target.matches('[data-open-submit]')) {
    openPanel(submitPanel());
    return;
  }

  if (target.matches('[data-entry]')) {
    const entry = entryById(target.dataset.entry);
    if (entry) openPanel(exhibitPanel(entry));
    return;
  }

  if (target.matches('[data-reset]')) {
    if (window.confirm('Wirklich allen Fortschritt zurücksetzen?')) {
      resetAll();
      updateHud();
      hud.toast('Fortschritt gelöscht');
      hud.closePanel();
    }
    return;
  }

  if (target.matches('[data-restore]')) {
    const entry = entryById(target.dataset.restore);
    if (!entry) return;
    const result = restore(entry);
    if (!result.ok) return;
    updateHud();
    hud.toast(`${entry.title} gesichert`);
    hud.say(result.line, 'SICHERT');
    world.curator.setSpeaking(0.7);
    world.curator.slam();
    openPanel(exhibitPanel(entry));
    return;
  }

  if (target.matches('[data-vote]')) {
    const result = castVote(target.dataset.vote, Number(target.dataset.dir));
    if (!result.ok) return;
    updateHud();
    hud.toast(result.resolution === 'accepted' ? 'Kandidat aufgenommen' : result.line);
    hud.say(result.line, 'WÄGT AB');
    world.curator.setSpeaking(0.6);
    const candidate = entryById(target.dataset.vote);
    if (result.resolution === 'accepted' && candidate) {
      world.curator.slam();
      openPanel(exhibitPanel(candidate));
      return;
    }
    openPanel(ballotPanel());
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'submit-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  const input = {
    title: String(data.get('title') || '').trim(),
    url: String(data.get('url') || '').trim(),
    note: String(data.get('note') || '').trim(),
  };
  if (!input.title) return;
  const { entry, verdict } = submit(input);
  updateHud();
  const box = document.querySelector('#judgment');
  if (box) {
    box.hidden = false;
    box.innerHTML = judgmentPanel(verdict, entry);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const label = verdict.verdict === 'aufnehmen' ? 'AUFGENOMMEN?' : verdict.verdict === 'ablehnen' ? 'ABGELEHNT' : 'GEPRÜFT';
  hud.say(verdict.text, label);
  hud.toast(`Urteil: ${verdict.verdict} · ${verdict.score}/100`);
  world.curator.setSpeaking(1);
  world.curator.slam();
});

document.addEventListener('keydown', (event) => {
  const inField = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);

  if (event.key === 'Escape') {
    if (hud.isOpen) {
      hud.closePanel();
      return;
    }
    if (mode === 'chat') {
      closeChat();
      return;
    }
    if (mode === 'menu') {
      enterWorld();
      return;
    }
    if (mode === 'world') openMenu('pause');
    return;
  }

  if (inField) return;

  if (event.key === 'Tab') {
    event.preventDefault();
    if (mode === 'world') openMenu('pause');
    else if (mode === 'menu') enterWorld();
    return;
  }

  if (event.key === 't' || event.key === 'T' || event.key === 'f' || event.key === 'F') {
    if (mode === 'world') {
      event.preventDefault();
      openChat();
    }
    return;
  }

  if (event.key === 'v' || event.key === 'V') {
    if (mode === 'world') {
      const third = player.toggleView();
      hud.toast(third ? 'Dritte Person' : 'Erste Person');
    }
    return;
  }

  if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
    if (mode !== 'world') return;
    interact();
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) return;
  if (mode === 'world') openMenu('pause');
});

canvas.addEventListener('click', () => {
  if (mode !== 'world') return;
  if (!player.isLocked && !isCoarse) {
    player.lock();
    return;
  }
  if (player.consumeLook()) return;
  interact();
});

document.querySelector('#menu-button')?.addEventListener('click', () => openMenu('pause'));

/* --------------------------------------------------------------- Start */

hud.hide();
hud.say(briefing(state, liveEntries()), 'BEREIT');
updateHud();

if (isCoarse) hud.showTouch(true);

if (params.has('spawn')) {
  const [x, z] = params.get('spawn').split(',').map(Number);
  if (Number.isFinite(x) && Number.isFinite(z)) player.position.set(x, 0, z);
}
if (params.has('yaw')) {
  const value = Number(params.get('yaw'));
  if (Number.isFinite(value)) player.setYaw(value);
}
if (params.get('view') === 'third') player.toggleView();

if (params.has('auto')) {
  enterWorld();
} else {
  openMenu('start');
}

const openParam = params.get('open');
if (openParam) {
  setTimeout(() => {
    if (openParam === 'ballot') openPanel(ballotPanel());
    else if (openParam === 'submit') openPanel(submitPanel());
    else if (openParam === 'curator') openPanel(curatorPanel());
    else if (openParam === 'chat') openChat();
    else if (openParam.startsWith('wall:')) openWall(openParam.slice(5));
    else if (openParam === 'menu') openMenu('pause');
  }, 500);
}

/* --------------------------------------------------------------- Schleife */

const clock = new THREE.Clock();
let frameCount = 0;
let elapsed = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  player.update(dt);

  const speed = player.speed;
  visitor.root.position.set(player.position.x, 0, player.position.z);
  visitor.root.rotation.y = player.yaw + Math.PI;
  visitor.update(dt, {
    speed,
    sprinting: player.isSprinting,
    visible: player.isThirdPerson && mode === 'world',
  });

  agent.update(dt, camera.position);
  world.update(dt, camera.position);

  frameCount += 1;
  if (frameCount % 3 === 0 && mode === 'world') {
    const found = findTarget();
    hovered = found;
    if (found) {
      hud.setTarget({
        label: found.data.label,
        value: targetValue(found.data),
        rect: screenRect(found.object),
      });
    } else {
      hud.clearTarget();
    }
  }

  if (mode !== 'world') hud.clearTarget();

  const sprinting = mode === 'world' && player.isSprinting;
  if (sprintBadge && sprintBadge.hidden === sprinting) sprintBadge.hidden = !sprinting;

  post.render(scene, camera, elapsed);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  post.resize(window.innerWidth, window.innerHeight);
});

tick();

if (params.has('debug')) {
  window.__archiv = {
    player,
    camera,
    world,
    state,
    agent,
    chat,
    get mode() {
      return mode;
    },
  };
}

console.info(
  `%cDAS ARCHIV %c${liveEntries().length} Exponate · Kurator v0.9.4`,
  'color:#ffcf6a;font-weight:bold',
  'color:#6ee7d7',
);
