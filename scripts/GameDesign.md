Game Design Document: Carcassonne: War of Ages
1. Overview

- Genre: Real-Time Strategy (RTS) / Tile-Laying Hybrid
- Platform: Web-based (JavaScript, Pixi JS, static site)
- Target Audience: Fans of Carcassonne and Age of Empires, ages 13+, seeking strategic yet accessible multiplayer games
- Core Concept: Players build medieval empires by placing tiles to form cities, farms, and resource nodes, while managing resources and armies in real-time to conquer rivals. Victory is achieved by eliminating all opponents by capturing or destroying their capital city tiles.
- Unique Selling Points:
    - Combines Carcassonne’s intuitive tile-laying with Age of Empires’ real-time strategy and conquest.
    - Timed tile placement (every 15 seconds) with a choice of three tiles, allowing strategic flexibility and stored actions.
    - Separated starting areas and scattered resource tiles encourage strategic expansion before conflict.
    - Relaxed tile connection rules for accessibility while retaining territorial strategy.
- Victory Condition: Eliminate all rival players by capturing or destroying their capital city tiles.

---

2. Gameplay Mechanics
3. 2.1 Tile Placement

- Overview: Players shape a shared medieval map by placing tiles, which generate resources, host units, or provide defensive structures. Tiles are placed in a timed, asynchronous system to balance Carcassonne’s puzzle-like feel with RTS pacing.
- Mechanics:
    - Timed Placement: Each player can place one tile every 15 seconds. In a 4-player game, this creates a 60-second cycle (15s × 4 players). If a player is eliminated, the cycle reduces to 45 seconds (15s × 3 players), and so on.
    - Stored Placements: Players can “bank” up to three tile placements. If a player misses their 15-second window, they can place multiple tiles later (e.g., choosing one of three tiles up to three times in a row).
    - Tile Selection: Each placement offers three random tile options from a shared pool. The player chooses one to place and discards the other two (returned to the pool).
    - Tile Types: The tiles in the shared pool are 80% Core Tiles, 10% Resource Tiles, and 10% Special Tiles, evenly split among the tiles in each type group.
    - Relaxed Connection Rules: Tiles must connect to at least one existing tile but don’t require feature alignment (e.g., a farm can connect to a city). A player must place a tile to expand the territory containing their capital city. If one territory is connected to another, either player with capital cities within are allowed to place tiles anywhere that expands that larger territory.
    - Starting Setup: Each player begins with a capital city tile, placed in a separate quadrant of the map (e.g., a 40x40 grid with capitals at least 8 tiles apart). Scattered resource tiles (mines, orchards) are randomly placed across the map, encouraging players to expand toward them. 10 marsh tiles are also scattered, constraining growth.
- Gameplay Feel: Tile placement feels strategic yet forgiving. The 15-second timer keeps the game moving, but stored placements ensure players aren’t punished for brief inattention. Choosing from three tiles adds agency, letting players prioritize economy (e.g., fields for food) or defense (e.g., towers). The relaxed connection rules make it easy to expand toward resource tiles or rivals, maintaining Carcassonne’s map-building joy without rigid constraints.

2.2 Followers

- Overview: Followers (inspired by Carcassonne’s meeples) are placed on tiles to claim features and generate resources.
- Mechanics:
    - Each player starts with 8 followers.
    - After placing a tile, a player may place one follower on it as:
        - Magistrate: Claims cities for gold production.
        - Farmer: Claims fields for food production.
        - Monk: Claims monasteries for faith points (used for special abilities or tech).
        - Scout: Claims any unclaimed or conquered tile for the player. The tile must be connected to a tile the player owns.
    - Followers can be recalled (returned to the player’s pool) to deploy elsewhere or when a feature is destroyed, but recalling takes 10 seconds.
    - If a player runs out of followers, they can’t claim new tiles until one is recalled.
