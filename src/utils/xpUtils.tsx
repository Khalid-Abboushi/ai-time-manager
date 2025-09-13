// src/utils/xpUtils.ts
export const getHoursRequiredForLevel = (level: number): number => {
  if (level === 1) return 1
  if (level === 2) return 2
  if (level === 3) return 4
  if (level === 4) return 6
  if (level === 5) return 9
  if (level === 6) return 12
  if (level === 7) return 15
  if (level === 8) return 20
  if (level === 9) return 25
  if (level === 10) return 30
  return 30 + (level - 10) * 5
}
