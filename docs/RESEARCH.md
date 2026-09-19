# MarbleBench iOS research and decision record — 2026-09-18

## What exists already

- [PortableWeb specification](https://github.com/portableweb/spec): draft `.pweb` ZIP with mimetype first and manifest. [Browser viewer](https://github.com/portableweb/portableweb.github.io) extracts via JSZip, rewrites references to Blob URLs and embeds a sandboxed iframe. The README documents limitations for `localStorage`/IndexedDB. We adopt the draft rather than colliding with its extension.
- [ZenFS](https://zenfs.dev/): reusable virtual filesystem with ZIP and browser persistence mounts; filesystem API is not automatically a browser module-resolution mechanism.
- [Rapier 2025 review](https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/): web WASM/SIMD physics and reported *intra-Rapier version* improvements. Compare equivalent scene and solver quality before conclusions.
- [WebKit Safari 26 WebGPU](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/): available on iOS; shaders in WGSL, backed by Metal. A19 Pro hardware/Neural Engine does not imply web access to ANE via WebGPU.
- [WebKit Safari 27 release](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/): verify changes on iOS 27 and device, do not infer FPS from display Hz.
- [GitHub Pages](https://docs.github.com/en/pages): static HTTPS hosting, not a dynamically executing application server.

## Architecture decisions

- Main user path: tap GitHub Pages link, load trusted game from HTTPS; download a `.pweb` separately if desired. No runtime ZIP extraction required for a normal visit.
- Browser native HTTP, MIME, caching and ES module handling should be retained wherever possible; do not rewrite import graphs unless an actual PWEB viewer requires it.
- Prefer a clear loading stage indicator before attempting byte-level percent. A true download progress bar needs measurable Content-Length or explicit asset weights, and an unknown-length response should remain indeterminate.
- Cache app shell for offline reuse, but update cache atomically per version and guard cache storage capacity. `CacheStorage` is best effort, not permanent.
- Avoid framework hydration: there is no server-rendered component tree in a Canvas game. Lazy-load *substantial optional* assets/pipelines at safe scene boundaries instead.
- Keep physics and graphics distinct. A fixed timestep provides comparable physics; uncapped rAF drives drawing; if > refresh-rate simulation is useful, measure it independently from display.
- This starter uses 2D CPU reference physics and GPU rendering, NOT GPU compute and NOT a physically correct continuous collision solver. Moving all simulation to GPU before profiling would be premature.
- Loading the game as arbitrary user-supplied ZIP contents under the viewer's own origin is dangerous. A production untrusted bundle runtime needs a security model that prevents origin/storage exfiltration. An iframe with both allow-scripts and allow-same-origin for same-origin content is unsafe.

## Experimental matrix

| Variable | Levels | Metric |
| --- | --- | --- |
| Renderer | Canvas 2D / WebGPU | rAF cadence; frame time; GPU time if supported |
| Physics | starter JS / Rapier WASM+SIMD / candidate GPU compute | ms per fixed step; contact correctness; total workload |
| Bodies | 30 / 100 / 250 / 400 | collision count; p50/p95; dropped steps |
| Packaging | static HTTP / single HTML / .pweb viewer | transfer bytes; time to playable; peak resident memory; APIs that initialize |
| Operating mode | normal / low-power / sustained 10-min | performance stability and thermal effects |

Do not compare library benchmark marketing numbers with results on our specific test scene. Capture exact browser version, device, battery and power state, measured workload and renderer resolution alongside each result.

## Deployment identity

GitHub repository: https://github.com/collinsomniac/marblebench-ios . Planned static site: https://collinsomniac.github.io/marblebench-ios/ (not verified live until GitHub Pages publishes). The workflow builds from `site/` without a server process.
