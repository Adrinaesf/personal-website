import { initScene } from './scene.js';
import { initMusic } from './music.js';

const music = initMusic(document.querySelector('#music-toggle'), document.querySelector('#music-status'));
const names = {about:'Base camp',projects:'Project archive',research:'Observatory',contact:'Radio station',life:'My life'};
const discovered = new Set();
const journal = document.querySelector('#journal');
const map = document.querySelector('#world-map');
const controls = document.querySelector('#controls-dialog');
const dialogs = [journal,map,controls];
let scene;
let entered = false;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = document.querySelector('#motion-toggle');
function syncActivity() { scene?.setActive?.(entered && !dialogs.some(d=>d.open)); }
function openJournal(id) {
  if (!names[id]) return;
  dialogs.forEach(d=>{if(d.open)d.close();});
  document.querySelector('#journal-title').textContent = names[id].toUpperCase();
  document.querySelector('#journal-content').replaceChildren(document.querySelector(`#content-${id}`).content.cloneNode(true));
  document.querySelector('#journal-content').scrollTop = 0;
  discovered.add(id);
  document.querySelector('#discovery-count').textContent = `${discovered.size} / 5`;
  document.querySelectorAll('[data-discovery]').forEach(el=>{
    const visited = discovered.has(el.dataset.discovery);
    el.classList.toggle('discovered',visited);
    el.querySelector('.discovery-mark').textContent = visited ? '◆' : '◇';
    el.querySelector('.discovery-mark').setAttribute('aria-label', visited ? 'Discovered' : 'Not yet discovered');
  });
  journal.showModal();
  syncActivity();
}
const markerRoot = document.querySelector('#world-markers');
const markerElements = {};
for (const [id,name] of Object.entries(names)) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'world-marker';
  el.hidden = true;
  el.innerHTML = `<span class="marker-diamond" aria-hidden="true">◇</span><span class="marker-name">${name}</span><span class="marker-distance"></span>`;
  el.setAttribute('aria-label',`Inspect ${name}`);
  el.addEventListener('click',()=>{
    if (Number(el.dataset.distance) > 9) {
      scene?.goTo(id);
      document.querySelector('#landscape').focus();
    }
    else openJournal(id);
  });
  markerRoot.append(el);
  markerElements[id] = el;
}
function updateMarkers(markers) {
  for (const item of markers) {
    const el = markerElements[item.id];
    if (!el) continue;
    const behindJournal = item.x < (innerWidth <= 650 ? 250 : 310) && item.y < 445;
    el.hidden = !entered || !item.visible || behindJournal || dialogs.some(d=>d.open);
    el.dataset.distance = String(item.distance || 0);
    el.setAttribute('aria-label',`${item.distance > 9 ? 'Walk to' : 'Inspect'} ${names[item.id]}`);
    el.style.transform = `translate(${item.x}px,${item.y}px) translate(-50%,-100%)`;
    el.querySelector('.marker-distance').textContent = item.distance == null ? 'Inspect' : `${Math.round(item.distance)} m`;
  }
  const state = scene?.getPlayerState?.();
  if (state) {
    const bearings = ['N','NE','E','SE','S','SW','W','NW'];
    const bearing = Math.round(state.heading / 45) % 8;
    document.querySelector('#heading').textContent = bearings[bearing];
    document.querySelector('#bearing-left').textContent = bearings[(bearing+7)%8];
    document.querySelector('#bearing-right').textContent = bearings[(bearing+1)%8];
    const prompt = document.querySelector('#interaction-prompt');
    prompt.hidden = !state.nearest || dialogs.some(d=>d.open) || !entered;
    if (!prompt.hidden) prompt.textContent = `${matchMedia('(pointer: coarse)').matches ? 'Tap marker' : 'E'} · Inspect ${names[state.nearest]}`;
  }
}
try {
  scene = initScene({canvas:document.querySelector('#landscape'),onReady:()=>{
    document.querySelector('#load-status').textContent = 'Ready';
  },onSelect:openJournal,onProject:updateMarkers});
  scene.setPaused(paused);
  syncActivity();
} catch(error) {
  console.warn('The 3D world could not start.', error);
  document.querySelector('#load-status').textContent = '3D is unavailable on this device. Enter to open the field journal.';
  document.body.classList.add('world-unavailable');
}
function paintMotion() {
  motion.setAttribute('aria-pressed',String(paused));
  motion.textContent = paused ? 'Enable ambient motion' : 'Pause ambient motion';
}
paintMotion();
motion.addEventListener('click',()=>{paused=!paused;scene?.setPaused(paused);paintMotion();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{paused=e.matches;scene?.setPaused(paused);paintMotion();});
document.querySelector('#enter-button').addEventListener('click',()=>{
  entered=true;
  music.start();
  document.querySelector('#start-screen').hidden=true;
  document.body.classList.add('entered');
  syncActivity();
  document.querySelector('#landscape').focus();
  if(!scene){map.showModal();syncActivity();}
});
document.querySelector('#map-button').addEventListener('click',()=>{map.showModal();syncActivity();});
document.querySelector('#help-button').addEventListener('click',()=>{controls.showModal();syncActivity();});
document.querySelector('#close-journal').addEventListener('click',()=>journal.close());
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
dialogs.forEach(dialog=>dialog.addEventListener('close',()=>{
  syncActivity();
  if(!dialogs.some(d=>d.open))document.querySelector('#landscape').focus();
}));
document.querySelectorAll('[data-travel]').forEach(button=>button.addEventListener('click',()=>{
  map.close();
  const id=button.dataset.travel;
  if(scene){scene.goTo(id);syncActivity();}
  else openJournal(id);
}));
document.querySelector('#reset-button').addEventListener('click',()=>scene?.reset());
for(const button of document.querySelectorAll('[data-move]')){
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const [forward,strafe]=button.dataset.move.split(',').map(Number);
    scene?.setMove(forward,strafe);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>scene?.setMove(0,0));
}

for (const button of document.querySelectorAll('[data-destination]')) {
  button.addEventListener('click', () => {
    const id = button.dataset.destination;
    if (discovered.has(id) || !scene) openJournal(id);
    else {
      scene.goTo(id);
      document.querySelector('#landscape').focus();
    }
  });
}
