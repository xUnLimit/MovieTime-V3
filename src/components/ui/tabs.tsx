"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/platform/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group-data-[orientation=horizontal]/tabs:h-9 group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        // Underline tipo Vercel: hairline continua y el activo la cruza con una linea de 2px.
        default: "w-full justify-start gap-1 border-b border-border bg-transparent",
        line: "w-full justify-start gap-1 border-b border-border bg-transparent",
        // Segmentado: para alternar vistas pequenas dentro de una tarjeta.
        pills: "gap-0.5 rounded-lg bg-muted p-[3px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:ring-ring/40 text-muted-foreground hover:text-foreground relative inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-[color,background-color] duration-150 outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-[state=active]:text-foreground",
        // Underline: solo en listas de variante default/line.
        "group-data-[variant=default]/tabs-list:after:absolute group-data-[variant=default]/tabs-list:after:right-0 group-data-[variant=default]/tabs-list:after:-bottom-px group-data-[variant=default]/tabs-list:after:left-0 group-data-[variant=default]/tabs-list:after:h-0.5 group-data-[variant=default]/tabs-list:after:bg-foreground group-data-[variant=default]/tabs-list:after:opacity-0 group-data-[variant=default]/tabs-list:after:transition-opacity group-data-[variant=default]/tabs-list:data-[state=active]:after:opacity-100",
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:right-0 group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[variant=line]/tabs-list:after:left-0 group-data-[variant=line]/tabs-list:after:h-0.5 group-data-[variant=line]/tabs-list:after:bg-foreground group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:after:transition-opacity group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        "group-data-[variant=pills]/tabs-list:rounded-md group-data-[variant=pills]/tabs-list:px-2.5 group-data-[variant=pills]/tabs-list:py-1 group-data-[variant=pills]/tabs-list:data-[state=active]:bg-card group-data-[variant=pills]/tabs-list:data-[state=active]:shadow-xs",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
