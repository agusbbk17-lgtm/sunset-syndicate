# sunset-syndicate

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/agusbbk17-lgtm/sunset-syndicate/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/agusbbk17-lgtm/sunset-syndicate/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunset Syndicate — Solmar Bay** is an original, browser-only third-person open-world
action game: a seeded coastal city of ~1.5 × 1.5 km with downtown towers, a boardwalk,
docks, a park and a highway loop, walked and driven through under a golden-hour sun.
Everything in it is generated in code at run time — meshes, textures, shaders,
post-processing and audio. No downloaded models, textures, fonts, music or libraries
beyond pinned Three.js (MIT, vendored in `game/vendor/`) and make.fun's own hand-in
library (`vendor/makefun-game.ts`, which the competition's rules require unchanged).

## What runs today

| Area | State |
| --- | --- |
| World | Seeded heightmap terrain, coast, animated fresnel water, procedural sky with sun disc and stars, exp2 fog, instanced buildings, props, roads with painted lane marks, landmarks |
| Rendering | PBR materials with clearcoat car paint, shadow-mapped sun that follows the player, single-pass film postfx (luminance bloom, edge occlusion, vignette, grain), ACES tone mapping, four quality presets plus an adaptive governor |
| Player | Procedural skeletal humanoid: idle, walk, run, sprint, jump, fall, crouch, aim; WASD + mouse (pointer lock) + gamepad |
| Camera | Third-person spring arm with Near / Medium / Far presets (V), frame-rate independent damping, sphere-cast wall collision with pull-in, character fade under 0.6 m, aim blend, auto-recenter |
| Vehicles | Eight original procedural bodies (sedan, sports, muscle, SUV, pickup, bike, cruiser, taxi), arcade gear/engine curve, speed-sensitive steering, grip and handbrake drift, suspension roll/pitch, OBB collisions, enter/exit with an eased arc, chase camera that blends heading with velocity, cinematic cut mode |
| Interface | Main menu, live backdrop, HUD (health, armour, cash, weapon, wanted stars, speedometer/gear/RPM, objective, subtitles, crosshair), rotating minimap with road route, full map with waypoint, pause, settings, debug overlay |
| Audio | WebAudio synthesis started on the first gesture: RPM-tracked engine, tyre squeal, impacts, UI tones, ambience; `?noaudio` mutes it |
| Persistence | Settings, seed and player state autosaved to `localStorage` inside `try/catch` |

## What is not in this build

The lane graph, traffic-light phases, pooled traffic and fleeing pedestrians exist as
modules with unit tests (`game/src/world/lanes.js`, `world/signals.js`,
`entities/traffic.js`, `entities/pedestrian.js`, `systems/ai.js`), but they are not yet
driven by the live scene loop. Combat, wanted-level police pursuit, missions and the
cinematic director are therefore **not playable** in this submission. The HUD shows
zero wanted stars and `UNARMED` because those systems are not live yet.

## Controls

`WASD` move / drive · mouse look (pointer lock) · `Shift` sprint · `Space` jump ·
`C` crouch · `E` or `F` enter/exit · `RMB` aim · `V` camera preset · `M` map ·
`H` horn · `Esc` pause. Gamepad: left stick move, right stick look, `A` jump,
`RT` accelerate, `LT` brake, `B` aim, `D-pad Down` camera preset.

## Run it

```sh
node serve.ts                      # serves game/ on http://localhost:8080 (Node 22, no build)
# open http://127.0.0.1:8080/?seed=1
# flags: ?seed=<any string>  ?quality=low|med|high|ultra  ?noaudio  ?debug
node --test tests/*.test.mjs       # unit tests: loop, rng, camera, collision, roads, save, quality, audio, vehicles
node scripts/smoke.mjs             # browser smoke: needs the local server and a Playwright Chromium
node main.ts                       # hand-in copy: set MAKEFUN_OUTPUT_DIR to a writable directory

The smoke run takes `SMOKE_W`/`SMOKE_H` for the viewport and `SMOKE_RENDER` for the one
quality preset that pays for a real GPU frame (default `low`; it must name exactly one
of `low`, `med`, `high`, `ultra`). `shots.json` maps each shipped screenshot to the URL
it was captured from — the `start`, `play` and `end` poses on `?seed=1`, rendered at
1280×720 and grabbed with Playwright.
```

## Verification performed

Every figure below was measured in this repository, in the container the build was
written in: Linux arm64, Node 22.23.4, Chromium under Playwright with **no GPU** — the
WebGL context is served by the llvmpipe software rasteriser. Those numbers are
functional evidence, not hardware performance.

- **Unit tests** — `node --test tests/*.test.mjs` → 29 tests, 29 pass, 0 fail.
- **Smoke run** — `node scripts/smoke.mjs` at 640×360 on `?seed=1&quality=low&debug`,
  exit code 0:
  - Boots to a live WebGL2 scene; the menu and gameplay both present frames.
  - **0 console errors, 0 console warnings, 0 loop errors** across 2,718 fixed-step ticks.
  - Camera: each of the three presets is pushed into a building collider and pulls in
    (arm 0.105–0.114 m, 1 collision hit each, never inside geometry); a 33.3 m walk
    along the boulevard kept the arm out of geometry for every tick.
  - Driving: four enter/exit transitions all started and landed in the expected mode,
    largest single-frame camera jump 0.497 m, 0 ticks with the arm inside a building,
    835 m driven, car brought to rest in gear 1.
  - Interface, driven through the real DOM: FOV 72, sensitivity 1.4, volume 0.25,
    the third camera preset (`Far`) and reduce-motion applied from the controls, a
    clicked waypoint routed over 3 road edges, and the pause-menu save landed in
    `localStorage`.
  - Audio: WebAudio context running, engine voice at 140 Hz for 4,200 RPM on 3
    oscillators, ambience, tyre-squeal and footstep voices live, 7 UI blips.
  - **Draw calls on the rendered preset: 11** (75,070 triangles) against the 600
    budget, with 584 buildings instanced and 6 chunk groups streamed in.
  - Quality presets are read from the pinned table and paired with the streaming
    radius each one drives — low 0.75×/no shadows/512/no post → 6 chunks,
    med 1×/shadows 1024/post → 18, high 1.4×/shadows 2048/post → 18,
    ultra 1.8×/shadows 2048/post → 35. Only the cheapest preset pays for a real GPU
    frame in the run: switching this rasteriser onto the shadowed pipeline costs about
    16 s once (measured), which would dominate the run without proving anything new.
- **Frame rate** — the live loop presented **4.14 frames/s at 640×360** under software
  rasterisation. That says nothing about a laptop GPU, so **60 FPS on High is not
  measured here and is not claimed.** The adaptive governor (lowers pixel ratio, then
  shadows, then post-processing once the rolling frame average passes 20 ms) is
  covered by unit tests instead.
- **Screenshots** — `screenshots/` holds three real 1280×720 captures of this build,
  taken through `?shot=` poses that settle a fixed tick count, so the same seed renders
  the same frames.
- **Hand-in** — `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` exits 0 and writes
  `game/`, `screenshots/` and a 396,739-byte `dossier.json` (three images, schema
  `makefun/dossier/v1`), inside the scorer's 1.5 MiB cap. Rebuilding that dossier with the
  kit's own `buildDossier` over the same tree gives the same bytes — sha256 `94c9a7b6…`
  on both sides — which is what `dossier_matches` compares. `game/` holds 47 files in 10
  directories, 834,564 bytes, no symlinks, against the 993-entry and 48 MiB caps, and
  `game/index.html` is 593 bytes. Every screenshot is a whole 1280×720 JPEG under 256 KiB,
  within the screenshot row's long-side and short-side limits.
- **Credentials** — every working-tree file and every blob in the commit history was
  scanned against this account's key material and the usual token shapes (GitHub token,
  private-key block, AWS key, bearer header, keypair JSON): **0 matches**.
