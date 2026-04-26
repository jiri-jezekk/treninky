<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Responsiveness rules (mobile-first)

Every UI change **must** stay responsive across devices. Follow these constraints:

1. **No `touch-pan-x` / `touch-pan-y`** — never restrict touch scroll direction. The browser handles gesture detection natively when `overflow-x: auto` is set on a wrapper.
2. **Tables** — always wrap `<table>` in a `<div className="table-scroll-wrapper">` (defined in `globals.css`). Use `w-full` on the table, never `min-w-full`.
3. **No `overflow-auto` on `<main>`** — the page scrolls at the body level. `<main>` uses `overflow-x-hidden` only. The sidebar is `sticky` on desktop.
4. **Max widths** — every page container must have `max-w-*` + `w-full` + `min-w-0` to prevent content from exceeding viewport width.
5. **QR codes** — use `size={100}` or smaller in table cells. Larger QR codes (160 px) only in standalone panels.
6. **Flex children** — always add `min-w-0` on flex children that contain text to prevent flex overflow.
7. **`min-h-dvh`** — use `min-h-dvh` (not `min-h-[100dvh]`) for full-viewport layouts.
