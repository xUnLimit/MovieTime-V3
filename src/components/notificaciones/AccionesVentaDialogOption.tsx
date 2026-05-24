import type { ReactNode } from "react";

import { RadioGroupItem } from "@/components/ui/radio-group";

interface AccionesVentaDialogOptionProps {
  checked: boolean;
  children?: ReactNode;
  description: string;
  icon: ReactNode;
  id: string;
  tone: "blue" | "orange" | "yellow";
  title: string;
  value: string;
}

const toneClasses: Record<AccionesVentaDialogOptionProps["tone"], string> = {
  blue: "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20",
  orange: "border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20",
  yellow: "border-yellow-400 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/20",
};

export function AccionesVentaDialogOption({
  checked,
  children,
  description,
  icon,
  id,
  tone,
  title,
  value,
}: AccionesVentaDialogOptionProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        checked ? toneClasses[tone] : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {children}
      </div>
    </label>
  );
}
