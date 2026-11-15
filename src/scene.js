import * as THREE from 'three';
import { createCompanions } from './companions.js';

/** A procedural night landscape. Content and navigation remain ordinary HTML. */
export function initScene({ canvas, onReady = () => {}, onSelect = () => {}, onProject = () => {}, onLocation = () => {}, onUpdate = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x04111e, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x091420, 0.0065);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
  camera.rotation.order = 'YXZ';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches, visible = true, disposed = false, frame = 0;
  let clock = 0, lastTime = 0, width = 1, height = 1;

  let seed = 562341;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const objects = [];
  const add = (object) => { scene.add(object); objects.push(object); return object; };
  scene.add(new THREE.HemisphereLight(0x7188ac, 0x160609, 0.48));
  const moon = new THREE.DirectionalLight(0x6a86ac, 0.72); moon.position.set(-40, 55, 10); scene.add(moon);
  const crimson = new THREE.PointLight(0xff271c, 11000, 130, 2); crimson.position.set(21, 7, 24); scene.add(crimson);
  const ember = new THREE.PointLight(0xff2010, 5600, 100, 2); ember.position.set(-28, 0, 18); scene.add(ember);

  const noise = (x, z) => Math.sin(x * 0.37 + z * 0.23) * Math.cos(z * 0.29 - x * 0.13) + Math.sin(x * 0.91 + z * 0.61) * 0.32;
  // One sampled surface drives the mesh, walking, stations, rocks, and path lights.
  // Triangle interpolation matches the actual rendered faces, rather than hovering
  // above a different analytical approximation of the floor.
  const groundGrid = { cols: 160, rows: 110, xMin: -110, xMax: 110, zMin: -40, zMax: 110 };
  const groundElevation = (x, z) => -7 + noise(x * 0.45, z * 0.45) * 0.35 + Math.sin(x * 0.06 + z * 0.11) * 0.75 + Math.pow(Math.abs(x) / 80, 2) * 2;
  const groundSamples = new Float32Array((groundGrid.cols + 1) * (groundGrid.rows + 1));
  for (let j = 0; j <= groundGrid.rows; j++) for (let i = 0; i <= groundGrid.cols; i++) {
    groundSamples[j * (groundGrid.cols + 1) + i] = groundElevation(groundGrid.xMin + (groundGrid.xMax - groundGrid.xMin) * i / groundGrid.cols, groundGrid.zMin + (groundGrid.zMax - groundGrid.zMin) * j / groundGrid.rows);
  }
  function groundHeight(x, z) {
    const gx = THREE.MathUtils.clamp((x - groundGrid.xMin) / (groundGrid.xMax - groundGrid.xMin) * groundGrid.cols, 0, groundGrid.cols - 0.00001);
    const gz = THREE.MathUtils.clamp((z - groundGrid.zMin) / (groundGrid.zMax - groundGrid.zMin) * groundGrid.rows, 0, groundGrid.rows - 0.00001);
    const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
    const a = j * (groundGrid.cols + 1) + i, b = a + groundGrid.cols + 1;
    if (u + v <= 1) return groundSamples[a] + (groundSamples[a + 1] - groundSamples[a]) * u + (groundSamples[b] - groundSamples[a]) * v;
    return groundSamples[b + 1] + (groundSamples[b] - groundSamples[b + 1]) * (1 - u) + (groundSamples[a + 1] - groundSamples[b + 1]) * (1 - v);
  }
  function terrain({ cols, rows, xMin, xMax, zMin, zMax, elevation, material, jitter = true, skirtDepth = null }) {
    const positions = [], indices = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const x = xMin + (xMax - xMin) * i / cols;
      const z = zMin + (zMax - zMin) * j / rows;
      positions.push(x + (!jitter || i === 0 || i === cols ? 0 : (random() - 0.5) * 0.65), elevation(x, z), z);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + cols + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    if (skirtDepth !== null) {
      // Close every exposed edge down to a buried base. A height-field surface
      // alone reveals the sky underneath when seen from human eye level.
      const perimeter = [];
      for (let i = 0; i <= cols; i++) perimeter.push(i);
      for (let j = 1; j <= rows; j++) perimeter.push(j * (cols + 1) + cols);
      for (let i = cols - 1; i >= 0; i--) perimeter.push(rows * (cols + 1) + i);
      for (let j = rows - 1; j > 0; j--) perimeter.push(j * (cols + 1));
      const lower = perimeter.map(index => {
        const vertex = positions.length / 3;
        positions.push(positions[index * 3], skirtDepth, positions[index * 3 + 2]);
        return vertex;
      });
      for (let i = 0; i < perimeter.length; i++) {
        const next = (i + 1) % perimeter.length;
        indices.push(perimeter[i], perimeter[next], lower[i], perimeter[next], lower[next], lower[i]);
      }
      const center = positions.length / 3;
      positions.push((xMin + xMax) / 2, skirtDepth, (zMin + zMax) / 2);
      for (let i = 0; i < lower.length; i++) indices.push(center, lower[i], lower[(i + 1) % lower.length]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const uvs = [];
    for (let i = 0; i < positions.length; i += 3) uvs.push(positions[i] / 12, positions[i + 2] / 12);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return add(new THREE.Mesh(geometry, material));
  }
  // Broken ridgelines create depth without needing downloaded models or textures.
  const peaks = [
    [-77, 15, 9], [-54, 23, 10], [-31, 16, 8], [-13, 13, 9],
    [10, 28, 10], [27, 42, 9], [43, 23, 7], [61, 31, 10], [85, 20, 11],
  ];
  const ridge = (x) => Math.max(...peaks.map(([center, height, span]) => height * Math.exp(-Math.pow((x - center) / span, 2) * 0.6)));
  terrain({ cols: 145, rows: 30, xMin: -130, xMax: 130, zMin: -105, zMax: -29, skirtDepth: -20,
    elevation: (x, z) => -7 + ridge(x) * Math.exp(-Math.pow((z + 63) / 24, 2)) + noise(x, z) * 1.25,
    material: new THREE.MeshStandardMaterial({ color: 0x111923, roughness: 1, flatShading: true }),
  });
  // A small local grain tile supplies mineral variation without network assets.
  const grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 256;
  const grainContext = grainCanvas.getContext('2d');
  let grainTexture = null;
  if (grainContext) {
    const pixels = grainContext.createImageData(256, 256);
    let grainSeed = 845103;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      grainSeed = (Math.imul(grainSeed, 1664525) + 1013904223) >>> 0;
      const grain = grainSeed / 4294967296;
      const vein = Math.sin(x / 256 * Math.PI * 10 + Math.sin(y / 256 * Math.PI * 6)) * Math.cos(y / 256 * Math.PI * 8);
      const value = Math.round(201 + vein * 13 + (grain - 0.5) * 49 - (grain < 0.04 ? 50 : 0));
      const offset = (y * 256 + x) * 4;
      pixels.data[offset] = value; pixels.data[offset + 1] = value - 3; pixels.data[offset + 2] = value - 5; pixels.data[offset + 3] = 255;
    }
    grainContext.putImageData(pixels, 0, 0);
    grainTexture = new THREE.CanvasTexture(grainCanvas); grainTexture.colorSpace = THREE.SRGBColorSpace;
    grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
    grainTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  terrain({ ...groundGrid, jitter: false,
    elevation: groundElevation,
    material: new THREE.MeshStandardMaterial({ color: 0x4c1e23, roughness: 1, flatShading: true, map: grainTexture, bumpMap: grainTexture, bumpScale: 0.14 }),
  });
  const horizonFloor = add(new THREE.Mesh(new THREE.CircleGeometry(280, 64), new THREE.MeshStandardMaterial({ color: 0x301b25, roughness: 1 })));
  horizonFloor.rotation.x = -Math.PI / 2; horizonFloor.position.y = -10.5;
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x837373, roughness: 1, flatShading: true, map: grainTexture, bumpMap: grainTexture, bumpScale: 0.025 });
  const rockCount = 1600;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
  const dummy = new THREE.Object3D(), rockColor = new THREE.Color();
  const routeDestinations = [[-12, 11], [-11, -10], [12, -19], [12, 5], [24, -8]];
  for (let i = 0; i < rockCount; i++) {
    const x = (random() - 0.5) * (i < 1250 ? 100 : 145), z = -35 + random() * 75;
    let scale = 0.07 + Math.pow(random(), 3) * 0.33;
    // Keep the lit walking routes free of larger stones, leaving only fine gravel.
    for (const [endX, endZ] of routeDestinations) {
      const dx = endX, dz = endZ - 27;
      const t = THREE.MathUtils.clamp((x * dx + (z - 27) * dz) / (dx * dx + dz * dz), 0, 1);
      if (Math.hypot(x - dx * t, z - (27 + dz * t)) < 1.25) { scale *= 0.3; break; }
    }
    dummy.position.set(x, groundHeight(x, z) + scale * 0.1, z);
    dummy.rotation.set(random() * 3, random() * 6, random() * 3);
    dummy.scale.set(scale * (0.75 + random() * 0.5), scale * 0.55, scale); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rockColor.setHSL(0.01 + random() * 0.025, 0.08 + random() * 0.12, 0.32 + random() * 0.22);
    rocks.setColorAt(i, rockColor);
  }
  rocks.instanceMatrix.needsUpdate = true; rocks.instanceColor.needsUpdate = true; add(rocks);

  // The camp sits inside a complete ring of mountains, including behind the visitor.
  for (let i = 0; i < 17; i++) {
    const angle = Math.PI * 0.5 + i / 16 * Math.PI * 1.95;
    const x = Math.sin(angle) * 103, z = Math.cos(angle) * 103;
    if (z < -42) continue; // The detailed northern ridgeline already fills this view.
    const height = 23 + random() * 28;
    const geometry = new THREE.ConeGeometry(22 + random() * 13, height, 7, 3);
    const position = geometry.getAttribute('position');
    for (let j = 0; j < position.count; j++) {
      if (position.getY(j) < height * 0.45) position.setY(j, position.getY(j) + random() * 4);
    }
    geometry.computeVertexNormals();
    const mountain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x14202b, roughness: 1, flatShading: true }));
    mountain.position.set(x, height / 2 - 9, z); mountain.rotation.y = random() * Math.PI; add(mountain);
  }
  const silver = new THREE.MeshStandardMaterial({ color: 0xa8b8c5, metalness: 0.65, roughness: 0.38 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x25323e, metalness: 0.55, roughness: 0.55 });
  const redGlow = new THREE.MeshStandardMaterial({ color: 0xff5944, emissive: 0xff291a, emissiveIntensity: 2.1 });
  const amberGlow = new THREE.MeshStandardMaterial({ color: 0xffd3a2, emissive: 0xffad61, emissiveIntensity: 1.6 });
  const stations = new Map();
  const pickable = [];
  function part(group, geometry, material, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); group.add(mesh); return mesh;
  }
  function beam(group, from, to, radius = 0.055, material = silver) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const mesh = part(group, new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
    mesh.position.copy(a.add(b).multiplyScalar(0.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return mesh;
  }
  function station(id, x, z, height) {
    const group = new THREE.Group(); group.position.set(x, groundHeight(x, z) + 0.16, z); group.userData.station = id;
    part(group, new THREE.CylinderGeometry(2, 2.35, 0.35, 8), darkMetal, [0, 0, 0]);
    const rim = part(group, new THREE.TorusGeometry(1.94, 0.035, 5, 32), redGlow, [0, 0.21, 0]); rim.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0xff6147, 70, 14, 2); light.position.set(0, 2.5, 1); group.add(light);
    add(group); stations.set(id, { id, group, anchor: new THREE.Vector3(x, group.position.y + height, z), height }); return group;
  }
  const basecamp = station('about', -12, 11, 5.6);
  beam(basecamp, [0, 0, 0], [0, 4.4, 0], 0.12, darkMetal);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    beam(basecamp, [Math.sin(angle) * 1.5, 0.2, Math.cos(angle) * 1.5], [0, 2.4, 0], 0.045);
  }
  part(basecamp, new THREE.CylinderGeometry(0.33, 0.33, 0.9, 12), redGlow, [0, 4.05, 0]);
  part(basecamp, new THREE.ConeGeometry(0.62, 0.35, 8), silver, [0, 4.7, 0]);
  part(basecamp, new THREE.BoxGeometry(1.2, 0.8, 0.9), darkMetal, [0.65, 0.6, 0]);

  const sculpture = station('projects', -11, -10, 4.9);
  const crystal = part(sculpture, new THREE.OctahedronGeometry(1.8, 0), new THREE.MeshStandardMaterial({ color: 0xdeb3a7, metalness: 0.7, roughness: 0.2 }), [0, 2.3, 0]);
  crystal.rotation.set(0.15, 0.6, 0.3);
  part(sculpture, new THREE.CylinderGeometry(0.45, 0.8, 1.4, 6), darkMetal, [0, 0.8, 0]);
  const sculptureRing = part(sculpture, new THREE.TorusGeometry(2.05, 0.04, 6, 48), amberGlow, [0, 2.35, 0]); sculptureRing.rotation.set(0.5, 0.25, 0.2);

  const observatory = station('research', 12, -19, 5.6);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    beam(observatory, [Math.sin(angle) * 1.5, 0.2, Math.cos(angle) * 1.5], [0, 2.5, 0], 0.075);
  }
  part(observatory, new THREE.SphereGeometry(0.35, 12, 8), darkMetal, [0, 2.6, 0]);
  const tube = new THREE.Group(); tube.position.set(0, 3, 0); tube.rotation.set(0.6, 0, -0.8); observatory.add(tube);
  part(tube, new THREE.CylinderGeometry(0.45, 0.32, 2.8, 20), silver);
  part(tube, new THREE.CylinderGeometry(0.48, 0.48, 0.22, 20), darkMetal, [0, 1.35, 0]);
  part(tube, new THREE.CylinderGeometry(0.37, 0.37, 0.035, 20), new THREE.MeshStandardMaterial({ color: 0x16394d, metalness: 0.85, roughness: 0.1, emissive: 0x123347, emissiveIntensity: 0.8 }), [0, 1.48, 0]);
  beam(observatory, [0, 2.5, 0], [0.8, 2.5, 0], 0.07);

  const communications = station('contact', 12, 5, 5.2);
  beam(communications, [0, 0, 0], [0, 2.2, 0], 0.15, darkMetal);
  const dish = new THREE.Group(); dish.position.set(0, 2.2, 0); dish.rotation.x = -0.45; communications.add(dish);
  const curve = Array.from({ length: 16 }, (_, i) => { const r = i / 15 * 1.75; return new THREE.Vector2(r, r * r * 0.3); });
  part(dish, new THREE.LatheGeometry(curve, 32), new THREE.MeshStandardMaterial({ color: 0xb3c1c9, metalness: 0.65, roughness: 0.4, side: THREE.DoubleSide }));
  beam(dish, [0, 0, 0], [0, 2.3, 0], 0.045); part(dish, new THREE.SphereGeometry(0.13, 8, 6), redGlow, [0, 2.3, 0]);
  const campsite = station('life', 24, -8, 5.0);
  const canvasCloth = new THREE.MeshStandardMaterial({ color: 0x80634c, roughness: 1, side: THREE.DoubleSide });
  const tentVertices = [
    -1.6, 0.2, 1.5, 0, 2.65, 1.5, -1.6, 0.2, -1.5,
    0, 2.65, 1.5, 0, 2.65, -1.5, -1.6, 0.2, -1.5,
    0, 2.65, 1.5, 1.6, 0.2, 1.5, 0, 2.65, -1.5,
    1.6, 0.2, 1.5, 1.6, 0.2, -1.5, 0, 2.65, -1.5,
    -1.6, 0.2, -1.5, 0, 2.65, -1.5, 1.6, 0.2, -1.5,
  ];
  const tentGeometry = new THREE.BufferGeometry(); tentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tentVertices, 3)); tentGeometry.computeVertexNormals();
  part(campsite, tentGeometry, canvasCloth);
  const entranceGeometry = new THREE.BufferGeometry();
  entranceGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1.3, 0.2, 1.51, 1.3, 0.2, 1.51, 0, 2.3, 1.51], 3)); entranceGeometry.computeVertexNormals();
  part(campsite, entranceGeometry, new THREE.MeshStandardMaterial({ color: 0x171619, roughness: 1, side: THREE.DoubleSide }));
  beam(campsite, [0, 2.7, -1.55], [0, 2.7, 1.55], 0.035);
  const warm = new THREE.PointLight(0xffc58d, 120, 12, 2); warm.position.set(0, 1.4, 1.7); campsite.add(warm);
  part(campsite, new THREE.CylinderGeometry(0.17, 0.17, 0.35, 12), amberGlow, [0.8, 0.45, 1.4]);
  // Empty reflective frames await the owner's own photographs; no invented images.
  const frameMetal = new THREE.MeshStandardMaterial({ color: 0xc0a27e, metalness: 0.55, roughness: 0.55 });
  const emptyFrame = new THREE.MeshStandardMaterial({ color: 0x24323a, metalness: 0.7, roughness: 0.28, side: THREE.DoubleSide });
  for (const x of [-2.6, 2.6]) beam(campsite, [x, 0.2, 2.2], [x, 4.0, 2.2], 0.045, darkMetal);
  const memoryLine = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.6, 3.95, 2.2), new THREE.Vector3(0, 3.55, 2.2), new THREE.Vector3(2.6, 3.95, 2.2)]);
  part(campsite, new THREE.TubeGeometry(memoryLine, 24, 0.015, 4, false), frameMetal);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.2, frame = new THREE.Group(); frame.position.set(x, 3.1 + Math.abs(x) * 0.1, 2.2); frame.rotation.z = (i - 1) * 0.06; campsite.add(frame);
    part(frame, new THREE.PlaneGeometry(0.64, 0.79), emptyFrame);
    for (const y of [-0.43, 0.43]) part(frame, new THREE.BoxGeometry(0.78, 0.06, 0.06), frameMetal, [0, y, 0]);
    for (const x of [-0.36, 0.36]) part(frame, new THREE.BoxGeometry(0.06, 0.85, 0.06), frameMetal, [x, 0, 0]);
    beam(frame, [0, 0.44, 0], [0, 0.59, 0], 0.012, frameMetal);
  }
  for (const { group } of stations.values()) group.traverse(object => { if (object.isMesh) pickable.push(object); });

  // Low path lights lead from the landing point to each station without blocking walking.
  const pathGeometry = new THREE.SphereGeometry(0.10, 6, 4);
  for (const { group } of stations.values()) {
    const destination = group.position;
    const count = Math.ceil(Math.hypot(destination.x, destination.z - 27) / 3.2);
    for (let i = 1; i < count; i++) {
      const t = i / count, x = destination.x * t, z = 27 + (destination.z - 27) * t;
      add(new THREE.Mesh(pathGeometry, amberGlow)).position.set(x, groundHeight(x, z) + 0.1, z);
    }
  }

  const starPositions = [], starSizes = [], starPhases = [], starColors = [];
  const starCount = 1650;
  for (let i = 0; i < starCount; i++) {
    const azimuth = random() * Math.PI * 2, elevation = Math.asin(random());
    const radius = 250 + random() * 25;
    const x = Math.sin(azimuth) * Math.cos(elevation) * radius;
    const y = Math.sin(elevation) * radius;
    const z = Math.cos(azimuth) * Math.cos(elevation) * radius;
    starPositions.push(x, y, z);
    starSizes.push(i % 61 === 0 ? 7 + random() * 3 : 1 + Math.pow(random(), 3) * 2.8);
    starPhases.push(random() * Math.PI * 2);
    const cool = random(); starColors.push(0.78 + cool * 0.22, 0.85 + cool * 0.15, 1);
  }
  // A faint diagonal band, deliberately restrained so it never competes with text.
  for (let i = 0; i < 1400; i++) {
    const theta = random() * Math.PI * 2, elevation = 0.5 + Math.sin(theta) * 0.3 + (random() + random() - 1) * 0.11;
    starPositions.push(Math.sin(theta) * Math.cos(elevation) * 270, Math.sin(elevation) * 270, Math.cos(theta) * Math.cos(elevation) * 270);
    starSizes.push(0.85 + random() * 0.95); starPhases.push(random() * 6.28);
    starColors.push(0.30, 0.39, 0.56);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
  starGeometry.setAttribute('phase', new THREE.Float32BufferAttribute(starPhases, 1));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const starMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: `attribute float size; attribute float phase; attribute vec3 color; varying vec3 tint; varying float shimmer; uniform float time; uniform float pixelRatio;
      void main(){ tint=color; shimmer=0.72+0.28*sin(time*0.65+phase); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=size*pixelRatio; }`,
    fragmentShader: `varying vec3 tint; varying float shimmer;
      void main(){ vec2 p=gl_PointCoord-.5; float r=length(p); float core=exp(-r*r*36.); float glow=exp(-r*r*9.)*.22; float cross=(exp(-abs(p.x)*70.)*exp(-abs(p.y)*7.)+exp(-abs(p.y)*70.)*exp(-abs(p.x)*7.))*.24; gl_FragColor=vec4(tint,(core+glow+cross)*shimmer*1.5); }`,
  });
  const stars = add(new THREE.Points(starGeometry, starMaterial));
  stars.renderOrder = -1;

  const keys = new Set();
  let externalForward = 0, externalStrafe = 0, yaw = 0, pitch = 0;
  let drag = null, travel = null, contextAvailable = true, active = true;
  let lastProjection = 0;
  const eyeHeight = 1.8, speed = 6.5;
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const projection = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const clamp = THREE.MathUtils.clamp;
  function orient() { camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateMatrixWorld(); }
  function resetPosition() { travel = null; yaw = 0; pitch = 0.035; camera.position.set(0, groundHeight(0, 27) + eyeHeight, 27); orient(); }
  resetPosition();
  const companions = createCompanions({
    scene,
    groundHeight,
    getAspect: () => camera.aspect,
    obstacles: [...stations.values()].map(({ group }) => ({ x: group.position.x, z: group.position.z, radius: 3 })),
  });
  companions.update({ position: camera.position, yaw, delta: 0, time: clock, moving: false, paused: true });
  function projectStations() {
    const data = [];
    for (const station of stations.values()) {
      projection.copy(station.anchor).project(camera);
      const distance = Math.hypot(camera.position.x - station.group.position.x, camera.position.z - station.group.position.z);
      data.push({ id: station.id, x: (projection.x + 1) * width / 2, y: (1 - projection.y) * height / 2,
        distance, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 0.96 && Math.abs(projection.y) < 0.90 && distance < 60 });
    }
    onProject(data);
    const state = getPlayerState(); onLocation(state); onUpdate(state);
  }
  function getPlayerState() { return { x: camera.position.x, z: camera.position.z, yaw, heading: ((-yaw * 180 / Math.PI) % 360 + 360) % 360, nearest: nearestStation()?.id || null }; }
  function nearestStation() {
    let nearest = null, distance = 7;
    camera.getWorldDirection(cameraDirection);
    for (const station of stations.values()) {
      const dx = station.group.position.x - camera.position.x, dz = station.group.position.z - camera.position.z;
      const d = Math.hypot(dx, dz);
      if (d < distance && (dx * cameraDirection.x + dz * cameraDirection.z) / Math.max(d, 0.001) > 0.25) { distance = d; nearest = station; }
    }
    return nearest;
  }
  function render() {
    if (!contextAvailable || disposed) return;
    starMaterial.uniforms.time.value = clock;
    renderer.render(scene, camera);
    projectStations();
  }
  function walk(delta) {
    if (!active) return false;
    const forward = externalForward + Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
    const strafe = externalStrafe + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    if (!forward && !strafe) return false;
    travel = null;
    const length = Math.max(1, Math.hypot(forward, strafe));
    let x = camera.position.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length * speed * delta;
    let z = camera.position.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length * speed * delta;
    x = clamp(x, -42, 42); z = clamp(z, -25, 30);
    for (const { group } of stations.values()) {
      const dx = x - group.position.x, dz = z - group.position.z, d = Math.hypot(dx, dz);
      if (d < 2.5) { x = group.position.x + dx / Math.max(d, 0.001) * 2.5; z = group.position.z + dz / Math.max(d, 0.001) * 2.5; }
    }
    camera.position.x = x; camera.position.z = z;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, groundHeight(x, z) + eyeHeight, 1 - Math.exp(-delta * 9));
    return true;
  }
  function animate(time) {
    frame = 0;
    if (disposed || !visible || document.hidden || !contextAvailable) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (!paused) clock += delta;
    let changed = walk(delta);
    if (travel && active) {
      travel.elapsed += delta;
      const t = Math.min(travel.elapsed / travel.duration, 1), ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(travel.from, travel.to, ease);
      // Follow the terrain even while automatically walking to a station.
      camera.position.y = groundHeight(camera.position.x, camera.position.z) + eyeHeight;
      yaw = travel.fromYaw + travel.yawDelta * ease;
      pitch = THREE.MathUtils.lerp(travel.fromPitch, travel.toPitch, ease);
      if (t === 1) travel = null;
      changed = true;
    }
    const companionChanged = companions.update({ position: camera.position, yaw, delta, time: clock, moving: changed, paused: paused || !active });
    orient();
    if (!paused || changed || companionChanged || time - lastProjection > 500) { render(); lastProjection = time; }
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (!disposed) { render(); if (visible && !document.hidden && contextAvailable) frame = requestAnimationFrame(animate); }
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const ratio = Math.min(devicePixelRatio || 1, width < 700 ? 1.35 : 1.75);
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.fov = width < 700 ? 70 : 62; camera.updateProjectionMatrix();
    starMaterial.uniforms.pixelRatio.value = ratio;
    render();
  }
  function look(dx, dy) {
    if (!active) return;
    travel = null; yaw -= dx * 0.003; pitch = clamp(pitch - dy * 0.003, -1.15, 1.35); orient(); render();
  }
  function pointerDown(event) {
    if (!active || document.querySelector('dialog[open]') || event.button !== 0 || event.isPrimary === false) return;
    canvas.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
    drag.x = event.clientX; drag.y = event.clientY;
    look(dx, dy);
  }
  function pointerUp(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved; drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (moved || event.type === 'pointercancel') return;
    const rect = canvas.getBoundingClientRect(); mouse.set((event.clientX - rect.left) / width * 2 - 1, -(event.clientY - rect.top) / height * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(pickable, false).find(hit => hit.distance < 9);
    if (hit) {
      let group = hit.object; while (group && !group.userData.station) group = group.parent;
      if (group) onSelect(group.userData.station);
    }
  }
  const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  function keyDown(event) {
    if (!active || document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input,textarea,select,[contenteditable],dialog[open],button,a')) return;
    const key = event.key.toLowerCase();
    if (movementKeys.has(key)) { event.preventDefault(); keys.add(key); }
    else if (key === 'e' && !event.repeat) { const nearest = nearestStation(); if (nearest) onSelect(nearest.id); }
  }
  function keyUp(event) { keys.delete(event.key.toLowerCase()); }
  function clearMovement() { keys.clear(); externalForward = 0; externalStrafe = 0; drag = null; }
  function visibilityChanged() { clearMovement(); sync(); }
  function contextLost(event) { event.preventDefault(); contextAvailable = false; clearMovement(); if (frame) cancelAnimationFrame(frame); frame = 0; canvas.style.opacity = '0'; document.body.classList.remove('scene-ready'); }
  function contextRestored() { contextAvailable = true; canvas.style.opacity = ''; document.body.classList.add('scene-ready'); resize(); sync(); }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) clearMovement(); sync(); }); observer.observe(canvas);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', clearMovement);
  document.addEventListener('visibilitychange', visibilityChanged);
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  resize(); sync(); onReady();
  return {
    setPaused(value) { paused = Boolean(value); sync(); },
    setActive(value) { active = Boolean(value); if (!active) { clearMovement(); travel = null; } },
    getPlayerState,
    setMove(forward, strafe) { if (!active) return; externalForward = clamp(Number(forward) || 0, -1, 1); externalStrafe = clamp(Number(strafe) || 0, -1, 1); },
    look,
    goTo(id) {
      const station = stations.get(id); if (!station) return;
      clearMovement();
      const to = new THREE.Vector3(station.group.position.x, 0, Math.min(29, station.group.position.z + 6.5));
      to.y = groundHeight(to.x, to.z) + eyeHeight;
      const direction = station.anchor.clone().sub(to);
      const toYaw = Math.atan2(-direction.x, -direction.z);
      const toPitch = Math.atan2(direction.y - 2, Math.hypot(direction.x, direction.z));
      const yawDelta = Math.atan2(Math.sin(toYaw - yaw), Math.cos(toYaw - yaw));
      if (media.matches) { camera.position.copy(to); yaw += yawDelta; pitch = toPitch; travel = null; orient(); render(); }
      else travel = { from: camera.position.clone(), to, fromYaw: yaw, yawDelta, fromPitch: pitch, toPitch, elapsed: 0, duration: clamp(camera.position.distanceTo(to) / 12, 0.7, 3.5) };
    },
    reset() { clearMovement(); resetPosition(); render(); },
    dispose() {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', clearMovement); document.removeEventListener('visibilitychange', visibilityChanged);
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
      companions.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material)); else if (object.material) materials.add(object.material); });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); grainTexture?.dispose(); renderer.dispose();
    },
  };
}