- Gameplay Feel: Followers add a layer of resource management and risk. Placing a magistrate on a city boosts your economy but limits your ability to claim new tiles. Recalling followers feels like a strategic reset, especially when preparing for a big push.

2.3 Resource Management

- Overview: Tiles with followers generate resources in real-time, fueling unit training, upgrades, and fortifications.
- Resources:
    - Gold: From cities (magistrates). Used for unit training and tech upgrades.
    - Food: From fields (farmers). Used for unit training.
    - Faith: From monasteries (monks). Used for special abilities and tech unlocks.
- Mechanics:
    - Resources generate every second based on tile type and upgrades (see Tile Types below).
    - Connected tiles of the same type require only one follower, so a magistrate on any of three connected city tiles produces a base 3 gold/second.
    - Resource caps (e.g., 500 per resource) prevent hoarding, encouraging spending.
    - Scattered resource tiles (e.g., lone mines or orchards) yield higher resources but are contested, as they’re not tied to any player’s starting area. These resource tiles need to be claimed by a player to produce resources, but do not require an active follower on it.
- Gameplay Feel: The economy feels alive, with resources ticking up as you expand. Reaching a scattered resource tile feels rewarding, but defending it requires military investment, creating tension between expansion and security.

2.4 Real-Time Combat

- Overview: Players train units to attack enemy tiles, defend their own, or raid for resources, with combat resolved in real-time.
- Mechanics:
    - Units are trained at city or barracks tiles (costing gold and food) and take 10–20 seconds to spawn.
    - Units move across the map in real-time (speed based on type, e.g., cavalry faster than infantry).
    - Combat uses a rock-paper-scissors system:
        - Infantry (strong vs. archers, weak vs. knights).
        - Archers (strong vs. knights, weak vs. infantry).
        - Knights (strong vs. infantry, weak vs. archers).
        - Siege (strong vs. fortifications, weak vs. infantry).
    - Attacking a tile with a follower or fortification requires defeating its defenders. Unclaimed tiles (e.g. marshes) can be captured instantly.
    - Raiding steals 10% of a tile’s stored resources without capturing it.
    - Capital city tiles have high health and require multiple units (including siege) to destroy.
- Gameplay Feel: Combat feels dynamic and tactical. Sending archers to harass an enemy’s fields disrupts their food supply, while defending your capital with knights feels intense. The real-time movement and combat create Age of Empires-style urgency, with players micro-managing units during key battles.

2.5 Victory Condition

- Overview: The game ends when one player eliminates all rivals by capturing or destroying their capital city tiles.
- Mechanics:
    - Each player’s capital city tile starts with high health (e.g., 1000 HP) and can be fortified further.
    - Destroying a capital requires reducing its health to zero via attacks (siege units deal bonus damage).
    - A player is eliminated if their capital is destroyed or they lose all followers and tiles.
- Gameplay Feel: The conquest focus drives tension, as every action (tile placement, unit training) builds toward or defends against this goal. Late-game sieges are climactic, with players committing all resources to attack or defend.

---

3. Tile Types
Tiles define the map’s landscape and drive the economy. They are divided into starting, core, and special tiles, with scattered resource tiles placed randomly at the game’s start.

3.1 Starting Tile

- Capital City:
    - Description: A fortified city tile where players begin. Generates gold and trains units.
    - Features: 4 city edges, 1000 HP, can host 2 followers (magistrates).
    - Resources: 2 gold/second (with 1 magistrate), +1 gold/second per additional magistrate. Counts as a city tile to other connected city tiles (adds to their resource generation).
    - Special: Can train units and be upgraded with fortifications (e.g., walls: +500 HP, costs 200 gold, 100 food, 50 faith).

3.2 Core Tiles

- City:
    - Description: Expands urban areas, generating gold.
    - Features: 200 HP, hosts 1 magistrate.
    - Resources: 1 gold/second (with magistrate).
