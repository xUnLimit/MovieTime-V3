# UI/UX/IxD Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el design system Obsidian Dark completo a MovieTime — colores, tipografía, espaciado, componentes, sidebar colapsable, animaciones y transiciones de página — sin tocar ninguna lógica de negocio ni datos.

**Architecture:** Todas las tareas son cambios de presentación pura. Se empieza por los tokens CSS en globals.css (fuente de verdad), luego los componentes primitivos de shadcn/ui, luego los componentes de negocio (MetricCard, DataTable, Sidebar), luego los charts, y finalmente el layout y page transitions.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, shadcn/ui (Radix UI), CVA, Recharts, Lucide React, Zustand (solo para sidebar state)

**Spec:** `docs/superpowers/specs/2026-05-26-ui-ux-redesign-design.md`

---

## Orden de tareas

1. globals.css — tokens + keyframes + skeleton + view-transition
2. button.tsx — Glow Pill variants
3. badge.tsx — status variants con glow
4. input.tsx — focus ring purple
5. card.tsx — gradiente + borde purple
6. skeleton.tsx — shimmer Obsidian
7. table.tsx — header/row/hover Obsidian
8. dialog.tsx — overlay blur + borde purple
9. dropdown-menu.tsx — Obsidian + animación
10. MetricCard.tsx — nuevo layout spec
11. DataTable.tsx — toolbar + spacing estandarizado
12. Sidebar.tsx — colapsable expanded/compact
13. Charts — paleta Obsidian (3 archivos)
14. Dashboard layout — view-transition + page padding
15. Commit final

---

## Task 1: globals.css — Design tokens, keyframes, skeleton, view-transition

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Reemplazar el bloque `.dark { }` con los nuevos tokens Obsidian**

Reemplazar el bloque `.dark { ... }` existente con:

```css
.dark {
  --background: #0a0a0f;
  --foreground: #e2e8f0;
  --card: #0f0f1a;
  --card-foreground: #e2e8f0;
  --popover: #111120;
  --popover-foreground: #e2e8f0;
  --primary: #7c3aed;
  --primary-foreground: #ffffff;
  --secondary: #111118;
  --secondary-foreground: #94a3b8;
  --muted: #111118;
  --muted-foreground: #6b7280;
  --accent: #7c3aed15;
  --accent-foreground: #c4b5fd;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #1e1e30;
  --input: #2a2a40;
  --ring: #7c3aed;
  --chart-1: oklch(0.60 0.22 295);
  --chart-2: oklch(0.60 0.18 195);
  --chart-3: oklch(0.62 0.18 155);
  --chart-4: oklch(0.72 0.18 80);
  --chart-5: oklch(0.65 0.22 340);
  --sidebar: #0d0d18;
  --sidebar-foreground: #94a3b8;
  --sidebar-primary: #7c3aed;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #7c3aed15;
  --sidebar-accent-foreground: #c4b5fd;
  --sidebar-border: #1e1e30;
  --sidebar-ring: #7c3aed;
}
```

- [ ] **Step 2: Agregar keyframes y clases de animación al final de globals.css**

Agregar al final del archivo:

```css
/* ── Obsidian Dark — Keyframes ─────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: -800px 0; }
  100% { background-position: 800px 0; }
}

@keyframes contentFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes dropIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Skeleton shimmer ──────────────────────────────────────── */
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #1a1a2a 25%,
    #252535 50%,
    #1a1a2a 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
}

/* ── Content reveal ────────────────────────────────────────── */
.content-fade-in {
  animation: contentFadeIn 0.3s ease forwards;
}

/* ── View Transitions (page crossfade) ─────────────────────── */
@supports (view-transition-name: none) {
  ::view-transition-old(root) {
    animation: 0.2s ease both fade-out;
  }
  ::view-transition-new(root) {
    animation: 0.2s ease both fade-in;
  }
  @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes fade-in  { from { opacity: 0; } to { opacity: 1; } }
}

/* ── Page layout standards ─────────────────────────────────── */
.page-wrapper {
  padding: 24px;
}
@media (max-width: 640px) {
  .page-wrapper {
    padding: 16px;
  }
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.2;
}

.page-header .page-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.content-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
```

- [ ] **Step 3: Verificar que el build no rompe**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -20
```

Esperado: sin errores de CSS.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/app/globals.css
git commit -m "style: Obsidian Dark tokens, keyframes, skeleton, view-transition in globals.css"
```

---

## Task 2: button.tsx — Glow Pill variants

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Reemplazar buttonVariants completo**

