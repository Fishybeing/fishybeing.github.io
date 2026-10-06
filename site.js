(function () {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!still) {
    document.querySelectorAll(".case").forEach(function (box) {
      box.addEventListener("pointermove", function (event) {
        if (event.pointerType !== "mouse") return;
        const rect = box.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        box.classList.add("live");
        box.style.setProperty("--ry", (16 + x * 20).toFixed(2) + "deg");
        box.style.setProperty("--rx", (-5 - y * 14).toFixed(2) + "deg");
      });
      box.addEventListener("pointerleave", function () {
        box.classList.remove("live");
        box.style.removeProperty("--ry");
        box.style.removeProperty("--rx");
      });
    });
  }

  const block = document.querySelector(".block");
  if (!block) return;

  let seed = 5;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }

  function pick(list) {
    return list[Math.floor(random() * list.length)];
  }

  const grass = ["#5f9a32", "#6ea53c", "#79b347", "#568c2c", "#83bb4f"];
  const dirt = ["#7a5432", "#86603a", "#6b4829", "#916a43", "#5e3f24"];

  function texture(paintPixel) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const g = canvas.getContext("2d");
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        g.fillStyle = paintPixel(x, y);
        g.fillRect(x, y, 1, 1);
      }
    }
    return "url(" + canvas.toDataURL() + ")";
  }

  const fringe = Array.from({ length: 16 }, function () {
    return 3 + Math.floor(random() * 3);
  });

  block.style.setProperty("--tex-top", texture(function () {
    return pick(grass);
  }));
  block.style.setProperty("--tex-side", texture(function (x, y) {
    return y < fringe[x] ? pick(grass) : pick(dirt);
  }));
  block.style.setProperty("--tex-dirt", texture(function () {
    return pick(dirt);
  }));
})();
