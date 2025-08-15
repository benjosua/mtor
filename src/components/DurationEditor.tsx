"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DurationEditorProps {
  initialDurationMs: number
  onDurationChange: (newDurationMs: number) => void
}

const formatMsToHHMM = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return ""
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function DurationEditor({
  initialDurationMs,
  onDurationChange,
}: DurationEditorProps) {
  
  const [value, setValue] = React.useState(() =>
    formatMsToHHMM(initialDurationMs),
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    
    const digits = inputValue.replace(/\D/g, "").slice(0, 4)

    
    let formatted = digits
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`
    }

    
    const hours = parseInt(digits.slice(0, 2), 10) || 0
    let minutes = parseInt(digits.slice(2), 10) || 0

    
    if (minutes > 59) {
      minutes = 59
      
      const clampedDigits = `${digits.slice(0, 2)}59`
      formatted = `${clampedDigits.slice(0, 2)}:${clampedDigits.slice(2)}`
    }

    const newDurationMs = (hours * 3600 + minutes * 60) * 1000

    
    setValue(formatted)
    onDurationChange(newDurationMs)
  }

  return (
    <div className="grid w-full items-center gap-1.5 mt-4">
      <Label htmlFor="duration-input">Adjust Duration (HH:MM)</Label>
      <Input
        id="duration-input"
        value={value}
        onChange={handleChange}
        placeholder="01:30" // A placeholder in case the value is empty
        className="font-mono text-center text-lg bg-background appearance-none"
        autoFocus
        onFocus={(e) => e.target.select()} 
      />
    </div>
  )
}