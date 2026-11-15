import test from 'node:test';
import assert from 'node:assert/strict';
import { initMusic } from '../src/music.js';

class Events {
  listeners = new Map();
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  emit(name) { for (const listener of this.listeners.get(name) || []) listener(); }
}

function musicHarness(t) {
  const originals = new Map();
  function install(name, value) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  let audio;
  class Recording extends Events {
    pending = [];
    paused = true;
    loadCount = 0;
    playVolumes = [];
    load() { this.loadCount++; this.error = null; }
    constructor() { super(); audio = this; }
    getAttribute(name) { return this[name]; }
    play() {
      this.playVolumes.push(this.volume);
      return new Promise((resolve, reject) => this.pending.push({
        resolve: () => { this.paused = false; resolve(); }, reject,
      }));
    }
    pause() { this.paused = true; }
  }
  const document = new Events();
  document.hidden = false;
  install('Audio', Recording);
  install('document', document);
  const button = new Events();
  button.attributes = new Map();
  button.setAttribute = (name, value) => button.attributes.set(name, value);
  const state = { textContent: '' };
  button.querySelector = () => state;
  const status = { textContent: '' };
  const controls = initMusic(button, status);
  return { audio, button, status, controls, document };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('default music retries blocked autoplay when the visitor enters', async t => {
  const h = musicHarness(t);
  assert.equal(h.audio.pending.length, 1, 'default music attempts playback');
  assert.equal(h.audio.loop, true);
  h.audio.pending[0].reject({ name: 'NotAllowedError' });
  await settle();
  assert.equal(h.button.attributes.get('aria-pressed'), 'true');
  h.controls.start();
  assert.equal(h.audio.pending.length, 2, 'entry gesture retries playback');
  h.audio.pending[1].resolve();
  await settle();
  assert.equal(h.audio.paused, false);
  assert.ok(h.audio.volume > 0 && h.audio.volume < 0.5, 'music starts at a quiet audible level');
  assert.match(h.status.textContent, /Playing/);
});

test('Off wins over pending autoplay and entry playback promises', async t => {
  const h = musicHarness(t);
  h.controls.start();
  h.button.emit('click');
  h.audio.pending[1].resolve();
  await settle();
  h.audio.pending[0].resolve();
  await settle();
  assert.equal(h.audio.paused, true);
  assert.ok(h.audio.volume > 0, 'pausing does not leave the next play silent');
  assert.equal(h.button.attributes.get('aria-pressed'), 'false');
  h.controls.start();
  assert.equal(h.audio.pending.length, 2, 'entering does not override an explicit Off');
});

test('a stale completion cannot stop a newer On request; hidden tabs pause', async t => {
  const h = musicHarness(t);
  h.button.emit('click');
  h.button.emit('click');
  h.audio.pending[0].resolve();
  await settle();
  h.audio.pending[1].resolve();
  await settle();
  assert.equal(h.audio.paused, false);
  assert.equal(h.button.attributes.get('aria-pressed'), 'true');
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  assert.equal(h.audio.paused, true);
  assert.ok(h.audio.volume > 0, 'pausing does not leave the next play silent');
  h.document.hidden = false;
  h.document.emit('visibilitychange');
  h.audio.pending[2].resolve();
  await settle();
  assert.equal(h.audio.paused, false);
});


test('audible startup and entry retry survive interrupted autoplay', async t => {
  const h = musicHarness(t);
  assert.ok(h.audio.playVolumes[0] > 0, 'autoplay requests sound rather than silently starting');
  h.audio.pending[0].reject({ name: 'AbortError' });
  await settle();
  assert.equal(h.controls.isOn(), true);
  h.controls.start();
  h.audio.pending[1].resolve();
  await settle();
  assert.equal(h.audio.paused, false);
  assert.ok(h.audio.playVolumes[1] > 0);
  assert.match(h.status.textContent, /Playing/);
});

test('entry reloads failed media without overriding an explicit Off', async t => {
  const h = musicHarness(t);
  h.audio.error = { code: 2 };
  h.audio.emit('error');
  h.audio.pending[0].reject({ name: 'NotSupportedError' });
  await settle();
  assert.equal(h.controls.isOn(), true);
  h.controls.start();
  assert.equal(h.audio.loadCount, 1);
  h.audio.pending[1].resolve();
  await settle();
  assert.equal(h.audio.paused, false);
  h.button.emit('click');
  h.audio.emit('error');
  h.controls.start();
  assert.equal(h.audio.pending.length, 2);
  assert.equal(h.controls.isOn(), false);
  assert.equal(h.audio.paused, true);
  assert.equal(h.status.textContent, 'Music off.');
});

test('the track loops natively without being reloaded or cut short', async t => {
  const h = musicHarness(t);
  h.audio.pending[0].resolve();
  await settle();
  h.audio.duration = 198.69;
  h.audio.currentTime = 198.5;
  h.audio.emit('timeupdate');
  assert.equal(h.audio.loop, true);
  assert.equal(h.audio.loadCount, 0, 'near the end, keep the buffered track');
  assert.equal(h.audio.pending.length, 1, 'do not interrupt playback with another play request');
  assert.equal(h.audio.paused, false);
  assert.ok(h.audio.volume > 0);
});
