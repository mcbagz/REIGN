Development Roadmap: Carcassonne: War of Ages

1. Project Overview

- Objective: Build a web-based, real-time strategy/tile-laying game combining Carcassonne’s tile placement with Age of Empires’ conquest-driven RTS mechanics, as detailed in the GDD.
- Tech Stack:
    - Frontend: PixiJS (lightweight 2D rendering for static site).
    - Backend: FastAPI with websockets for game logic, state management, and multiplayer.
    - Hosting: Static site for frontend (e.g., Netlify, Vercel), FastAPI server on a cloud provider (e.g., AWS, DigitalOcean).
    - Other Tools: Git for version control, WebSocket (via FastAPI) for real-time multiplayer.
- Deliverables: A fully functional multiplayer game with 2–4 player support, AI opponents, and polished UI/UX, hosted on a static site with a FastAPI backend.

---

2. Development Phases

Phase 1: Setup and Planning
Goal: Establish project infrastructure, finalize tools, and create a development plan.

- Tasks:
    - Environment Setup:
        - Set up a Git repository (e.g., GitHub) for version control.
        - Initialize a PixiJS project using a bundler (e.g., Vite for fast builds).
        - Deploy a FastAPI server instance (local for development, cloud for testing).
    - Asset Planning:
        - Design a sprite sheet for tiles (capital city, city, marsh, field, monastery, mine, orchard, barracks, watchtower) in a stylized 2D medieval aesthetic.
        - Create placeholder sprites for units (infantry, archer, knight, catapult) and workers (magistrate, farmer, monk).
        - Plan audio assets: background music (medieval theme), sound effects (tile placement, combat, building).
    - Architecture Design:
        - Define data structures for tiles (JSON: type, edges, HP, worker, resources), units (HP, attack, speed), and game state (player resources, map grid).
        - Plan FastAPI integration: real-time WebSocket for tile placement, unit movement, and combat; Python for game logic (e.g., resource generation, combat resolution).
        - Outline client-server communication: client sends tile placement/unit commands, server validates and broadcasts updates.
    - UI/UX Mockup:
        - Create wireframes for the game UI: map view, resource bar, tile selection pop-up, unit control panel, tech menu.
        - Design a clean, intuitive layout with zoom/pan functionality and highlighted tile placement zones.
- Dependencies:
    - PixiJS (v7.x), Python (3.12+).
    - Graphics editor (e.g., Aseprite for sprites, Adobe XD/Figma for UI).
    - Audio tools (e.g., Audacity for sound effects).
- Deliverables:
    - Initialized project repository with PixiJS and FastAPI setup.
    - Sprite sheet draft and UI wireframes.
    - Technical architecture document (data structures, client-server flow).

---

Phase 2: Core Mechanics Implementation
Goal: Build the foundational gameplay mechanics (tile placement, resource management, unit movement) for a single-player prototype.

- Tasks:
    - Tile System:
        - Implement a 40x40 tile grid using PixiJS, rendering tiles as sprites.
        - Code tile placement logic: every 15 seconds, present three tile options (JSON data), allow player to select and place with relaxed connection rules (must touch one tile, no strict edge matching).
        - Enable banking up to three placements (queue system).
        - Add starting setup: four capital city tiles in separate quadrants, 15–25 scattered resource tiles (mines, orchards), and 10 marshes.
        - Store tile state (type, HP, worker, resources) in client-side memory, synced to FastAPI later.
    - Resource Management:
        - Implement real-time resource generation (gold, food, faith) based on tile types and workers (e.g., city with magistrate: 1 gold/second/tile).
        - Create resource UI: display counters for each resource (cap: 500).
        - Code scattered resource tiles (mines: 2 gold/second, orchards: 2 food/second).
        - Tiles that share an edge add to resource production and only require a single worker. If three city tiles are connected, a single magistrate placed in any of the tiles gives resource production of 3 gold/second. The additive effect applies to fields, cities, and monasteries. Resource tiles do not need a worker on them to produce resources; they simply need to be claimed as a player's territory.
    - Worker System:
        - Allow players to place/recall workers (5 per player) as magistrates, farmers, or monks.
        - Implement worker effects (e.g., magistrates enable city gold production, farmers enable fields to produce food).
        - Add recall delay (10 seconds).
    - Unit Movement and Combat:
        - Render units as sprites with stats (HP, attack, speed) from the GDD.
        - Implement real-time movement (1 tile/second, slower on marshes) using PixiJS’s animation system.
        - Code basic combat: auto-attack within range (1 tile for melee, 2 for archers/siege), with rock-paper-scissors dynamics (infantry > archers > knights > infantry, siege > buildings).
        - Add unit training at cities/barracks (costing gold/food, 10–20s delay).
    - Basic UI:
        - Build a clickable map with zoom/pan (PixiJS viewport plugin).
        - Add a resource bar, tile selection pop-up (three options every 15s), and unit control (click-to-move, right-click rally points).
- Dependencies:
    - Phase 1 assets (placeholder sprites, UI wireframes).
    - PixiJS viewport plugin for map navigation.
- Deliverables:
    - Single-player prototype with tile placement, resource generation, worker management, and basic unit movement/combat.
    - Functional UI for map interaction and resource tracking.

---

Phase 3: Multiplayer and Server Integration
Goal: Add multiplayer functionality (2–4 players) using FastAPI with websockets and refine gameplay with combat and conquest mechanics.