- Marsh:
    - Description: An obstacle, slows down unit movement considerably.
    - Features: 30 HP, no follower required.
    - Resources: -70% speed to any unit or follower passing through. Only -50% if the player claims the marsh tile.
    - Special: Capturable by any player if undefended.
- Field:
    - Description: Agricultural land for food production.
    - Features: 1–3 field edges, 100 HP, hosts 1 farmer.
    - Resources: 1 food/second (with farmer).
- Monastery:
    - Description: Spiritual site for faith points.
    - Features: 300 HP, hosts 1 monk.
    - Resources: 1 faith/second (with monk).

3.3 Resource Tiles (Scattered)

- Mine:
    - Description: A contested tile yielding gold.
    - Features: 150 HP. No follower needed to produce resources.
    - Resources: 2 gold/second.
- Orchard:
    - Description: A contested tile yielding food.
    - Features: 150 HP. No follower needed to produce resources.
    - Resources: 2 food/second.

3.4 Special Tiles

- Barracks:
    - Description: Military outpost for training units.
    - Features: 400 HP, no follower required.
    - Resources: None, but enables faster unit training.
    - Special: Trains units faster than cities (–50%).
- Watchtower:
    - Description: Defensive structure to protect tiles.
    - Features: 500 HP, no follower required.
    - Resources: None.
    - Special: Boosts defense of nearby tiles (owned by the same player) (+25%).

---

4. Unit Stats
Units are trained at cities or barracks, move in real-time, and engage in combat to control tiles or destroy capitals. Stats are balanced for quick, tactical battles.

| Unit             | Cost              | Training Time | HP  | Attack             | Speed     | Strengths              | Weaknesses |
| ---------------- | ----------------- | ------------- | --- | ------------------ | --------- | ---------------------- | ---------- |
| Infantry         | 50 gold, 20 food  | 10s           | 100 | 20                 | Medium    | Archers                | Knights    |
| Archer           | 60 gold, 30 food  | 12s           | 75  | 25 (ranged)        | Fast      | Knights                | Infantry   |
| Knight           | 100 gold, 50 food | 15s           | 150 | 30                 | Slow      | Infantry               | Archers    |
| Siege (Catapult) | 200 gold          | 20s           | 120 | 50 (vs. buildings) | Very Slow | Fortifications, cities | Infantry   |

- Movement: Units move at 1–2 tiles/second based on speed. Marshes decrease speed by 70% (50% if claimed by the same player).
- Combat: Units auto-attack when in range (1 tile for melee, 2 tiles for archers/siege). Battles resolve in real-time, with damage applied every second.

---

5. Tech Trees

The tech tree progresses through three stages (Manor, Duchy, Kingdom), unlocking new units, upgrades, and abilities. Players spend resources at cities or monasteries to advance.

5.1 Stage Progression

- Manor (Starting Stage):
    - Units: Infantry, Archer.
    - Tiles: Basic City, Field, Marsh, Monastery.
    - Cost to Advance to Duchy: 200 gold, 100 food, 100 faith.
- Duchy:
    - Unlocks: Knight, Barracks, Watchtower.
    - Upgrades: Fortified Walls (+200 HP to cities).
    - Cost to Advance to Kingdom: 400 gold, 200 food, 200 faith.
- Kingdom:
    - Unlocks: Siege (Catapult), Mine, Orchard.
    - Upgrades: Elite Units (+20% attack/HP), Monastery Abilities (e.g., mass heal).

5.2 Tech Upgrades

- Military (Barracks):
    - Fast Training: –20% unit training time (100 gold, 50 faith).
    - Elite Units: +20% attack/HP for one unit type (150 gold, 100 food per unit type).
- Defensive (City):
    - Fortified Walls: +200 HP to cities or barracks (75 gold, 75 food).
    - Tower Network: Watchtowers boost defense by +30% (150 gold, 50 faith).
- Special Abilities (Monastery):
    - Heal: Restores 50% HP to all units (50 faith, 1-minute cooldown).
    - Inspire: +50% attack for 15 seconds (75 faith, 2-minute cooldown).

