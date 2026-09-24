# Implementation Plan — Task 6: OpenCode Design System Restyle & Responsive Audit

## 1. Files to Change
- `public/index.html` (main UI markup, inline Tailwind config, typography links, components)
- `public/css/claude.css` (OpenCode global reset, monospace font, warm neutral scrollbar, canvas body background)
- `public/js/toast.js` (OpenCode monospace styling with `surface-dark`, `border-l-2`, `[+]` prefix)
- `public/js/context-menu.js` (flat monospace context menu, hairline border, ASCII `[>]`/`[!]`/`[x]` prefixes)
- `scripts/verify-responsive.mjs` (Playwright responsive audit script covering 7 viewports)
- `docs/ARCHITECTURE.md` (add OpenCode Monospace Design System ADR)
- `docs/LESSONS.md` (add lessons on checkpoint-driven restyling and responsive audits)
- `docs/PROJECT_STATE.md` (record Phase 6 completion)
- `README.md` (update design system reference)

## 2. Component-by-Component Restyle Scope
- **`<head>` & Fonts**:
  - Replace Google Fonts link with JetBrains Mono + IBM Plex Mono (weights 400, 500, 700).
  - Replace inline `tailwind.config` with OpenCode color palette, universal monospace font stacks, and 0px/4px border radius.
- **Global CSS (`public/css/claude.css`)**:
  - Disable font ligatures (`* { font-variant-ligatures: none; }`).
  - Set default body font to monospace stack, background `#fdfcfc`, text `#201d1d`.
  - Style scrollbar with `rgba(15,0,0,0.18)` thumb and 0px radius.
- **Header (`<header>`)**:
  - `h-14 border-b border-hairline bg-canvas px-6 flex items-center justify-between`.
  - Title: `text-[16px] font-bold text-ink leading-[1.5]`.
  - Subtitle: `text-[14px] text-mute leading-[1.5]`.
  - Buttons: Rescan (`bg-ink text-on-primary rounded-sm h-9 px-5 text-[16px] font-medium leading-[2] active:bg-ink-deep`), Secondary buttons (`bg-canvas text-ink rounded-sm border border-hairline-strong h-9 px-5 text-[16px] font-medium leading-[2]`).
  - Badges: `bg-surface-dark text-on-dark text-[14px] px-2 py-0.5 rounded-sm`.
- **Search & Filter Toolbar**:
  - Search input & dropdowns: `bg-surface-soft text-ink h-10 px-3 rounded-sm border border-hairline text-[16px] leading-[1.5] focus:bg-canvas focus:border-ink focus:outline-none`.
  - Checkbox labels: `text-body text-[16px] leading-[1.5]`.
- **Documents Table**:
  - Container: `overflow-x-auto scrollbar-thin border border-hairline rounded-none bg-canvas`.
  - Header: `bg-canvas text-mute uppercase text-[14px] leading-[2] border-b border-hairline-strong`.
  - Rows: `bg-canvas hover:bg-surface-soft border-b border-hairline`.
  - Filename / path / version: `text-[16px] text-ink font-medium` / `text-[14px] text-mute` / `text-[14px] text-body` (no pill).
  - LATEST badge: `bg-ink text-on-primary text-[14px] px-2 py-0.5 rounded-sm leading-[2]`.
  - Actions: ASCII text buttons `[>] Open` (`bg-ink text-on-primary h-8 px-4 rounded-sm text-[14px] font-medium`), `[~] Reveal`, `[!] Preview`, `[+] Bookmark` / `[x] Bookmarked`.
- **Sidebar (Bookmark Groups)**:
  - Container: `bg-canvas border-l border-hairline`.
  - Section title: `text-ink font-bold text-[16px] leading-[1.5]`.
  - Group card: `bg-canvas border border-hairline rounded-none p-3 hover:bg-surface-soft`.
  - Expand/collapse: `[+]` / `[-]`.
  - Bookmark pin indicator: `[x]` (bookmarked) / `[ ]` (unbookmarked).
