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
  const colors = { done: ["#2f5fd0", "#4677e0"], todo: "#e23b2e", free: "#ffffff", gap: "#d4d0c8", helped: "#f0a020", helpedOpen: "#f8d98c" };
  const helpedList = document.getElementById("status-helped");

  function libc(names) {
    return names.map(function (name) {
      return name + "_nid_postfix";
    });
  }

  const ourPrs = [
    { number: 886, state: "merged", title: "Count sceHttpParseStatusLine as implemented", functions: ["sceHttpParseStatusLine"] },
    { number: 1116, state: "open", title: "Read guest wide strings as 16-bit units", functions: libc(["wcslen", "wcscpy", "wcsncpy", "wcscmp", "wcsncmp", "wcschr", "wcsrchr", "wcsstr", "wcspbrk", "wcsspn", "wmemchr", "wmemcmp", "wmemcpy", "wmemmove", "wmemset"]) },
    { number: 1126, state: "open", title: "Parse and collate guest wide strings as 16-bit units", functions: libc(["wcscoll", "wcsxfrm", "wcstol", "wcstoll", "wcstoul", "wcstoull", "wcstof", "wcstod", "wcstold"]) },
    { number: 872, state: "merged", title: "Guard NOMINMAX before including windows.h", functions: [] },
    { number: 883, state: "merged", title: "Fix the MemoryPool.hpp include guard", functions: [] },
    { number: 923, state: "merged", title: "Correct the barycentric entry in TechnicalDebt", functions: [] },
    { number: 1115, state: "merged", title: "Guard NOMINMAX in Rtld.cpp", functions: [] }
  ];

  const helpedBy = {};
  ourPrs.forEach(function (pr) {
    pr.functions.forEach(function (name) {
      helpedBy[name] = pr;
    });
  });

  function fillHelped() {
    helpedList.textContent = "";
    ourPrs.forEach(function (pr) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "https://github.com/boykopovar/AnyPS5/pull/" + pr.number;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "#" + pr.number;
      const what = document.createElement("span");
      what.className = "what";
      what.textContent = pr.title;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = pr.functions.length ? pr.functions.length + (pr.functions.length === 1 ? " function" : " functions") : "build/docs";
      const badge = document.createElement("span");
      badge.className = pr.state === "merged" ? "merged" : "open";
      badge.textContent = pr.state === "merged" ? "merged" : "in review";
      item.append(link, what, count, badge);
      helpedList.appendChild(item);
    });
  }

  function loadPrStates() {
    fetch("https://api.github.com/search/issues?q=repo:boykopovar/AnyPS5+author:Fishybeing+type:pr&per_page=50")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (json) {
        json.items.forEach(function (issue) {
          const pr = ourPrs.find(function (entry) {
            return entry.number === issue.number;
          });
          if (!pr) return;
          if (issue.pull_request && issue.pull_request.merged_at) pr.state = "merged";
          else if (issue.state === "open") pr.state = "open";
        });
        fillHelped();
        if (cells.length) draw();
      })
      .catch(function () {});
  }

  fillHelped();
  loadPrStates();

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
        cells.push({ group: group.label, name: name, done: true, shade: index % 2, pr: libraries ? helpedBy[name] : null });
      });
      group.todo_names.forEach(function (name) {
        cells.push({ group: group.label, name: name, done: false, shade: index % 2, pr: libraries ? helpedBy[name] : null });
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
      else if (cell.pr) g.fillStyle = cell.pr.state === "merged" ? colors.helped : colors.helpedOpen;
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
    const helped = cell.pr ? " · our PR #" + cell.pr.number + (cell.pr.state === "merged" ? " (merged)" : " (in review)") : "";
    tip.textContent = cell.group + " · " + cell.name + (cell.done ? " (implemented)" : " (missing)") + helped;
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
