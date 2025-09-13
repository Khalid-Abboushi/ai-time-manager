import { useState, useEffect } from "react"
import { CheckCircle2, Circle, Plus, Zap, Target, TrendingUp, Quote, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { setItem, getItem } from "@/utils/localStorage"
import { askAI } from "@/utils/askAI"
import DailyNotes from "@/utils/DailyNotes";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ChevronDown, ChevronRight } from "lucide-react"
import { getHoursRequiredForLevel } from "@/utils/xpUtils"
import { getTimePerTask } from "@/utils/timePerTask"
import { SiteFooter } from "@/utils/SiteFooter";
import { UnderGlowSection } from "@/utils/underglow-section";



interface Task {
  id: string
  title: string
  completed: boolean
  category: 'work' | 'personal' | 'health' | 'learning'
  priority: 'low' | 'medium' | 'high'
  deadline: string
  estimatedTime: number
  type: 'mental' | 'physical' | 'work' | 'social'
  completedOn?: string
  parentId?: string       
  isParent?: boolean      
  partIndex?: number      
  totalParts?: number  
  showToday?: boolean   
  locked?: boolean
}

interface Challenge {
  id: string
  title: string
  progress: number
  target: number
  unit: string
  category: 'physical' | 'mental' | 'work' | 'social'
  type: 'mental' | 'physical' | 'work' | 'social' // 🔧 Add this
  estimatedTime: number // 🔧 Add this
}

interface DeleteConfirmProps {
  onConfirm: () => void
}


export const DeleteConfirmDialog = ({ onConfirm }: DeleteConfirmProps) => {
  const [open, setOpen] = useState(false)

  const handleDelete = () => {
    onConfirm()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>
          <Minus className="w-4 h-4 text-destructive hover:text-red-500" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Task?</DialogTitle>
        </DialogHeader>
        <p>This will delete the entire task. Are you sure?</p>
        <DialogFooter className="pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

const Home = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [newTask, setNewTask] = useState("")
  const [showDialog, setShowDialog] = useState(false)
    const [taskDetails, setTaskDetails] = useState({
    priority: "medium",
    deadline: "",
    estimatedTime: 1,
    type: "mental",
    isMultiDay: false
  })
  const [dailyQuote, setDailyQuote] = useState<{ text: string; author: string } | null>(null)

  const getDatesBetween = (start: Date, end: Date): string[] => {
  const dates = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toLocaleDateString("en-CA"))
    current.setDate(current.getDate() + 1)
  }
  return dates
  }
  
  const todayStr = new Date().toLocaleDateString("en-CA")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dailyStreak, setDailyStreak] = useState(() => getItem("dailyStreak") || 0)
  const [longestStreak, setLongestStreak] = useState(() => getItem("longestStreak") || 0)


  const countableTasks = tasks.filter(task => {
  const isSubtask = !!task.parentId
  const isSingleTask = !task.isParent && !task.parentId

  const deadlineDate = parseLocalDate(task.deadline)
  const todayDate = parseLocalDate(todayStr)

  // 🚫 Skip past-due tasks entirely
  if (deadlineDate.getTime() < todayDate.getTime()) return false

  // ✅ Multi-day subtasks → only count if due today
  if (isSubtask) return task.deadline === todayStr

  // ✅ Single-day tasks → count if incomplete OR completed today
  if (isSingleTask) {
    return !task.completed || task.completedOn === todayStr
  }

  // 🚫 Never count parent tasks
  return false
})

  const defaultChallenges: Record<string, string[]> = {
  physical: [
    "Go to the gym 3 times this week",
    "Run a total of 15km",
    "Stretch every morning for 10 minutes",
    "Take 3 long walks (30+ min)"
  ],
  mental: [
    "Read 30 pages of a book",
    "Do 3 focused meditation sessions",
    "Write 3 journal entries",
    "Solve 5 brain puzzles or logic games"
  ],
  work: [
    "Complete 3 focused work sessions",
    "Organize your workspace",
    "Clear your inbox",
    "Review and improve your resume"
  ],
  social: [
    "Call or text 3 friends",
    "Make one plan to hang out with someone",
    "Compliment 3 people sincerely",
    "Introduce yourself to someone new"
  ]
}

  const completedTasks = countableTasks.filter(task => task.completed).length
  const totalTasks = countableTasks.length
  const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0


  useEffect(() => {
    const storedTasks = getItem("tasks")
    if (storedTasks) setTasks(storedTasks)
  }, [])

  useEffect(() => {
    setItem("tasks", tasks)
  }, [tasks])

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString("en-CA")
    updateSubtasksForNewDay(todayStr)
  }, [])

