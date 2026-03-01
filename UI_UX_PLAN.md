# HomeBlend UI/UX Redesign Plan

**Brand colors:** Ivory `#FFF2E1` · Donkey Brown `#A79277` · Gold `#A67C3D`  
**Principle:** No full-width bars spanning the screen for a single item. Clean, spatial, progressive disclosure.

---

## Core Principles

- **No full-width horizontal bars** — convert every bloated row into compact spatial clusters
- **Progressive disclosure** — surface only what's needed; hide depth behind lightweight triggers
- **Token-consistent palette** — Ivory `#FFF2E1` as base warmth, Donkey Brown `#A79277` as muted tone & structure, Gold `#A67C3D` strictly for interactive / CTA accents

---

## 1 — Brand Token Update (`Brand.jsx`)

| Token | Current | New | Why |
|---|---|---|---|
| `bg` | `#F3EDE3` | `#FFF2E1` | Matches true Ivory |
| `bgCard` | `rgba(249,244,236,0.95)` | `rgba(255,255,255,0.9)` | Cleaner card whites on ivory |
| `muted` | `#8C7056` | `#A79277` | Donkey Brown as the muted voice |
| `border` | `rgba(166,124,61,0.22)` | `rgba(167,146,119,0.25)` | Softer, derived from Donkey Brown |

---

## 2 — Header

**Problem:** Logo + nav toggle + spacer + divider + avatar + name text + sign-out button — all crammed into one 54px horizontal strip.

**Fix (height 48px):**
- **Left cluster:** Logo mark + wordmark only
- **Center:** Remove Discover/Saved toggle from header entirely — move into the top of the left properties panel as a floating segmented control that doesn't span full width
- **Right cluster:** Avatar circle (initial only, no name text inline) — clicking opens a 3-item popover (display name · avatar color · sign out). Eliminates two elements from the bar.
- Remove the vertical separator divider; breathing room replaces it.

```
┌──────────────────────────────────────────────┐
│ ⌂ HomeBlend              [Discover · Saved]  [👤] │  ← 48px
└──────────────────────────────────────────────┘
```

---

## 3 — Left Panel Sub-header

**Problem:** Full-width location `<input>` + full-width count row stacked below = two horizontal slabs eating vertical space.

**Fix — single compact row (42px):**

```
[ 📍 Irvine, CA ]  ·  70 properties        [≡ Filters · 2 ▾]
```

- Location becomes a **read-only pill chip** (auto-width, not `width: 100%`)
- Count text inline in the same row
- Filter button right-aligned
- Saves ~30px vertical space

---

## 4 — Filter Sheet

**Problem:** Expands inline, pushing card list down. Six full-width sections feel like an accordion eating the panel.

**Fix — floating card (not inline):**
- Sheet anchors below the filter button, floats over the card list with a soft drop shadow
- Width: **280px**, `position: absolute`, `z-index: 50`
- Interior uses a **2-column grid** for most controls

```
┌──────────────────────────────┐
│ Type              Sort       │
│ ○ All  ○ Apt    ○ Best ○ $↑  │
│ ○ Condo ○ SFH   ○ $↓  ○ New │
├──────────────────────────────┤
│ Max Rent              $3,500 │
│ ────────●──────────────────  │
├──────────────────────────────┤
│ Beds   [Any] [1+] [2+] [3+]  │
│ Baths  [Any] [1+] [2+] [2.5+]│
├──────────────────────────────┤
│  🐾 Pets  🚗 Parking  🧺 W/D │  ← 3-col icon toggle row
├──────────────────────────────┤
│                 [Reset all]  │
└──────────────────────────────┘
```

---

## 5 — Property Cards

**Stats row (currently: divider-bar grid):**
- Replace the bordered stat cells with inline separator text: `2 bd · 2 ba · 1,200 sqft`
- No horizontal strip — just a single text line

**Price display:**
- Move price to a small badge chip overlay on the hero image (top-left), consistent with the modal style
- Remove the text block beneath the image

**Selected state:**
- Left border accent: `3px solid #A67C3D`
- Very subtle inner shadow: `inset 2px 0 0 rgba(166,124,61,0.15)`

**Drag state:**
- Faint Donkey Brown glow: `box-shadow: 0 0 0 2px rgba(167,146,119,0.4)`

---

## 6 — Rooms Panel Interior

**Problem:** Create/Join buttons stretch full-width, stacked. Drop zones are wide bordered blocks.

**Fix:**
- **Create & Join** as a side-by-side equal-width pair of compact buttons — not full-width stacked blocks
- Room cards: replace full border with a **4px left accent bar** in `#A79277` — lighter, editorial feel
- "Create new room" drop zone: `max-width: 90%`, centered (`margin: 0 auto`), dashed border — not wall-to-wall
- Rooms panel pull tab: keep room count badge but use a **subtle dot indicator** instead of a filled circle

```
  [+ Create room]  [↗ Join room]   ← side-by-side, ~45% width each
```

---

## 7 — Typography Tightening

| Element | Current | New |
|---|---|---|
| Section labels (e.g. "PROPERTY TYPE") | `8px / 700` | `9px / 600` — slightly larger, less illegible |
| Card title | `Cormorant Garamond, weight 500` | `weight 400` (lighter = more premium) |
| Muted text color | `#8C7056` | `#A79277` (Donkey Brown — unifies with border system) |
| Price text | large bold below image | chip overlay on hero image |

---

## Implementation Order

| # | Area | Files | Effort |
|---|---|---|---|
| 1 | Brand tokens | `Brand.jsx` | ~5 min |
| 2 | Header collapse + avatar popover | `Dashboard.jsx` | ~20 min |
| 3 | Left panel sub-header (single row) | `Dashboard.jsx` | ~10 min |
| 4 | Filter sheet → floating card | `Dashboard.jsx` | ~20 min |
| 5 | Property card stats row + price chip | `Dashboard.jsx` (PropertyCard) | ~15 min |
| 6 | Rooms panel create/join side-by-side | `Dashboard.jsx` | ~10 min |
| 7 | Typography pass | `Dashboard.jsx`, `Brand.jsx` | ~10 min |

**Total estimated time: ~1.5 hours**

---

## What This Is Not

- No new dependencies
- No layout structural changes (3-column layout stays)
- No functionality removed — only cosmetic/spatial improvements
- No full redesigns of the property expand modal (already clean)
