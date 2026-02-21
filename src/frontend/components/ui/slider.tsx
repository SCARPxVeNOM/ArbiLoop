"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
    onValueChange?: (value: number[]) => void
    defaultValue?: number[]
    value?: number[]
    max?: number
    min?: number
    step?: number
    className?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, min = 0, max = 100, step = 1, defaultValue = [0], value, onValueChange, ...props }, ref) => {
        const [val, setVal] = React.useState(defaultValue[0])

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = parseFloat(e.target.value)
            setVal(newValue)
            if (onValueChange) {
                onValueChange([newValue])
            }
        }

        // Calculate percentage for background gradient
        const percentage = ((val - min) / (max - min)) * 100

        return (
            <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={handleChange}
                    className="absolute w-full h-2 opacity-0 cursor-pointer z-20"
                    ref={ref}
                    {...props}
                />
                <div className="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                        className="absolute h-full bg-[#CEFF00]"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div
                    className="absolute h-5 w-5 rounded-full border-2 border-[#CEFF00] bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 z-10 pointer-events-none"
                    style={{ left: `calc(${percentage}% - 10px)` }}
                />
            </div>
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