useEffect(() => {
  const interval = setInterval(() => {
    const todayStr = new Date().toLocaleDateString("en-CA")
    const lastCheckedDate = localStorage.getItem("lastCheckedDate")

    if (lastCheckedDate !== todayStr) {
      console.log("🌅 New day triggered — resetting subtasks")
      localStorage.setItem("lastCheckedDate", todayStr)

      setTasks(prev => {
        const updated = [...prev]
        const parents = updated.filter(t => t.isParent)

        for (const parent of parents) {
          const subtasks = updated
            .filter(t => t.parentId === parent.id)
            .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0))

          // Step 1: Reset all subtasks
          for (const st of subtasks) {
            st.showToday = false
            st.locked = true
          }

          // Step 2: Find the first shown+incomplete subtask
          const active = subtasks.find(st => st.showToday && !st.completed)

          if (active) {
            // Keep current incomplete one
            active.showToday = true
            active.locked = false

            const next = subtasks.find(st => st.partIndex === active.partIndex! + 1)
            if (next) {
              next.showToday = true
              next.locked = true
            }
          } else {
            // Otherwise, look for last completed
            const lastCompleted = subtasks
              .filter(st => st.completed)
              .sort((a, b) => (b.partIndex ?? 0) - (a.partIndex ?? 0))[0]

            const next = subtasks.find(st =>
              st.partIndex === ((lastCompleted?.partIndex ?? -1) + 1)
            )

            if (next) {
              next.showToday = true
              next.locked = false
            }
          }

          console.log(`🔎 Parent: ${parent.title}`)
          subtasks.forEach(t => {
            console.log(`→ ${t.title} | showToday: ${t.showToday} | locked: ${t.locked} | completed: ${t.completed}`)
          })
        }

        return updated
      })
    }
  }, 1000)

  return () => clearInterval(interval)
}, [tasks])


  const updateSubtasksForNewDay = (todayStr: string) => {
  setTasks(prev => {
    const updated = prev.map(task => ({ ...task })) // clone everything
    const parents = updated.filter(t => t.isParent)

    parents.forEach(parent => {
      const subtasks = updated
        .filter(t => t.parentId === parent.id)
        .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0))

      const firstIncomplete = subtasks.findIndex(st => !st.completed)

      if (firstIncomplete === -1) return // all done

      const todayPart = subtasks[firstIncomplete]
      
      // 🧠 Only update if it's due today AND hasn't been shown before
      if (todayPart.deadline === todayStr && !todayPart.showToday) {
        todayPart.showToday = true
        todayPart.locked = false
      }

      // 🛑 DO NOT reset other subtasks' showToday = false
    })

    setItem("tasks", updated)
    return updated
  })
}

  const toggleTask = (taskId: string) => {
  const now = new Date()
  const today = now.toLocaleDateString("en-CA")

  setTasks(prevTasks => {
    const wasIncomplete = !prevTasks.find(t => t.id === taskId)?.completed

    let updatedTasks = prevTasks.map(task =>
      task.id === taskId
        ? {
            ...task,
            completed: !task.completed,
            completedOn: !task.completed ? today : undefined
          }
        : task
    )

    const toggled = updatedTasks.find(t => t.id === taskId)
    if (!toggled || toggled.isParent) return prevTasks

    // 🧠 If marking complete AND completed early, remove from schedule
    if (wasIncomplete) {
      const cached = getItem("autoScheduleCache") || []

      const blockIndex = cached.findIndex(
        (b: any) => b.taskId === taskId || b.taskId?.startsWith(`${taskId}-part`)
      )

      if (blockIndex !== -1) {
        const scheduledStart = new Date(cached[blockIndex].startDate)
        const shouldKeep = now.getTime() >= scheduledStart.getTime()

        if (!shouldKeep) {
          const newCache = cached.filter(
            (b: any) =>
              b.taskId !== taskId &&
              !b.taskId?.startsWith(`${taskId}-part`)
          )
          setItem("autoScheduleCache", newCache)
        }
      }
    }

    // ✅ Productivity Score
    let currentScore = getItem("productivityScore") || 0
    if (wasIncomplete) {
      currentScore++
    } else {
      currentScore = Math.max(0, currentScore - 1)
    }
    setItem("productivityScore", currentScore)
    setProductivityScore(currentScore)

    // 🔁 Parent Update
    if (toggled.parentId) {
      const siblings = updatedTasks.filter(t => t.parentId === toggled.parentId)
      const allComplete = siblings.every(t => t.completed)

      updatedTasks = updatedTasks.map(t =>
        t.id === toggled.parentId
          ? {
              ...t,
              completed: allComplete,
              completedOn: allComplete ? today : undefined
            }
          : t
      )

      // 🔓 Unlock next
      const next = siblings.find(st => st.partIndex === toggled.partIndex! + 1)
      if (next?.showToday && next.locked) {
        updatedTasks = updatedTasks.map(t =>
          t.id === next.id
            ? { ...t, locked: false }
            : t
        )
      }
    }

    return updatedTasks
  })
}

