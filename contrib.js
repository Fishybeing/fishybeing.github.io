(function () {
  const win = document.getElementById("win-anyps5");
  if (!win) return;

  const repo = "boykopovar/AnyPS5";
  const author = "Fishybeing";
  const api = "https://api.github.com/";
  const cacheKey = "xp-anyps5-share";
  const maxAge = 30 * 60 * 1000;
  const percent = document.getElementById("share-percent");
  const ratio = document.getElementById("share-ratio");
  const added = document.getElementById("share-added");
  const removed = document.getElementById("share-removed");
  const prs = document.getElementById("share-prs");
  const prsLabel = document.getElementById("share-prs-label");
  const size = document.getElementById("share-size");
  const note = document.getElementById("share-note");
  const recount = document.getElementById("share-recount");
  const summary = win.querySelector(".statusbar span");
  let loading = false;

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function getJson(path) {
    return fetch(api + path, { headers: { Accept: "application/vnd.github+json" } }).then(function (response) {
      if (response.status === 202) return { pending: true };
      if (response.status === 403 || response.status === 429) throw new Error("limit");
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  function search(query, perPage) {
    return getJson("search/issues?q=" + encodeURIComponent(query) + "&per_page=" + perPage);
  }

  async function projectLines() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const weeks = await getJson("repos/" + repo + "/stats/code_frequency");
      if (Array.isArray(weeks)) {
        return weeks.reduce(function (sum, week) {
          return sum + week[1] + week[2];
        }, 0);
      }
      await wait(2500);
    }
    return 0;
  }

  async function count() {
    const mine = await search("repo:" + repo + " is:pr author:" + author, 100);
    const everyone = await search("repo:" + repo + " is:pr is:merged", 1);
    const list = mine.items.map(function (item) {
      const merged = item.pull_request && item.pull_request.merged_at;
      return { number: item.number, state: merged ? "merged" : item.state === "open" ? "open" : "closed" };
    });
    const merged = list.filter(function (pr) {
      return pr.state === "merged";
    });
    const details = await Promise.all(merged.map(function (pr) {
      return getJson("repos/" + repo + "/pulls/" + pr.number);
    }));
    let plus = 0;
    let minus = 0;
    details.forEach(function (detail) {
      plus += detail.additions || 0;
      minus += detail.deletions || 0;
    });
    return { time: Date.now(), prs: list, added: plus, removed: minus, mergedTotal: everyone.total_count, lines: await projectLines() };
  }

  function format(value) {
    if (value >= 10) return value.toFixed(1);
    if (value >= 0.1) return value.toFixed(2);
    return value.toFixed(3);
  }

  function render(data) {
    const mergedMine = data.prs.filter(function (pr) {
      return pr.state === "merged";
    }).length;
    const openMine = data.prs.filter(function (pr) {
      return pr.state === "open";
    }).length;
    const net = data.added - data.removed;

    added.textContent = "+" + data.added.toLocaleString();
    removed.textContent = "-" + data.removed.toLocaleString();
    prs.textContent = mergedMine + " of " + data.mergedTotal.toLocaleString();
    prsLabel.textContent = "merged pull requests (" + format(data.mergedTotal ? mergedMine / data.mergedTotal * 100 : 0) + "% of all)";

    if (data.lines > 0) {
      const share = net / data.lines * 100;
      percent.textContent = format(Math.max(0, share)) + "%";
      size.textContent = data.lines.toLocaleString();
      ratio.textContent = net > 0
        ? "That's about 1 in every " + Math.round(data.lines / net).toLocaleString() + " lines, from " + net.toLocaleString() + " net lines across " + mergedMine + " merged pull requests."
        : "None of my merged pull requests have added lines yet.";
    } else {
      percent.textContent = "...";
      size.textContent = "...";
      ratio.textContent = "GitHub is still counting the project's lines. Press Recount in a minute.";
    }

    summary.textContent = mergedMine + " merged" + (openMine ? " · " + openMine + " open" : "");

    win.querySelectorAll("legend").forEach(function (legend) {
      const match = legend.textContent.match(/^#(\d+)/);
      const badge = legend.querySelector(".merged, .open, .closed");
      if (!match || !badge) return;
      const pr = data.prs.find(function (entry) {
        return entry.number === Number(match[1]);
      });
      if (!pr) return;
      badge.className = pr.state;
      badge.textContent = pr.state;
    });

    note.textContent = "Counted live from GitHub on " + new Date(data.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      + ". Lines come from the diffs of my merged pull requests, tests and docs included, measured against every line in the repository.";
  }

  function stored() {
    try {
      return JSON.parse(localStorage.getItem(cacheKey));
    } catch (error) {
      return null;
    }
  }

  async function refresh(force) {
    const saved = stored();
    if (saved && !force && Date.now() - saved.time < maxAge) {
      render(saved);
      return;
    }
    if (loading) return;
    loading = true;
    recount.disabled = true;
    if (saved) render(saved);
    note.textContent = "Counting on GitHub...";
    try {
      const data = await count();
      render(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (error) {}
    } catch (error) {
      note.textContent = error.message === "limit"
        ? "GitHub's hourly limit for visitors was reached. Try Recount again in a few minutes."
        : "Couldn't reach GitHub right now. Try Recount again in a moment.";
      if (!saved) ratio.textContent = "";
    } finally {
      loading = false;
      recount.disabled = false;
    }
  }

  recount.addEventListener("click", function () {
    refresh(true);
  });

  let wasHidden = win.hidden;
  new MutationObserver(function () {
    if (wasHidden && !win.hidden) refresh(false);
    wasHidden = win.hidden;
  }).observe(win, { attributes: true, attributeFilter: ["hidden"] });
})();
