export function roundUpToNext15(date: Date): Date {
  const min = Math.ceil(date.getMinutes() / 15) * 15
  const rounded = new Date(date)
  if (min === 60) {
    rounded.setHours(rounded.getHours() + 1)
    rounded.setMinutes(0)
  } else {
    rounded.setMinutes(min)
  }
  rounded.setSeconds(0)
  rounded.setMilliseconds(0)
  return rounded
}
