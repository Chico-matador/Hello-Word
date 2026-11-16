# HELLO WORLD — A Pixel Space Mission

> Build a rocket part by part, pick your crew, fly it to orbit yourself and explore the Moon and Mars.
> A pixel-art space game about real spaceflight and planetary science, made for the **NASA Space Apps Challenge**.

🎬 **Trailer (30 s):** _add your public link here_
🎮 **Play online:** _add your public link here_

---

## Table of contents

1. [About the game](#about-the-game)
2. [How to run](#how-to-run)
3. [Game loop](#game-loop)
4. [Controls](#controls)
5. [Game modes](#game-modes)
6. [Science inside the game](#science-inside-the-game)
7. [Project structure](#project-structure)
8. [Technology](#technology)
9. [Credits](#credits)

---

## About the game

**HELLO WORLD** turns the path of a real space mission into a game:

- 🧩 **Build** your rocket step by step, like a LEGO instruction manual.
- 👩‍🚀 **Choose** a crew of astronauts, each with their own perk.
- 🚀 **Pilot** the ascent: climb, make a gravity turn and reach orbital speed.
- 🛰️ **Live** in orbit: walk around your ship with the crew and pick a destination.
- 🌙 **Explore** the Moon and Mars in a sandbox world: dig, mine and collect samples.
- 🔬 **Analyze** what you find with mini games inspired by real NASA rover instruments.
- 🔁 **Continue** in the same rocket to the next world, or fly back home.

---

## How to run

No install, no build step.

**Option 1: open the file**
Unzip and open `index.html` in Chrome, Edge or Firefox.

**Option 2: local server (recommended)**
The *Órbita Flight Lab* terminal inside the ship only works over HTTP:

```bash
cd pixel
python -m http.server 8000
# then open http://localhost:8000
```

> Music starts after your first click or key press (browsers block autoplay).

---

## Game loop

```
Menu → Choose a rocket → Build it → Choose crew → Pilot to orbit
     → Ship in orbit → Cockpit: pick Moon or Mars → Land
     → Explore & complete the quest (+ science mini games)
     → Lift off → Continue in this rocket  ⟲   or   Back to Earth
```

### 1. Rocket assembly
Three models with different routes and costs:

| Model | Steps | Reaches |
|---|---|---|
| **Lunar Hopper** | 5 | Moon |
| **Explorer** | 11 | Moon or Mars |
| **Mars Heavy** | 12 | Moon and Mars |

Each step of the manual asks for one part (tanks, engines, interstage, boosters, fins, capsule…).
The panel shows **cost, Δv and liftoff thrust (TWR)** live, so you see how every choice changes the rocket.

### 2. Piloted ascent
The launch starts right on the pad with a 3-2-1 countdown.

- **Goal:** reach **80 km** altitude with **7.8 km/s** of sideways (orbital) speed.
- Go straight up through the thick air, then tilt slowly (~45° by 30 km) and lay the rocket flat.
- Turning too hard low in the atmosphere breaks the rocket; running out of fuel before orbit makes it fall back.
- Failing costs nothing: **Try again** or switch to **Autopilot**.
- On success the **“We’re in orbit!”** banner appears and you move into the ship.

### 3. Ship in orbit
Walk around the cabin. The crew wanders around on their own and a little cleaning robot rolls by.

- **Cockpit:** star map, choose your destination.
- **Crew:** walk up to a teammate and press **E** to play as them.
- **Terminal:** play the *Órbita Flight Lab* mini game.
- **Decorations:** *Animal Kombat* poster and toy figures.

### 4. Moon & Mars exploration
A Terraria-style sandbox world with its own quest:

- collect rock samples, mine impact glass or ice, dig to a target depth or trek a long distance;
- watch your **health, oxygen and stamina**;
- refill oxygen and get back in at the **lander** with **F**, then **Lift off** when the quest is done.

### 5. After the mission
- **Continue in this rocket:** back to orbit with the same crew to choose another world.
- **Back to Earth:** ends the flight (landing legs refund part of the cost).

---

## Controls

### Exploration (Moon / Mars)

| Action | Player 1 | Player 2 |
|---|---|---|
| Walk | A / D | ← / → |
| Jump | W / Space | ↑ |
| Run | Shift | — |
| Pick up sample | E | ↓ |
| Dig / mine | Left click | Enter (hold ↓ to dig down) |
| Place soil | Right click | — |
| Lander (get in / refill O₂) | F | goes in with P1 |

### Ship
| Action | Key |
|---|---|
| Walk | A / D |
| Jump | W / Space |
| Use station / switch crew | E |

### Ascent
| Action | Key |
|---|---|
| Engine | hold W / ↑ / Space (works during the countdown too) |
| Tilt | A / D or ← / → |

### Science mini games
Arrow keys / mouse, **Space** to mark a peak, **Enter** to analyze, **Esc** to leave.

---

## Game modes

Set them on the main menu:

| Button | What it does |
|---|---|
| **New Game** | Normal game with a limited budget. |
| **Creative Mode ∞** | Infinite budget; **any rocket flies**, even half-built, and reaches the Moon and Mars. |
| **Players: 1 / 2** | Local co-op: a second player joins on the same keyboard during exploration. |
| **Music: On / Off** | Toggles the soundtrack. |

Progress is saved automatically in the browser (`localStorage`). **Continue** picks up where you left off.

---

## Science inside the game

### Spaceflight
- **Δv and TWR** in the rocket builder: why bigger tanks and stronger engines matter.
- **Getting to orbit** is about going *sideways fast*, not just up. In the ascent, gravity weakens as your horizontal speed approaches orbital speed (≈ 7.8 km/s), and thick air punishes turning too early.

### NASA instrument mini games
They pop up at random during quests and are tied to what you are doing. A correct answer gives a **$15M science bonus**; skipping costs nothing.

| Trigger | Mini game | Inspired by |
|---|---|---|
| Picking up a sample | **MAHLI**: focus the hand lens and identify the mineral with a field guide | Mars Hand Lens Imager, Curiosity rover |
| Mining glass / ice | **CheMin**: sweep the X-ray detector, mark 3 diffraction peaks and match the mineral | CheMin X-ray diffraction, Curiosity rover (cobalt tube, λ = 1.789 Å, Bragg’s law nλ = 2d·sinθ) |
| Every 10 m of depth / distance | **ChemCam**: turn on elements until their emission lines match the laser spectrum | ChemCam laser-induced breakdown spectroscopy, Curiosity rover |

Minerals include plagioclase, olivine, ilmenite and impact glass (Moon) and water ice, hematite, olivine and clay (Mars).

> These mini games are simplified educational versions inspired by NASA instruments. HELLO WORLD is not an official NASA product.

---

## Project structure

```
pixel/
├── index.html        # all screens (menu, hangar, launch, ship, map, exploration…)
├── style.css         # pixel-art UI, animations, CRT scanlines
├── game.js           # game flow: economy, rocket builder, quests, ascent, music, saves
├── moon.js           # Phaser scenes: Moon/Mars exploration (MoonScene) and ship (ShipScene)
├── minigames.js      # MAHLI, CheMin and ChemCam science mini games
├── phaser.js         # Phaser game engine
├── assets/           # sprites, sprite sheets, backgrounds, music (m_*.mp3)
└── flightlab/        # Órbita Flight Lab mini game (ship terminal)
```

---

## Technology

- **JavaScript** for all game logic
- **HTML + CSS** for screens and pixel-art UI
- **Phaser** (canvas renderer, arcade physics) for exploration and the ship
- **Python** (offline only) to cut the generated art: background removal and sprite-sheet slicing
- Saves with browser `localStorage`; no server or account needed

---

## Credits

- **Game design & direction:** _your name / team_
- **Art:** generated from prompts written for the project, cut and animated into sprite sheets
- **Animal Kombat** (kangaroo vs bull): an original game by the author, referenced inside the ship
- **Órbita Flight Lab:** the author’s own mini game, included as the ship terminal
- **Music:**
  - “Weightless Journey” (menu)
  - “Celestial Latitude” (hangar)
  - “The Armada Approaches” (launch)
  - “Stellar Sonata” (orbit and map)
  - “The Seven Minute Egg Crisis” (exploration)

  _artist / source / license: fill in before publishing_
- **Science references:** NASA / JPL Mars Science Laboratory (Curiosity) instruments MAHLI, CheMin and ChemCam

Made for the **NASA Space Apps Challenge**. 🚀
