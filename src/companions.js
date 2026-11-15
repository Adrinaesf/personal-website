import * as THREE from 'three';

/** A small African wild dog that explores the landscape independently. */
export function createCompanions({ scene, groundHeight, getAspect = () => 16 / 9, obstacles = [] }) {
  let seed = 81275;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const coatCanvas = document.createElement('canvas');
  coatCanvas.width = coatCanvas.height = 512;
  const ctx = coatCanvas.getContext('2d');
  ctx.fillStyle = '#b8945d'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 39; i++) {
    const x = random() * 512, y = random() * 512, r = 18 + random() * 70;
    ctx.fillStyle = i % 4 === 0 ? '#e5d8bc' : i % 3 === 0 ? '#795c3e' : '#292725';
    ctx.beginPath();
    for (let j = 0; j < 12; j++) {
      const angle = j / 12 * Math.PI * 2, radius = r * (0.55 + random() * 0.45);
      const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
      if (!j) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 11000; i++) {
    const v = random() > .5 ? 255 : 0;
    ctx.strokeStyle = `rgba(${v},${v},${v},.035)`;
    const x = random() * 512, y = random() * 512;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 3); ctx.stroke();
  }
  const coatMap = new THREE.CanvasTexture(coatCanvas); coatMap.colorSpace = THREE.SRGBColorSpace;
  coatMap.wrapS = coatMap.wrapT = THREE.RepeatWrapping;
  const coat = new THREE.MeshStandardMaterial({ map: coatMap, color: 0xe3cfac, roughness: .94, emissive: 0x2b2118, emissiveIntensity: .18 });
  const tan = new THREE.MeshStandardMaterial({ color: 0xbba478, roughness: .92 });
  const black = new THREE.MeshStandardMaterial({ color: 0x252725, roughness: .87 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe4dbc4, roughness: .9 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x0b1117, roughness: .16, metalness: .12 });
  const iris = new THREE.MeshStandardMaterial({ color: 0xb58b4b, roughness: .35 });
  const sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
  function ellipsoid(parent, material, scale, position, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(sphereGeometry, material); mesh.scale.set(...scale); mesh.position.set(...position); mesh.rotation.set(...rotation); parent.add(mesh); return mesh;
  }
  function rod(parent, from, to, r1, r2, material, segments = 10) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, direction.length(), segments), material);
    mesh.position.copy(a.add(b).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); parent.add(mesh); return mesh;
  }
  function taperedTube(parent, points, radii, material, segments = 45, sides = 9) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(segments, false), positions = [], normals = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, point = curve.getPointAt(t), sample = t * (radii.length - 1), index = Math.min(radii.length - 2, Math.floor(sample));
      const r = THREE.MathUtils.lerp(radii[index], radii[index + 1], sample - index);
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2;
        const normal = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
        positions.push(point.x + normal.x * r, point.y + normal.y * r, point.z + normal.z * r); normals.push(normal.x, normal.y, normal.z);
        if (i < segments && j < sides) {
          const n = i * (sides + 1) + j; indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
  }

  // Long legs, tucked waist, broad muzzle, rounded ears, and a white tail flag:
  // the distinct proportions and markings of an African wild dog.
  const dog = new THREE.Group(); dog.scale.setScalar(.65); scene.add(dog);
  const dogBody = new THREE.Group(); dog.add(dogBody);
  ellipsoid(dogBody, coat, [.245, .31, .57], [0, .92, 0]);
  ellipsoid(dogBody, coat, [.25, .345, .29], [0, .94, -.34]);
  ellipsoid(dogBody, tan, [.18, .23, .26], [0, .88, .35]);
  ellipsoid(dogBody, cream, [.16, .25, .19], [0, .78, -.41]);
  ellipsoid(dogBody, coat, [.185, .31, .22], [0, 1.13, -.47], [-.32, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.35, -.63); dogBody.add(head);
  ellipsoid(head, tan, [.19, .22, .235], [0, 0, -.01]);
  ellipsoid(head, black, [.14, .11, .23], [0, -.07, -.24]);
  ellipsoid(head, black, [.12, .073, .065], [0, -.045, -.445]);
  ellipsoid(head, cream, [.115, .038, .19], [0, -.15, -.22]);
  for (const side of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(side * .145, .16, .035); ear.rotation.z = -side * .25; head.add(ear);
    ellipsoid(ear, black, [.14, .205, .052], [side * .025, .14, 0]);
    ellipsoid(ear, tan, [.097, .155, .02], [side * .025, .15, -.043]);
    ellipsoid(ear, black, [.062, .095, .019], [side * .025, .16, -.06]);
    ellipsoid(head, black, [.061, .065, .055], [side * .153, .035, -.142]);
    ellipsoid(head, iris, [.025, .027, .013], [side * .184, .035, -.178], [0, side * .5, 0]);
    ellipsoid(head, eye, [.014, .02, .009], [side * .19, .035, -.185]);
    ellipsoid(head, cream, [.025, .013, .018], [side * .157, .11, -.145]);
  }
  const legs = [];
  for (const front of [true, false]) for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * .185, .85, front ? -.36 : .35); dog.add(hip);
    const kneeZ = front ? .035 : -.11;
    rod(hip, [0, 0, 0], [0, -.38, kneeZ], front ? .067 : .09, .041, front ? coat : tan);
    ellipsoid(hip, tan, [.055, .065, .065], [0, -.38, kneeZ]);
    const shin = new THREE.Group(); shin.position.set(0, -.38, kneeZ); hip.add(shin);
    rod(shin, [0, 0, 0], [0, -.37, front ? -.015 : .12], .037, .025, front && side === 1 ? cream : black);
    ellipsoid(shin, side === 1 && front ? cream : tan, [.06, .045, .1], [0, -.77 + .38, front ? -.045 : .085]);
    legs.push({ hip, shin, front, side });
  }
  const tail = new THREE.Group(); tail.position.set(0, 1.01, .48); dog.add(tail);
  taperedTube(tail, [[0, 0, 0], [0, -.06, .24], [.02, -.19, .45], [.04, -.27, .65]], [.07, .067, .052, .023], black, 15, 8);
  taperedTube(tail, [[.02, -.19, .43], [.04, -.27, .65], [.055, -.28, .77]], [.056, .035, .008], cream, 10, 8);

  const target = new THREE.Vector3();
  let initialized = false, gait = 0, waiting = 1.5, catchingUp = false;
  const clamp = THREE.MathUtils.clamp;
  function safePoint(x, z, player) {
    const requestedX = clamp(x, -40, 40), requestedZ = clamp(z, -24, 29);
    const discs = [{ x: player.x, z: player.z, radius: 3.2 }, ...obstacles.map(obstacle => ({ ...obstacle, radius: (obstacle.radius || 2.5) + .5 }))];
    const valid = (px, pz) => px >= -40 && px <= 40 && pz >= -24 && pz <= 29 && discs.every(disc => Math.hypot(px - disc.x, pz - disc.z) >= disc.radius - .00001);
    if (valid(requestedX, requestedZ)) return { x: requestedX, z: requestedZ };
    let best = null, bestDistance = Infinity;
    function consider(px, pz) {
      if (!valid(px, pz)) return;
      const distance = (px - requestedX) ** 2 + (pz - requestedZ) ** 2;
      if (distance < bestDistance) { bestDistance = distance; best = { x: px, z: pz }; }
    }
    // Resolve all exclusion discs together: projecting onto one obstacle and
    // then the visitor can otherwise place the dog back inside the first one.
    // Boundary samples only run when a collision actually needs correction.
    for (const disc of discs) {
      const baseAngle = Math.atan2(requestedX - disc.x, requestedZ - disc.z);
      for (let i = 0; i < 48; i++) {
        const angle = baseAngle + i / 48 * Math.PI * 2;
        consider(disc.x + Math.sin(angle) * (disc.radius + .002), disc.z + Math.cos(angle) * (disc.radius + .002));
      }
    }
    if (best) return best;
    // A corner shared by multiple obstacles can have no feasible circle sample.
    // A coarse bounded search still supplies a jointly valid point in the camp.
    for (let px = -40; px <= 40; px += 4) for (let pz = -24; pz <= 29; pz += 4) consider(px, pz);
    return best || { x: dog.position.x, z: dog.position.z };
  }
  function selectWanderTarget(player) {
    for (let i = 0; i < 20; i++) {
      const angle = random() * Math.PI * 2, radius = 6 + random() * 7;
      const point = safePoint(player.x + Math.sin(angle) * radius, player.z + Math.cos(angle) * radius, player);
      if (Math.hypot(point.x - player.x, point.z - player.z) < 5) continue;
      if (obstacles.some(obstacle => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) < (obstacle.radius || 2.5) + .6)) continue;
      target.set(point.x, 0, point.z); return;
    }
    target.copy(dog.position);
  }
  function update({ position, yaw = 0, delta = 0, time = 0, paused = false }) {
    if (initialized && paused) return false;
    delta = clamp(delta, 0, .05);
    const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw), rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    if (!initialized) {
      const side = 2.5 * clamp(getAspect() / 1.5, .42, 1);
      const point = safePoint(position.x + forwardX * 6 + rightX * side, position.z + forwardZ * 6 + rightZ * side, position);
      dog.position.set(point.x, groundHeight(point.x, point.z) + .005, point.z);
      dog.rotation.y = yaw + .5; target.copy(dog.position); initialized = true;
    }
    if (paused) return true;
    const oldX = dog.position.x, oldZ = dog.position.z;
    const playerDistance = Math.hypot(dog.position.x - position.x, dog.position.z - position.z);
    if (playerDistance > 18) catchingUp = true;
    if (catchingUp) {
      const point = safePoint(position.x + forwardX * 5 + rightX * 3, position.z + forwardZ * 5 + rightZ * 3, position);
      target.set(point.x, 0, point.z); waiting = 0;
      if (playerDistance < 9) { catchingUp = false; waiting = 1 + random() * 2; }
    } else {
      if (waiting > 0) {
        waiting -= delta;
        if (waiting <= 0) selectWanderTarget(position);
      } else if (Math.hypot(target.x - dog.position.x, target.z - dog.position.z) < .35) waiting = 1.5 + random() * 3.5;
    }
    if (waiting <= 0) {
      let dx = target.x - dog.position.x, dz = target.z - dog.position.z;
      const distance = Math.hypot(dx, dz);
      // Gently steer around raised landmark platforms while roaming.
      for (const obstacle of obstacles) {
        const ox = obstacle.x - dog.position.x, oz = obstacle.z - dog.position.z;
        const along = (ox * dx + oz * dz) / Math.max(distance, .001);
        const perpendicular = Math.abs(ox * dz - oz * dx) / Math.max(distance, .001);
        if (along > 0 && along < 4 && perpendicular < (obstacle.radius || 2.5) + .8) {
          const sign = ox * dz - oz * dx > 0 ? 1 : -1;
          const rotateX = dz * sign, rotateZ = -dx * sign;
          dx = dx * .35 + rotateX * .75; dz = dz * .35 + rotateZ * .75;
          break;
        }
      }
      const length = Math.hypot(dx, dz), step = Math.min(distance, (catchingUp ? 8 : 2.6) * delta);
      if (length > .001) {
        const point = safePoint(dog.position.x + dx / length * step, dog.position.z + dz / length * step, position);
        dog.position.x = point.x; dog.position.z = point.z;
      }
    }
    // Keep a comfortable clearance if the visitor walks directly toward the dog.
    const safe = safePoint(dog.position.x, dog.position.z, position);
    dog.position.x = safe.x; dog.position.z = safe.z;
    dog.position.y = groundHeight(dog.position.x, dog.position.z) + .005;
    const dx = dog.position.x - oldX, dz = dog.position.z - oldZ, travelling = Math.hypot(dx, dz) > .001;
    if (travelling) {
      const targetYaw = Math.atan2(-dx, -dz);
      dog.rotation.y += Math.atan2(Math.sin(targetYaw - dog.rotation.y), Math.cos(targetYaw - dog.rotation.y)) * Math.min(1, delta * 7);
    }
    if (travelling) gait += delta * (catchingUp ? 14 : 10);
    const amplitude = travelling ? .48 : 0;
    for (const leg of legs) {
      const phase = gait + (leg.front === (leg.side === 1) ? 0 : Math.PI);
      leg.hip.rotation.x = Math.sin(phase) * amplitude;
      leg.shin.rotation.x = Math.max(0, -Math.sin(phase)) * amplitude * .8;
    }
    dogBody.position.y = travelling ? Math.cos(gait * 2) * .014 : Math.sin(time * 1.3) * .003;
    head.rotation.x = travelling ? 0 : .18 + Math.sin(time * 1.7) * .08;
    head.rotation.y = Math.sin(time * .65) * .13;
    tail.rotation.y = Math.sin(time * (travelling ? 4 : 1.7)) * .2;
    return true;
  }
  function dispose() {
    const geometries = new Set(), materials = new Set();
    dog.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    scene.remove(dog); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); coatMap.dispose();
  }
  return { dog, update, dispose };
}