- Tasks:
    - FastAPI Setup:
        - Configure FastAPI server for game logic.
        - Implement WebSocket communication: client sends tile placement/unit commands, server validates (e.g., checks tile connection, resource costs).
        - Sync game state (tiles, units, resources) across clients in real-time.
        - Add match-making for 2–4 player games.
    - Multiplayer Mechanics:
        - Synchronize tile placement (15s cycle, 60s for 4 players, 45s for 3 players, etc).
        - Handle stored placements: queue up to three actions per player, processed via FastAPI.
        - Implement combat across players: server resolves attacks, broadcasts damage/HP updates.
        - Add raiding (steal 10% of tile resources) and tile capture (unclaimed tiles or after defeating defenders).
    - Conquest Mechanics (1.5 weeks):
        - Code capital city destruction (1000 HP, siege units deal bonus damage).
        - Implement victory condition: eliminate all rivals by destroying their capitals.
        - Add elimination logic: remove player from game, adjust tile placement cycle (e.g., 45s for 3 players).
    - Watchtowers:
        - Add watchtower functionality: boost nearby unit defense (+25%).
    - Polish UI (1 week):
        - Refine tile selection pop-up with animated transitions.
        - Add unit control panel for selecting and issuing commands (move, attack, rally).
        - Display opponent actions (e.g., “Player 2 placed a city”).
- Dependencies:
    - Phase 2 prototype.
    - FastAPI server running (local or cloud).
- Deliverables:
    - Multiplayer prototype supporting 2–4 players with synced tile placement, combat, and victory conditions.
    - Functional watchtower mechanics.
    - Updated UI with multiplayer feedback.

---

Phase 4: Tech Tree and Progression 
Goal: Implement the Manor -> Duchy -> Kingdom progression, tech upgrades, and special abilities.

- Tasks:
    - Progression System:
        - Implement progression costs (Manor -> Duchy: 200 gold, 100 food, 100 stone; Duchy -> Kingdom: 400 gold, 200 food, 200 stone).
        - Unlock new units/tiles per level:
            - Manor: Infantry, Archer, City, Marsh, Field, Monastery.
            - Duchy: Knight, Barracks, Watchtower.
            - Kingdom: Catapult, Mine, Orchard.
    - Tech Upgrades:
        - Add tech menu (accessible via city/monastery clicks).
        - Implement upgrades:
            - Military: Fast Training (–20% time), Elite Units (+20% attack/HP).
            - Economic: Improved Yield (+50% resources), Resource Storage (+200 cap).
            - Defensive: Fortified Walls (+200 HP), Tower Network (+30% defense).
        - Code monastery abilities: Heal (50% HP, 50 faith), Inspire (+50% attack, 75 faith).
    - Balance Testing:
        - Test progression pacing: ensure Manor -> Duchy takes ~5–7 minutes, Duchy -> Kingdom ~10–15 minutes.
        - Adjust resource costs and upgrade effects for balance (e.g., elite units not overpowering).
- Dependencies:
    - Phase 3 multiplayer prototype.
    - Finalized sprite sheets for new units/tiles.
- Deliverables:
    - Fully implemented Manor -> Duchy -> Kingdom progression.
    - Functional tech tree and monastery abilities.
    - Balanced gameplay metrics.

---

Phase 5: AI and Polish 
Goal: Add AI opponents, polish visuals/audio, and optimize performance.

- Tasks:
    - AI Opponents:
        - Implement basic AI: prioritizes resource tiles early, shifts to aggression in Duchy/Kingdom phases.
        - Code AI behaviors: place tiles to maximize resources, train balanced units, attack weakest player’s tiles.
        - Allow AI to fill empty player slots in multiplayer games.
    - Visual Polish:
        - Replace placeholder sprites with final assets (tiles, units, workers).
        - Add animations: tile placement (fade-in), unit movement (smooth transitions), combat (attack effects).
        - Implement UI polish: animated resource counters, glowing valid tile placements.
    - Audio Integration:
        - Add medieval background music (looping, low-volume).
        - Implement sound effects: tile placement (click), unit training (hammer), combat (swords, arrows).
    - Performance Optimization:
        - Optimize PixiJS rendering: use sprite sheets, limit draw calls.
        - Cap units at 50 per player to prevent lag.
        - Test on low-end browsers (e.g., Chrome on budget laptops).
- Dependencies:
    - Phase 4 progression system.
    - Finalized art/audio assets.
- Deliverables:
    - Functional AI opponents for solo/multiplayer games.
    - Polished visuals and audio.
    - Optimized game running smoothly on modern browsers.

---

4. Developer Guidance

- Priorities:
    - Focus on core mechanics (tile placement, resources) first to validate gameplay feel.
    - Ensure FastAPI sync is robust to prevent multiplayer desyncs.
    - Keep PixiJS lightweight: optimize sprites and limit units to maintain performance.
- Resources:
    - PixiJS: Official docs (pixijs.com), tutorials (e.g., “PixiJS Game Development” on YouTube).
    - Assets: Use Aseprite for sprites, Audacity for audio, or license assets from marketplaces (e.g., itch.io, OpenGameArt).
- Testing Tips:
    - Test tile placement cycle (15s, three options) with friends to ensure intuitive pacing.
    - Simulate multiplayer lag by throttling network to verify FastAPI performance.
    - Playtest AI to ensure it’s challenging but not overwhelming.
