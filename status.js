(function () {
  const win = document.getElementById("win-status");
  if (!win) return;

  const source = "https://boykopovar.github.io/AnyPS5/progress.json";
  const desktop = document.getElementById("desktop");
  const tip = document.getElementById("tip");
  const line = document.getElementById("status-line");
  const bar = document.getElementById("status-bar");
  const canvas = document.getElementById("status-map");
  const body = document.querySelector("#status-table tbody");
  const groupsLegend = document.getElementById("status-groups");
  const note = document.getElementById("status-note");
  const updated = document.getElementById("status-updated");
  const analyze = document.getElementById("status-analyze");
  const tabs = win.querySelectorAll("[role=tab]");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = { done: ["#2f5fd0", "#4677e0"], todo: "#e23b2e", free: "#ffffff", gap: "#d4d0c8" };

  let data = null;
  let set = "libraries";
  let cells = [];
  let grid = { size: 8, columns: 1 };
  let revealed = 0;
  let loading = false;
  let animation = 0;

  function load() {
    if (loading) return;
    loading = true;
    analyze.disabled = true;
    line.textContent = "Analyzing...";
    fetch(source, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        const modified = response.headers.get("last-modified");
        if (modified) {
          updated.textContent = "Updated " + new Date(modified).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        }
        return response.json();
      })
      .then(function (json) {
        data = json;
        show(true);
      })
      .catch(function () {
        line.textContent = "Couldn't reach boykopovar.github.io. Try Analyze again in a moment.";
      })
      .finally(function () {
        loading = false;
        analyze.disabled = false;
      });
  }

  function show(animate) {
    if (!data || !data[set]) return;
    const info = data[set];
    const libraries = set === "libraries";
    line.textContent = (libraries ? "System libraries*: " : "Shader instructions: ") + info.percent + "% (" + info.done + " of " + info.total + ")";
    groupsLegend.textContent = libraries ? "Libraries" : "Shader groups";
    note.hidden = !libraries;
    bar.style.width = info.percent + "%";

    cells = [];
    info.groups.forEach(function (group, index) {
      group.done_names.forEach(function (name) {
        cells.push({ group: group.label, name: name, done: true, shade: index % 2 });
      });
      group.todo_names.forEach(function (name) {
        cells.push({ group: group.label, name: name, done: false, shade: index % 2 });
      });
    });

    fillTable(info.groups);
    layout();
    cancelAnimationFrame(animation);
    if (animate && !still) {
      revealed = 0;
      const start = performance.now();
      const step = function (now) {
        revealed = Math.min(cells.length, Math.ceil(((now - start) / 1400) * cells.length));
        draw();
        if (revealed < cells.length) animation = requestAnimationFrame(step);
      };
      animation = requestAnimationFrame(step);
    } else {
      revealed = cells.length;
      draw();
    }
  }

  function fillTable(groups) {
    body.textContent = "";
    groups.forEach(function (group) {
      const total = group.done + group.todo;
      if (!total) return;
      const percent = Math.round((group.done / total) * 100);
      const row = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = group.label;
      const done = document.createElement("td");
      done.textContent = group.done;
      const all = document.createElement("td");
      all.textContent = total;
      const progress = document.createElement("td");
      const meter = document.createElement("span");
      meter.className = "meter";
      const fill = document.createElement("i");
      fill.style.width = percent + "%";
      meter.appendChild(fill);
      const label = document.createElement("span");
      label.textContent = percent + "%";
      progress.append(meter, label);
      row.append(name, done, all, progress);
      body.appendChild(row);
    });
  }

  function layout() {
    const width = canvas.parentElement.clientWidth - 22;
    if (width <= 0) return;
    const count = Math.max(cells.length, 1);
    let size = 9;
    while (size > 4 && Math.ceil(count / Math.floor(width / size)) * size > 300) size -= 1;
    const columns = Math.max(1, Math.floor(width / size));
    const rows = Math.ceil(count / columns);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = columns * size + "px";
    canvas.style.height = rows * size + "px";
    canvas.width = Math.round(columns * size * ratio);
    canvas.height = Math.round(rows * size * ratio);
    canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    grid = { size: size, columns: columns, rows: rows };
  }

  function draw() {
    const g = canvas.getContext("2d");
    const size = grid.size;
    g.fillStyle = colors.gap;
    g.fillRect(0, 0, grid.columns * size, grid.rows * size);
    cells.forEach(function (cell, index) {
      const x = (index % grid.columns) * size;
      const y = Math.floor(index / grid.columns) * size;
      if (index >= revealed) g.fillStyle = colors.free;
      else g.fillStyle = cell.done ? colors.done[cell.shade] : colors.todo;
      g.fillRect(x, y, size - 1, size - 1);
    });
  }

  function cellAt(event) {
    const box = canvas.getBoundingClientRect();
    const column = Math.floor((event.clientX - box.left) / grid.size);
    const row = Math.floor((event.clientY - box.top) / grid.size);
    if (column < 0 || column >= grid.columns || row < 0) return null;
    return cells[row * grid.columns + column] || null;
  }

  canvas.addEventListener("pointermove", function (event) {
    const cell = cellAt(event);
    if (!cell) {
      tip.hidden = true;
      return;
    }
    const box = desktop.getBoundingClientRect();
    tip.textContent = cell.group + " · " + cell.name + (cell.done ? " (implemented)" : " (missing)");
    tip.hidden = false;
    tip.style.zIndex = "100000";
    tip.style.left = Math.min(event.clientX - box.left + 14, box.width - tip.offsetWidth - 4) + "px";
    tip.style.top = event.clientY - box.top + 18 + "px";
  });

  canvas.addEventListener("pointerleave", function () {
    tip.hidden = true;
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      set = tab.dataset.set;
      tabs.forEach(function (other) {
        other.setAttribute("aria-selected", String(other === tab));
      });
      if (data) show(true);
    });
  });

  analyze.addEventListener("click", load);

  new MutationObserver(function () {
    if (win.hidden) return;
    if (!data) load();
    else {
      layout();
      draw();
    }
  }).observe(win, { attributes: true, attributeFilter: ["hidden", "class"] });

  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      if (win.hidden || !cells.length) return;
      layout();
      draw();
    }).observe(canvas.parentElement);
  }
})();
