# MovieTime — UI/UX/IxD Redesign

**Date:** 2026-05-26
**Scope:** Full design system overhaul — visual, interaction, and motion. No business logic or data changes.

---

## 1. Design Direction

### Theme: Obsidian Dark
Deep dark backgrounds with purple/cyan accent palette. Premium tech aesthetic. All existing functionality and content is preserved exactly — only presentation changes.

**Background layers:**
- `--bg-base: #0a0a0f` — page background
- `--bg-surface: #0f0f1a` — cards, panels
- `--bg-elevated: #111118` — table rows, inputs, nested elements

**Accent palette:**
- `--accent-primary: #7c3aed` — purple, primary actions, active states
- `--accent-primary-light: #8b5cf6` — hover states
- `--accent-primary-muted: #a78bfa` — text on dark, secondary labels
- `--accent-cyan: #06b6d4` — secondary data, alternate series
- `--accent-green: #10b981` — success, active status
- `--accent-green-text: #34d399` — success text
- `--accent-amber: #f59e0b` — warning, expiring soon
- `--accent-amber-text: #fbbf24` — warning text
- `--accent-red: #ef4444` — danger, expired, churn
- `--accent-red-text: #f87171` — danger text
- `--accent-blue: #3b82f6` — info, clients series
- `--accent-blue-text: #60a5fa` — info text
- `--accent-pink: #ec4899` — resellers series
- `--accent-pink-text: #f472b6` — resellers text

**Border & dividers:**
- `--border-subtle: #1e1e30` — standard borders
- `--border-medium: #2a2a40` — elevated borders
- `--border-purple: #2a1f50` — card borders with purple tint
- `--border-focus: #7c3aed40` — focus rings, glow accents

**Text:**
- `--text-primary: #e2e8f0` — headings, values
- `--text-secondary: #94a3b8` — body, row text
- `--text-muted: #6b7280` — labels, subtitles
- `--text-faint: #4b5563` — axis labels, placeholders
- `--text-disabled: #3d3d55` — section headers, divider labels

---

## 2. Typography Scale

