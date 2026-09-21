# Marble Works — toy-run redesign

A separate, physics-first redesign of MarbleBench. Repeated primary-color sleeves,
open chutes, a gravity-fed loop, a funnel, a shallow water channel and a powered
lift form one recirculating course. The older root, `/3d/` and `/modular/` applications
remain separate.

```sh
cd experiments/toy-run
npm ci
npm test
npm run dev
npm run build
```

The production build targets `/marblebench-ios/toy/`. For another static host,
run `npx vite build --base=./` and serve `dist/` over HTTP. No application server,
API key, account, external font, CDN or remote model is required at runtime.
`file://` is not a supported ES-module/WebGPU deployment mode.

## Playing

Drag to orbit; scroll/pinch to zoom. Choose Explore, Follow marble or Marble's eye
from the camera selector. Explore supports a touch movement pad and keyboard
movement. Controls expose release rate, capacity, time scale, render resolution,
elevator power, water and an explicit WebGL 2 comparison mode.

The default is six marbles, released at 0.20/s. Larger populations and faster
release are experiments, not a validated operating envelope. Real collisions
can jam a toy; escaped marbles are counted. Automatic feed may replace escapes,
so acceptance checks require **zero losses and exactly the original spawn count**.

## Evidence

Local Node/Rapier validation, 2026-09-21:

| Run | Circuits | Escapes | Spawned | Result |
| --- | ---: | ---: | ---: | --- |
| One marble, 300 simulated seconds | 19 | 0 | 1 | Repeated return of the same body |
| Six marbles, 180 simulated seconds | 17 | 0 | 6 | Default regression fixture |
| Six marbles, 600 simulated seconds | 57 | 0 | 6 | Every marble completed 6–11 circuits; last delivery at 599.20 s |

`npm test` checks ordered stage traversal, original body identity, sustained late
progress, all six marbles returning, lift power pause/resume, dry circulation,
contact-surface winding, connector widths and portrait framing. `npm run diagnose`
prints trajectories and bounded events; set `FLOW`, `CAPACITY`, and `SECONDS` to
change its scenario. These are simulated-time results, **not mobile FPS claims**.

See [design and architecture](docs/DESIGN.md) for sources, tradeoffs and remaining work.

## Live preview and diagnostics

[Open Marble Works](https://collinsomniac.github.io/marblebench-ios/toy/).
The protected `main` Pages workflow publishes a pinned toy revision; the redesign
PR remains a separate review branch. The browser validation limitations are in
[the deployment update](docs/DESIGN.md#deployment-and-review-update--2026-09-21).

Use **Controls → Inside the machine → Save benchmark JSON** to save recent
measurements on your phone. A startup failure has its own **Save diagnostic report**
button. Reports stay on your device unless you choose to share them.
