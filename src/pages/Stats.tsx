import { useEffect, useState } from "react"
import {
  TrendingUp,
  Target,
  Award,
  Users,
  Share2,
  Trophy,
  Zap,
  Brain,
  Dumbbell,
  Heart,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts"
import { getItem } from "@/utils/localStorage"
import { SiteFooter } from "@/utils/SiteFooter";
import { UnderGlowSection } from "@/utils/underglow-section";


interface Task {
  id: string
  completed: boolean
  completedOn?: string      
  parentId?: string         
  category: "work" | "personal" | "health" | "learning"
  estimatedTime?: number
  type: "mental" | "physical" | "work" | "social"
  deadline?: string          
  isParent?: boolean 
}


interface SkillArea {
  name: string
  level: number
  progress: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  achievements: string[]
  category: "work" | "personal" | "health" | "learning"
  xpText: string
  title: string 
  
}

type Tier = "bronze" | "silver" | "gold" | "mythic"

interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  date?: string
  // extras for styling / progress
  tier: Tier
  emoji?: string
  goal?: number
  progress?: number // 0-100 vs goal
  series?: string   // e.g., "tasks", "hours-total"
}



interface Milestone {
  id: string
  title: string
  description: string
  date: string
  type: "work" | "personal" | "health" | "learning"
}

const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day) // month is 0-based
}

// Map milestone type → dot colors
const MILESTONE_DOT: Record<Milestone["type"], string> = {
  work: "bg-sky-500 ring-sky-200/70",
  health: "bg-emerald-500 ring-emerald-200/70",
  learning: "bg-violet-500 ring-violet-200/70",
  personal: "bg-rose-500 ring-rose-200/70",
};

// Safer local date formatter for "YYYY-MM-DD" or ISO strings
const asLocalDate = (value?: string | Date) => {
  if (!value) return "";
  if (typeof value === "string") {
    const iso = value.includes("T") ? value.split("T")[0] : value;
    const [y, m, d] = iso.split("-").map(Number);
    const dt = y && m && d ? new Date(y, m - 1, d) : new Date(value);
    return dt.toLocaleDateString();
  }
  return value.toLocaleDateString();
};


const tierForIndex = (i: number): Tier =>
  i < 5 ? "bronze" : i < 10 ? "silver" : i < 15 ? "gold" : "mythic"

// Curated ladders with friendly milestones (easy early steps)
const ladders = {
  tasks:        [1,3,5,10,15,20,30,40,50,75,100,125,150,200,250,300,400,500,750,1000],
  hoursTotal:   [1,2,5,10,20,30,40,50,75,100,125,150,200,250,300,400,500,750,1000],
  perSkill:     [1,2,3,5,8,10,15,20,25,30,40,50,75,100,125,150,200],
  streakDays:   [2,3,5,7,10,14,21,30,45,60,90,120],
  dayBurst:     [1,3,5,8,10,12,15,20,25,30],
  weekFlow:     [5,10,15,20,25,30,40,50],
}

// If user surpasses our last rung, extend with “nice” steps so we never run out
function ensureLadderCapacity(ladder: number[], metric: number) {
  while (ladder[ladder.length - 1] <= metric) {
    const last = ladder[ladder.length - 1]
    let next =
      last < 50  ? last + 5  :
      last < 100 ? last + 25 :
      last < 500 ? last + 50 :
      Math.round((last * 1.5) / 50) * 50  // 50‑rounded growth
    ladder.push(next)
  }
  return ladder
}

function makeLadderSeries(params: {
  idBase: string
  verb: string        // e.g., "Complete"
  unit: string        // e.g., "tasks", "h total"
  emoji: string
  metric: number
  ladder: number[]
  window?: number     // show last unlocked + next N
}) {
  const { idBase, verb, unit, emoji, metric, window = 6 } = params
  const ladder = ensureLadderCapacity([...params.ladder], metric)

  let idx = ladder.findIndex(x => metric < x)
  if (idx === -1) idx = ladder.length - 1
  const start = Math.max(0, idx - 1)
  const end   = Math.min(ladder.length, start + window + 1)

  return ladder.slice(start, end).map((goal, i) => {
    const unlocked = metric >= goal
    const globalIndex = start + i
    return {
      id: `${idBase}-${goal}`,
      title: `${verb} ${goal.toLocaleString()} ${unit}`,
      description: unlocked ? "Unlocked!" : `Reach ${goal.toLocaleString()} ${unit}`,
      unlocked,
      tier: tierForIndex(globalIndex),
      emoji,
      goal,
      progress: Math.max(0, Math.min(100, (metric / goal) * 100)),
      series: idBase,
      date: undefined as string | undefined,
    }
  })
}

function makePercentSeries(params: {
  idBase: string
  title: string
  emoji: string
  percent: number // 0..100
  thresholds?: number[]
}) {
  const { idBase, title, emoji, percent, thresholds = [50, 60, 70, 80, 90, 95, 100] } = params
  return thresholds.map((t, i) => ({
    id: `${idBase}-${t}`,
    title: `${title} ${t}%`,
    description: percent >= t ? "Unlocked!" : `Reach ${t}%`,
    unlocked: percent >= t,
    tier: tierForIndex(i),
    emoji,
    goal: t,
    progress: Math.max(0, Math.min(100, (percent / t) * 100)),
    series: idBase,
    date: undefined as string | undefined,
  }))
}

