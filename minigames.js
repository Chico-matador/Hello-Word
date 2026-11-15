// Mini games de ciência: aparecem de surpresa durante a missão, ligados ao que o jogador está fazendo.
//   microscope  → amostras coletadas (identificar o mineral na lâmina)
//   diffract    → blocos minerados (difratômetro de raios X, lei de Bragg)
//   spectrum    → profundidade / distância (linhas de espectro de emissão ou absorção)
// Uso: HWMini.open(kind, { world: "moon" | "mars", host: elemento }, (ok) => {...})
(() => {
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // ---------- dados ----------
  const MINERALS = {
    plagioclase: { name: "Plagioclase", look: "White-gray long crystals with thin parallel stripes.", d: [3.2, 4.04, 3.75], color: "#dfe3e8" },
    olivine: { name: "Olivine", look: "Olive-green rounded grains full of cracks.", d: [2.51, 3.88, 2.77], color: "#7fa83a" },
    ilmenite: { name: "Ilmenite", look: "Black opaque plates with a metallic shine.", d: [2.75, 2.54, 1.73], color: "#1c1e24" },
    glass: { name: "Impact glass", look: "Round orange and green beads, shiny like marbles.", d: [3.4, 2.1, 1.6], color: "#e8892c" },
    ice: { name: "Water ice", look: "Clear blue six-sided plates.", d: [3.9, 3.67, 3.44], color: "#9fd8f2" },
    hematite: { name: "Hematite", look: "Small dark red-gray spheres (\"blueberries\").", d: [2.7, 2.52, 1.69], color: "#7d3a32" },
    clay: { name: "Clay", look: "Fine brown flakes stacked in thin layers.", d: [4.45, 2.56, 1.49], color: "#9a6b45" },
  };
  const POOL = { moon: ["plagioclase", "olivine", "ilmenite", "glass"], mars: ["ice", "hematite", "olivine", "clay"] };

  // linhas visíveis em nm
  const ELEMENTS = {
    H: { name: "Hydrogen", lines: [656.3, 486.1, 434.0, 410.2] },
    He: { name: "Helium", lines: [587.6, 501.6, 447.1, 667.8] },
    Na: { name: "Sodium", lines: [589.0, 589.6] },
    Fe: { name: "Iron", lines: [438.4, 527.0, 495.7, 404.6] },
    Ca: { name: "Calcium", lines: [393.4, 396.8, 422.7] },
    Mg: { name: "Magnesium", lines: [516.7, 517.3, 518.4] },
    O: { name: "Oxygen", lines: [557.7, 630.0, 636.4] },
  };
  const LAMBDA = 1.789; // raio X do cobalto (Co Kα), o mesmo tubo do CheMin do Curiosity, em Å

  // cor aproximada de um comprimento de onda visível
  function waveColor(nm, a = 1) {
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else r = 1;
    const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
    const c = (v) => Math.round(255 * Math.pow(clamp(v * f, 0, 1), 0.8));
    return `rgba(${c(r)},${c(g)},${c(b)},${a})`;
  }

  // ---------- moldura comum ----------
  let cur = null;
  function frame(title, sub, host) {
    const box = document.createElement("div");
    box.className = "mini";
    box.innerHTML = `<div class="mini-panel panel">
      <div class="mini-head"><b>${title}</b><span>${sub}</span><button class="btn small" data-mini="skip">Skip</button></div>
      <div class="mini-body"></div>
      <p class="mini-msg" aria-live="polite"></p>
    </div>`;
    host.appendChild(box);
    return box;
  }
  function close(ok) {
    if (!cur) return;
    const c = cur;
    cur = null;
    window.removeEventListener("keydown", c.key, true);
    cancelAnimationFrame(c.raf);
    c.box.remove();
    c.done(ok);
  }
  function finish(ok, text) {
    const c = cur;
    c.finished = true;
    c.msg(text, ok ? "good" : "bad");
    const b = c.box.querySelector('[data-mini="skip"]');
    b.textContent = "Continue";
    b.dataset.mini = "close";
    b.focus({ preventScroll: true });
    c.result = ok;
  }

  function open(kind, ctx, done) {
    if (cur) close(false);
    const host = ctx.host || document.getElementById("stage");
    const world = ctx.world === "mars" ? "mars" : "moon";
    const G = { microscope, diffract, spectrum }[kind] || microscope;
    const box = frame(...G.title(world), host);
    const body = box.querySelector(".mini-body");
    const msgEl = box.querySelector(".mini-msg");
    cur = { box, body, done, world, raf: 0, finished: false, result: false,
      msg: (t, cls = "") => { msgEl.textContent = t; msgEl.className = `mini-msg ${cls}`; } };
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mini]");
      if (!b || !cur) return;
      if (b.dataset.mini === "skip") close(false);
      else if (b.dataset.mini === "close") close(cur.result);
    });
    cur.key = (e) => {
      if (!cur) return;
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); close(cur.finished ? cur.result : false); return; }
      if (cur.onKey && !cur.finished) cur.onKey(e);
    };
    window.addEventListener("keydown", cur.key, true);
    G.start(cur);
  }

  // ======================================================================
  // 1. MICROSCÓPIO: focar a lâmina e reconhecer o mineral
  // ======================================================================
  const microscope = {
    title: () => ["MAHLI · hand lens imager", "Curiosity's close-up camera. Focus on the grains, then identify the mineral."],
    start(c) {
      const id = rnd(POOL[c.world]);
      const opts = shuffle([id, ...shuffle(POOL[c.world].filter((k) => k !== id)).slice(0, 2)]);
      c.body.innerHTML = `<div class="mini-row">
        <canvas width="420" height="420" class="scope"></canvas>
        <div class="mini-side">
          <label>Focus <input type="range" min="0" max="100" value="${Math.random() < 0.5 ? 6 : 94}" class="focus"></label>
          <label>Zoom <input type="range" min="1" max="3" step="0.1" value="1.4" class="zoom"></label>
          <p class="dim">← → focus · ↑ ↓ zoom</p>
          <h4>Field guide</h4>
          <ul class="guide">${POOL[c.world].map((k) => `<li><b>${MINERALS[k].name}:</b> ${MINERALS[k].look}</li>`).join("")}</ul>
          <div class="mini-choices">${opts.map((k) => `<button class="btn small" data-pick="${k}">${MINERALS[k].name}</button>`).join("")}</div>
        </div></div>`;
      const cv = c.body.querySelector("canvas"), g = cv.getContext("2d");
      const focus = c.body.querySelector(".focus"), zoom = c.body.querySelector(".zoom");
      const target = 35 + Math.random() * 30;
      const grains = makeGrains(id);
      c.msg("Turn the focus until the crystals look sharp.");
      c.onKey = (e) => {
        if (e.key === "ArrowLeft" || e.key === "a") focus.value = +focus.value - 2;
        else if (e.key === "ArrowRight" || e.key === "d") focus.value = +focus.value + 2;
        else if (e.key === "ArrowUp" || e.key === "w") zoom.value = +zoom.value + 0.1;
        else if (e.key === "ArrowDown" || e.key === "s") zoom.value = +zoom.value - 0.1;
        else return;
        e.preventDefault();
      };
      c.body.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pick]");
        if (!b || c.finished) return;
        const blur = Math.abs(+focus.value - target);
        if (blur > 8) return c.msg("Too blurry to be sure. Focus first!", "bad");
        const ok = b.dataset.pick === id;
        b.classList.add(ok ? "right" : "wrong");
        finish(ok, ok ? `Correct: ${MINERALS[id].name}. Sample logged!` : `Not quite. It was ${MINERALS[id].name}: ${MINERALS[id].look}`);
      });
      const draw = (t) => {
        const blur = Math.abs(+focus.value - target);
        g.save();
        g.fillStyle = "#000"; g.fillRect(0, 0, 420, 420);
        g.beginPath(); g.arc(210, 210, 200, 0, Math.PI * 2); g.clip();
        g.fillStyle = id === "ilmenite" || id === "hematite" ? "#e9e2cf" : "#f4efe2";
        g.fillRect(0, 0, 420, 420);
        g.filter = `blur(${(blur * 0.22).toFixed(1)}px)`;
        g.translate(210, 210); g.scale(+zoom.value, +zoom.value); g.translate(-210 + Math.sin(t / 1300) * 4, -210);
        for (const gr of grains) gr(g);
        g.restore();
        // anel da ocular e retículo
        g.strokeStyle = "#0b1830"; g.lineWidth = 16; g.beginPath(); g.arc(210, 210, 204, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(210, 30); g.lineTo(210, 390); g.moveTo(30, 210); g.lineTo(390, 210); g.stroke();
        const sharp = blur <= 8;
        g.fillStyle = sharp ? "#3fe6a0" : "#f0a03c"; g.font = "bold 16px monospace";
        g.fillText(sharp ? "IN FOCUS" : "BLURRY", 16, 404);
        c.raf = requestAnimationFrame(draw);
      };
      c.raf = requestAnimationFrame(draw);
    },
  };

  // desenhos de cada mineral na lâmina, gerados uma vez por partida
  function makeGrains(id) {
    const list = [];
    const R = () => 40 + Math.random() * 340;
    const n = { plagioclase: 26, olivine: 22, ilmenite: 18, glass: 30, ice: 20, hematite: 34, clay: 40 }[id];
    for (let i = 0; i < n; i++) {
      const x = R(), y = R(), a = Math.random() * Math.PI, s = 0.6 + Math.random() * 0.8;
      list.push((g) => {
        g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
        if (id === "plagioclase") {
          g.fillStyle = "#d9dde3"; g.strokeStyle = "#7b8594"; g.lineWidth = 2;
          g.fillRect(-34, -8, 68, 16); g.strokeRect(-34, -8, 68, 16);
          g.strokeStyle = "#9aa3b0"; g.lineWidth = 1;
          for (let k = -30; k < 34; k += 6) { g.beginPath(); g.moveTo(k, -8); g.lineTo(k, 8); g.stroke(); }
        } else if (id === "olivine") {
          g.fillStyle = "#86ad3e"; g.strokeStyle = "#3f5a18"; g.lineWidth = 2;
          g.beginPath(); for (let k = 0; k < 7; k++) { const r = 16 + ((k * 7) % 5); g.lineTo(Math.cos(k * 0.9) * r, Math.sin(k * 0.9) * r); } g.closePath(); g.fill(); g.stroke();
          g.strokeStyle = "#2f4410"; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, -4); g.lineTo(4, 3); g.lineTo(12, -6); g.moveTo(-4, 8); g.lineTo(2, 0); g.stroke();
        } else if (id === "ilmenite") {
          g.fillStyle = "#17191f"; g.beginPath(); g.moveTo(-22, -10); g.lineTo(18, -14); g.lineTo(24, 8); g.lineTo(-16, 14); g.closePath(); g.fill();
          g.fillStyle = "rgba(190,200,220,0.7)"; g.fillRect(-8, -9, 14, 3);
        } else if (id === "glass") {
          g.fillStyle = i % 3 ? "#e8892c" : "#3e9a5a"; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
          g.strokeStyle = "#5a2e0c"; g.lineWidth = 2; g.stroke();
          g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(-5, -6, 4, 4);
        } else if (id === "ice") {
          g.fillStyle = "rgba(150,210,240,0.55)"; g.strokeStyle = "#3c86b8"; g.lineWidth = 2;
          g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(Math.cos((k * Math.PI) / 3) * 22, Math.sin((k * Math.PI) / 3) * 22); g.closePath(); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.stroke();
        } else if (id === "hematite") {
          g.fillStyle = "#6f3a34"; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#9b5a50"; g.fillRect(-4, -5, 3, 3);
          g.strokeStyle = "#3a1c18"; g.lineWidth = 1.5; g.stroke();
        } else {
          g.fillStyle = "#9a6b45"; g.strokeStyle = "#5e3d22"; g.lineWidth = 1;
          for (let k = 0; k < 4; k++) { g.fillRect(-20, -8 + k * 4, 40, 3); g.strokeRect(-20, -8 + k * 4, 40, 3); }
        }
        g.restore();
      });
    }
    return list;
  }

  // ======================================================================
  // 2. DIFRATÔMETRO: varrer o ângulo, marcar os 3 picos, achar o padrão
  // ======================================================================
  const diffract = {
    title: () => ["CheMin · X-ray diffraction", "Curiosity's mineral lab. Sweep the detector and mark the 3 peaks."],
    start(c) {
      const id = rnd(POOL[c.world]);
      const opts = shuffle([id, ...shuffle(POOL[c.world].filter((k) => k !== id)).slice(0, 2)]);
      const twoTheta = (d) => (2 * Math.asin(LAMBDA / (2 * d)) * 180) / Math.PI;
      const peaks = MINERALS[id].d.map((d, i) => ({ at: twoTheta(d), h: [1, 0.7, 0.5][i] }));
      const MIN = 10, MAX = 80;
      c.body.innerHTML = `<div class="mini-col">
        <canvas width="860" height="300" class="xrd"></canvas>
        <div class="mini-row tight">
          <label class="grow">Detector angle 2θ <input type="range" min="${MIN}" max="${MAX}" step="0.1" value="${MIN}" class="ang"></label>
          <button class="btn small" data-act2="mark">Mark peak (Space)</button>
          <b class="marks">Peaks 0/3</b>
        </div>
        <p class="dim">Bragg's law: nλ = 2d·sinθ. CheMin uses a cobalt X-ray tube, λ = ${LAMBDA} Å. Each peak tells a spacing d between atom layers.</p>
        <div class="mini-choices hidden-until">${opts.map((k) => `<button class="btn small" data-pick="${k}">${MINERALS[k].name}<small>${MINERALS[k].d.map((d) => twoTheta(d).toFixed(1) + "°").join(" · ")}</small></button>`).join("")}</div>
      </div>`;
      const cv = c.body.querySelector("canvas"), g = cv.getContext("2d");
      const ang = c.body.querySelector(".ang");
      const choices = c.body.querySelector(".mini-choices");
      choices.hidden = true;
      const seen = new Float32Array(601).fill(-1);
      const marks = [];
      const noise = Array.from({ length: 601 }, () => Math.random() * 0.05);
      const I = (x) => peaks.reduce((s, p) => s + p.h * Math.exp(-((x - p.at) ** 2) / 0.18), 0.04 + noise[Math.round(((x - MIN) / (MAX - MIN)) * 600)]);
      const X = (a) => 40 + ((a - MIN) / (MAX - MIN)) * 800;
      c.msg("Move the angle slowly. Peaks show up as tall spikes.");
      const mark = () => {
        if (marks.length >= 3 || c.finished) return;
        const a = +ang.value;
        if (marks.some((m) => Math.abs(m - a) < 1)) return c.msg("Already marked that one.", "bad");
        const hit = peaks.some((p) => Math.abs(p.at - a) < 0.6);
        if (!hit) return c.msg("No peak there: the signal is just noise. Look for a tall spike.", "bad");
        marks.push(a);
        c.body.querySelector(".marks").textContent = `Peaks ${marks.length}/3`;
        if (marks.length === 3) {
          const ds = marks.map((m) => (LAMBDA / (2 * Math.sin((m / 2) * Math.PI / 180))).toFixed(2));
          c.msg(`3 peaks: d = ${ds.join(", ")} Å. Which mineral has this pattern?`, "good");
          choices.hidden = false;
        } else c.msg(`Peak at ${a.toFixed(1)}°. ${3 - marks.length} to go.`, "good");
      };
      c.onKey = (e) => {
        if (e.key === "ArrowLeft" || e.key === "a") ang.value = +ang.value - 0.2;
        else if (e.key === "ArrowRight" || e.key === "d") ang.value = +ang.value + 0.2;
        else if (e.key === " " || e.key === "Enter") mark();
        else return;
        e.preventDefault();
      };
      c.body.addEventListener("click", (e) => {
        if (e.target.closest('[data-act2="mark"]')) return mark();
        const b = e.target.closest("[data-pick]");
        if (!b || c.finished || choices.hidden) return;
        const ok = b.dataset.pick === id;
        b.classList.add(ok ? "right" : "wrong");
        finish(ok, ok ? `Match! The crystal is ${MINERALS[id].name}.` : `Not this one. The pattern belongs to ${MINERALS[id].name}.`);
      });
      const draw = () => {
        const a = +ang.value;
        const i = Math.round(((a - MIN) / (MAX - MIN)) * 600);
        for (let k = Math.max(0, i - 2); k <= Math.min(600, i + 2); k++) seen[k] = I(MIN + (k / 600) * (MAX - MIN));
        g.fillStyle = "#06101f"; g.fillRect(0, 0, 860, 300);
        g.strokeStyle = "#1b3354"; g.lineWidth = 1;
        for (let t = MIN; t <= MAX; t += 5) { g.beginPath(); g.moveTo(X(t), 20); g.lineTo(X(t), 270); g.stroke(); g.fillStyle = "#6f8fb8"; g.font = "12px monospace"; g.fillText(`${t}°`, X(t) - 10, 288); }
        g.strokeStyle = "#3fe6ee"; g.lineWidth = 2; g.beginPath();
        let pen = false;
        for (let k = 0; k <= 600; k++) {
          if (seen[k] < 0) { pen = false; continue; }
          const x = 40 + (k / 600) * 800, y = 268 - seen[k] * 230;
          if (pen) g.lineTo(x, y); else g.moveTo(x, y);
          pen = true;
        }
        g.stroke();
        for (const m of marks) { g.fillStyle = "#ffd23f"; g.fillRect(X(m) - 2, 14, 4, 12); g.fillText(`${m.toFixed(1)}°`, X(m) - 14, 12); }
        // detector
        g.strokeStyle = "rgba(255,120,80,0.8)"; g.beginPath(); g.moveTo(X(a), 20); g.lineTo(X(a), 270); g.stroke();
        g.fillStyle = "#ff7850"; g.font = "bold 14px monospace"; g.fillText(`2θ ${a.toFixed(1)}°  I ${Math.round(I(a) * 100)}`, Math.min(720, X(a) + 6), 40);
        c.raf = requestAnimationFrame(draw);
      };
      c.raf = requestAnimationFrame(draw);
    },
  };

  // ======================================================================
  // 3. ESPECTRO: ligar os elementos certos até as linhas baterem
  // ======================================================================
  const spectrum = {
    title: () => ["ChemCam · laser spectrometer", "Curiosity zaps the rock with a laser. Which elements made this light?"],
    start(c) {
      const emission = true; // o laser do ChemCam vira a rocha em plasma: espectro de emissão
      const pool = c.world === "mars" ? ["Fe", "Ca", "Na", "Mg", "H", "O"] : ["Fe", "Ca", "Na", "Mg", "O", "He"];
      const answer = shuffle(pool).slice(0, 2).sort();
      const lines = answer.flatMap((e) => ELEMENTS[e].lines);
      const on = new Set();
      c.body.innerHTML = `<div class="mini-col">
        <p class="dim">${emission
          ? "<b>Emission</b>: the laser heats a pinhead of rock into glowing plasma. Each element shines only at its own colors, so bright lines on black tell what the rock is made of."
          : "<b>Absorption</b>: gas in front of sunlight steals exactly those colors. Dark lines on the rainbow."}</p>
        <canvas width="860" height="210" class="spec"></canvas>
        <div class="mini-elems">${pool.map((e) => `<button class="btn small" data-el="${e}"><b>${e}</b><small>${ELEMENTS[e].name}</small></button>`).join("")}</div>
        <div class="mini-row tight"><span class="dim grow">Turn on elements until the bottom strip matches the observed one. Two elements are hiding in this light.</span>
        <button class="btn small" data-act2="check">Analyze</button></div>
      </div>`;
      const cv = c.body.querySelector("canvas"), g = cv.getContext("2d");
      const X = (nm) => 30 + ((nm - 380) / 320) * 800;
      const strip = (y, ls, label) => {
        if (emission) { g.fillStyle = "#000"; g.fillRect(30, y, 800, 56); }
        else for (let nm = 380; nm < 700; nm += 1) { g.fillStyle = waveColor(nm); g.fillRect(X(nm), y, 3, 56); }
        for (const nm of ls) {
          g.fillStyle = emission ? waveColor(nm) : "rgba(0,0,0,0.85)";
          g.fillRect(X(nm) - 1.5, y, 3, 56);
        }
        g.fillStyle = "#cfe"; g.font = "13px monospace"; g.fillText(label, 30, y - 6);
      };
      c.msg("Compare the two strips and toggle elements.");
      const check = () => {
        const pick = [...on].sort();
        if (pick.length !== 2) return c.msg(pick.length < 2 ? "Some lines are still missing." : "Too many elements: extra lines appear that are not observed.", "bad");
        const ok = pick.join() === answer.join();
        finish(ok, ok ? `Spectrum solved: ${answer.map((e) => ELEMENTS[e].name).join(" + ")}!` : `Close, but the lines don't match. It was ${answer.map((e) => ELEMENTS[e].name).join(" + ")}.`);
      };
      c.body.addEventListener("click", (e) => {
        if (c.finished) return;
        if (e.target.closest('[data-act2="check"]')) return check();
        const b = e.target.closest("[data-el]");
        if (!b) return;
        const el = b.dataset.el;
        if (on.has(el)) on.delete(el); else on.add(el);
        b.classList.toggle("on", on.has(el));
      });
      c.onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } };
      const draw = () => {
        g.fillStyle = "#06101f"; g.fillRect(0, 0, 860, 210);
        strip(26, lines, "Observed");
        strip(122, [...on].flatMap((e) => ELEMENTS[e].lines), "Your elements");
        g.fillStyle = "#6f8fb8"; g.font = "12px monospace";
        for (let nm = 400; nm <= 700; nm += 50) g.fillText(`${nm} nm`, X(nm) - 22, 202);
        c.raf = requestAnimationFrame(draw);
      };
      c.raf = requestAnimationFrame(draw);
    },
  };

  window.HWMini = { open, close: () => close(false), get active() { return !!cur; } };
})();
