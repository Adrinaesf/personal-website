import { initScene } from './scene.js';
import { initMusic } from './music.js';

const $ = selector => document.querySelector(selector);
const music = initMusic($('#music-toggle'), $('#music-status'));
const names = { about: 'My education', projects: 'My projects', research: 'My experience', contact: 'Contact me', life: 'My hobbies', wanderer: 'River' };
const total = Object.keys(names).length;
const discovered = new Set();
const journal = $('#journal');
const map = $('#world-map');
const controls = $('#controls-dialog');
const dialogs = [journal, map, controls];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(pointer: coarse)');
let scene;
let entered = false;
let paused = reducedMotion.matches;
const motion = $('#motion-toggle');
const anyDialogOpen = () => dialogs.some(dialog => dialog.open);
function syncActivity() { scene?.setActive?.(entered && !anyDialogOpen()); }

// The wandering dog speaks in a small card at the bottom of the screen.
const guide = $('#guide'), guideText = $('#guide-text'), guideNext = $('#guide-next');
const guideQueue = [];
let guideLine = '', guideTimer = 0, guideShown = 0;
function paintGuide() {
  guideText.textContent = guideLine.slice(0, guideShown);
  guideNext.textContent = guideQueue.length ? 'next ›' : 'okay ›';
}
function showNextLine() {
  clearInterval(guideTimer); guideTimer = 0;
  if (!guideQueue.length) { guide.hidden = true; return; }
  guideLine = guideQueue.shift(); guideShown = reducedMotion.matches ? guideLine.length : 0;
  guide.hidden = false; guideText.setAttribute('aria-label', guideLine); paintGuide();
  if (guideShown < guideLine.length) guideTimer = setInterval(() => {
    guideShown++; paintGuide();
    if (guideShown >= guideLine.length) { clearInterval(guideTimer); guideTimer = 0; }
  }, 24);
}
function advanceGuide() {
  if (guideTimer) { clearInterval(guideTimer); guideTimer = 0; guideShown = guideLine.length; paintGuide(); }
  else showNextLine();
}
function say(...lines) {
  guideQueue.push(...lines);
  if (guide.hidden) showNextLine(); else paintGuide();
}
guideNext.addEventListener('click', advanceGuide);
$('#guide-skip').addEventListener('click', () => { guideQueue.length = 0; clearInterval(guideTimer); guideTimer = 0; guide.hidden = true; $('#landscape').focus(); });
window.addEventListener('keydown', event => {
  if (guide.hidden || anyDialogOpen() || event.target.closest?.('button,a,input')) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); advanceGuide(); }
});

const toast = $('#toast');
let toastTimer = 0;
function showToast(message) {
  toast.textContent = message; toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}
let audioContext;
function chime(step) {
  if (!music.isOn()) return;
  try {
    audioContext ??= new AudioContext();
    const note = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66][step % 7], now = audioContext.currentTime;
    for (const [frequency, level] of [[note, 0.07], [note * 2, 0.03]]) {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      oscillator.connect(gain).connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + 1.5);
    }
  } catch { /* Sound is a bonus; the game works without it. */ }
}
function onCollect({ count, total: stars }) {
  $('#star-count').textContent = `${count} / ${stars}`;
  $('.star-line').classList.toggle('complete', count === stars);
  if (count < stars) chime(count - 1);
  if (count < stars) showToast(`✦ ${count} of ${stars} · ${stars - count} more and the sky wakes up`);
  else {
    showToast('✦ All seven. Look up!');
    for (let step = 0; step < 7; step++) setTimeout(() => chime(step), 250 + step * 120);
    document.body.classList.add('celebrating'); setTimeout(() => document.body.classList.remove('celebrating'), 3000);
    say('That’s all seven. Look up.', 'Every star you picked up is back in the sky now, shining for you.', 'Keep looking for the little lights in your own life too. They’re always out there.');
  }
}

function paintDiscoveries() {
  $('#discovery-count').textContent = `${discovered.size} / ${total}`;
  document.querySelectorAll('[data-discovery]').forEach(item => {
    const id = item.dataset.discovery, visited = discovered.has(id);
    item.classList.toggle('discovered', visited);
    item.querySelector('.discovery-mark').setAttribute('aria-label', visited ? 'Discovered' : 'Not yet discovered');
    if (id === 'wanderer') item.querySelector('.journal-label').textContent = visited ? names.wanderer : '? ? ?';
  });
}
function openJournal(id) {
  if (!names[id]) return;
  dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
  $('#journal-title').textContent = names[id];
  journal.dataset.page = id;
  $('#journal-content').replaceChildren($(`#content-${id}`).content.cloneNode(true));
  const first = !discovered.has(id);
  discovered.add(id);
  paintDiscoveries();
  journal.showModal();
  $('#journal-content').scrollTop = 0;
  syncActivity();
  if (first && discovered.size === total) say('You’ve seen everything Adrina left out here.', 'Stay as long as you like. The sky keeps going.');
}

