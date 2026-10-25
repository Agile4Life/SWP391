# Sport stack performance — 2026-10-23

The stack keeps its pinned deck, send-to-back motion, reverse scrolling, final-card reading interval and reduced-motion fallback.

## Controlled comparison

Chromium 153 headless, production Vite preview, local catalog fixture, images/fonts warmed, no CPU throttling. Each sample scrolls through three transitions and back over five seconds. Both samples use the same machine and benchmark.

| Metric | Desktop 1440×900 before → after | Mobile viewport 390×844 before → after |
| --- | --- | --- |
| P95 rAF interval | 30 → 5.2 ms | 30 → 5.2 ms |
| rAF intervals above 25 ms | 25 → 0 | 25 → 0 |
| Long tasks | 1 → 0 | 2 → 0 |
| Style recalculation time over sample | 4.399 → 0.456 s | 4.445 → 0.513 s |
| Average headless rAF callback rate | 47.7 → 194.6 /s | 45.5 → 196.2 /s |

The after samples pass the 16.7 ms P95 budget and 60 callbacks/s benchmark checks. Headless rAF callback rate measures processing throughput, not physical display refresh or guaranteed FPS on every device. Mobile means a viewport test on the same host, not a physical phone.

Raw evidence: [before](sport-stack-performance-before.json), [after](sport-stack-performance-after.json).

## Changes

- Update the progress bar transform directly instead of invalidating inherited styles on the entire landing root.
- Batch scroll work into one rAF callback; read geometry before writing styles and skip unchanged values.
- Cache stack geometry; update transforms directly instead of seeking paused CSS animations each frame.
- Change depth and accessibility attributes at phase boundaries; prepare image decoding and compositor layers near the stack.

## Reproduce

Run a production preview on port 5173, make `playwright-core` available, and point `CHROME_PATH` to Chromium if needed. Then run `node scripts/benchmark-sport-stack.cjs`. Set `STACK_PERF_CHECK=1` to assert the frame budget and `STACK_PERF_OUTPUT` to save JSON. `PUBLIC_UI_URL` overrides the local URL.

Behavior checks: `scripts/verify-sport-stack.cjs`, `scripts/verify-public-ui.cjs`, `scripts/verify-public-animation.cjs`; frontend unit tests, build and lint.