const [productivityScore, setProductivityScore] = useState(() => getItem("productivityScore") || 0)


// ✅ New productivity score formula (volume × balance)
// ✅ New productivity score: volume (hrs/8) × balance (areas ≥1h)
// Balance values: 0.25 / 0.5 / 0.75 / 1.0 depending on how many areas hit ≥1h
useEffect(() => {
  const todayStr = new Date().toLocaleDateString("en-CA")

  // Completed, non-parent tasks finished today
  const todayTasks = tasks.filter(
    t => t.completed && t.completedOn === todayStr && !t.isParent
  )

  // Total finished hours today
  const totalHours = todayTasks.reduce((s, t) => s + (t.estimatedTime || 0), 0)

  // If nothing finished, score is 0
  if (totalHours <= 0) {
    setProductivityScore(0)
    setItem("productivityScore", 0)
    return
  }

  // ---- Balance: count areas with ≥ 1 hour today ----
  const areas: Task["type"][] = ["work", "mental", "physical", "social"]
  const hoursByArea: Record<Task["type"], number> = {
    work: 0, mental: 0, physical: 0, social: 0
  }
  for (const t of todayTasks) {
    hoursByArea[t.type] += (t.estimatedTime || 0)
  }

  const THRESHOLD_HOURS = 1
  let areasReached = areas.reduce(
    (acc, a) => acc + (hoursByArea[a] >= THRESHOLD_HOURS ? 1 : 0),
    0
  )

  // Floor: if some work was done but no area hit 1h, treat as one area (0.25)
  if (areasReached === 0 && totalHours > 0) areasReached = 1

  const balanceRatio = areasReached / areas.length // 0.25..1

  // ---- Volume multiplier (cap at 8h) ----
  const multiplier = Math.min(totalHours / 8, 1)

  // ---- Final score ----
  const prodAdjustmentFactor = multiplier * balanceRatio
  const finalScore = Math.round(100 * prodAdjustmentFactor)

  setProductivityScore(finalScore)
  setItem("productivityScore", finalScore)
}, [tasks])

const [latestChallenge, setLatestChallenge] = useState<Challenge | null>(null)
const [daysLeft, setDaysLeft] = useState<number | null>(null)
const [skillXP, setSkillXP] = useState<Record<string, number>>({
  physical: 0,
  mental: 0,
  work: 0,
  social: 0
})

// Load skill XP from localStorage on mount
useEffect(() => {
  const storedXP = getItem("skillXP")
  if (storedXP) setSkillXP(storedXP)
}, [])

const challengeCategoryFromType = (type: "mental" | "physical" | "work" | "social"): "learning" | "health" | "work" | "personal" => {
  const map = {
    work: "work",
    physical: "health",
    mental: "learning",
    social: "personal"
  }as const

  return map[type]
}

const handleCompleteChallenge = () => {
  if (!latestChallenge || latestChallenge.progress >= latestChallenge.target) return;

  const todayStr = new Date().toLocaleDateString("en-CA")

  // 🔥 Skill XP logic
  const category = challengeCategoryFromType(latestChallenge.type)
  const skillXPData = getItem("skillXP") || {}
  const currentXP = skillXPData[category] || 0

  let level = 0
  let remaining = currentXP

  while (true) {
    const hoursNeeded = getHoursRequiredForLevel(level + 1)
    if (remaining >= hoursNeeded) {
      remaining -= hoursNeeded
      level++
    } else {
      break
    }
  }

  const xpToNextLevel = getHoursRequiredForLevel(level + 1)
  const xpToGive = xpToNextLevel + 1 // 💥 level up + 1 hour

  const newXP = currentXP + xpToGive
  const updatedXP = { ...skillXPData, [category]: newXP }
  setItem("skillXP", updatedXP)
  setSkillXP(updatedXP)

  // ✅ Create task record for history
  const newTask: Task = {
    id: `challenge-${Date.now()}`,
    title: latestChallenge.title,
    completed: true,
    completedOn: todayStr,
    type: latestChallenge.type,
    category,
    estimatedTime: xpToGive,
    priority: "medium",
    deadline: todayStr
  }

  setTasks(prev => [...prev, newTask])
  setLatestChallenge(null)
  setChallenges([])
  setItem("challenges", [])
  localStorage.removeItem("challengeGeneratedAt")
}

