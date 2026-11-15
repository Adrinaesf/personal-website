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
  let initialized = false, gait = 0, waiting = 1.5, catchingUp = false, travelTime = 0, side = 1, holdSide = 0, checkTime = 0, checkX = 0, checkZ = 0, headingX = 0, headingZ = 0;
  let greeting = null, orbit = 0, orbitLeft = 0, orbitDirection = 1, sitTime = 0, sit = 0, goalGap = 0, greetCheck = 0, greetX = 0, greetZ = 0, settleTime = 0;
  const clamp = THREE.MathUtils.clamp;
  // Everything the dog keeps clear of: the visitor first, then each landmark with a margin.
  const playerDisc = { x: 0, z: 0, radius: 3.2 };
  const discs = [playerDisc, ...obstacles.map(obstacle => ({ x: obstacle.x, z: obstacle.z, radius: (obstacle.radius || 2.5) + .5 }))];
  const valid = (px, pz) => px >= -40 && px <= 40 && pz >= -24 && pz <= 29 && discs.every(disc => Math.hypot(px - disc.x, pz - disc.z) >= disc.radius - .00001);
  function samplePoint(x, z) {
    const requestedX = clamp(x, -40, 40), requestedZ = clamp(z, -24, 29);
    let best = null, bestDistance = Infinity;
    function consider(px, pz) {
      if (!valid(px, pz)) return;
      const distance = (px - requestedX) ** 2 + (pz - requestedZ) ** 2;
      if (distance < bestDistance) { bestDistance = distance; best = { x: px, z: pz }; }
    }
    // Resolve all exclusion discs together: projecting onto one obstacle and
    // then the visitor can otherwise place the dog back inside the first one.
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
  function safePoint(x, z, player) {
    playerDisc.x = player.x; playerDisc.z = player.z;
    let px = clamp(x, -40, 40), pz = clamp(z, -24, 29);
    // Pushing straight out of each disc moves the dog smoothly, a little per frame.
    // Only a pocket squeezed between the visitor and a landmark needs the sampled search.
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const disc of discs) {
        const dx = px - disc.x, dz = pz - disc.z, d = Math.hypot(dx, dz);
        if (d >= disc.radius) continue;
        const nx = d > .0001 ? dx / d : 1, nz = d > .0001 ? dz / d : 0;
        px = disc.x + nx * (disc.radius + .002); pz = disc.z + nz * (disc.radius + .002); moved = true;
      }
      const cx = clamp(px, -40, 40), cz = clamp(pz, -24, 29);
      if (cx !== px || cz !== pz) { px = cx; pz = cz; moved = true; }
      if (!moved) return { x: px, z: pz };
    }
    return samplePoint(x, z);
  }
  function selectWanderTarget(player) {
    travelTime = 0;
    for (let i = 0; i < 20; i++) {
      const angle = random() * Math.PI * 2, radius = 6 + random() * 7;
      const point = safePoint(player.x + Math.sin(angle) * radius, player.z + Math.cos(angle) * radius, player);
      if (Math.hypot(point.x - player.x, point.z - player.z) < 5) continue;
      if (obstacles.some(obstacle => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) < (obstacle.radius || 2.5) + .9)) continue;
      target.set(point.x, 0, point.z); return;
    }
    target.copy(dog.position);
  }
  function update({ position, yaw = 0, delta = 0, time = 0, paused = false }) {
    if (initialized && paused) return false;
    delta = clamp(delta, 0, .05);
    const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw), rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    if (!initialized) {
      const offset = 2.5 * clamp(getAspect() / 1.5, .42, 1);
      const point = safePoint(position.x + forwardX * 6 + rightX * offset, position.z + forwardZ * 6 + rightZ * offset, position);
      dog.position.set(point.x, groundHeight(point.x, point.z) + .005, point.z);
      dog.rotation.y = yaw + .5; target.copy(dog.position); initialized = true;
    }
    if (paused) return true;
    const oldX = dog.position.x, oldZ = dog.position.z;
    if (greeting) {
      // Saying hi: run up, trot a circle around the visitor, then sit in front of them.
      const ring = 5.2, away = Math.atan2(dog.position.x - position.x, dog.position.z - position.z);
      waiting = 1; catchingUp = false;
      if (greeting === 'approach') {
        orbit = away;
        if (Math.abs(Math.hypot(dog.position.x - position.x, dog.position.z - position.z) - ring) < .5) {
          // Finish in front of the visitor after at least half a turn.
          const front = Math.atan2(forwardX, forwardZ);
          orbitLeft = ((front - orbit) * orbitDirection % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (orbitLeft < Math.PI) orbitLeft += Math.PI * 2;
          greeting = 'circle';
        }
      } else if (greeting === 'circle') {
        // The spot he is heading for only moves on once he has nearly reached it,
        // so a wall or a landmark in the way bends the circle instead of losing him.
        if (goalGap < 1.6) { const turn = Math.min(orbitLeft, 1.7 * delta); orbit += turn * orbitDirection; orbitLeft -= turn; }
        if (orbitLeft <= 0) greeting = 'settle';
        // With no room to get past (the visitor is against the edge of the valley),
        // he gives up the lap and simply comes round to the front.
        if ((greetCheck += delta) > .7) {
          if (Math.hypot(dog.position.x - greetX, dog.position.z - greetZ) < .5) greeting = 'settle';
          greetCheck = 0; greetX = dog.position.x; greetZ = dog.position.z;
        }
      } else if (greeting === 'settle') {
        orbit = Math.atan2(forwardX, forwardZ);
        // If the front cannot be reached, he sits wherever he got to.
        if (goalGap < .35 || (settleTime += delta) > 2.5) { greeting = 'sit'; sitTime = 9; }
      } else if ((sitTime -= delta) <= 0 || Math.hypot(dog.position.x - position.x, dog.position.z - position.z) > 9) {
        greeting = null; waiting = .6;
      }
      if (greeting && greeting !== 'sit') {
        const goal = safePoint(position.x + Math.sin(orbit) * ring, position.z + Math.cos(orbit) * ring, position);
        const gx = goal.x - dog.position.x, gz = goal.z - dog.position.z;
        goalGap = Math.hypot(gx, gz);
        const step = Math.min(goalGap, 9.5 * delta);
        if (goalGap > .001) { dog.position.x += gx / goalGap * step; dog.position.z += gz / goalGap * step; }
      }
    } else {
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
        // Give up on a spot that turned out to be awkward to reach, and rest instead.
        else if ((travelTime += delta) > 8) waiting = .8 + random() * 1.5;
      }
      playerDisc.x = position.x; playerDisc.z = position.z;
      if (waiting <= 0) {
        let dx = target.x - dog.position.x, dz = target.z - dog.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > .001) {
          dx /= distance; dz /= distance;
          // When something stands between the dog and where he is going, he walks
          // around its edge and keeps to the same side until the way is clear.
          for (const disc of discs) {
            const cx = disc.x - dog.position.x, cz = disc.z - dog.position.z, d = Math.hypot(cx, cz);
            const along = clamp(cx * dx + cz * dz, 0, distance);
            if (d < .0001 || d > disc.radius + 1.2 || Math.hypot(cx - dx * along, cz - dz * along) >= disc.radius - .05) continue;
            const nx = cx / d, nz = cz / d, into = dx * nx + dz * nz;
            let tx = dx - nx * into, tz = dz - nz * into;
            const tangent = Math.hypot(tx, tz);
            if (tangent < .2 || holdSide > 0) { tx = -nz * side; tz = nx * side; }
            else { tx /= tangent; tz /= tangent; side = tx * -nz + tz * nx >= 0 ? 1 : -1; }
            // Lean slightly outward so the walk hugs the edge without touching it.
            const lean = d < disc.radius + .25 ? .25 : 0;
            dx = tx - nx * lean; dz = tz - nz * lean;
            const length = Math.hypot(dx, dz); dx /= length; dz /= length;
            break;
          }
          const step = Math.min(distance, (catchingUp ? 8 : 2.6) * delta);
          dog.position.x += dx * step; dog.position.z += dz * step;
        }
      }
    }
    // Pinched between the visitor and a landmark, he would pace on the spot.
    // Once a second, check for progress; without any, turn around the other way.
    holdSide -= delta;
    if (waiting > 0) { checkTime = 0; checkX = dog.position.x; checkZ = dog.position.z; }
    else if ((checkTime += delta) > 1) {
      if (Math.hypot(dog.position.x - checkX, dog.position.z - checkZ) < .6) {
        side = -side; holdSide = 3;
        if (!catchingUp) { waiting = 1 + random() * 2; holdSide = 0; }
      }
      checkTime = 0; checkX = dog.position.x; checkZ = dog.position.z;
    }
    // Keep a comfortable clearance if the visitor walks directly toward the dog.
    const safe = safePoint(dog.position.x, dog.position.z, position);
    dog.position.x = safe.x; dog.position.z = safe.z;
    dog.position.y = groundHeight(dog.position.x, dog.position.z) + .005;
    const dx = dog.position.x - oldX, dz = dog.position.z - oldZ, travelling = Math.hypot(dx, dz) > delta * .4;
    if (travelling) {
      // Turn toward the averaged direction of travel, so small corrections
      // at a landmark's edge never make him twitch.
      const blend = 1 - Math.exp(-delta * 6), speed = Math.max(delta, .0001);
      headingX += (dx / speed - headingX) * blend; headingZ += (dz / speed - headingZ) * blend;
      const targetYaw = Math.atan2(-headingX, -headingZ);
      dog.rotation.y += Math.atan2(Math.sin(targetYaw - dog.rotation.y), Math.cos(targetYaw - dog.rotation.y)) * Math.min(1, delta * 5);
    }
    if (greeting === 'sit' && !travelling) {
      const faceYaw = Math.atan2(dog.position.x - position.x, dog.position.z - position.z);
      dog.rotation.y += Math.atan2(Math.sin(faceYaw - dog.rotation.y), Math.cos(faceYaw - dog.rotation.y)) * Math.min(1, delta * 8);
    }
    sit += ((greeting === 'sit' && !travelling ? 1 : 0) - sit) * Math.min(1, delta * 6);
    if (travelling) gait += delta * (catchingUp || greeting ? 14 : 10);
    const amplitude = (travelling ? .48 : 0) * (1 - sit);
    for (const leg of legs) {
      const phase = gait + (leg.front === (leg.side === 1) ? 0 : Math.PI);
      // Sitting folds the hind legs under him and drops his hips to the ground.
      leg.hip.rotation.x = Math.sin(phase) * amplitude + (leg.front ? -.12 : 1.25) * sit;
      leg.shin.rotation.x = Math.max(0, -Math.sin(phase)) * amplitude * .8 + (leg.front ? 0 : -2.0) * sit;
      leg.hip.position.y = .85 - (leg.front ? 0 : .4) * sit;
      if (leg.front) leg.hip.position.z = -.36 + .09 * sit;
    }
    dogBody.rotation.x = .5 * sit;
    dogBody.position.y = (travelling ? Math.cos(gait * 2) * .014 : Math.sin(time * 1.3) * .003) - .1 * sit;
    dogBody.position.z = -.39 * sit;
    // While sitting he looks up at the visitor and wags hard.
    head.rotation.x = (travelling ? 0 : .18 + Math.sin(time * 1.7) * .08) * (1 - sit) - .22 * sit;
    head.rotation.y = Math.sin(time * .65) * .13 * (1 - sit) + Math.sin(time * 1.1) * .1 * sit;
    tail.position.y = 1.01 - .5 * sit; tail.rotation.x = -.5 * sit;
    tail.rotation.y = Math.sin(time * (travelling ? 4 : 1.7 + sit * 9)) * (.2 + sit * .35);
    return true;
  }
  function dispose() {
    const geometries = new Set(), materials = new Set();
    dog.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    scene.remove(dog); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); coatMap.dispose();
  }
  function greet() {
    if (greeting) return;
    greeting = 'approach'; settleTime = 0; goalGap = 0; greetCheck = 0; greetX = dog.position.x; greetZ = dog.position.z; orbitDirection = random() < .5 ? -1 : 1;
  }
  return { dog, update, dispose, greet, isSitting: () => greeting === 'sit' && sit > .85 };
}
