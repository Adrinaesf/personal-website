import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCompanions } from '../src/companions.js';

const obstacles = [
  { x: -12, z: 11, radius: 3 }, { x: -11, z: -10, radius: 3 },
  { x: 12, z: -19, radius: 3 }, { x: 12, z: 5, radius: 3 },
  { x: 24, z: -8, radius: 3 },
];
const groundHeight = (x, z) => -0.25 + Math.sin(x * 0.2) * 0.2 + Math.cos(z * 0.13) * 0.1;

function dogHarness(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Canvas drawing only prepares the coat texture; geometry and transforms use Three.js.
  const context = new Proxy({}, {
    get: (target, key) => target[key] ?? (() => {}),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true, writable: true,
    value: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) },
  });
  const scene = new THREE.Scene();
  const companions = createCompanions({ scene, groundHeight, obstacles });
  t.after(() => {
    if (scene.children.includes(companions.dog)) companions.dispose();
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
  const player = new THREE.Vector3(0, groundHeight(0, 27) + 1.8, 27);
  companions.update({ position: player, delta: 0, time: 0, paused: true });
  return { scene, companions, player };
}

function horizontalDistance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function objectCount(scene) { let count = 0; scene.traverse(() => count++); return count; }

test('camera exclusion cannot push the dog back inside a landmark', t => {
  const { companions, player } = dogHarness(t);
  player.set(-12, groundHeight(-12, 15) + 1.8, 15);
  // This point lies on the obstacle boundary but too close to the visitor.
  // Resolving those constraints separately previously put the dog inside the station.
  companions.dog.position.set(-12, groundHeight(-12, 14.5), 14.5);
  companions.update({ position: player, delta: 1 / 60, time: 1, paused: false });
  assert.ok(horizontalDistance(companions.dog.position, player) >= 3.2);
  for (const obstacle of obstacles) {
    assert.ok(horizontalDistance(companions.dog.position, obstacle) >= obstacle.radius + 0.5);
  }
});

test('paused dogs remain stationary even when a distant visitor would trigger catch-up', t => {
  const { companions, player } = dogHarness(t);
  const before = companions.dog.position.clone();
  player.set(35, groundHeight(35, -20) + 1.8, -20);
  for (let frame = 0; frame < 60; frame++) {
    companions.update({ position: player, delta: 1 / 60, time: frame / 60, paused: true });
  }
  assert.deepEqual(companions.dog.position.toArray(), before.toArray());
});

test('autonomous roaming stays grounded, bounded and clear without accumulating objects', t => {
  const { scene, companions, player } = dogHarness(t);
  const initialCount = objectCount(scene);
  const initialPosition = companions.dog.position.clone();
  let farthestRoam = 0;
  for (let frame = 0; frame < 600; frame++) {
    const time = frame / 20;
    companions.update({ position: player, yaw: Math.sin(time) * Math.PI, delta: 0.05, time, paused: false });
    const dog = companions.dog.position;
    farthestRoam = Math.max(farthestRoam, dog.distanceTo(initialPosition));
    assert.ok(dog.x >= -40 && dog.x <= 40 && dog.z >= -24 && dog.z <= 29);
    assert.ok(horizontalDistance(dog, player) >= 3.2);
    for (const obstacle of obstacles) assert.ok(horizontalDistance(dog, obstacle) >= obstacle.radius + 0.5 - 1e-9);
    assert.ok(Math.abs(dog.y - groundHeight(dog.x, dog.z)) < 0.05);
    scene.traverse(object => {
      assert.ok([...object.position.toArray(), ...object.scale.toArray()].every(Number.isFinite));
    });
  }
  assert.ok(farthestRoam > 2, 'the dog explores independently while the visitor stays still');
  assert.equal(objectCount(scene), initialCount);
  companions.dispose();
  assert.equal(scene.children.length, 0);
});