const generateChallenge = (lowestType: string): Challenge => {
  const random = defaultChallenges[lowestType][
    Math.floor(Math.random() * defaultChallenges[lowestType].length)
  ]

  return {
    id: Date.now().toString(),
    title: random,
    progress: 0,
    target: 1,
    unit: "goal",
    category: lowestType as Challenge["category"],
    type: lowestType as Challenge["type"], // 🔧 Set type
    estimatedTime: 1 // 🔧 Default duration
  }
}

const analyzeSkillBalance = () => {
  const skillScores: Record<string, number> = {
    physical: 0,
    mental: 0,
    work: 0,
    social: 0
  }

  tasks.forEach(task => {
    if (task.completed) {
      skillScores[task.type] += task.estimatedTime || 0
    }
  })

  const sorted = Object.entries(skillScores).sort((a, b) => a[1] - b[1])
  return sorted[0][0] // type with lowest hours
}

useEffect(() => {
  const storedChallenge = getItem("challenges") || []
  const storedDate = getItem("challengeGeneratedAt")
  const storedSkillXP = getItem("skillXP")
  if (storedSkillXP) setSkillXP(storedSkillXP)

  const now = new Date()

  if (storedChallenge.length > 0 && storedDate) {
    const generatedDate = new Date(storedDate)
    const diffInMs = now.getTime() - generatedDate.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    const daysRemaining = 7 - diffInDays

    if (diffInDays < 7) {
      setChallenges(storedChallenge)
      setLatestChallenge(storedChallenge[0])
      setDaysLeft(daysRemaining > 0 ? daysRemaining : 0)
      return
    }
  }

  if (tasks.length > 0) {
    const weakest = analyzeSkillBalance()
    const newChallenge = generateChallenge(weakest)
    setChallenges([newChallenge])
    setLatestChallenge(newChallenge)
    setItem("challenges", [newChallenge])
    setItem("challengeGeneratedAt", now.toISOString())
    setDaysLeft(7)
  }
}, [tasks])


  const today = new Date().toLocaleDateString("en-CA")
  const todayCompletedTasks = tasks.filter(task => task.completedOn === today)

  const totalHours = todayCompletedTasks.reduce((sum, task) => sum + task.estimatedTime, 0)
  const quantityScore = Math.min((totalHours / 6) * 50, 50)

  const uniqueTypes = new Set(todayCompletedTasks.map(task => task.type))
  let diversityScore = 0
  switch (uniqueTypes.size) {
    case 2:
      diversityScore = 20
      break
    case 3:
      diversityScore = 40
      break
    case 4:
      diversityScore = 50
      break
    default:
      diversityScore = 0
  }

  const deleteTask = (taskId: string) => {
    setTasks(prev =>
      prev.filter(task =>
        task.id !== taskId && task.parentId !== taskId
      )
    )
  }

  const [formError, setFormError] = useState("")

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
  const deadlineDate = new Date(taskDetails.deadline)
  

  // If multi-day: generate parent task + subtasks
  if (taskDetails.isMultiDay) {
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
      isParent: true
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
      partIndex: index + 1,
      totalParts: splitDates.length
    }))

    setTasks(prev => [...prev, parentTask, ...subtasks])
  } else {
    // If single-day task
    const task: Task = {
      id: Date.now().toString(),
      title: newTask,
      completed: false,
      category: 'personal',
      priority: taskDetails.priority as Task["priority"],
      deadline: taskDetails.deadline,
      estimatedTime: taskDetails.estimatedTime,
      type: taskDetails.type as Task["type"]
    }
    setTasks(prev => [...prev, task])
  }

  const task: Task = {
    id: Date.now().toString(),
    title: newTask,
    completed: false,
    category: 'personal',
    priority: taskDetails.priority as 'low' | 'medium' | 'high',
    deadline: taskDetails.deadline,
    estimatedTime: taskDetails.estimatedTime,
    type: taskDetails.type as 'mental' | 'physical' | 'work' | 'social'
  }
  setTasks(prev => [...prev, task])
  setNewTask("")
  setTaskDetails({ priority: "medium", deadline: "", estimatedTime: 1, type: "mental", isMultiDay: false})
  setFormError("")
  setShowDialog(false)
}

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'work': return 'bg-blue-500'
      case 'health': return 'bg-green-500'
      case 'learning': return 'bg-purple-500'
      case 'personal': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const getChallengeVariant = (category: string) => {
    switch (category) {
      case 'physical': return 'success'
      case 'mental': return 'default'
      case 'work': return 'warning'
      case 'social': return 'default'
      default: return 'default'
    }
  }

  // Minimal JSONP fetcher for Forismatic (works in the browser without CORS)