// put near top of file
export const rarityStyles = {
  bronze: "from-amber-50 to-amber-100 border-amber-300",
  silver: "from-slate-50 to-slate-200 border-slate-300",
  gold:   "from-yellow-50 to-yellow-100 border-yellow-300",
  mythic: "from-fuchsia-50 to-indigo-100 border-fuchsia-300"
}
export const unlockedAura =
  "before:content-[''] before:absolute before:inset-0 before:rounded-xl before:animate-pulse before:bg-[radial-gradient(circle_at_center,rgba(255,255,255,.35),transparent_60%)]"


function hoursByType(tasks: Task[], type: Task["type"]) {
  return tasks
    .filter(t => t.type === type && t.completed)
    .reduce((s, t) => s + (t.estimatedTime || 0), 0)
}

function countByType(tasks: Task[], type: Task["type"]) {
  return tasks.filter(t => t.type === type && t.completed).length
}

function getSkillLevel(skills: SkillArea[], cat: SkillArea["category"]) {
  return skills.find(s => s.category === cat)?.level ?? 0
}

type BuildAchArgs = {
  completedTasks: Task[]
  skills: SkillArea[]
  dailyStreak: number
  longestStreak: number
  unscheduledToday: number
}


function buildAchievements({
  completedTasks,
  skills,
  dailyStreak,
  longestStreak,
  unscheduledToday,
}: BuildAchArgs): Achievement[] {
  const total = completedTasks.length
  const todayStr = new Date().toLocaleDateString("en-CA")

  const workLv  = getSkillLevel(skills, "work")
  const healthLv = getSkillLevel(skills, "health")
  const learnLv  = getSkillLevel(skills, "learning")
  const socialLv = getSkillLevel(skills, "personal")

  const workHours   = hoursByType(completedTasks, "work")
  const healthHours = hoursByType(completedTasks, "physical")
  const learnHours  = hoursByType(completedTasks, "mental")
  const socialCount = countByType(completedTasks, "social")

  const create = (
    id: string,
    title: string,
    description: string,
    tier: Achievement["tier"],
    emoji: string,
    unlocked: boolean
  ): Achievement => ({
    id, title, description, tier, emoji, unlocked,
    date: unlocked ? new Date().toISOString() : undefined,
  })

  const ach: Achievement[] = [
    // Starter / Volume
    create("start_1", "First Step", "Complete your first task.", "bronze", "🟤", total >= 1),
    create("start_5", "On Your Way", "Complete 5 tasks.", "bronze", "📈", total >= 5),
    create("start_15","Task Streaker", "Complete 15 tasks.", "silver", "🏃", total >= 15),
    create("start_30","On a Roll", "Complete 30 tasks.", "silver", "🎯", total >= 30),
    create("start_60","Relentless", "Complete 60 tasks.", "gold", "🔥", total >= 60),
    create("start_120","Unstoppable", "Complete 120 tasks.", "mythic", "🧨", total >= 120),

    // Streaks
    create("streak_3", "Spark", "3‑day daily streak.", "bronze", "✨", dailyStreak >= 3 || longestStreak >= 3),
    create("streak_7", "Weeklong Blaze", "7‑day streak.", "silver", "🔥", dailyStreak >= 7 || longestStreak >= 7),
    create("streak_14", "Fortnight Forge", "14‑day streak.", "gold", "🛡️", dailyStreak >= 14 || longestStreak >= 14),
    create("streak_30", "Legend of Focus", "30‑day streak.", "mythic", "👑", dailyStreak >= 30 || longestStreak >= 30),

    // Time mastery
    create("zerounscheduled", "Tetris Master", "A day with 0 unscheduled tasks.", "silver", "🧩", unscheduledToday === 0),
    create("powerday_4h", "Deep Work Sprint", "4h+ work done in one day.", "gold", "🧠", workHours >= 4),
    create("health_3h", "Iron Will", "3h+ health in one day.", "silver", "🏋️", healthHours >= 3),
    create("learn_2h", "Curiosity Engine", "2h+ mental growth in one day.", "bronze", "📚", learnHours >= 2),
    create("social_3", "Social Butterfly", "Complete 3 social tasks in a week.", "silver", "🦋", socialCount >= 3),

    // Skill levels (cool names)
    create("work_5", "Division Commander", "Reach Work Level 5.", "silver", "💼", workLv >= 5),
    create("work_10", "Ops Overlord", "Reach Work Level 10.", "gold", "🏢", workLv >= 10),
    create("work_20", "Enterprise Architect", "Reach Work Level 20.", "mythic", "🏛️", workLv >= 20),

    create("health_5", "Endorphin Dealer", "Reach Physical Level 5.", "silver", "💪", healthLv >= 5),
    create("health_10", "Athletic Monster", "Reach Physical Level 10.", "gold", "⚡", healthLv >= 10),
    create("health_20", "Titan Mode", "Reach Physical Level 20.", "mythic", "🗿", healthLv >= 20),

    create("learn_5", "Mind Shaper", "Reach Mental Level 5.", "silver", "🧩", learnLv >= 5),
    create("learn_10", "Arch‑Sage", "Reach Mental Level 10.", "gold", "📜", learnLv >= 10),
    create("learn_20", "Reality Decoder", "Reach Mental Level 20.", "mythic", "🧬", learnLv >= 20),

    create("social_5", "Connector", "Reach Social Level 5.", "silver", "🤝", socialLv >= 5),
    create("social_10", "Network Oracle", "Reach Social Level 10.", "gold", "🌐", socialLv >= 10),
    create("social_20", "Hearts & Minds", "Reach Social Level 20.", "mythic", "💖", socialLv >= 20),
  ]

  return ach
}


