# Meadowbound — Blood & Thunder

A Mario × Zelda inspired isometric survival sandbox. Procedural grid terrain, hostile animals, explosive combat, skull drops, a defensive fire circle, and an original rock soundtrack. Built with Canvas 2D and Vite; no runtime dependencies or API keys.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use **WASD / arrow keys** to move, **Shift** to sprint, **hold Space / hold click** to chain sword attacks, **Z** for the charged skill, and **Escape** to pause. Mouse movement aims continuously in every direction; movement sets the heading when the pointer is away from the canvas. Touch devices have movement, attack, and skill buttons.

The isometric grid world streams in every direction, with a practical coordinate limit of ±1 billion world units. Each tile is 64 units and each chunk is 8 × 8 tiles. The game retains a 7 × 7 neighborhood (49 chunks) and at most 24 terrain canvases; it does not allocate the whole world. A connected road lattice crosses chunk boundaries. The minimap is a local radar that follows the player. Terrain and pickups regenerate deterministically, while consumed gem/heart IDs persist for the run, so leaving and returning cannot farm the same pickup.

Cows take three hits; sheep and dogs take two. All are hostile: they navigate around blocked cells, pursue the player, lunge, and damage health on contact. Brief invulnerability prevents overlapping enemies from instantly draining health. New groups arrive through portals every 3.5 seconds, up to 24 living enemies. Distant enemies unload as you explore. The world waits for the first interaction before enemies start moving. At zero health, a 2.2-second fall/desaturation transition and descending game-over sound play before **New World / Retry** appears.

Kills erupt into multiple staggered shockwaves, fire, more than 250 particles, debris, smoke, and layered explosion audio. Visual particle work is bounded during mass kills. Each defeated animal drops one collectible skull. **Every 10 skulls grows the blade again**, with no tier cap: tier = floor(skulls / 10), hit reach = 100 + 65 × tier. Both the rendered blade and its actual hit range continue growing. At **100 skulls**, radial overdrive unlocks: 32 damaging projectiles fire in all directions every 1.4 seconds. Shots collide with terrain and animals and expire after 2.2 seconds.

Random hearts throughout the streamed map restore one health up to the five-heart maximum. Full-health pickups remain on the ground, and hearts do not revive a dead player. Gems also continue generating as you explore.

**Fire circle:** press Z or tap the skill button. A ring follows the player for exactly **2 seconds**, burning and repelling enemies within 145 world units. The **10-second cooldown begins at activation**. After ten successful fire-ring casts, the **next activation is a nuclear blast**, instantly killing all enemies within 950 units, including spawning ones. The player survives the blast. The charge resets and the ten-rings/one-nuke cycle repeats. Rejected presses during cooldown do not count. The skill button shows recharge, charge count, and nuclear readiness. Pause freezes the simulation and timers.

Every fresh load generates a new seed. Seeded noise creates water, stone, trees, rocks, and pickups on the grid. Movement stays smooth, with collision and local pathfinding controlled by tiles. Foreground trees become transparent around the hero, combat targets, and drops. The world uses a dusk palette, dark steel interface, ember particles, and screen shake.

Use the circular-arrow toolbar button to generate a new world and reset the run. For a repeatable world, open `/?seed=42`. The HUD displays the seed in hexadecimal; `/?seed=0x0000002A` generates the same world as `/?seed=42`.

**Iron in the Grass** is an original 64-bar, 144 BPM rock arrangement lasting 106.67 seconds before looping. Intro, verse, chorus, breakdown, solo, and outro sections layer distorted power chords, bass, lead guitar with slapback, kick, snare, hi-hat, crash, and tom fills. Web Audio lookahead scheduling keeps the rhythm independent of frame rate. Music and effects begin with the first interaction; muting or pausing suspends playback.

```sh
npm test           # Streaming, aiming, progression, nuclear cycle, healing, projectiles, AI, audio score
npm run build     # Production files in dist/
npm run preview   # Preview the production build
```

With the dev server running, `node scripts/browser-check.mjs` checks the live game: procedural terrain, movement, damage and death effects, skull progression, Z activation and timing, hostile pursuit and spawning, player damage and death/retry, audio controls, and mobile layout. It also renders the actual music and combat sounds offline to check for audible, finite samples without clipping. Set `CHROME_PATH` if Chrome is installed outside the default Windows location. Screenshots are written to the ignored `.artifacts/` directory.

The game renders all artwork locally. Google Fonts supplies optional interface typography, with system fonts as fallbacks.

## GitHub Pages

In **Settings → Pages**, set **Source** to **GitHub Actions**. The
**Deploy to GitHub Pages** workflow tests and builds the app, then publishes
only `dist` on every push to `main`; it can also be run manually. Publishing
the source repository directly skips Vite and causes module-loading errors.

Relative asset URLs support `https://teuncm.nl/zelda-mario/` and other repository
subpaths. The custom domain stays configured on the account's main Pages site.
