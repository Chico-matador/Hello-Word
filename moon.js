// Exploração 2D lateral (estilo sandbox) na Lua e em Marte.
// Baseado no MoonScene.ts de referência; agora com quests, status do tripulante,
// atributos de cada papel e um mapa próprio para Marte.
// Escala: um bloco = 1 m = 32 px.
(() => {
  "use strict";
  const Phaser = window.Phaser;

  const TILE = 32;
  const MAP_W = 320;
  const MAP_H = 112;
  const WORLD_W = MAP_W * TILE;
  const WORLD_H = MAP_H * TILE;
  const WALK_SPEED = 150;
  const SPRINT_SPEED = 215;
  // Mesmo impulso de pernas nos dois mundos (3,5 m/s): só a gravidade muda.
  // Na Lua o pulo sobe ~3,6 m; em Marte, ~1,6 m.
  const JUMP_SPEED = 112;
  const REACH = TILE * 5.25;
  const LANDING_X = 48;
  const VARIANTS = 4;
  const ATLAS_ROWS = 5;
  const ATLAS_COUNT = VARIANTS * ATLAS_ROWS;
  const ASTRO_H = 64; // altura do astronauta na tela (2 blocos)
  const FALL_SAFE = 230; // px/s (~7 m/s): acima disso a queda machuca

  const WORLDS = {
    moon: { name: "Moon", g: 1.62, sky: "sky_moon", skyTop: "#000000", sample: "i_rock", tiles: null },
    mars: { name: "Mars", g: 3.71, sky: "sky_mars", skyTop: "#de7c63", sample: "i_ice", tiles: "tiles_mars" },
  };

  // Lua: regolito, crosta, basalto, anortosito, vidro de impacto.
  // Marte (mesmas posições no atlas): areia, solo compactado, rocha escura, rocha sedimentar, gelo.
  const Block = { Air: 0, Regolith: 1, Crust: 2, Basalt: 3, Anorthosite: 4, ImpactGlass: 5 };

  const BODY_FRAC = { blue: 0.915, yellow: 0.9 };
  // tripulantes com quadros de animação (parado, 3 passos, pulo, picareta)
  const WALK = { blue: { w: 90, h: 210, body: 168 }, green: { w: 136, h: 180, body: 173 }, orange: { w: 119, h: 210, body: 168 }, yellow: { w: 111, h: 210, body: 168 }, pink: { w: 120, h: 210, body: 168 } };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // Animação com "vida": respiração parado, balanço ao andar, esticar no pulo,
  // achatar ao pousar e inclinar ao correr. Só mexe no desenho, nunca na colisão.
  class Juice {
    constructor() { this.sq = 0; this.clock = 0; this.wasGround = true; }
    pulse(amount) { this.sq = amount; } // >0 achata (pouso), <0 estica (pulo)
    apply(spr, base, st, dt) {
      this.clock += dt;
      this.sq *= Math.exp(-dt * 12);
      let sx = 1, sy = 1, off = 0, ang = 0;
      if (!st.grounded) {
        const k = clamp(-st.vy / 600, -0.08, 0.1); // subindo estica, caindo afina menos
        sy += k; sx -= k * 0.6;
        ang = st.moving ? st.dir * 5 : 0;
      } else if (st.moving) {
        const f = (st.sprint ? 9 : 6.5) * Math.PI;
        const b = Math.abs(Math.sin(this.clock * f));
        off = -b * (st.sheet ? 3 : 5);
        sy += (st.sheet ? 0 : 0.04) * (b - 0.5);
        sx -= (st.sheet ? 0 : 0.03) * (b - 0.5);
        ang = st.sheet ? st.dir * (st.sprint ? 6 : 2.5) : st.dir * 3 + Math.sin(this.clock * f) * 6;
      } else {
        const br = Math.sin(this.clock * 2.6);
        sy += br * 0.018; sx -= br * 0.01;
      }
      sy -= this.sq; sx += this.sq * 0.8;
      spr.setScale(base * sx, base * sy);
      spr.setAngle(ang);
      return off;
    }
  }

  // Hash determinístico: o mundo é idêntico a cada execução.
  function hash(x, y, seed = 1969) {
    let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, seed = 1) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  function fbm(x, y, seed = 1) {
    return noise(x, y, seed) * 0.56 + noise(x * 2.06, y * 2.06, seed + 7) * 0.29 + noise(x * 4.11, y * 4.11, seed + 19) * 0.15;
  }

  class MoonScene extends Phaser.Scene {
    constructor() {
      super("MoonScene");
    }

    init() {
      this.hooks = window.HW_MOON || {};
      this.crew = this.hooks.crew || "green";
      this.team = this.hooks.team && this.hooks.team.length ? this.hooks.team : [this.crew];
      if (!this.team.includes(this.crew)) this.team = [this.crew, ...this.team];
      this.perks = this.hooks.perks || {};
      this.crewHp = {}; // vida de cada tripulante que já saiu
      this.inLander = false;
      this.world = WORLDS[this.hooks.world] || WORLDS.moon;
      this.worldId = this.hooks.world === "mars" ? "mars" : "moon";
      // atributos do papel (game.js manda; aqui ficam os padrões)
      this.perk = this.perkOf(this.crew);
      // quest: { type: samples | mine | depth | distance, need, o2 }
      this.quest = Object.assign({ type: "samples", need: 14, o2: 1, label: "Collect samples" }, this.hooks.quest || {});
      this.blocks = new Uint8Array(MAP_W * MAP_H);
      this.heights = new Int16Array(MAP_W);
      this.samples = [];
      this.collected = 0;
      this.soil = 0;
      this.rocks = 0;
      this.special = 0; // vidro (Lua) ou gelo (Marte) minerado
      this.maxDepth = 0;
      this.maxDist = 0;
      this.oxygen = 100;
      this.hp = this.perk.hpMax;
      this.stamina = 100;
      this.questDone = false;
      this.ended = false;
      this.airborne = false;
      this.lastVy = 0;
      this.footstepTime = 0;
      this.miningTime = 0;
      this.uiTime = 0;
      this.animationClock = 0;
      this.t0 = 0;
    }

    preload() {
      this.coop = !!this.hooks.coop;
      this.p2id = this.coop ? (this.team.find((t) => t !== this.crew) || ["green", "orange", "blue", "yellow", "pink"].find((t) => t !== this.crew)) : null;
      if (this.p2id && !this.team.includes(this.p2id)) {
        const w = WALK[this.p2id];
        this.load.spritesheet(`astro_${this.p2id}`, `assets/walk_${this.p2id}.png`, { frameWidth: w.w, frameHeight: w.h });
      }
      // toda a tripulação, para poder trocar quem sai do módulo
      for (const id of this.team) {
        const w = WALK[id];
        if (w) this.load.spritesheet(`astro_${id}`, `assets/walk_${id}.png`, { frameWidth: w.w, frameHeight: w.h });
        else this.load.image(`astro_${id}`, `assets/astro_${id}.png`);
      }
      this.load.image("lander", "assets/lander.png");
      this.load.image("o2station", "assets/t_o2station.png");
      this.load.image("flag", "assets/t_flag.png");
      this.load.image("sample", `assets/${this.world.sample}.png`);
      this.load.image("sky", `assets/${this.world.sky}.jpg`);
      if (this.world.tiles) this.load.image("world-tiles", `assets/${this.world.tiles}.png`);
    }

    create() {
      this.cameras.main.setBackgroundColor(this.world.skyTop);
      this.physics.world.gravity.y = this.world.g * TILE;
      this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
      this.createArt();
      if (this.worldId === "mars") this.generateMars();
      else this.generateMoon();
      this.createTerrain();
      this.createBackground();
      this.createLander();
      this.createAstronaut();
      if (this.coop) this.createP2();
      this.createSamples();
      this.createControls();

      this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
      // com 2 jogadores a câmera segue o meio dos dois
      this.camTarget = this.add.zone(this.astronaut.x, this.astronaut.y, 1, 1);
      this.cameras.main.startFollow(this.coop ? this.camTarget : this.astronaut, true, 0.11, 0.11);
      this.cameras.main.setDeadzone(120, 65);
      this.t0 = this.time.now;
      this.pushStats();
      // o pouso termina dentro da nave: o jogador sai pela câmara de ar
      if (this.hooks.startInShip) this.time.delayedCall(30, () => this.enterLander(true));
      else this.notify(`Quest: ${this.quest.label}. Press F at the lander to get back in.`);
      if (this.coop) this.time.delayedCall(2600, () => this.notify("P2: ← → walk · ↑ jump · ↓ pick up · Enter dig (hold ↓ to dig down)"));
    }

    index(x, y) { return y * MAP_W + x; }
    inside(x, y) { return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H; }
    blockAt(x, y) { return this.inside(x, y) ? this.blocks[this.index(x, y)] : Block.Air; }
    tileIndex(block, x, y) { return (block - 1) * VARIANTS + Math.floor(hash(x, y, 2011) * VARIANTS); }

    flattenLanding(x, ground, level) {
      if (Math.abs(x - LANDING_X) < 12) {
        const blend = 1 - Math.min(1, Math.abs(x - LANDING_X) / 12);
        return ground * (1 - blend) + level * blend;
      }
      return ground;
    }

    /** Lua: crateras, camadas geológicas e cavernas. */
    generateMoon() {
      const craterCenters = [[18, 13, 3.4], [94, 18, 4.5], [153, 28, 6.3], [211, 19, 4.2], [273, 24, 5.2]];
      for (let x = 0; x < MAP_W; x++) {
        let ground = 24 + 3.2 * Math.sin(x * 0.034) + 2.2 * Math.sin(x * 0.095);
        ground += (noise(x * 0.055, 0, 71) - 0.5) * 5;
        for (const [cx, radius, depth] of craterCenters) {
          const d = Math.abs(x - cx) / radius;
          // centro deprimido, borda levemente elevada
          if (d < 1) ground += depth * Math.pow(1 - d * d, 2);
          else if (d < 1.28) ground -= depth * 0.25 * (1 - (d - 1) / 0.28);
        }
        this.heights[x] = clamp(Math.round(this.flattenLanding(x, ground, 24)), 13, 39);
      }

      for (let x = 0; x < MAP_W; x++) {
        for (let y = 0; y < MAP_H; y++) {
          const depth = y - this.heights[x];
          if (depth < 0) continue;
          let type = Block.Regolith;
          if (depth >= 3) type = Block.Crust;
          if (depth >= 10) type = Block.Basalt;
          if (depth >= 22 && fbm(x * 0.1, y * 0.1, 45) > 0.61) type = Block.Anorthosite;
          if (depth >= 8 && hash(x, y, 8) > 0.986) type = Block.ImpactGlass;

          if (depth > 8) {
            const cave = fbm(x * 0.079, y * 0.1, 247);
            const windingTunnel = Math.abs(y - (this.heights[x] + 20 + 6 * Math.sin(x * 0.044 + 2))) < 1.7;
            const deepTunnel = Math.abs(y - (69 + 8 * Math.cos(x * 0.027))) < 2.1;
            if (cave > 0.635 || (x > 68 && windingTunnel) || (x > 104 && deepTunnel && hash(x >> 2, 0, 50) > 0.09)) {
              type = Block.Air;
            }
          }
          this.blocks[this.index(x, y)] = type;
        }
      }

      // um poço explorável perto do primeiro campo de crateras
      for (let y = 25; y < 49; y++) {
        const cx = 110 + Math.round(3 * Math.sin(y * 0.21));
        for (let dx = -1; dx <= 1; dx++) {
          const tx = cx + dx;
          if (this.inside(tx, y)) this.blocks[this.index(tx, y)] = Block.Air;
        }
      }
    }

    /** Marte: dunas, mesas de rocha em camadas, bolsões de gelo e poucas cavernas. */
    generateMars() {
      const BASE = 26;
      const mesas = [[96, 9, 6], [168, 14, 9], [236, 7, 5], [292, 11, 7]]; // centro, meia-largura, altura
      this.mesaTop = new Int16Array(MAP_W).fill(999);
      for (let x = 0; x < MAP_W; x++) {
        let ground = BASE + 1.8 * Math.sin(x * 0.07) + 1.3 * Math.sin(x * 0.023 + 1);
        ground += (noise(x * 0.09, 0, 33) - 0.5) * 2.5;
        for (const [cx, hw, h] of mesas) {
          const d = Math.abs(x - cx);
          // topo plano e paredes quase verticais, com um degrau de cada lado
          if (d <= hw) { ground = BASE - h; this.mesaTop[x] = BASE - h; }
          else if (d <= hw + 2) ground = Math.min(ground, BASE - Math.ceil(h / 2));
        }
        this.heights[x] = clamp(Math.round(this.flattenLanding(x, ground, BASE)), 12, 40);
      }

      for (let x = 0; x < MAP_W; x++) {
        for (let y = 0; y < MAP_H; y++) {
          const depth = y - this.heights[x];
          if (depth < 0) continue;
          let type = Block.Regolith; // areia
          if (y < BASE - 1) type = Block.Anorthosite; // camadas da mesa
          else if (depth >= 2) type = Block.Crust;
          if (depth >= 9) type = Block.Basalt;
          if (depth >= 16 && Math.floor(y / 3) % 4 === 0 && fbm(x * 0.05, y * 0.05, 12) > 0.45) type = Block.Anorthosite;
          // gelo enterrado: bolsões a partir de 4 m de profundidade
          if (depth >= 4 && fbm(x * 0.14, y * 0.18, 91) > 0.71) type = Block.ImpactGlass;
          if (depth > 10 && fbm(x * 0.07, y * 0.09, 303) > 0.69) type = Block.Air;
          this.blocks[this.index(x, y)] = type;
        }
      }
    }

    /** Lua: arte gerada em canvas em "pixels" de 4 px. Marte usa o atlas desenhado. */
    createArt() {
      if (this.world.tiles) return;
      const P = 4;
      const N = TILE / P;
      const atlas = this.textures.createCanvas("lunar-tiles", TILE * VARIANTS, TILE * ATLAS_ROWS);
      const c = atlas.getContext();
      const palettes = [
        ["#989998", "#787b7b", "#c8c6bf"], // regolito
        ["#727777", "#51595d", "#929b9e"], // camada compacta
        ["#343b48", "#242832", "#566070"], // basalto
        ["#a9a9a5", "#848c8f", "#d3d1c8"], // anortosito
        ["#314a55", "#1c242c", "#8fd0d0"], // vidro de impacto
      ];
      palettes.forEach(([base, dark, light], row) => {
        for (let v = 0; v < VARIANTS; v++) {
          const ox = v * TILE, oy = row * TILE;
          for (let py = 0; py < N; py++) {
            for (let px = 0; px < N; px++) {
              const r = hash(px + v * 31, py + row * 57, 404 + row);
              let col = r < 0.13 ? dark : r > 0.91 ? light : base;
              if (row === 0 && py === 0) col = r > 0.35 ? light : base;
              if (row >= 2 && (px === 2 + ((py + v) >> 1) % 3 && py > 0 && py < 7) && r > 0.3) col = dark;
              if (row === 4 && r > 0.8) col = light;
              c.fillStyle = col;
              c.fillRect(ox + px * P, oy + py * P, P, P);
            }
          }
        }
      });
      atlas.refresh();
    }

    createTerrain() {
      this.tilemap = this.make.tilemap({ width: MAP_W, height: MAP_H, tileWidth: TILE, tileHeight: TILE });
      const key = this.world.tiles ? "world-tiles" : "lunar-tiles";
      const tileset = this.tilemap.addTilesetImage(key, key, TILE, TILE, 0, 0);
      const layer = this.tilemap.createBlankLayer("terrain", tileset, 0, 0, MAP_W, MAP_H, TILE, TILE);
      if (!tileset || !layer) throw new Error("Could not create the terrain.");
      this.terrain = layer;
      const matrix = [];
      for (let y = 0; y < MAP_H; y++) {
        const row = [];
        for (let x = 0; x < MAP_W; x++) {
          const b = this.blockAt(x, y);
          row.push(b === Block.Air ? -1 : this.tileIndex(b, x, y));
        }
        matrix.push(row);
      }
      this.tilemap.putTilesAt(matrix, 0, 0, false, this.terrain);
      this.terrain.setCollisionBetween(0, ATLAS_COUNT - 1, true, false);
      this.terrain.setDepth(5);
    }

    // céu do mundo: preso à tela, com o horizonte um pouco acima do chão
    createBackground() {
      const w = this.scale.width;
      const sky = this.add.image(w / 2, 470, "sky").setOrigin(0.5, 1).setScrollFactor(0).setDepth(-100);
      sky.setScale(Math.max(w / sky.width, 400 / sky.height));
    }

    createLander() {
      this.landerX = (LANDING_X - 5) * TILE;
      this.landerY = this.heights[LANDING_X - 5] * TILE;
      const lander = this.add.image(this.landerX, this.landerY + 2, "lander").setOrigin(0.5, 1).setDepth(15);
      lander.setScale(230 / lander.width);
      const st = this.add.image(this.landerX + 150, this.heights[LANDING_X - 1] * TILE + 2, "o2station").setOrigin(0.5, 1).setDepth(14);
      st.setScale(70 / st.height);
      const fl = this.add.image(this.landerX - 150, this.heights[LANDING_X - 10] * TILE + 2, "flag").setOrigin(0.5, 1).setDepth(14);
      fl.setScale(80 / fl.height);
    }

    perkOf(id) {
      return Object.assign({ mineCd: 125, pickRadius: 68, o2Rate: 1, staminaRegen: 1, hpMax: 100, regen: 0, compass: false }, this.perks[id] || (id === this.hooks.crew ? this.hooks.perk : null) || {});
    }

    createAstronaut() {
      const startX = LANDING_X + 7;
      const floor = this.heights[startX] * TILE;
      const a = this.physics.add.sprite(startX * TILE + TILE / 2, floor - 33, `astro_${this.crew}`);
      a.setDepth(40);
      a.setCollideWorldBounds(true);
      a.setMaxVelocity(250, 350);
      this.physics.add.collider(a, this.terrain);
      this.astronaut = a;
      // o corpo de física fica invisível; o desenho segue ele e pode se deformar à vontade
      a.setVisible(false);
      this.look = this.add.sprite(a.x, a.y, `astro_${this.crew}`).setOrigin(0.5, 1).setDepth(40);
      this.juice = new Juice();
      this.events.on("postupdate", () => this.placeLook());
      this.applyCrew(this.crew);
    }

    // ---------- jogador 2 (setas + Enter + ↓) ----------
    createP2() {
      const id = this.p2id;
      const a = this.physics.add.sprite(this.astronaut.x + 40, this.astronaut.y, `astro_${id}`, 0);
      a.setCollideWorldBounds(true).setMaxVelocity(250, 350).setVisible(false);
      this.physics.add.collider(a, this.terrain);
      if (!this.anims.exists(`walk_${id}`)) this.anims.create({ key: `walk_${id}`, frames: this.anims.generateFrameNumbers(`astro_${id}`, { frames: [1, 2, 3, 2] }), frameRate: 8, repeat: -1 });
      const w = WALK[id];
      const sc = ASTRO_H / (w.body * (BODY_FRAC[id] || 1));
      a.setScale(sc);
      const bw = 25 / sc, bh = 54 / sc;
      a.body.setSize(bw, bh); a.body.setOffset((a.frame.width - bw) / 2, a.frame.height - bh - 2 / sc);
      const look = this.add.sprite(a.x, a.y, `astro_${id}`, 0).setOrigin(0.5, 1).setDepth(39).setScale(sc);
      const tag = this.add.text(0, 0, "P2", { fontFamily: "monospace", fontSize: "14px", color: "#ffd23f", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(41);
      const tag1 = this.add.text(0, 0, "P1", { fontFamily: "monospace", fontSize: "14px", color: "#3fe6ee", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(41);
      this.p2 = { id, a, look, tag, tag1, base: sc, juice: new Juice(), off: 0, mineCd: 0, swing: 0, air: false };
      this.p2keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,ENTER");
    }

    updateP2(dt) {
      const P = this.p2, k = this.p2keys, a = P.a, body = a.body;
      const grounded = body.blocked.down || body.touching.down;
      let left = k.LEFT.isDown, right = k.RIGHT.isDown;
      // não deixa os dois se afastarem além da tela
      const gap = a.x - this.astronaut.x;
      if (gap > 560) right = false;
      if (gap < -560) left = false;
      const moving = left !== right;
      a.setVelocityX(moving ? (left ? -WALK_SPEED : WALK_SPEED) : 0);
      if (moving) P.look.setFlipX(left);
      if (moving && grounded && (left ? body.blocked.left : body.blocked.right)) {
        const dir = left ? -1 : 1;
        const ax = Math.floor((dir > 0 ? body.right + 2 : body.x - 2) / TILE), footY = Math.floor((body.bottom - 1) / TILE);
        const free = (x, y) => this.blockAt(x, y) === Block.Air;
        if (!free(ax, footY) && free(ax, footY - 1) && free(ax, footY - 2)) { a.y -= TILE + 2; a.x += dir * 3; }
      }
      if (Phaser.Input.Keyboard.JustDown(k.UP) && grounded) { a.setVelocityY(-JUMP_SPEED); P.juice.pulse(-0.12); }
      if (!grounded) P.air = true; else if (P.air) { P.air = false; P.juice.pulse(0.12); }
      // ↓ pega amostra perto; Enter cava à frente (com ↓ segurado, cava para baixo)
      if (Phaser.Input.Keyboard.JustDown(k.DOWN)) this.tryCollect(a);
      P.mineCd -= dt * 1000;
      if (k.ENTER.isDown && P.mineCd <= 0) {
        P.mineCd = 200; P.swing = this.time.now + 220;
        const dir = P.look.flipX ? -1 : 1;
        const cx = Math.floor(body.center.x / TILE), fy = Math.floor((body.bottom - 1) / TILE);
        // acha o chão de verdade logo abaixo dos pés
        let g = fy + 1;
        while (g < fy + 4 && this.blockAt(cx, g) === Block.Air) g++;
        const targets = k.DOWN.isDown ? [[cx, g]] : [[cx + dir, g - 1], [cx + dir, g - 2], [cx + dir, g]];
        for (const [tx, ty] of targets) if (this.mineTile(tx, ty)) break;
      }
      const L = P.look;
      if (this.time.now < P.swing) { L.anims.stop(); L.setFrame(5); }
      else if (!grounded) { L.anims.stop(); L.setFrame(4); }
      else if (moving) L.play(`walk_${P.id}`, true);
      else { L.anims.stop(); L.setFrame(0); }
      P.off = P.juice.apply(L, P.base, { grounded, moving, sprint: false, vy: body.velocity.y, dir: left ? -1 : 1, sheet: true }, dt);
      this.camTarget.setPosition((this.astronaut.x + a.x) / 2, (this.astronaut.y + a.y) / 2);
    }

    placeLook() {
      const b = this.astronaut && this.astronaut.body;
      if (!b || !this.look) return;
      this.look.setPosition(b.center.x, b.bottom + 2 + (this.lookOff || 0));
      if (this.p2) {
        const P = this.p2, pb = P.a.body;
        P.look.setPosition(pb.center.x, pb.bottom + 2 + P.off);
        P.tag.setPosition(pb.center.x, pb.y - 14).setVisible(P.look.visible);
        P.tag1.setPosition(b.center.x, b.y - 14).setVisible(this.look.visible);
      }
    }

    // troca o desenho, o tamanho da colisão e os atributos para outro tripulante
    applyCrew(id) {
      const a = this.astronaut;
      this.crew = id;
      this.walk = WALK[id] || null;
      this.perk = this.perkOf(id);
      a.anims.stop();
      a.setAngle(0);
      if (this.walk) a.setTexture(`astro_${id}`, 0);
      else a.setTexture(`astro_${id}`);
      if (this.look) {
        this.look.anims.stop();
        this.look.setAngle(0);
        if (this.walk) this.look.setTexture(`astro_${id}`, 0);
        else this.look.setTexture(`astro_${id}`);
      }
      if (this.walk && !this.anims.exists(`walk_${id}`)) {
        this.anims.create({ key: `walk_${id}`, frames: this.anims.generateFrameNumbers(`astro_${id}`, { frames: [1, 2, 3, 2] }), frameRate: 8, repeat: -1 });
      }
      const fh = this.walk ? this.walk.h : a.frame.height;
      const s = ASTRO_H / ((this.walk ? this.walk.body : fh) * (BODY_FRAC[id] || 1));
      a.setScale(s);
      this.lookBase = s;
      if (this.look) this.look.setScale(s);
      // caixa de colisão de 25 x 54 px de tela, com os pés na base do sprite
      const bw = 25 / s, bh = 54 / s;
      a.body.setSize(bw, bh);
      a.body.setOffset((a.frame.width - bw) / 2, a.frame.height - bh - 2 / s);
      this.hp = this.crewHp[id] !== undefined ? this.crewHp[id] : this.perk.hpMax;
    }

    // F perto do módulo: entra; lá dentro o jogador escolhe sair de novo, decolar ou abortar
    enterLander(force = false) {
      if (!force && Math.abs(this.astronaut.x - this.landerX) > 190 || Math.abs(this.astronaut.y - this.landerY) > 210) {
        this.notify("Get closer to the lander to go inside.");
        return;
      }
      this.inLander = true;
      this.crewHp[this.crew] = this.hp;
      this.look.setVisible(false);
      if (this.p2) this.p2.look.setVisible(false);
      this.physics.pause();
      if (this.hooks.onEnterLander) {
        this.hooks.onEnterLander({ questDone: this.questDone, have: Math.min(this.questHave(), this.quest.need), need: this.quest.need, crew: this.crew, crewHp: { ...this.crewHp } });
      }
    }

    exitLander(id) {
      if (!this.inLander || this.ended) return;
      this.inLander = false;
      if (id && id !== this.crew) this.applyCrew(id);
      this.oxygen = 100;
      this.stamina = 100;
      const a = this.astronaut;
      a.setVelocity(0, 0);
      a.setPosition(this.landerX + 40, this.landerY - 40);
      this.look.setVisible(true);
      if (this.p2) { this.p2.a.setPosition(this.landerX + 80, this.landerY - 40); this.p2.a.setVelocity(0, 0); this.p2.look.setVisible(true); }
      this.airborne = false;
      this.lastVy = 0;
      this.physics.resume();
      this.notify(this.firstOut ? `Oxygen refilled. ${this.questDone ? "Quest done: come back in to lift off." : "Good luck out there."}` : `Quest: ${this.quest.label}. Press F at the lander to get back in.`);
      this.firstOut = true;
      this.pushStats();
    }

    heal(id) {
      this.crewHp[id] = this.perkOf(id).hpMax;
      if (id === this.crew) this.hp = this.crewHp[id];
    }

    liftOff() {
      if (!this.inLander || !this.questDone || this.ended) return;
      this.ended = true;
      if (this.hooks.onFinish) this.hooks.onFinish({ seconds: (this.time.now - this.t0) / 1000, hp: this.hp, hpMax: this.perk.hpMax, extra: this.collected });
    }

    createSamples() {
      // 14 amostras na superfície
      const places = [26, 38, 67, 82, 99, 116, 137, 157, 181, 203, 229, 254, 280, 303];
      for (const tx of places) {
        const x = tx * TILE + 16;
        const y = this.heights[tx] * TILE - 14;
        const sprite = this.add.image(x, y + 2, "sample").setDepth(22);
        sprite.setScale(26 / sprite.height);
        this.samples.push({ sprite, x, y, collected: false });
      }
    }

    createControls() {
      this.keys = this.input.keyboard.addKeys("A,D,W,SPACE,SHIFT,E,F,LEFT,RIGHT,UP");
      if (this.input.mouse) this.input.mouse.disableContextMenu();
      this.input.on("pointerdown", (pointer) => this.useTool(pointer));
      // eventos de tecla (não perdem um toque rápido entre dois quadros)
      this.input.keyboard.on("keydown-E", () => { if (!this.ended && !this.inLander) this.tryCollect(); });
      this.input.keyboard.on("keydown-F", () => { if (!this.ended && !this.inLander) this.enterLander(); });
      this.reticle = this.add.graphics().setDepth(80);
    }

    notify(message) {
      if (this.hooks.onMessage) this.hooks.onMessage(message);
    }

    questHave() {
      const q = this.quest;
      if (q.type === "samples") return this.collected;
      if (q.type === "mine") return this.special;
      if (q.type === "depth") return Math.floor(this.maxDepth);
      if (q.type === "distance") return Math.floor(this.maxDist);
      return 0;
    }

    compass() {
      if (!this.perk.compass) return "";
      const ax = this.astronaut.x;
      if (this.questDone) {
        const d = (this.landerX - ax) / TILE;
        return `Lander ${Math.abs(d).toFixed(0)} m ${d < 0 ? "◄" : "►"}`;
      }
      let best = null;
      for (const s of this.samples) {
        if (s.collected) continue;
        if (!best || Math.abs(s.x - ax) < Math.abs(best.x - ax)) best = s;
      }
      if (!best) return "";
      const d = (best.x - ax) / TILE;
      return `Sample ${Math.abs(d).toFixed(0)} m ${d < 0 ? "◄" : "►"}`;
    }

    pushStats() {
      const have = this.questHave();
      if (!this.questDone && have >= this.quest.need) {
        this.questDone = true;
        this.notify("Quest objective done! Go back to the lander and press F to get in.");
      }
      if (!this.hooks.onStats) return;
      this.hooks.onStats({
        have: Math.min(have, this.quest.need), need: this.quest.need, questDone: this.questDone,
        dist: Math.abs(this.astronaut.x - this.landerX) / TILE, depth: this.maxDepth,
        oxygen: this.oxygen, hp: this.hp, hpMax: this.perk.hpMax, crew: this.crew, stamina: this.stamina,
        soil: this.soil, rocks: this.rocks, compass: this.compass(),
      });
    }

    hurt(amount, reason) {
      if (this.ended) return;
      this.hp = Math.max(0, this.hp - amount);
      this.cameras.main.shake(120, 0.004);
      if (this.hp <= 0) {
        this.ended = true;
        this.physics.pause();
        if (this.hooks.onFail) this.hooks.onFail(reason);
      }
    }

    useTool(pointer) {
      if (this.ended) return;
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
      if (!this.inside(tx, ty)) return;
      const distance = Phaser.Math.Distance.Between(this.astronaut.x, this.astronaut.y, tx * TILE + 16, ty * TILE + 16);
      if (distance > REACH) return;
      if (this.time.now - this.miningTime < this.perk.mineCd) return;
      this.miningTime = this.time.now;
      this.swingUntil = this.time.now + 220; // mostra a picareta

      if (pointer.rightButtonDown()) {
        if (this.soil < 1 || this.blockAt(tx, ty) !== Block.Air) return;
        const body = this.astronaut.body;
        // não deixa criar bloco dentro do personagem
        if (Phaser.Geom.Rectangle.Overlaps(
          new Phaser.Geom.Rectangle(tx * TILE, ty * TILE, TILE, TILE),
          new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height))) return;
        this.blocks[this.index(tx, ty)] = Block.Regolith;
        const tile = this.tilemap.putTileAt(this.tileIndex(Block.Regolith, tx, ty), tx, ty, true, this.terrain);
        if (tile) tile.setCollision(true, true, true, true);
        this.soil--;
        return;
      }

      this.mineTile(tx, ty);
    }

    mineTile(tx, ty) {
      if (!this.inside(tx, ty) || this.blockAt(tx, ty) === Block.Air) return false;
      // o chão debaixo do módulo fica preservado
      if (Math.abs(tx * TILE - this.landerX) < 85 && Math.abs(ty * TILE - this.landerY) < 35) return false;
      const mined = this.blockAt(tx, ty);
      this.blocks[this.index(tx, ty)] = Block.Air;
      this.tilemap.removeTileAt(tx, ty, true, true, this.terrain);
      if (mined === Block.Regolith || mined === Block.Crust) this.soil++;
      else this.rocks++;
      if (mined === Block.ImpactGlass) {
        this.special++;
        if (this.hooks.onQuestEvent) this.hooks.onQuestEvent("mine");
        if (this.quest.type === "mine") this.notify(`${this.worldId === "mars" ? "Ice" : "Impact glass"} ${Math.min(this.special, this.quest.need)}/${this.quest.need}`);
      }
      this.dustBurst(tx * TILE + 16, ty * TILE + 16, mined);
      return true;
    }

    dustBurst(x, y, material) {
      const mars = this.worldId === "mars";
      for (let i = 0; i < 5; i++) {
        const color = material === Block.ImpactGlass ? (mars ? 0xdff2fb : 0x8fd0d0) : mars ? 0xd9784a : 0xbcbcb8;
        const p = this.add.rectangle(x, y, 4, 4, color).setDepth(70);
        this.tweens.add({
          targets: p,
          x: x + (hash(i, x | 0) - 0.5) * 40,
          y: y + 10 + hash(i, y | 0) * 8, // a poeira cai e assenta, não fica flutuando
          alpha: 0,
          duration: 260 + i * 40,
          onComplete: () => p.destroy(),
        });
      }
    }

    tryCollect(who = this.astronaut) {
      const near = this.samples.find((s) => !s.collected &&
        Phaser.Math.Distance.Between(s.x, s.y, who.x, who.y + 16) < this.perk.pickRadius);
      if (!near) return;
      near.collected = true;
      near.sprite.destroy();
      this.collected++;
      if (this.quest.type === "samples" && this.collected <= this.quest.need) this.notify(`Sample ${this.collected}/${this.quest.need}`);
      this.pushStats();
      if (this.hooks.onQuestEvent) this.hooks.onQuestEvent("sample");
    }

    update(_time, deltaMs) {
      if (!this.astronaut || !this.astronaut.body || this.ended || this.inLander) return;
      const dt = Math.min(0.06, deltaMs / 1000);
      const k = this.keys;
      if (this.p2) this.updateP2(dt);
      const left = k.A.isDown || (!this.coop && k.LEFT.isDown);
      const right = k.D.isDown || (!this.coop && k.RIGHT.isDown);
      const moving = left !== right;
      const sprint = k.SHIFT.isDown && this.stamina > 0 && moving;
      const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
      const body = this.astronaut.body;
      const grounded = body.blocked.down || body.touching.down;
      const JustDown = Phaser.Input.Keyboard.JustDown;

      // queda: mede a velocidade no ar e cobra o impacto ao tocar o chão
      if (!grounded) { this.airborne = true; this.lastVy = body.velocity.y; }
      else if (this.airborne) {
        this.airborne = false;
        // pouso: achata proporcional à queda e levanta poeira
        if (this.lastVy > 60) {
          this.juice.pulse(clamp(this.lastVy / 900, 0.06, 0.22));
          this.dustBurst(body.center.x, body.bottom - 4, Block.Regolith);
        }
        if (this.lastVy > FALL_SAFE) this.hurt((this.lastVy - FALL_SAFE) * 0.5, `Hard landing after a fall on ${this.world.name}.`);
        this.lastVy = 0;
      }

      if (moving) {
        this.astronaut.setVelocityX(left ? -speed : speed);
        this.look.setFlipX(left);
      } else this.astronaut.setVelocityX(0);

      // degrau automático de 1 bloco
      if (moving && grounded && (left ? body.blocked.left : body.blocked.right)) {
        const dir = left ? -1 : 1;
        const ax = Math.floor((dir > 0 ? body.right + 2 : body.x - 2) / TILE);
        const footY = Math.floor((body.bottom - 1) / TILE);
        const myX0 = Math.floor(body.x / TILE), myX1 = Math.floor((body.right - 1) / TILE);
        const free = (x, y) => this.blockAt(x, y) === Block.Air;
        if (!free(ax, footY) && free(ax, footY - 1) && free(ax, footY - 2) &&
            free(myX0, footY - 2) && free(myX1, footY - 2)) {
          this.astronaut.y -= TILE + 2;
          this.astronaut.x += dir * 3;
        }
      }
      if ((JustDown(k.SPACE) || JustDown(k.W) || (!this.coop && JustDown(k.UP))) && grounded) {
        this.astronaut.setVelocityY(-JUMP_SPEED);
        this.dustBurst(this.astronaut.x, this.astronaut.y + 27, Block.Regolith);
        this.juice.pulse(-0.12);
      }

      // animação
      const a = this.astronaut;
      const L = this.look;
      if (this.walk) {
        if (this.time.now < (this.swingUntil || 0)) { L.anims.stop(); L.setFrame(5); }
        else if (!grounded) { L.anims.stop(); L.setFrame(4); }
        else if (moving) { L.play(`walk_${this.crew}`, true); L.anims.timeScale = sprint ? 1.5 : 1; }
        else { L.anims.stop(); L.setFrame(0); }
      }
      this.lookOff = this.juice.apply(L, this.lookBase, { grounded, moving, sprint, vy: body.velocity.y, dir: left ? -1 : 1, sheet: !!this.walk }, dt);
      if (sprint && grounded) {
        this.footstepTime += dt;
        if (this.footstepTime > 0.42) { this.footstepTime = 0; this.dustBurst(a.x, a.y + 27, Block.Regolith); }
      }

      // status: fôlego, oxigênio e vida
      this.stamina = sprint ? Math.max(0, this.stamina - 18 * dt) : Math.min(100, this.stamina + 12 * this.perk.staminaRegen * dt);
      this.oxygen = Math.max(0, this.oxygen - dt * 0.25 * this.quest.o2 * this.perk.o2Rate * (sprint ? 1.6 : 1));
      if (this.oxygen === 0) this.hurt(6 * dt, `Ran out of oxygen ${Math.round(Math.abs(a.x - this.landerX) / TILE)} m from the lander.`);
      else if (this.perk.regen) this.hp = Math.min(this.perk.hpMax, this.hp + this.perk.regen * dt);
      if (this.ended) return;

      // progresso de profundidade e distância
      const surface = this.heights[LANDING_X];
      this.maxDepth = Math.max(this.maxDepth, body.bottom / TILE - surface);
      this.maxDist = Math.max(this.maxDist, Math.abs(a.x - this.landerX) / TILE);
      // marcos de 10 m: chance de um mini game de ciência
      const mark = Math.floor((this.quest.type === "distance" ? this.maxDist : this.maxDepth) / 10);
      if (mark > (this.lastMark || 0)) { this.lastMark = mark; if (this.hooks.onQuestEvent) this.hooks.onQuestEvent(this.quest.type === "distance" ? "distance" : "depth"); }

      const pointer = this.input.activePointer;
      if (pointer.isDown && this.time.now - this.miningTime > Math.max(this.perk.mineCd + 35, 110)) this.useTool(pointer);

      // realça o bloco apontado; vermelho se estiver fora do alcance
      this.reticle.clear();
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      if (this.inside(tx, ty)) {
        const distance = Phaser.Math.Distance.Between(a.x, a.y, tx * TILE + 16, ty * TILE + 16);
        this.reticle.lineStyle(4, distance <= REACH ? 0x2fd3e0 : 0xf0483c, 0.9).strokeRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
      }

      for (const s of this.samples) {
        if (!s.collected) s.sprite.setAlpha(Math.sin(this.time.now * 0.004 + s.x) > -0.4 ? 1 : 0.55);
      }
      this.uiTime += dt;
      if (this.uiTime >= 0.15) {
        this.uiTime = 0;
        this.pushStats();
      }
    }
  }

  // =====================================================================
  // Interior da nave: o tripulante anda pelo convés e usa as estações (E).
  // Modo "space": a caminho (cabine abre o mapa). Modo "planet": pousado
  // (câmara de ar sai para o planeta, cabine decola, console aborta).
  // =====================================================================
  // convés desenhado (ship_deck.jpg, 1792 x 592) ampliado 1,3x
  const DECK_S = 1.3;
  const SHIP_W = Math.round(1792 * DECK_S);
  const FLOOR = Math.round(497 * DECK_S);
  const CREW_H = 140;
  const D = (v) => Math.round(v * DECK_S); // coordenada da imagem -> mundo

  class ShipScene extends Phaser.Scene {
    constructor() {
      super("ShipScene");
    }

    init(data) {
      this.hooks = window.HW_MOON || {};
      this.mode = (data && data.mode) || "space";
      this.info = (data && data.info) || {};
      this.team = this.hooks.team && this.hooks.team.length ? this.hooks.team : [this.hooks.crew || "green"];
      this.crew = this.info.crew || this.hooks.crew || this.team[0];
      if (!this.team.includes(this.crew)) this.crew = this.team[0];
      this.vy = 0;
      this.py = FLOOR;
      this.abortArmed = 0;
    }

    preload() {
      const skyKey = this.mode === "planet" ? WORLDS[this.hooks.world === "mars" ? "mars" : "moon"].sky : null;
      this.load.image(`shipsky_${skyKey || "space"}`, skyKey ? `assets/${skyKey}.jpg` : "assets/bg_sky.jpg");
      this.skyKey = `shipsky_${skyKey || "space"}`;
      for (const id of this.team) {
        const w = WALK[id];
        if (w) this.load.spritesheet(`astro_${id}`, `assets/walk_${id}.png`, { frameWidth: w.w, frameHeight: w.h });
        else this.load.image(`astro_${id}`, `assets/astro_${id}.png`);
        this.load.image(`front_${id}`, `assets/astro_${id}.png`);
      }
      this.load.spritesheet("robot", "assets/robot_sheet.png", { frameWidth: 219, frameHeight: 224 });
      for (const k of ["d_poster", "d_screen", "toy_kangaroo", "toy_bull", "d_plant", "d_alarm"]) this.load.image(k, `assets/${k}.png`);
      this.load.image("ship_deck", "assets/ship_deck.jpg");
    }

    create() {
      this.cameras.main.setBackgroundColor("#070b18");
      this.drawShip();
      this.placeCrew();
      this.createPlayer();
      this.prompt = this.add.text(0, 0, "", {
        fontFamily: '"Silkscreen", monospace', fontSize: "18px", color: "#ffffff",
        backgroundColor: "#0d1836", padding: { x: 10, y: 6 },
      }).setOrigin(0.5, 1).setDepth(60).setVisible(false);
      this.keys = this.input.keyboard.addKeys("A,D,LEFT,RIGHT,SPACE,W,UP,SHIFT");
      this.input.keyboard.on("keydown-E", () => this.use());
      this.input.keyboard.on("keydown-F", () => this.use());
      this.cameras.main.setBounds(0, 0, SHIP_W, Math.min(768, Math.round(592 * DECK_S)));
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      this.say(this.mode === "planet"
        ? "Inside the lander. Walk to the airlock (left) to go outside."
        : "Cruising. Walk to the cockpit (right) to open the star map.");
    }

    say(t) { if (this.hooks.onMessage) this.hooks.onMessage(t); }

    // ---------- convés: a arte desenhada + objetos por cima ----------
    drawShip() {
      this.add.image(0, 0, "ship_deck").setOrigin(0).setScale(DECK_S).setDepth(0);
      const put = (k, x, y, h, depth = 2) => {
        const img = this.add.image(x, y, k).setOrigin(0.5, 1).setDepth(depth);
        img.setScale(h / img.height);
        return img;
      };
      // Animal Kombat: pôster na parede e bonecos no beliche de cima
      put("d_poster", D(688), D(248), 150);
      put("toy_kangaroo", D(860), D(268), 56, 3);
      put("toy_bull", D(905), D(268), 58, 3);
      // vida a bordo
      put("d_plant", D(1180), D(305), 70);
      put("d_alarm", D(175), D(190), 34);
      // terminal do mini game Órbita Flight Lab
      this.arcade = put("d_screen", D(1100), D(292), 78, 3);
      this.add.text(D(1100), D(292) - 90, "FLIGHT LAB", { fontFamily: '"Silkscreen", monospace', fontSize: "13px", color: "#3fe6ee" }).setOrigin(0.5).setDepth(4);
      // folha: 0 parado, 1 piscando, 2-3 rodando, 4 pulinho, 5 surpreso. Desenho olha para a esquerda.
      this.robot = this.add.sprite(D(460), FLOOR + 2, "robot", 0).setOrigin(0.5, 1).setDepth(25).setScale(60 / 200).setFlipX(true);
      this.robotDir = 1;
      this.rb = { base: this.robot.scaleX, y: this.robot.y, v: 0, state: "move", t: 3, clock: 0, sq: 0, greeted: false };
      this.robotBeep = this.add.text(0, 0, "♪", { fontFamily: "monospace", fontSize: "26px", color: "#7ff", stroke: "#023", strokeThickness: 4 }).setOrigin(0.5).setDepth(60).setVisible(false);

      const P = this.mode === "planet";
      // estações (x = onde o jogador para)
      this.stations = [
        { x: D(175), text: P ? "E: Go outside" : "Airlock sealed in space", act: "airlock" },
        { x: D(440), text: P ? "E: Abort mission" : "E: Mission log", act: "console" },
        { x: D(560), text: "E: Med bay (heal)", act: "heal" },
        { x: D(688), text: "E: Look at the poster", act: "poster" },
        { x: D(882), text: "E: Animal Kombat figures", act: "figure" },
        { x: D(1240), text: "E: Refill oxygen", act: "o2" },
        { x: D(1100), text: "E: Play Órbita Flight Lab", act: "arcade" },
        { x: D(1560), text: P ? "E: Lift off" : "E: Star map", act: "cockpit" },
      ];
      const label = (t, x, y, c) => this.add.text(x, y, t, { fontFamily: '"Silkscreen", monospace', fontSize: "16px", color: c, backgroundColor: "#0b1226cc", padding: { x: 6, y: 2 } }).setOrigin(0.5).setDepth(4);
      label("AIRLOCK", D(175), D(95), "#ffd28a");
      label("MED BAY", D(530), D(95), "#ffd28a");
      label("CREW QUARTERS", D(880), D(95), "#ffd28a");
      label("STORAGE", D(1210), D(95), "#ffd28a");
      label("COCKPIT", D(1570), D(95), "#3fe6ee");
    }

    frontSprite(id, x) {
      const img = this.add.image(x, FLOOR + 2, `front_${id}`).setOrigin(0.5, 1).setDepth(20);
      img.setScale(CREW_H / (img.height * (BODY_FRAC[id] || 1)));
      return img;
    }

    // os outros tripulantes ficam nos beliches; E perto de um troca quem está no controle
    placeCrew() {
      this.idle = [];
      const spots = [D(780), D(840), D(1000), D(1060)];
      let i = 0;
      for (const id of this.team) {
        if (id === this.crew) continue;
        const x = spots[i++ % spots.length];
        this.idle.push(this.makeMate(id, x));
      }
    }

    // tripulante que passeia sozinho pela cabine: anda até um ponto, para, olha em volta, segue
    makeMate(id, x) {
      const w = WALK[id];
      const img = this.add.sprite(x, FLOOR + 2, `astro_${id}`, w ? 0 : undefined).setOrigin(0.5, 1).setDepth(20);
      if (w && !this.anims.exists(`walk_${id}`)) {
        this.anims.create({ key: `walk_${id}`, frames: this.anims.generateFrameNumbers(`astro_${id}`, { frames: [1, 2, 3, 2] }), frameRate: 8, repeat: -1 });
      }
      const base = CREW_H / ((w ? w.body : img.frame.height) * (BODY_FRAC[id] || 1));
      img.setScale(base).setFlipX(Math.random() < 0.5);
      return { id, x, img, base, walk: w, juice: new Juice(), wait: 0.5 + Math.random() * 3, target: null, speed: 70 + Math.random() * 40 };
    }

    animMates(dt) {
      for (const m of this.idle) {
        const p = this.player;
        const near = Math.abs(p.x - m.x) < D(70);
        let moving = false;
        if (near) {
          // para e olha para quem está jogando (dá para trocar com E)
          m.target = null; m.wait = Math.max(m.wait, 0.8);
          m.img.setFlipX(p.x < m.x);
        } else if (m.target != null) {
          const d = m.target - m.x;
          if (Math.abs(d) < 4) { m.target = null; m.wait = 1.5 + Math.random() * 4; }
          else { m.x += Math.sign(d) * Math.min(Math.abs(d), m.speed * dt); m.img.setFlipX(d < 0); moving = true; }
        } else if ((m.wait -= dt) <= 0) {
          // escolhe um lugar novo, sem grudar em outro tripulante
          let t, tries = 0;
          do { t = D(200) + Math.random() * D(1400); tries++; } while (tries < 6 && this.idle.some((o) => o !== m && Math.abs((o.target ?? o.x) - t) < D(90)));
          m.target = t;
        }
        if (m.walk) {
          if (moving) m.img.play(`walk_${m.id}`, true);
          else { m.img.anims.stop(); m.img.setFrame(0); }
        }
        const off = m.juice.apply(m.img, m.base, { grounded: true, moving, sprint: false, vy: 0, dir: m.img.flipX ? -1 : 1, sheet: !!m.walk }, dt);
        m.img.setPosition(m.x, FLOOR + 2 + off);
      }
    }

    createPlayer() {
      const startX = this.mode === "planet" ? D(300) : D(1450);
      this.player = this.add.sprite(startX, FLOOR + 2, `astro_${this.crew}`).setOrigin(0.5, 1).setDepth(30);
      this.setCrew(this.crew);
    }

    setCrew(id) {
      this.crew = id;
      this.walk = WALK[id] || null;
      const p = this.player;
      p.anims.stop();
      p.setTexture(`astro_${id}`, this.walk ? 0 : undefined);
      if (this.walk && !this.anims.exists(`walk_${id}`)) {
        this.anims.create({ key: `walk_${id}`, frames: this.anims.generateFrameNumbers(`astro_${id}`, { frames: [1, 2, 3, 2] }), frameRate: 8, repeat: -1 });
      }
      const base = this.walk ? this.walk.body : p.frame.height;
      this.pBase = CREW_H / (base * (BODY_FRAC[id] || 1));
      p.setScale(this.pBase);
      p.setAngle(0);
      if (!this.juice) this.juice = new Juice();
      this.juice.pulse(0.15); // "chega" no lugar ao trocar de tripulante
    }

    nearest() {
      const x = this.player.x;
      const crew = this.idle.find((c) => Math.abs(c.x - x) < 34);
      if (crew) return { crew };
      const st = this.stations.find((s) => Math.abs(s.x - x) < 60);
      return st ? { st } : null;
    }

    use() {
      const n = this.nearest();
      if (!n) return;
      const h = this.hooks;
      if (n.crew) {
        // troca: o atual fica no beliche, o escolhido assume
        const old = this.crew;
        const i = this.idle.indexOf(n.crew);
        n.crew.img.destroy();
        const nx = n.crew.x, px = this.player.x;
        this.setCrew(n.crew.id);
        // trocam de lugar: você assume o corpo dele e o antigo fica onde você estava
        this.player.x = nx;
        this.idle[i] = this.makeMate(old, px);
        this.idle[i].wait = 1.5;
        if (h.onCrewChange) h.onCrewChange(this.crew);
        this.say("You are now in control of another crew member.");
        return;
      }
      const P = this.mode === "planet";
      const a = n.st.act;
      if (a === "airlock") {
        if (!P) return this.say("The airlock stays sealed in space. Land first.");
        if (h.onAirlock) h.onAirlock(this.crew);
      } else if (a === "heal") {
        const moon = this.scene.get("MoonScene");
        if (P && moon && moon.heal) moon.heal(this.crew);
        this.say("Patched up: health back to full.");
      } else if (a === "poster") {
        this.say("ANIMAL KOMBAT: Kangaroo vs. Bull. The crew's favorite fighting game, signed by the developer.");
      } else if (a === "figure") {
        const lines = ["Kangaroo and Bull figures, limited Animal Kombat edition.", "The bull figure stares back. \"You call that a punch?\"", "Someone taped a note to them: \"Rematch when we get home.\""];
        this.figN = ((this.figN || 0) + 1) % lines.length;
        this.say(lines[this.figN]);
      } else if (a === "arcade") {
        if (h.onArcade) h.onArcade();
      } else if (a === "o2") {
        this.say("Suit tanks full. Oxygen refills every time you go out.");
      } else if (a === "console") {
        if (!P) return this.say("Mission log: choose a planet in the cockpit, then land.");
        if (this.time.now - this.abortArmed < 3000) { if (h.onStation) h.onStation("abort"); return; }
        this.abortArmed = this.time.now;
        this.say("Abort the mission? You lose the rocket and get no reward. Press E again to confirm.");
      } else if (a === "cockpit") {
        if (!P) { if (h.onStation) h.onStation("map"); return; }
        if (!this.info.questDone) return this.say(`Quest not done yet (${this.info.have || 0}/${this.info.need || "?"}). Go outside and finish it.`);
        if (h.onStation) h.onStation("liftoff");
      }
    }

    // robozinho de limpeza: acelera, freia, para e olha em volta, flutua,
    // e quando o tripulante chega perto ele vira, dá um pulinho e apita
    animRobot(dt) {
      const r = this.robot, b = this.rb, p = this.player;
      b.clock += dt; b.t -= dt;
      const near = p && Math.abs(p.x - r.x) < D(150);
      if (near && !b.greeted) {
        b.greeted = true; b.state = "greet"; b.t = 1.4;
        this.robotDir = p.x < r.x ? -1 : 1; r.setFlipX(this.robotDir > 0);
        b.sq = -0.18; b.hop = 1;
        this.robotBeep.setText(Phaser.Utils.Array.GetRandom(["♪", "!", "♥", "bip"])).setVisible(true).setAlpha(1);
      }
      if (!near && Math.abs(p.x - r.x) > D(260)) b.greeted = false;
      if (b.state === "move") {
        b.v = Math.min(1, b.v + dt * 1.5);
        if (b.t <= 0) { b.state = "stop"; b.t = 1.2 + Math.random() * 1.6; }
      } else {
        b.v = Math.max(0, b.v - dt * 3);
        if (b.state === "stop" && b.t < 0.8 && !b.looked) { b.looked = true; r.setFlipX(!r.flipX); }
        if (b.t <= 0) { if (b.looked) r.setFlipX(this.robotDir > 0); b.looked = false; b.state = "move"; b.t = 2.5 + Math.random() * 3; }
      }
      r.x += this.robotDir * 55 * b.v * dt;
      if (r.x > D(1130) || r.x < D(320)) { r.x = Phaser.Math.Clamp(r.x, D(320), D(1130)); this.robotDir *= -1; r.setFlipX(this.robotDir > 0); b.sq = 0.12; }
      // pulinho de cumprimento
      b.hop = Math.max(0, (b.hop || 0) - dt * 2.2);
      const hopY = Math.sin(b.hop * Math.PI) * D(26);
      if (b.hop > 0 && b.hop < 0.05) b.sq = 0.15;
      // flutuar + balanço do motor
      const hover = Math.sin(b.clock * 3.2) * D(3);
      b.sq *= Math.exp(-dt * 9);
      const breathe = Math.sin(b.clock * 6) * 0.015;
      r.setScale(b.base * (1 + b.sq * 0.8 - breathe), b.base * (1 - b.sq + breathe));
      r.y = b.y - Math.abs(hover) - hopY;
      // inclina na direção do movimento (acelerando / freando)
      const lean = this.robotDir * b.v * 7 * (b.state === "move" ? 1 : -0.6);
      r.setAngle(lean + Math.sin(b.clock * 2.1) * 1.5);
      if (this.robotBeep.visible) {
        this.robotBeep.setPosition(r.x, r.y - r.displayHeight - D(12) - (1.4 - b.t) * D(20));
        this.robotBeep.setAlpha(Math.max(0, b.t / 1.4));
        if (b.state !== "greet" || b.t <= 0) this.robotBeep.setVisible(false);
      }
      // quadro da folha conforme o que ele está fazendo
      let f;
      if (b.state === "greet") f = b.hop > 0 ? 4 : 5;
      else if (b.v > 0.15) f = Math.floor(b.clock * (6 + 6 * b.v)) % 2 ? 3 : 2;
      else f = b.clock % 3.1 < 0.14 ? 1 : 0; // pisca de vez em quando
      r.setFrame(f);
      if (b.state === "greet" && b.t <= 0) { b.state = "move"; b.t = 2; }
    }

    update(_t, dms) {
      const dt = Math.min(0.05, dms / 1000);
      if (this.arcade) this.arcade.setAlpha(Math.floor(this.time.now / 500) % 2 ? 1 : 0.85);
      // o robozinho de limpeza passeia pelo convés
      if (this.robot) this.animRobot(dt);
      if (this.idle) this.animMates(dt);
      const k = this.keys;
      const left = k.A.isDown || k.LEFT.isDown, right = k.D.isDown || k.RIGHT.isDown;
      const moving = left !== right;
      const sp = k.SHIFT.isDown ? 260 : 180;
      const p = this.player;
      if (moving) { p.x = Phaser.Math.Clamp(p.x + (left ? -sp : sp) * dt, D(130), D(1640)); p.setFlipX(left); }
      // pulinho (gravidade artificial)
      const Jd = Phaser.Input.Keyboard.JustDown;
      if ((Jd(k.SPACE) || Jd(k.W) || Jd(k.UP)) && this.py >= FLOOR) { this.vy = -360; this.juice.pulse(-0.12); }
      const wasAir = this.py < FLOOR;
      this.vy += 1100 * dt;
      this.py = Math.min(FLOOR, this.py + this.vy * dt);
      if (this.py >= FLOOR) { if (wasAir) this.juice.pulse(0.14); this.vy = 0; }
      const grounded = this.py >= FLOOR;
      if (this.walk) {
        if (!grounded) { p.anims.stop(); p.setFrame(4); }
        else if (moving) { p.play(`walk_${this.crew}`, true); p.anims.timeScale = sp > 200 ? 1.5 : 1; }
        else { p.anims.stop(); p.setFrame(0); }
      }
      const off = this.juice.apply(p, this.pBase, { grounded, moving, sprint: sp > 200, vy: this.vy, dir: left ? -1 : 1, sheet: !!this.walk }, dt);
      p.y = this.py + 2 + off;

      const n = this.nearest();
      if (n) {
        const x = n.crew ? n.crew.x : n.st.x;
        this.prompt.setText(n.crew ? "E: Switch to this crew member" : n.st.text).setPosition(x, FLOOR - CREW_H - 18).setVisible(true);
      } else this.prompt.setVisible(false);
    }
  }

  // ---- ponte com as telas (game.js) ----
  let game = null;
  function boot(parentId) {
    return new Phaser.Game({
      // aberto direto do disco (file://), o WebGL recusa as imagens; o canvas 2D aceita
      type: location.protocol === "file:" ? Phaser.CANVAS : Phaser.AUTO,
      parent: parentId,
      width: 1376,
      height: 768,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: "#03050d",
      banner: false,
      audio: { noAudio: true },
      loader: { imageLoadType: "HTMLImageElement" },
      scale: { mode: Phaser.Scale.NONE },
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
      scene: [],
    });
  }
  const KEYS = ["MoonScene", "ShipScene"];

  window.HelloMoon = {
    // pouso: cria o planeta e começa dentro da nave
    start(parentId, hooks) {
      this.stop();
      window.HW_MOON = Object.assign({ startInShip: true }, hooks);
      game = boot(parentId);
      game.scene.add("ShipScene", ShipScene, false);
      game.scene.add("MoonScene", MoonScene, true);
    },
    // a caminho: só o interior da nave
    startShip(parentId, hooks) {
      this.stop();
      window.HW_MOON = hooks;
      game = boot(parentId);
      game.scene.add("ShipScene", ShipScene, true, { mode: "space" });
    },
    openShip(info) {
      if (!game) return;
      game.scene.sleep("MoonScene");
      if (game.scene.isActive("ShipScene") || game.scene.isSleeping("ShipScene")) game.scene.stop("ShipScene");
      game.scene.run("ShipScene", { mode: "planet", info });
    },
    pause(on) {
      if (!game) return;
      for (const k of KEYS) {
        if (!game.scene.getScene(k)) continue;
        if (on && game.scene.isActive(k)) game.scene.pause(k);
        else if (!on && game.scene.isPaused(k)) game.scene.resume(k);
      }
    },
    refresh() {
      if (game) game.scale.refresh();
    },
    exitLander(id) {
      if (!game) return;
      if (game.scene.getScene("ShipScene") && game.scene.isActive("ShipScene")) game.scene.stop("ShipScene");
      game.scene.wake("MoonScene");
      const s = game.scene.getScene("MoonScene");
      if (s) s.exitLander(id);
    },
    liftOff() {
      const s = game && game.scene.getScene("MoonScene");
      if (s) s.liftOff();
    },
    _ship() {
      return game ? game.scene.getScene("ShipScene") : null;
    },
    // usado só nos testes automáticos
    _scene() {
      return game ? game.scene.getScene("MoonScene") : null;
    },
    stop() {
      if (game) { game.destroy(true); game = null; }
    },
  };
})();