// Map each category to colors + glow
const CAT_THEME: Record<SkillArea["category"], {
  from: string; to: string; solid: string; glow: string; emojis: string[];
}> = {
  health: {
    from:  "#34d399", to: "#a3e635", solid: "#10b981", glow: "rgba(16,185,129,.55)",
    emojis: ["🏃","💪","⚡","🔥","🏆","🐉","🛡️","🧬","🚀","👑"]
  },
  learning: {
    from:  "#8b5cf6", to: "#f0abfc", solid: "#7c3aed", glow: "rgba(139,92,246,.55)",
    emojis: ["📘","🧠","✨","🧪","🔭","🧩","🧠💥","🛰️","🌌","👑"]
  },
  work: {
    from:  "#38bdf8", to: "#22d3ee", solid: "#0284c7", glow: "rgba(56,189,248,.55)",
    emojis: ["💼","🛠️","🚀","📈","💡","🏆","🧭","🛡️","🛰️","👑"]
  },
  personal: {
    from:  "#f472b6", to: "#fb7185", solid: "#e11d48", glow: "rgba(244,114,182,.55)",
    emojis: ["💬","🤝","🎉","🌟","💖","🎆","🎭","🎵","🌈","👑"]
  },
}

/**
 * Each level adds a NEW feature in sequence.
 * Stages beyond the list keep intensifying glow.
 */
function classesForLevel(level: number): string[] {
  const L = Math.max(0, Math.floor(level))
  const stages = [
    /*0*/ "",                 // plain
    /*1*/ "sw--color",
    /*2*/ "sw--gradient",
    /*3*/ "sw--semibold",
    /*4*/ "sw--glow-sm",
    /*5*/ "sw--upper",
    /*6*/ "sw--pulse-slow",
    /*7*/ "sw--glow-md",
    /*8*/ "sw--pulse-fast",
    /*9*/ "sw--wiggle",
    /*10*/ "sw--bold",
    /*11*/ "sw--wide",
    /*12*/ "sw--shine",
    /*13*/ "sw--xbold",
    /*14*/ "sw--glow-lg",
  ]
  // accumulate all features up to the current level
  const acc: string[] = ["sw"]
  for (let i = 1; i <= Math.min(L, stages.length - 1); i++) {
    if (stages[i]) acc.push(stages[i])
  }
  return acc
}

/** 
 * Returns className, style with CSS vars, and emoji decorations that
 * escalate gradually. Emoji count grows past level 10.
 */
function progressiveWordVisuals(category: SkillArea["category"], level: number) {
  const theme = CAT_THEME[category]
  const cls = classesForLevel(level)

  const extraGlow = Math.max(0, level - 14) * 2
  const baseShadow = cls.includes("sw--glow-lg") ? 22 : cls.includes("sw--glow-md") ? 14 : cls.includes("sw--glow-sm") ? 8 : 0
  const shadowPx = baseShadow + extraGlow

  const style: React.CSSProperties = {
    ["--from" as any]: theme.from,
    ["--to" as any]: theme.to,
    ["--solid" as any]: theme.solid,
    ["--glow" as any]: theme.glow,
    textShadow: shadowPx > 0 ? `0 0 ${shadowPx}px var(--glow)` : undefined,
    fontFamily: fontForLevel(category, level),          // 👈 NEW: progressive font
  }

  const em = theme.emojis
  let prefix = "", suffix = ""
  if (level >= 10) {
    const count = Math.min(1 + Math.floor((level - 10) / 2), 3)
    const pick = (i: number) => em[(i + level) % em.length]
    prefix = Array.from({ length: count }, (_, i) => pick(i)).join("") + " "
    suffix = " " + Array.from({ length: count }, (_, i) => pick(i + 5)).join("")
  }

  return {
    className: cls.join(" "),
    style,
    prefix,
    suffix,
  }
}


// Category-themed font ladders (from tame → wild)
const FONT_STEPS: Record<SkillArea["category"], string[]> = {
  // Physical: bold / jagged / aggressive
  health: [
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "'Oswald', Arial Black, Impact, sans-serif",
    "'Bangers', 'Oswald', Impact, sans-serif",
    "'Black Ops One', 'Bangers', Impact, sans-serif",
  ],
  // Mental: cursive / curly / scholarly
  learning: [
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "'Satisfy', 'Inter', cursive",
    "'Caveat', 'Satisfy', cursive",
    "'Great Vibes', 'Pacifico', cursive",
  ],
  // Work: straight / condensed / utilitarian
  work: [
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "'Roboto Condensed', Inter, Roboto, sans-serif",
    "'Oswald', 'Roboto Condensed', sans-serif",
    "'Teko', 'Oswald', sans-serif",
  ],
  // Social: soft / rounded / friendly
  personal: [
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "'Quicksand', Inter, sans-serif",
    "'Baloo 2', 'Quicksand', sans-serif",
    "'Comfortaa', 'Baloo 2', sans-serif",
  ],
}

