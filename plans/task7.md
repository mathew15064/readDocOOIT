# Implementation Plan — Task 7: Dark Mode Migration (Binance-derived Palette) + Bug Fixes

## 1. Files to Change
- `public/index.html` (Tailwind config, Google Fonts link, body classes, header, toolbar, documents table, sidebar, all 7 modals)
- `public/css/claude.css` (reset font family, set dark body background `#0b0e11`, update scrollbar thumb and track)
- `public/js/toast.js` (update toast card styling to `bg-surface-card text-body font-sans rounded-lg shadow-lg` with semantic border-l-4)
- `public/js/context-menu.js` (update context menu container to `bg-surface-card border border-hairline-strong rounded-lg shadow-2xl`, item hover to `hover:bg-surface-elevated`, inline background fallback `#1e2329`)
- `scripts/verify-responsive.mjs` (update expected `bodyBg` assertion to `rgb(11, 14, 17)`)
- `scripts/capture-screenshots.mjs` (verify capture suite for 16 PNGs on dark theme)
- `docs/ARCHITECTURE.md` (add ADR: Dark Mode Migration with Binance-derived palette)
- `docs/LESSONS.md` (append lessons learned on modal transparency fallbacks, migration churn, and body typography)
- `docs/PROJECT_STATE.md` (record Phase 7 completion)

---

## 2. Token Mapping Table

| OpenCode Token (Light/Cream) | Old Hex / Role | New Dark Token (Binance-derived) | New Hex / Role |
| :--- | :--- | :--- | :--- |
| `canvas` | `#fdfcfc` (cream floor) | `canvas` | `#0b0e11` (dark page floor) |
| `surface-soft` | `#f8f7f7` (light surface) | `surface-soft` | `#15191e` (subtle alt-row / sidebar background) |
| `surface-card` | `#f1eeee` (pill/panel) | `surface-card` | `#1e2329` (cards, elevated modal panels, inputs) |
| `surface-dark` / `elevated` | `#201d1d` / `#302c2c` | `surface-elevated` | `#2b3139` (nested cards, header rows, hover states) |
| `ink` | `#201d1d` (primary text / CTA) | `body` / `on-dark` | `#eaecef` (body text) / `#ffffff` (headlines) |
| `text-ink` | `#201d1d` | `text-body` / `text-white` | `#eaecef` (default text) / `#ffffff` (headings/titles) |
| `on-primary` | `#fdfcfc` (light text on ink) | `on-primary` | `#181a20` (dark text on yellow CTA) |
| `bg-ink` | `#201d1d` (primary CTA) | `bg-primary` | `#fcd535` (Binance yellow primary CTA) |
| `hover:bg-ink-deep` | `#0f0000` | `hover:bg-primary-active` | `#f0b90b` (active Binance yellow) |
| `hairline` | `rgba(15,0,0,0.12)` | `hairline` | `#2b3139` (standard border) |
| `hairline-strong` | `#646262` | `hairline-strong` | `#3a4149` (emphasized border / modal outline) |
| `text-muted-soft` / `text-mute` | `#646262` | `text-muted` | `#707a8a` (metadata, captions, timestamps) |
| `text-stone` / `text-ash` | `#6e6e73` / `#9a9898` | `text-muted-strong` | `#929aa5` (emphasized muted text) |
| `accent` | `#007aff` (Apple Blue) | `primary` / `info` | `#fcd535` (actions/highlights) / `#3b82f6` (blue focus rings) |
| `success` | `#30d158` / `#1a7f37` | `success` | `#0ecb81` (trading green — LATEST badge) |
| `danger` / `error` | `#ff3b30` / `#7a4a00` | `danger` | `#f6465d` (trading red — OUTDATED / destructive) |
| `warning` | `#ff9f0a` | `warning` | `#ff9f0a` (caution badge) |
| `font-sans` | Berkeley Mono stack | `font-sans` | Inter, system-ui, sans-serif (all UI text) |
| `font-mono` | Berkeley Mono stack | `font-mono` | JetBrains Mono (numbers, paths, code only) |
| `rounded-none` / `rounded-sm` | 0px / 4px flat | `rounded-md` / `rounded-lg` / `rounded-xl` | 6px / 8px / 12px (subtle rounded aesthetic) |

