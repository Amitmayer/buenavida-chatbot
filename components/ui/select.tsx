"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const EMPTY = "__empty";

export type SelectOption = { value: string; label: string };

export function AppSelect({
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  required,
  size = "field",
  className,
  triggerClassName,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  size?: "field" | "chip" | "sm" | "inline";
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}) {
  const allowEmpty = Boolean(placeholder) && !required;
  const items = allowEmpty ? [{ value: EMPTY, label: placeholder ?? "" }, ...options] : options;
  const [inner, setInner] = React.useState(defaultValue || (allowEmpty ? EMPTY : options[0]?.value || EMPTY));
  const current = value !== undefined ? value || EMPTY : inner;

  function change(next: string) {
    const raw = next === EMPTY ? "" : next;
    if (value === undefined) setInner(next);
    onValueChange?.(raw);
  }

  return (
    <SelectPrimitive.Root
      value={current}
      onValueChange={change}
      required={required}
    >
      {name ? <input type="hidden" name={name} value={current === EMPTY ? "" : current} /> : null}
      <SelectTrigger size={size} className={cn(className, triggerClassName)} aria-label={ariaLabel}>
        <SelectPrimitive.Value />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value || EMPTY} value={item.value || EMPTY}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  );
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    size?: "field" | "chip" | "sm" | "inline";
  }
>(({ className, children, size = "field", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-between gap-2 border border-line bg-sheet text-ink outline-none",
      "focus-visible:border-ink data-[placeholder]:text-ink/45 disabled:opacity-50 [&>span]:min-w-0 [&>span]:truncate",
      size === "chip" && "h-[34px] rounded-[9px] px-3.5 text-[12.5px] font-medium",
      size === "sm" && "h-9 rounded-[9px] px-3 text-[13px] font-medium",
      size === "inline" && "h-8 w-full rounded-[9px] px-2.5 text-[13px] font-medium",
      size === "field" && "h-11 w-full rounded-[9px] px-3 text-[14px]",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2.25} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      collisionPadding={8}
      sideOffset={4}
      className={cn(
        "z-[70] overflow-hidden rounded-[9px] border border-line bg-sheet shadow-lg",
        "min-w-[var(--radix-select-trigger-width)]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-[7px] py-2 pl-2 pr-8 text-[13px] text-ink outline-none",
      "data-[highlighted]:bg-wash data-[state=checked]:font-medium",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2">
      <Check className="h-3.5 w-3.5 text-pine" strokeWidth={2.5} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
