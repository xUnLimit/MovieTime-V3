"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            "font-sans text-sm rounded-xl border shadow-2xl",
            "flex gap-3 items-start p-4 pr-10",
            "bg-card border-border text-card-foreground",
            "data-[type=success]:border-emerald-500/40 data-[type=success]:bg-emerald-50 dark:data-[type=success]:bg-emerald-950/80",
            "data-[type=error]:border-red-500/40 data-[type=error]:bg-red-50 dark:data-[type=error]:bg-red-950/80",
            "data-[type=warning]:border-yellow-500/40 data-[type=warning]:bg-yellow-50 dark:data-[type=warning]:bg-yellow-950/80",
            "data-[type=info]:border-blue-500/40 data-[type=info]:bg-blue-50 dark:data-[type=info]:bg-blue-950/80",
          ].join(" "),
          title: "font-semibold text-sm leading-tight tracking-tight",
          description: "text-xs text-muted-foreground mt-0.5 leading-relaxed",
          icon: [
            "mt-0.5 shrink-0",
            "data-[type=success]:text-emerald-600 dark:data-[type=success]:text-emerald-400",
            "data-[type=error]:text-red-600 dark:data-[type=error]:text-red-400",
            "data-[type=warning]:text-yellow-600 dark:data-[type=warning]:text-yellow-400",
            "data-[type=info]:text-blue-600 dark:data-[type=info]:text-blue-400",
          ].join(" "),
          closeButton: [
            "absolute right-2 top-2 rounded-md p-1",
            "text-muted-foreground hover:text-foreground transition-colors",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
          ].join(" "),
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