// Pick a font stage by level (0–3). Levels 0–3 → 0/1, 4–7 → 1, 8–11 → 2, 12+ → 3
function fontForLevel(category: SkillArea["category"], level: number): string {
  const idx = level >= 12 ? 3 : level >= 8 ? 2 : level >= 4 ? 1 : (level > 0 ? 1 : 0)
  const ladder = FONT_STEPS[category]
  return ladder[Math.min(idx, ladder.length - 1)]
}

// 10 tiers mapped by level bands
function levelToTier(level: number): number {
  if (level <= 0) return 0;        // 0
  if (level <= 3) return 1;        // 1–3
  if (level <= 7) return 2;        // 4–7
  if (level <= 9) return 3;        // 8–9
  if (level <= 14) return 4;       // 10–14
  if (level <= 19) return 5;       // 15–19
  if (level <= 29) return 6;       // 20–29
  if (level <= 49) return 7;       // 30–49
  if (level <= 79) return 8;       // 50–79
  return 9;                        // 80+
}

// Same levelToTier as before…

const SKILL_TITLES: Record<SkillArea["category"], string[]> = {
  health: [
    "Respawn Rookie",         // 0
    "Warm‑Up Wanderer",       // 1–3
    "Sweat Seeker",           // 4–7
    "Tempo Tactician",        // 8–9
    "Form Breaker",           // 10–14
    "PR Hunter",              // 15–19
    "Athletic Monster",       // 20–29
    "Apex Juggernaut",        // 30–49
    "Unbreakable Colossus",   // 50–79
    "Mythic Titan",           // 80+
  ],
  learning: [
    "Loading Screen",         // 0
    "Curious Initiate",       // 1–3
    "Lore Collector",         // 4–7
    "Arcane Apprentice",      // 8–9
    "Theory Crafter",         // 10–14
    "Mind‑Smith",             // 15–19
    "Quantum Thinker",        // 20–29
    "Arch‑Sage",              // 30–49
    "Infinity Scholar",       // 50–79
    "Transcendent Overmind",  // 80+
  ],
  work: [
    "Intern of Destiny",      // 0
    "Ticket Tamer",           // 1–3
    "Sprint Striker",         // 4–7
    "Ops Vanguard",           // 8–9
    "Roadmap Sniper",         // 10–14
    "Delivery Architect",     // 15–19
    "Workaholic Prime",       // 20–29
    "Division Commander",     // 30–49
    "Market Dominator",       // 50–79
    "Corporate Warlord",      // 80+
  ],
  personal: [
    "Quiet Lurker",           // 0
    "Vibe Starter",           // 1–3
    "Circle Builder",         // 4–7
    "City Connector",         // 8–9
    "Warmth Dealer",          // 10–14
    "Party Strategist",       // 15–19
    "Community Architect",    // 20–29
    "Network Oracle",         // 30–49
    "People Legend",          // 50–79
    "Heart of The City",         // 80+
  ],
}


function getSkillTitle(category: SkillArea["category"], level: number): string {
  const tier = levelToTier(level)
  return SKILL_TITLES[category][tier] ?? "Legend"
}


