(function () {
  const desktop = document.getElementById("desktop");
  const tasks = document.getElementById("tasks");
  const startButton = document.getElementById("start");
  const startMenu = document.getElementById("startmenu");
  const balloon = document.getElementById("balloon");
  const boot = document.getElementById("boot");
  const shutdown = document.getElementById("shutdown");
  const clock = document.getElementById("clock");
  const small = window.matchMedia("(max-width: 700px)");
  const coarse = window.matchMedia("(pointer: coarse)");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const windows = new Map();
  let zTop = 10;
  let cascade = 0;
  let balloonTimer = 0;

  document.querySelectorAll(".window").forEach(function (win) {
    const id = win.id.replace("win-", "");
    const entry = {
      el: win,
      title: win.querySelector(".titlebar h2").textContent,
      icon: win.dataset.icon,
      task: null,
      placed: false
    };
    windows.set(id, entry);
    win.addEventListener("pointerdown", function () {
      focus(id);
    });
    win.querySelector(".close").addEventListener("click", function () {
      close(id);
    });
    win.querySelector(".min").addEventListener("click", function () {
      minimize(id);
    });
    win.querySelector(".max").addEventListener("click", function () {
      win.classList.toggle("maximized");
    });
    win.querySelector(".titlebar").addEventListener("dblclick", function (event) {
      if (!event.target.closest("button")) win.classList.toggle("maximized");
    });
    makeDraggable(win);
  });

  function open(id) {
    const entry = windows.get(id);
    if (!entry) return;
    closeStart();
    entry.el.hidden = false;
    if (small.matches) entry.el.classList.add("maximized");
    if (!entry.placed) {
      place(entry.el);
      entry.placed = true;
    }
    if (!entry.task) entry.task = addTask(id, entry);
    focus(id);
  }

  function place(win) {
    const width = win.offsetWidth;
    const height = win.offsetHeight;
    const room = desktop.clientWidth;
    const left = Math.max(8, Math.min(104 + cascade * 30, room - width - 8));
    const top = Math.max(6, Math.min(24 + cascade * 26, desktop.clientHeight - Math.min(height, 260)));
    win.style.left = left + "px";
    win.style.top = top + "px";
    cascade = (cascade + 1) % 6;
  }

  function focus(id) {
    windows.forEach(function (entry, key) {
      const active = key === id && !entry.el.hidden;
      entry.el.classList.toggle("active", active);
      if (entry.task) entry.task.classList.toggle("active", active);
    });
    const entry = windows.get(id);
    if (entry && !entry.el.hidden) entry.el.style.zIndex = String(++zTop);
  }

  function focusTopmost() {
    let best = null;
    let bestZ = -1;
    windows.forEach(function (entry, key) {
      const z = Number(entry.el.style.zIndex) || 0;
      if (!entry.el.hidden && z > bestZ) {
        best = key;
        bestZ = z;
      }
    });
    if (best) {
      focus(best);
    } else {
      windows.forEach(function (entry) {
        entry.el.classList.remove("active");
        if (entry.task) entry.task.classList.remove("active");
      });
    }
  }

  function close(id) {
    const entry = windows.get(id);
    entry.el.hidden = true;
    entry.el.classList.remove("active", "maximized");
    if (entry.task) {
      entry.task.remove();
      entry.task = null;
    }
    focusTopmost();
  }

  function minimize(id) {
    windows.get(id).el.hidden = true;
    focusTopmost();
  }

  function addTask(id, entry) {
    const button = document.createElement("button");
    button.className = "task";
    button.type = "button";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + entry.icon);
    icon.appendChild(use);
    const label = document.createElement("span");
    label.textContent = entry.title;
    button.append(icon, label);
    button.addEventListener("click", function () {
      if (!entry.el.hidden && entry.el.classList.contains("active")) {
        minimize(id);
      } else {
        entry.el.hidden = false;
        focus(id);
      }
    });
    tasks.appendChild(button);
    return button;
  }

  function makeDraggable(win) {
    const bar = win.querySelector(".titlebar");
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    bar.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("button")) return;
      if (win.classList.contains("maximized") || small.matches) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = win.offsetLeft;
      originY = win.offsetTop;
      bar.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    bar.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      const x = originX + event.clientX - startX;
      const y = originY + event.clientY - startY;
      const maxX = desktop.clientWidth - 80;
      const maxY = desktop.clientHeight - 29;
      win.style.left = Math.min(maxX, Math.max(80 - win.offsetWidth, x)) + "px";
      win.style.top = Math.min(maxY, Math.max(0, y)) + "px";
    });

    function stop() {
      dragging = false;
    }

    bar.addEventListener("pointerup", stop);
    bar.addEventListener("pointercancel", stop);
  }

  function selectIcon(icon) {
    document.querySelectorAll(".icon.selected").forEach(function (other) {
      other.classList.remove("selected");
    });
    if (icon) icon.classList.add("selected");
  }

  function launch(icon) {
    if (icon.dataset.open) open(icon.dataset.open);
    if (icon.dataset.href) window.open(icon.dataset.href, "_blank", "noopener");
  }

  document.querySelectorAll(".icon").forEach(function (icon) {
    icon.addEventListener("click", function (event) {
      selectIcon(icon);
      if (event.detail === 0 || coarse.matches) launch(icon);
    });
    icon.addEventListener("dblclick", function () {
      if (!coarse.matches) launch(icon);
    });
  });

  desktop.addEventListener("pointerdown", function (event) {
    if (event.target === desktop || event.target.id === "wallpaper") selectIcon(null);
  });

  function openStart() {
    startMenu.hidden = false;
    startButton.classList.add("pressed");
    startButton.setAttribute("aria-expanded", "true");
  }

  function closeStart() {
    startMenu.hidden = true;
    startButton.classList.remove("pressed");
    startButton.setAttribute("aria-expanded", "false");
  }

  startButton.addEventListener("click", function () {
    if (startMenu.hidden) openStart();
    else closeStart();
  });

  document.addEventListener("pointerdown", function (event) {
    if (!startMenu.hidden && !startMenu.contains(event.target) && !startButton.contains(event.target)) closeStart();
  });

  startMenu.querySelectorAll("[data-open]").forEach(function (item) {
    item.addEventListener("click", function () {
      open(item.dataset.open);
    });
  });

  startMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeStart);
  });

  function closeAll() {
    windows.forEach(function (entry, id) {
      if (entry.task || !entry.el.hidden) close(id);
    });
    cascade = 0;
  }

  document.getElementById("logoff").addEventListener("click", function () {
    closeStart();
    closeAll();
  });

  document.getElementById("turnoff").addEventListener("click", function () {
    closeStart();
    closeAll();
    hideBalloon();
    shutdown.hidden = false;
  });

  document.getElementById("poweron").addEventListener("click", function () {
    shutdown.hidden = true;
    startBoot();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!startMenu.hidden) {
      closeStart();
      return;
    }
    let activeId = null;
    windows.forEach(function (entry, id) {
      if (entry.el.classList.contains("active")) activeId = id;
    });
    if (activeId) close(activeId);
  });

  window.addEventListener("xp:open", function (event) {
    open(event.detail);
  });

  function tick() {
    clock.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  tick();
  setInterval(tick, 15000);

  function showBalloon() {
    balloon.hidden = false;
    clearTimeout(balloonTimer);
    balloonTimer = setTimeout(hideBalloon, 12000);
  }

  function hideBalloon() {
    balloon.hidden = true;
    clearTimeout(balloonTimer);
  }

  balloon.querySelector(".balloon-x").addEventListener("click", hideBalloon);

  let bootDone = false;

  function afterBoot() {
    if (!small.matches) open("about");
    setTimeout(showBalloon, still ? 0 : 700);
  }

  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    try {
      sessionStorage.setItem("xp-booted", "1");
    } catch (error) {}
    boot.classList.add("done");
    setTimeout(function () {
      boot.hidden = true;
      afterBoot();
    }, still ? 0 : 450);
  }

  function startBoot() {
    bootDone = false;
    boot.hidden = false;
    boot.classList.remove("done");
    setTimeout(finishBoot, still ? 300 : 2200);
  }

  boot.addEventListener("click", finishBoot);

  let booted = false;
  try {
    booted = sessionStorage.getItem("xp-booted") === "1";
  } catch (error) {}

  if (booted) {
    bootDone = true;
    boot.hidden = true;
    afterBoot();
  } else {
    startBoot();
  }
})();