type Quote = { text: string; author: string };

function getForismaticQuoteJSONP(timeoutMs = 8000): Promise<Quote> {
  return new Promise((resolve, reject) => {
    const cbName = `jsonp_cb_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = `https://api.forismatic.com/api/1.0/?method=getQuote&format=jsonp&lang=en&jsonp=${cbName}`;

    const cleanup = () => {
      delete window[cbName];
      script.remove();
      clearTimeout(timer);
    };

    window[cbName] = (data: any) => {
      try {
        const text = (data?.quoteText || "").trim();
        const author = (data?.quoteAuthor || "Unknown").trim() || "Unknown";
        if (!text) return reject(new Error("Bad Forismatic payload"));
        resolve({ text, author });
      } finally {
        cleanup();
      }
    };

    script.src = url;
    script.onerror = () => { cleanup(); reject(new Error("Forismatic JSONP load error")); };
    document.body.appendChild(script);

    const timer = setTimeout(() => { cleanup(); reject(new Error("Forismatic JSONP timeout")); }, timeoutMs);
  });
}

useEffect(() => {
  const todayKey = new Date().toLocaleDateString("en-CA");
  const cachedQuote = getItem("dailyQuote");
  const cachedDate  = getItem("dailyQuoteDate");

  // Reuse today's quote if already cached
  if (cachedQuote && cachedDate === todayKey) {
    setDailyQuote(cachedQuote);
    return;
  }

  const setAndCache = (q: { text: string; author: string }) => {
    setDailyQuote(q);
    setItem("dailyQuote", q);
    setItem("dailyQuoteDate", todayKey);
  };

  (async () => {
    try {
      const q = await getForismaticQuoteJSONP(8000);
      setAndCache(q);
    } catch {
      // Last‑resort local fallback
      setAndCache({
        text: "Keep going. You're closer than you think.",
        author: "Unknown",
      });
    }
  })();
}, []);




  const handleAskAI = async () => {
    const editor = document.getElementById("notes-editor")
    if (!editor) return

    const input = editor.innerText
    const reply = await askAI(input)

    editor.innerHTML += `<p class="text-muted-foreground"><strong>AI:</strong> ${reply}</p>`
  }

  const groupedTasks = tasks.reduce((acc, task) => {
    const key = task.parentId || task.id
    if (!acc[key]) acc[key] = []
    acc[key].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({})
  const todays = new Date()
  todays.setHours(0, 0, 0, 0)

  const visibleTasks = tasks.filter(task => {
    const isMultiSubtask = !!task.parentId // only subtasks have a parentId

    if (isMultiSubtask) {
      // show if explicitly marked to showToday
      return task.showToday
    }

    // this is a normal task (not part of a multi-day)
    const deadlineDate = parseLocalDate(task.deadline)
    return !task.completed && deadlineDate.getTime() >= todays.getTime()
  })

  useEffect(() => {
  const todayStr = new Date().toLocaleDateString("en-CA")
  const completedToday = tasks.some(
    task => task.completed && task.completedOn === todayStr && !task.isParent
  )

  const lastStreakUpdate = getItem("lastStreakUpdate")
  if (lastStreakUpdate === todayStr) return // already updated today

  if (completedToday) {
    const current = (getItem("dailyStreak") || 0) + 1
    const longest = Math.max(current, getItem("longestStreak") || 0)

    setDailyStreak(current)
    setLongestStreak(longest)
    setItem("dailyStreak", current)
    setItem("longestStreak", longest)
    setItem("lastStreakUpdate", todayStr)
  } else {
    // If no task completed and the day has changed, reset streak
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Hello There!
          </h1>
          <p className="text-xl text-muted-foreground">
            Let's make today more productive than yesterday
          </p>
        </div>

<UnderGlowSection className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Daily Progress — emerald/teal, compact accent */}
<Card className="relative overflow-hidden border bg-card shadow-sm
                 border-emerald-200/60 dark:border-emerald-500/30">
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.10),transparent_55%)]
      dark:bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.18),transparent_55%)]" />

  <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

  <CardHeader className="pb-1 relative z-10">
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
          <Target className="w-4 h-4" />
        </span>
        <span>Daily Progress</span>
      </span>
      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        {completionPercentage.toFixed(0)}%
      </span>
    </CardTitle>
  </CardHeader>

  <CardContent className="pt-1 relative z-10">
    <div className="text-3xl font-bold text-foreground mb-1">
      {completedTasks}/{totalTasks}
    </div>
    <Progress value={completionPercentage} variant="success" className="h-2 mb-2" />
  </CardContent>
</Card>