const Stats = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [skillAreas, setSkillAreas] = useState<SkillArea[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [skillXP, setSkillXP] = useState<Record<string, number>>({})

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("skillXP") || "{}")
    setSkillXP(stored)
  }, [])


  useEffect(() => {
    const storedTasks = localStorage.getItem("tasks")
    const parsedTasks: Task[] = storedTasks ? JSON.parse(storedTasks) : []
    const completedTasks = parsedTasks.filter((t) => t.completed)

    let savedFirstUse = localStorage.getItem("firstUseDate")
    if (!savedFirstUse) {
      savedFirstUse = new Date().toISOString()
      localStorage.setItem("firstUseDate", savedFirstUse)
    }

    const typeToCategoryMap: Record<Task["type"], SkillArea["category"]> = {
      work: "work",
      mental: "learning",
      physical: "health",
      social: "personal",
    }

    const skillConfig: Omit<SkillArea, 'level' | 'progress' | 'xpText' | 'title'>[] = [
  {
    name: "Physical Health",
    category: "health",
    icon: Dumbbell,
    color: "text-green-500",
    achievements: [] as string[],
  },
  {
    name: "Mental Growth",
    category: "learning",
    icon: Brain,
    color: "text-purple-500",
    achievements: [] as string[],
  },
  {
    name: "Work Performance",
    category: "work",
    icon: Target,
    color: "text-blue-500",
    achievements: [] as string[],
  },
  {
    name: "Social Connection",
    category: "personal",
    icon: Heart,
    color: "text-pink-500",
    achievements: [] as string[],
  },
]

    function getHoursRequiredForLevel(level: number): number {
      if (level <= 3)  return 0.5 + (level - 1) * 0.5; // 0.5, 1.0, 1.5
      if (level <= 10) return 2   + (level - 4) * 1.0; // 2 → 8
      if (level <= 14) return 8   + (level - 10) * 0.5;// 8 → 10
      return 10;
    }


    const storedSkillXP = JSON.parse(localStorage.getItem("skillXP") || "{}")

const skills = skillConfig.map((skill) => {
  const taskHours = completedTasks
    .filter((t) => typeToCategoryMap[t.type] === skill.category)
    .reduce((sum, t) => sum + (t.estimatedTime || 0), 0)

  const skillXPFromChallenges = skillXP?.[skill.category] || 0
  const totalHours = taskHours + skillXPFromChallenges

  let level = 0
  let remainingHours = totalHours

  while (true) {
    const hoursNeeded = getHoursRequiredForLevel(level + 1)
    if (remainingHours >= hoursNeeded) {
      remainingHours -= hoursNeeded
      level++
    } else {
      break
    }
  }

  const nextLevelHours = getHoursRequiredForLevel(level + 1)
  const progress = nextLevelHours > 0
    ? Math.min(100, (remainingHours / nextLevelHours) * 100)
    : 100
  const xpText = nextLevelHours > 0
    ? `${remainingHours.toFixed(1)}h / ${nextLevelHours}h to next level`
    : `Max level reached`

  const title = getSkillTitle(skill.category, level)   // 👈 NEW

  return {
    ...skill,
    level,
    progress,
    xpText,
    title,                                       
  }
})

    const taskCount = completedTasks.length
    const hasSocialTask = completedTasks.some(t => t.type === "social")

    const skillLevelMilestones: Milestone[] = []
    skills.forEach(skill => {
      if (skill.level >= 1) {
        skillLevelMilestones.push({
          id: `${skill.category}-lvl1`,
          title: `Beginner ${skill.name}`,
          description: `Reached level 1 in ${skill.name}`,
          date: new Date().toISOString(),
          type: skill.category,
        })
      }
      if (skill.level >= 5) {
        skillLevelMilestones.push({
          id: `${skill.category}-lvl5`,
          title: `New Heights`,
          description: `Level 5 achieved in ${skill.name}`,
          date: new Date().toISOString(),
          type: skill.category,
        })
      }
      if (skill.level >= 10) {
        skillLevelMilestones.push({
          id: `${skill.category}-lvl10`,
          title: `Mastery Achieved`,
          description: `Level 10 reached in ${skill.name}`,
          date: new Date().toISOString(),
          type: skill.category,
        })
      }
      if (skill.level >= 20) {
        skillLevelMilestones.push({
          id: `${skill.category}-lvl20`,
          title: `Elite Performer`,
          description: `20 levels deep into ${skill.name}`,
          date: new Date().toISOString(),
          type: skill.category,
        })
      }
      if (skill.level >= 50) {
        skillLevelMilestones.push({
          id: `${skill.category}-lvl50`,
          title: `Legend Status`,
          description: `Unstoppable growth in ${skill.name}`,
          date: new Date().toISOString(),
          type: skill.category,
        })
      }
    })

const dynamicMilestones: Milestone[] = [
      {
        id: "start",
        title: "Started Using AI Time Manager",
        description: "Began your journey to optimized productivity",
        date: savedFirstUse,
        type: "personal" as const,
      },
      ...(taskCount >= 5 ? [{
        id: "5t",
        title: "On Your Way",
        description: "Completed your first 5 tasks!",
        date: new Date().toISOString(),
        type: "work" as const,
      }] : []),
      ...(taskCount >= 10 ? [{
        id: "10t",
        title: "Task Crusher",
        description: "Knocked out 10 tasks like a pro!",
        date: new Date().toISOString(),
        type: "work" as const,
      }] : []),
      ...(hasSocialTask ? [{
        id: "s1",
        title: "Reach Out",
        description: "Completed your first social task",
        date: new Date().toISOString(),
        type: "personal" as const,
      }] : []),
      ...skillLevelMilestones
    ]

// === metrics ===
const totalCompleted = completedTasks.filter(t => !t.isParent).length
const totalHoursAll = completedTasks.reduce((s, t) => s + (t.estimatedTime || 0), 0)

// on-time %
const onTimeNum = completedTasks.filter(t =>
  t.completedOn &&
  t.deadline &&
  parseLocalDate(t.completedOn) <= parseLocalDate(t.deadline)
).length
const onTimePct = totalCompleted ? (onTimeNum / totalCompleted) * 100 : 0

const completedNonParents = completedTasks.filter(t => !t.isParent)

// per‑skill hours (include skillXP if you track it)
const hoursByCategory = { work: 0, health: 0, learning: 0, personal: 0 }
completedNonParents.forEach(t => {
  const h = t.estimatedTime || 0
  if (t.type === "work")     hoursByCategory.work     += h
  if (t.type === "physical") hoursByCategory.health   += h
  if (t.type === "mental")   hoursByCategory.learning += h
  if (t.type === "social")   hoursByCategory.personal += h
})
hoursByCategory.health   += (skillXP?.health   || 0)
hoursByCategory.learning += (skillXP?.learning || 0)
hoursByCategory.work     += (skillXP?.work     || 0)
hoursByCategory.personal += (skillXP?.personal || 0)

// best day (most tasks completed in a single day)
const byDay: Record<string, number> = {}
completedNonParents.forEach(t => {
  if (!t.completedOn) return
  byDay[t.completedOn] = (byDay[t.completedOn] || 0) + 1
})
const bestDayCount = Object.values(byDay).reduce((m, v) => Math.max(m, v || 0), 0)

// tasks completed this week (Mon–Sun)
const now = new Date()
const monday = new Date(now)
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // back to Monday
monday.setHours(0,0,0,0)
const weekCompleted = completedNonParents.filter(t => {
  if (!t.completedOn) return false
  const d = parseLocalDate(t.completedOn)
  return d >= monday && d <= now
}).length

// streaks (use whichever you store)
const dailyStreak = Number(localStorage.getItem("dailyStreak") || 0)
const longestStreak = Number(localStorage.getItem("longestStreak") || 0)

// === procedural series with NICE numbers ===
let series = [
  // Global
  ...makeLadderSeries({ idBase:"tasks", verb:"Complete", unit:"tasks", emoji:"✅", metric: totalCompleted, ladder: ladders.tasks }),
  ...makeLadderSeries({ idBase:"hours-total", verb:"Log", unit:"h total", emoji:"⏱️", metric: totalHoursAll, ladder: ladders.hoursTotal }),
  ...makeLadderSeries({ idBase:"streak", verb:"Maintain", unit:"day streak", emoji:"🔥", metric: Math.max(dailyStreak, longestStreak), ladder: ladders.streakDays }),
  ...makePercentSeries({ idBase:"ontime", title:"Punctual Prodigy", emoji:"⏰", percent: onTimePct, thresholds:[50,60,70,80,90,95,100] }),

  // Variety
  ...makeLadderSeries({ idBase:"best-day", verb:"Finish", unit:"tasks in a day", emoji:"📅", metric: bestDayCount, ladder: ladders.dayBurst }),
  ...makeLadderSeries({ idBase:"this-week", verb:"Finish", unit:"tasks this week", emoji:"📆", metric: weekCompleted, ladder: ladders.weekFlow }),

  // Per‑skill hours
  ...makeLadderSeries({ idBase:"health-hours",   verb:"Earn", unit:"h • Physical", emoji:"💪", metric: hoursByCategory.health,   ladder: ladders.perSkill }),
  ...makeLadderSeries({ idBase:"learning-hours", verb:"Earn", unit:"h • Mental",   emoji:"🧠", metric: hoursByCategory.learning, ladder: ladders.perSkill }),
  ...makeLadderSeries({ idBase:"work-hours",     verb:"Earn", unit:"h • Work",     emoji:"💼", metric: hoursByCategory.work,     ladder: ladders.perSkill }),
  ...makeLadderSeries({ idBase:"personal-hours", verb:"Earn", unit:"h • Social",   emoji:"🤝", metric: hoursByCategory.personal, ladder: ladders.perSkill }),
]

// === persist unlock dates so achievements stay unlocked visually ===
const unlockedMap = JSON.parse(localStorage.getItem("achievementsUnlocked") || "{}")
series.forEach(a => {
  if (a.unlocked && !unlockedMap[a.id]) unlockedMap[a.id] = new Date().toISOString()
  if (unlockedMap[a.id]) a.date = unlockedMap[a.id]
})
localStorage.setItem("achievementsUnlocked", JSON.stringify(unlockedMap))

  setTasks(parsedTasks)
  setSkillAreas(skills)
  setAchievements(series)
  setMilestones(dynamicMilestones)
  }, [])

  const getTypeColor = (type: string) => {
    switch (type) {
      case "work": return "bg-blue-500"
      case "health": return "bg-green-500"
      case "learning": return "bg-purple-500"
      case "personal": return "bg-orange-500"
      default: return "bg-gray-500"
    }
  }

  const getSkillVariant = (progress: number) => {
    if (progress >= 80) return "success"
    if (progress >= 60) return "warning"
    return "default"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Statistics</h1>
            <p className="text-xl text-muted-foreground">
              Track your progress and celebrate achievements
            </p>
          </div>
          <Button variant="outline" className="flex items-center space-x-2 hover-glow">
            <Share2 className="w-4 h-4" />
            <span>Share Progress</span>
          </Button>
        </div>

    <UnderGlowSection className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Weekly Momentum (replaces the Daily Productivity card) */}