---

## 3. Components for Manual Review
1. **Header**: Title "Doc Reader" in `font-sans text-[20px] font-semibold text-white`, subtitle in `text-muted`, buttons in `bg-primary text-on-primary` and `bg-surface-card text-body border border-hairline`.
2. **Search & Filter Toolbar**: Input in `bg-surface-card text-body border-hairline`, focus ring `focus:ring-2 focus:ring-info/30`, dropdown menus with dark elevated background.
3. **Documents Table**: `thead` in `bg-surface-elevated text-muted`, rows in `bg-canvas hover:bg-surface-card border-hairline`, filename in `font-sans text-body`, path in `font-mono text-muted`, version number in `font-mono text-body bg-surface-elevated border border-hairline`, action buttons with responsive glyphs.
4. **Sidebar (Bookmark Groups)**: `aside` in `bg-surface-soft border-hairline`, group cards in `bg-surface-card border-hairline hover:bg-surface-elevated`, group name in `font-sans text-body`, outdated notices in `border-danger/40 text-danger`.
5. **7 Modals**:
   - Add Bookmark Modal
   - Manage Groups Modal
   - Rescan Directory Modal
   - Version History Modal
   - Global Tag Management Modal
   - Bookmark Group Full View Modal
   - Web File Preview Modal (code view on `bg-canvas`, Excel table in `bg-surface-card`)
   - *All panels have `style="background-color: #1e2329;"` inline fallback and `bg-black/70 backdrop-blur-sm` backdrop.*
6. **Toast Notifications**: `public/js/toast.js` with `bg-surface-card text-body border-l-4`.
7. **Context Menu**: `public/js/context-menu.js` with `bg-surface-card border-hairline-strong rounded-lg shadow-2xl` and `style="background-color: #1e2329;"`.

---

## 4. List of 4 Bugs to Fix
1. **Bug 1: Modal panels transparent**:
   - Ensure all 7 modal panels have `bg-surface-card border border-hairline-strong rounded-xl shadow-2xl` and inline `style="background-color: #1e2329;"`.
   - Update backdrops to `bg-black/70 backdrop-blur-sm`.
2. **Bug 2: LATEST badge overflows version column**:
   - Expand VERSION column `<th>` and `<td>` from `w-24` to `w-32`.
   - Mobile badge hides text and shows dot: `<span class="sm:hidden inline-block w-2 h-2 rounded-full bg-success"></span><span class="hidden sm:inline">LATEST</span>`.
3. **Bug 3: Mobile actions column clipped (`Oper` instead of `[>] Open`)**:
   - Actions `<td>`: use `md:whitespace-nowrap` (allowing wrap on mobile).
   - Wrap button text labels with `<span class="hidden md:inline"> Open</span>` so only `[>]` / `[~]` / `[!]` glyphs show on mobile.
4. **Bug 4: Colored version tags for readability**:
   - LATEST badge: `font-sans text-[11px] font-bold uppercase tracking-wider bg-success/15 text-success border border-success/40 px-2 py-0.5 rounded-full`.
   - OUTDATED badge: `font-sans text-[11px] font-bold uppercase tracking-wider bg-danger/15 text-danger border border-danger/40 px-2 py-0.5 rounded-full`.
   - Version pill: `font-mono text-[13px] text-body bg-surface-elevated border border-hairline px-2 py-0.5 rounded-md`.

---

## 5. Playwright Checks Planned
1. **Responsive Audit (`scripts/verify-responsive.mjs`)**:
   - Update body background assertion to check `rgb(11, 14, 17)`.
   - Test across all 7 viewports (375x812, 414x896, 768x1024, 850x1024, 1280x900, 1440x900, 1920x1080).
   - Verify 0 horizontal page overflow (`overflowX: false`), 0 element text clipping, 0 page errors.
2. **Screenshot Suite (`scripts/capture-screenshots.mjs`)**:
   - Re-capture all 16 screenshots covering every viewport and interactive flow on the new dark UI.
   - Verify all modal panels render opaque `#1e2329`.
