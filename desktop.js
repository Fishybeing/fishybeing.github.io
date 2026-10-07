(function () {
  const desktop = document.getElementById("desktop");
  const tasks = document.getElementById("tasks");
  const startButton = document.getElementById("start");
  const startMenu = document.getElementById("startmenu");
  const balloon = document.getElementById("balloon");
  const shutdown = document.getElementById("shutdown");
  const clock = document.getElementById("clock");
  const small = window.matchMedia("(max-width: 700px)");
  const coarse = window.matchMedia("(pointer: coarse)");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const windows = new Map();
  let zTop = 10;
  let cascade = 0;
  let balloonTimer = 0;

  document.querySelectorAll(".icons li").forEach(function (item, index) {
    item.style.setProperty("--i", String(index));
  });

  document.querySelectorAll(".window").forEach(function (win) {
    const id = win.id.replace("win-", "");
    const entry = {
      el: win,
      title: win.querySelector(".titlebar h2").textContent,
      icon: win.dataset.icon,
      task: null,
      placed: false,
      busy: false
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
      if (!event.target.closest("button") && !win.hasAttribute("data-fixed")) win.classList.toggle("maximized");
    });
    makeDraggable(win);
  });

  function zoomFrom(win, from) {
    if (still || !from || !win.animate) return;
    const to = win.getBoundingClientRect();
    if (!to.width || !to.height) return;
    win.animate([
      {
        transformOrigin: "0 0",
        transform: "translate(" + (from.left - to.left) + "px, " + (from.top - to.top) + "px) scale(" + Math.max(0.04, from.width / to.width) + ", " + Math.max(0.04, from.height / to.height) + ")",
        opacity: 0.15
      },
      { transformOrigin: "0 0", transform: "none", opacity: 1 }
    ], { duration: 240, easing: "cubic-bezier(0.2, 0.75, 0.2, 1)" });
  }

  function afterAnimation(animation, duration, done) {
    let called = false;
    function once() {
      if (called) return;
      called = true;
      done();
    }
    animation.onfinish = once;
    animation.oncancel = once;
    setTimeout(once, duration + 120);
  }

  function zoomTo(win, to, done) {
    if (still || !to || !win.animate) {
      done();
      return;
    }
    const from = win.getBoundingClientRect();
    const animation = win.animate([
      { transformOrigin: "0 0", transform: "none", opacity: 1 },
      {
        transformOrigin: "0 0",
        transform: "translate(" + (to.left - from.left) + "px, " + (to.top - from.top) + "px) scale(" + Math.max(0.04, to.width / from.width) + ", " + Math.max(0.04, to.height / from.height) + ")",
        opacity: 0.15
      }
    ], { duration: 200, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)", fill: "forwards" });
    afterAnimation(animation, 200, function () {
      done();
      animation.cancel();
    });
  }

  function open(id, source) {
    const entry = windows.get(id);
    if (!entry || entry.busy) return;
    closeStart();
    const wasHidden = entry.el.hidden;
    entry.el.hidden = false;
    if (small.matches) entry.el.classList.add("maximized");
    if (!entry.placed) {
      place(entry.el);
      entry.placed = true;
    }
    if (!entry.task) entry.task = addTask(id, entry);
    focus(id);
    if (wasHidden) zoomFrom(entry.el, source || (entry.task && entry.task.getBoundingClientRect()));
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

  function close(id, instant) {
    const entry = windows.get(id);
    if (entry.el.hidden || instant || still || !entry.el.animate) {
      finishClose(entry);
      return;
    }
    entry.busy = true;
    const animation = entry.el.animate([
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "scale(0.96)" }
    ], { duration: 130, easing: "ease-in", fill: "forwards" });
    afterAnimation(animation, 130, function () {
      finishClose(entry);
      animation.cancel();
    });
  }

  function finishClose(entry) {
    entry.busy = false;
    entry.el.hidden = true;
    entry.el.classList.remove("active", "maximized");
    if (entry.task) {
      entry.task.remove();
      entry.task = null;
    }
    focusTopmost();
  }

  function minimize(id) {
    const entry = windows.get(id);
    if (entry.busy || entry.el.hidden) return;
    entry.busy = true;
    zoomTo(entry.el, entry.task && entry.task.getBoundingClientRect(), function () {
      entry.busy = false;
      entry.el.hidden = true;
      focusTopmost();
    });
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
      if (entry.busy) return;
      if (!entry.el.hidden && entry.el.classList.contains("active")) {
        minimize(id);
      } else if (entry.el.hidden) {
        entry.el.hidden = false;
        focus(id);
        zoomFrom(entry.el, button.getBoundingClientRect());
      } else {
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
    const art = icon.querySelector("svg");
    if (icon.dataset.open) open(icon.dataset.open, art.getBoundingClientRect());
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

  const marquee = document.createElement("div");
  marquee.className = "marquee";
  marquee.hidden = true;
  desktop.appendChild(marquee);
  let band = null;

  desktop.addEventListener("pointerdown", function (event) {
    if (event.target !== desktop && event.target.id !== "wallpaper") return;
    selectIcon(null);
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    const box = desktop.getBoundingClientRect();
    band = { x: event.clientX - box.left, y: event.clientY - box.top, id: event.pointerId, active: false };
  });

  window.addEventListener("pointermove", function (event) {
    if (!band || event.pointerId !== band.id) return;
    const box = desktop.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (!band.active && Math.hypot(x - band.x, y - band.y) < 6) return;
    band.active = true;
    marquee.hidden = false;
    const left = Math.min(x, band.x);
    const top = Math.min(y, band.y);
    const width = Math.abs(x - band.x);
    const height = Math.abs(y - band.y);
    marquee.style.left = left + "px";
    marquee.style.top = top + "px";
    marquee.style.width = width + "px";
    marquee.style.height = height + "px";
    document.querySelectorAll(".icon").forEach(function (icon) {
      const rect = icon.getBoundingClientRect();
      const hit = rect.right - box.left > left && rect.left - box.left < left + width
        && rect.bottom - box.top > top && rect.top - box.top < top + height;
      icon.classList.toggle("selected", hit);
    });
  });

  function endBand() {
    band = null;
    marquee.hidden = true;
  }

  window.addEventListener("pointerup", endBand);
  window.addEventListener("pointercancel", endBand);

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
      const art = item.querySelector("svg");
      open(item.dataset.open, art ? art.getBoundingClientRect() : null);
    });
  });

  startMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeStart);
  });

  function closeAll() {
    windows.forEach(function (entry, id) {
      if (entry.task || !entry.el.hidden) close(id, true);
    });
    cascade = 0;
  }

  document.getElementById("logoff").addEventListener("click", function () {
    closeStart();
    closeAll();
  });

  function powerDown() {
    closeStart();
    closeAll();
    hideBalloon();
    shutdown.hidden = false;
  }

  document.getElementById("turnoff").addEventListener("click", function () {
    window.dispatchEvent(new Event("xp:shutdown"));
  });

  window.addEventListener("xp:shutdown", powerDown);

  document.getElementById("poweron").addEventListener("click", function () {
    shutdown.hidden = true;
    window.dispatchEvent(new Event("xp:reboot"));
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
    const detail = event.detail;
    if (typeof detail === "string") {
      open(detail);
      return;
    }
    const box = desktop.getBoundingClientRect();
    const source = detail.x === undefined ? null : { left: detail.x - 24 + box.left, top: detail.y - 24 + box.top, width: 48, height: 48 };
    open(detail.id, source);
  });

  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    clock.title = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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

  window.addEventListener("xp:login", function () {
    setTimeout(function () {
      if (!small.matches) open("about");
    }, still ? 0 : 650);
    setTimeout(showBalloon, still ? 0 : 1600);
  });
})();