<Card className="relative overflow-hidden border bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-purple-50/40 dark:from-amber-900/20 dark:via-amber-900/10 dark:to-purple-900/10 shadow-sm">
  {/* soft decorative glows */}
  <span className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-amber-400/25 blur-3xl" />
  <span className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl" />

  <CardHeader className="pb-2">
    <CardTitle className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-fuchsia-500 text-white shadow-sm">
          <TrendingUp className="h-4 w-4" />
        </div>
        <span>Weekly Momentum</span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        Mon–Sun
      </span>
    </CardTitle>
  </CardHeader>

  <CardContent className="pt-1">
    {(() => {
      // --- helpers ---
      const fmtISO = (d: Date) => d.toLocaleDateString("en-CA")
      const startOfWeek = (d: Date) => {
        // Monday start
        const day = d.getDay() // 0=Sun...6=Sat
        const diff = day === 0 ? -6 : 1 - day
        const m = new Date(d)
        m.setDate(d.getDate() + diff)
        m.setHours(0, 0, 0, 0)
        return m
      }

      // Weekly target (hours). User can store their own at "weeklyTargetHours"; default 20.
      const weeklyTarget = Number(getItem("weeklyTargetHours") || 60)

      const now = new Date()
      const mon = startOfWeek(now)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999)

      // sum hours by day for completed non-parent tasks
      const dayBuckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i)
        const iso = fmtISO(d)
        const hours = tasks
          .filter(t => t.completed && !t.isParent && t.completedOn === iso)
          .reduce((s, t) => s + (t.estimatedTime || 0), 0)
        return { iso, label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2), hours }
      })

      const weekHours = dayBuckets.reduce((s, x) => s + x.hours, 0)

      // progress vs target
      const rawPct =
        weeklyTarget > 0 ? Math.round((weekHours / weeklyTarget) * 100) : 0; // can exceed 100
      const progressPct = Math.min(100, Math.max(0, rawPct)); // clamp bar only

      // "On track" based on portion of the week elapsed
      const daysElapsed = Math.min(7, Math.max(0, Math.floor((now.getTime() - mon.getTime()) / 86400000) + 1))
      const expectedByNow = weeklyTarget * (daysElapsed / 7)
      const delta = weekHours - expectedByNow
      const status =
        Math.abs(delta) < 0.25
          ? { text: "On track", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
          : delta > 0
          ? { text: `${delta.toFixed(1)}h ahead`, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
          : { text: `${Math.abs(delta).toFixed(1)}h behind`, cls: "bg-rose-50 text-rose-700 ring-rose-200" }

      // mini 7‑day bars (pure CSS, no chart lib)
      const maxForScale = Math.max(1, ...dayBuckets.map(d => d.hours))
      const scale = 40 / maxForScale // 40px max height

      return (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="bg-gradient-to-r from-amber-600 to-fuchsia-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent tabular-nums">
                {weekHours.toFixed(1)}h
              </div>
            </div>

            {/* tiny bar strip */}
            <div className="flex h-12 items-end gap-1.5">
              {dayBuckets.map((d, i) => (
                <div key={d.iso} className="flex flex-col items-center">
                  <div
                    title={`${d.label}: ${d.hours.toFixed(1)}h`}
                    className={cn(
                      "w-3 rounded-sm bg-gradient-to-t from-amber-400 to-fuchsia-500 shadow-sm",
                      d.hours === 0 && "bg-muted"
                    )}
                    style={{ height: `${Math.max(3, Math.round(d.hours * scale))}px` }}
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground">{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* progress bar */}
          <div className="mt-3">
            <Progress value={progressPct} className="h-2" />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{rawPct}% of weekly target</span>   {/* <-- can show > 100% */}
            </div>
          </div>
        </>
      )
    })()}
  </CardContent>
</Card>




          {/* Tasks Done */}
{/* Tasks Done — richer version */}
<Card className="relative overflow-hidden border bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-purple-50/40 dark:from-amber-900/20 dark:via-amber-900/10 dark:to-purple-900/10 shadow-sm">
  {/* soft glow accents */}
  <span className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-amber-400/25 blur-3xl" />
  <span className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl" />

  <CardHeader className="pb-2">
    <CardTitle className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-fuchsia-500 text-white shadow-sm">
          <Target className="h-4 w-4" />
        </div>
        <span>Tasks Done</span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        Cumulative
      </span>
    </CardTitle>
  </CardHeader>

  <CardContent className="pt-1">
    {(() => {
      const fmtISO = (d: Date) => d.toLocaleDateString("en-CA")
      const pretty = (d: Date) =>
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" })

      const completed = tasks.filter(t => t.completed && !t.isParent)
      const totalDone = completed.length

      // last 7 days
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i))
        const iso = fmtISO(d)
        const count = completed.filter(t => t.completedOn === iso).length
        return { date: iso, label: pretty(d), count }
      })
      const total7 = last7.reduce((s, x) => s + x.count, 0)
      const todayCount = last7[last7.length - 1]?.count ?? 0
      const avgPerDay = (total7 / 7).toFixed(1)

      // previous 7 days for trend
      const prev7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i))
        const iso = fmtISO(d)
        return completed.filter(t => t.completedOn === iso).length
      }).reduce((s, n) => s + n, 0)

      const trendPct =
        prev7 === 0 ? (total7 > 0 ? 100 : 0) : Math.round(((total7 - prev7) / prev7) * 100)
      const trendUp = trendPct >= 0

      return (
        <>
          {/* Top row: big number + sparkline */}
          <div className="grid grid-cols-5 items-end gap-3">
            <div className="col-span-2">
              <div className="bg-gradient-to-r from-amber-600 to-fuchsia-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent tabular-nums">
                {totalDone}
              </div>
            </div>

            <div className="col-span-3 h-16 -mr-2">
              {total7 === 0 ? (
                <div className="h-full grid place-items-center text-xs text-muted-foreground">
                  No data for the last 7 days
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last7} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tdFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#tdFill)"
                      isAnimationActive={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(0,0,0,0.05)", strokeWidth: 8 }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-sm">
                            <div className="font-medium">{payload[0].payload.label}</div>
                            <div className="text-muted-foreground">
                              {payload[0].value} task{payload[0].value === 1 ? "" : "s"}
                            </div>
                          </div>
                        ) : null
                      }
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </>
      )
    })()}
  </CardContent>