---

6. Other Game Mechanics
6.1 Map and Starting Setup

- Map Size: 40x40 tile grid, with 15–25 scattered resource tiles (mines, orchards) randomly placed at least 5 tiles from any capital, and 10 marsh tiles randomly placed at least 3 tiles away from any capital.
- Starting Areas: The four starting areas are the corners of the 10x10 square that shares a center with the board. Each player’s capital city is placed on one of these areas, so they are at least 8 tiles apart, ensuring initial separation. Players expand toward resource tiles or rivals.

6.2 Multiplayer and AI

- Players: 2–4 players, with AI opponents for solo play or filling empty slots.
- Match Duration: 20–30 minutes, balanced by resource rates and capital health.
- AI Behavior: AI prioritizes resource tiles early, then shifts to aggression after reaching High Medieval age.

6.3 User Interface (UI)

- Map View: A 2D grid with zoom/pan functionality, showing tiles, units, and followers. Tiles highlight valid placement zones.
- Resource Bar: Displays gold, food, and faith, with real-time counters.
- Tile Selection: Pop-up window every 15 seconds showing three tile options. Players click to select and place.
- Unit Control: Click-and-drag to move units or attack. Right-click to set rally points for newly trained units.
- Tech Menu: Accessible via city/monastery tiles, showing available upgrades and costs.

6.4 Art and Audio

- Art Style: Stylized 2D medieval aesthetic (e.g., vibrant colors, simple textures) to ensure smooth performance in Pixi.
- Audio: Medieval-inspired soundtrack with ambient sounds (e.g., hammering for building, clashing swords for combat). Sound effects for tile placement, unit training, and battles enhance immersion.

---

7. Technical Implementation

- Framework: Pixi JS for 2D rendering, ideal for a tile-based board with units.
- Networking: WebSocket for real-time multiplayer, syncing tile placements, unit movements, and combat. Python FastAPI handling game logic.
- Tile System: Store tiles as JSON objects with properties (e.g., type, edges, HP, follower). Use a grid-based coordinate system for placement.
- Performance: Optimize for low-end browsers by using sprite sheets and limiting animations. Cap units at 50 per player to prevent lag.
- Storage: Save game state (tiles, resources, units) in a server-side SQLite database for multiplayer persistence.

---

8. Balance and Playtesting Goals

- Tile Balance: Ensure resource tiles are valuable but contested (high yield, low HP).
- Combat Balance: Tune unit stats so no single type dominates (e.g., knights are strong but expensive). Siege units are slow to encourage combined-arms tactics.
- Economy Balance: Resource generation rates (1–2 per second) and caps (500) encourage spending over hoarding. Scattered resource tiles yield 2x to reward risky expansion.
- Playtesting: Test for:
    - Game length (20–30 minutes).
    - Fairness of tile choice (three options) and relaxed connection rules.
    - Balance between early-game expansion and late-game conquest.

---

9. Example Gameplay Flow

- Setup: Four players start with capital city tiles in separate quadrants. The map has 20 scattered mines and orchards, as well as 10 marshes to restrict growth. Each player has 8 followers and 100 gold, 100 food.
- Early Game (0–5 minutes): Players place tiles every 15 seconds, choosing from three options. They expand toward scattered resource tiles, claiming mines (2 gold/second) and orchards (2 food/second) for passive resource generation. Basic infantry patrol to deter raids.
- Mid Game (5–15 minutes): Territories connect as players place tiles. Skirmishes erupt over a central mine tile, with archers raiding for gold. Players advance to Duchy, unlocking knights and watchtowers. One player fortifies their capital (+500 HP).
- Late Game (15–30 minutes): A player reaches Kingdom, training catapults to siege an enemy’s capital. Another player uses a monastery’s “Inspire” ability to counterattack. The game ends when one player destroys all rival capitals after a climactic siege.