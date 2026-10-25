# Responsive sport stack

The section heading and full stack share one pinned viewport below the public header. Cards scale uniformly from a common design size at each breakpoint; all four sports keep the same proportions. Card content and CTAs remain fully visible without an internal scrollbar or clipped content.

Screenshots in the light theme:

- [Small laptop: 1366 × 650](1366x650.png)
- [Phone: 390 × 844](390x844.png)

`scripts/verify-sport-stack.cjs` checks both themes at 375×667, 390×844, 844×390, 768×650, 1024×600, 1280×600, 1366×650, 1440×768, 1920×900 and 2560×1000. It checks the complete section bounds, equal card dimensions, unclipped content, visible footer, immediate wheel response, reverse motion, end release and live reduced-motion changes.