</Card>


{/* Achievements */}
<Card className="relative overflow-hidden border bg-gradient-to-br from-emerald-50/70 via-emerald-50/30 to-cyan-50/40 dark:from-emerald-900/20 dark:via-emerald-900/10 dark:to-cyan-900/10 shadow-sm">
  <span className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-emerald-400/25 blur-3xl" />
  <span className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />

  <CardHeader className="pb-2">
    <CardTitle className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm">
          <Award className="h-4 w-4" />
        </div>
        <span>Achievements</span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        badges
      </span>
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent tabular-nums">
      {achievements.filter((a) => a.unlocked).length}
    </div>
    <p className="mt-1 text-xs text-muted-foreground">Earned so far — keep collecting!</p>
  </CardContent>
</Card>

{/* Rank */}
<Card className="relative overflow-hidden border bg-gradient-to-br from-violet-50/70 via-violet-50/30 to-sky-50/40 dark:from-violet-900/20 dark:via-violet-900/10 dark:to-sky-900/10 shadow-sm">
  <span className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-violet-400/25 blur-3xl" />
  <span className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-sky-400/20 blur-3xl" />

  <CardHeader className="pb-2">
    <CardTitle className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-sm">
          <Users className="h-4 w-4" />
        </div>
        <span>Rank</span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
        soon
      </span>
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="bg-gradient-to-r from-violet-600 to-sky-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent tabular-nums">
      0
    </div>
    <p className="mt-1 text-xs text-muted-foreground">Competitive ladder & friends — coming soon</p>
  </CardContent>
