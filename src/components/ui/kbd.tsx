import * as React from "react"

import { cn } from "@/platform/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded border px-1 font-mono text-xs font-medium select-none",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
