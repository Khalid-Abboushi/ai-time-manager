// export interface ScheduledBlock {
//   title: string
//   taskId?: string
//   type: "task" | "break" | "prayer" | "fixed"
//   start: string
//   end: string
//   startDate?: Date
//   endDate?: Date
// }

// export interface UserSchedulePrefs {
//   wakeUp: string
//   sleep: string
//   recurringBlocks: {
//     title: string
//     times: string[]
//     duration: number
//   }[]
//   use12HourClock: boolean
// }

// interface Task {
//   id: string
//   title: string
//   completed: boolean
//   category: 'work' | 'personal' | 'health' | 'learning'
//   priority: 'low' | 'medium' | 'high'
//   deadline: string
//   estimatedTime: number
//   type: 'mental' | 'physical' | 'work' | 'social'
//   completedOn?: string
//   parentId?: string
//   isParent?: boolean
//   partIndex?: number
//   totalParts?: number
//   showToday?: boolean
//   locked?: boolean
// }

// export function timeStringToDate(time: string, isSleepTime = false): Date {
//   const [hour, minute] = time.split(":").map(Number)
//   const now = new Date()
//   now.setHours(hour, minute, 0, 0)

//   // ⏰ If sleep time is midnight, push to *next* day
//   if (isSleepTime && hour === 0 && minute === 0) {
//     now.setDate(now.getDate() + 1)
//   }

//   return new Date(now)
// }


// export function formatClock(time: string, use12HourClock: boolean = false): string {
//   const [hour, minute] = time.split(":").map(Number)
//   if (!use12HourClock) return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
//   const suffix = hour >= 12 ? "PM" : "AM"
//   const hour12 = hour % 12 === 0 ? 12 : hour % 12
//   return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`
// }

// function formatTime(date: Date, isEndTime = false): string {
//   const hours = date.getHours()
//   const minutes = date.getMinutes()

//   // If midnight and used as an endTime, round down to 23:59
//   if (isEndTime && hours === 0 && minutes === 0) {
//     return "23:59"
//   }

//   return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
// }



// export function addMinutes(date: Date, mins: number): Date {
//   return new Date(date.getTime() + mins * 60000)
// }

// function roundToNext15Minutes(date: Date): Date {
//   const mins = date.getMinutes()
//   const next = new Date(date)
//   next.setSeconds(0)
//   next.setMilliseconds(0)
//   const remainder = 15 - (mins % 15)
//   next.setMinutes(mins + remainder)
//   return next
// }

// function scheduleTaskParts(
//   task: Task,
//   start: Date,
//   remainingMinutes: number,
//   sleepTime: Date,
//   blocks: (ScheduledBlock & { startDate: Date; endDate: Date })[]
// ): Date {
//   if (remainingMinutes <= 0 || start >= sleepTime) return start

//   const maxBlockLength = 120
//   const chunk = Math.min(remainingMinutes, maxBlockLength)
//   const blockEnd = addMinutes(start, chunk)

//   // ✅ Allow task to end exactly at sleep time
//   if (blockEnd > sleepTime) {
//     const availableMinutes = (sleepTime.getTime() - start.getTime()) / 60000
//     if (availableMinutes < 15) return start // too small, skip
//     return scheduleTaskParts(task, start, availableMinutes, sleepTime, blocks)
//   }

//   // 🔄 Check for overlap
//   const overlaps = blocks.some(b => {
//     const bStart = b.startDate
//     const bEnd = b.endDate
//     return start < bEnd && blockEnd > bStart
//   })

//   if (overlaps) {
//     const nextAvailable = blocks
//       .map(b => b.endDate)
//       .filter(end => end > start)
//       .sort((a, b) => a.getTime() - b.getTime())[0]

//     return nextAvailable
//       ? scheduleTaskParts(task, roundToNext15Minutes(nextAvailable), remainingMinutes, sleepTime, blocks)
//       : start
//   }