{/* Productivity Score — amber/gold with subtle glow at high scores */}

<Card className="relative overflow-hidden border bg-card shadow-sm
                 border-amber-200/60 dark:border-amber-500/30">
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.10),transparent_55%)]
      dark:bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.18),transparent_55%)]" />

  <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400" />

  <CardHeader className="pb-1 relative z-10">
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
          <Zap className="w-4 h-4" />
        </span>
        <span>Productivity Score</span>
      </span>
      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        /100
      </span>
    </CardTitle>
  </CardHeader>

  <CardContent className="pt-1 relative z-10">
    <div
      className={cn(
        "text-3xl font-bold mb-1",
        productivityScore >= 90
          ? "text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]"
          : "text-foreground"
      )}
    >
      {productivityScore}
    </div>
    <Progress value={productivityScore} variant="warning" className="h-2 mb-2" />
  </CardContent>
</Card>

{/* Daily Streak — indigo/violet with “Best” chip */}
<Card className="relative overflow-hidden border bg-card shadow-sm
                 border-purple-200/60 dark:border-purple-500/30">
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.10),transparent_55%)]
      dark:bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.18),transparent_55%)]" />
  <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-500" />

  <CardHeader className="pb-1 relative z-10">
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <TrendingUp className="w-4 h-4" />
        </span>
        <span>Daily Streak</span>
      </span>
      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
        Best: {longestStreak}
      </span>
    </CardTitle>
  </CardHeader>

  <CardContent className="pt-1 relative z-10">
    <div className="text-3xl font-bold text-foreground mb-1">
      {dailyStreak} {dailyStreak === 1 ? "Day" : "Days"}
    </div>
    <Progress
      value={(dailyStreak / (longestStreak || 1)) * 100}
      variant="success"
      className="h-2 mb-2"
    />
  </CardContent>
</Card>



        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
