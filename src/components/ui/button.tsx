import { Slot } from "radix-ui";
import { forwardRef } from "react";

import { Tooltip } from "~/components/ui/tooltip";
import { cn } from "~/lib/cn";

type Variant = "accent" | "light" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  accent: "bg-accent text-accent-ink hover:bg-accent-hover",
  light: "bg-fg text-ink-950 hover:bg-white",
  ghost: "text-fg-muted hover:bg-white/[0.07] hover:text-fg",
  outline: "border border-white/20 text-fg hover:border-white/50",
  danger: "bg-danger text-ink-950 hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-[15px] gap-2.5",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "light", size = "md", asChild, className, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform,filter] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  /** Show the label as a tooltip on hover. On by default; off where the label is visible anyway. */
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

const iconSizes = { sm: "size-8", md: "size-9", lg: "size-11" };

/** Round, label-required icon button. The label is the accessible name and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", active, tooltip = true, tooltipSide, className, type, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        active ? "text-accent hover:text-accent-hover" : "text-fg-muted hover:text-fg",
        iconSizes[size],
        className,
      )}
      {...props}
    />
  );
  return tooltip ? (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