const markerRoot = $('#world-markers');
const markerElements = {};
for (const [id, name] of Object.entries(names)) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `world-marker marker-${id}`;
  el.hidden = true;
  el.innerHTML = `<span class="marker-name">${id === 'wanderer' ? 'say hi' : name}</span><span class="marker-distance"></span><span class="marker-pin" aria-hidden="true"></span>`;
  el.setAttribute('aria-label', `Inspect ${name}`);
  el.addEventListener('click', () => {
    if (id === 'wanderer' && scene) scene.sayHi();
    else if (Number(el.dataset.distance) > 9) {
      scene?.goTo(id);
      $('#landscape').focus();
    }
    else openJournal(id);
  });
  markerRoot.append(el);
  markerElements[id] = el;
}
function updateMarkers(markers) {
  const narrow = innerWidth <= 650;
  for (const item of markers) {
    const el = markerElements[item.id];
    if (!el) continue;
    const behindJournal = item.x < (narrow ? 185 : 275) && item.y < (narrow ? 400 : 500);
    el.hidden = !entered || !item.visible || behindJournal || anyDialogOpen();
    el.dataset.distance = String(item.distance || 0);
    el.style.transform = `translate(${item.x}px,${item.y}px) translate(-50%,-100%)`;
    if (item.id === 'wanderer') {
      el.querySelector('.marker-name').textContent = discovered.has('wanderer') ? 'River' : 'say hi';
      el.setAttribute('aria-label', 'Meet the wandering dog');
    } else {
      el.setAttribute('aria-label', `${item.distance > 9 ? 'Walk to' : 'Inspect'} ${names[item.id]}`);
      el.querySelector('.marker-distance').textContent = item.distance == null ? '' : `${Math.round(item.distance)} m`;
    }
  }
  const state = scene?.getPlayerState?.();
  if (state) {
    const bearings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const bearing = Math.round(state.heading / 45) % 8;
    $('#heading').textContent = bearings[bearing];
    $('#bearing-left').textContent = bearings[(bearing + 7) % 8];
    $('#bearing-right').textContent = bearings[(bearing + 1) % 8];
    const prompt = $('#interaction-prompt');
    prompt.hidden = !state.nearest || anyDialogOpen() || !entered || !guide.hidden;
    if (!prompt.hidden) {
      const action = state.nearest === 'wanderer' ? 'Say hi to River' : `Open ${names[state.nearest]}`;
      prompt.innerHTML = touch.matches ? `Tap the marker · ${action}` : `<kbd>E</kbd> ${action}`;
    }
  }
}
try {
  scene = initScene({ canvas: $('#landscape'), onReady: () => {
    $('#load-status').textContent = 'The world is ready.';
  }, onSelect: openJournal, onProject: updateMarkers, onCollect });
  scene.setPaused(paused);
  syncActivity();
} catch (error) {
  console.warn('The 3D world could not start.', error);
  $('#load-status').textContent = '3D is unavailable on this device. Enter to open my journal.';
  document.body.classList.add('world-unavailable');
}
function paintMotion() {
  motion.setAttribute('aria-pressed', String(paused));
  motion.textContent = paused ? 'Turn ambient motion on' : 'Pause ambient motion';
}
paintMotion();
paintDiscoveries();
motion.addEventListener('click', () => { paused = !paused; scene?.setPaused(paused); paintMotion(); });
reducedMotion.addEventListener('change', event => { paused = event.matches; scene?.setPaused(paused); paintMotion(); });
$('#enter-button').addEventListener('click', () => {
  entered = true;
  music.start();
  $('#start-screen').hidden = true;
  document.body.classList.add('entered');
  syncActivity();
  $('#landscape').focus();
  if (!scene) { map.showModal(); syncActivity(); return; }
  say(
    'Oh, hi. You found Adrina’s little world.',
    'I’m River. I wander around here, and nobody tells me where to go.',
    touch.matches
      ? 'Five places out there have a light on. Walk up to one and tap its marker to read what Adrina left inside.'
      : 'Five places out there have a light on. Walk up to one and press E to read what Adrina left inside.',
    'Seven stars have fallen in this valley. Find all seven, and watch what the sky does.',
    'That’s all. Go wherever you want. I’ll be around.',
  );
});
$('#map-button').addEventListener('click', () => { map.showModal(); syncActivity(); });
$('#help-button').addEventListener('click', () => { controls.showModal(); syncActivity(); });
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
dialogs.forEach(dialog => dialog.addEventListener('close', () => {
  syncActivity();
  if (!anyDialogOpen()) $('#landscape').focus();
}));
document.querySelectorAll('[data-travel]').forEach(button => button.addEventListener('click', () => {
  map.close();
  const id = button.dataset.travel;
  if (scene) { scene.goTo(id); syncActivity(); }
  else openJournal(id);
}));
$('#reset-button').addEventListener('click', () => scene?.reset());
for (const button of document.querySelectorAll('[data-move]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const [forward, strafe] = button.dataset.move.split(',').map(Number);
    scene?.setMove(forward, strafe);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => scene?.setMove(0, 0));
}

for (const button of document.querySelectorAll('[data-destination]')) {
  button.addEventListener('click', () => {
    const id = button.dataset.destination;
    if (discovered.has(id) || !scene) openJournal(id);
    else if (id === 'wanderer') say('Someone is walking around out there. Go and say hi to him.');
    else {
      scene.goTo(id);
      $('#landscape').focus();
    }
  });
}