<Card className="relative overflow-hidden border bg-card shadow-sm border-amber-200/60 dark:border-amber-500/30">
  {/* ambient tint that matches the card’s accent in both themes */}
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(60%_80%_at_0%_0%,rgba(251,191,36,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(236,72,153,0.08),transparent_55%)]
      dark:bg-[radial-gradient(60%_80%_at_0%_0%,rgba(251,191,36,0.16),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(236,72,153,0.14),transparent_55%)]" />

  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500" />

  <CardHeader className="relative z-10">
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]" />
        <span>Today's Tasks</span>
      </span>

      <Badge
        variant="outline"
        className="border-border/60 bg-secondary text-secondary-foreground"
      >
        {completedTasks}/{totalTasks}
      </Badge>
    </CardTitle>
    <CardDescription className="text-muted-foreground">
      Complete your daily tasks to maintain momentum
    </CardDescription>
  </CardHeader>

  <CardContent className="relative z-10">
    <div className="space-y-3 mb-4">
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">
          No tasks yet. Add one in your schedule to get started! ✨
        </p>
      ) : (
        Object.entries(
          visibleTasks.reduce((acc, task) => {
            const key = task.parentId || task.id
            if (!acc[key]) acc[key] = []
            acc[key].push(task)
            return acc
          }, {} as Record<string, Task[]>)
        ).map(([groupId, taskGroup]) => {
          const isCumulative = taskGroup.some(task => task.parentId)
          const parent = tasks.find(t => t.id === groupId)
          const subtasks = taskGroup.filter(t => t.parentId)

          if (isCumulative && parent) {
            const completed = subtasks.filter(t => t.completed).length
            const total = subtasks.length
            const workOnToday = subtasks.filter(t => t.showToday && !t.locked)
            const workOnLater = subtasks.filter(t => !t.showToday)

            return (
              <div
                key={groupId}
                className="mb-3 rounded-lg border border-border/60 bg-card/70 shadow-sm"
              >
                {/* parent header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-card/60">
                  <div className="font-semibold text-foreground truncate">
                    {parent.title}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-xs bg-secondary text-secondary-foreground border border-border/50">
                      {completed}/{total} done
                    </span>
                    <DeleteConfirmDialog onConfirm={() => deleteTask(parent.id)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() =>
                        setCollapsedParents(prev => ({
                          ...prev,
                          [parent.id]: !prev[parent.id],
                        }))
                      }
                    >
                      {collapsedParents[parent.id] ? '+' : '–'}
                    </Button>
                  </div>
                </div>

                {/* subtasks */}
                {!collapsedParents[parent.id] && (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto px-3 py-2 custom-scroll">
                    {workOnToday.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="rounded-full px-2 py-0.5 text-[11px] border bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200 dark:border-amber-400/25">
                            Today
                          </span>
                        </div>

                        {workOnToday.map(task => (
                          <div
                            key={task.id}
                            className={cn(
                              "flex items-center space-x-3 p-2 rounded-md transition",
                              "border border-transparent ring-1 ring-transparent",
                              "hover:bg-accent hover:text-accent-foreground hover:border-border/60 hover:ring-border/40",
                              task.completed && "opacity-75",
                              task.locked && "opacity-50 pointer-events-none"
                            )}
                          >
                            <button
                              onClick={() => toggleTask(task.id)}
                              className={cn("transition-bounce", task.completed && "task-complete")}
                              disabled={task.locked}
                              title={task.locked ? "Locked until previous part is done" : "Toggle complete"}
                            >
                              {task.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground hover:text-amber-600" />
                              )}
                            </button>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{task.title}</div>
                              <div className="text-xs text-muted-foreground">
                                ⏱ {getTimePerTask(task.estimatedTime, task.deadline, true).toFixed(1)} hrs
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {workOnLater.length > 0 && (
                      <div className="pt-2">
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <span className="rounded-full px-2 py-0.5 text-[11px] bg-muted text-muted-foreground border border-border/40">
                            Later
                          </span>
                          <span>Work on later:</span>
                        </div>

                        {workOnLater.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center space-x-3 p-2 rounded-md opacity-90
                                       border border-transparent ring-1 ring-transparent
                                       hover:bg-accent hover:text-accent-foreground hover:border-border/60 hover:ring-border/40"
                          >
                            <CheckCircle2 className="w-5 h-5 text-amber-500" />
                            <div className="flex-1">
                              <div className="text-sm">{task.title}</div>
                              <div className="text-xs text-muted-foreground">
                                ⏱ {getTimePerTask(task.estimatedTime, task.deadline, true).toFixed(1)} hrs
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }

          // Single task
          const task = taskGroup[0]
          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center space-x-3 p-3 rounded-lg transition",
                "border border-transparent ring-1 ring-transparent",
                "hover:bg-accent hover:text-accent-foreground hover:border-border/60 hover:ring-border/40",
                task.completed && "opacity-75"
              )}
            >
              <button
                onClick={() => toggleTask(task.id)}
                className={cn("transition-bounce", task.completed && "task-complete")}
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground hover:text-amber-600" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div className={cn("w-2 h-2 rounded-full", getCategoryColor(task.category))} />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      task.completed && "line-through text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ⏱ {getTimePerTask(task.estimatedTime, task.deadline, false).toFixed(1)} hrs
                </div>
              </div>
              <DeleteConfirmDialog onConfirm={() => deleteTask(task.id)} />
            </div>
          )
        })
      )}
    </div>
  </CardContent>
</Card>



          <Card className="relative overflow-hidden border bg-card shadow-sm border-emerald-200/60 dark:border-emerald-500/30">
  {/* soft background bloom (works in both themes) */}
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.10),transparent_55%)]
      dark:bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.16),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.16),transparent_55%)]" />

  <CardHeader className="relative z-10 pb-3">
    <CardTitle className="flex items-center gap-2 text-foreground">
      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      <span>Completed Tasks</span>

      {/* count chip */}
      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full
                       bg-secondary text-secondary-foreground border border-border/60">
        {(() => {
          const completed = (tasks || []).filter(t => t.completed && t.completedOn && !t.isParent)
          return <>{completed.length} done</>
        })()}
      </span>
    </CardTitle>
    <CardDescription className="text-muted-foreground">
      Here are your completed tasks
    </CardDescription>
  </CardHeader>

  <CardContent className="relative z-10 max-h-60 overflow-y-auto pr-2 space-y-2 custom-scroll">
    {(() => {
      const todayStr = new Date().toLocaleDateString("en-CA")
      const todayLocal = parseLocalDate(todayStr)
      const toLocalDate = (s: string) => parseLocalDate((s || "").slice(0, 10))

      const completed = (tasks || [])
        .filter(t => t.completed && t.completedOn && !t.isParent)
        .sort((a, b) => {
          const da = toLocalDate(a.completedOn!)
          const db = toLocalDate(b.completedOn!)
          return db.getTime() - da.getTime()
        })

      if (completed.length === 0) {
        return <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
      }

      return completed.map(task => {
        const finishedLocal = toLocalDate(task.completedOn!)
        const isToday = finishedLocal.toDateString() === todayLocal.toDateString()
        return (
          <div
            key={task.id}
            className="group flex items-start gap-3 rounded-md px-3 py-2 transition
                       border border-border/60 bg-card/70
                       hover:bg-accent hover:text-accent-foreground hover:border-border/70"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground group-hover:text-accent-foreground">
                {task.title}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {isToday ? "Today" : finishedLocal.toLocaleDateString()}
              </div>
            </div>
            <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-400/80" />
          </div>
        )
      })
    })()}
  </CardContent>