</Card>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-stretch">
          <Card className="gradient-card orange shadow-card border-0">
            <CardHeader>
              <CardTitle>Skill Progression</CardTitle>
              <CardDescription>Your growth across different life areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 min-h-[490px]">
                {skillAreas.map((skill) => {
  const vis = progressiveWordVisuals(skill.category, skill.level)

  return (
    <div key={skill.name} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <skill.icon className={cn("w-6 h-6", skill.color)} />
          <div>
            <h3 className="font-semibold text-foreground">{skill.name}</h3>
            <p className="text-sm text-muted-foreground">Level {skill.level}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progressive visual word */}
          <span className={vis.className} style={vis.style}>
            {vis.prefix}{skill.title}{vis.suffix}
          </span>

          <Badge variant="outline" className="bg-primary/10 text-primary">
            {Math.round(skill.progress)}%
          </Badge>
        </div>
      </div>

      <Progress
        value={skill.progress}
        variant={getSkillVariant(skill.progress) as "default" | "success" | "warning"}
      />
      <p className="text-xs text-muted-foreground">{skill.xpText}</p>
    </div>
  )
})}

              </div>
            </CardContent>
          </Card>

     {/* RIGHT COLUMN: Achievements (left) + Milestones (right) */}
{/* RIGHT COLUMN: Achievements over Milestones (stacked, same height as left) */}
<div className="h-full min-h-0 overflow-hidden grid grid-rows-[1fr_1fr] gap-6">
  {/* --- Achievements --- */}
  <Card className="gradient-card ring-violet-fuchsia-cyan min-h-0 flex flex-col">
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50/50 via-fuchsia-50/30 to-transparent dark:from-violet-900/10 dark:via-fuchsia-900/10" />
    <CardHeader className="relative z-10 pb-3 flex-none">
      <CardTitle className="flex items-center gap-2 text-foreground">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
          🏅
        </span>
        <span>Achievements</span>
        <span className="ml-auto text-[11px] rounded-full border px-2 py-0.5 bg-white/70 dark:bg-white/10">
          {achievements.filter(a => a.unlocked).length} unlocked
        </span>
      </CardTitle>
      <CardDescription className="text-muted-foreground">
        Earn badges as you make progress.
      </CardDescription>
    </CardHeader>

    {/* Content scrolls inside the card */}
    <CardContent className="relative z-10 max-h-[175px] overflow-y-auto pr-2 custom-scroll">
      <div className="grid grid-cols-1 sm:grid-cols-2 auto-rows-min gap-3">
        {achievements.map((a) => {
          const pct = Math.round(a.unlocked ? 100 : (a.progress ?? 0))
          const unlocked = !!a.unlocked
          return (
            <div
              key={a.id}
              className={cn(
                "rounded-lg border bg-white/80 p-3 dark:bg-white/5 transition",
                unlocked
                  ? "ring-1 ring-fuchsia-300/70 dark:ring-fuchsia-500/30"
                  : "hover:bg-white"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.title}</div>
                  {a.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {a.description}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[10px] px-2 py-0.5 rounded-full border",
                    unlocked
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                  )}
                >
                  {unlocked ? "Unlocked" : `${pct}%`}
                </span>
              </div>

              {!unlocked && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-1.5 rounded bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {a.date && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {asLocalDate(a.date)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </CardContent>
  </Card>

  {/* --- Milestones --- */}
  <Card className="gradient-card ring-sky-violet-fuchsia min-h-0 flex flex-col">
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50/40 via-fuchsia-50/20 to-transparent dark:from-violet-900/10 dark:via-fuchsia-900/10" />
    <CardHeader className="relative z-10 pb-3 flex-none">
      <CardTitle className="flex items-center gap-2 text-foreground">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm">
          🛣️
        </span>
        <span>Your Journey</span>
      </CardTitle>
      <CardDescription className="text-muted-foreground">
        Key milestones in your productivity journey.
      </CardDescription>
    </CardHeader>

    {/* Content scrolls inside the card */}
    <CardContent className="relative z-10 max-h-[175px] overflow-y-auto pr-2 custom-scroll">
      {(!milestones || milestones.length === 0) ? (
        <div className="text-sm text-muted-foreground">No milestones yet.</div>
      ) : (
        <ol className="relative border-l pl-4 border-muted-foreground/20">
          {milestones.map((m, idx) => (
            <li key={m.id ?? idx} className="mb-5 ml-1">
              {/* colored dot by type */}
              <span
                className={cn(
                  "absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4",
                  MILESTONE_DOT[m.type]
                )}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {m.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {asLocalDate(m.date)}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-white/70">
                  {m.type}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </CardContent>
  </Card>
</div>


</div>
</UnderGlowSection>
      </div>
      <SiteFooter />
    </div>
  )
}

export default Stats
