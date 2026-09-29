"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "@/components/layout/ThemeProvider"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            "font-sans text-sm rounded-xl border shadow-lg",
            "flex gap-3 items-start p-4 pr-10",
            "bg-card border-border text-card-foreground",
            "data-[type=success]:border-success-border",
            "data-[type=error]:border-danger-border",
            "data-[type=warning]:border-warning-border",
            "data-[type=info]:border-info-border",
          ].join(" "),
          title: "font-semibold text-sm leading-tight tracking-tight",
          description: "text-xs text-muted-foreground mt-0.5 leading-relaxed",
          icon: [
            "mt-0.5 shrink-0",
            "data-[type=success]:text-success",
            "data-[type=error]:text-danger",
            "data-[type=warning]:text-warning",
            "data-[type=info]:text-info",
          ].join(" "),
          closeButton: [
            "absolute right-2 top-2 rounded-md p-1",
            "text-muted-foreground hover:text-foreground transition-colors",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
          ].join(" "),
          actionButton: [
            "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground",
            "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ].join(" "),
          cancelButton: [
            "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
            "hover:bg-muted hover:text-foreground",
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
