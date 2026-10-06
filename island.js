(function () {
  const hero = document.querySelector(".hero");
  const canvas = document.getElementById("island");
  if (!hero || !canvas) return;
  if (typeof THREE === "undefined") {
    hero.classList.add("flat");
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    hero.classList.add("flat");
    return;
  }

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const world = new THREE.Group();
  scene.add(world);

  const random = seeded(11);

  function seeded(seed) {
    let a = seed;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list) {
    return list[Math.floor(random() * list.length)];
  }

  function flat(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 1, metalness: 0, flatShading: true }, extra));
  }

  scene.add(new THREE.HemisphereLight(0xc4d6ff, 0x6a4526, 0.8));

  const sun = new THREE.DirectionalLight(0xffd6a8, 1.1);
  sun.position.set(-14, 20, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0008;
  world.add(sun);
  world.add(sun.target);

  const fill = new THREE.DirectionalLight(0xff9f7a, 0.35);
  fill.position.set(12, 4, -10);
  scene.add(fill);

  function makeIsland(radius, depth, grass, dirt) {
    const group = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, 1, 10, 1), [flat(dirt), flat(grass), flat(dirt)]);
    top.receiveShadow = true;
    group.add(top);

    const rockGeometry = new THREE.ConeGeometry(radius * 0.94, depth, 10, 4);
    const position = rockGeometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      if (y > -depth / 2 + 0.01 && y < depth / 2 - 0.01) {
        position.setX(i, position.getX(i) + (random() - 0.5) * radius * 0.16);
        position.setZ(i, position.getZ(i) + (random() - 0.5) * radius * 0.16);
      }
    }
    rockGeometry.computeVertexNormals();
    const rock = new THREE.Mesh(rockGeometry, flat(0x7a5232));
    rock.rotation.x = Math.PI;
    rock.position.y = -0.5 - depth / 2;
    group.add(rock);
    return group;
  }

  const island = makeIsland(8, 7, 0x7da04a, 0x8a5d36);
  world.add(island);

  const ground = 0.5;
  const voxel = 0.42;
  const hayCenter = new THREE.Vector3(0.8, ground, -0.6);
  const hayRadius = 3.4;
  const hayHeight = 3.7;
  const hayCells = [];

  for (let iy = 0; iy * voxel < hayHeight; iy++) {
    const y = iy * voxel + voxel / 2;
    const ring = hayRadius * Math.sqrt(Math.max(0, 1 - (y / hayHeight) ** 2));
    for (let ix = -9; ix <= 9; ix++) {
      for (let iz = -9; iz <= 9; iz++) {
        const x = ix * voxel;
        const z = iz * voxel;
        if (Math.hypot(x, z) < ring + (random() - 0.5) * 0.55) hayCells.push([x, y, z]);
      }
    }
  }

  for (let i = 0; i < 46; i++) {
    const angle = random() * Math.PI * 2;
    const distance = hayRadius + 0.3 + random() * 2.2;
    hayCells.push([Math.cos(angle) * distance, voxel / 2, Math.sin(angle) * distance]);
  }

  const hayColors = [0xe3b23c, 0xd89f2b, 0xf0c75a, 0xc98f22, 0xe8bd4a, 0xb98020];
  const hay = new THREE.InstancedMesh(new THREE.BoxGeometry(voxel, voxel, voxel), flat(0xffffff, { roughness: 0.95 }), hayCells.length);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  hayCells.forEach(function (cell, index) {
    dummy.position.set(hayCenter.x + cell[0], hayCenter.y + cell[1], hayCenter.z + cell[2]);
    dummy.rotation.set(0, (random() - 0.5) * 0.3, 0);
    dummy.updateMatrix();
    hay.setMatrixAt(index, dummy.matrix);
    hay.setColorAt(index, tint.setHex(pick(hayColors)));
  });
  hay.castShadow = true;
  hay.receiveShadow = true;
  world.add(hay);

  const needle = new THREE.Group();
  const steel = new THREE.MeshPhongMaterial({ color: 0xdfe6ee, specular: 0xffffff, shininess: 110 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 2.4, 8), steel);
  needle.add(shaft);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), steel);
  eye.position.y = 1.24;
  needle.add(eye);
  needle.position.set(hayCenter.x + 2.5, ground + 1.75, hayCenter.z + 1.1);
  needle.rotation.set(0.35, 0, -0.95);
  shaft.castShadow = true;
  world.add(needle);

  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkleTexture(),
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  sparkle.position.set(0, 1.3, 0);
  needle.add(sparkle);

  function sparkleTexture() {
    const size = 64;
    const paint = document.createElement("canvas");
    paint.width = paint.height = size;
    const g = paint.getContext("2d");
    const glow = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.25, "rgba(255,244,214,0.55)");
    glow.addColorStop(1, "rgba(255,244,214,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(32, 2);
    g.lineTo(32, 62);
    g.moveTo(2, 32);
    g.lineTo(62, 32);
    g.stroke();
    return new THREE.CanvasTexture(paint);
  }

  function makeTree(height) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, height * 0.4, 6), flat(0x6b4426));
    trunk.position.y = height * 0.2;
    tree.add(trunk);
    const greens = [0x3f6f3a, 0x4d8043, 0x365f33];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(height * (0.38 - i * 0.08), height * 0.42, 7), flat(greens[i]));
      cone.position.y = height * (0.42 + i * 0.2);
      cone.rotation.y = random() * Math.PI;
      tree.add(cone);
    }
    tree.traverse(function (part) {
      part.castShadow = true;
    });
    return tree;
  }

  [[2.15, 5.9, 3.1], [2.75, 6.5, 2.4], [4.1, 6.1, 2.8], [5.2, 5.4, 2.0]].forEach(function (spot) {
    const tree = makeTree(spot[2]);
    tree.position.set(Math.cos(spot[0]) * spot[1], ground, Math.sin(spot[0]) * spot[1]);
    world.add(tree);
  });

  [[0.4, 6.4, 0.5], [3.5, 5.6, 0.35], [5.9, 4.6, 0.42]].forEach(function (spot) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(spot[2], 0), flat(0x8c8a84));
    stone.position.set(Math.cos(spot[0]) * spot[1], ground + spot[2] * 0.4, Math.sin(spot[0]) * spot[1]);
    stone.rotation.set(random() * 3, random() * 3, 0);
    stone.castShadow = true;
    world.add(stone);
  });

  const lantern = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 10, 8),
    flat(0xffb35c, { emissive: 0xff7a1a, emissiveIntensity: 0.85 })
  );
  paper.scale.set(1, 1.18, 1);
  lantern.add(paper);
  const capMaterial = flat(0x5a3a22);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 8), capMaterial);
  capTop.position.y = 0.72;
  lantern.add(capTop);
  const capBottom = capTop.clone();
  capBottom.position.y = -0.72;
  lantern.add(capBottom);
  const glow = new THREE.PointLight(0xff9a3c, 1.6, 11, 2);
  lantern.add(glow);

  const tail = [];
  const tailColors = [0xd8452b, 0xfff1d6];
  for (let i = 0; i < 7; i++) {
    const piece = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      flat(tailColors[i % 2], { side: THREE.DoubleSide })
    );
    piece.rotation.z = Math.PI / 4;
    lantern.add(piece);
    tail.push(piece);
  }
  lantern.position.set(-3.4, 4.6, 2.2);
  world.add(lantern);

  const islets = [];
  [[15, 1.5, -12, 0.28], [-15, -2.5, -9, 0.22], [9, -4.5, 11, 0.18]].forEach(function (spot, index) {
    const islet = makeIsland(8, 7, 0x86a957, 0x8a5d36);
    islet.scale.setScalar(spot[3]);
    islet.position.set(spot[0], spot[1], spot[2]);
    islet.userData.base = spot[1];
    islet.userData.phase = index * 1.7;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), flat(pick(hayColors)));
    block.position.y = 1.3;
    islet.add(block);
    world.add(islet);
    islets.push(islet);
  });

  const emberCount = 70;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSpeed = new Float32Array(emberCount);
  function placeEmber(index, anywhere) {
    const angle = random() * Math.PI * 2;
    const distance = random() * 9;
    emberPositions[index * 3] = Math.cos(angle) * distance;
    emberPositions[index * 3 + 1] = anywhere ? random() * 9 : 0.6;
    emberPositions[index * 3 + 2] = Math.sin(angle) * distance;
    emberSpeed[index] = 0.25 + random() * 0.45;
  }
  for (let i = 0; i < emberCount; i++) placeEmber(i, true);
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({
    color: 0xffc27a,
    size: 0.14,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  world.add(embers);

  let angle = -0.5;
  let spin = still ? 0 : 0.12;
  let tilt = 0;
  let tiltTarget = 0;
  let dragging = false;
  let lastX = 0;
  let lastMove = 0;

  let radius = 29;

  function placeCamera() {
    const elevation = 0.3 + tilt * 0.07;
    camera.position.set(0, Math.sin(elevation) * radius + 2, Math.cos(elevation) * radius);
    camera.lookAt(0, 1.2, 0);
  }

  function step(dt, time) {
    if (!dragging && !still) spin += (0.12 - spin) * Math.min(1, dt * 1.2);
    angle += spin * dt;
    world.rotation.y = angle;
    tilt += (tiltTarget - tilt) * Math.min(1, dt * 3);
    placeCamera();

    lantern.position.y = 4.6 + Math.sin(time * 1.3) * 0.28;
    lantern.rotation.z = Math.sin(time * 0.9) * 0.08;
    glow.intensity = 1.5 + Math.sin(time * 7.3) * 0.08 + Math.sin(time * 3.1) * 0.06;
    tail.forEach(function (piece, index) {
      const sway = Math.sin(time * 2.2 - index * 0.6) * 0.07 * (index + 1);
      piece.position.set(sway, -0.95 - index * 0.3, Math.cos(time * 1.7 - index * 0.5) * 0.04 * index);
      piece.rotation.y = Math.sin(time * 1.9 - index) * 0.6;
    });

    sparkle.scale.setScalar(0.35 + Math.max(0, Math.sin(time * 1.6)) ** 6 * 1.1);

    islets.forEach(function (islet) {
      islet.position.y = islet.userData.base + Math.sin(time * 0.6 + islet.userData.phase) * 0.35;
    });

    for (let i = 0; i < emberCount; i++) {
      emberPositions[i * 3 + 1] += emberSpeed[i] * dt;
      emberPositions[i * 3] += Math.sin(time + i) * 0.12 * dt;
      if (emberPositions[i * 3 + 1] > 9) placeEmber(i, false);
    }
    emberGeometry.attributes.position.needsUpdate = true;
  }

  function resize() {
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const wide = camera.aspect > 1.15;
    radius = wide ? 29 : Math.max(34, 30 / camera.aspect);
    world.position.set(wide ? 6 : 0, wide ? 0 : -radius * 0.08, 0);
    placeCamera();
    if (!running) renderer.render(scene, camera);
  }

  let running = false;
  let onScreen = true;
  let last = 0;

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt, now / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function updateRunning() {
    const should = !still && onScreen && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  }

  canvas.addEventListener("pointerdown", function (event) {
    dragging = true;
    lastX = event.clientX;
    lastMove = performance.now();
    canvas.classList.add("dragging");
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!dragging) return;
    const now = performance.now();
    const dx = event.clientX - lastX;
    const dt = Math.max((now - lastMove) / 1000, 0.008);
    angle += dx * 0.006;
    spin = Math.max(-4, Math.min(4, (dx * 0.006) / dt));
    lastX = event.clientX;
    lastMove = now;
    if (!running) {
      world.rotation.y = angle;
      renderer.render(scene, camera);
    }
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("dragging");
    if (still) spin = 0;
  }

  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  window.addEventListener("pointermove", function (event) {
    if (event.pointerType === "mouse") tiltTarget = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", updateRunning);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      updateRunning();
    }).observe(hero);
  }

  step(0, 0);
  resize();
  updateRunning();
})();
