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
  let audio, frameId = 0;
  const frames = new Map();
  class Recording extends Events {
    pending = [];
    paused = true;
    constructor() { super(); audio = this; }
    getAttribute(name) { return this[name]; }
    play() {
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
  install('requestAnimationFrame', callback => {
    frames.set(++frameId, callback);
    return frameId;
  });
  install('cancelAnimationFrame', id => frames.delete(id));
  const button = new Events();
  button.attributes = new Map();
  button.setAttribute = (name, value) => button.attributes.set(name, value);
  const state = { textContent: '' };
  button.querySelector = () => state;
  const status = { textContent: '' };
  const controls = initMusic(button, status);
  return {
    audio, button, status, controls, document,
    finishFade() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(performance.now() + 1000);
    },
  };
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
  h.finishFade();
  assert.equal(h.audio.paused, false);
  assert.ok(h.audio.volume > 0 && h.audio.volume < 0.5, 'music fades to a quiet level');
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
  h.finishFade();
  assert.equal(h.audio.paused, true);
  assert.equal(h.audio.volume, 0);
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
  h.finishFade();
  assert.equal(h.audio.paused, false);
  assert.equal(h.button.attributes.get('aria-pressed'), 'true');
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  assert.equal(h.audio.paused, true);
  assert.equal(h.audio.volume, 0);
  h.document.hidden = false;
  h.document.emit('visibilitychange');
  h.audio.pending[2].resolve();
  await settle();
  h.finishFade();
  assert.equal(h.audio.paused, false);
});
