export interface Task {
  /* required in UI */
  id:            string;
  title:         string;
  completed:     boolean;
  category:      "personal" | "work" | "health" | "learning";
  priority:      "low" | "medium" | "high";
  deadline:      string;           // YYYY-MM-DD
  estimatedTime: number;
  type:          "mental" | "physical" | "work" | "social";

  /* DB-managed → OPTIONAL on the client ⬇︎ */
  created_at?:   string;
  updated_at?:   string;

  /* hierarchy / helpers (all optional) */
  parentId?:     string;
  isParent?:     boolean;
  partIndex?:    number;
  totalParts?:   number;
  showToday?:    boolean;
  locked?:       boolean;
  completedOn?:  string;
}


export interface ScheduledBlock {
  title: string
  taskId?: string
  type: "task" | "break" | "recurring" | "sleep" | "free"
  start: string
  end: string
  startDate?: Date
  endDate?: Date
  manual?: boolean;
}

export interface UserSchedulePrefs {
  wakeUp: string
  sleep: string
  recurringBlocks: {
    title: string
    times: string[]
    duration: number
  }[]
  use12HourClock: boolean
  maxSessionMinutes?: number   
}
