import { cn } from 'cn'
import { Slider as SliderPrimitive } from 'radix-ui'
import * as React from 'react'

/** shadcn slider with Kurio styling and an accessible name per thumb (e.g. "Preço mínimo"). */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels = [],
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-[3px] grow overflow-hidden rounded-full bg-primary/40">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels[index]}
          className="block size-[18px] rounded-full border-[3px] border-primary bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