//   // ✅ Add the task block
//   blocks.push({
//     title: task.title,
//     taskId: task.id,
//     type: "task",
//     start: formatTime(start),
//     end: formatTime(blockEnd, true), // <-- use new formatTime with midnight check
//     startDate: start,
//     endDate: blockEnd
//   })

//   const remaining = remainingMinutes - chunk
//   const afterBlock = new Date(blockEnd)

//   // ➕ Add a break if needed before continuing
//   if (remaining > 0) {
//     const breakEnd = addMinutes(afterBlock, 20)
//     if (breakEnd <= sleepTime) {
//       blocks.push({
//         title: "Break",
//         type: "break",
//         start: formatTime(afterBlock),
//         end: formatTime(breakEnd, true),
//         startDate: afterBlock,
//         endDate: breakEnd
//       })
//       return scheduleTaskParts(task, roundToNext15Minutes(breakEnd), remaining, sleepTime, blocks)
//     }
//   }

//   return blockEnd
// }

// export function generateAutoSchedule(
//   tasks: Task[],
//   prefs: UserSchedulePrefs & { use12HourClock: boolean }
// ): ScheduledBlock[] {
//   const blocks: (ScheduledBlock & { startDate: Date; endDate: Date })[] = []

//   const now = new Date()
//   const today = new Date()
//   today.setHours(0, 0, 0, 0)

//   const wakeTime = timeStringToDate(prefs.wakeUp)
//   const sleepTime = timeStringToDate(prefs.sleep)
//   const cursorStart = new Date(Math.max(now.getTime(), wakeTime.getTime()))
//   const priorityScore = { high: 3, medium: 2, low: 1 }

//   for (const block of prefs.recurringBlocks) {
//     const duration = Math.max(block.duration || 10, 1)
//     for (const time of block.times) {
//       if (!/^\d{2}:\d{2}$/.test(time)) continue
//       const [hour, minute] = time.split(":").map(Number)
//       const start = new Date(today)
//       start.setHours(hour, minute, 0, 0)
//       if (start < today) start.setDate(start.getDate() + 1)
//       const end = addMinutes(start, duration)
//       if (end.getTime() === start.getTime()) continue // skip if no duration
//       blocks.push({
//         title: block.title,
//         start: formatTime(start),
//         end: formatTime(end, true),
//         type: "fixed",
//         startDate: start,
//         endDate: end
//       })
//     }
//   }

//   blocks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

//   let cursor = roundToNext15Minutes(new Date(cursorStart))

//   const sortedTasks = [...tasks]
//     .filter(task => {
//       if (task.completed) return false
//       if (task.isParent) return false
//       if (task.parentId) return task.showToday && !task.locked
//       return true
//     })
//     .sort((a, b) => {
//       const daysLeftA = (new Date(a.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
//       const daysLeftB = (new Date(b.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
//       const scoreA = priorityScore[a.priority] / Math.max(1, daysLeftA)
//       const scoreB = priorityScore[b.priority] / Math.max(1, daysLeftB)
//       return scoreB - scoreA
//     })

//   for (const task of sortedTasks) {
//     const taskMinutes = task.estimatedTime * 60
//     cursor = scheduleTaskParts(task, roundToNext15Minutes(cursor), taskMinutes, sleepTime, blocks)
//   }

//   const fullBlocks = blocks
//     .filter(b => b.startDate && b.endDate)
//     .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

//   const filled: ScheduledBlock[] = []
//   let pointer = new Date(wakeTime)

//   let sleepPointer = new Date(today)
//   sleepPointer.setHours(0, 0, 0, 0)

//   const preWakeBlocks = fullBlocks.filter(b => b.endDate <= wakeTime)

