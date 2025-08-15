import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const KG_TO_LBS = 2.20462;

export function convertKgToDisplay(kgValue: number | null | undefined, displayUnit: 'kg' | 'lbs'): number {
  if (kgValue === null || kgValue === undefined) return 0;
  if (displayUnit === 'lbs') {
    const lbs = kgValue * KG_TO_LBS;
    
    return Math.round(lbs * 2) / 2;
  }
  return kgValue;
}

export function convertDisplayToKg(displayValue: number | null | undefined, displayUnit: 'kg' | 'lbs'): number {
  if (displayValue === null || displayValue === undefined) return 0;
  if (displayUnit === 'lbs') {
    return displayValue / KG_TO_LBS;
  }
  return displayValue;
}
