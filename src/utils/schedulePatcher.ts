import { ScheduledBlock } from "./types"
import { getItem, setItem } from "./localStorage" 

export function addChange(change: Change) {
  const current = getItem("scheduleChanges") || []
  const updated = [...current, change]
  setItem("scheduleChanges", updated)
}

export type Change =
  | { type: "insert"; block: ScheduledBlock }
  | { type: "delete"; taskId: string }

export function applyChangesToSchedule(
  base: ScheduledBlock[],
  changes: Change[]
): ScheduledBlock[] {
  let output = [...base]

  for (const change of changes) {
    if (change.type === "insert") {
      output.push(change.block)
    } else if (change.type === "delete") {
      output = output.filter(b => b.taskId !== change.taskId)
    }
  }

  return output.sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
}