//   for (const block of preWakeBlocks) {
//     if (block.startDate > sleepPointer && block.startDate > now) {
//       filled.push({
//         title: "Sleep",
//         type: "fixed",
//         start: formatTime(sleepPointer),
//         end: formatTime(block.startDate, true)
//       })
//     }
//     filled.push({
//       title: block.title,
//       type: block.type,
//       start: formatTime(block.startDate),
//       end: formatTime(block.endDate, true),
//       taskId: block.taskId
//     })
//     sleepPointer = block.endDate
//   }

//   const lastPreWakeBlockEnd = preWakeBlocks.length > 0 ? preWakeBlocks[preWakeBlocks.length - 1].endDate : sleepPointer
//   const lastFilledEnd = filled.length > 0 ? timeStringToDate(filled[filled.length - 1].end) : null

//   if (
//     lastPreWakeBlockEnd < wakeTime &&
//     wakeTime > now &&
//     (!lastFilledEnd || formatTime(lastPreWakeBlockEnd) !== formatTime(lastFilledEnd))
//   ) {
//     filled.push({
//       title: "Sleep",
//       type: "fixed",
//       start: formatTime(lastPreWakeBlockEnd),
//       end: formatTime(wakeTime, true)
//     })
//   }

//   const remainingBlocks = fullBlocks.filter(b => b.endDate > wakeTime)
//   pointer = new Date(wakeTime)

//   for (const block of remainingBlocks) {
//     if (block.startDate > pointer && block.startDate > now) {
//       filled.push({
//         title: "Free Time",
//         type: "fixed",
//         start: formatTime(pointer),
//         end: formatTime(block.startDate, true)
//       })
//     }

//     if (block.endDate > now) {
//       filled.push({
//         title: block.title,
//         type: block.type,
//         start: formatTime(block.startDate),
//         end: formatTime(block.endDate, true),
//         taskId: block.taskId
//       })
//     }

//     pointer = block.endDate > pointer ? block.endDate : pointer
//   }

//   if (pointer < sleepTime && sleepTime > now) {
//     filled.push({
//       title: "Free Time",
//       type: "fixed",
//       start: formatTime(pointer),
//       end: formatTime(sleepTime, true)
//     })
//   }

//   const midnight = new Date()
//   midnight.setHours(24, 0, 0, 0)

//   const lastBlockEnd = filled.length > 0 ? timeStringToDate(filled[filled.length - 1].end) : null

//   if (
//     lastBlockEnd &&
//     lastBlockEnd < midnight &&
//     lastBlockEnd > pointer &&
//     formatTime(lastBlockEnd) !== formatTime(timeStringToDate(filled[filled.length - 1].end))
//   ) {
//     filled.push({
//       title: "Sleep",
//       type: "fixed",
//       start: formatTime(lastBlockEnd),
//       end: formatTime(midnight, true)
//     })
//   }

//   // ✅ Merge Break + Free Time if directly adjacent
//   for (let i = 0; i < filled.length - 1; i++) {
//     const current = filled[i]
//     const next = filled[i + 1]

//     if (
//       current.type === "break" &&
//       next.type === "fixed" &&
//       next.title === "Free Time" &&
//       current.end === next.start
//     ) {
//       current.end = next.end
//       filled.splice(i + 1, 1)
//       i--
//     }
//   }

//   // ✅ Final filter — only drop past blocks, keep valid recurring (like breakfast)
//   const finalSchedule = filled
//     .filter(block => {
//       const blockEnd = timeStringToDate(block.end)

//       if (block.type === "task") {
//         const task = tasks.find(t => t.id === block.taskId)
//         return task && !task.isParent && blockEnd >= now
//       }

//       return block.type === "fixed" || block.type === "break"
//     })

//     .map(block => ({
//       ...block,
//       start: formatClock(block.start, prefs.use12HourClock),
//       end: formatClock(block.end, prefs.use12HourClock)
//     }))

//   localStorage.setItem("autoScheduleCache", JSON.stringify(finalSchedule))
//   localStorage.setItem("autoScheduleGeneratedAt", new Date().toISOString().slice(0, 10))

//   return finalSchedule
// }

