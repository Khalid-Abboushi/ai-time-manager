// utils/timePerTask.ts
import { parseLocalDate } from "@/pages/Schedule"

export const getTimePerTask = (
  estimatedTime: number,
  deadline: string,
  isMultiDay: boolean,
  totalParts?: number
): number => {
  if (!isMultiDay || !totalParts || totalParts <= 1) return estimatedTime

  const raw = estimatedTime / totalParts
  return Math.round(raw * 100) / 100 // You can use Math.round here instead of Math.ceil
}
