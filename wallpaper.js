(function () {
  const desktop = document.getElementById("desktop");
  const canvas = document.getElementById("wallpaper");
  const tip = document.getElementById("tip");
  function ready() {
    window.dispatchEvent(new Event("xp:wallpaper-ready"));
  }

  if (!desktop || !canvas) {
    ready();
    return;
  }
  if (typeof THREE === "undefined") {
    desktop.classList.add("no-gl");
    ready();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    desktop.classList.add("no-gl");
    ready();
    return;
  }

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe3fa, 60, 140);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

  let seed = 21;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  function hill(x, z) {
    return 6.5 * Math.exp(-((x - 5) ** 2) / 800 - ((z + 8) ** 2) / 200)
      + 3.2 * Math.exp(-((x + 34) ** 2) / 420 - ((z + 16) ** 2) / 260)
      + 0.4 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.13)
      - 2.5;
  }

  scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x4f8a2e, 0.75));
  const sun = new THREE.DirectionalLight(0xfff3dc, 0.95);
  sun.position.set(-24, 36, 22);
  sun.target.position.set(7, 3, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const groundGeometry = new THREE.PlaneGeometry(220, 130, 170, 100);
  groundGeometry.rotateX(-Math.PI / 2);
  const positions = groundGeometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const low = new THREE.Color(0x3c8a2c);
  const mid = new THREE.Color(0x58a836);
  const high = new THREE.Color(0x92d150);
  const shade = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = hill(x, z);
    positions.setY(i, y);
    const t = Math.min(1, Math.max(0, (y + 2.5) / 8));
    shade.copy(low).lerp(mid, Math.min(1, t * 1.6));
    if (t > 0.6) shade.lerp(high, (t - 0.6) / 0.4);
    const speckle = 1 + (random() - 0.5) * 0.06;
    colors[i * 3] = shade.r * speckle;
    colors[i * 3 + 1] = shade.g * speckle;
    colors[i * 3 + 2] = shade.b * speckle;
  }
  groundGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  const puff = new THREE.IcosahedronGeometry(1, 2);
  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8fa3c4, emissiveIntensity: 0.45 });
  const clouds = [];
  for (let c = 0; c < 8; c++) {
    const cloud = new THREE.Group();
    const puffs = 5 + Math.floor(random() * 4);
    for (let p = 0; p < puffs; p++) {
      const ball = new THREE.Mesh(puff, cloudMaterial);
      const size = 1.2 + random() * 1.4;
      ball.scale.set(size, size * 0.72, size);
      ball.position.set((random() - 0.5) * 7, random() * 1.3, (random() - 0.5) * 2.2);
      cloud.add(ball);
    }
    cloud.position.set(-80 + c * 22 + random() * 10, 15 + random() * 9, -48 + random() * 16);
    cloud.scale.setScalar(1.1 + random() * 0.9);
    cloud.userData.speed = 0.35 + random() * 0.5;
    scene.add(cloud);
    clouds.push(cloud);
  }

  function lambert(color, extra) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
  }

  const hitTargets = [];
  function hitProxy(geometry, id, label) {
    const proxy = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
    proxy.userData.id = id;
    proxy.userData.label = label;
    hitTargets.push(proxy);
    return proxy;
  }

  const hayGroup = new THREE.Group();
  const hayBase = new THREE.Vector3(6, hill(6, -8) - 0.25, -8);
  hayGroup.position.copy(hayBase);
  scene.add(hayGroup);

  const voxel = 0.32;
  const hayRadius = 2.5;
  const hayHeight = 2.8;
  const cells = [];
  for (let iy = 0; iy * voxel < hayHeight; iy++) {
    const y = iy * voxel + voxel / 2;
    const ring = hayRadius * Math.sqrt(Math.max(0, 1 - (y / hayHeight) ** 2));
    for (let ix = -9; ix <= 9; ix++) {
      for (let iz = -9; iz <= 9; iz++) {
        const x = ix * voxel;
        const z = iz * voxel;
        if (Math.hypot(x, z) < ring + (random() - 0.5) * 0.45) cells.push([x, y, z]);
      }
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = random() * Math.PI * 2;
    const d = hayRadius + 0.3 + random() * 1.6;
    cells.push([Math.cos(a) * d, voxel / 2, Math.sin(a) * d]);
  }
  const hayColors = [0xe3b23c, 0xd89f2b, 0xf0c75a, 0xc98f22, 0xe8bd4a, 0xb98020];
  const hay = new THREE.InstancedMesh(new THREE.BoxGeometry(voxel, voxel, voxel), lambert(0xffffff), cells.length);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  cells.forEach(function (cell, index) {
    dummy.position.set(cell[0], cell[1], cell[2]);
    dummy.rotation.set(0, (random() - 0.5) * 0.3, 0);
    dummy.updateMatrix();
    hay.setMatrixAt(index, dummy.matrix);
    hay.setColorAt(index, tint.setHex(hayColors[Math.floor(random() * hayColors.length)]));
  });
  hay.castShadow = true;
  hay.receiveShadow = true;
  hayGroup.add(hay);

  const steel = new THREE.MeshPhongMaterial({ color: 0xdfe6ee, specular: 0xffffff, shininess: 110 });
  const needle = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.018, 2, 8), steel);
  shaft.castShadow = true;
  needle.add(shaft);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12), steel);
  eye.position.y = 1.03;
  needle.add(eye);
  needle.position.set(1.9, 1.45, 1.1);
  needle.rotation.set(0.4, 0, -0.95);
  hayGroup.add(needle);

  function glowTexture(cross) {
    const paint = document.createElement("canvas");
    paint.width = paint.height = 64;
    const g = paint.getContext("2d");
    const glow = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.3, "rgba(255,240,210,0.5)");
    glow.addColorStop(1, "rgba(255,240,210,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
    if (cross) {
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(32, 3);
      g.lineTo(32, 61);
      g.moveTo(3, 32);
      g.lineTo(61, 32);
      g.stroke();
    }
    return new THREE.CanvasTexture(paint);
  }

  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparkle.position.y = 1.08;
  needle.add(sparkle);

  hayGroup.add(hitProxy(new THREE.CylinderGeometry(2.7, 2.9, 3.2, 12).translate(0, 1.6, 0), "haystack", "Haystack Hustle"));

  const lantern = new THREE.Group();
  const lanternBase = new THREE.Vector3(-1.5, hill(-1.5, -5) + 5.6, -5);
  lantern.position.copy(lanternBase);
  const paper = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), lambert(0xffb35c, { emissive: 0xff7a1a, emissiveIntensity: 0.9 }));
  paper.scale.set(1, 1.18, 1);
  paper.castShadow = true;
  lantern.add(paper);
  const capMaterial = lambert(0x5a3a22);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 10), capMaterial);
  capTop.position.y = 0.72;
  const capBottom = capTop.clone();
  capBottom.position.y = -0.72;
  lantern.add(capTop, capBottom);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(false), color: 0xffb060, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(3.4);
  lantern.add(halo);
  const lanternLight = new THREE.PointLight(0xffa04a, 0.9, 9, 2);
  lantern.add(lanternLight);
  const tail = [];
  for (let i = 0; i < 7; i++) {
    const piece = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), lambert(i % 2 ? 0xfff1d6 : 0xd8452b, { side: THREE.DoubleSide }));
    piece.rotation.z = Math.PI / 4;
    lantern.add(piece);
    tail.push(piece);
  }
  lantern.add(hitProxy(new THREE.SphereGeometry(1.5, 8, 6), "kitewick", "Kitewick: Lantern Run"));
  scene.add(lantern);

  function pixelTexture(paintPixel) {
    const paint = document.createElement("canvas");
    paint.width = paint.height = 16;
    const g = paint.getContext("2d");
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        g.fillStyle = paintPixel(x, y);
        g.fillRect(x, y, 1, 1);
      }
    }
    const texture = new THREE.CanvasTexture(paint);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  const grassPixels = ["#5f9a32", "#6ea53c", "#79b347", "#568c2c", "#83bb4f"];
  const dirtPixels = ["#7a5432", "#86603a", "#6b4829", "#916a43", "#5e3f24"];
  function pickPixel(list) {
    return list[Math.floor(random() * list.length)];
  }
  const fringe = Array.from({ length: 16 }, function () {
    return 3 + Math.floor(random() * 3);
  });
  const topTexture = pixelTexture(function () {
    return pickPixel(grassPixels);
  });
  const sideTexture = pixelTexture(function (x, y) {
    return y < fringe[x] ? pickPixel(grassPixels) : pickPixel(dirtPixels);
  });
  const dirtTexture = pixelTexture(function () {
    return pickPixel(dirtPixels);
  });
  const side = lambert(0xffffff, { map: sideTexture });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), [side, side, lambert(0xffffff, { map: topTexture }), lambert(0xffffff, { map: dirtTexture }), side, side]);
  block.castShadow = true;
  const blockGroup = new THREE.Group();
  const blockBase = new THREE.Vector3(14, hill(14, -3) + 1.25, -3);
  blockGroup.position.copy(blockBase);
  blockGroup.add(block);
  blockGroup.add(hitProxy(new THREE.BoxGeometry(2.6, 2.6, 2.6), "nebula", "Nebula Client"));
  scene.add(blockGroup);

  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), lambert(0xffffff), 160);
  const flowerColors = [0xffffff, 0xfff27a, 0xffc4e0];
  for (let i = 0; i < 160; i++) {
    const x = -30 + random() * 60;
    const z = -14 + random() * 26;
    dummy.position.set(x, hill(x, z) + 0.05, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, tint.setHex(flowerColors[i % 3]));
  }
  scene.add(flowers);

  const pointer = new THREE.Vector2(9, 9);
  const raycaster = new THREE.Raycaster();
  let hovered = null;
  let pointerX = 0;
  let pointerY = 0;
  let lookX = 0;
  let lookY = 0;
  let lookAtX = 3;
  let downX = 0;
  let downY = 0;

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length ? hits[0].object : null;
  }

  function setHover(target, clientX, clientY) {
    hovered = target;
    canvas.style.cursor = target ? "pointer" : "";
    if (target) {
      const box = desktop.getBoundingClientRect();
      tip.textContent = target.userData.label;
      tip.hidden = false;
      tip.style.left = Math.min(clientX - box.left + 14, box.width - tip.offsetWidth - 4) + "px";
      tip.style.top = clientY - box.top + 20 + "px";
    } else {
      tip.hidden = true;
    }
  }

  canvas.addEventListener("pointermove", function (event) {
    const box = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    setHover(pick(), event.clientX, event.clientY);
    if (still) requestRender();
  });

  canvas.addEventListener("pointerleave", function () {
    pointer.set(9, 9);
    setHover(null, 0, 0);
  });

  canvas.addEventListener("pointerdown", function (event) {
    downX = event.clientX;
    downY = event.clientY;
  });

  canvas.addEventListener("pointerup", function (event) {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
    const box = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    const target = pick();
    if (target) {
      setHover(null, 0, 0);
      const area = desktop.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent("xp:open", { detail: { id: target.userData.id, x: event.clientX - area.left, y: event.clientY - area.top } }));
    }
  });

  window.addEventListener("pointermove", function (event) {
    if (event.pointerType !== "mouse") return;
    pointerX = event.clientX / window.innerWidth - 0.5;
    pointerY = event.clientY / window.innerHeight - 0.5;
  });

  let cameraZ = 26;
  let introStart = -1;
  let introDistance = 0;

  window.addEventListener("xp:login", function () {
    if (still) return;
    introStart = performance.now() / 1000;
    introDistance = 9;
  });

  function introOffset(time) {
    if (introStart < 0) return 0;
    const t = Math.min(1, Math.max(0, (time - introStart) / 2.6));
    if (t >= 1) introStart = -1;
    return introDistance * Math.pow(1 - t, 3);
  }

  function resize() {
    const width = desktop.clientWidth;
    const height = desktop.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const narrow = camera.aspect < 1;
    cameraZ = narrow ? 26 + (1 - camera.aspect) * 34 : 26;
    lookAtX = narrow ? 7 : 3;
    placeCamera(0);
    requestRender();
  }

  function placeCamera(time) {
    const intro = introOffset(time);
    camera.position.set(lookX * 2.2 + Math.sin(time * 0.07) * 0.6, 5.5 - lookY * 1.2 + intro * 0.35, cameraZ + intro);
    camera.lookAt(lookAtX, 3.2, -8);
  }

  function animate(dt, time) {
    lookX += (pointerX - lookX) * Math.min(1, dt * 2);
    lookY += (pointerY - lookY) * Math.min(1, dt * 2);
    placeCamera(time);

    clouds.forEach(function (cloud) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 95) cloud.position.x = -95;
    });

    lantern.position.y = lanternBase.y + Math.sin(time * 1.3) * 0.3;
    lantern.rotation.z = Math.sin(time * 0.9) * 0.08;
    lanternLight.intensity = 0.85 + Math.sin(time * 7.3) * 0.06;
    tail.forEach(function (piece, index) {
      piece.position.set(Math.sin(time * 2.2 - index * 0.6) * 0.07 * (index + 1), -0.95 - index * 0.3, Math.cos(time * 1.7 - index * 0.5) * 0.04 * index);
      piece.rotation.y = Math.sin(time * 1.9 - index) * 0.6;
    });

    sparkle.scale.setScalar(0.3 + Math.max(0, Math.sin(time * 1.6)) ** 6 * 1.2);

    block.rotation.y += dt * 0.45;
    blockGroup.position.y = blockBase.y + Math.sin(time * 1.1) * 0.18;

    const grow = function (object, target) {
      const want = target ? 1.08 : 1;
      object.scale.setScalar(object.scale.x + (want - object.scale.x) * Math.min(1, dt * 10));
    };
    grow(hayGroup, hovered && hovered.userData.id === "haystack");
    grow(lantern, hovered && hovered.userData.id === "kitewick");
    grow(blockGroup, hovered && hovered.userData.id === "nebula");
  }

  let running = false;
  let last = 0;
  let pending = false;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    animate(dt, now / 1000);
    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  }

  function requestRender() {
    if (running || pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      renderer.render(scene, camera);
    });
  }

  function updateRunning() {
    const should = !still && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", updateRunning);
  resize();
  if (still) animate(0, 0);
  updateRunning();
  requestAnimationFrame(function () {
    renderer.render(scene, camera);
    requestAnimationFrame(ready);
  });
})();