Single font stack: `system-ui, -apple-system, "Segoe UI", sans-serif`

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-page-title` | 20px | 700 | Page `<h1>` |
| `--text-section-title` | 14px | 600 | Section headings, card titles |
| `--text-metric-value` | 24px | 700 | KPI numbers |
| `--text-metric-label` | 10px | 500 | KPI labels (uppercase, 0.8px spacing) |
| `--text-metric-delta` | 11px | 600 | % change indicators |
| `--text-body` | 13px | 400 | Table cells, body text |
| `--text-small` | 11px | 400 | Secondary info |
| `--text-xs` | 10px | 400 | Badges, timestamps |
| `--text-label` | 9px | 600 | Section labels (uppercase, 1px spacing) |

---

## 3. Spacing System

All spacing uses a 4px base grid. Named tokens:

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight internal gaps |
| `--space-2` | 8px | Icon-to-text gaps, badge padding |
| `--space-3` | 12px | Card internal padding (compact) |
| `--space-4` | 16px | Card internal padding (standard) |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Page-level padding |
| `--space-8` | 32px | Major section separation |

---

## 4. Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Badges, tags, small chips |
| `--radius-md` | 8px | Buttons, inputs, table rows |
| `--radius-lg` | 12px | Cards, panels |
| `--radius-xl` | 16px | Modal dialogs |
| `--radius-full` | 9999px | Pill buttons, round badges |

---

## 5. Component Specs

### 5.1 Buttons

Three variants, all pill-shaped (`border-radius: 9999px`):

**Primary**
```
background: linear-gradient(135deg, #8b5cf6, #7c3aed)
color: #ffffff
padding: 8px 18px
font-size: 13px, font-weight: 600
box-shadow: 0 0 12px #7c3aed50
border: none
transition: transform 0.1s ease, box-shadow 0.1s ease
hover: translateY(-1px) scale(1.02), box-shadow → 0 0 20px #7c3aed70
active: scale(0.97)
```

**Secondary**
```
background: transparent
color: #c4b5fd
border: 1px solid #7c3aed50
padding: 8px 18px
font-size: 13px, font-weight: 500
box-shadow: 0 0 8px #7c3aed20
hover: background #7c3aed15, border-color #7c3aed80
```

**Ghost**
```
background: #ffffff08
color: #94a3b8
border: 1px solid #ffffff10
padding: 8px 18px
font-size: 13px, font-weight: 500
hover: background #ffffff12, color #e2e8f0
```

**Icon button (square)**
```
width: 36px, height: 36px, border-radius: 8px
background: #ffffff08, border: 1px solid #1e1e30
hover: background #7c3aed15, border-color #7c3aed40
```

### 5.2 Badges / Status chips

All pill-shaped (`border-radius: 9999px`), `font-size: 10px`, `font-weight: 600`, `padding: 3px 10px`, uppercase off.

| Variant | Background | Text | Border | Glow |
|---|---|---|---|---|
| Active / Activo | `#10b98118` | `#34d399` | `1px solid #10b98135` | `0 0 6px #10b98125` |
| Warning / Por vencer | `#f59e0b18` | `#fbbf24` | `1px solid #f59e0b35` | `0 0 6px #f59e0b25` |
| Danger / Vencido | `#ef444418` | `#f87171` | `1px solid #ef444435` | `0 0 6px #ef444425` |
| Info / Pendiente | `#3b82f618` | `#60a5fa` | `1px solid #3b82f635` | `0 0 6px #3b82f625` |
| Purple / default | `#7c3aed18` | `#c4b5fd` | `1px solid #7c3aed35` | `0 0 6px #7c3aed25` |
| Neutral | `#ffffff0a` | `#6b7280` | `1px solid #ffffff12` | none |

### 5.3 Inputs & Selects

```
background: #111118
border: 1px solid #2a2a40
border-radius: 8px
padding: 9px 12px
font-size: 13px, color: #e2e8f0
placeholder: #4b5563
transition: border-color 0.15s ease, box-shadow 0.15s ease
focus: border-color #7c3aed, box-shadow: 0 0 0 3px #7c3aed20
```

Search inputs get a magnifier icon left-aligned with `padding-left: 36px`.

### 5.4 Metric Cards

```
background: linear-gradient(135deg, #111118, #0f0f1e)
border: 1px solid #2a1f50
border-radius: 12px
padding: 16px 20px
min-width: 0
```

Internal layout (top to bottom):
1. Label: `font-size: 10px`, uppercase, `letter-spacing: 0.8px`, `color: #4b5563`, `margin-bottom: 8px`
2. Value: `font-size: 24px`, `font-weight: 700`, `color: #e2e8f0`, `line-height: 1`
3. Delta row: `margin-top: 6px`, icon + percentage, `font-size: 11px`, `font-weight: 600`
   - Positive: `color: #34d399`, prefix `▲`
   - Negative: `color: #f87171`, prefix `▼`
   - Neutral: `color: #67e8f9`

Metrics grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px`

Hover: `border-color: #7c3aed50; box-shadow: 0 4px 20px #7c3aed15; transform: translateY(-2px)` — transition 0.15s ease.

### 5.5 DataTable

**Table container:**
```
background: #0f0f1a
border: 1px solid #1e1e30
border-radius: 12px
overflow: hidden
```

**Header row:**
```
background: #111118
border-bottom: 1px solid #1e1e30
padding: 10px 16px per cell
font-size: 10px, font-weight: 600, uppercase, letter-spacing: 0.8px
color: #4b5563
```

**Data rows:**
```
padding: 12px 16px per cell
border-bottom: 1px solid #1a1a28
font-size: 13px, color: #94a3b8
transition: background 0.1s ease
hover: background #7c3aed08
```

Last row has no border-bottom.

**Column alignment:**
- Text columns: left-aligned
- Currency/number columns: right-aligned
- Status badges: centered
- Action buttons: right-aligned, `gap: 6px`

**Toolbar (above table):**
```
display: flex; align-items: center; gap: 10px; margin-bottom: 16px
```
- Left: search input (flex-grow) + filter button
- Right: action buttons (primary CTA last)
- Stack vertically on mobile (< 640px)

**Pagination footer:**
```
padding: 12px 16px
border-top: 1px solid #1e1e30
display: flex; justify-content: space-between; align-items: center
font-size: 11px, color: #4b5563
```
Page buttons: ghost variant, `width: 32px, height: 32px`, current page gets primary style.

**Empty state:**
```
padding: 48px 24px, text-align: center
icon: 40px, color: #3d3d55
title: font-size: 14px, color: #6b7280, margin-top: 12px
subtitle: font-size: 12px, color: #4b5563, margin-top: 4px
CTA button: secondary variant, margin-top: 16px
```

### 5.6 DropdownMenu

**Content container:**
```
background: #111120
border: 1px solid #2a1f50
border-radius: 12px
padding: 6px
min-width: 196px
box-shadow: 0 8px 32px #00000060, 0 0 0 1px #7c3aed18, 0 0 24px #7c3aed10
```

**Open animation:**
```css
@keyframes dropIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
animation: dropIn 0.12s ease forwards
```

**Section labels:**
```
font-size: 9px, font-weight: 600, uppercase, letter-spacing: 1px
color: #3d3d55, padding: 4px 10px 6px
```

**Items:**
```
display: flex, align-items: center, gap: 9px
padding: 8px 10px, border-radius: 8px
font-size: 13px, color: #94a3b8
transition: background 0.1s ease, color 0.1s ease
hover: background #7c3aed15, color #e2e8f0
hover icon: color #a78bfa
```

**Shortcut chips (optional):**
```
margin-left: auto, font-size: 10px, color: #3d3d55
background: #ffffff08, border: 1px solid #ffffff0d
border-radius: 4px, padding: 1px 5px
```

**Destructive variant:**
```
color: #f87171, icon color: #ef444430
hover: background #ef444415, color #f87171, icon color #f87171
```

**Separator:**
```
height: 1px, background: #1e1e30, margin: 4px 0
```

### 5.7 Cards (generic panels)

```
background: linear-gradient(135deg, #111118, #0f0f1e)
border: 1px solid #2a1f50
border-radius: 14px
padding: 20px
box-shadow: 0 0 20px #7c3aed08
```

Card header: `display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px`
Card title: `font-size: 14px, font-weight: 600, color: #c4b5fd`
Card subtitle: `font-size: 11px, color: #4b5563, margin-top: 2px`

### 5.7 Page Layout

```
Page wrapper: padding: 24px (desktop), 16px (mobile)
Page header: margin-bottom: 24px
  ├─ h1: font-size: 20px, font-weight: 700, color: #e2e8f0
  ├─ subtitle: font-size: 13px, color: #6b7280, margin-top: 4px
  └─ actions row: margin-top: 16px OR float right on desktop
Metrics grid: margin-bottom: 24px
Content area: display: flex, flex-direction: column, gap: 20px
```

---

## 6. Sidebar

### Structure
- **Expanded mode** (default desktop): 220px wide, icons + labels + section groups + notification badges
- **Compact mode**: 56px wide, icons only + tooltips on hover
- Toggle button: chevron icon, positioned at bottom of sidebar
- State persisted in `localStorage` key `sidebar-collapsed`

### Expanded layout
```
width: 220px
background: #0d0d18
border-right: 1px solid #1e1e30
padding: 16px 10px
display: flex, flex-direction: column, gap: 4px
```

Logo area (top):
```
display: flex, align-items: center, gap: 10px
padding: 4px 6px, margin-bottom: 16px
logo-icon: 26px × 26px, border-radius: 8px, gradient #7c3aed → #4f46e5
logo-text: font-size: 14px, font-weight: 700, color: #e2e8f0
```

Section labels:
```
font-size: 9px, font-weight: 600, uppercase, letter-spacing: 1px
color: #3d3d55, padding: 10px 8px 4px
```

Nav items:
```
display: flex, align-items: center, gap: 10px
padding: 8px 10px, border-radius: 8px
font-size: 13px, color: #6b7280
transition: background 0.1s ease, color 0.1s ease
hover: background #ffffff08, color: #94a3b8
active: background linear-gradient(90deg, #7c3aed22, transparent)
        color: #c4b5fd, box-shadow: inset 3px 0 0 #7c3aed
```

Notification badge on nav item:
```
margin-left: auto
font-size: 9px, font-weight: 700
background: #ef444420, color: #f87171
border: 1px solid #ef444435
border-radius: 9999px, padding: 1px 6px
```

User area (bottom):
```
margin-top: auto, padding-top: 12px
border-top: 1px solid #1e1e30
display: flex, align-items: center, gap: 10px, padding: 8px 6px
avatar: 30px circle, gradient #7c3aed → #06b6d4
name: font-size: 12px, color: #94a3b8
online dot: 6px circle, #10b981, glow 0 0 6px #10b98160
```

### Compact layout
```
width: 56px
padding: 16px 8px
```
Nav items: `width: 40px, height: 40px, justify-content: center, border-radius: 10px`
Tooltips: native `title` attribute or custom portal tooltip on hover, `background: #1a1a2e, border: 1px solid #2a2a40, border-radius: 6px, padding: 5px 10px, font-size: 11px`

### Toggle button
```
position: absolute, bottom: 16px, right: -12px
width: 24px, height: 24px, border-radius: 50%
background: #1a1a2e, border: 1px solid #2a2a40
color: #6b7280
hover: background #7c3aed20, border-color #7c3aed50, color: #c4b5fd
transition: transform 0.2s ease (rotates 180° when collapsed)
```

---

## 7. Charts

### Color series (replaces current hardcoded colors)
```
Series 1 (Ingresos / primary):  stroke #a78bfa, fill gradient #8b5cf6 → transparent
Series 2 (Gastos / negative):   stroke #f87171, fill gradient #ef4444 → transparent, opacity 0.8
Series 3 (Clientes):            stroke #60a5fa, fill gradient #3b82f6 → transparent
Series 4 (Revendedores):        stroke #f472b6, fill gradient #ec4899 → transparent
Series 5+ (categories):         [#a78bfa, #67e8f9, #34d399, #fbbf24, #f472b6, #60a5fa, #fb923c]
Negative bars (churn/lost):     #ef4444, opacity 0.75
Positive bars (ganados):        #10b981, opacity 0.85
```

### Grid & axes
```
CartesianGrid: stroke #1e1e30, strokeDasharray "3 3"
XAxis/YAxis tick: fill #4b5563, fontSize 10
```

### Tooltips
```
background: #1a1a2e
border: 1px solid #7c3aed40
border-radius: 10px
padding: 10px 14px
box-shadow: 0 4px 24px #00000060, 0 0 16px #7c3aed20
title: font-size 10px, color #6b7280
row label: font-size 11px, color #94a3b8
row value: font-size 11px, font-weight 600, color matches series
```

### CSS chart tokens (globals.css .dark)
```
--chart-1: oklch(0.60 0.22 295)   /* purple */
--chart-2: oklch(0.60 0.18 195)   /* cyan */
--chart-3: oklch(0.62 0.18 155)   /* green */
--chart-4: oklch(0.72 0.18 80)    /* amber */
--chart-5: oklch(0.65 0.22 340)   /* pink */
```

---

## 8. Animations & Motion

### Interaction animations (Snappy — 100–150ms)

**Buttons:**
```css
transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.1s ease;
:hover  { transform: translateY(-1px) scale(1.02); }
:active { transform: scale(0.97); transition-duration: 0.05s; }
```

**Metric cards:**
```css
transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
:hover { transform: translateY(-2px); }
```

**Table rows:**
```css
transition: background 0.1s ease;
:hover { background: #7c3aed08; }
```

**Sidebar nav items:**
```css
transition: background 0.1s ease, color 0.1s ease;
```

**Sidebar collapse:**
```css
transition: width 0.2s ease;
/* inner labels */
transition: opacity 0.15s ease, transform 0.15s ease;
collapsed labels: opacity 0, transform: translateX(-4px), pointer-events: none
```

### Page load animation (Skeleton → Crossfade)

Each page section (metrics grid, tables, charts) renders a skeleton during data fetch, then crossfades to real content:

```
Skeleton shimmer:
  background: linear-gradient(90deg, #1a1a2a 25%, #252535 50%, #1a1a2a 75%)
  background-size: 800px 100%
  animation: shimmer 1.4s infinite linear

Content reveal:
  animation: contentFadeIn 0.3s ease forwards
  @keyframes contentFadeIn { from { opacity: 0 } to { opacity: 1 } }
```

Skeleton shapes:
- Metric card skeleton: same dimensions as card (`border-radius: 12px`, `height: 88px`)
- Table row skeleton: `height: 44px`, `border-radius: 6px`, `margin-bottom: 4px`
- Chart skeleton: exact dimensions of chart card

Existing `<Skeleton>` components from shadcn/ui are used — only colors and animations are updated.

### Page transitions (Crossfade — 200ms)

Uses Next.js View Transitions API (`next/navigation` + CSS `view-transition`):
```css
::view-transition-old(root) {
  animation: 0.2s ease both fade-out;
}
::view-transition-new(root) {
  animation: 0.2s ease both fade-in;
}
@keyframes fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes fade-in  { from { opacity: 0 } to { opacity: 1 } }
```

---

## 9. Standardization Rules

These rules apply uniformly across ALL pages — no exceptions:

### Spacing between elements
- Page edge → content: `24px` (desktop), `16px` (mobile)
- Page title → metrics grid: `24px`
- Metrics grid → first table/chart: `24px`
- Between two sections (table + chart, chart + table): `20px`
- Toolbar → table: `16px`
- Table → pagination: `0` (pagination is inside table card)
- Card title → card content: `16px`

### DataTable column standards
- Minimum column width: `120px`
- ID/short columns: `80px` fixed
- Name columns: flex-grow
- Amount columns: `120px`, right-aligned
- Status column: `110px`, centered
- Actions column: `80px`, right-aligned, visible on hover or always

### Page header standards
Every page has:
1. `<h1>` — page title
2. Optional subtitle (1 line max)
3. Optional actions row (right-aligned on desktop, full-width on mobile)

No page has a redundant breadcrumb AND a title — pick one.

### Form standards
- Label above input always (never placeholder-only)
- `gap: 16px` between form fields
- Required marker: `*` in `color: #f87171`, after label
- Error messages: `font-size: 11px`, `color: #f87171`, `margin-top: 4px`
- Submit button: right-aligned, primary variant
- Cancel: left of submit, ghost variant

### Dialog / Modal standards
```
max-width: 480px (form dialogs), 640px (detail dialogs)
border-radius: 16px
background: #0f0f1a
border: 1px solid #2a1f50
box-shadow: 0 24px 80px #00000080, 0 0 40px #7c3aed15
header: font-size 16px, font-weight 700, color #e2e8f0, padding 20px 24px 0
body: padding 20px 24px
footer: padding 16px 24px, border-top 1px solid #1e1e30, display flex, justify-content flex-end, gap 8px
```

Overlay: `background: #00000070, backdrop-filter: blur(4px)`

---

## 10. Implementation Scope

### Files to modify (no new files unless strictly needed)

| File | Change |
|---|---|
| `src/app/globals.css` | Full rewrite of CSS variables, component classes, animation keyframes, skeleton styles, view-transition rules |
| `src/components/ui/button.tsx` | Update variants to Glow Pill style |
| `src/components/ui/badge.tsx` | Update variants to new status tokens |
| `src/components/ui/input.tsx` | Update focus ring and border styles |
| `src/components/ui/card.tsx` | Update background, border, radius tokens |
| `src/components/ui/skeleton.tsx` | Update shimmer animation colors |
| `src/components/ui/table.tsx` | Update header, row, hover styles |
| `src/components/ui/dialog.tsx` | Update overlay, container, border styles |
| `src/components/ui/dropdown-menu.tsx` | Update content, items, labels, separator, open animation |
| `src/components/Sidebar.tsx` | Add collapse toggle, expanded/compact modes, localStorage persistence |
| `src/components/shared/MetricCard.tsx` | Update layout, spacing, delta indicator |
| `src/components/shared/DataTable.tsx` | Standardize toolbar, rows, pagination spacing |
| `src/components/dashboard/IngresosVsGastosChart.tsx` | Update color series and tooltip styles |
| `src/components/dashboard/CrecimientoTercerosChartView.tsx` | Update color series |
| `src/components/dashboard/RevenueByCategoryChart.tsx` | Replace REVENUE_CATEGORY_COLORS array |
| `src/app/(dashboard)/layout.tsx` | Add view-transition meta tag, crossfade CSS |
| All page `page.tsx` files | Ensure consistent page header structure (h1 + subtitle + actions) |

### What does NOT change
- All Supabase queries, hooks, use-cases, repositories
- All form validation logic (Zod schemas)
- All business rules
- All data structures and TypeScript types
- All routing and authentication logic
- URL structure

---

## 11. Out of scope
- Dark/light mode toggle (stays dark only for now)
- Mobile-specific redesign beyond responsive adjustments
- New pages or features
- Performance optimizations beyond what CSS changes naturally provide
