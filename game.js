// HELLO WORLD: montagem com economia, mapa, quests e tripulação.
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const stage = $("#stage");

  // ---------------- dados ----------------

  // Os cinco papéis. Cada um muda uma regra real na exploração (moon.js recebe "perk").
  const CREW = [
    { id: "orange", role: "Engineer", perkText: "Mines 40% faster.", colors: ["#f39a4a", "#e0731f", "#a8501a"], stats: [7, 2, 3, 4, 4], perk: { mineCd: 75 } },
    { id: "green", role: "Scientist", perkText: "Grabs samples from farther away. Quest rewards +25%.", colors: ["#b6ea4a", "#8fd02a", "#5c9a1c"], stats: [2, 7, 3, 3, 4], perk: { pickRadius: 110 }, bonus: 1.25 },
    { id: "blue", role: "Communications", perkText: "Radio compass: points to the nearest sample, then back home.", colors: ["#5b86ee", "#3a62d6", "#2743a0"], stats: [3, 4, 7, 4, 4], perk: { compass: true } },
    { id: "yellow", role: "Power Engineer", perkText: "Uses 40% less oxygen and gets stamina back faster.", colors: ["#ffe04a", "#f2c21c", "#b88a10"], stats: [3, 3, 3, 7, 4], perk: { o2Rate: 0.6, staminaRegen: 1.6 } },
    { id: "pink", role: "Flight Surgeon", perkText: "140 health and heals slowly over time.", colors: ["#f58ac0", "#e0559c", "#a8356f"], stats: [2, 3, 3, 4, 7], perk: { hpMax: 140, regen: 0.8 } },
  ];
  const STAT_NAMES = ["Mining", "Science", "Navigation", "Endurance", "Health"];
  const TEAM_MAX = 4;

  // Peças: custo em milhões, massa (t, com combustível), empuxo, combustível, eficiência.
  // iw/ih/body: tamanho do desenho e fração da largura que é corpo (para empilhar alinhado).
  const PARTS = {
    solid_motor: { name: "Solid Motor", cost: 15, mass: 3, thrust: 34, eff: 0.8, iw: 128, ih: 260, body: 0.96, note: "Cheap, weak and thirsty." },
    r_engine: { name: "Triple Engine", cost: 35, mass: 4, thrust: 48, eff: 1.0, iw: 291, ih: 220, body: 0.68, note: "Strong all-rounder." },
    engine_cryo: { name: "Cryo Engine", cost: 55, mass: 4, thrust: 42, eff: 1.25, iw: 123, ih: 260, body: 0.81, note: "Most efficient, a bit weaker." },
    r_tank_s: { name: "Short Tank", cost: 10, mass: 6, fuel: 5, iw: 187, ih: 320, body: 1, note: "Light, less fuel." },
    r_tank_l: { name: "Long Tank", cost: 22, mass: 11, fuel: 10, iw: 97, ih: 320, body: 1, note: "Twice the fuel, twice the weight." },
    r_booster: { name: "Slim Boosters", cost: 20, mass: 6, thrust: 24, fuel: 5, iw: 64, ih: 320, body: 1, w: 34, note: "A pair. Extra push at liftoff." },
    r_booster_fat: { name: "Heavy Boosters", cost: 34, mass: 10, thrust: 36, fuel: 8, iw: 162, ih: 320, body: 1, w: 50, note: "A pair. Lots of push, lots of weight." },
    r_interstage: { name: "Interstage", cost: 5, mass: 1, iw: 157, ih: 297, body: 0.85, w: 56, note: "Joins the two stages." },
    r_upper: { name: "Upper Stage", cost: 25, mass: 5, fuel: 4, eff: 1.0, iw: 89, ih: 320, body: 1, note: "Pushes the capsule into space." },
    transfer_stage: { name: "Transfer Stage", cost: 42, mass: 6, fuel: 5, eff: 1.25, iw: 62, ih: 260, body: 0.79, w: 50, note: "Better engine for far trips." },
    r_capsule: { name: "Crew Capsule", cost: 30, mass: 4, iw: 256, ih: 291, body: 0.8, note: "Four seats." },
    r_decoupler: { name: "Decoupler", cost: 8, mass: 1, iw: 320, ih: 199, body: 0.85, note: "Drops the empty tank early: +0.3 Δv." },
    r_tower: { name: "Escape Tower", cost: 12, mass: 1, iw: 179, ih: 320, body: 0.6, w: 44, note: "If the mission fails, half the rocket's cost comes back." },
    r_fairing: { name: "Nose Fairing", cost: 10, mass: 1, iw: 259, ih: 320, body: 1, w: 40, note: "Less air drag on the way up: +0.2 Δv." },
    r_leg: { name: "Landing Legs", cost: 18, mass: 2, iw: 145, ih: 308, body: 0.68, w: 40, note: "The booster lands back home: 30% of the rocket's cost refunded after a quest." },
    r_tank_m: { name: "Medium Tank", cost: 16, mass: 8.5, fuel: 7.5, iw: 165, ih: 302, body: 1, note: "The middle ground." },
    r_nuclear: { name: "Nuclear Engine", cost: 95, mass: 6, thrust: 40, eff: 1.6, iw: 307, ih: 320, body: 0.62, note: "Huge efficiency, huge price." },
    r_solar: { name: "Solar Panels", cost: 15, mass: 1, iw: 182, ih: 308, body: 1, w: 40, note: "Recharge suits on the surface: 25% less oxygen used." },
    r_fin: { name: "Fins", cost: 6, mass: 1, iw: 247, ih: 320, body: 0.83, w: 50, note: "Steadier climb: +10% liftoff thrust." },
  };
  // Encaixes possíveis do manual. Cada modelo de foguete usa alguns deles, com as peças que aceita.
  const SLOT_INFO = {
    engine: { title: "Engine", how: "Stand an engine on the launch pad." },
    tank: { title: "Core tank", how: "Stack a fuel tank on the engine." },
    tank2: { title: "Extra tank", how: "Stack a second tank for more fuel, or skip." },
    boost: { title: "Side boosters", how: "Clip a pair of boosters to the sides." },
    inter: { title: "Interstage", how: "Fit the ring on top of the core tank." },
    upper: { title: "Upper stage", how: "Seat the upper stage on top." },
    cap: { title: "Crew capsule", how: "Mount the capsule on the very top." },
    fins: { title: "Fins", how: "Add stabilizer fins at the base, or skip." },
    dec: { title: "Decoupler", how: "Add a decoupler between the stages, or skip." },
    top: { title: "Nose", how: "Top the capsule with an escape tower or a fairing, or skip." },
    power: { title: "Solar panels", how: "Mount solar panels on the upper stage, or skip." },
    legs: { title: "Landing legs", how: "Add landing legs so the first stage can come back, or skip." },
  };
  const slot = (id, opts, optional = false) => ({ id, opts, optional, ...SLOT_INFO[id], how: optional && id === "boost" ? "Clip a pair of boosters to the sides, or skip." : SLOT_INFO[id].how });
  const MODELS = {
    hopper: {
      name: "Lunar Hopper", desc: "Few steps, small and cheap. Made for the Moon.",
      slots: [slot("engine", ["r_engine", "engine_cryo"]), slot("tank", ["r_tank_s"]), slot("upper", ["r_upper", "transfer_stage"]), slot("cap", ["r_capsule"]), slot("top", ["r_tower", "r_fairing"], true)],
      sample: { engine: "r_engine", tank: "r_tank_s", upper: "transfer_stage", cap: "r_capsule" },
    },
    explorer: {
      name: "Explorer", desc: "The all-rounder. Every part is your choice; reaches the Moon or Mars.",
      slots: [slot("engine", ["solid_motor", "r_engine", "engine_cryo", "r_nuclear"]), slot("tank", ["r_tank_s", "r_tank_m", "r_tank_l"]), slot("boost", ["r_booster", "r_booster_fat"], true),
        slot("dec", ["r_decoupler"], true), slot("inter", ["r_interstage"]), slot("upper", ["r_upper", "transfer_stage"]), slot("power", ["r_solar"], true), slot("cap", ["r_capsule"]),
        slot("top", ["r_tower", "r_fairing"], true), slot("fins", ["r_fin"], true), slot("legs", ["r_leg"], true)],
      sample: { engine: "r_engine", tank: "r_tank_s", boost: "none", inter: "r_interstage", upper: "transfer_stage", cap: "r_capsule", fins: "none" },
    },
    heavy: {
      name: "Mars Heavy", desc: "Big tanks and mandatory boosters. Expensive, but Mars is easy.",
      slots: [slot("engine", ["r_engine", "engine_cryo", "r_nuclear"]), slot("tank", ["r_tank_l"]), slot("tank2", ["r_tank_s", "r_tank_m", "r_tank_l"], true), slot("boost", ["r_booster", "r_booster_fat"]),
        slot("dec", ["r_decoupler"], true), slot("inter", ["r_interstage"]), slot("upper", ["transfer_stage", "r_upper"]), slot("power", ["r_solar"], true), slot("cap", ["r_capsule"]),
        slot("top", ["r_tower", "r_fairing"], true), slot("fins", ["r_fin"], true), slot("legs", ["r_leg"], true)],
      sample: { engine: "r_engine", tank: "r_tank_l", tank2: "none", boost: "r_booster", inter: "r_interstage", upper: "transfer_stage", cap: "r_capsule", fins: "none" },
    },
  };
  let SLOTS = MODELS.explorer.slots;
  const DECOYS = {};
  const TRAY = ["r_tank_l", "solid_motor", "r_capsule", "r_booster", "r_fairing", "engine_cryo", "r_interstage", "transfer_stage", "r_tank_s", "r_fin", "r_engine", "r_decoupler", "r_upper", "r_booster_fat", "r_tower", "r_leg", "r_tank_m", "r_nuclear", "r_solar"];
  const MIN_TWR = 1.2;
  const START_MONEY = 160;
  const GRANT_FLOOR = 125; // a agência garante dinheiro para o foguete mais barato que chega à Lua

  const QUESTS = {
    moon: [
      { id: "m1", name: "Rock Collector", diff: "Easy", cls: "d-easy", type: "samples", need: 8, o2: 1.0, reward: 70, desc: "Pick up 8 rock samples on the surface." },
      { id: "m2", name: "Glass Hunter", diff: "Medium", cls: "d-medium", type: "mine", need: 5, o2: 1.3, reward: 100, desc: "Dig out 5 blocks of cyan impact glass. It hides 8 m or more underground." },
      { id: "m3", name: "Deep Core", diff: "Hard", cls: "d-hard", type: "depth", need: 45, o2: 1.6, reward: 140, desc: "Reach 45 m below the landing site, then climb back to the lander." },
    ],
    mars: [
      { id: "r1", name: "Ice Prospector", diff: "Easy", cls: "d-easy", type: "samples", need: 10, o2: 1.0, reward: 110, desc: "Pick up 10 ice samples on the surface." },
      { id: "r2", name: "Water Mine", diff: "Medium", cls: "d-medium", type: "mine", need: 12, o2: 1.3, reward: 150, desc: "Mine 12 blocks of buried water ice, 4 m down or deeper." },
      { id: "r3", name: "Long Trek", diff: "Hard", cls: "d-hard", type: "distance", need: 200, o2: 1.6, reward: 200, desc: "Walk 200 m from the lander, past the mesas, and come back." },
    ],
  };
  const NEED_DV = { moon: 3.4, mars: 4.2 };
  const allQuests = () => [...QUESTS.moon, ...QUESTS.mars];
  const questById = (id) => allQuests().find((q) => q.id === id);
  // modo criativo: dinheiro infinito (guardado como um número enorme, mostrado como ∞)
  const CREATIVE_MONEY = 1e12;
  const money = (m) => (m >= CREATIVE_MONEY / 2 ? "∞" : `$${Math.round(m)}M`);

  const FACTS = [
    "A day on Venus is longer than a year on Venus.",
    "Sunlight at Jupiter is about 25 times weaker than at Earth.",
    "A radio signal takes 4 to 24 minutes to travel between Earth and Mars.",
    "A geostationary satellite sits about 36,000 km above the equator.",
    "A sun-synchronous satellite passes overhead at the same local time every day.",
  ];

  // ---------------- estado + save ----------------

  const KEY = "hello-world-save-v2";
  const emptyBuild = () => Object.fromEntries(SLOTS.map((s) => [s.id, null]));
  function setModel(m) { state.model = m; SLOTS = MODELS[m].slots; }
  const state = {
    money: START_MONEY, build: emptyBuild(), lastBuild: null, team: [], flight: null,
    done: {}, stars: true, started: false, dest: "moon", quest: "m1", model: null, creative: false,
  };
  let focusCrew = "blue";
  let evaCrew = "";

  function save() {
    if (state.creative) state.money = CREATIVE_MONEY;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sem armazenamento */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d) return;
      if (Number.isFinite(d.money)) state.money = d.money;
      if (MODELS[d.model]) setModel(d.model);
      state.build = emptyBuild();
      if (d.build) for (const s of SLOTS) { const v = d.build[s.id]; if (v === "none" || s.opts.includes(v)) state.build[s.id] = v; }
      if (d.lastBuild) state.lastBuild = d.lastBuild;
      if (Array.isArray(d.team)) state.team = d.team.filter((id) => CREW.some((c) => c.id === id)).slice(0, TEAM_MAX);
      if (d.flight && Number.isFinite(d.flight.dv)) state.flight = d.flight;
      if (d.done && typeof d.done === "object") state.done = d.done;
      state.stars = d.stars !== false;
      state.started = !!d.started;
      state.creative = !!d.creative;
      state.coop = !!d.coop;
      state.musicOff = !!d.musicOff;
      if (state.creative) state.money = CREATIVE_MONEY;
      if (d.dest === "moon" || d.dest === "mars") state.dest = d.dest;
      if (questById(d.quest)) state.quest = d.quest;
    } catch { /* ignora */ }
  }

  // ---------------- palco: escala e estrelas ----------------

  let scale = 1;
  function fit() {
    scale = Math.min(window.innerWidth / 1376, window.innerHeight / 768);
    stage.style.transform = `scale(${scale})`;
    window.HelloMoon?.refresh();
  }
  window.addEventListener("resize", fit);
  fit();

  const cv = $("#stars");
  const cx = cv.getContext("2d");
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const STARS = Array.from({ length: 150 }, () => ({
    x: Math.floor(rnd() * 344), y: Math.floor(rnd() * 192), big: rnd() < 0.07,
    c: ["#ffffff", "#9fd8ff", "#ffd28a", "#6f86c8"][Math.floor(rnd() * 4)], ph: rnd() * 6.28, sp: 0.5 + rnd() * 1.5,
  }));
  function drawStars(t) {
    // o céu agora é a imagem de fundo; aqui só piscam algumas estrelas por cima
    cx.clearRect(0, 0, 344, 192);
    for (const s of STARS.slice(0, 60)) {
      cx.globalAlpha = state.stars ? 0.55 + 0.45 * Math.sin(t * s.sp + s.ph) : 0.9;
      cx.fillStyle = s.c;
      cx.fillRect(s.x, s.y, 1, 1);
      if (s.big) { cx.fillRect(s.x - 1, s.y, 3, 1); cx.fillRect(s.x, s.y - 1, 1, 3); }
    }
    cx.globalAlpha = 1;
  }
  let lastStar = 0;
  function loop(ms) {
    if (ms - lastStar > 120 && (state.stars || !lastStar)) { drawStars(ms / 1000); lastStar = ms; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------------- navegação ----------------

  let screen = "menu";
  let loadTimer = 0;

  function go(name) {
    clearInterval(loadTimer);
    closeModal();
    if ((screen === "moon" || screen === "ship") && name !== screen) window.HelloMoon.stop();
    if (screen === "launch") { launchTimers.forEach(clearTimeout); stopAscent(); }
    screen = name;
    stage.dataset.screen = name;
    try { syncMusic(); } catch { /* música ainda não carregada */ }
    if (name === "menu") $("#btn-continue").disabled = !state.started;
    if (name === "loading") startLoading();
    if (name === "team") renderTeam();
    if (name === "build" && !state.model) return go("rockets");
    if (name === "build") { state.started = true; save(); renderBuild(); }
    if (name === "rockets") renderRockets();
    if (name === "failed") renderFailed();
    if (name === "launch") startLaunch();
    if (name === "map") renderMap();
    if (name === "eva") renderEva();
    if (name === "moon") startMoon();
    if (name === "ship") startShipSpace();
    // na exploração nada fica em foco: o Espaço do pulo "apertaria" o botão
    const first = name === "moon" || name === "ship" ? null : $(`#s-${name} [aria-checked="true"], #s-${name} .btn:not(:disabled)`);
    if (first) first.focus({ preventScroll: true });
  }

  function startLoading() {
    $("#fact-text").textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
    const fill = $("#loadfill");
    let p = 0;
    fill.style.width = "0";
    loadTimer = setInterval(() => {
      p += 1;
      // a barra anda em blocos, como na sua tela
      fill.style.width = `${Math.min(27, p) * 26}px`;
      if (p >= 29) { clearInterval(loadTimer); go("rockets"); }
    }, 90);
  }

  // ---------------- equipe ----------------

  const crew = (id) => CREW.find((c) => c.id === id);
  const headHtml = (id) => `<div class="head"><img src="assets/astro_${id}.png" alt=""></div>`;

  function renderTeam() {
    $("#slots").innerHTML = Array.from({ length: TEAM_MAX }, (_, i) => {
      const c = crew(state.team[i]);
      return c ? `<div class="slot full">${headHtml(c.id)}<span>${c.role}</span></div>` : `<div class="slot"><span>Empty slot</span></div>`;
    }).join("");
    $("#lineup").innerHTML = CREW.map((c) => `
      <button class="crew" role="option" aria-selected="${c.id === focusCrew}" data-crew="${c.id}" aria-label="${c.role}"
        style="--c1:${c.colors[0]};--c2:${c.colors[1]};--c3:${c.colors[2]}">
        ${state.team.includes(c.id) ? `<span class="tag">In team</span>` : ""}
        <img src="assets/astro_${c.id}.png" alt=""><span class="ped"></span>
      </button>`).join("");
    const c = crew(focusCrew);
    $("#crew-info").innerHTML = crewInfo(c);
    const inTeam = state.team.includes(focusCrew);
    const tg = $("#team-toggle");
    tg.textContent = inTeam ? "Remove" : "Add";
    tg.classList.toggle("warn", inTeam);
    tg.disabled = !inTeam && state.team.length >= TEAM_MAX;
    const st = rocketStats(state.build);
    $("#team-confirm").disabled = state.team.length === 0 || st.cost > state.money;
    $("#team-cost").textContent = `Launch cost ${money(st.cost)} · Budget ${money(state.money)}`;
  }

  function crewInfo(c) {
    return `${headHtml(c.id)}<div>
      <h3>${c.role}</h3><p>${c.perkText}</p>
      ${STAT_NAMES.map((n, i) => `<div class="stat"><span>${n}</span><span class="pips">${Array.from({ length: 7 }, (_, k) => `<i class="${k < c.stats[i] ? "on" : ""}"></i>`).join("")}</span></div>`).join("")}
    </div>`;
  }

  function toggleCrew() {
    const i = state.team.indexOf(focusCrew);
    if (i >= 0) state.team.splice(i, 1);
    else if (state.team.length < TEAM_MAX) state.team.push(focusCrew);
    save();
    renderTeam();
    $(`.crew[data-crew="${focusCrew}"]`)?.focus({ preventScroll: true });
  }

  // ---------------- montagem: manual estilo LEGO, com escolha de peças ----------------

  const bay = $("#bay");
  const stepIndex = () => { const i = SLOTS.findIndex((s) => !state.build[s.id]); return i < 0 ? SLOTS.length : i; };
  const done = () => stepIndex() >= SLOTS.length;
  const slotOf = (k) => SLOTS.find((s) => s.opts.includes(k));
  let msgTimer = 0;
  let pickHint = ""; // peça sob o cursor no manual: o contorno mostra o formato dela

  // custo, empuxo/peso (TWR) e Δv do foguete (mesma conta do balanceamento)
  function rocketStats(b) {
    const p = (k) => (k && k !== "none" ? PARTS[k] : null);
    const parts = SLOTS.map((s) => p(b[s.id])).filter(Boolean);
    const cost = parts.reduce((t, x) => t + x.cost, 0);
    const mass = parts.reduce((t, x) => t + x.mass, 0);
    const e = p(b.engine), t = p(b.tank), t2 = p(b.tank2), bo = p(b.boost), u = p(b.upper), cap = p(b.cap);
    let twr = mass ? ((e ? e.thrust : 0) + (bo ? bo.thrust : 0)) / (mass * 1.6) : 0;
    if (p(b.fins)) twr *= 1.1;
    const fuel1 = (t ? t.fuel : 0) + (t2 ? t2.fuel : 0) + (bo ? bo.fuel : 0);
    const dv1 = e && fuel1 && mass > fuel1 ? 2.6 * e.eff * Math.log(mass / (mass - fuel1)) : 0;
    const m2 = (u ? u.mass : 0) + (cap ? cap.mass : 0);
    const dv2 = u && cap ? 3.2 * u.eff * Math.log(m2 / (m2 - u.fuel)) : 0;
    const extra = (p(b.dec) && dv1 ? 0.3 : 0) + (p(b.top) && b.top === "r_fairing" ? 0.2 : 0);
    return { cost, mass, twr, dv: dv1 + dv2 + extra, tower: b.top === "r_tower", legs: !!p(b.legs), solar: !!p(b.power) };
  }

  // posições das peças: empilha o núcleo e prende boosters e aletas dos lados.
  // Coordenadas da bancada (596 x 592); se ficar alto demais, encolhe tudo.
  function layout(b) {
    const W = 60, CX = 298, PAD = 570;
    const out = [];
    const dims = (k, w) => { const P = PARTS[k]; w = w || W / P.body; return { w, h: (w * P.ih) / P.iw }; };
    let y = PAD;
    for (const sid of ["engine", "tank", "tank2", "dec", "inter", "upper", "cap", "top"]) {
      const k = b[sid];
      if (k === "none" || (k === undefined && sid !== "engine")) continue;
      if (!k) break;
      const { w, h } = dims(k, PARTS[k].w);
      out.push({ k, slot: sid, cx: CX, top: y - h, h, w, z: 3 + out.length });
      y = y - h + 3;
    }
    if (b.power && b.power !== "none") {
      const up = out.find((r) => r.slot === "upper");
      if (up) {
        const { w, h } = dims("r_solar", 40);
        for (const dir of [-1, 1]) out.push({ k: "r_solar", slot: "power", cx: CX + dir * (up.w / 2 + w / 2 + 2), top: up.top + up.h / 2 - h / 2, h, w, z: 2, flip: dir < 0 });
      }
    }
    let side = W / 2;
    if (b.boost && b.boost !== "none") {
      const { w, h } = dims(b.boost, PARTS[b.boost].w);
      for (const dir of [-1, 1]) out.push({ k: b.boost, slot: "boost", cx: CX + dir * (W / 2 + w / 2 + 1), top: PAD - h, h, w, z: 1, flip: dir > 0 });
      side += w + 2;
    }
    if (b.fins && b.fins !== "none") {
      const { w, h } = dims("r_fin", 40);
      for (const dir of [-1, 1]) out.push({ k: "r_fin", slot: "fins", cx: CX + dir * (side + w / 2 - 6), top: PAD - h - 4, h, w, z: 2, flip: dir < 0 });
      side += 26;
    }
    if (b.legs && b.legs !== "none") {
      const { w, h } = dims("r_leg", 34);
      for (const dir of [-1, 1]) out.push({ k: "r_leg", slot: "legs", cx: CX + dir * (side + w / 2 - 4), top: PAD - h + 2, h, w, z: 2, flip: dir < 0 });
    }
    const topY = Math.min(...out.map((r) => r.top), PAD);
    const s = topY < 14 ? (PAD - 14) / (PAD - topY) : 1;
    if (s < 1) for (const r of out) { r.cx = CX + (r.cx - CX) * s; r.top = PAD - (PAD - r.top) * s; r.h *= s; r.w *= s; }
    return { parts: out, s };
  }

  function partsHtml(list, cls = () => "") {
    return list.map((r) => `<div class="rp ${cls(r)}${r.flip ? " flip" : ""}" style="left:${r.cx}px;top:${r.top}px;height:${r.h}px;z-index:${r.z}"><img src="assets/${r.k}.png" alt=""></div>`).join("");
  }

  function flamesHtml(b) {
    const L = layout(b).parts;
    return L.filter((r) => r.slot === "engine" || (r.slot === "boost")).map((r) => {
      const w = r.slot === "engine" ? r.w : r.w * 0.85;
      return `<span class="flame" style="left:${r.cx}px;top:${r.top + r.h - 14}px;width:${w}px"><img src="assets/flame_y1.png" alt=""><img src="assets/flame_y2.png" alt=""></span>`;
    }).join("");
  }

  // onde a peça k do encaixe atual ficaria (para o contorno e para conferir o "soltar")
  function targetRects(k) {
    const slot = SLOTS[stepIndex()];
    const b = { ...state.build, [slot.id]: k };
    return layout(b).parts.filter((r) => r.slot === slot.id);
  }

  function say(text) {
    const el = $("#bay-msg");
    el.textContent = text;
    clearTimeout(msgTimer);
    if (text) msgTimer = setTimeout(() => { el.textContent = ""; }, 3200);
  }

  function statsHtml(st) {
    const reach = st.dv >= NEED_DV.mars ? "Moon and Mars" : st.dv >= NEED_DV.moon ? "Moon" : "nowhere yet";
    const lowTwr = st.twr < MIN_TWR;
    return `<div class="rstats">
      <div><span>Cost</span><b class="${st.cost > state.money ? "bad" : ""}">${money(st.cost)} / ${money(state.money)}</b></div>
      <div><span>Liftoff thrust</span><b class="${lowTwr ? "bad" : "ok"}">${st.twr.toFixed(2)}×</b></div>
      <div><span>Δv</span><b>${st.dv.toFixed(2)}</b></div>
      <div><span>Reaches</span><b class="${st.dv >= NEED_DV.moon ? "ok" : "bad"}">${reach}</b></div>
    </div>`;
  }

  function renderBuild(snapSlot = "") {
    const n = stepIndex();
    const slot = SLOTS[n];
    const L = layout(state.build);
    let html = partsHtml(L.parts, (r) => (r.slot === snapSlot ? "snap" : ""));
    if (slot) html += partsHtml(targetRects(pickHint && slot.opts.includes(pickHint) ? pickHint : slot.opts[0]), () => "target");
    $("#rocket").innerHTML = html;

    $("#tray").innerHTML = TRAY.map((k) => {
      const P = PARTS[k];
      const name = P ? P.name : DECOYS[k];
      const afford = !P || P.cost <= state.money;
      return `<button class="bin${afford ? "" : " pricey"}" data-bin="${k}" aria-label="${name}${P ? `, ${money(P.cost)}` : ""}">
        <img src="assets/${k}.png" alt=""><span>${name}</span>${P ? `<em>${money(P.cost)}</em>` : ""}</button>`;
    }).join("");

    const st = rocketStats(state.build);
    const man = $("#manual");
    const dots = `<div class="dots">${SLOTS.map((_, i) => `<i class="${i < n ? "done" : i === n ? "now" : ""}"></i>`).join("")}</div>`;
    if (!slot) {
      man.className = "manual done";
      const problems = [];
      if (state.creative) {} else {
      if (st.twr < MIN_TWR) problems.push(`Too heavy to lift off: thrust must be at least ${MIN_TWR}×. Use a stronger engine, boosters or fins, or a lighter tank.`);
      if (st.cost > state.money) problems.push(`Not enough money: costs ${money(st.cost)}, you have ${money(state.money)}.`);
      if (st.dv < NEED_DV.moon) problems.push(`Δv ${st.dv.toFixed(2)} can't reach the Moon (needs ${NEED_DV.moon}).`);
      }
      man.innerHTML = `<h3>${problems.length ? "Check the design" : "Rocket<br>complete!"}</h3>
        ${statsHtml(st)}
        ${state.creative ? `<p class="ok">Creative mode: any rocket flies, to the Moon and Mars.</p>` : problems.length ? `<ul class="problems">${problems.map((p) => `<li>${p}</li>`).join("")}</ul>` : `<p>Needs Δv ${NEED_DV.moon} for the Moon, ${NEED_DV.mars} for Mars. You pay when the rocket launches.</p>`}
        ${dots}`;
      $("#btn-team").disabled = !state.creative && (st.twr < MIN_TWR || st.cost > state.money || st.dv < NEED_DV.moon);
    } else {
      man.className = "manual";
      man.innerHTML = `<div class="step"><b>${n + 1}</b><span>${slot.title}${slot.optional ? " · optional" : ""}</span></div>
        <p>${slot.how}</p>
        <div class="opts">${slot.opts.map((k) => {
          const P = PARTS[k];
          const bits = [P.thrust ? `thrust ${P.thrust}` : "", P.fuel ? `fuel ${P.fuel}` : "", P.eff ? `eff ${P.eff}` : "", `${P.mass} t`].filter(Boolean).join(" · ");
          return `<button class="opt" data-bin="${k}" data-hint="${k}"><img src="assets/${k}.png" alt=""><span><b>${P.name}</b><i>${money(P.cost)}</i><small>${bits}</small><small>${P.note}</small></span></button>`;
        }).join("")}</div>
        ${slot.optional ? `<button class="btn small skip" data-act="skip">Skip</button>` : ""}
        ${statsHtml(st)}
        ${dots}`;
      // no criativo dá para decolar mesmo com o foguete pela metade
      $("#btn-team").disabled = !state.creative || n === 0;
    }
    $("#btn-undo").disabled = n === 0;
    $("#btn-reuse").hidden = !state.lastBuild || state.lastBuild.model !== state.model || n > 0;
    $("#build-model").textContent = MODELS[state.model].name;
  }

  function place(slotId, k) {
    state.build[slotId] = k;
    pickHint = "";
    save();
    renderBuild(slotId);
    if (done()) { say("All slots filled. Check the numbers and pick the crew."); $("#btn-team").focus({ preventScroll: true }); }
  }

  function wrong(k, why) {
    const el = $(`.bin[data-bin="${k}"]`);
    if (el) { el.classList.remove("wrong"); void el.offsetWidth; el.classList.add("wrong"); }
    say(why);
  }

  // Usar uma peça: clique encaixa direto; arrastando, precisa soltar no contorno
  function tryPart(k, dropX, dropY) {
    if (done()) return say("The rocket is complete. Use Undo to change a part.");
    const slot = SLOTS[stepIndex()];
    const P = PARTS[k];
    if (!P) return wrong(k, "That part isn't used on this rocket.");
    if (!slot.opts.includes(k)) {
      const s = slotOf(k);
      if (!s) return wrong(k, `The ${MODELS[state.model].name} doesn't use that part.`);
      return wrong(k, `That goes in "${s.title}". The manual is on "${slot.title}" now.`);
    }
    if (dropX !== undefined) {
      const hit = targetRects(k).some((r) => Math.abs(dropX - r.cx) < r.w / 2 + 40 && dropY > r.top - 40 && dropY < r.top + r.h + 40);
      if (!hit) return wrong(k, "Right part! Drop it on the glowing outline.");
    }
    place(slot.id, k);
  }

  // arrastar da caixa até a bancada (coordenadas do palco = tela / escala)
  let carry = null;
  $("#tray").addEventListener("pointerdown", (e) => {
    const bin = e.target.closest(".bin");
    if (!bin || done()) return;
    carry = { k: bin.dataset.bin, sx: e.clientX, sy: e.clientY, el: null, id: e.pointerId };
    bin.setPointerCapture(e.pointerId);
  });
  $("#tray").addEventListener("pointermove", (e) => {
    if (!carry) return;
    if (!carry.el && Math.hypot(e.clientX - carry.sx, e.clientY - carry.sy) > 8) {
      const slot = SLOTS[stepIndex()];
      const r = slot && slot.opts.includes(carry.k) ? targetRects(carry.k)[0] : null;
      carry.el = document.createElement("img");
      carry.el.className = "carry";
      carry.el.src = `assets/${carry.k}.png`;
      carry.h = r ? r.h * layoutScale() : 110;
      carry.el.style.height = carry.h + "px";
      stage.appendChild(carry.el);
      if (r) { pickHint = carry.k; renderBuild(); }
    }
    if (carry.el) {
      const sr = stage.getBoundingClientRect();
      carry.x = (e.clientX - sr.left) / scale;
      carry.y = (e.clientY - sr.top) / scale;
      carry.el.style.left = carry.x - carry.el.offsetWidth / 2 + "px";
      carry.el.style.top = carry.y - carry.h / 2 + "px";
    }
  });
  const layoutScale = () => 1;
  const endCarry = (e) => {
    if (!carry) return;
    const c = carry;
    carry = null;
    if (!c.el) return; // foi só um clique: o evento "click" cuida
    c.el.remove();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (e.type === "pointercancel") return;
    tryPart(c.k, c.x - bay.offsetLeft, c.y - bay.offsetTop);
  };
  let suppressClick = false;
  $("#tray").addEventListener("pointerup", endCarry);
  $("#tray").addEventListener("pointercancel", endCarry);
  // passar o mouse numa opção do manual mostra o formato dela no contorno
  $("#manual").addEventListener("pointerover", (e) => {
    const o = e.target.closest("[data-hint]");
    const k = o ? o.dataset.hint : "";
    if (k !== pickHint && !done()) { pickHint = k; const keep = document.activeElement?.dataset?.hint; renderBuild(); if (keep) $(`[data-hint="${keep}"]`)?.focus({ preventScroll: true }); }
  });

  // ---------------- escolha do foguete ----------------

  function renderRockets() {
    $("#rocket-cards").innerHTML = Object.entries(MODELS).map(([id, m]) => {
      const keep = SLOTS;
      SLOTS = m.slots;
      const st = rocketStats(m.sample);
      const L = layout(m.sample);
      SLOTS = keep;
      const reach = st.dv >= NEED_DV.mars ? "Moon and Mars" : "Moon";
      return `<button class="rcard${state.model === id ? " sel" : ""}" data-model="${id}">
        <div class="rprev"><div class="rocket">${partsHtml(L.parts)}</div></div>
        <b>${m.name}</b><span>${m.desc}</span>
        <small>${m.slots.length} steps · from ${money(st.cost)} · reaches ${reach}</small></button>`;
    }).join("");
    $("#rockets-budget").textContent = `Budget ${money(state.money)}`;
  }

  // ---------------- lançamento ----------------

  let launchTimers = [];
  // antes da contagem: o jogador escolhe pilotar ou deixar no piloto automático
  function startLaunch() {
    launchTimers.forEach(clearTimeout);
    stopAscent();
    $("#liftoff").classList.remove("go");
    $("#liftoff").hidden = false;
    $("#rocket-launch").innerHTML = partsHtml(layout(state.build).parts) + flamesHtml(state.build);
    $("#launch-crew").innerHTML = state.team.map(headHtml).join("");
    $("#enroute").hidden = true;
    $("#ascent-fail").hidden = true;
    $("#count").textContent = "";
    $("#orbit-banner").hidden = true;
    // vai direto para a plataforma: a contagem roda já na cena da subida
    startAscent();
    asc.locked = true;
    countdown(() => { if (asc) asc.locked = false; launchTimers.push(setTimeout(() => { $("#count").textContent = ""; }, 700)); });
  }

  function countdown(then) {
    const count = $("#count");
    const seq = ["3", "2", "1", "Liftoff!"];
    launchTimers = seq.map((t, i) => setTimeout(() => { count.textContent = t; if (i === 3) then(); }, i * 800));
  }

  // piloto automático: mesma cena, mas o computador segura o motor e inclina sozinho
  function autoLaunch() {
    $("#ascent-fail").hidden = true;
    startLaunch();
    asc.auto = true;
  }

  // chegou à órbita: arte de comemoração e segue sozinho para a cabine
  function orbitReached() {
    $("#count").textContent = "";
    $("#ascent-fail").hidden = true;
    $("#orbit-banner").hidden = false;
    launchTimers.push(setTimeout(() => { stopAscent(); go("ship"); }, 2800));
  }

  // ---------------- subida pilotada ----------------
  // Modelo simples de subida: segure W para acelerar, A/D inclinam o foguete.
  // Órbita = passar de 80 km de altura com 7,8 km/s de velocidade na horizontal.
  const ORBIT_H = 80, ORBIT_V = 7.8;
  // artes da subida
  const ascImg = (n) => Object.assign(new Image(), { src: `assets/${n}` });
  const ASC_ART = {
    pad: ascImg("asc_pad.jpg"), earth: ascImg("asc_earth.jpg"),
    clouds: Array.from({ length: 9 }, (_, i) => ascImg(`cloud_${i}.png`)),
    boom: Array.from({ length: 7 }, (_, i) => ascImg(`expl_${i}.png`)),
  };
  let asc = null;
  function stopAscent() {
    if (!asc) return;
    cancelAnimationFrame(asc.raf);
    window.removeEventListener("keydown", asc.kd, true);
    window.removeEventListener("keyup", asc.ku, true);
    asc.el.remove();
    asc = null;
  }

  // teclas lidas desde a contagem: dá para já estar segurando W no "Liftoff!"
  const ascKeys = {};
  const ASC_K = { w: "up", arrowup: "up", " ": "up", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
  window.addEventListener("keydown", (e) => { const k = ASC_K[e.key.toLowerCase()]; if (k) ascKeys[k] = true; }, true);
  window.addEventListener("keyup", (e) => { const k = ASC_K[e.key.toLowerCase()]; if (k) ascKeys[k] = false; }, true);
  function manualLaunch() { startLaunch(); }

  function startAscent() {
    $("#liftoff").hidden = true;
    const st = rocketStats(state.build);
    const el = document.createElement("div");
    el.className = "ascent";
    el.innerHTML = `<canvas width="1376" height="768"></canvas>
      <div class="ascent-rocket"><div class="rocket">${$("#rocket-launch").innerHTML}</div></div>
      <div class="ascent-hud panel">
        <div><span>Altitude</span><b id="a-h">0 km</b><i><u id="a-hb"></u></i></div>
        <div><span>Orbital speed</span><b id="a-v">0.0 / ${ORBIT_V} km/s</b><i><u id="a-vb"></u></i></div>
        <div><span>Fuel</span><b id="a-f">100%</b><i><u id="a-fb"></u></i></div>
        <div><span>Pitch</span><b id="a-p">0°</b></div>
      </div>
      <p class="ascent-tip" id="a-tip"></p>
      <p class="ascent-keys">Hold W / ↑ / Space: engine · A D / ← →: tilt · Reach ${ORBIT_H} km at ${ORBIT_V} km/s</p>`;
    $("#s-launch").appendChild(el);
    // centraliza o foguete no ponto de giro (o meio da pilha de peças)
    const L = layout(state.build).parts;
    const top = Math.min(...L.map((r) => r.top)), bot = Math.max(...L.map((r) => r.top + r.h));
    const cx = L.find((r) => r.slot === "engine")?.cx ?? 298;
    const sc = Math.min(0.6, 300 / Math.max(1, bot - top));
    el.querySelector(".ascent-rocket .rocket").style.transform = `translate(${-cx * sc}px, ${-((top + bot) / 2) * sc}px) scale(${sc})`;
    // combustível em segundos de motor: foguete melhor queima por mais tempo; criativo sobra
    const burn = state.creative ? 60 : Math.max(20, 12 + st.dv * 3.6);
    const acc = Math.max(0.022, Math.min(0.045, 0.02 + (st.twr || 1.2) * 0.008)); // km/s² no tempo de jogo
    asc = { el, cv: el.querySelector("canvas"), rk: el.querySelector(".ascent-rocket"),
      h: 0, x: 0, vx: 0, vy: 0, pitch: 0, fuel: burn, fuel0: burn, acc, keys: ascKeys, maxH: 0, last: performance.now(), t: 0, done: false,
      clouds: Array.from({ length: 14 }, (_, i) => ({ x: Math.random() * 1376, h: 3 + Math.random() * 10, img: i % 9, s: 0.45 + Math.random() * 0.4 })),
      stars: Array.from({ length: 160 }, () => ({ x: Math.random() * 1376, y: Math.random() * 768, r: Math.random() < 0.15 ? 2 : 1 })) };
    const K = { w: "up", arrowup: "up", " ": "up", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
    asc.kd = (e) => { const k = K[e.key.toLowerCase()]; if (k && asc) { e.preventDefault(); e.stopPropagation(); } };
    asc.ku = (e) => { const k = K[e.key.toLowerCase()]; if (k && asc) e.preventDefault(); };
    window.addEventListener("keydown", asc.kd, true);
    window.addEventListener("keyup", asc.ku, true);
    document.activeElement?.blur();
    asc.raf = requestAnimationFrame(tickAscent);
  }

  function tickAscent(now) {
    const a = asc;
    if (!a) return;
    const real = Math.min(0.05, (now - a.last) / 1000);
    a.last = now; a.t += real;
    const dt = real * 17; // o tempo da subida passa 17× mais rápido
    const k = a.auto ? { up: true, left: false, right: false } : a.keys;
    if (a.auto && !a.locked) { const want = a.h < 5 ? 0 : Math.min(88, 10 + (a.h - 5) * 1.6); a.pitch += Math.sign(want - a.pitch) * Math.min(Math.abs(want - a.pitch), 60 * real); }
    if (k.left) a.pitch -= 60 * real;
    if (k.right) a.pitch += 60 * real;
    a.pitch = Math.max(-20, Math.min(110, a.pitch));
    if (a.locked) { k.left = k.right = false; }
    const burning = k.up && a.fuel > 0 && !a.done && !a.locked;
    if (burning) a.fuel -= real;
    const rad = (a.pitch * Math.PI) / 180;
    // gravidade diminui quanto mais rápido se anda de lado (é isso que é estar em órbita)
    const g = 0.0098 * (1 - (a.vx * a.vx) / (ORBIT_V * ORBIT_V)); // rápido demais: sobe sozinho
    let ax = 0, ay = -g;
    if (burning) { ax += Math.sin(rad) * a.acc; ay += Math.cos(rad) * a.acc; }
    // ar grosso: freia e castiga quem deita o foguete cedo demais
    const air = Math.exp(-a.h / 8);
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > 0) { const d = 0.004 * air * sp * sp; ax -= (a.vx / sp) * d; ay -= (a.vy / sp) * d; }
    a.vx += ax * dt; a.vy += ay * dt;
    a.x += a.vx * dt; a.h = Math.max(0, a.h + a.vy * dt);
    a.maxH = Math.max(a.maxH, a.h);
    const stress = air * sp * Math.abs(Math.sin(rad - Math.atan2(a.vx, Math.max(0.001, a.vy))));
    if (!a.done) {
      if (a.h >= ORBIT_H && a.vx >= ORBIT_V) { a.done = true; $("#a-tip").textContent = ""; launchTimers.push(setTimeout(orbitReached, 900)); }
      else if (a.maxH > 0.5 && a.h <= 0) return ascentFail("The rocket fell back to the ground.");
      else if (stress > 1.3) return ascentFail("Turned too hard in thick air: the rocket broke apart. Tilt slowly below 30 km.");
      else if (a.fuel <= 0 && a.vy < -0.3 && a.vx < ORBIT_V) return ascentFail("Out of fuel before orbit. Tilt sooner to build sideways speed.");
      else if (a.h > ORBIT_H && a.vx >= ORBIT_V * 0.7) $("#a-tip").textContent = "Almost there! Push sideways (pitch near 90°).";
      else if (a.locked) $("#a-tip").textContent = "Get ready: hold W at liftoff!";
      else if (a.h < 8) $("#a-tip").textContent = a.t < 3 ? "Hold W to fire the engine. Go straight up first." : "Climb straight up through the thick air.";
      else if (a.h < 35) $("#a-tip").textContent = "Now tilt slowly to the right (D), about 45° by 30 km.";
      else $("#a-tip").textContent = "Lay it flatter (70° to 90°) and build sideways speed.";
    }
    drawAscent(a, burning, real);
    $("#a-h").textContent = `${a.h.toFixed(1)} km`;
    $("#a-hb").style.width = `${Math.min(100, (a.h / ORBIT_H) * 100)}%`;
    $("#a-v").textContent = `${Math.max(0, a.vx).toFixed(1)} / ${ORBIT_V} km/s`;
    $("#a-vb").style.width = `${Math.max(0, Math.min(100, (a.vx / ORBIT_V) * 100))}%`;
    $("#a-f").textContent = state.creative ? "∞" : `${Math.max(0, Math.round((a.fuel / a.fuel0) * 100))}%`;
    $("#a-fb").style.width = `${Math.max(0, (a.fuel / a.fuel0) * 100)}%`;
    $("#a-p").textContent = `${Math.round(a.pitch)}°`;
    if (state.creative) a.fuel = a.fuel0;
    a.raf = requestAnimationFrame(tickAscent);
  }

  function drawAscent(a, burning, real) {
    const c = a.cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    const W = 1376, H = 768;
    // céu: azul no chão, preto no espaço
    const t = Math.min(1, a.h / 60);
    const mix = (p, q) => Math.round(p + (q - p) * t);
    c.fillStyle = `rgb(${mix(92, 3)},${mix(164, 5)},${mix(222, 16)})`;
    c.fillRect(0, 0, W, H);
    if (a.h > 15) {
      c.globalAlpha = Math.min(1, (a.h - 15) / 30);
      c.fillStyle = "#fff";
      for (const s of a.stars) c.fillRect(((s.x - a.x * 4) % W + W) % W, s.y, s.r, s.r);
      c.globalAlpha = 1;
    }
    // nuvens passando
    for (const cl of a.clouds) {
      const y = H * 0.55 + (a.h - cl.h) * 70;
      if (y < -40 || y > H + 40) continue;
      const x = ((cl.x - a.x * 60) % (W + 200) + W + 200) % (W + 200) - 100;
      const im = ASC_ART.clouds[cl.img];
      if (im.complete && im.naturalWidth) c.drawImage(im, x, y, im.naturalWidth * cl.s, im.naturalHeight * cl.s);
    }
    // chão e plataforma, depois a curva da Terra lá de cima
    const gy = H * 0.75 + a.h * 90;
    const pad = ASC_ART.pad;
    if (gy < H + 400 && pad.complete && pad.naturalWidth) {
      // a arte é mais larga que a tela: o centro da plataforma fica embaixo do foguete
      const ph = 480 * 0.75, pw = 2224 * 0.75;
      const px = W / 2 - 1170 * 0.75 - a.x * 60;
      const py = gy - 330 * 0.75; // linha da laje da plataforma no chão do jogo
      c.drawImage(pad, px, py, pw, ph);
      c.fillStyle = "#4d9a3a"; c.fillRect(0, py + ph - 2, W, H);
    }
    const earth = ASC_ART.earth;
    if (a.h > 25 && earth.complete && earth.naturalWidth) {
      const eh = W * (560 / 1920);
      c.globalAlpha = Math.min(1, (a.h - 25) / 15);
      const ey = H - eh * Math.min(1, (a.h - 25) / 45);
      c.drawImage(earth, 0, ey, W, eh);
      // funde a borda de cima da foto com o céu
      const fade = c.createLinearGradient(0, ey, 0, ey + 140);
      fade.addColorStop(0, `rgb(${mix(92, 3)},${mix(164, 5)},${mix(222, 16)})`);
      fade.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = fade; c.fillRect(0, ey - 1, W, 141);
      c.globalAlpha = 1;
    }
    // foguete no meio da tela, inclinado e tremendo com o motor
    const shake = burning && a.h < 30 ? (Math.random() - 0.5) * 3 : 0;
    a.rk.style.transform = `translate(${shake}px, 0) rotate(${a.pitch}deg)`;
    a.rk.classList.toggle("burn", burning);
  }

  function ascentFail(why) {
    const a = asc;
    a.done = true;
    cancelAnimationFrame(a.raf);
    a.rk.classList.remove("burn");
    a.rk.classList.add("boom");
    const t0 = performance.now();
    const c = a.cv.getContext("2d");
    const step = (now) => {
      if (asc !== a) return;
      const f = Math.floor((now - t0) / 110);
      drawAscent(a, false, 0);
      const im = ASC_ART.boom[Math.min(6, f)];
      if (im.complete && im.naturalWidth) {
        const s = 0.9;
        c.globalAlpha = f > 6 ? Math.max(0, 1 - (f - 6) / 4) : 1;
        c.drawImage(im, 688 - (im.naturalWidth * s) / 2, 400 - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
        c.globalAlpha = 1;
      }
      if (f < 11) a.raf = requestAnimationFrame(step);
      else {
        $("#ascent-why").textContent = why;
        $("#ascent-fail").hidden = false;
        $("#ascent-fail .btn").focus({ preventScroll: true });
      }
    };
    a.raf = requestAnimationFrame(step);
  }

  // ---------------- mapa dos planetas ----------------

  // posições no fundo do mapa (o Sol fica na borda esquerda, as órbitas em volta dele)
  const PLANETS = [
    { id: "venus", name: "Venus", x: 168, y: 262, s: 70, info: "Hot enough to melt lead under thick yellow clouds. No landing site for this crew." },
    { id: "earth", name: "Earth", x: 360, y: 520, s: 96, home: true, info: "Home. The rocket lifted off from here." },
    { id: "moon", name: "Moon", x: 448, y: 452, s: 52, open: true, g: "1.62", info: "Gray dust, craters and caves. Low gravity: long, floaty jumps; falls rarely hurt." },
    { id: "mars", name: "Mars", x: 480, y: 168, s: 82, open: true, g: "3.71", info: "Red sand, layered mesas and buried ice. Stronger gravity: short jumps, falls hurt." },
    { id: "asteroid", name: "Asteroid", x: 668, y: 498, s: 62, info: "A loose rubble pile. Sample return mission coming later." },
    { id: "jupiter", name: "Jupiter", x: 878, y: 466, s: 140, info: "A giant ball of gas. Nothing to stand on." },
    { id: "europa", name: "Europa", x: 958, y: 596, s: 46, info: "An ocean hides under the ice. Mission coming later." },
    { id: "saturn", name: "Saturn", x: 742, y: 640, s: 150, info: "The ringed giant. Only visiting from orbit." },
  ];
  let mapSel = "moon";

  function renderMap() {
    if (!PLANETS.some((p) => p.id === mapSel)) mapSel = "moon";
    const dv = state.flight ? state.flight.dv : 0;
    $("#planets").innerHTML = PLANETS.map((p) => {
      const reach = p.open && dv >= NEED_DV[p.id];
      return `
      <button class="planet${reach ? " open" : ""}" role="option" aria-selected="${p.id === mapSel}" data-planet="${p.id}"
        style="left:${p.x}px;top:${p.y}px;width:${p.s}px" aria-label="${p.name}${reach ? "" : p.home ? ", home" : ", locked"}">
        <img class="sel" src="assets/m_brackets.png" alt="">
        <img src="assets/p_${p.id}.png" alt="">
        ${reach || p.home ? "" : `<img class="lock" src="assets/m_lock.png" alt="">`}
        ${p.home ? `<img class="ship" src="assets/m_ship.png" alt="">` : ""}
        <span class="pname">${p.name}</span>
      </button>`;
    }).join("");
    const p = PLANETS.find((x) => x.id === mapSel);
    let body = `<p>${p.info}</p>`;
    if (p.open) {
      const need = NEED_DV[p.id];
      if (dv < need) body += `<p class="bad">Your rocket's Δv is ${dv.toFixed(2)}. ${p.name} needs ${need}.</p>`;
      else {
        const qs = QUESTS[p.id];
        if (!qs.some((q) => q.id === state.quest)) state.quest = qs[0].id;
        body += `<div class="qlist">${qs.map((q) => {
          const rec = state.done[q.id];
          return `<button class="qitem" data-quest="${q.id}" aria-pressed="${q.id === state.quest}">
            <b>${q.name}</b><em class="${q.cls}">${q.diff}</em>
            <span>${money(rec ? q.reward / 2 : q.reward)}${rec ? " · done ✓" : ""}</span></button>`;
        }).join("")}</div>
        <p class="qdesc">${questById(state.quest).desc}</p>
        <button class="btn" data-act="land" data-dest="${p.id}">Land</button>`;
      }
    }
    $("#map-info").innerHTML = `<div class="mi-head"><img class="big-p" src="assets/p_${p.id}.png" alt="">
      <div><h3>${p.name}</h3>${p.g ? `<p class="dim">Gravity ${p.g} m/s²</p>` : ""}</div></div>${body}`;
    $("#map-dv").textContent = `Rocket Δv ${dv.toFixed(2)} · Budget ${money(state.money)}`;
  }

  // ---------------- Lua: quem sai e o passeio ----------------

  function renderEva() {
    if (!state.team.includes(evaCrew)) evaCrew = state.team[0];
    $("#eva-lineup").innerHTML = state.team.map((id) => {
      const c = crew(id);
      return `<button class="crew" role="option" aria-selected="${id === evaCrew}" data-eva="${id}" aria-label="${c.role}"
        style="--c1:${c.colors[0]};--c2:${c.colors[1]};--c3:${c.colors[2]}">
        <img src="assets/astro_${id}.png" alt=""><span class="ped"></span></button>`;
    }).join("");
    const q = questById(state.quest);
    $("#eva-title").textContent = state.dest === "mars" ? "Mars Landing" : "Moon Landing";
    $("#eva-info").innerHTML = crewInfo(crew(evaCrew));
    $("#eva-quest").innerHTML = `<b>${q.name}</b> · <span class="${q.cls}">${q.diff}</span><br>${q.desc}`;
  }

  let moonMsgTimer = 0;
  const bar = (id, v, max, low) => {
    const el = $(id);
    el.style.width = `${Math.max(0, (100 * v) / max)}%`;
    el.classList.toggle("low", v / max < low);
  };
  function shipHooks() {
    return {
      crew: evaCrew,
      team: state.team,
      world: state.dest,
      perks: Object.fromEntries(state.team.map((id) => {
        const pk = { ...crew(id).perk };
        if (state.flight && state.flight.solar) pk.o2Rate = (pk.o2Rate || 1) * 0.75;
        return [id, pk];
      })),
      onMessage: showMoonMsg,
      onCrewChange(id) { evaCrew = id; setShipMode(true); },
      onAirlock(id) { exitAs(id); },
      onArcade: openArcade,
      onStation(a) {
        if (a === "map") { window.HelloMoon.stop(); go("map"); }
        else if (a === "liftoff") window.HelloMoon.liftOff();
        else if (a === "abort") { window.HelloMoon.stop(); endFlight(); go("build"); say("Mission aborted. The rocket was lost; no reward."); }
      },
    };
  }
  // mini game Órbita Flight Lab, aberto num quadro por cima do jogo
  function openArcade() {
    if ($("#arcade")) return;
    window.HelloMoon.pause(true);
    const box = document.createElement("div");
    box.id = "arcade";
    box.className = "arcade";
    box.innerHTML = `<div class="arcade-bar"><b>ÓRBITA · FLIGHT LAB</b><span>Mini game on the ship's terminal</span>
      <button class="btn small" data-act="arcade-close">Close ✕</button></div>
      <iframe src="flightlab/index.html" title="Órbita Flight Lab"></iframe>`;
    stage.appendChild(box);
    box.querySelector("iframe").focus();
  }
  function closeArcade() {
    const box = $("#arcade");
    if (!box) return;
    box.remove();
    window.HelloMoon.pause(false);
    document.activeElement?.blur();
  }

  function showMoonMsg(text) {
    const el = $("#moon-msg");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(moonMsgTimer);
    moonMsgTimer = setTimeout(() => { el.hidden = true; }, 3600);
  }
  // dentro da nave o painel mostra só o nome; fora, as barras de status
  function setShipMode(inside) {
    $("#s-moon").dataset.mode = inside ? "ship" : "eva";
    const where = inside ? (state.dest && screen === "moon" ? "Lander" : "Ship") : state.dest === "mars" ? "Mars" : "Moon";
    $("#moon-title").textContent = `${where} · ${crew(evaCrew).role}`;
  }
  function startShipSpace() {
    if (!state.team.includes(evaCrew)) evaCrew = state.team[0] || "green";
    $("#moon-msg").hidden = true;
    window.HelloMoon.startShip("moon-view", shipHooks());
    setShipMode(true);
    $("#moon-quest").textContent = `Δv ${state.flight ? state.flight.dv.toFixed(2) : "?"} · Budget ${money(state.money)}`;
    fit();
    document.activeElement?.blur();
  }

  // ---------------- música ----------------
  // uma faixa para cada parte do jogo, trocando com fade; toca depois do primeiro clique ou tecla
  const TRACKS = {
    menu: "m_weightless_journey", hangar: "m_celestial_latitude", launch: "m_the_armada_approaches",
    space: "m_stellar_sonata", surface: "m_the_seven_minute_egg_crisis",
  };
  const SCREEN_TRACK = {
    menu: "menu", loading: "menu", rockets: "hangar", build: "hangar", team: "hangar",
    launch: "launch", ship: "space", map: "space", moon: "surface", eva: "surface",
    incident: "launch", failed: "menu",
  };
  const VOL = 0.45;
  const players = {};
  let curTrack = null, unlocked = false;
  const track = (k) => players[k] || (players[k] = Object.assign(new Audio(`assets/${TRACKS[k]}.mp3`), { loop: true, volume: 0 }));
  function fadeTo(a, target, ms, then) {
    clearInterval(a._fade);
    const step = (target - a.volume) / Math.max(1, ms / 50);
    a._fade = setInterval(() => {
      const v = a.volume + step;
      if ((step >= 0 && v >= target) || (step < 0 && v <= target)) { a.volume = target; clearInterval(a._fade); if (then) then(); }
      else a.volume = Math.max(0, Math.min(1, v));
    }, 50);
  }
  function playTrack(k) {
    if (!unlocked || state.musicOff || !k) return;
    if (curTrack === k && !track(k).paused) return;
    const old = curTrack && players[curTrack];
    if (old && curTrack !== k) fadeTo(old, 0, 900, () => old.pause());
    curTrack = k;
    const a = track(k);
    a.play().catch(() => {});
    fadeTo(a, VOL, 1200);
  }
  function syncMusic() {
    if (state.musicOff) { for (const a of Object.values(players)) { fadeTo(a, 0, 400, () => a.pause()); } return; }
    playTrack(SCREEN_TRACK[screen] || "menu");
  }
  function renderMusic() {
    const b = $("#btn-music");
    if (b) b.textContent = state.musicOff ? "Music: Off" : "Music: On ♪";
  }
  const firstTouch = () => { unlocked = true; syncMusic(); window.removeEventListener("pointerdown", firstTouch); window.removeEventListener("keydown", firstTouch); };
  window.addEventListener("pointerdown", firstTouch);
  window.addEventListener("keydown", firstTouch);
  setTimeout(renderMusic, 0);

  function renderPlayers() {
    const b = $("#btn-players");
    if (b) b.textContent = state.coop ? "Players: 2 👥" : "Players: 1";
    stage.classList.toggle("coop", !!state.coop);
  }
  setTimeout(renderPlayers, 0);

  // ---------------- mini games de ciência ----------------
  // aparecem de surpresa ligados ao que o jogador está fazendo na missão
  const SCIENCE_FOR = { sample: "microscope", mine: "diffract", depth: "spectrum", distance: "spectrum" };
  const SCIENCE_PAY = 15;
  let sciLast = 0, sciCount = 0;
  function scienceEvent(what) {
    const kind = SCIENCE_FOR[what];
    if (!kind || !window.HWMini || window.HWMini.active || !modal.hidden || $("#arcade")) return;
    const now = performance.now();
    // a primeira chance da missão é mais alta; depois há uma pausa e no máximo 3 por missão
    const chance = sciCount === 0 ? 0.45 : 0.25;
    if (sciCount >= 3 || now - sciLast < 35000 || Math.random() > chance) return;
    sciLast = now; sciCount++;
    playScience(kind);
  }
  function playScience(kind) {
    window.HelloMoon.pause(true);
    window.HWMini.open(kind, { world: state.dest, host: stage }, (ok) => {
      if (ok) {
        state.money += SCIENCE_PAY;
        state.science = (state.science || 0) + 1;
        save();
        showMoonMsg(`Science bonus: ${money(SCIENCE_PAY)}!`);
      }
      window.HelloMoon.pause(false);
      document.activeElement?.blur();
    });
  }
  window.HWScience = playScience; // para testar: HWScience("microscope")
  window.HWAutopilot = () => autoLaunch(); // para gravar a demo

  function startMoon() {
    sciCount = 0;
    if (!state.team.includes(evaCrew)) evaCrew = state.team[0] || "green";
    const c = crew(evaCrew);
    const q = questById(state.quest);
    $("#moon-title").textContent = `${state.dest === "mars" ? "Mars" : "Moon"} · ${c.role}`;
    $("#moon-msg").hidden = true;
    const unit = q.type === "depth" || q.type === "distance" ? " m" : "";
    window.HelloMoon.start("moon-view", {
      coop: !!state.coop,
      ...shipHooks(),
      world: state.dest,
      perk: c.perk,
      team: state.team,
      perks: Object.fromEntries(state.team.map((id) => {
        const pk = { ...crew(id).perk };
        if (state.flight && state.flight.solar) pk.o2Rate = (pk.o2Rate || 1) * 0.75;
        return [id, pk];
      })),
      onEnterLander(info) { landerInfo = info; setShipMode(true); window.HelloMoon.openShip(info); },
      quest: { type: q.type, need: q.need, o2: q.o2, label: q.desc.replace(/\.$/, "") },
      onStats(s) {
        $("#moon-quest").textContent = `${q.name}: ${s.have}/${s.need}${unit}${s.questDone ? " ✓ back to the lander, press F" : ""}`;
        $("#moon-stats").textContent = `Lander ${s.dist.toFixed(0)} m${s.compass ? "   ·   " + s.compass : ""}`;
        bar("#hpfill", s.hp, s.hpMax, 0.3);
        bar("#o2fill", s.oxygen, 100, 0.25);
        bar("#stfill", s.stamina, 100, 0.2);
        $("#hpnum").textContent = Math.ceil(s.hp);
        $("#o2num").textContent = `${s.oxygen.toFixed(0)}%`;
        $("#stnum").textContent = Math.round(s.stamina);
      },
      onMessage: showMoonMsg,
      onFinish(r) { finishQuest(r); },
      onQuestEvent: scienceEvent,
      onFail(reason) { failQuest(reason); },
    });
    setShipMode(true);
    fit();
    document.activeElement?.blur(); // senão o Espaço do pulo "clicaria" no botão em foco
  }

  // ---------------- fim da quest ----------------

  let lastResult = null;
  let landerInfo = null;
  function endFlight() {
    state.lastBuild = { ...state.build, model: state.model };
    state.build = emptyBuild();
    state.flight = null;
    let grant = 0;
    if (state.money < GRANT_FLOOR) { grant = GRANT_FLOOR - state.money; state.money = GRANT_FLOOR; }
    save();
    return grant;
  }

  function finishQuest(r) {
    const q = questById(state.quest);
    const c = crew(evaCrew);
    const first = !state.done[q.id];
    let reward = first ? q.reward : q.reward / 2;
    if (c.bonus) reward *= c.bonus;
    const hpBonus = Math.round((reward * 0.2 * r.hp) / r.hpMax); // voltar inteiro vale mais
    reward = Math.round(reward + hpBonus);
    const refund = 0; // as pernas devolvem dinheiro só quando o foguete volta para a Terra
    state.money += reward;
    const prev = state.done[q.id];
    if (!prev || r.seconds < prev.best) state.done[q.id] = { best: Math.round(r.seconds), crew: evaCrew };
    const grant = 0;
    save(); // o voo continua: mesmo foguete, mesma equipe
    lastResult = { q, reward, hpBonus, seconds: r.seconds, first, scientist: !!c.bonus, grant, refund };
    openModal("result");
  }

  let failInfo = { cause: "", tip: "" };
  function exitAs(id) {
    evaCrew = id;
    setShipMode(false);
    closeModal();
    window.HelloMoon.exitLander(id);
  }

  function failQuest(reason) {
    const towerBack = state.flight && state.flight.tower ? Math.round(state.flight.cost / 2) : 0;
    state.money += towerBack;
    const grant = endFlight();
    failInfo = {
      cause: reason,
      tip: (state.dest === "mars" ? "Mars gravity is more than twice the Moon's: jump down in short steps instead of long drops. " : "") +
        "Watch the O2 bar and turn back at half. The Power Engineer uses less oxygen; the Flight Surgeon survives more." +
        (towerBack ? ` The escape tower saved the capsule: ${money(towerBack)} back.` : "") +
        (grant ? ` The agency covered your budget up to ${money(GRANT_FLOOR)}.` : ""),
    };
    window.HelloMoon.stop();
    go("failed");
  }
  function renderFailed() {
    $("#fail-cause").textContent = failInfo.cause || "The mission was lost.";
    $("#fail-tip").innerHTML = `<b>Tip:</b> ${failInfo.tip}`;
  }

  // ---------------- janelas ----------------

  const modal = $("#modal");
  const box = $("#modal-box");
  let modalName = "";
  let modalBack = "";

  function openModal(name, back = "") {
    modalName = name;
    modalBack = back;
    box.className = "panel modal" + (name === "help" || name === "scores" ? " wide" : "");
    const backBtn = `<button class="btn" data-act="modal-back">Back</button>`;
    if (name === "pause")
      box.innerHTML = `<img class="deco" src="assets/solar_wing.png" alt=""><p class="dim">Budget ${money(state.money)}</p><h2>Pause</h2>
        <button class="btn" data-act="resume">Resume</button>
        <button class="btn" data-modal="options" data-back="pause">Options</button>
        <button class="btn" data-modal="scores" data-back="pause">Highscores</button>
        <button class="btn" data-modal="help" data-back="pause">Help</button>
        <button class="btn warn" data-go="menu">Quit to Menu</button>`;
    else if (name === "options")
      box.innerHTML = `<h2>Options</h2>
        <div class="opt-row"><span>Twinkling stars</span><button class="btn toggle" data-act="opt-stars" aria-pressed="${state.stars}">${state.stars ? "On" : "Off"}</button></div>
        <div class="opt-row"><span>Fullscreen</span><button class="btn toggle" data-act="opt-full" aria-pressed="${!!document.fullscreenElement}">${document.fullscreenElement ? "On" : "Off"}</button></div>
        <button class="btn warn" data-act="opt-reset">Erase save</button>${backBtn}`;
    else if (name === "scores")
      box.innerHTML = `<h2>Highscores</h2>${Object.keys(state.done).length ? `<dl class="help-list">${allQuests().filter((q) => state.done[q.id]).map((q) => `<dt>${q.name}</dt><dd>${Math.floor(state.done[q.id].best / 60)} min ${state.done[q.id].best % 60} s · ${crew(state.done[q.id].crew)?.role || ""}</dd>`).join("")}</dl>` : "<p>No quests finished yet.</p>"}<p>Budget ${money(state.money)}</p>${backBtn}`;
    else if (name === "help")
      box.innerHTML = `<h2>Help</h2><dl class="help-list">
        <dt>Manual</dt><dd>Each step is a slot. Pick one of the parts it lists; the numbers show cost, thrust and fuel.</dd>
        <dt>Build</dt><dd>Drag the part to the glowing outline or click it. Thrust must be at least 1.2×. Δv decides where you can go.</dd>
        <dt>Money</dt><dd>You pay for the rocket at launch. Quests pay you back; repeats pay half.</dd>
        <dt>Explore</dt><dd>A/D walk, Space jump, Shift run (uses stamina), E collect, F at the lander: refill O2 or lift off when the quest is done. Left click mines, right click places soil.</dd>
        <dt>Status</dt><dd>Health drops from hard falls and from running out of O2. At zero the quest fails and the rocket is lost.</dd>
        <dt>Esc</dt><dd>Pause, or go back one screen.</dd>
      </dl>${backBtn}`;
    else if (name === "lander") {
      const i = landerInfo;
      const q = questById(state.quest);
      box.className = "panel modal wide";
      box.innerHTML = `<h2>Lander</h2>
        <p>${q.name}: ${i.questDone ? "done ✓ Ready to lift off." : `${i.have}/${i.need}. Not finished yet.`}</p>
        <div class="lander-crew">${state.team.map((id) => {
          const c = crew(id);
          const hp = i.crewHp[id] !== undefined ? Math.ceil(i.crewHp[id]) : (c.perk.hpMax || 100);
          return `<button class="btn tall" data-act="exit-as" data-who="${id}"><img src="assets/astro_${id}.png" alt="">Go out<small>${c.role} · ${hp} HP</small></button>`;
        }).join("")}</div>
        <div class="row-btns">
          <button class="btn" data-act="liftoff" ${i.questDone ? "" : "disabled"}>Lift off</button>
          <button class="btn warn" data-act="abort-eva">Abort mission</button>
        </div>
        <p class="dim">Going out refills oxygen and stamina. Aborting returns to Earth with no reward.</p>`;
    }
    else if (name === "result") {
      const r = lastResult;
      box.className = "panel modal wide";
      box.innerHTML = `<h2>Quest done!</h2><img src="assets/ev_flag.jpg" alt="" class="result-img">
        <dl class="help-list">
          <dt>Quest</dt><dd>${r.q.name}${r.first ? "" : " (repeat: half pay)"}</dd>
          <dt>Time</dt><dd>${Math.floor(r.seconds / 60)} min ${Math.round(r.seconds % 60)} s</dd>
          <dt>Reward</dt><dd>${money(r.reward)}${r.scientist ? " (Scientist +25%)" : ""} · health bonus ${money(r.hpBonus)}</dd>
          ${r.refund ? `<dt>Legs refund</dt><dd>${money(r.refund)}</dd>` : ""}
          <dt>Budget</dt><dd>${money(state.money)}${r.grant ? ` (agency grant ${money(r.grant)})` : ""}</dd>
        </dl>
        <p class="dim">The rocket is still in orbit. Pick another planet in the cockpit, or fly home.</p>
        <div class="row"><button class="btn" data-act="continue-flight">Continue in this rocket</button>
        <button class="btn" data-act="return-earth">Back to Earth</button></div>`;
    }
    else if (name === "exit")
      box.innerHTML = `<h2>Exit</h2><p>A browser game can't close itself. Close this tab to leave. Your rocket and team are saved.</p>${backBtn}`;
    modal.hidden = false;
    if ((screen === "moon" || screen === "ship") && name !== "result") window.HelloMoon.pause(true);
    $(".btn", box)?.focus({ preventScroll: true });
  }
  function closeModal() {
    modal.hidden = true;
    modalName = "";
    if ((screen === "moon" || screen === "ship") && state.flight) { window.HelloMoon.pause(false); document.activeElement?.blur(); }
  }
  function modalGoBack() {
    if (modalName === "result") { closeModal(); window.HelloMoon.stop(); return go("ship"); }
    if (modalName === "lander") return exitAs(landerInfo.crew);
    if (modalBack) openModal(modalBack); else closeModal();
  }

  // ---------------- eventos ----------------

  const BACK = { loading: "menu", rockets: "menu", team: "build", launch: "map", map: "menu", eva: "map", incident: "menu", failed: "menu" };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-go],[data-act],[data-modal],[data-crew],[data-eva],[data-planet],[data-quest],[data-model],[data-bin]");
    if (!el || el.disabled) return;
    if (suppressClick) return;
    const d = el.dataset;
    if (d.go) go(d.go);
    else if (d.modal) openModal(d.modal, d.back || "");
    else if (d.crew) { focusCrew = d.crew; renderTeam(); $(`.crew[data-crew="${d.crew}"]`)?.focus({ preventScroll: true }); }
    else if (d.eva) { evaCrew = d.eva; renderEva(); $(`.crew[data-eva="${d.eva}"]`)?.focus({ preventScroll: true }); }
    else if (d.planet) { mapSel = d.planet; renderMap(); $(`.planet[data-planet="${d.planet}"]`)?.focus({ preventScroll: true }); }
    else if (d.quest) { state.quest = d.quest; save(); renderMap(); $(`[data-quest="${d.quest}"]`)?.focus({ preventScroll: true }); }
    else if (d.model) {
      if (state.model !== d.model) { setModel(d.model); state.build = emptyBuild(); save(); }
      go("build");
    }
    else if (d.bin) tryPart(d.bin);
    else if (d.act) act(d.act, el);
  });
  document.addEventListener("dblclick", (e) => {
    if (e.target.closest("[data-crew]")) toggleCrew();
  });

  function act(a, el) {
    if (a === "new-game" || a === "creative") {
      const creative = a === "creative";
      Object.assign(state, { money: creative ? CREATIVE_MONEY : START_MONEY, creative, lastBuild: null, team: [], flight: null, done: {}, dest: "moon", quest: "m1", model: null });
      setModel("explorer"); state.model = null; state.build = emptyBuild();
      evaCrew = ""; save(); go("loading");
    }
    else if (a === "continue") go(state.flight ? "map" : !state.model ? "rockets" : done() ? "team" : "build");
    else if (a === "team-toggle") toggleCrew();
    else if (a === "team-confirm") {
      const st = rocketStats(state.build);
      if (st.cost > state.money && !state.creative) return;
      if (!state.creative) state.money -= st.cost;
      state.flight = { dv: state.creative ? Math.max(st.dv, NEED_DV.mars) : st.dv, cost: st.cost, tower: st.tower, legs: st.legs, solar: st.solar };
      save();
      go("launch");
    }
    else if (a === "skip") { const s = SLOTS[stepIndex()]; if (s && s.optional) place(s.id, "none"); }
    else if (a === "reuse") {
      const b = { ...state.lastBuild };
      delete b.model;
      if (rocketStats(b).cost > state.money) return say(`Last design costs ${money(rocketStats(b).cost)}. You have ${money(state.money)}.`);
      state.build = b; save(); renderBuild(); say("Last design rebuilt. Change it with Undo.");
    }
    else if (a === "abort") { endFlight(); go("build"); }
    else if (a === "fly-manual") manualLaunch();
    else if (a === "music") { state.musicOff = !state.musicOff; save(); renderMusic(); syncMusic(); }
    else if (a === "players") { state.coop = !state.coop; save(); renderPlayers(); say(state.coop ? "2 players: P2 uses the arrow keys on the same keyboard." : "1 player."); }
    else if (a === "fly-auto") autoLaunch();
    else if (a === "ascent-retry") startLaunch();
    else if (a === "continue-flight") { closeModal(); window.HelloMoon.stop(); go("ship"); say("Back in orbit. Walk to the cockpit to pick the next destination."); }
    else if (a === "return-earth") {
      closeModal();
      const refund = state.flight && state.flight.legs ? Math.round(state.flight.cost * 0.3) : 0;
      state.money += refund;
      const grant = endFlight();
      go("build");
      say(`Welcome home!${refund ? ` Landing legs saved ${money(refund)}.` : ""}${grant ? ` Agency grant ${money(grant)}.` : ""}`);
    }
    else if (a === "exit-as") exitAs(el.dataset.who);
    else if (a === "arcade-close") closeArcade();
    else if (a === "liftoff") { closeModal(); window.HelloMoon.liftOff(); }
    else if (a === "abort-eva") { window.HelloMoon.stop(); endFlight(); go("build"); say("Mission aborted. The rocket was lost; no reward."); }
    else if (a === "land") { state.dest = el.dataset.dest; save(); go("moon"); }
    else if (a === "pause") openModal("pause");
    else if (a === "resume") closeModal();
    else if (a === "modal-back") modalGoBack();
    else if (a === "undo") {
      const n = stepIndex();
      if (n > 0) { state.build[SLOTS[n - 1].id] = null; save(); renderBuild(); say("Last part removed."); }
    }
    else if (a === "restart-build") { state.build = emptyBuild(); save(); renderBuild(); say("Starting from step 1."); }
    else if (a === "opt-stars") { state.stars = !state.stars; lastStar = 0; save(); openModal("options", modalBack); }
    else if (a === "opt-full") {
      const done = () => openModal("options", modalBack);
      try {
        (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).then(done, done);
      } catch { done(); }
    } else if (a === "opt-reset") {
      Object.assign(state, { money: START_MONEY, lastBuild: null, team: [], flight: null, done: {}, started: false, model: null });
      state.build = emptyBuild();
      try { localStorage.removeItem(KEY); } catch { /* ignora */ }
      const b = modalBack;
      if (screen !== "menu") go("menu"); else { $("#btn-continue").disabled = true; openModal("options", b); }
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("#arcade")) return closeArcade();
      if (!modal.hidden) modalGoBack();
      else if (screen === "build" || screen === "moon" || screen === "ship") openModal("pause");
      else if (BACK[screen]) go(BACK[screen]);
    } else if (screen === "team" && modal.hidden && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const i = CREW.findIndex((c) => c.id === focusCrew) + (e.key === "ArrowRight" ? 1 : -1);
      focusCrew = CREW[(i + CREW.length) % CREW.length].id;
      renderTeam();
      $(`.crew[data-crew="${focusCrew}"]`)?.focus({ preventScroll: true });
    }
  });

  load();
  go("menu");
})();