- **Known gap in the run** — the GL renderer-identity query (`WEBGL_debug_renderer_info`)
  blocks this container's GPU process, so the smoke script times that single round trip
  out after 45 s and records it as unavailable rather than failing the run.

## Determinism

`?seed=` drives a single seeded PRNG that is forked per subsystem; the simulation runs
on a fixed 60 Hz step with interpolated presentation, and `?shot=` seeks a named pose
by resetting state and settling a fixed number of ticks, so identical seeds produce
identical worlds and identical screenshots.

## Licence

MIT — see `LICENSE`. Two files are not ours and are shipped as their owners hand them out:
Three.js r160 (`game/vendor/three.module.min.js`, 670,681 bytes, MIT, its `@license` header
intact) and `vendor/makefun-game.ts`, make.fun's hand-in library, byte for byte the kit
starter's copy (56,282 bytes, sha256 `dc671875…`). RULES.txt requires that library to stay
unchanged, so `tests/files.test.mjs` pins its hash and exempts its 1,203 lines from this
repository's own 500-line limit rather than reflowing it. Every other byte under `game/` —
source, shaders, CSS, HTML — is written here, and no model, texture, font, audio or data
file is shipped at all.

---

<sub>Entered on [make.fun](https://make.fun/?ref=df1f97fc&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
