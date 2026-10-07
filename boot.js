(function () {
  const seq = document.getElementById("bootseq");
  const post = document.getElementById("post");
  const postText = document.getElementById("post-text");
  const boot = document.getElementById("boot");
  const fill = document.getElementById("boot-fill");
  const status = document.getElementById("boot-status");
  const welcome = document.getElementById("welcome");
  const login = document.getElementById("login");
  const message = document.getElementById("welcome-msg");
  const word = document.getElementById("welcome-word");
  const root = document.documentElement;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const assets = {
    three: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    threeBytes: 603445,
    wallpaper: "wallpaper.js",
    images: ["img/bliss.jpg", "img/haystack.jpg"]
  };
  const weights = { three: 0.6, scene: 0.25, images: 0.15 };
  const progress = { three: 0, scene: 0, images: 0 };
  let stage = "Starting up";

  const postLines = [
    "fishybeing BIOS v2026.10",
    "Copyright (C) Matt. All rights reserved.",
    "",
    "CPU: Haystack Core @ 60 fps",
    "Memory test: 655360K OK",
    "",
    "Detecting drives...",
    "  Primary master    Haystack Hustle ......... OK",
    "  Primary slave     Nebula Client ........... OK",
    "  Secondary master  AnyPS5 pull requests .... 3 found",
    "",
    "Loading three.js from cdnjs..."
  ];

  let firstVisit = true;
  try {
    firstVisit = sessionStorage.getItem("xp-booted") !== "1";
  } catch (error) {}

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function render() {
    const total = progress.three * weights.three + progress.scene * weights.scene + progress.images * weights.images;
    const percent = Math.round(total * 100);
    fill.style.width = (total * 100).toFixed(1) + "%";
    status.textContent = stage + " (" + percent + "%)";
    boot.setAttribute("aria-valuenow", String(percent));
  }

  function setStage(text) {
    stage = text;
    render();
  }

  function addScript(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function loadThree() {
    setStage("Loading three.js");
    try {
      const response = await fetch(assets.three);
      if (!response.ok || !response.body) throw new Error("download failed");
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value);
        received += part.value.length;
        progress.three = Math.min(0.99, received / assets.threeBytes);
        render();
      }
      const url = URL.createObjectURL(new Blob(chunks, { type: "text/javascript" }));
      try {
        await addScript(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (typeof THREE === "undefined") {
        await addScript(assets.three).catch(function () {});
      }
    }
    progress.three = 1;
    render();
  }

  async function loadScene() {
    setStage("Building the hill");
    await new Promise(function (resolve) {
      window.addEventListener("xp:wallpaper-ready", resolve, { once: true });
      addScript(assets.wallpaper).catch(resolve);
      setTimeout(resolve, 10000);
    });
    progress.scene = 1;
    render();
  }

  function loadImages() {
    let loaded = 0;
    return Promise.all(assets.images.map(function (src) {
      return new Promise(function (resolve) {
        const image = new Image();
        image.onload = image.onerror = function () {
          loaded += 1;
          progress.images = loaded / assets.images.length;
          render();
          resolve();
        };
        image.src = src;
      });
    }));
  }

  async function loadAll() {
    const images = loadImages();
    await loadThree();
    await loadScene();
    setStage("Loading screenshots");
    await images;
    setStage("Ready");
  }

  const loading = loadAll();

  function show(screen) {
    [post, boot, welcome].forEach(function (other) {
      other.hidden = other !== screen;
    });
  }

  function showPost() {
    return new Promise(function (resolve) {
      show(post);
      postText.textContent = "";
      let line = 0;
      let finished = false;
      let timer = 0;

      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        post.removeEventListener("click", finish);
        window.removeEventListener("keydown", onKey);
        resolve();
      }

      function onKey(event) {
        if (event.key === "Escape" || event.key === "Delete" || event.key === "Enter" || event.key === " ") finish();
      }

      function next() {
        if (line < postLines.length) {
          postText.textContent += postLines[line] + "\n";
          line += 1;
          timer = setTimeout(next, postLines[line - 1] === "" ? 60 : 110);
        } else {
          timer = setTimeout(finish, 450);
        }
      }

      post.addEventListener("click", finish);
      window.addEventListener("keydown", onKey);
      next();
    });
  }

  function chime() {
    try {
      if (window.xpSoundOn && !window.xpSoundOn()) return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const audio = new Context();
      const master = audio.createGain();
      master.gain.value = 0.12;
      master.connect(audio.destination);
      const echo = audio.createDelay();
      echo.delayTime.value = 0.18;
      const feedback = audio.createGain();
      feedback.gain.value = 0.28;
      echo.connect(feedback);
      feedback.connect(echo);
      echo.connect(master);
      [392, 587.33, 783.99, 987.77, 1174.66].forEach(function (frequency, index) {
        const start = audio.currentTime + index * 0.11;
        const tone = audio.createOscillator();
        const shimmer = audio.createOscillator();
        const envelope = audio.createGain();
        tone.type = "sine";
        shimmer.type = "triangle";
        tone.frequency.value = frequency;
        shimmer.frequency.value = frequency * 2;
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(index === 4 ? 0.9 : 0.6, start + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + (index === 4 ? 1.6 : 0.7));
        const soft = audio.createGain();
        soft.gain.value = 0.18;
        tone.connect(envelope);
        shimmer.connect(soft);
        soft.connect(envelope);
        envelope.connect(master);
        envelope.connect(echo);
        tone.start(start);
        shimmer.start(start);
        tone.stop(start + 1.8);
        shimmer.stop(start + 1.8);
      });
      setTimeout(function () {
        audio.close();
      }, 3500);
    } catch (error) {}
  }

  function showWelcome() {
    return new Promise(function (resolve) {
      show(welcome);
      welcome.classList.remove("saying");
      login.classList.remove("active");
      message.hidden = true;
      word.hidden = true;
      login.focus({ preventScroll: true });
      let chosen = false;

      async function choose(withSound) {
        if (chosen) return;
        chosen = true;
        clearTimeout(auto);
        login.classList.add("active");
        message.hidden = false;
        if (withSound) chime();
        await wait(still ? 0 : 750);
        welcome.classList.add("saying");
        word.hidden = false;
        await wait(still ? 0 : 900);
        resolve();
      }

      login.onclick = function () {
        choose(true);
      };
      auto = setTimeout(function () {
        choose(false);
      }, 9000);
    });
  }

  let auto = 0;

  window.addEventListener("xp:shutdown", function () {
    clearTimeout(auto);
    login.onclick = null;
  });

  function finish() {
    try {
      sessionStorage.setItem("xp-booted", "1");
    } catch (error) {}
    seq.classList.add("fade");
    root.classList.remove("booting");
    document.body.classList.add("intro");
    window.dispatchEvent(new Event("xp:login"));
    setTimeout(function () {
      seq.hidden = true;
      seq.classList.remove("fade");
    }, still ? 0 : 500);
    setTimeout(function () {
      document.body.classList.remove("intro");
    }, 2200);
  }

  async function run(full) {
    seq.hidden = false;
    root.classList.add("booting");
    if (full && !still) await showPost();
    show(boot);
    render();
    await Promise.all([loading, wait(full && !still ? 900 : 0)]);
    if (full) {
      root.classList.remove("booting");
      await showWelcome();
    }
    finish();
  }

  document.getElementById("welcome-off").addEventListener("click", function () {
    window.dispatchEvent(new Event("xp:shutdown"));
  });

  window.addEventListener("xp:reboot", function () {
    run(true);
  });

  run(firstVisit);
})();
