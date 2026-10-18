"use client";

import { Slider as RadixSlider } from "radix-ui";

import { cn } from "~/lib/cn";

/**
 * Thin horizontal slider for progress and volume. The fill turns accent and the thumb appears on
 * hover or focus, the way music players tend to do it.
 */
export function Slider({
  value,
  max,
  step = 1,
  label,
  valueText,
  disabled,
  onChange,
  onCommit,
  onPointerDown,
  onPointerUp,
  className,
}: {
  value: number;
  max: number;
  step?: number;
  label: string;
  valueText?: string;
  disabled?: boolean;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  className?: string;
}) {
  return (
    <RadixSlider.Root
      value={[Math.min(value, max)]}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={([next]) => next !== undefined && onChange?.(next)}
      onValueCommit={([next]) => next !== undefined && onCommit?.(next)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn(
        "group relative flex h-4 w-full cursor-pointer touch-none items-center select-none data-[disabled]:cursor-default",
        className,
      )}
    >
      <RadixSlider.Track className="relative h-1 grow overflow-hidden rounded-full bg-white/[0.18]">
        <RadixSlider.Range className="bg-fg group-hover:bg-accent group-focus-within:bg-accent absolute h-full rounded-full group-data-[disabled]:bg-white/30" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="bg-fg focus-visible:outline-accent block size-3 rounded-full opacity-0 shadow-[0_2px_6px_rgb(0_0_0/0.5)] transition-opacity group-hover:opacity-100 group-data-[disabled]:hidden focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </RadixSlider.Root>
  );
}