- **Modals**:
  - Backdrop: `fixed inset-0 bg-ink/40 backdrop-blur-none z-40`.
  - Panel: `bg-canvas border border-hairline-strong rounded-none shadow-none z-50`.
  - Header: `text-ink font-bold text-[16px] leading-[1.5] border-b border-hairline pb-3`.
  - Buttons: Primary `bg-ink text-on-primary h-9 px-5 rounded-sm`, Secondary `bg-canvas text-ink border border-hairline-strong h-9 px-5 rounded-sm`.
- **Preview Modal (Dark Surface, Option B)**:
  - Text/code viewing area: `bg-surface-dark text-on-dark p-6 rounded-none font-mono text-[14px] leading-[1.5]`.
  - Line numbers: `text-on-dark-mute`.
  - Code highlights: `text-accent` (Apple Blue `#007aff` reserved strictly for preview code/TUI highlights).
  - Excel sheet tables: `bg-canvas` with hairline borders.

## 3. Tailwind Configuration Changes
- Color tokens mapped to OpenCode spec:
  - `canvas`: `#fdfcfc`
  - `surface-soft`: `#f8f7f7`
  - `surface-card`: `#f1eeee`
  - `surface-dark`: `#201d1d`
  - `surface-dark-elevated`: `#302c2c`
  - `ink`: `{ DEFAULT: '#201d1d', deep: '#0f0000' }`
  - `charcoal`: `#302c2c`
  - `body`: `#424245`
  - `mute`: `#646262`
  - `stone`: `#6e6e73`
  - `ash`: `#9a9898`
  - `hairline`: `{ DEFAULT: 'rgba(15,0,0,0.12)', strong: '#646262' }`
  - `on-primary`: `#fdfcfc`
  - `on-dark`: `{ DEFAULT: '#fdfcfc', mute: '#9a9898' }`
  - `accent`: `{ DEFAULT: '#007aff', hover: '#0056b3', active: '#004085' }`
  - `danger`: `{ DEFAULT: '#ff3b30', hover: '#d70015', active: '#a50011' }`
  - `warning`: `{ DEFAULT: '#ff9f0a', hover: '#cc7f08', active: '#995f06' }`
  - `success`: `'#30d158'`
- Font Family:
  - All three families (`mono`, `sans`, `display`) resolve to the Berkeley Mono / JetBrains Mono / IBM Plex Mono monospace stack.
- Radius:
  - `none: '0px'`, `sm: '4px'`, `full: '9999px'`.
- Shadow:
  - `none: 'none'`.

## 4. Icon to ASCII Replacements
- Group accordion toggles: `▼` / `▶` → `[+]` / `[-]`
- Bookmark indicator in table: `📌` → `[x]` when bookmarked, `[+]` when not
- Document row actions:
  - Open button → `[>] Open`
  - Reveal button (`📂`) → `[~] Reveal`
  - Preview button (`👁️`) → `[!] Preview`
  - Bookmark button (`📌`) → `[+] Bookmark`
- Context Menu:
  - Standard action items prefixed with `[>]`
  - Danger / remove actions prefixed with `[!]`
  - Selection / toggle states prefixed with `[x]`
- Toasts:
  - Notification icon → `[+]` prefix

## 5. Playwright Verification Plan
- Implement `scripts/verify-responsive.mjs` testing 7 viewports:
  1. `mobile-sm` (375x812)
  2. `mobile` (414x896)
  3. `tablet-narrow` (768x1024)
  4. `tablet` (850x1024)
  5. `desktop` (1280x900)
  6. `desktop-lg` (1440x900)
  7. `desktop-xl` (1920x1080)
- Validation criteria on every viewport:
  - No horizontal page overflow (`scrollWidth <= innerWidth`)
  - No vertical page overflow (`scrollHeight <= innerHeight`)
  - Body background color strictly `#fdfcfc` (`rgb(253, 252, 252)`)
  - No text overflow on headers, buttons, or table cells (`scrollWidth <= clientWidth + 2`)
  - Zero `pageerror` events
