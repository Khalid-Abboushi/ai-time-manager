import React from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ---------- shared helpers ----------
export const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const getTimePerTask = (
  estimatedTime: number,
  deadline: string,
  isMultiDay: boolean
): number => {
  const today = new Date()
  const deadlineDate = parseLocalDate(deadline)
  const msPerDay = 1000 * 60 * 60 * 24
  const days = Math.max(Math.ceil((deadlineDate.getTime() - today.getTime()) / msPerDay) + 1, 1)
  return isMultiDay ? estimatedTime / days : estimatedTime
}

// ---------- types ----------
interface Task {
  id: string
  title: string
  completed: boolean
  category: "work" | "personal" | "health" | "learning"
  priority: "low" | "medium" | "high"
  deadline: string
  estimatedTime: number
  type: "mental" | "physical" | "work" | "social"
  parentId?: string
  isParent?: boolean
  estimatedTimePerPart?: number
}

interface Props {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  currentDate: Date
}

// ---------- UI helpers ----------
function getTaskIcon(type?: Task["type"]): React.ReactNode {
  switch (type) {
    case "mental": return "🧠"
    case "physical": return "🏃"
    case "work": return "💼"
    case "social": return "🗣️"
    default: return "📌"
  }
}

const priorityBorder = (p: Task["priority"]) =>
  ({
    low: "border-l-4 border-l-emerald-500/60",
    medium: "border-l-4 border-l-amber-500/60",
    high: "border-l-4 border-l-rose-500/70",
  }[p] || "border-l-4 border-l-border")

const priorityBadge = (p: Task["priority"]) =>
  ({
    low: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
    medium: "border-amber-500/50 text-amber-700 dark:text-amber-300",
    high: "border-rose-500/60 text-rose-700 dark:text-rose-300",
  }[p] || "")

// ====================================================================

const ScheduleTasksFromLocalStorage: React.FC<Props> = ({ tasks, setTasks: _setTasks, currentDate }) => {
  // day windows
  const startOfDay = new Date(currentDate); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(currentDate); endOfDay.setHours(23, 59, 59, 999)
  const startOfTomorrow = new Date(currentDate); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1); startOfTomorrow.setHours(0, 0, 0, 0)
  const endOfTomorrow = new Date(currentDate); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1); endOfTomorrow.setHours(23, 59, 59, 999)

  // buckets
  const todayTasks = tasks.filter(t => {
    const d = parseLocalDate(t.deadline).getTime()
    return !t.completed && !t.isParent && d >= startOfDay.getTime() && d <= endOfDay.getTime()
  })

  const tomorrowTasks = tasks.filter(t => {
    const d = parseLocalDate(t.deadline).getTime()
    return !t.completed && !t.isParent && d >= startOfTomorrow.getTime() && d <= endOfTomorrow.getTime()
  })

  const upcomingTasks = tasks.filter(t => {
    const d = parseLocalDate(t.deadline).getTime()
    return !t.completed && !t.isParent && d > endOfTomorrow.getTime()
  })

  const pastTasks = tasks.filter(t => {
    const d = parseLocalDate(t.deadline).getTime()
    return (t.completed || d < startOfDay.getTime()) && !t.isParent
  })

  // item renderer
  const renderTaskCard = (task: Task, index: number, muted = false) => {
    const timeEstimate = Number(
      tasks.find(t => t.id === task.parentId)?.estimatedTimePerPart ?? task.estimatedTime
    ).toFixed(1)

    return (
      <div
        key={task.id}
        className={cn(
          "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
          "border bg-card/70 hover:bg-accent hover:text-accent-foreground hover:shadow-md",
          "ring-1 ring-transparent hover:ring-border/40",
          muted && "opacity-80",
          priorityBorder(task.priority)
        )}
      >
        {/* Left */}
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <span className="text-xl">{getTaskIcon(task.type)}</span>
          <div className="flex flex-col min-w-0">
            <span className={cn("font-medium truncate", task.completed && "line-through text-muted-foreground")}>
              {task.title}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {timeEstimate}h • {task.category}
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end shrink-0 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground" />
            )}
            <Badge variant="outline" className={cn("capitalize", priorityBadge(task.priority))}>
              {task.priority}
            </Badge>
          </div>
          <div className="text-xs">{parseLocalDate(task.deadline).toLocaleDateString()}</div>
        </div>
      </div>
    )
  }

  // lists (single smooth scroller)
  return (
    <div className="space-y-6">
      {/* Today (not scrollable) */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Due Today</h3>
        {todayTasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks due today.</p>
        ) : (
          todayTasks.map((task, index) => renderTaskCard(task, index))
        )}
      </div>

      {/* Unified scroll area for the rest */}
      <div className="relative rounded-lg border border-border/60">
        {/* single scroll layer */}
        <div
          className="max-h-[60vh] overflow-y-auto pr-2 custom-scroll scroll-smooth"
          style={{ scrollbarGutter: "stable both-edges" as any }}
        >
          {/* Tomorrow */}
          <div className="space-y-3">
            <div className="sticky top-0 -mx-3 px-3 py-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
              <h3 className="text-lg font-semibold text-foreground">Deadline Tomorrow</h3>
            </div>
            {tomorrowTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm px-1">No tasks due tomorrow.</p>
            ) : (
              tomorrowTasks.map((task, index) => renderTaskCard(task, index))
            )}
          </div>

          {/* Upcoming */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="sticky top-0 -mx-3 px-3 py-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
              <h3 className="text-lg font-semibold text-foreground">Upcoming Tasks</h3>
            </div>
            {upcomingTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm px-1">No upcoming tasks.</p>
            ) : (
              upcomingTasks.map((task, index) => renderTaskCard(task, index))
            )}
          </div>

          {/* Past */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="sticky top-0 -mx-3 px-3 py-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
              <h3 className="text-lg font-semibold text-muted-foreground">Past / Completed Tasks</h3>
            </div>
            {pastTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm px-1">No past or completed tasks.</p>
            ) : (
              pastTasks.map((task, index) => renderTaskCard(task, index, true))
            )}
          </div>
        </div>

        {/* one soft bottom fade for the whole scroller */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg
                        bg-gradient-to-t from-background via-background/70 to-transparent" />
      </div>
    </div>
  )
}

export default ScheduleTasksFromLocalStorage
