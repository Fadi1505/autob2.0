# Auto Gladiators (web)

An **8-player online auto-battler** inspired by Dota 2's *Auto Gladiators*. Pick a gladiator,
build it up by buying ability cards across **12 sects**, and fight a random opponent 1v1 every
round. Lose and your courier takes damage; hit 0 HP and you're out. **Last gladiator standing wins.**

- **Client:** React + TypeScript (UI), Three.js (3D battle arena with rigged glTF gladiators), Zustand (state)
- **Server:** Node + `ws` + Express — authoritative game loop, rooms, bot-fill to 8
- **Combat:** a deterministic, seeded sim shared by client and server, so both agree on results

## Quick start (local)

```bash
npm install

# Terminal 1 — game server (lobby + authoritative loop) on :8787
npm run server:dev

# Terminal 2 — Vite dev client on :5173 (hot reload)
npm run dev
```

Open http://localhost:5173 in two or more browser tabs. In the first tab click **Create game** and
share the **room code**; other tabs **Join with a code**. Empty seats are filled with bots when the
host clicks **Start**.

## Play via a shareable link

For a single URL you can send to friends (anywhere), serve the built client and the WebSocket
server from one process, then expose it with a tunnel:

```bash
npm run play        # builds the client and serves everything on http://localhost:8787

# in another terminal — instant public HTTPS URL (no account needed):
npx cloudflared tunnel --url http://localhost:8787
```

Cloudflared prints a `https://<random>.trycloudflare.com` URL. Send it to friends — the client
auto-connects its WebSocket to the same origin, so the link "just works". (`ngrok http 8787` works
too if you prefer.)

## Deploy (permanent link)

The app is one Node process that serves the static client **and** the WebSocket server, so any host
with WebSocket support works. Included:

- `Dockerfile` — `docker build -t auto-gladiators . && docker run -p 8787:8787 auto-gladiators`
- `render.yaml` — one-click Render web service (reads `PORT` from the environment automatically)

## How it works

- **Sects** (`src/game/data/sects.ts`): 12 stat branches (Attack, Fury, Critical, Magic, Ultimate,
  Health, Shield, Regen, Healing, Evasion, Ward, Frost). Each card adds points to a sect; passing
  **5 / 10 / 20 / 40** points unlocks escalating passive bonuses. Counters emerge naturally
  (Evasion vs Attack, Frost vs Fury, Shield vs Attack…).
- **Build** (`src/game/build.ts`): hero base stats + owned cards + sect thresholds → a `CombatBuild`.
- **Deterministic sim** (`src/game/sim/`): `BattleSim` runs a 1v1 duel from two builds + a seed at a
  fixed timestep. The server runs it headless to decide the winner; each client runs the identical
  sim to animate the fight in 3D. Visual-only effects (floating damage/crit/evade text, attack/cast/
  hit/death animations) are driven from sim flags on the client and never touch determinism.
- **3D characters** (`src/render/`): rigged glTF models are loaded once and instanced per fighter via
  `SkeletonUtils.clone`, each with its own `AnimationMixer`. `modelManifest.ts` maps a hero to a model
  file + animation clip names + which built-in weapon meshes to show, so dropping in new `.glb` art
  needs no renderer changes.
- **Game feel** (`src/render/ArenaRenderer3D.ts`, `src/audio/AudioManager.ts`): a dynamic combat
  camera frames and follows the two fighters; impacts add knockback, sparks, a red hit-flash, and
  camera shake; each hero wields its rigged weapon (sword/shield, axe, staff/wand, dagger, crossbow);
  and a small Web Audio synth provides swing/cast/hit/crit/death and UI sounds (mute toggle in the
  top bar, persisted). All of this is client-only and cosmetic, so the sim stays deterministic.
- **Server** (`server/`): rooms with 4-letter codes, bot-fill to 8, and the authoritative phase loop
  (lobby → draft → shop → combat → resolve → eliminate → winner), plus economy (base gold, interest,
  win/loss-streak bonuses). Disconnected players are handed to the AI so games continue.

## Assets / credits

3D characters (and their built-in weapons) are from the **KayKit – Character Pack: Adventurers** by
Kay Lousberg, released under **CC0 1.0** (public domain — no attribution required, credit given here
as thanks). The `.glb` files live in `public/models/` and Vite copies them into `dist/` so the
production server serves them at `/models/...`. Each character GLB already ships every weapon/shield
rigged to the hand bones; the renderer just shows the ones each hero uses (see `modelManifest.ts`).
To swap in your own art (e.g. Meshy/Mixamo exports), drop a `.glb` in `public/models/` and point
`src/render/modelManifest.ts` at it.

Sound effects are **synthesized at runtime with the Web Audio API** (`src/audio/AudioManager.ts`) —
there are no audio files to ship or license, and nothing to load.

## Notes / next steps

- 3 heroes (Pyromancer, Berserker, Sentinel) have fully-wired innate kits; the rest rely on drafted
  card abilities. Concrete effects for the remaining heroes' signature abilities are stubs.
- Possible additions: reconnection by token, spectator match-picking, neutral/creep rounds, items.
