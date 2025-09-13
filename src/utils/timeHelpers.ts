// utils/timeHelpers.ts
export function parseTime(time: string, base: Date): Date {
  const [h, m] = time.split(':').map(Number)
  const parsed = new Date(base)
  parsed.setHours(h, m, 0, 0)
  return parsed
}

export function formatClock(time: string, use12Hour: boolean): string {
  if (!use12Hour) return time

  const [hourStr, minuteStr] = time.split(":")
  let hour = parseInt(hourStr, 10)
  const minute = parseInt(minuteStr, 10)

  const ampm = hour >= 12 ? "PM" : "AM"
  hour = hour % 12
  if (hour === 0) hour = 12

  return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`
}
