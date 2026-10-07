(function () {
  const desktop = document.getElementById("desktop");
  const svgNs = "http://www.w3.org/2000/svg";

  const storage = {
    get: function (key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {}
    }
  };

  function windowOf(id) {
    return document.getElementById("win-" + id);
  }

  function isActive(id) {
    const win = windowOf(id);
    return win && !win.hidden && win.classList.contains("active");
  }

  function open(id, element) {
    if (!element) {
      window.dispatchEvent(new CustomEvent("xp:open", { detail: id }));
      return;
    }
    const box = desktop.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent("xp:open", {
      detail: { id: id, x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top }
    }));
  }

  function close(id) {
    const win = windowOf(id);
    if (win && !win.hidden) win.querySelector(".close").click();
  }

  function onShow(id, callback) {
    const win = windowOf(id);
    let wasHidden = win.hidden;
    new MutationObserver(function () {
      if (wasHidden && !win.hidden) callback();
      wasHidden = win.hidden;
    }).observe(win, { attributes: true, attributeFilter: ["hidden"] });
  }

  function onVisibility(id, callback) {
    const win = windowOf(id);
    new MutationObserver(function () {
      callback(!win.hidden, win.classList.contains("active"));
    }).observe(win, { attributes: true, attributeFilter: ["hidden", "class"] });
  }

  function typing(event) {
    const tag = event.target && event.target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function makeIcon(id) {
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(svgNs, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest(".window [data-open], .quicklaunch [data-open]");
    if (!target) return;
    open(target.dataset.open, target.querySelector("svg") || target);
  });

  let muted = storage.get("xp-muted") === "1";
  const soundButton = document.getElementById("tray-sound");
  let audio = null;

  window.xpSoundOn = function () {
    return !muted;
  };

  function showSound() {
    soundButton.classList.toggle("muted", muted);
    soundButton.setAttribute("aria-label", muted ? "Turn sounds on" : "Mute sounds");
    soundButton.title = muted ? "Sounds are off" : "Sounds are on";
  }

  soundButton.addEventListener("click", function () {
    muted = !muted;
    storage.set("xp-muted", muted ? "1" : "0");
    showSound();
  });
  showSound();

  function beep(frequency, duration, type) {
    if (muted) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      audio = audio || new Context();
      if (audio.state === "suspended") audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type || "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch (error) {}
  }

  document.getElementById("show-desktop").addEventListener("click", function () {
    document.querySelectorAll(".window:not([hidden]) .min").forEach(function (button) {
      button.click();
    });
  });

  document.querySelectorAll(".window:not([data-fixed])").forEach(function (win) {
    const grip = document.createElement("div");
    grip.className = "grip";
    grip.setAttribute("aria-hidden", "true");
    win.appendChild(grip);
    let start = null;
    grip.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || win.classList.contains("maximized")) return;
      event.preventDefault();
      grip.setPointerCapture(event.pointerId);
      start = { x: event.clientX, y: event.clientY, width: win.offsetWidth, height: win.offsetHeight };
      document.body.classList.add("resizing");
    });
    grip.addEventListener("pointermove", function (event) {
      if (!start) return;
      const maxWidth = desktop.clientWidth - win.offsetLeft;
      const maxHeight = desktop.clientHeight - win.offsetTop;
      win.style.width = Math.max(260, Math.min(maxWidth, start.width + event.clientX - start.x)) + "px";
      win.style.height = Math.max(160, Math.min(maxHeight, start.height + event.clientY - start.y)) + "px";
    });
    function stop() {
      start = null;
      document.body.classList.remove("resizing");
    }
    grip.addEventListener("pointerup", stop);
    grip.addEventListener("pointercancel", stop);
  });

  const startMenu = document.getElementById("startmenu");
  const allButton = document.getElementById("sm-allprogs");
  const allMenu = document.getElementById("allprogs");

  function showAllPrograms(show) {
    allMenu.hidden = !show;
    allButton.setAttribute("aria-expanded", String(show));
  }

  allButton.addEventListener("click", function () {
    showAllPrograms(allMenu.hidden);
  });
  allButton.addEventListener("pointerenter", function (event) {
    if (event.pointerType === "mouse") showAllPrograms(true);
  });
  startMenu.querySelectorAll(".sm-left > li:not(.sm-allprogs), .sm-right > li").forEach(function (item) {
    item.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse") showAllPrograms(false);
    });
  });
  new MutationObserver(function () {
    if (startMenu.hidden) showAllPrograms(false);
  }).observe(startMenu, { attributes: true, attributeFilter: ["hidden"] });

  const wallpapers = ["hill3d", "hill", "azure", "night"];

  function setWallpaper(name) {
    const chosen = wallpapers.indexOf(name) >= 0 ? name : "hill3d";
    desktop.dataset.wallpaper = chosen;
    storage.set("xp-wallpaper", chosen);
    window.dispatchEvent(new Event("xp:wallpaper"));
  }

  setWallpaper(storage.get("xp-wallpaper") || "hill3d");

  (function displayProperties() {
    const screen = document.getElementById("display-screen");
    const options = document.querySelectorAll("#display-list [data-wallpaper]");
    let pending = desktop.dataset.wallpaper;

    function show() {
      screen.dataset.wallpaper = pending;
      options.forEach(function (option) {
        option.setAttribute("aria-selected", String(option.dataset.wallpaper === pending));
      });
    }

    options.forEach(function (option) {
      option.addEventListener("click", function () {
        pending = option.dataset.wallpaper;
        show();
      });
    });
    document.getElementById("display-apply").addEventListener("click", function () {
      setWallpaper(pending);
    });
    document.getElementById("display-ok").addEventListener("click", function () {
      setWallpaper(pending);
      close("display");
    });
    document.getElementById("display-cancel").addEventListener("click", function () {
      close("display");
    });
    onShow("display", function () {
      pending = desktop.dataset.wallpaper;
      show();
    });
    show();
  })();

  const menu = document.getElementById("ctxmenu");

  desktop.addEventListener("contextmenu", function (event) {
    if (event.target !== desktop && event.target.id !== "wallpaper") return;
    event.preventDefault();
    const box = desktop.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = Math.max(0, Math.min(event.clientX - box.left, box.width - menu.offsetWidth - 2)) + "px";
    menu.style.top = Math.max(0, Math.min(event.clientY - box.top, box.height - menu.offsetHeight - 2)) + "px";
  });

  document.addEventListener("pointerdown", function (event) {
    if (!menu.hidden && !menu.contains(event.target)) menu.hidden = true;
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") menu.hidden = true;
  });

  menu.addEventListener("click", function (event) {
    const item = event.target.closest("button");
    if (!item) return;
    menu.hidden = true;
    const action = item.dataset.action;
    if (action === "arrange") {
      const list = document.querySelector(".icons");
      const items = Array.from(list.children);
      items.sort(function (a, b) {
        return a.textContent.trim().localeCompare(b.textContent.trim());
      });
      items.forEach(function (entry, index) {
        entry.style.setProperty("--i", String(index));
        list.appendChild(entry);
      });
    } else if (action === "refresh") {
      const list = document.querySelector(".icons");
      list.classList.remove("refreshing");
      void list.offsetWidth;
      list.classList.add("refreshing");
      window.dispatchEvent(new Event("resize"));
    } else if (action === "newtext") {
      open("notepad");
    } else if (action === "cmd") {
      open("cmd");
    } else if (action === "properties") {
      open("display");
    }
  });

  const browser = (function () {
    const win = windowOf("ie");
    const frame = document.getElementById("ie-frame");
    const input = document.getElementById("ie-url");
    const status = document.getElementById("ie-status");
    const title = document.getElementById("t-ie");
    const backButton = win.querySelector('[data-ie="back"]');
    const forwardButton = win.querySelector('[data-ie="forward"]');
    const home = "https://www.google.com/webhp?igu=1";
    const blocked = /(^|\.)(github\.com|bing\.com|duckduckgo\.com|youtube\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|reddit\.com|amazon\.[a-z.]+|netflix\.com|tiktok\.com|linkedin\.com|discord\.com|twitch\.tv|stackoverflow\.com|microsoft\.com|apple\.com|spotify\.com|roblox\.com|crazygames\.com|modrinth\.com|curseforge\.com|steampowered\.com|chatgpt\.com|openai\.com|claude\.ai|anthropic\.com)$/i;
    let history = [];
    let index = -1;
    let current = "";

    function adapt(url) {
      if (/(^|\.)google\.[a-z.]+$/i.test(url.hostname)) url.searchParams.set("igu", "1");
      if (/(^|\.)youtube\.com$/i.test(url.hostname) && url.pathname === "/watch" && url.searchParams.get("v")) {
        return "https://www.youtube.com/embed/" + encodeURIComponent(url.searchParams.get("v"));
      }
      if (url.hostname === "youtu.be" && url.pathname.length > 1) {
        return "https://www.youtube.com/embed/" + encodeURIComponent(url.pathname.slice(1));
      }
      return url.href;
    }

    function toUrl(text) {
      const value = text.trim();
      if (!value) return home;
      let candidate = null;
      if (/^https?:\/\//i.test(value)) candidate = value;
      else if (!/\s/.test(value) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(value)) candidate = "https://" + value;
      if (candidate) {
        try {
          const url = new URL(candidate);
          if (url.protocol === "https:" || url.protocol === "http:") return adapt(url);
        } catch (error) {}
      }
      return "https://www.google.com/search?igu=1&q=" + encodeURIComponent(value);
    }

    function isUrl(text) {
      const value = text.trim();
      return /^https?:\/\//i.test(value) || (!/\s/.test(value) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(value));
    }

    function readable(href) {
      try {
        const url = new URL(href);
        url.searchParams.delete("igu");
        return url.href;
      } catch (error) {
        return href;
      }
    }

    function isBlocked(href) {
      const url = new URL(href);
      if (/(^|\.)youtube\.com$/i.test(url.hostname) && url.pathname.indexOf("/embed/") === 0) return false;
      return blocked.test(url.hostname);
    }

    function escapeHtml(text) {
      return text.replace(/[&<>"']/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
      });
    }

    function blockedPage(href) {
      const shown = escapeHtml(readable(href));
      return "<!doctype html><html><head><meta charset=\"utf-8\"><style>body{margin:0;padding:28px 32px;font:12px Tahoma,Verdana,sans-serif;color:#000;background:#fff}h1{font:700 15px Tahoma,sans-serif;margin:0 0 6px}hr{border:0;border-top:1px solid #c0c0c0;margin:14px 0}li{margin:4px 0}a{color:#0b4cc7}</style></head><body>"
        + "<h1>This page can't be shown inside Fishnet Explorer</h1>"
        + "<p>The website at <b>" + shown + "</b> doesn't allow other sites to display it inside a window.</p><hr>"
        + "<ul><li><a href=\"" + shown + "\" target=\"_blank\" rel=\"noopener\">Open it in a new window</a></li><li>Google, Wikipedia, YouTube videos and the Internet Archive all work in here.</li></ul>"
        + "</body></html>";
    }

    function show(href) {
      current = href;
      input.value = readable(href);
      status.textContent = "Opening page " + readable(href) + "...";
      let host = href;
      try {
        host = new URL(href).hostname.replace(/^www\./, "");
      } catch (error) {}
      title.textContent = (/^google\./.test(host) ? "Google" : host) + " - Fishnet Explorer";
      if (isBlocked(href)) {
        frame.removeAttribute("src");
        frame.srcdoc = blockedPage(href);
      } else {
        frame.removeAttribute("srcdoc");
        frame.src = href;
      }
      backButton.disabled = index <= 0;
      forwardButton.disabled = index >= history.length - 1;
    }

    function navigate(href) {
      history = history.slice(0, index + 1);
      history.push(href);
      index = history.length - 1;
      show(href);
    }

    frame.addEventListener("load", function () {
      if (current) status.textContent = "Done";
    });

    document.getElementById("ie-form").addEventListener("submit", function (event) {
      event.preventDefault();
      navigate(toUrl(input.value));
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        input.value = readable(current);
      }
    });

    input.addEventListener("focus", function () {
      input.select();
    });

    win.querySelector(".ie-links").addEventListener("click", function (event) {
      const link = event.target.closest("[data-url]");
      if (link) navigate(toUrl(link.dataset.url));
    });

    win.querySelector(".ie-toolbar").addEventListener("click", function (event) {
      const button = event.target.closest("[data-ie]");
      if (!button || button.disabled) return;
      const action = button.dataset.ie;
      if (action === "back" && index > 0) show(history[--index]);
      if (action === "forward" && index < history.length - 1) show(history[++index]);
      if (action === "refresh" && current) show(current);
      if (action === "home") navigate(home);
      if (action === "search") {
        navigate(home);
        input.focus();
      }
      if (action === "popout" && current) window.open(readable(current), "_blank", "noopener");
    });

    onShow("ie", function () {
      if (!current) navigate(home);
    });

    return {
      go: function (text) {
        navigate(toUrl(text));
        open("ie");
      },
      isUrl: isUrl
    };
  })();

  const programs = {
    iexplore: "ie", ie: "ie", internet: "ie", fishnet: "ie", browser: "ie", google: "ie",
    pong: "pong", winmine: "mine", minesweeper: "mine", mine: "mine",
    mspaint: "paint", paint: "paint", notepad: "notepad", cmd: "cmd", command: "cmd",
    explorer: "computer", computer: "computer", control: "display", desk: "display", "desk.cpl": "display",
    about: "about", toolbox: "toolbox", haystack: "haystack", kitewick: "kitewick", nebula: "nebula",
    anyps5: "anyps5", progress: "status", recycle: "bin", run: "run"
  };

  function launch(text) {
    const value = text.trim();
    if (!value) return false;
    const name = value.toLowerCase().replace(/\.exe$/, "");
    if (programs[name]) {
      open(programs[name]);
      return true;
    }
    if (browser.isUrl(value)) {
      browser.go(value);
      return true;
    }
    return false;
  }

  (function run() {
    const input = document.getElementById("run-input");
    const error = document.getElementById("run-error");
    document.getElementById("run-form").addEventListener("submit", function (event) {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      if (launch(value)) {
        error.hidden = true;
        close("run");
      } else {
        error.textContent = "fishybeing cannot find '" + value + "'. Make sure you typed the name correctly, and then try again.";
        error.hidden = false;
      }
    });
    document.getElementById("run-cancel").addEventListener("click", function () {
      close("run");
    });
    onShow("run", function () {
      error.hidden = true;
      input.focus();
      input.select();
    });
  })();

  (function pong() {
    const canvas = document.getElementById("pong");
    const g = canvas.getContext("2d");
    const status = document.getElementById("pong-status");
    const level = document.getElementById("pong-level");
    const pauseButton = document.getElementById("pong-pause");
    const width = 500;
    const height = 320;
    const paddleWidth = 8;
    const paddleHeight = 56;
    const size = 8;
    const target = 7;
    const cpuSpeeds = { easy: 200, normal: 285, hard: 380 };
    const keys = new Set();
    let player = 0;
    let cpu = 0;
    let ball = null;
    let scores = [0, 0];
    let serving = true;
    let over = false;
    let paused = true;
    let visible = false;
    let mouseY = null;
    let last = 0;
    let frameId = 0;

    function clamp(value, low, high) {
      return Math.max(low, Math.min(high, value));
    }

    function serve(direction) {
      ball = { x: width / 2 - size / 2, y: height / 2 - size / 2, vx: 0, vy: 0, direction: direction };
      serving = true;
    }

    function reset() {
      player = height / 2 - paddleHeight / 2;
      cpu = player;
      scores = [0, 0];
      over = false;
      serve(Math.random() < 0.5 ? -1 : 1);
      updateStatus();
    }

    function launchBall() {
      const angle = Math.random() * 0.8 - 0.4;
      ball.vx = Math.cos(angle) * 260 * ball.direction;
      ball.vy = Math.sin(angle) * 260;
      serving = false;
    }

    function bounce(paddle, x, direction) {
      const offset = clamp((ball.y + size / 2 - (paddle + paddleHeight / 2)) / (paddleHeight / 2), -1, 1);
      const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.06, 640);
      ball.vx = Math.cos(offset * 0.9) * speed * direction;
      ball.vy = Math.sin(offset * 0.9) * speed;
      ball.x = x;
      beep(440, 0.06);
    }

    function point(scorer) {
      scores[scorer] += 1;
      beep(scorer === 0 ? 880 : 160, 0.25, "triangle");
      if (scores[scorer] >= target) over = true;
      else serve(scorer === 0 ? 1 : -1);
      updateStatus();
    }

    function step(dt) {
      const move = 380 * dt;
      if (mouseY !== null) player += clamp(mouseY - paddleHeight / 2 - player, -move * 1.8, move * 1.8);
      if (keys.has("up")) player -= move;
      if (keys.has("down")) player += move;
      player = clamp(player, 0, height - paddleHeight);
      const aim = ball.vx > 0 && !serving ? ball.y + size / 2 - paddleHeight / 2 : height / 2 - paddleHeight / 2;
      const cpuStep = cpuSpeeds[level.value] * dt;
      cpu = clamp(cpu + clamp(aim - cpu, -cpuStep, cpuStep), 0, height - paddleHeight);
      if (serving || over) return;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y < 0) {
        ball.y = 0;
        ball.vy = Math.abs(ball.vy);
        beep(220, 0.04);
      }
      if (ball.y > height - size) {
        ball.y = height - size;
        ball.vy = -Math.abs(ball.vy);
        beep(220, 0.04);
      }
      const left = 16;
      const right = width - 16 - paddleWidth;
      if (ball.vx < 0 && ball.x <= left + paddleWidth && ball.x >= left - size && ball.y + size >= player && ball.y <= player + paddleHeight) bounce(player, left + paddleWidth, 1);
      if (ball.vx > 0 && ball.x + size >= right && ball.x <= right + paddleWidth && ball.y + size >= cpu && ball.y <= cpu + paddleHeight) bounce(cpu, right - size, -1);
      if (ball.x < -size * 2) point(1);
      else if (ball.x > width + size) point(0);
    }

    function message(text, y, sizePx) {
      g.font = "700 " + sizePx + "px Tahoma, Verdana, sans-serif";
      g.fillText(text, width / 2, y);
    }

    function draw() {
      g.fillStyle = "#000";
      g.fillRect(0, 0, width, height);
      g.fillStyle = "#555";
      for (let y = 4; y < height; y += 16) g.fillRect(width / 2 - 1, y, 2, 8);
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.font = "700 40px 'Courier New', monospace";
      g.fillText(String(scores[0]), width / 2 - 60, 48);
      g.fillText(String(scores[1]), width / 2 + 60, 48);
      g.fillRect(16, player, paddleWidth, paddleHeight);
      g.fillRect(width - 16 - paddleWidth, cpu, paddleWidth, paddleHeight);
      if (!over) g.fillRect(ball.x, ball.y, size, size);
      if (over) {
        message(scores[0] >= target ? "YOU WIN!" : "COMPUTER WINS", height / 2 - 6, 26);
        message("Click or press Space for a new game", height / 2 + 24, 13);
      } else if (paused) {
        message("PAUSED", height / 2 - 6, 26);
        message("Click or press Space to play", height / 2 + 24, 13);
      } else if (serving) {
        message("Click or press Space to serve", height / 2 + 40, 13);
      }
    }

    function updateStatus() {
      status.textContent = "You " + scores[0] + " : " + scores[1] + " Computer";
      pauseButton.textContent = paused ? "Resume" : "Pause";
    }

    function loop(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (!paused) step(dt);
      draw();
      frameId = visible ? requestAnimationFrame(loop) : 0;
    }

    function setPaused(value) {
      paused = value;
      updateStatus();
      draw();
    }

    function action() {
      if (over) {
        reset();
        setPaused(false);
      } else if (paused) {
        setPaused(false);
      } else if (serving) {
        launchBall();
      }
    }

    function pointerY(event) {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / width, rect.height / height);
      const top = rect.top + (rect.height - height * scale) / 2;
      return (event.clientY - top) / scale;
    }

    canvas.addEventListener("pointermove", function (event) {
      mouseY = pointerY(event);
    });
    canvas.addEventListener("pointerleave", function () {
      mouseY = null;
    });
    canvas.addEventListener("pointerdown", function (event) {
      mouseY = pointerY(event);
      action();
    });

    window.addEventListener("keydown", function (event) {
      if (!isActive("pong") || typing(event)) return;
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.add("up");
      else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.add("down");
      else if (event.key === " ") action();
      else if (event.key === "p" || event.key === "P") setPaused(!paused);
      else return;
      event.preventDefault();
    });

    window.addEventListener("keyup", function (event) {
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.delete("up");
      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.delete("down");
    });

    document.getElementById("pong-new").addEventListener("click", function () {
      reset();
      setPaused(false);
    });
    pauseButton.addEventListener("click", function () {
      if (!over) setPaused(!paused);
    });

    onVisibility("pong", function (shown, active) {
      if (!shown || !active) {
        if (!paused) setPaused(true);
        keys.clear();
      }
      if (shown && !visible) {
        visible = true;
        last = performance.now();
        frameId = requestAnimationFrame(loop);
      } else if (!shown && visible) {
        visible = false;
        cancelAnimationFrame(frameId);
      }
    });

    reset();
    draw();
  })();

  (function minesweeper() {
    const grid = document.getElementById("mine-grid");
    const face = document.getElementById("mine-face");
    const counter = document.getElementById("mine-count");
    const clock = document.getElementById("mine-time");
    const level = document.getElementById("mine-level");
    const levels = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
    let columns = 9;
    let rows = 9;
    let total = 10;
    let cells = [];
    let planted = false;
    let opened = 0;
    let flags = 0;
    let state = "ready";
    let timer = 0;
    let seconds = 0;
    let pressTimer = 0;
    let suppressClick = false;

    function setFace(name) {
      face.querySelector("use").setAttribute("href", "#f-" + name);
    }

    function led(element, value) {
      element.textContent = value < 0 ? "-" + String(Math.min(99, -value)).padStart(2, "0") : String(Math.min(999, value)).padStart(3, "0");
    }

    function newGame() {
      const chosen = levels[level.value] || levels.beginner;
      columns = chosen[0];
      rows = chosen[1];
      total = chosen[2];
      cells = [];
      planted = false;
      opened = 0;
      flags = 0;
      state = "ready";
      clearInterval(timer);
      seconds = 0;
      led(clock, 0);
      led(counter, total);
      setFace("smile");
      grid.style.setProperty("--cols", String(columns));
      grid.textContent = "";
      for (let index = 0; index < columns * rows; index += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.index = String(index);
        button.setAttribute("aria-label", "Hidden");
        cells.push({ element: button, mine: false, open: false, flag: false, count: 0 });
        grid.appendChild(button);
      }
    }

    function neighbors(index) {
      const x = index % columns;
      const y = Math.floor(index / columns);
      const result = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < columns && ny >= 0 && ny < rows) result.push(ny * columns + nx);
        }
      }
      return result;
    }

    function plant(safe) {
      const banned = new Set([safe].concat(neighbors(safe)));
      const spots = [];
      for (let index = 0; index < cells.length; index += 1) {
        if (!banned.has(index)) spots.push(index);
      }
      for (let placed = 0; placed < total; placed += 1) {
        const pick = placed + Math.floor(Math.random() * (spots.length - placed));
        const swap = spots[placed];
        spots[placed] = spots[pick];
        spots[pick] = swap;
        cells[spots[placed]].mine = true;
      }
      cells.forEach(function (cell, index) {
        cell.count = neighbors(index).filter(function (other) {
          return cells[other].mine;
        }).length;
      });
      planted = true;
      state = "playing";
      seconds = 1;
      led(clock, 1);
      timer = setInterval(function () {
        seconds = Math.min(999, seconds + 1);
        led(clock, seconds);
      }, 1000);
    }

    function paint(index) {
      const cell = cells[index];
      const element = cell.element;
      element.className = "cell";
      element.textContent = "";
      if (cell.open) {
        element.classList.add("open");
        if (cell.mine) {
          element.appendChild(makeIcon("i-bomb"));
          element.setAttribute("aria-label", "Mine");
        } else if (cell.count) {
          element.classList.add("n" + cell.count);
          element.textContent = String(cell.count);
          element.setAttribute("aria-label", String(cell.count));
        } else {
          element.setAttribute("aria-label", "Empty");
        }
      } else if (cell.flag) {
        element.appendChild(makeIcon("i-flag"));
        element.setAttribute("aria-label", "Flagged");
      } else {
        element.setAttribute("aria-label", "Hidden");
      }
    }

    function reveal(start) {
      const stack = [start];
      while (stack.length) {
        const index = stack.pop();
        const cell = cells[index];
        if (cell.open || cell.flag) continue;
        cell.open = true;
        if (!cell.mine) opened += 1;
        paint(index);
        if (!cell.mine && cell.count === 0) {
          neighbors(index).forEach(function (other) {
            if (!cells[other].open) stack.push(other);
          });
        }
      }
    }

    function finished() {
      return state === "won" || state === "lost";
    }

    function check() {
      if (opened !== cells.length - total) return;
      state = "won";
      clearInterval(timer);
      setFace("cool");
      cells.forEach(function (cell, index) {
        if (cell.mine && !cell.flag) {
          cell.flag = true;
          paint(index);
        }
      });
      led(counter, 0);
      beep(660, 0.15, "triangle");
    }

    function lose(index) {
      state = "lost";
      clearInterval(timer);
      setFace("dead");
      cells.forEach(function (cell, other) {
        if (cell.mine && !cell.flag) {
          cell.open = true;
          paint(other);
        }
        if (!cell.mine && cell.flag) cell.element.classList.add("wrong");
      });
      cells[index].element.classList.add("boom");
      beep(110, 0.35, "sawtooth");
    }

    function chord(index) {
      const cell = cells[index];
      if (!cell.count) return;
      const around = neighbors(index);
      const flagged = around.filter(function (other) {
        return cells[other].flag;
      }).length;
      if (flagged !== cell.count) return;
      let hit = -1;
      around.forEach(function (other) {
        if (!cells[other].open && !cells[other].flag) {
          reveal(other);
          if (cells[other].mine && hit < 0) hit = other;
        }
      });
      if (hit >= 0) lose(hit);
      else check();
    }

    function choose(index) {
      if (finished()) return;
      const cell = cells[index];
      if (cell.flag) return;
      if (!planted) plant(index);
      if (cell.open) {
        chord(index);
        return;
      }
      reveal(index);
      if (cell.mine) lose(index);
      else check();
    }

    function toggleFlag(index) {
      if (finished()) return;
      const cell = cells[index];
      if (cell.open) return;
      cell.flag = !cell.flag;
      flags += cell.flag ? 1 : -1;
      led(counter, total - flags);
      paint(index);
    }

    function cellIndex(event) {
      const cell = event.target.closest(".cell");
      return cell ? Number(cell.dataset.index) : -1;
    }

    grid.addEventListener("click", function (event) {
      const index = cellIndex(event);
      if (index < 0) return;
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      choose(index);
    });

    grid.addEventListener("contextmenu", function (event) {
      event.preventDefault();
      const index = cellIndex(event);
      if (index >= 0 && !suppressClick) toggleFlag(index);
    });

    grid.addEventListener("pointerdown", function (event) {
      const index = cellIndex(event);
      if (index < 0 || finished()) return;
      if (event.button === 0) setFace("o");
      if (event.pointerType === "touch") {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function () {
          suppressClick = true;
          toggleFlag(index);
          setFace("smile");
        }, 450);
      }
    });

    function release() {
      clearTimeout(pressTimer);
      if (!finished()) setFace("smile");
    }

    grid.addEventListener("pointerup", release);
    grid.addEventListener("pointerleave", release);
    grid.addEventListener("pointercancel", release);
    face.addEventListener("click", newGame);
    level.addEventListener("change", newGame);
    newGame();
  })();

  (function paintProgram() {
    const canvas = document.getElementById("paint-canvas");
    const g = canvas.getContext("2d", { willReadFrequently: true });
    const colors = document.getElementById("paint-colors");
    const foreground = document.getElementById("paint-fg");
    const background = document.getElementById("paint-bg");
    const position = document.getElementById("paint-pos");
    const palette = ["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
      "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040"];
    const width = canvas.width;
    const height = canvas.height;
    let primary = "#000000";
    let secondary = "#ffffff";
    let tool = "pencil";
    let size = 2;
    let stroke = null;
    let snapshot = null;

    function clear() {
      g.fillStyle = secondary;
      g.fillRect(0, 0, width, height);
    }

    function showColors() {
      foreground.style.background = primary;
      background.style.background = secondary;
    }

    palette.forEach(function (color) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.style.background = color;
      swatch.setAttribute("aria-label", color);
      swatch.addEventListener("click", function () {
        primary = color;
        showColors();
      });
      swatch.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        secondary = color;
        showColors();
      });
      colors.appendChild(swatch);
    });

    function press(group, attribute, value) {
      document.querySelectorAll(group + " [" + attribute + "]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value));
      });
    }

    document.querySelectorAll(".paint-tools [data-tool]").forEach(function (button) {
      button.addEventListener("click", function () {
        tool = button.dataset.tool;
        press(".paint-tools", "data-tool", tool);
      });
    });

    document.querySelectorAll(".paint-sizes [data-size]").forEach(function (button) {
      button.addEventListener("click", function () {
        size = Number(button.dataset.size);
        press(".paint-sizes", "data-size", button.dataset.size);
      });
    });

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.floor((event.clientX - rect.left) * width / rect.width),
        y: Math.floor((event.clientY - rect.top) * height / rect.height)
      };
    }

    function walk(from, to, plot) {
      let x = from.x;
      let y = from.y;
      const dx = Math.abs(to.x - x);
      const sx = x < to.x ? 1 : -1;
      const dy = -Math.abs(to.y - y);
      const sy = y < to.y ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        plot(x, y);
        if (x === to.x && y === to.y) break;
        const doubled = 2 * error;
        if (doubled >= dy) {
          error += dy;
          x += sx;
        }
        if (doubled <= dx) {
          error += dx;
          y += sy;
        }
      }
    }

    function freehand(from, to, color) {
      if (tool === "pencil") {
        g.fillStyle = color;
        walk(from, to, function (x, y) {
          g.fillRect(x, y, 1, 1);
        });
      } else if (tool === "eraser") {
        const side = size * 4;
        g.fillStyle = secondary;
        walk(from, to, function (x, y) {
          g.fillRect(x - Math.floor(side / 2), y - Math.floor(side / 2), side, side);
        });
      } else {
        g.strokeStyle = color;
        g.lineWidth = size * 2 + 1;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.beginPath();
        g.moveTo(from.x + 0.5, from.y + 0.5);
        g.lineTo(to.x + 0.5, to.y + 0.5);
        g.stroke();
      }
    }

    function shape(from, to, color) {
      g.strokeStyle = color;
      g.lineWidth = size;
      g.lineCap = "butt";
      g.beginPath();
      if (tool === "line") {
        g.moveTo(from.x + 0.5, from.y + 0.5);
        g.lineTo(to.x + 0.5, to.y + 0.5);
      } else if (tool === "rect") {
        g.rect(Math.min(from.x, to.x) + 0.5, Math.min(from.y, to.y) + 0.5, Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      } else {
        g.ellipse((from.x + to.x) / 2, (from.y + to.y) / 2, Math.max(1, Math.abs(to.x - from.x) / 2), Math.max(1, Math.abs(to.y - from.y) / 2), 0, 0, Math.PI * 2);
      }
      g.stroke();
    }

    function hexToRgb(hex) {
      const value = parseInt(hex.slice(1), 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }

    function flood(x, y, color) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const image = g.getImageData(0, 0, width, height);
      const data = image.data;
      const fill = hexToRgb(color);
      const start = (y * width + x) * 4;
      const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
      if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === 255) return;
      function matches(offset) {
        return data[offset] === target[0] && data[offset + 1] === target[1] && data[offset + 2] === target[2] && data[offset + 3] === target[3];
      }
      const stack = [[x, y]];
      while (stack.length) {
        const seed = stack.pop();
        let cx = seed[0];
        const cy = seed[1];
        let offset = (cy * width + cx) * 4;
        while (cx >= 0 && matches(offset)) {
          cx -= 1;
          offset -= 4;
        }
        cx += 1;
        offset += 4;
        let above = false;
        let below = false;
        while (cx < width && matches(offset)) {
          data[offset] = fill[0];
          data[offset + 1] = fill[1];
          data[offset + 2] = fill[2];
          data[offset + 3] = 255;
          if (cy > 0) {
            if (matches(offset - width * 4)) {
              if (!above) {
                stack.push([cx, cy - 1]);
                above = true;
              }
            } else {
              above = false;
            }
          }
          if (cy < height - 1) {
            if (matches(offset + width * 4)) {
              if (!below) {
                stack.push([cx, cy + 1]);
                below = true;
              }
            } else {
              below = false;
            }
          }
          cx += 1;
          offset += 4;
        }
      }
      g.putImageData(image, 0, 0);
    }

    canvas.addEventListener("contextmenu", function (event) {
      event.preventDefault();
    });

    canvas.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      const color = event.button === 2 ? secondary : primary;
      const at = point(event);
      if (tool === "fill") {
        flood(at.x, at.y, color);
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      stroke = { color: color, start: at, last: at };
      if (tool === "line" || tool === "rect" || tool === "ellipse") {
        snapshot = g.getImageData(0, 0, width, height);
      } else {
        snapshot = null;
        freehand(at, at, color);
      }
    });

    canvas.addEventListener("pointermove", function (event) {
      const at = point(event);
      position.textContent = Math.max(0, Math.min(width - 1, at.x)) + "," + Math.max(0, Math.min(height - 1, at.y));
      if (!stroke) return;
      if (snapshot) {
        g.putImageData(snapshot, 0, 0);
        shape(stroke.start, at, stroke.color);
      } else {
        freehand(stroke.last, at, stroke.color);
      }
      stroke.last = at;
    });

    function finish() {
      stroke = null;
      snapshot = null;
    }

    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("pointerleave", function () {
      position.textContent = "";
    });

    document.getElementById("paint-clear").addEventListener("click", clear);
    document.getElementById("paint-save").addEventListener("click", function () {
      canvas.toBlob(function (blob) {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "untitled.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () {
          URL.revokeObjectURL(link.href);
        }, 2000);
      });
    });

    clear();
    showColors();
  })();

  (function notepad() {
    const text = document.getElementById("notepad-text");
    const position = document.getElementById("notepad-pos");
    const wrap = document.getElementById("notepad-wrap");
    let timer = 0;

    text.value = storage.get("xp-notepad") || "";

    function save() {
      storage.set("xp-notepad", text.value);
    }

    function update() {
      const before = text.value.slice(0, text.selectionStart);
      const lines = before.split("\n");
      position.textContent = "Ln " + lines.length + ", Col " + (lines[lines.length - 1].length + 1);
    }

    text.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(save, 300);
      update();
    });
    ["keyup", "click", "select", "focus"].forEach(function (type) {
      text.addEventListener(type, update);
    });
    text.addEventListener("keydown", function (event) {
      if (event.key === "Escape") event.stopPropagation();
    });

    document.getElementById("notepad-new").addEventListener("click", function () {
      text.value = "";
      save();
      update();
      text.focus();
    });
    document.getElementById("notepad-save").addEventListener("click", function () {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([text.value], { type: "text/plain" }));
      link.download = "untitled.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(link.href);
      }, 2000);
    });
    wrap.addEventListener("click", function () {
      const wrapped = wrap.getAttribute("aria-pressed") !== "true";
      wrap.setAttribute("aria-pressed", String(wrapped));
      text.classList.toggle("nowrap", !wrapped);
    });
    onShow("notepad", function () {
      text.focus();
      update();
    });
  })();

  (function commandPrompt() {
    const body = document.getElementById("cmd-body");
    const output = document.getElementById("cmd-out");
    const input = document.getElementById("cmd-in");
    const title = document.getElementById("t-cmd");
    const prompt = "C:\\Documents and Settings\\Matt>";
    const history = [];
    let cursor = 0;
    let busy = false;
    const colorTable = ["#000000", "#000080", "#008000", "#008080", "#800000", "#800080", "#808000", "#c0c0c0", "#808080", "#0000ff", "#00ff00", "#00ffff", "#ff0000", "#ff00ff", "#ffff00", "#ffffff"];

    function print(text) {
      output.textContent += text + "\n";
      body.scrollTop = body.scrollHeight;
    }

    const help = [
      "CLS       Clears the screen.",
      "COLOR     Sets the colors, for example COLOR 0A.",
      "DATE      Shows today's date.",
      "DIR       Lists the files on the desktop.",
      "ECHO      Displays a message.",
      "EXIT      Closes the Command Prompt.",
      "HELP      Shows this list.",
      "PING      Times how long a website takes to answer, for example PING google.com.",
      "START     Opens a program or website, for example START pong or START wikipedia.org.",
      "TIME      Shows the time.",
      "TITLE     Sets the window title.",
      "VER       Shows the version.",
      "WHOAMI    Shows the user name.",
      "",
      "Programs: iexplore, pong, winmine, mspaint, notepad, explorer, control"
    ].join("\n");

    const listing = [
      " Volume in drive C is FISHYBEING",
      " Directory of C:\\Documents and Settings\\Matt\\Desktop",
      "",
      "<DIR>          Haystack Hustle",
      "<DIR>          Kitewick",
      "<DIR>          Nebula Client",
      "<DIR>          CMS 2018 Co-op",
      "<DIR>          AnyPS5",
      "         1,024 about.txt",
      "        12,288 iexplore.exe",
      "         4,096 pong.exe",
      "         8,192 winmine.exe",
      "        16,384 mspaint.exe",
      "         2,048 notepad.exe",
      "               6 File(s)     44,032 bytes",
      "               5 Dir(s)"
    ].join("\n");

    async function ping(argument) {
      const host = (argument || "google.com").replace(/^https?:\/\//i, "").split(/[/\s?#]/)[0].toLowerCase();
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
        print("Ping request could not find host " + host + ". Please check the name and try again.");
        return;
      }
      print("\nPinging " + host + " over HTTPS:\n");
      const times = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const started = performance.now();
        const controller = new AbortController();
        const timeout = setTimeout(function () {
          controller.abort();
        }, 4000);
        try {
          await fetch("https://" + host + "/favicon.ico?ping=" + Date.now() + attempt, { mode: "no-cors", cache: "no-store", signal: controller.signal });
          const elapsed = Math.max(1, Math.round(performance.now() - started));
          times.push(elapsed);
          print("Reply from " + host + ": time=" + elapsed + "ms");
        } catch (error) {
          print("Request timed out.");
        } finally {
          clearTimeout(timeout);
        }
        if (attempt < 3) await wait(400);
      }
      const lost = 4 - times.length;
      print("\nPing statistics for " + host + ":\n    Packets: Sent = 4, Received = " + times.length + ", Lost = " + lost + " (" + lost * 25 + "% loss),");
      if (times.length) {
        const average = Math.round(times.reduce(function (sum, value) {
          return sum + value;
        }, 0) / times.length);
        print("Approximate round trip times in milli-seconds:\n    Minimum = " + Math.min.apply(null, times) + "ms, Maximum = " + Math.max.apply(null, times) + "ms, Average = " + average + "ms");
      }
    }

    function color(argument) {
      const value = (argument || "07").toLowerCase();
      if (!/^[0-9a-f]{1,2}$/.test(value)) {
        print("Sets the colors with two hex digits: background, then text. COLOR 0A is green on black.");
        return;
      }
      const pair = value.length === 1 ? "0" + value : value;
      if (pair[0] === pair[1]) return;
      body.style.background = colorTable[parseInt(pair[0], 16)];
      body.style.color = colorTable[parseInt(pair[1], 16)];
    }

    const commands = {
      help: function () { print(help); },
      cls: function () { output.textContent = ""; return "quiet"; },
      echo: function (argument) { print(argument || "ECHO is on."); },
      ver: function () { print("\nfishybeing XP [Version 2026.10.07]"); },
      date: function () { print("The current date is: " + new Date().toLocaleDateString()); },
      time: function () { print("The current time is: " + new Date().toLocaleTimeString()); },
      whoami: function () { print("fishybeing\\matt"); },
      dir: function () { print(listing); },
      ping: ping,
      color: color,
      title: function (argument) { title.textContent = argument || "Command Prompt"; },
      start: function (argument) {
        if (!argument) {
          open("cmd");
          return;
        }
        if (!launch(argument)) print("The system cannot find the file " + argument + ".");
      },
      exit: function () {
        close("cmd");
        return "quiet";
      }
    };

    async function execute(line) {
      const trimmed = line.trim();
      if (!trimmed) return "quiet";
      const word = trimmed.split(/\s+/)[0];
      const name = word.toLowerCase();
      const argument = trimmed.slice(word.length).trim();
      if (Object.prototype.hasOwnProperty.call(commands, name)) return commands[name](argument);
      const program = programs[name.replace(/\.exe$/, "")];
      if (program) {
        open(program);
        return undefined;
      }
      print("'" + word + "' is not recognized as an internal or external command,\noperable program or batch file.");
      return undefined;
    }

    input.addEventListener("keydown", async function (event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        input.value = "";
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (cursor > 0) input.value = history[--cursor];
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (cursor < history.length) {
          cursor += 1;
          input.value = history[cursor] || "";
        }
        return;
      }
      if (event.key !== "Enter" || busy) return;
      const line = input.value;
      input.value = "";
      print(prompt + line);
      if (line.trim()) history.push(line);
      cursor = history.length;
      busy = true;
      try {
        const result = await execute(line);
        if (result !== "quiet") print("");
      } finally {
        busy = false;
      }
    });

    body.addEventListener("click", function () {
      if (!String(window.getSelection())) input.focus();
    });

    onShow("cmd", function () {
      input.focus();
    });

    print("fishybeing XP [Version 2026.10.07]\n(C) Matt. Type HELP for a list of commands.\n");
  })();
})();