</Card>




          <div className="space-y-6">
            <Card className="relative overflow-hidden border bg-card shadow-sm border-amber-200/60 dark:border-amber-500/30">
  {/* soft ambient tint that works in both themes */}
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(60%_80%_at_0%_0%,rgba(251,191,36,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(236,72,153,0.08),transparent_55%)]
      dark:bg-[radial-gradient(60%_80%_at_0%_0%,rgba(251,191,36,0.16),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(236,72,153,0.14),transparent_55%)]" />

  <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500" />

  <CardHeader className="relative z-10">
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]" />
        <span>Weekly Challenges</span>
      </span>

      {daysLeft !== null && (
        <span className="rounded-full px-2 py-0.5 text-xs bg-secondary text-secondary-foreground border border-border/60">
          {daysLeft} day{daysLeft === 1 ? '' : 's'} left
        </span>
      )}
    </CardTitle>
    <CardDescription>Track your progress across different life areas</CardDescription>
  </CardHeader>

  <CardContent className="relative z-10">
    {challenges.length === 0 ? (
      <p className="text-muted-foreground">
        {latestChallenge?.title || "No challenge generated yet."}
      </p>
    ) : (
      <div className="space-y-4">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="rounded-lg p-3 shadow-sm border border-border/60 bg-card/70
                       hover:bg-accent hover:text-accent-foreground hover:border-border/70 transition"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{challenge.title}</span>

              <span className="rounded-full px-2 py-0.5 text-xs bg-secondary text-secondary-foreground border border-border/60">
                {challenge.progress}/{challenge.target} {challenge.unit}
              </span>

              <Button
                onClick={handleCompleteChallenge}
                disabled={latestChallenge?.progress >= latestChallenge?.target}
                className="ml-2 h-8 px-3 bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500 text-white shadow hover:opacity-90 disabled:opacity-50"
              >
                Finished
              </Button>
            </div>

            <div className="mt-2">
              <Progress
                value={(challenge.progress / challenge.target) * 100}
                variant={getChallengeVariant(challenge.category) as 'default' | 'success' | 'warning'}
                className="h-2 bg-muted"
              />
            </div>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>



            {dailyQuote && (
              <Card className="relative overflow-hidden border bg-card shadow-sm
                 border-violet-200/60 dark:border-violet-500/30">
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.10),transparent_55%)]
      dark:bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.18),transparent_55%)]" />

  <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-500" />

  <CardHeader className="relative z-10">
    <CardTitle className="flex items-center gap-2">
      <div className="grid place-items-center h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
        <Quote className="w-4 h-4" />
      </div>
      <span className="font-semibold">Daily Inspiration</span>
    </CardTitle>
  </CardHeader>

  <CardContent className="relative z-10">
    <blockquote className="text-base sm:text-lg italic leading-relaxed mb-2 text-foreground">
      “{dailyQuote.text}”
    </blockquote>
    <p className="text-sm text-muted-foreground">— {dailyQuote.author}</p>
  </CardContent>
</Card>
            )}
          </div>
            <div className="lg:col-span-1">
              <Card className="relative overflow-hidden border bg-card shadow-sm
                 border-violet-200/60 dark:border-violet-500/30">
  <div className="pointer-events-none absolute inset-0
      bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.10),transparent_55%)]
      dark:bg-[radial-gradient(70%_80%_at_0%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(65%_70%_at_100%_100%,rgba(20,184,166,0.18),transparent_55%)]" />

  <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400" />

  <CardHeader className="relative z-10">
    <CardTitle className="flex items-center gap-2">
      <span className="grid place-items-center h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-xs shadow dark:bg-black/5">
        📝
      </span>
      <span>Daily Notes</span>
    </CardTitle>
    <CardDescription>Write down thoughts, plans, or anything you want to remember today.</CardDescription>
  </CardHeader>

  <CardContent className="relative z-10">
    {/* lined paper effect container (subtle) */}
    <div className="rounded-lg border border-violet-200/50 bg-white/80 p-3 sm:p-4
                    bg-[linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)]
                    bg-[length:100%_28px] dark:bg-white/5">
      <DailyNotes />
    </div>
  </CardContent>
</Card>
            </div>
          </div>
          </UnderGlowSection>
      </div>
      <SiteFooter />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                onChange={(e) => setTaskDetails({ ...taskDetails, estimatedTime: Number(e.target.value) })}
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
          </div>
          <DialogFooter className="pt-4">
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <Button onClick={confirmAddTask}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Home