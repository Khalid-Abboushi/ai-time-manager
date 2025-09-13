// Schedule.tsx — Merged and Preserved Version
import { useState, useEffect, useMemo } from "react"
import { Calendar , ChevronLeft , ChevronRight , Plus , AlertCircle, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { setItem, getItem } from "@/utils/localStorage"
import ScheduleTasksFromLocalStorage from "@/utils/ScheduleTasksFromLocalStorage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import DailyNotes from "@/utils/DailyNotes"
import { generateAutoSchedule, retrySchedulingUnscheduledTasks, fillFreeGaps, getFreeTimeGaps, normalizeSleep } from "@/utils/generateAutoSchedule2"
import { Task, ScheduledBlock, UserSchedulePrefs } from "@/utils/types"
import { format } from "date-fns"
import { formatClock, parseTime } from "@/utils/timeHelpers"
import { delayTaskByOneDay, attemptToScheduleTask } from "@/utils/generateAutoSchedule2"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UnderGlowSection } from "@/utils/underglow-section";
import { SiteFooter } from "@/utils/SiteFooter";


export const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day) // month is 0-based
}

// --- schedule-day helper ----------------------------------------------
const getScheduleDateStr = (now: Date, prefs: UserSchedulePrefs): string => {
  if (!prefs?.sleep) return now.toLocaleDateString("en-CA") // default midnight

  const [h, m] = prefs.sleep.split(":").map(Number)
  const boundary = new Date(now)
  boundary.setHours(h, m, 0, 0)

  if (now < boundary) {               // still “yesterday” until sleep time
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    return y.toLocaleDateString("en-CA")
  }
  return now.toLocaleDateString("en-CA")
}