Reemplazar el contenido completo de `src/components/ui/button.tsx`:

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,box-shadow,background,opacity] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white shadow-[0_0_12px_#7c3aed50] hover:shadow-[0_0_20px_#7c3aed70] hover:-translate-y-px hover:scale-[1.02] active:scale-[0.97] active:[transition-duration:50ms]",
        secondary:
          "rounded-full bg-transparent text-[#c4b5fd] border border-[#7c3aed50] shadow-[0_0_8px_#7c3aed20] hover:bg-[#7c3aed15] hover:border-[#7c3aed80]",
        ghost:
          "rounded-full bg-white/[0.03] text-[#94a3b8] border border-white/[0.06] hover:bg-white/[0.07] hover:text-[#e2e8f0]",
        destructive:
          "rounded-full bg-[#ef4444] text-white shadow-[0_0_12px_#ef444440] hover:shadow-[0_0_20px_#ef444460] hover:-translate-y-px hover:scale-[1.02] active:scale-[0.97]",
        outline:
          "rounded-full bg-transparent text-[#94a3b8] border border-[#1e1e30] hover:bg-white/[0.05] hover:border-[#7c3aed40] hover:text-[#e2e8f0]",
        link: "text-[#a78bfa] underline-offset-4 hover:underline rounded-none",
        icon: "rounded-lg bg-white/[0.03] text-[#6b7280] border border-[#1e1e30] hover:bg-[#7c3aed15] hover:border-[#7c3aed40] hover:text-[#c4b5fd]",
      },
      size: {
        default: "h-9 px-[18px] py-2 text-[13px]",
        xs:      "h-6 px-2 text-[11px] gap-1",
        sm:      "h-8 px-3 text-[12px] gap-1.5",
        lg:      "h-10 px-6 text-[14px]",
        icon:    "size-9 rounded-lg",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/button.tsx
git commit -m "style: button Glow Pill variants — primary, secondary, ghost, destructive, icon"
```

---

## Task 3: badge.tsx — Status variants con glow

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Reemplazar badgeVariants completo**

Reemplazar el contenido completo de `src/components/ui/badge.tsx`:

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-[10px] py-[3px] text-[10px] font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-[#7c3aed18] text-[#c4b5fd] border border-[#7c3aed35] shadow-[0_0_6px_#7c3aed25]",
        active:
          "bg-[#10b98118] text-[#34d399] border border-[#10b98135] shadow-[0_0_6px_#10b98125]",
        warning:
          "bg-[#f59e0b18] text-[#fbbf24] border border-[#f59e0b35] shadow-[0_0_6px_#f59e0b25]",
        danger:
          "bg-[#ef444418] text-[#f87171] border border-[#ef444435] shadow-[0_0_6px_#ef444425]",
        info:
          "bg-[#3b82f618] text-[#60a5fa] border border-[#3b82f635] shadow-[0_0_6px_#3b82f625]",
        neutral:
          "bg-white/[0.04] text-[#6b7280] border border-white/[0.07]",
        secondary:
          "bg-[#111118] text-[#94a3b8] border border-[#1e1e30]",
        destructive:
          "bg-[#ef444418] text-[#f87171] border border-[#ef444435] shadow-[0_0_6px_#ef444425]",
        outline:
          "bg-transparent text-[#94a3b8] border border-[#1e1e30]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"
  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/badge.tsx
git commit -m "style: badge status variants con glow — active, warning, danger, info, neutral"
```

---

## Task 4: input.tsx — Focus ring purple

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Reemplazar input.tsx**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[8px] border border-[#2a2a40] bg-[#111118] px-3 py-[9px] text-[13px] text-[#e2e8f0] shadow-none outline-none transition-[border-color,box-shadow] duration-150",
        "placeholder:text-[#4b5563]",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#e2e8f0]",
        "focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed20]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-[#ef4444] aria-invalid:shadow-[0_0_0_3px_#ef444420]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/input.tsx
git commit -m "style: input focus ring purple, borde Obsidian"
```

---

## Task 5: card.tsx — Gradiente + borde purple

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Reemplazar card.tsx**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-[14px] border border-[#2a1f50] bg-gradient-to-br from-[#111118] to-[#0f0f1e] shadow-[0_0_20px_#7c3aed08] text-[#e2e8f0]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-center justify-between gap-2 px-5 pt-5 pb-0",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-[14px] font-semibold leading-none text-[#c4b5fd]", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[11px] text-[#4b5563] mt-0.5", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pt-4 pb-5", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center px-5 pb-5 pt-0 border-t border-[#1e1e30] mt-0",
        className
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/card.tsx
git commit -m "style: card gradiente Obsidian, borde purple, border-radius 14px"
```

---

## Task 6: skeleton.tsx — Shimmer Obsidian

**Files:**
- Modify: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Reemplazar skeleton.tsx**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md skeleton-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
```

La clase `skeleton-shimmer` fue definida en Task 1 dentro de `globals.css` con el gradiente oscuro y la animación `shimmer` de 1.4s.

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/skeleton.tsx
git commit -m "style: skeleton shimmer Obsidian Dark"
```

---

## Task 7: table.tsx — Header, rows, hover Obsidian

**Files:**
- Modify: `src/components/ui/table.tsx`

- [ ] **Step 1: Reemplazar table.tsx**

```tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="table-scroll-shell relative w-full overflow-hidden rounded-[12px] border border-[#1e1e30] bg-[#0f0f1a]"
    >
      <table
        data-slot="table"
        className={cn("w-full min-w-max caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-[#111118] [&_tr]:border-b [&_tr]:border-[#1e1e30]", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-[#1a1a28] transition-colors duration-100 hover:bg-[#7c3aed08] data-[state=selected]:bg-[#7c3aed12]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 py-[10px] text-left align-middle text-[10px] font-semibold uppercase tracking-[0.8px] text-[#4b5563] whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle text-[13px] text-[#94a3b8] whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell }
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/table.tsx
git commit -m "style: table header/row/hover Obsidian — border-radius, padding estandarizado"
```

---

## Task 8: dialog.tsx — Overlay blur + borde purple

**Files:**
- Modify: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Actualizar DialogOverlay y DialogContent**

En `src/components/ui/dialog.tsx`, reemplazar la clase de `DialogOverlay`:

```tsx
// DialogOverlay — reemplazar className cn(...)
className={cn(
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[75] bg-black/[0.70] backdrop-blur-[4px]",
  className
)}
```

Reemplazar la clase de `DialogContent`:

```tsx
// DialogContent — reemplazar className cn(...)
className={cn(
  "bg-[#0f0f1a] border border-[#2a1f50] shadow-[0_24px_80px_#00000080,0_0_40px_#7c3aed15]",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "fixed top-[50%] left-[50%] z-[80] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[16px] p-0 duration-200 outline-none sm:max-w-lg",
  className
)}
```

Reemplazar la clase de `DialogHeader`:

```tsx
// DialogHeader — reemplazar className cn(...)
className={cn(
  "flex flex-col gap-1 px-6 pt-5 pb-0",
  className
)}
```

Reemplazar la clase de `DialogFooter`:

```tsx
// DialogFooter — reemplazar className cn(...)
className={cn(
  "flex flex-col-reverse gap-2 border-t border-[#1e1e30] px-6 py-4 sm:flex-row sm:justify-end",
  className
)}
```

Reemplazar la clase de `DialogTitle`:

```tsx
// DialogTitle — reemplazar className cn(...)
className={cn("text-[16px] font-bold leading-none text-[#e2e8f0]", className)}
```

Reemplazar la clase de `DialogDescription`:

```tsx
// DialogDescription — reemplazar className cn(...)
className={cn("text-[13px] text-[#6b7280]", className)}
```

Agregar `px-6 pb-0 pt-4` al `DialogContent` children wrapper — esto se logra dejando el `gap-4` existente pero asegurandose que `CardContent` ya aplica el padding.

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/dialog.tsx
git commit -m "style: dialog overlay blur, borde purple, border-radius 16px"
```

---

## Task 9: dropdown-menu.tsx — Obsidian + animación drop-in

**Files:**
- Modify: `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Reemplazar dropdown-menu.tsx completo**

```tsx
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-[90] min-w-[196px] overflow-hidden rounded-[12px] border border-[#2a1f50] bg-[#111120] p-[6px]",
          "shadow-[0_8px_32px_#00000060,0_0_0_1px_#7c3aed18,0_0_24px_#7c3aed10]",
          "data-[state=open]:animate-[dropIn_0.12s_ease_forwards]",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default select-none items-center gap-[9px] rounded-[8px] px-[10px] py-[8px] text-[13px] text-[#94a3b8] outline-none transition-[background,color] duration-100",
        "focus:bg-[#7c3aed15] focus:text-[#e2e8f0] [&_svg]:text-[#4b5563] focus:[&_svg]:text-[#a78bfa]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        "data-[inset]:pl-8",
        "data-[variant=destructive]:text-[#f87171] data-[variant=destructive]:[&_svg]:text-[#ef444430]",
        "data-[variant=destructive]:focus:bg-[#ef444415] data-[variant=destructive]:focus:text-[#f87171] data-[variant=destructive]:focus:[&_svg]:text-[#f87171]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-[10px] pb-[6px] pt-[4px] text-[9px] font-semibold uppercase tracking-[1px] text-[#3d3d55]",
        "data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-[6px] my-[4px] h-px bg-[#1e1e30]", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/ui/dropdown-menu.tsx
git commit -m "style: dropdown-menu Obsidian — animación drop-in, items con glow hover, destructive rojo"
```

---

## Task 10: MetricCard.tsx — Nuevo layout spec

**Files:**
- Modify: `src/components/shared/MetricCard.tsx`

- [ ] **Step 1: Reemplazar MetricCard.tsx completo**

```tsx
'use client';

import { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  valueColor?: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  className?: string;
}

export const MetricCard = memo(function MetricCard({
  title,
  value,
  valueColor,
  description,
  icon: Icon,
  iconColor,
  trend,
  loading = false,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn(
        "rounded-[12px] border border-[#2a1f50] bg-gradient-to-br from-[#111118] to-[#0f0f1e] p-4 h-[88px]",
        "shadow-[0_0_20px_#7c3aed08]",
        className
      )}>
        <Skeleton className="h-[10px] w-24 mb-3" />
        <Skeleton className="h-6 w-28 mb-2" />
        <Skeleton className="h-[10px] w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[12px] border border-[#2a1f50] bg-gradient-to-br from-[#111118] to-[#0f0f1e] p-4 min-w-0",
        "shadow-[0_0_20px_#7c3aed08]",
        "transition-[transform,border-color,box-shadow] duration-150",
        "hover:-translate-y-0.5 hover:border-[#7c3aed50] hover:shadow-[0_4px_20px_#7c3aed15]",
        className
      )}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4b5563]">
          {title}
        </span>
        {Icon && (
          <Icon className={cn("h-4 w-4", iconColor ?? "text-[#3d3d55]")} />
        )}
      </div>

      {/* Value */}
      <div className={cn("text-[24px] font-bold leading-none text-[#e2e8f0]", valueColor)}>
        {value}
      </div>

      {/* Delta / description */}
      {trend && (
        <div className={cn(
          "mt-[6px] flex items-center gap-1 text-[11px] font-semibold",
          trend.isPositive ? "text-[#34d399]" : "text-[#f87171]"
        )}>
          <span>{trend.isPositive ? "▲" : "▼"}</span>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
      {!trend && description && (
        <div className="mt-[6px] text-[11px] text-[#67e8f9] truncate">{description}</div>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/shared/MetricCard.tsx
git commit -m "style: MetricCard layout Obsidian — skeleton proporcional, delta ▲▼, hover glow"
```

---

## Task 11: DataTable.tsx — Toolbar y spacing estandarizado

**Files:**
- Modify: `src/components/shared/DataTable.tsx`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase/src/components/shared/DataTable.tsx"
```

- [ ] **Step 2: Aplicar clases estandarizadas al wrapper y toolbar**

Localizar el div contenedor raíz del componente y asegurarse de que tenga:

```tsx
// Wrapper raíz — agregar clases si no las tiene:
className="flex flex-col gap-0"

// Toolbar (div que contiene search + botones) — asegurar:
className="flex items-center gap-[10px] mb-4 flex-wrap sm:flex-nowrap"

// Input de búsqueda dentro del toolbar — asegurar flex-grow:
className="flex-1 min-w-[180px]"

// Área de paginación — asegurar:
className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e30] text-[11px] text-[#4b5563]"
```

- [ ] **Step 3: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/shared/DataTable.tsx
git commit -m "style: DataTable toolbar gap estandarizado, pagination border/spacing Obsidian"
```

---

## Task 12: Sidebar.tsx — Colapsable expanded/compact

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (o `src/components/Sidebar.tsx` según la ruta real)

- [ ] **Step 1: Leer el archivo actual**

```bash
cat "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase/src/components/layout/Sidebar.tsx" 2>/dev/null || cat "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase/src/components/Sidebar.tsx"
```

- [ ] **Step 2: Agregar persistencia localStorage al estado collapsed**

Localizar donde se define el estado `collapsed` (ya existe como prop desde el layout). En el componente, agregar efecto para leer/escribir localStorage:

```tsx
// Al principio del componente Sidebar, agregar:
useEffect(() => {
  const stored = localStorage.getItem('sidebar-collapsed');
  if (stored !== null) {
    onCollapse(stored === 'true');
  }
}, []);

useEffect(() => {
  localStorage.setItem('sidebar-collapsed', String(collapsed));
}, [collapsed]);
```

- [ ] **Step 3: Aplicar clases Obsidian al contenedor del sidebar**

Localizar el div raíz del sidebar desktop y asegurar:

```tsx
// Contenedor sidebar desktop
className={cn(
  "hidden md:flex flex-col h-full transition-[width] duration-200 overflow-hidden",
  "bg-[#0d0d18] border-r border-[#1e1e30]",
  collapsed ? "w-[56px]" : "w-[220px]"
)}
```

- [ ] **Step 4: Aplicar clases Obsidian a los nav items**

Para cada nav item activo/inactivo, asegurar las siguientes clases:

```tsx
// Item inactivo
className="flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] text-[13px] text-[#6b7280] transition-[background,color] duration-100 hover:bg-white/[0.03] hover:text-[#94a3b8] cursor-pointer"

// Item activo
className="flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] text-[13px] text-[#c4b5fd] bg-gradient-to-r from-[#7c3aed22] to-transparent shadow-[inset_3px_0_0_#7c3aed]"

// Labels en modo collapsed: agregar
className={cn("truncate transition-[opacity,transform] duration-150", collapsed ? "opacity-0 -translate-x-1 pointer-events-none w-0" : "opacity-100 translate-x-0")}
```

- [ ] **Step 5: Agregar botón toggle**

En el contenedor del sidebar desktop, al final, agregar:

```tsx
<button
  onClick={() => onCollapse(!collapsed)}
  className={cn(
    "absolute bottom-4 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full",
    "border border-[#2a2a40] bg-[#1a1a2e] text-[#6b7280]",
    "transition-[background,border-color,color,transform] duration-200",
    "hover:bg-[#7c3aed20] hover:border-[#7c3aed50] hover:text-[#c4b5fd]",
    collapsed ? "rotate-180" : "rotate-0"
  )}
  aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
>
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M7 2L4 5L7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</button>
```

- [ ] **Step 6: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/layout/Sidebar.tsx src/components/Sidebar.tsx 2>/dev/null || true
git commit -m "feat: sidebar colapsable expanded/compact — localStorage, toggle button, clases Obsidian"
```

---

## Task 13: Charts — Paleta Obsidian

**Files:**
- Modify: `src/components/dashboard/IngresosVsGastosChart.tsx`
- Modify: `src/components/dashboard/CrecimientoTercerosChartView.tsx`
- Modify: `src/components/dashboard/RevenueByCategoryChart.tsx`

- [ ] **Step 1: IngresosVsGastosChart — reemplazar colores y tooltip**

En `IngresosVsGastosChart.tsx`, localizar y reemplazar:

```tsx
// Stroke de ingresos: reemplazar #7c3aed por #a78bfa
// Stop color del gradiente ingresos: reemplazar #8b5cf6 por #8b5cf6 (igual, ok)
// Stroke de gastos: reemplazar #dc2626 por #f87171
// Stop color del gradiente gastos: reemplazar #dc2626 por #ef4444

// CartesianGrid — agregar/actualizar props:
<CartesianGrid stroke="#1e1e30" strokeDasharray="3 3" />

// XAxis y YAxis — agregar/actualizar:
tick={{ fill: '#4b5563', fontSize: 10 }}

// Tooltip — agregar/actualizar contentStyle:
contentStyle={{
  background: '#1a1a2e',
  border: '1px solid #7c3aed40',
  borderRadius: '10px',
  padding: '10px 14px',
  boxShadow: '0 4px 24px #00000060, 0 0 16px #7c3aed20',
  fontSize: '11px',
  color: '#94a3b8',
}}
labelStyle={{ color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}
```

- [ ] **Step 2: CrecimientoTercerosChartView — reemplazar series de color**

En `CrecimientoTercerosChartView.tsx`, localizar y reemplazar:

```tsx
// GrowthChart AreaChart:
// Clientes stroke: reemplazar #2563eb por #60a5fa
// Clientes gradient stops: reemplazar #2563eb/#1e40af/#1e3a8a por #3b82f6/#1d4ed8/#1e3a8a
// Revendedores stroke: reemplazar #ec4899 por #f472b6
// Revendedores gradient stops: reemplazar #ec4899/#be185d/#4a0d25 por #ec4899/#be185d/#4a0d25 (ok)

// ChurnChart BarChart:
// Bar fill: reemplazar #dc2626 por #ef4444, opacity 0.75

// BalanceChart BarChart:
// Ganados fill: reemplazar #16a34a por #10b981, opacity 0.85
// Perdidos fill: reemplazar #dc2626 por #ef4444, opacity 0.75

// Todos los CartesianGrid: stroke="#1e1e30" strokeDasharray="3 3"
// Todos los ticks: fill="#4b5563" fontSize={10}
// Todos los Tooltip: mismo contentStyle que Step 1
```

- [ ] **Step 3: RevenueByCategoryChart — reemplazar array de colores**

En `RevenueByCategoryChart.tsx`, localizar `REVENUE_CATEGORY_COLORS` y reemplazar:

```tsx
const REVENUE_CATEGORY_COLORS = [
  "#a78bfa", // purple
  "#67e8f9", // cyan
  "#34d399", // green
  "#fbbf24", // amber
  "#f472b6", // pink
  "#60a5fa", // blue
  "#fb923c", // orange
];

// Valor negativo: reemplazar #dc2626 por #ef4444
// CartesianGrid: stroke="#1e1e30" strokeDasharray="3 3"
// Ticks: fill="#4b5563" fontSize={10}
// Tooltip: mismo contentStyle que Step 1
```

- [ ] **Step 4: Verificar build**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/components/dashboard/IngresosVsGastosChart.tsx
git add src/components/dashboard/CrecimientoTercerosChartView.tsx
git add src/components/dashboard/RevenueByCategoryChart.tsx
git commit -m "style: charts paleta Obsidian — series purple/cyan/green/amber/pink, tooltip dark, grid sutil"
```

---

## Task 14: Dashboard layout — View-transition + page padding

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Agregar `unstable_ViewTransition` al router push**

En `src/app/(dashboard)/layout.tsx`, el archivo ya tiene el layout con `p-3 sm:p-4 md:p-6`. Actualizar el padding del `<div>` interior para usar los valores del spec:

```tsx
// Localizar: className="h-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6"
// Reemplazar por:
className="h-full min-w-0 overflow-x-hidden p-4 sm:p-5 md:p-6"
```

- [ ] **Step 2: Agregar meta tag para view transitions en el layout raíz**

Verificar que `src/app/layout.tsx` tenga el `<html>` con la clase `dark`. Si no la tiene, agregarla:

```tsx
// En src/app/layout.tsx, asegurar:
<html lang="es" className="dark">
```

- [ ] **Step 3: Verificar que globals.css tiene las reglas view-transition del Task 1**

```bash
grep -n "view-transition" "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase/src/app/globals.css"
```

Esperado: líneas con `::view-transition-old` y `::view-transition-new`.

- [ ] **Step 4: Verificar build completo**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` sin errores.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add src/app/layout.tsx src/app/"(dashboard)"/layout.tsx
git commit -m "style: dashboard layout padding estandarizado, html class dark para view-transitions"
```

---

## Task 15: Lint, test, build final y commit de cierre

- [ ] **Step 1: Lint**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run lint 2>&1 | tail -20
```

Esperado: 0 errores nuevos introducidos por los cambios de este plan.

- [ ] **Step 2: Tests**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm test -- --run 2>&1 | tail -20
```

Esperado: todos los tests pasan (los cambios son solo de presentación, no tocan lógica).

- [ ] **Step 3: Build de producción**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase" && npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 4: Commit de cierre**

```bash
cd "/c/Users/iTs_A/Desktop/MovieTime Supabase/MovieTime-Supabase"
git add -A
git commit -m "$(cat <<'EOF'
style: UI/UX/IxD redesign completo — Obsidian Dark

- Design tokens Obsidian en globals.css (colores, keyframes, skeleton, view-transitions)
- Botones Glow Pill, badges con glow semántico, inputs con focus purple
- Cards con gradiente y borde purple
- Skeleton shimmer oscuro, tabla Obsidian, dialogs con blur overlay
- DropdownMenu con animación drop-in y destructive rojo
- MetricCard nuevo layout con delta ▲▼ y hover glow
- DataTable toolbar y pagination estandarizados
- Sidebar colapsable expanded/compact con localStorage
- Charts: paleta Obsidian en todos los gráficos del dashboard
- Page transitions crossfade 200ms

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