const Schedule = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"daily" | "monthly" | "auto">("daily")
  const [tasks, setTasks] = useState<Task[]>(() => getItem("tasks") || [])
  const [newTask, setNewTask] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [formError, setFormError] = useState("")
  const [taskDetails, setTaskDetails] = useState({
    priority: "medium",
    deadline: "",
    estimatedTime: 1,
    type: "mental",
    isMultiDay: false 
  })

  const getDatesBetween = (start: Date, end: Date): string[] => {
    const dates = []
    const current = new Date(start)
    while (current <= end) {
      dates.push(current.toLocaleDateString("en-CA"))
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const use12HourClock =
    JSON.parse(localStorage.getItem("userSettings") || "{}")?.preferences?.use12HourClock ?? true

  const [compactView, setCompactView] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScheduledBlock | null>(null)
  
  useEffect(() => {
    const parsed = getItem("userSettings")
    if (parsed?.preferences?.compactView !== undefined) {
      setCompactView(parsed.preferences.compactView)
    } else {
      setCompactView(false)
    }
  }, [])

  const [userPrefs, setUserPrefs] = useState<UserSchedulePrefs>(() => {
    const saved = getItem("userSchedulePrefs") || {
      wakeUp: "",
      sleep: "",
      recurringBlocks: [],
      use12HourClock: false,
    }
    if (!saved.maxSessionMinutes) saved.maxSessionMinutes = 120
    return saved
  })
  const scheduleTodayStrCA = getScheduleDateStr(new Date(), userPrefs)


  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'work': return 'bg-blue-500'
      case 'health': return 'bg-green-500'
      case 'learning': return 'bg-purple-500'
      case 'personal': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const getPriorityColor = (priority: string) => {
    if (priority === "high")   return "text-red-600 dark:text-red-300"
    if (priority === "medium") return "text-amber-600 dark:text-amber-300"
    return "text-emerald-600 dark:text-emerald-300"
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (view === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const getUpcomingTasks = () => {
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return tasks.filter(task => {
      const taskDate = parseLocalDate(task.deadline)
      return !task.completed && taskDate >= now && taskDate <= weekFromNow
    })
  }

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [recurringTitle, setRecurringTitle] = useState("")
  const [recurringDuration, setRecurringDuration] = useState("")
  const [timesPerDay, setTimesPerDay] = useState(1)
  const [timeInputs, setTimeInputs] = useState([""])
  const [maxSessionDraft, setMaxSessionDraft] = useState<string>(() =>
    String(userPrefs.maxSessionMinutes ?? 120)
  )
  useEffect(() => {
    setMaxSessionDraft(String(userPrefs.maxSessionMinutes ?? 120));
  }, [userPrefs.maxSessionMinutes])

  const commitMaxSession = () => {
    const n = parseInt(maxSessionDraft, 10);
    const mins = isNaN(n) ? (userPrefs.maxSessionMinutes ?? 120) : Math.max(15, n);
    setMaxSessionDraft(String(mins));
    const updated = { ...userPrefs, maxSessionMinutes: mins };
    setUserPrefs(updated);
    setItem("userSchedulePrefs", updated);
    setRefreshSchedule(true);
  };

  const formatTimeLeft = (deadline: string): string => {
    const now = new Date()
    const end = parseLocalDate(deadline)
    const diff = end.getTime() - now.getTime()
    if (diff <= 0) return "Time's up"
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remHours = hours % 24
      return `${days} day${days > 1 ? "s" : ""} ${remHours}h left`
    }
    return `${hours} hour${hours !== 1 ? "s" : ""} ${minutes}m left`
  }

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const confirmAddTask = () => {
    if (
      !newTask.trim() ||
      !taskDetails.deadline ||
      !taskDetails.estimatedTime ||
      !taskDetails.type ||
      !taskDetails.priority
    ) {
      setFormError("Please fill in all task details before adding.")
      return
    }

    const today = new Date()
    const deadlineDate = parseLocalDate(taskDetails.deadline)

    if (taskDetails.isMultiDay && taskDetails.estimatedTime > 1 && deadlineDate > today) {
      const parentId = Date.now().toString()
      const splitDates = getDatesBetween(today, deadlineDate)
      const hoursPerDay = taskDetails.estimatedTime / splitDates.length

      const parentTask: Task = {
        id: parentId,
        title: newTask,
        completed: false,
        category: 'personal',
        priority: taskDetails.priority as Task["priority"],
        deadline: taskDetails.deadline,
        estimatedTime: taskDetails.estimatedTime,
        type: taskDetails.type as Task["type"],
        isParent: true,
        created_at: new Date().toISOString()
      }

      const subtasks: Task[] = splitDates.map((date, index) => ({
        id: `${parentId}-part-${index}`,
        title: `${newTask} (Part ${index + 1} of ${splitDates.length})`,
        completed: false,
        category: 'personal',
        priority: taskDetails.priority as Task["priority"],
        deadline: date,
        estimatedTime: hoursPerDay,
        type: taskDetails.type as Task["type"],
        parentId: parentId,
        partIndex: index,
        totalParts: splitDates.length,
        showToday: index === 0,       
        locked: index !== 0,
        created_at: new Date().toISOString()           
      }))

      setTasks(prev => [...prev, parentTask, ...subtasks])
    } else {
      const task: Task = {
        id: Date.now().toString(),
        title: newTask,
        completed: false,
        category: 'personal',
        priority: taskDetails.priority as Task["priority"],
        deadline: taskDetails.deadline,
        estimatedTime: taskDetails.estimatedTime,
        type: taskDetails.type as Task["type"],
        created_at: new Date().toISOString()
      }
      setTasks(prev => [...prev, task])
    }

    setNewTask("")
    setTaskDetails({
      priority: "medium",
      deadline: "",
      estimatedTime: 1,
      type: "mental",
      isMultiDay: false
    })
    setFormError("")
    setShowDialog(false)
  }

  const [recurringError, setRecurringError] = useState("")
  const [showToast, setShowToast] = useState(false)

  const hasTimeConflicts = (): boolean => {
    const times: { start: Date; end: Date }[] = timeInputs.map(t => {
      const [hourStr, minuteStr] = t.split(":")
      const hour = parseInt(hourStr)
      const minute = parseInt(minuteStr)
      const date = new Date()
      date.setHours(hour, minute, 0, 0)
      const end = new Date(date.getTime() + (parseInt(recurringDuration) || 10) * 60000)
      return { start: date, end }
    })

    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        if (times[i].start < times[j].end && times[j].start < times[i].end) {
          return true
        }
      }
    }

    return false
  }

  const [dailyStreak, setDailyStreak] = useState(() => getItem("dailyStreak") || 0)
  const [longestStreak, setLongestStreak] = useState(() => getItem("longestStreak") || 0)
  const todayStrCA = scheduleTodayStrCA

  const todays = tasks.filter(t => t.deadline === todayStrCA && !t.isParent)
  const doneToday = todays.filter(t => t.completed && t.completedOn === todayStrCA)
  const dailyPercent = todays.length ? Math.round((doneToday.length / todays.length) * 100) : 0

  const streak = getItem("dailyStreak") || 0
  const longest = getItem("longestStreak") || 0

  const updateSubtasksForNewDay = (todayStr: string) => {
    setTasks(prev => {
      const updated: Task[] = [...prev]
      const parents = updated.filter(t => t.isParent)

      parents.forEach(parent => {
        const subtasks = updated
          .filter(t => t.parentId === parent.id)
          .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0))

        const firstIncomplete = subtasks.findIndex(st => !st.completed)
        if (firstIncomplete === -1) return

        subtasks.forEach(st => {
          st.showToday = false
          st.locked = true
        })

        if (subtasks[firstIncomplete]) {
          subtasks[firstIncomplete].showToday = true
          subtasks[firstIncomplete].locked = false
        }

        if (subtasks[firstIncomplete + 1]) {
          subtasks[firstIncomplete + 1].showToday = true
          subtasks[firstIncomplete + 1].locked = true
        }
      })

      setItem("tasks", updated)
      return updated
    })
  }

  useEffect(() => {
    setItem("tasks", tasks)

    const ids = new Set(tasks.map(t => t.id))

    const cachedRaw = getItem("autoScheduleCache") || []
    const parsed: ScheduledBlock[] = cachedRaw.map((b: any) => ({
      ...b,
      startDate: new Date(b.startDate as any),
      endDate: new Date(b.endDate as any),
    }))

    const pruned = parsed.filter(b =>
      b.type !== "task" ||
      !b.taskId ||
      ids.has(b.taskId) ||
      (b.taskId?.includes("-part") && ids.has(b.taskId.split("-part")[0]))
    )

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const prefs = getItem("userSchedulePrefs") || userPrefs
    const wake = parseTime(prefs?.wakeUp || userPrefs.wakeUp || "", today)
    const sleep0 = parseTime(prefs?.sleep  || userPrefs.sleep  || "", today)
    const sleep = normalizeSleep(wake, sleep0)
    const withoutFree = pruned.filter(b => b.type !== "free")
    const rebuilt = fillFreeGaps(withoutFree, wake, sleep).sort(
      (a, b) => a.startDate!.getTime() - b.startDate!.getTime()
    )

    setAutoSchedule(rebuilt)
    setItem("autoScheduleCache", rebuilt)
    setItem("autoScheduleGeneratedOn", today.toISOString().split("T")[0])

    const cachedUns: Task[] = getItem("unscheduledTasksCache") || []
    const prunedUns = cachedUns.filter(t =>
      ids.has(t.id) ||
      (t.id?.includes("-part") && ids.has(t.id.split("-part")[0]))
    )
    if (prunedUns.length !== cachedUns.length) {
      setItem("unscheduledTasksCache", prunedUns)
    }
    setUnscheduledTasks(prunedUns)

    if (tasks.length === 0) {
      setItem("unscheduledTasksCache", [])
      setUnscheduledTasks([])
    }

    const sig = JSON.stringify(
      tasks.map(t => ({
        id: t.id,
        deadline: t.deadline,
        estimatedTime: t.estimatedTime,
        priority: t.priority,
        completed: !!t.completed,
        completedOn: t.completedOn || null,
        showToday: !!t.showToday,
        locked: !!t.locked,
        parentId: t.parentId || null,
      }))
    )
    const prevSig = getItem("scheduleRegenSig")
    if (sig !== prevSig) {
      setItem("scheduleRegenSig", sig)
      setRefreshSchedule(true)
    }
  }, [tasks])

  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = getScheduleDateStr(new Date(), userPrefs)
      const lastCheckedDate = localStorage.getItem("lastCheckedDate")

      if (lastCheckedDate !== todayStr) {
        localStorage.setItem("lastCheckedDate", todayStr)

        setTasks(prev => {
          const updated = [...prev]
          const parents = updated.filter(t => t.isParent)
          for (const parent of parents) {
            const subtasks = updated.filter(t => t.parentId === parent.id)
            const shownSubtasks = subtasks.filter(st => st.showToday)
            const lastShown = shownSubtasks.at(-1)
            const nextIndex = lastShown ? lastShown.partIndex! : 0
            const next = subtasks.find(t => t.partIndex === nextIndex + 1)
            if (next) {
              const prev = subtasks.find(t => t.partIndex === next.partIndex! - 1)
              next.showToday = true
              next.locked = !prev?.completed
            }
          }
          return updated
        })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [tasks])

  const todayTasks = tasks.filter(
    task => parseLocalDate(task.deadline).toDateString() === currentDate.toDateString()
  )

  const [delayToast, setDelayToast] = useState<string | null>(null)
  function isCompleted(taskId?: string) {
    const taskList = getItem("tasks") || []
    return taskList.find(t => t.id === taskId)?.completed ?? false
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const today = new Date()
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [regenerateChoice, setRegenerateChoice] = useState<"shorten" | "delay" | null>(null)
  const [openDay, setOpenDay] = useState<{ date: Date; tasks: Task[] } | null>(null)

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()

  useEffect(() => {
    const todayStr = getScheduleDateStr(new Date(), userPrefs)
    const completedToday = tasks.some(
      task => task.completed && task.completedOn === todayStr && !task.isParent
    )
  
    const lastStreakUpdate = getItem("lastStreakUpdate")
    if (lastStreakUpdate === todayStr) return
  
    if (completedToday) {
      const current = (getItem("dailyStreak") || 0) + 1
      const longest = Math.max(current, getItem("longestStreak") || 0)
    
      setDailyStreak(current)
      setLongestStreak(longest)
      setItem("dailyStreak", current)
      setItem("longestStreak", longest)
      setItem("lastStreakUpdate", todayStr)
    } else {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toLocaleDateString("en-CA")
      const completedYesterday = tasks.some(
        task => task.completed && task.completedOn === yStr && !task.isParent
      )
    
      if (lastStreakUpdate !== todayStr && lastStreakUpdate !== yStr && !completedYesterday) {
        setDailyStreak(0)
        setItem("dailyStreak", 0)
        setItem("lastStreakUpdate", todayStr)
      }
    }
  }, [tasks])

  const [autoSchedule, setAutoSchedule] = useState<ScheduledBlock[]>([])
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([])
  const [refreshSchedule, setRefreshSchedule] = useState(false)
  const [currentDate2, setCurrentDate2] = useState(new Date().toDateString())

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    const cached = getItem("autoScheduleCache")
    const generatedOn = getItem("autoScheduleGeneratedOn")
    const prefs = getItem("userSchedulePrefs") || {}
    const tasks = getItem("tasks") || []
    const isSameDay = generatedOn === todayStr
    const validPrefs = prefs?.wakeUp && prefs?.sleep
    if (!validPrefs) return

    if (!refreshSchedule && cached && isSameDay) {
      setAutoSchedule(cached)
      setUnscheduledTasks(getItem("unscheduledTasksCache") || [])
      return
    }

    const { blocks, unscheduled } = generateAutoSchedule(tasks, prefs)
    setAutoSchedule(blocks)
    setUnscheduledTasks(unscheduled)
    setItem("autoScheduleCache", blocks)
    setItem("autoScheduleGeneratedOn", todayStr)
    setItem("unscheduledTasksCache", unscheduled)
    setRefreshSchedule(false)
  }, [refreshSchedule])

  function getBlockColor(type: string, priority?: string) {
    if (type === "recurring") {
      return "bg-cyan-50 border-cyan-400 dark:bg-cyan-950/30 dark:border-cyan-400/50"
    }
    if (type === "sleep") {
      return "bg-indigo-50 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-400/50"
    }
    if (type === "free") {
      return "bg-pink-50 border-pink-300 dark:bg-pink-950/30 dark:border-pink-400/50"
    }
    if (type === "break") {
      return "bg-zinc-100 border-zinc-400 dark:bg-zinc-900/40 dark:border-zinc-500/50"
    }
    if (type === "task") {
      if (priority === "high") {
        return "bg-red-50 border-red-500 dark:bg-red-500/30 dark:border-red-500/60"
      }
      if (priority === "medium") {
        return "bg-orange-50 border-orange-500 dark:bg-orange-950/30 dark:border-orange-500/60"
      }
      return "bg-green-50 border-green-500 dark:bg-green-950/30 dark:border-green-500/60"
    }
    return "bg-muted border-border dark:bg-muted/20 dark:border-border/60"
  }

  function getTaskIcon(type?: string): string {
    switch (type) {
      case "mental": return "🧠"
      case "physical": return "🏃"
      case "work": return "💼"
      case "social": return "🗣️"
      case "recurring": return "📌"
      default: return "⌚"
    }
  }

  function formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5)
  }

  function handleDeleteRecurringBlock(block: ScheduledBlock) {
    if (!block.startDate) return
    const formattedStart = new Date(block.startDate).toTimeString().slice(0, 5)
    const updatedRecurring = (userPrefs.recurringBlocks || [])
      .map(rec => {
        if (rec.title !== block.title) return rec
        const filteredTimes = rec.times.filter(t => t !== formattedStart)
        if (filteredTimes.length === 0) return null
        return { ...rec, times: filteredTimes }
      })
      .filter(Boolean) as UserSchedulePrefs["recurringBlocks"]
    const updatedPrefs = { ...userPrefs, recurringBlocks: updatedRecurring }
    setItem("userSchedulePrefs", updatedPrefs)
    setUserPrefs(updatedPrefs)
    setRefreshSchedule(true)
  }

  function rescheduleOneTask(task: Task, option: "shorten" | "delay") {
    const prefs: UserSchedulePrefs = getItem("userSchedulePrefs")
    if (!prefs?.wakeUp || !prefs?.sleep) return

    if (option === "delay") {
      const updatedTasks = [...getItem("tasks") || []]
      const index = updatedTasks.findIndex(t => t.id === task.id)
      if (index !== -1) {
        const updatedTask = delayTaskByOneDay(task)
        updatedTasks[index] = updatedTask
        setItem("tasks", updatedTasks)
        setTasks(updatedTasks)

        const { blocks, unscheduled } = generateAutoSchedule(updatedTasks, prefs)
        setAutoSchedule(blocks)
        setUnscheduledTasks(unscheduled)
        setItem("autoScheduleCache", blocks)
        setItem("unscheduledTasksCache", unscheduled)

        setDelayToast(`✅ '${task.title}' delayed to tomorrow and re-scheduled!`)
        setTimeout(() => setDelayToast(null), 5000)
      }
    }

    if (option === "shorten") {
      const { blocks, success } = attemptToScheduleTask(task, prefs)
      if (!success) {
        setDelayToast("⚠️ Not enough time to fit this task. Try extending your wake hours.")
        setTimeout(() => setDelayToast(null), 5000)
        return
      }
      const current = getItem("unscheduledTasksCache") || unscheduledTasks
      const updatedUnscheduled = current.filter((t: Task) => t.id !== task.id)

      setItem("autoScheduleCache", blocks)
      setItem("unscheduledTasksCache", updatedUnscheduled)
      setAutoSchedule(blocks)
      setUnscheduledTasks(updatedUnscheduled)

      setDelayToast(`✅ '${task.title}' has been fit into your day!`)
      setTimeout(() => setDelayToast(null), 5000)
    }
  }

  function isCurrentBlock(block: { startDate?: Date; endDate?: Date }) {
    if (!block.startDate || !block.endDate) return false;
    const now = new Date().getTime();
    return new Date(block.startDate).getTime() <= now && now <= new Date(block.endDate).getTime();
  }

  function RingDial({
    label,
    hours,
    color,
  }: { label: string; hours: number; color: string }) {
    const r = 22
    const stroke = 8
    const c = 2 * Math.PI * r
    const fullAt = 1
    const neonAt = 2
    const progress = Math.min(hours / fullAt, 1)
    const dashOffset = c * (1 - progress)
    const isNeon = hours >= neonAt
    const idSuffix = useMemo(() => label.replace(/\s+/g, "-"), [label])
    const solidGradId = `grad-${idSuffix}`
    const goldGradId  = `gold-${idSuffix}`
    const glowId      = `glow-${idSuffix}`

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 64 64" className="-rotate-90 absolute inset-0">
            <defs>
              <linearGradient id={solidGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={color} />
              </linearGradient>
              <linearGradient id={goldGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#FFF7B0" />
                <stop offset="35%"  stopColor="#FDE68A" />
                <stop offset="55%"  stopColor="#F59E0B" />
                <stop offset="75%"  stopColor="#FFD700" />
                <stop offset="100%" stopColor="#FFF59E" />
              </linearGradient>
              <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#FDE68A" floodOpacity="0.9" />
                <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#F59E0B" floodOpacity="0.9" />
              </filter>
            </defs>

            <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
            {isNeon && (
              <circle
                cx="32" cy="32" r={r}
                fill="none"
                strokeLinecap="round"
                strokeWidth={stroke + 2}
                strokeDasharray={c}
                strokeDashoffset={dashOffset}
                stroke={`url(#${goldGradId})`}
                filter={`url(#${glowId})`}
                opacity={0.95}
              />
            )}
            <circle
              cx="32" cy="32" r={r}
              fill="none"
              strokeLinecap="round"
              strokeWidth={stroke}
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
              stroke={isNeon ? `url(#${goldGradId})` : `url(#${solidGradId})`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
            {hours.toFixed(1)}h
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    )
  }

  function BalanceRings({ tasks }: { tasks: Task[] }) {
    const todayStr = getScheduleDateStr(new Date(), userPrefs)
    const hoursByType = useMemo(() => {
      const map: Record<Task["type"], number> = { work: 0, mental: 0, physical: 0, social: 0 }
      for (const t of tasks) {
        if (t.completed && t.completedOn === todayStr && !t.isParent) {
          map[t.type] += (t.estimatedTime || 0)
        }
      }
      return map
    }, [tasks, todayStr])

    return (
      <div className="grid grid-cols-4 gap-4">
        <RingDial label="Work"     hours={hoursByType.work}     color="#3B82F6" />
        <RingDial label="Mental"   hours={hoursByType.mental}   color="#8B5CF6" />
        <RingDial label="Physical" hours={hoursByType.physical} color="#10B981" />
        <RingDial label="Social"   hours={hoursByType.social}   color="#EC4899" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* === BIG UNDERGLOW WRAPPER AROUND THE WHOLE PAGE CONTENT === */}
          <UnderGlowSection
            color="violet"
            insetClassName="-inset-8 md:-inset-14 lg:-inset-20"
            className="space-y-6"
          >
            {/* Tiny header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
                <p className="text-sm text-muted-foreground">Plan and organize your time effectively</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button className="bg-gradient-primary hover-glow h-9" onClick={() => setShowRecurringDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Recurring
                </Button>
                <Button className="bg-gradient-primary hover-glow h-9" onClick={() => setShowDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Task
                </Button>
              </div>
            </div>

            {/* Sticky compact toolbar */}
            <div
              className="sticky top-2 z-20 rounded-xl border shadow-sm backdrop-blur
                         bg-card/80 supports-[backdrop-filter]:bg-card/60 border-border/60
                         dark:bg-card/70 dark:supports-[backdrop-filter]:bg-card/50 dark:border-border/40
                         text-foreground"
            >
              <div className="grid grid-cols-12 gap-3 p-3">
                {/* Date nav */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateDate("prev")} className="hover-glow text-foreground">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="min-w-0 text-sm font-semibold truncate">
                    {formatDate(currentDate)}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigateDate("next")} className="hover-glow text-foreground">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Wake / Sleep */}
                <div className="col-span-6 md:col-span-4 lg:col-span-3 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Wake</Label>
                    <Input
                      type="time"
                      value={userPrefs.wakeUp}
                      onChange={(e) => {
                        const updated = { ...userPrefs, wakeUp: e.target.value }
                        setUserPrefs(updated)
                        setItem("userSchedulePrefs", updated)
                        setRefreshSchedule(true)
                      }}
                      className="h-8 w-[92px] text-xs text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Sleep</Label>
                    <Input
                      type="time"
                      value={userPrefs.sleep}
                      onChange={(e) => {
                        const updated = { ...userPrefs, sleep: e.target.value }
                        setUserPrefs(updated)
                        setItem("userSchedulePrefs", updated)
                        setRefreshSchedule(true)
                      }}
                      className="h-8 w-[92px] text-xs text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                {/* Max session & Compact toggle */}
                <div className="col-span-6 md:col-span-4 lg:col-span-3 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        Max Session
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start" className="max-w-[260px]">
                            This is the longest time you are willing to work on a single task in one sitting.
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                    </TooltipProvider>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={maxSessionDraft}
                      onChange={(e) => setMaxSessionDraft(e.target.value.replace(/[^\d]/g, ""))}
                      onBlur={commitMaxSession}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitMaxSession();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="h-8 w-[90px] text-xs text-foreground placeholder:text-muted-foreground"
                      placeholder="minutes"
                    />
                  </div>

                  <Button
                    variant="outline"
                    className="h-8 text-xs text-foreground"
                    onClick={() => {
                      const newVal = !compactView
                      setCompactView(newVal)
                      const userSettings = getItem("userSettings") || {}
                      const updated = {
                        ...userSettings,
                        preferences: { ...(userSettings.preferences || {}), compactView: newVal },
                      }
                      setItem("userSettings", updated)
                    }}
                  >
                    {compactView ? "Compact: On" : "Compact: Off"}
                  </Button>
                </div>

                {/* Tabs */}
                <div className="col-span-12 md:col-span-12 lg:col-span-3 flex items-center justify-end">
                  <Tabs value={view} onValueChange={(v) => setView(v as "daily" | "monthly" | "auto")}>
                    <TabsList className="h-8">
                      <TabsTrigger className="text-xs h-8 text-muted-foreground data-[state=active]:text-foreground" value="daily">
                        Daily
                      </TabsTrigger>
                      <TabsTrigger className="text-xs h-8 text-muted-foreground data-[state=active]:text-foreground" value="monthly">
                        Monthly
                      </TabsTrigger>
                      <TabsTrigger className="text-xs h-8 text-muted-foreground data-[state=active]:text-foreground" value="auto">
                        Auto
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>

            {/* Slim stat ribbon */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-4 border shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Balance</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <BalanceRings tasks={tasks} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-4 border shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Next Up</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {(() => {
                    const now = new Date()
                    const upcoming = autoSchedule
                      .filter(b => b.type === "task" && new Date(b.endDate!) > now)
                      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())[0]
                    if (!upcoming) return <div className="text-xs text-muted-foreground">Nothing scheduled soon.</div>
                    const endMs = new Date(upcoming.endDate!).getTime() - now.getTime()
                    const m = Math.max(0, Math.floor(endMs / 60000))
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-lg">⏱️</span>
                        <span className="truncate">
                          <span className="font-medium">{upcoming.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">ends in {m}m</span>
                        </span>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>

              <Card className="lg:col-span-4 border shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Achievement Ladder</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {(() => {
                    const totalDone  = tasks.filter(t => t.completed && !t.isParent).length
                    const totalHours = tasks.filter(t => t.completed).reduce((s, t) => s + (t.estimatedTime || 0), 0)
                    const TASK_MILESTONES = [1,3,5,10,15,20,30,40,50,75,100,150,200]
                    const HOUR_MILESTONES = [1,2,5,10,20,30,40,50,75,100,150,200,300,500]
                    const nextOf = (arr: number[], val: number) => arr.find(x => x > val) ?? Math.ceil((val + Math.max(5, val * 0.25)) / 5) * 5
                    const nextTasks = nextOf(TASK_MILESTONES, totalDone)
                    const nextHours = nextOf(HOUR_MILESTONES, totalHours)
                    const items = [
                      { label: `Complete ${nextTasks} tasks`, done: totalDone,  target: nextTasks, unit: "tasks" as const },
                      { label: `Log ${nextHours} hours`,     done: totalHours, target: nextHours, unit: "h"     as const },
                    ]
                    return items.map((it, i) => {
                      const pct = Math.min(100, Math.round((it.done / it.target) * 100))
                      const remain = Math.max(0, it.target - it.done)
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate">{it.label}</span>
                            <span className="tabular-nums text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded overflow-hidden">
                            <div className="h-1.5 rounded bg-gradient-to-r from-fuchsia-500 to-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[11px] text-muted-foreground">Need {remain}{i === 0 ? " tasks" : "h"} more</div>
                        </div>
                      )
                    })
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Schedule (primary) */}
              <div className="lg:col-span-2">
                <Card className="bg-gradient-card shadow-card border-0">
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="w-5 h-5 text-primary" />
                      <span>{view.charAt(0).toUpperCase() + view.slice(1)} View</span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-2">
                    {/* DAILY */}
                    {view === "daily" && (
                      <ScheduleTasksFromLocalStorage
                        tasks={[...tasks].sort((a, b) => {
                          const priorityOrder = { high: 1, medium: 2, low: 3 }
                          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                            return priorityOrder[a.priority] - priorityOrder[b.priority]
                          }
                          return parseLocalDate(a.deadline).getTime() - parseLocalDate(b.deadline).getTime()
                        })}
                        setTasks={() => {}}
                        currentDate={currentDate}
                      />
                    )}

                    {/* MONTHLY */}
                    {view === "monthly" && (
                      <div className="max-h-[70vh] overflow-auto pr-1 custom-scroll">
                        <div className="relative overflow-hidden rounded-xl border border-border/60">
                          <div className="pointer-events-none absolute inset-0
                              bg-[radial-gradient(120%_70%_at_0%_0%,rgba(124,58,237,0.10),transparent_60%),radial-gradient(90%_60%_at_100%_100%,rgba(236,72,153,0.08),transparent_55%)]
                              dark:bg-[radial-gradient(120%_70%_at_0%_0%,rgba(124,58,237,0.16),transparent_60%),radial-gradient(90%_60%_at_100%_100%,rgba(236,72,153,0.12),transparent_55%)]" />
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-500" />
                          <div className="grid grid-cols-7 border-b border-border/60">
                            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                              <div key={d} className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground">{d}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-2 sm:gap-3 p-2 sm:p-3">
                            {(() => {
                              const y = currentDate.getFullYear()
                              const m = currentDate.getMonth()
                              const first = new Date(y, m, 1)
                              const startOffset = first.getDay()
                              const days = new Date(y, m + 1, 0).getDate()
                              const today = new Date()
                              const isSame = (a: Date, b: Date) =>
                                a.getFullYear() === b.getFullYear() &&
                                a.getMonth() === b.getMonth() &&
                                a.getDate() === b.getDate()

                              const pillByPriority = (p: "low" | "medium" | "high") =>
                                ({
                                  high:   "border border-red-400/50 bg-red-500/15 text-red-300",
                                  medium: "border border-amber-400/50 bg-amber-500/15 text-amber-300",
                                  low:    "border border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                                }[p])

                              const dotByType = (t: "work" | "mental" | "physical" | "social") =>
                                ({ work:"bg-blue-400", mental:"bg-purple-400", physical:"bg-emerald-400", social:"bg-pink-400" }[t])

                              const cells: JSX.Element[] = []
                              for (let i = 0; i < startOffset; i++) cells.push(<div key={`blank-${i}`} />)

                              for (let d = 1; d <= days; d++) {
                                const date = new Date(y, m, d)
                                const isToday = isSame(date, today)
                                const isWeekend = [0,6].includes(date.getDay())

                                const dayTasks = tasks
                                  .filter(t => parseLocalDate(t.deadline).toDateString() === date.toDateString())
                                  .sort((a,b) => {
                                    const s = { high:1, medium:2, low:3 } as const
                                    return (s[a.priority]-s[b.priority]) ||
                                           (parseLocalDate(a.deadline).getTime()-parseLocalDate(b.deadline).getTime())
                                  })

                                const visible = dayTasks.slice(0, 2)
                                const more = Math.max(0, dayTasks.length - visible.length)

                                cells.push(
                                  <button
                                    key={`day-${d}`}
                                    onClick={() => dayTasks.length && setOpenDay({ date, tasks: dayTasks })}
                                    className={cn(
                                      "relative flex h-[92px] sm:h-[110px] flex-col rounded-xl border p-2 text-left transition-all",
                                      "bg-card/70 border-border/60 hover:bg-accent hover:text-accent-foreground hover:shadow-md",
                                      "ring-1 ring-transparent hover:ring-border/40",
                                      isWeekend && "bg-gradient-to-b from-background/40 to-background/20",
                                      isToday && "border-violet-400/50"
                                    )}
                                  >
                                    <div className="mb-1 flex items-center justify-between">
                                      <span className={cn("text-sm font-semibold", isToday && "text-violet-300")}>{d}</span>
                                      {dayTasks.length > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                                          {dayTasks.length}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1 space-y-1 overflow-hidden">
                                      {visible.map(t => (
                                        <div
                                          key={t.id}
                                          className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]", pillByPriority(t.priority))}
                                        >
                                          <span className={cn("h-1.5 w-1.5 rounded-full", dotByType(t.type))} />
                                          <span className="truncate">{t.title}</span>
                                        </div>
                                      ))}
                                      {more > 0 && (
                                        <div className="text-[11px] text-muted-foreground">+{more} more</div>
                                      )}
                                    </div>

                                    {isToday && <span className="pointer-events-none absolute -inset-px rounded-xl ring-1 ring-violet-400/40" />}
                                  </button>
                                )
                              }

                              return cells
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AUTO */}
                    {view === "auto" && (
                      <div className="space-y-2">
                        {autoSchedule.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No schedule generated yet.</p>
                        ) : (
                          autoSchedule.map((block, i) => {
                            const task = tasks.find((t) => t.id === block.taskId)
                            const start = format(new Date(block.startDate!), use12HourClock ? "h:mm a" : "HH:mm")
                            const end   = format(new Date(block.endDate!),   use12HourClock ? "h:mm a" : "HH:mm")
                            const current = isCurrentBlock(block)
                            const done    = block.type === "task" && isCompleted(block.taskId)

                            return (
                              <div key={i} className="relative group">
                                {current && (
                                  <div
                                    className="absolute -left-36 top-1/2 -translate-y-1/2 z-10 select-none"
                                    style={{ pointerEvents: "none" }}
                                  >
                                    <div className="relative inline-block bg-red-600 border border-red-700 text-white
                                                    font-bold text-[12px] px-3 py-1 shadow rounded">
                                      YOU&nbsp;ARE&nbsp;HERE
                                                                
                                      {/* ▼ arrow */}
                                      <span
                                        className="absolute right-[-12px] top-1/2 -translate-y-1/2
                                                   w-0 h-0 border-y-[8px] border-y-transparent
                                                   border-l-[12px] border-l-red-600"
                                      />
                                    </div>
                                  </div>
                                )}



                                <div
                                  className={cn(
                                    "relative flex items-center gap-4 rounded-xl border-l-4 px-4 py-3 shadow-sm transition-all duration-300 ease-in-out select-none",
                                    current ? "ring-2 ring-indigo-500 ring-offset-2" : "hover:ring-2 hover:ring-offset-2 hover:ring-indigo-400",
                                    compactView ? "text-sm" : "text-base",
                                    getBlockColor(block.type, task?.priority)
                                  )}
                                  style={{ userSelect: "none" }}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center gap-2 font-mono tracking-tight",
                                      compactView ? "text-[11px] w-[120px]" : "text-xs w-[140px] flex-col",
                                      "text-foreground/80 group-hover:text-foreground/95",
                                      current && "text-foreground"
                                    )}
                                  >
                                    {start === end ? (
                                      <span className="whitespace-nowrap">{start}</span>
                                    ) : (
                                      <>
                                        <span className="whitespace-nowrap">{start}</span>
                                        <span className="whitespace-nowrap">{end}</span>
                                      </>
                                    )}
                                  </div>

                                  <div
                                    className={cn(
                                      "flex-grow truncate font-semibold flex items-center gap-2",
                                      "text-foreground/90 group-hover:text-foreground",
                                      current && "text-foreground",
                                      "drop-shadow-[0_1px_0_rgba(0,0,0,.35)]"
                                    )}
                                  >
                                    <span className="opacity-90"></span>
                                    <span
                                      className={cn(
                                        "truncate",
                                        done ? "line-through text-foreground/60" : "text-foreground"
                                      )}
                                      title={task?.title ?? block.title}
                                    >
                                      {task?.title ?? block.title}
                                    </span>
                                  </div>

                                  {block.type === "recurring" && (
                                    <button
                                      onClick={() => setDeleteTarget(block)}
                                      className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 text-xl"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}

                        {/* Unscheduled (today only) */}
                        {(() => {
                          const todayStr = new Date().toISOString().split("T")[0]
                          const unscheduledDueToday = unscheduledTasks.filter((t) => t.deadline === todayStr)
                          if (unscheduledDueToday.length === 0) return null
                          return (
                            <Card className="mt-4 border-red-400 shadow-md bg-red-50">
                              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <CardTitle className="text-red-600">⚠ Unscheduled Tasks</CardTitle>
                                  <CardDescription>These tasks couldn’t be scheduled due to lack of time.</CardDescription>
                                </div>
                                <Button variant="destructive" onClick={() => setShowRegenerateDialog(true)}>
                                  Regenerate
                                </Button>
                              </CardHeader>
                              <CardContent className="grid gap-3">
                                {unscheduledDueToday
                                  .slice()
                                  .sort((a, b) => {
                                    const score = { high: 1, medium: 2, low: 3 }
                                    return (
                                      score[a.priority] - score[b.priority] ||
                                      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
                                    )
                                  })
                                  .map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between rounded-md border border-red-200 bg-white px-3 py-2 shadow-sm"
                                    >
                                      <div className="text-sm font-medium truncate">{t.title}</div>
                                      <div className="text-xs text-muted-foreground">{t.estimatedTime} hr</div>
                                    </div>
                                  ))}
                              </CardContent>
                            </Card>
                          )
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card className="bg-gradient-card shadow-card border-0">
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Upcoming Deadlines</span>
                    </CardTitle>
                    <CardDescription>Don't miss these important dates</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[300px] overflow-y-auto pr-2 space-y-3 custom-scroll">
                    {getUpcomingTasks().length > 0 ? (
                      getUpcomingTasks().map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-start p-3 rounded-xl border shadow-sm transition-colors duration-200 hover:shadow-md",
                            "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 hover:from-yellow-100 hover:to-yellow-50",
                            "dark:bg-gradient-to-br dark:from-amber-950/30 dark:to-yellow-950/10 dark:border-amber-400/30",
                            "dark:hover:from-amber-900/30 dark:hover:to-yellow-900/10",
                            "ring-1 ring-transparent hover:ring-border/40 dark:hover:ring-amber-400/30"
                          )}
                        >
                          <div className={cn("w-3 h-3 mt-1 rounded-full", getCategoryColor(task.category))} />
                          <div className="flex-1 ml-3 min-w-0">
                            <p className="font-medium text-yellow-900 truncate">{task.title}</p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Due: {parseLocalDate(task.deadline).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card shadow-card border-0">
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2">
                      <span>📝</span>
                      <span>Daily Notes</span>
                    </CardTitle>
                    <CardDescription>Write anything you want to remember today.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DailyNotes />
                  </CardContent>
                </Card>
              </div>
            </div>
          </UnderGlowSection>
        </div>
        <SiteFooter />
      </div>

      {/* ===== Modals & Toasts ===== */}
      <Dialog open={!!openDay} onOpenChange={(v) => !v && setOpenDay(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{openDay ? format(openDay.date, "EEEE, MMM d") : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {openDay?.tasks.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.type} • {t.priority} • {parseLocalDate(t.deadline).toLocaleDateString()}
                  </div>
                </div>
                <div className={cn("h-2 w-2 rounded-full", {
                  work: "bg-blue-400",
                  mental: "bg-purple-400",
                  physical: "bg-emerald-400",
                  social: "bg-pink-400",
                }[t.type])} />
              </div>
            ))}
            {!openDay?.tasks?.length && <p className="text-sm text-muted-foreground">No tasks.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">🛠 Regenerate Schedule</DialogTitle>
            <DialogDescription>Choose how to fit the task into today.</DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2 text-sm">
            <p>
              <span className="font-medium">Adding:</span> {unscheduledTasks[0]?.title}
            </p>

            <div className="mt-2 space-y-2">
              <Label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="reschedule"
                  value="shorten"
                  checked={regenerateChoice === "shorten"}
                  onChange={(e) => setRegenerateChoice(e.target.value as "shorten" | "delay")}
                />
                <span>Shorten breaks and split task into smaller parts to fit it in</span>
              </Label>

              <Label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="reschedule"
                  value="delay"
                  checked={regenerateChoice === "delay"}
                  onChange={(e) => setRegenerateChoice(e.target.value as "shorten" | "delay")}
                />
                <span>Delay this task to tomorrow</span>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={!regenerateChoice}
              onClick={() => {
                if (unscheduledTasks.length > 0 && regenerateChoice) {
                  rescheduleOneTask(unscheduledTasks[0], regenerateChoice)
                  setShowRegenerateDialog(false)
                  setRegenerateChoice(null)
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Recurring Block</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.title} at{" "}
                {deleteTarget && format(new Date(deleteTarget.startDate!), use12HourClock ? "h:mm a" : "HH:mm")}
              </span>{" "}
              from your daily recurring schedule?
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  handleDeleteRecurringBlock(deleteTarget)
                  setDeleteTarget(null)
                  setShowToast(true)
                  setRefreshSchedule(true)
                  setTimeout(() => setShowToast(false), 10000)
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          Recurring task deleted
        </div>
      )}
      {delayToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {delayToast}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task Title</Label>
              <Input
                type="text"
                placeholder="e.g. Finish report"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <select
                className="w-full p-2 rounded border"
                value={taskDetails.priority}
                onChange={(e) => setTaskDetails({ ...taskDetails, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                value={taskDetails.deadline}
                onChange={(e) => setTaskDetails({ ...taskDetails, deadline: e.target.value })}
              />
            </div>
            <div>
              <Label>Estimated Time (hrs)</Label>
              <Input
                type="number"
                min="1"
                value={taskDetails.estimatedTime}
                onChange={(e) =>
                  setTaskDetails({ ...taskDetails, estimatedTime: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Type of Work</Label>
              <select
                className="w-full p-2 rounded border"
                value={taskDetails.type}
                onChange={(e) => setTaskDetails({ ...taskDetails, type: e.target.value })}
              >
                <option value="mental">Mental</option>
                <option value="physical">Physical</option>
                <option value="work">Work</option>
                <option value="social">Social</option>
              </select>
            </div>
            <div>
              <Label>Multi-Day Task?</Label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="checkbox"
                  checked={taskDetails.isMultiDay}
                  onChange={(e) =>
                    setTaskDetails((prev) => ({ ...prev, isMultiDay: e.target.checked }))
                  }
                  className="form-checkbox h-4 w-4 text-primary"
                />
                <span className="text-sm text-muted-foreground">Work on this over multiple days</span>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <Button onClick={confirmAddTask}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Recurring Task</DialogTitle>
            <DialogDescription>
              These are things you do every day at the same time (e.g., meals, commute, prayer).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Recurring Task Title</Label>
              <Input value={recurringTitle} onChange={(e) => setRecurringTitle(e.target.value)} placeholder="e.g., Breakfast" />
            </div>
            <div className="space-y-2">
              <Label>How long does this take? (in minutes)</Label>
              <Input type="number" min={1} value={recurringDuration} onChange={(e) => setRecurringDuration(e.target.value)} placeholder="e.g., 30" />
            </div>
            <div className="space-y-2">
              <Label>How many times per day?</Label>
              <Input
                type="number"
                min={1}
                value={timesPerDay}
                onChange={(e) => {
                  const newVal = parseInt(e.target.value) || 1
                  setTimesPerDay(newVal)
                  setTimeInputs(Array.from({ length: newVal }, (_, i) => timeInputs[i] || ""))
                }}
              />
            </div>
            <div className="space-y-4">
              {timeInputs.map((time, index) => (
                <div key={index} className="space-y-1">
                  <Label>Time #{index + 1}</Label>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      const updated = [...timeInputs]
                      updated[index] = e.target.value
                      setTimeInputs(updated)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            {recurringError && <p className="text-sm text-red-500">{recurringError}</p>}
            <Button
              onClick={() => {
                if (!recurringTitle || !recurringDuration || timeInputs.some((t) => !t)) {
                  setRecurringError("Please fill out all fields.")
                  return
                }
                const newDuration = parseInt(recurringDuration)
                if (isNaN(newDuration) || newDuration <= 0) {
                  setRecurringError("Duration must be at least 1 minute.")
                  return
                }

                const newTimeWindows = timeInputs.map((time) => {
                  const [h, m] = time.split(":").map(Number)
                  const start = new Date()
                  start.setHours(h, m, 0, 0)
                  const end = new Date(start.getTime() + newDuration * 60000)
                  return { start, end }
                })
                const hasSelfConflict = newTimeWindows.some((a, i) =>
                  newTimeWindows.some((b, j) => i !== j && a.start < b.end && a.end > b.start)
                )
                if (hasSelfConflict) {
                  setRecurringError("Recurring times within this task overlap.")
                  return
                }

                const existingTimeWindows = (userPrefs.recurringBlocks || []).flatMap((block) =>
                  block.times.map((time) => {
                    const [h, m] = time.split(":").map(Number)
                    const start = new Date()
                    start.setHours(h, m, 0, 0)
                    const end = new Date(start.getTime() + block.duration * 60000)
                    return { start, end }
                  })
                )
                const hasConflict = newTimeWindows.some((nw) =>
                  existingTimeWindows.some((ex) => nw.start < ex.end && nw.end > ex.start)
                )
                if (hasConflict) {
                  setRecurringError("This task overlaps with an existing recurring task.")
                  return
                }

                const [wakeH, wakeM] = (userPrefs.wakeUp || "09:00").split(":").map(Number)
                const [sleepH, sleepM] = (userPrefs.sleep || "23:00").split(":").map(Number)
                const wake = new Date(); wake.setHours(wakeH, wakeM, 0, 0)
                const sleep = new Date(); sleep.setHours(sleepH, sleepM, 0, 0)
                if (sleep <= wake) sleep.setDate(sleep.getDate() + 1)

                const isOutsideDay = newTimeWindows.some((b) => b.start < wake || b.end > sleep)
                if (isOutsideDay) {
                  setRecurringError("Recurring task must be within your wake and sleep time.")
                  return
                }

                const newTask = { title: recurringTitle, times: timeInputs, duration: newDuration }
                const updated = [...(userPrefs.recurringBlocks || []), newTask]
                const newPrefs = { ...userPrefs, recurringBlocks: updated }

                setItem("recurringBlocks", updated)
                setItem("userSchedulePrefs", newPrefs)
                setUserPrefs(newPrefs)
                setRecurringTitle("")
                setRecurringDuration("")
                setTimesPerDay(1)
                setTimeInputs([""])
                setRecurringError("")
                setShowRecurringDialog(false)
                setRefreshSchedule(true)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Schedule
