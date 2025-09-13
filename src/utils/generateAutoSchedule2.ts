import { Task, ScheduledBlock, UserSchedulePrefs } from "./types"
import { parseTime } from "./timeHelpers"
import { getItem, setItem } from "./localStorage"
import { addChange } from "./schedulePatcher"

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function getCanonicalSubtask(task: Task, all: Task[]): Task {
  // If it's already a subtask, use it.
  if (task.parentId) return task;
  // If it's a normal single task (not parent), use it.
  if (!task.isParent) return task;

  // It's a parent: pick the first incomplete "today" subtask, or first incomplete.
  const subs = all
    .filter(t => t.parentId === task.id)
    .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));

  return (
    subs.find(st => !st.completed && (st.showToday ?? false)) ||
    subs.find(st => !st.completed) ||
    subs[subs.length - 1] || // fallback (shouldn’t happen)
    task
  );
}

function dedupeByTaskId(blocks: ScheduledBlock[]): ScheduledBlock[] {
  const seen = new Set<string>();
  const out: ScheduledBlock[] = [];
  for (const b of blocks.sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())) {
    if (b.type === "task" && b.taskId) {
      if (seen.has(b.taskId)) continue;
      seen.add(b.taskId);
    }
    out.push(b);
  }
  return out;
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60000)
}

function roundToNext15Minutes(date: Date): Date {
  const mins = date.getMinutes()
  const rounded = Math.ceil(mins / 15) * 15
  const next = new Date(date)
  next.setMinutes(rounded, 0, 0)
  return next
}

function splitLongTask(task: Task, maxSessionMinutes: number): Task[] {
  const MAX_CHUNK_HOURS = Math.max(maxSessionMinutes / 60, 0.25) // at least 15m
  if (task.estimatedTime <= MAX_CHUNK_HOURS) return [task]

  const parts: Task[] = []
  let remaining = task.estimatedTime
  let index = 1

  while (remaining > 0) {
    const chunkH = Math.min(remaining, MAX_CHUNK_HOURS)
    parts.push({
      ...task,
      id: `${task.id}-part${index}`,
      title: `${task.title} (Part ${index})`,
      estimatedTime: chunkH,
      partIndex: index,
      totalParts: 0,
    })
    remaining -= chunkH
    index++
  }

  const totalParts = parts.length
  return parts.map((p, i) => ({ ...p, partIndex: i + 1, totalParts }))
}

function getSleepBlocks(wake: Date, sleep: Date): ScheduledBlock[] {
  const midnight = new Date(wake);
  midnight.setHours(0, 0, 0, 0);

  // Overnight sleep (start of day → wake)
  const blocks: ScheduledBlock[] = [
    {
      title: "Sleep",
      type: "sleep",
      start: formatTime(midnight),
      end: formatTime(wake),
      startDate: midnight,
      endDate: wake,
    },
  ];

  // 🔹 Zero‑length marker at the *actual* sleep time (can be next day)
  blocks.push({
    title: "Sleep",
    type: "sleep",
    start: formatTime(sleep),
    end: formatTime(sleep),
    startDate: sleep,
    endDate: sleep,
  });

  return blocks;
}

function insertRecurringBlocks(
  blocks: ScheduledBlock[],
  prefs: UserSchedulePrefs,
  today: Date,
  wake: Date,
  sleep: Date
): ScheduledBlock[] {
  (prefs.recurringBlocks || []).forEach(rec => {
    rec.times.forEach(timeStr => {
      const start = parseTime(timeStr, today);
      const end = new Date(start.getTime() + rec.duration * 60000);

      // 🚫 skip if outside [wake → sleep]
      if (start < wake || end > sleep) return;

      blocks.push({
        title: rec.title,
        type: "recurring",
        start: formatTime(start),
        end: formatTime(end),
        startDate: start,
        endDate: end,
      });
    });
  });
  return blocks;
}


function scheduleTaskParts(
  task: Task,
  start: Date,
  remainingMinutes: number,
  sleepTime: Date,
  blocks: ScheduledBlock[],
  maxChunkMinutes: number            // 👈 NEW
): Date {
  if (remainingMinutes <= 0 || start >= sleepTime) return start

  const maxChunk = maxChunkMinutes || 120           // 👈 use user cap (minutes)
  const chunk = Math.min(remainingMinutes, maxChunk)
  const blockEnd = addMinutes(start, chunk)
  const now = new Date()
  // Skip blocks that would start in the past
  if (blockEnd <= now) {
    return scheduleTaskParts(task, roundToNext15Minutes(blockEnd), remainingMinutes, sleepTime, blocks, maxChunkMinutes)
  }

  const overlaps = blocks.some(b => start < b.endDate! && blockEnd > b.startDate!)
  if (overlaps) {
    const nextAvailable = blocks
      .map(b => b.endDate!)
      .filter(end => end > start)
      .sort((a, b) => a.getTime() - b.getTime())[0]

    return nextAvailable
      ? scheduleTaskParts(task, roundToNext15Minutes(nextAvailable), remainingMinutes, sleepTime, blocks, maxChunkMinutes)
      : start
  }

  // add task block
  blocks.push({
    title: task.title,
    taskId: task.id,
    type: "task",
    start: formatTime(start),
    end: formatTime(blockEnd),
    startDate: start,
    endDate: blockEnd
  })

  const remaining = remainingMinutes - chunk
  const afterBlock = new Date(blockEnd)

  if (remaining > 0) {
    const breakDuration = chunk >= maxChunk ? 45 : 30  // 👈 break based on session size
    const breakEnd = addMinutes(afterBlock, breakDuration)
    if (breakEnd <= sleepTime) {
      blocks.push({
        title: "Break",
        type: "break",
        start: formatTime(afterBlock),
        end: formatTime(breakEnd),
        startDate: afterBlock,
        endDate: breakEnd
      })
      return scheduleTaskParts(task, roundToNext15Minutes(breakEnd), remaining, sleepTime, blocks, maxChunkMinutes)
    }
  }

  return blockEnd
}

function shrinkBreaksProportionally(
  blocks: ScheduledBlock[],
  removeMin: number
): { ok: boolean } {
  const breaks = blocks.filter(b => b.type === "break");
  if (removeMin <= 0) return { ok: true };
  if (breaks.length === 0) return { ok: false };

  const durations = breaks.map(b => minutesBetween(b.startDate!, b.endDate!));
  const totalBreak = durations.reduce((a, b) => a + b, 0);
  if (removeMin > totalBreak) return { ok: false };

  const percent = removeMin / totalBreak;
  const originalEnds = breaks.map(b => b.endDate!);

  for (let i = 0; i < breaks.length; i++) {
    const br = breaks[i];
    const orig = durations[i];
    const reduceBy = Math.min(orig - 5, Math.ceil(orig * percent)); // keep ≥5m
    const newDur = Math.max(5, orig - reduceBy);
    if (newDur === orig) continue;

    const newEnd = addMinutes(br.startDate!, newDur);
    const shiftMs = br.endDate!.getTime() - newEnd.getTime();
    const originalEnd = originalEnds[i];

    // shrink break
    br.endDate = newEnd;
    br.end = formatTime(newEnd);

    // shift any blocks after this break earlier
    blocks.forEach(b => {
      if (b.startDate! > originalEnd && b.type !== "sleep" && b.type !== "recurring") {
        b.startDate = new Date(b.startDate!.getTime() - shiftMs);
        b.endDate   = new Date(b.endDate!.getTime()   - shiftMs);
        b.start = formatTime(b.startDate!);
        b.end   = formatTime(b.endDate!);
      }
    });
  }

  return { ok: true };
}

function insertBreak(
  cursor: Date,
  minutes: number,
  blocks: ScheduledBlock[],
  sleep: Date
): Date {
  let start = cursor
  let end = addMinutes(start, minutes)

  // avoid overlaps with existing blocks
  while (blocks.some(b => start < b.endDate! && end > b.startDate!)) {
    const next = blocks
      .map(b => b.endDate!)
      .filter(d => d > start)
      .sort((a, b) => a.getTime() - b.getTime())[0]
    if (!next) return cursor // nowhere to place the break
    start = roundToNext15Minutes(next)
    end = addMinutes(start, minutes)
  }

  if (end > sleep) return cursor

  blocks.push({
    title: "Break",
    type: "break",
    start: formatTime(start),
    end: formatTime(end),
    startDate: start,
    endDate: end,
  })
  return roundToNext15Minutes(end)
}

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function freeWindows(
  blocks: ScheduledBlock[],
  wake: Date,
  sleep: Date,
  now: Date
): Array<{ start: Date; end: Date }> {
  const nowRounded = roundToNext15Minutes(now);
  const dayStart = new Date(Math.max(wake.getTime(), nowRounded.getTime()));

  const nonFree = blocks
    .filter(b => b.startDate && b.endDate && b.type !== "free")
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

  const windows: Array<{ start: Date; end: Date }> = [];
  let cursor = dayStart;

  for (const b of nonFree) {
    if (b.endDate! <= cursor) continue;
    if (b.startDate! > cursor) {
      const start = new Date(cursor);
      const end   = new Date(Math.min(b.startDate!.getTime(), sleep.getTime()));
      if (end > start) windows.push({ start, end });
    }
    cursor = new Date(Math.max(cursor.getTime(), b.endDate!.getTime()));
    if (cursor >= sleep) break;
  }

  if (cursor < sleep) windows.push({ start: cursor, end: sleep });
  return windows.filter(w => w.end > w.start);
}

export function normalizeSleep(wake: Date, sleep: Date): Date {
  const s = new Date(sleep);
  if (s.getTime() <= wake.getTime()) {
    // sleep time is AM or otherwise earlier than wake → treat as tomorrow
    s.setDate(s.getDate() + 1);
  }
  return s;
}

export function fillFreeGaps(blocks: ScheduledBlock[], wake: Date, sleep: Date): ScheduledBlock[] {
  const sorted = [...blocks]
    .filter(b => b.startDate && b.endDate)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())

  const out: ScheduledBlock[] = []
  let pointer = new Date(wake)

  // helper: push/extend a Free block, converting trailing Break→Free if needed
  const pushOrMergeFree = (start: Date, end: Date) => {
    if (start >= end) return
    const last = out[out.length - 1]
    if (last && (last.type === "free" || last.type === "break") && last.endDate!.getTime() === start.getTime()) {
      // merge & force as Free
      last.type = "free"
      last.title = "Free Time"
      last.endDate = end
      last.end = formatTime(end)
    } else {
      out.push({
        title: "Free Time",
        type: "free",
        start: formatTime(start),
        end: formatTime(end),
        startDate: start,
        endDate: end
      })
    }
  }

  for (const b of sorted) {
    // gap before this block → Free
    if (b.startDate! > pointer) pushOrMergeFree(pointer, b.startDate!)

    // if current is Break touching previous Free, swallow Break into Free
    const last = out[out.length - 1]
    if (b.type === "break" && last && last.type === "free" && last.endDate!.getTime() === b.startDate!.getTime()) {
      last.endDate = b.endDate
      last.end = formatTime(b.endDate!)
      pointer = b.endDate!
      continue // skip pushing this Break
    }

    out.push(b)
    pointer = b.endDate!
  }

  // tail gap → Free
  // tail gap → Free
  if (pointer < sleep) pushOrMergeFree(pointer, sleep);
  
  // final pass: merge any remaining touching Free/Free or Break/Free or Free/Break into Free
  const merged: ScheduledBlock[] = [];
  for (const b of out) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.endDate!.getTime() === b.startDate!.getTime() &&
      (
        (last.type === "free" && b.type === "free") ||
        (last.type === "free" && b.type === "break") ||
        (last.type === "break" && b.type === "free")
      )
    ) {
      last.type = "free";
      last.title = "Free Time";
      last.endDate = b.endDate;
      last.end = formatTime(b.endDate!);
    } else {
      merged.push(b);
    }
  }
  
  return merged;  // ← no extra tail push here
  
}

export function getFreeTimeGaps(blocks: ScheduledBlock[], sleep: Date): ScheduledBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime()); // ← copy
  const gaps: ScheduledBlock[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]

    if (current.endDate! < next.startDate!) {
      gaps.push({
        title: "Free Gap",
        type: "free",
        start: formatTime(current.endDate!),
        end: formatTime(next.startDate!),
        startDate: current.endDate!,
        endDate: next.startDate!
      })
    }
  }

  const last = sorted[sorted.length - 1]
  if (last.endDate! < sleep) {
    gaps.push({
      title: "Free Gap",
      type: "free",
      start: formatTime(last.endDate!),
      end: formatTime(sleep),
      startDate: last.endDate!,
      endDate: sleep
    })
  }

  return gaps
}

export function generateAutoSchedule(
  tasks: Task[],
  prefs: UserSchedulePrefs
): { blocks: ScheduledBlock[]; unscheduled: Task[] } {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const wakeBase = parseTime(prefs.wakeUp, today);
  let sleepBase  = parseTime(prefs.sleep, today);
  const wake  = wakeBase;
  const sleep = normalizeSleep(wakeBase, sleepBase);

  const maxChunkMin = prefs.maxSessionMinutes ?? 120;

  // ⏱️ dynamic breaks from max session (min 5m)
  const maxBreakMin = Math.max(5, Math.round(maxChunkMin / 2));
  const normalBreakMin = Math.max(5, Math.round(maxChunkMin / 4));

  // ---- helpers ----
  const overlapsAny = (start: Date, end: Date, list: ScheduledBlock[]) =>
    list.some(b => start < b.endDate! && end > b.startDate!);

  const nextAvailableAfter = (start: Date, list: ScheduledBlock[]) => {
    const next = list
      .map(b => b.endDate!)
      .filter(d => d > start)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return next ? roundToNext15Minutes(next) : start;
  };

  const insertBreakAtCursor = (
    cursor: Date,
    minutes: number,
    list: ScheduledBlock[]
  ): Date => {
    let start = cursor;
    let end = addMinutes(start, minutes);

    while (overlapsAny(start, end, list)) {
      const nxt = nextAvailableAfter(start, list);
      if (nxt.getTime() === start.getTime()) break;
      start = nxt;
      end = addMinutes(start, minutes);
      if (end > sleep) return cursor;
    }
    if (end > sleep) return cursor;

    list.push({
      title: "Break",
      type: "break",
      start: formatTime(start),
      end: formatTime(end),
      startDate: start,
      endDate: end
    });
    return roundToNext15Minutes(end);
  };

  const placeSession = (
    baseTask: Task,
    title: string,
    durationMin: number,
    cursor: Date,
    list: ScheduledBlock[]
  ): { placed: boolean; newCursor: Date } => {
    const nowRounded = roundToNext15Minutes(now);
    let start = cursor < nowRounded ? nowRounded : cursor;
    let end = addMinutes(start, durationMin);

    let guard = 0;
    while ((end > sleep) || overlapsAny(start, end, list)) {
      const nxt = nextAvailableAfter(start, list);
      if (nxt.getTime() === start.getTime()) break;
      start = nxt < nowRounded ? nowRounded : nxt;
      end = addMinutes(start, durationMin);
      if (++guard > 1000) break;
    }
    if (end > sleep) return { placed: false, newCursor: cursor };

    list.push({
      title,
      type: "task",
      taskId: baseTask.id,
      start: formatTime(start),
      end: formatTime(end),
      startDate: start,
      endDate: end
    });

    return { placed: true, newCursor: roundToNext15Minutes(end) };
  };

  // ---- preserve from cache ----
const rawCache = getItem("autoScheduleCache") || [];
const withinDay = (b: ScheduledBlock) =>
  b.startDate! >= wake && b.endDate! <= sleep;

const preservedBlocks: ScheduledBlock[] = [];
for (const block of rawCache) {
  const parsed: ScheduledBlock = {
    ...block,
    startDate: new Date(block.startDate as any),
    endDate: new Date(block.endDate as any),
  };

  const exactTask = parsed.taskId ? tasks.find(t => t.id === parsed.taskId) : undefined;
  const baseId = parsed.taskId?.includes("-part") ? parsed.taskId.split("-part")[0] : parsed.taskId;
  const baseTask = baseId ? tasks.find(t => t.id === baseId) : undefined;

  // Drop task blocks outside [wake → sleep]
  if (parsed.type === "task" && !withinDay(parsed)) continue;

  // ✅ Preserve tasks that are manual, already started, or completed
  if (parsed.type === "task") {
    if (parsed.manual || parsed.startDate! < now || exactTask?.completed || baseTask?.completed) {
      preservedBlocks.push(parsed);
    }
    continue;
  }

  // ✅ Preserve future breaks (so planned rest stays intact)
  if (parsed.type === "break" && parsed.startDate! > now && withinDay(parsed)) {
    preservedBlocks.push(parsed);
    continue;
  }

  // You can add other preserve rules for recurring/sleep if desired
}



  // seed with sleep + preserved tasks, then add recurring
  let blocks: ScheduledBlock[] = [
    ...getSleepBlocks(wake, sleep),
    ...preservedBlocks.filter(b => b.type === "task")
  ];
  blocks = insertRecurringBlocks(blocks, prefs, today, wake, sleep);

  // ---- choose tasks for today ----
  const todayISO = today.toISOString().slice(0, 10);
  const preservedBaseIds = new Set(
    preservedBlocks
      .filter(b => b.type === "task" && b.taskId)
      .map(b => (b.taskId!.includes("-part") ? b.taskId!.split("-part")[0] : b.taskId!))
  );

  const eligible = tasks.filter(t => {
    const deadlineISO = t.deadline.slice(0, 10);
    const baseId = t.id.split("-part")[0];
    const alreadyPreserved = preservedBaseIds.has(baseId);
    
    return (
      !t.isParent &&
      (t.showToday || !t.parentId) &&
      deadlineISO >= todayISO &&
      !t.completed &&                // we don't need to re-schedule completed items
      !alreadyPreserved              // and skip anything whose base is preserved
    );
  });


  const priorityScore: Record<Task["priority"], number> = { high: 1, medium: 2, low: 3 };
  const ordered = [...eligible].sort(
    (a, b) =>
      priorityScore[a.priority] - priorityScore[b.priority] ||
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );

  // ---- expand into sessions (respect maxChunkMin) ----
  // ---- expand into sessions (respect maxChunkMin) ----
type Session = {
  task: Task; baseId: string; partIndex: number; totalParts: number;
  durationMin: number; title: string;
};

// cursor starts at "now or wake" rounded
let cursor2 = roundToNext15Minutes(new Date(Math.max(wake.getTime(), now.getTime())));

// If we’re currently in a task (or one just ended), force a pre‑break
const activeOrJustWorked = (() => {
  // Active task block
  const active = preservedBlocks
    .filter(b => b.type === "task" && b.startDate! <= now && b.endDate! > now)
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())[0];
  if (active) return active;

  // Task ended within last 5 min
  const last = preservedBlocks
    .filter(b => b.type === "task" && b.endDate! <= now)
    .sort((a, b) => b.endDate!.getTime() - a.endDate!.getTime())[0];
  if (last && minutesBetween(last.endDate!, now) <= 5) return last;

  return undefined;
})();

if (activeOrJustWorked) {
  const prevDur = minutesBetween(activeOrJustWorked.startDate!, activeOrJustWorked.endDate!);
  const breakMin =
    Math.round(prevDur) >= Math.round(maxChunkMin) ? maxBreakMin : normalBreakMin;

  // Don’t double‑insert if a future break is already cached soon
  const alreadyHasBreak = preservedBlocks.some(
    b =>
      b.type === "break" &&
      b.startDate! >= now &&
      b.startDate! < addMinutes(now, breakMin + 5)
  );

  if (!alreadyHasBreak) {
    cursor2 = insertBreakAtCursor(cursor2, breakMin, blocks);
  }
}


const sessions: Session[] = [];
for (const t of ordered) {
  let remaining = Math.max(0, Math.round((t.estimatedTime || 0) * 60));
  if (remaining === 0) continue;

  const totalParts = Math.max(1, Math.ceil(remaining / maxChunkMin));

  // ⛑️ Only append our "(Part i)" label for single-day tasks that *aren’t already* parts.
  // If it's a real subtask (has parentId) or its title already has "(Part", keep the title as-is.
  const canAppendPartLabel = !t.parentId && !/\(Part\b/i.test(t.title);

  for (let i = 1; remaining > 0; i++) {
    const chunk = Math.min(remaining, maxChunkMin);
    const title = (canAppendPartLabel && totalParts > 1)
      ? `${t.title} (Part ${i})`
      : t.title;

    sessions.push({
      task: t,
      baseId: t.id,
      partIndex: i,
      totalParts,
      durationMin: chunk,
      title
    });
    remaining -= chunk;
  }
}


  // ---- schedule with pre-session breaks (dynamic durations) ----
  let cursor = roundToNext15Minutes(new Date(Math.max(wake.getTime(), now.getTime())));
  let isFirst = true;
  let lastSessionDuration = 0;

  for (const s of sessions) {
    if (!isFirst) {
      const breakMin = (Math.round(lastSessionDuration) >= Math.round(maxChunkMin))
        ? maxBreakMin           // ½ × max session
        : normalBreakMin;       // ¼ × max session
      cursor = insertBreakAtCursor(cursor, breakMin, blocks);
    }

    const placed = placeSession(s.task, s.title, s.durationMin, cursor, blocks);
    if (!placed.placed) break;

    cursor = placed.newCursor;
    isFirst = false;
    lastSessionDuration = s.durationMin;
  }

  blocks = blocks.filter(
    b => b.type === "sleep" || (b.startDate! >= wake && b.endDate! <= sleep)
  );
  
  // ---- compute unscheduled ----
  const scheduledMinutesByBaseId: Record<string, number> = {};
  for (const b of blocks) {
    if (b.type === "task" && b.taskId) {
      const baseId = b.taskId.split("-part")[0];
      const dur = (b.endDate!.getTime() - b.startDate!.getTime()) / 60000;
      scheduledMinutesByBaseId[baseId] = (scheduledMinutesByBaseId[baseId] || 0) + dur;
    }
  }

  const requiredMinutesByBaseId: Record<string, number> = {};
  for (const t of ordered) {
    const baseId = t.id.split("-part")[0];
    requiredMinutesByBaseId[baseId] =
      (requiredMinutesByBaseId[baseId] || 0) + Math.round(t.estimatedTime * 60);
  }

  const unscheduled: Task[] = [];
  const seen = new Set<string>();
  for (const t of ordered) {
    const baseId = t.id.split("-part")[0];
    if (seen.has(baseId)) continue;
    const scheduled = scheduledMinutesByBaseId[baseId] || 0;
    const required = requiredMinutesByBaseId[baseId] || 0;
    if (scheduled < required) unscheduled.push(t);
    seen.add(baseId);
  }

  const finalBlocks = fillFreeGaps(blocks, wake, sleep).sort(
    (a, b) => a.startDate!.getTime() - b.startDate!.getTime()
  );

  setItem("unscheduledTasksCache", unscheduled);

  return { blocks: finalBlocks, unscheduled };
}

export function retrySchedulingUnscheduledTasks(
  unscheduled: Task[],
  blocks: ScheduledBlock[],
  sleep: Date
): ScheduledBlock[] {
  const updated = [...blocks];

  for (const task of unscheduled) {
    const removeFromBreak = Math.round(task.estimatedTime * 60); // minutes
    const shrink = shrinkBreaksProportionally(updated, removeFromBreak);
    if (!shrink.ok) {
      console.warn(`❌ Cannot fit "${task.title}" — not enough break time.`);
      continue;
    }

    // Insert right after the latest non-fixed block (ignore sleep/recurring/free)
    const tailAnchor = updated
      .filter(b => b.type !== "sleep" && b.type !== "recurring" && b.type !== "free")
      .sort((a, b) => b.endDate!.getTime() - a.endDate!.getTime())[0];

    let start = roundToNext15Minutes(tailAnchor?.endDate || new Date());
    const nowRounded = roundToNext15Minutes(new Date());
    if (start < nowRounded) start = nowRounded;

    const end = addMinutes(start, removeFromBreak);

    if (end <= sleep) {
      updated.push({
        title: task.title,
        type: "task",
        taskId: task.id,
        start: formatTime(start),
        end: formatTime(end),
        startDate: start,
        endDate: end,
        manual: true, // persist across regenerations
      });

      // remove only this task from the unscheduled cache
      const remainingUnscheduled: Task[] =
        (getItem("unscheduledTasksCache") || unscheduled).filter((t: Task) => t.id !== task.id);
      setItem("unscheduledTasksCache", remainingUnscheduled);
    } else {
      console.warn(`❌ Not enough space to insert '${task.title}' before sleep.`);
    }
  }

  // Rebuild Free Time blocks and persist the final schedule
  const withoutFree = updated.filter(b => b.type !== "free");

  // derive today's wake from the sleep block that ends in the morning
  const morningSleep = withoutFree
    .filter(b => b.type === "sleep")
    .sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime())[0];

  const wake =
    morningSleep?.endDate ?? new Date(new Date().setHours(0, 0, 0, 0));

  const finalBlocks = fillFreeGaps(withoutFree, wake, sleep).sort(
    (a, b) => a.startDate!.getTime() - b.startDate!.getTime()
  );

  setItem("autoScheduleCache", finalBlocks);
  setItem("autoScheduleGeneratedOn", new Date().toISOString().split("T")[0]);

  return finalBlocks;
}

export function delayTaskByOneDay(task: Task): Task {
  const oldDeadline = new Date(task.deadline)
  oldDeadline.setDate(oldDeadline.getDate() + 1)
  const newDeadline = oldDeadline.toISOString().split("T")[0]

  return {
    ...task,
    deadline: newDeadline
  }
}



// --- replacement for attemptToScheduleTask -----------------------------------

export function attemptToScheduleTask(
  task: Task,
  prefs: UserSchedulePrefs
): { blocks: ScheduledBlock[]; success: boolean } {
  // Rehydrate cache
  const raw: ScheduledBlock[] = (getItem("autoScheduleCache") || []).map((b: any) => ({
    ...b,
    startDate: new Date(b.startDate),
    endDate: new Date(b.endDate),
  }));

  // Work on a list without "free" blocks; we rebuild them later.
  let working = raw.filter(b => b.type !== "free");

  // Resolve the exact subtask we should schedule (handles parent/part confusion).
  const allTasks: Task[] = getItem("tasks") || [];
  const sub = getCanonicalSubtask(task, allTasks);

  // Minutes still required for THIS subtask only.
  const alreadyScheduledForThis = working
    .filter(b => b.type === "task" && b.taskId === sub.id && b.startDate && b.endDate)
    .reduce((m, b) => m + minutesBetween(b.startDate!, b.endDate!), 0);

  const totalNeeded = Math.round((sub.estimatedTime || 0) * 60);
  const required = Math.max(0, totalNeeded - alreadyScheduledForThis);

  // Nothing left → clean up unscheduled cache and return.
  if (required <= 0) {
    const remaining: Task[] = (getItem("unscheduledTasksCache") || []).filter((t: Task) => {
      // Remove either the exact subtask OR a parent entry that points to this parent.
      if (t.id === sub.id) return false;
      if (sub.parentId && t.id === sub.parentId) return false;
      return true;
    });
    setItem("unscheduledTasksCache", remaining);
    return { blocks: raw, success: true };
  }

  // Day bounds
  const base = new Date();
  const wake = parseTime(prefs.wakeUp, base);
  const sleep = normalizeSleep(wake, parseTime(prefs.sleep, base));
  const nowRounded = roundToNext15Minutes(new Date());

  // Find free windows inside the day
  const windows = freeWindows(working, wake, sleep, nowRounded);

  // Try a direct fit first
  const fit = windows.find(w => minutesBetween(w.start, w.end) >= required);
  const place = (start: Date, mins: number) => {
    const end = addMinutes(start, mins);

    // Remove any other blocks for the same subtask (dedupe)
    working = working.filter(b => !(b.type === "task" && b.taskId === sub.id));

    working.push({
      title: sub.title,
      type: "task",
      taskId: sub.id,          // <— tie block to the *subtask id*
      start: formatTime(start),
      end: formatTime(end),
      startDate: start,
      endDate: end,
      manual: true,
    });

    const final = dedupeByTaskId(fillFreeGaps(working, wake, sleep));
    final.sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

    setItem("autoScheduleCache", final);
    setItem("autoScheduleGeneratedOn", new Date().toISOString().split("T")[0]);

    // Remove from unscheduled cache (by subtask or parent)
    const remaining: Task[] = (getItem("unscheduledTasksCache") || []).filter((t: Task) => {
      if (t.id === sub.id) return false;
      if (sub.parentId && t.id === sub.parentId) return false;
      return true;
    });
    setItem("unscheduledTasksCache", remaining);

    return final;
  };

  if (fit) {
    const start = roundToNext15Minutes(
      new Date(Math.max(fit.start.getTime(), nowRounded.getTime()))
    );
    const final = place(start, required);
    return { blocks: final, success: true };
  }

  // Not enough space in one window → try shrinking breaks to create room
  const largest = windows.reduce((mx, w) => Math.max(mx, minutesBetween(w.start, w.end)), 0);
  const deficit = required - largest;
  const totalBreak = working
    .filter(b => b.type === "break")
    .reduce((s, b) => s + minutesBetween(b.startDate!, b.endDate!), 0);

  if (deficit > totalBreak) {
    return { blocks: raw, success: false };
  }

  const ok = shrinkBreaksProportionally(working, deficit).ok;
  if (!ok) return { blocks: raw, success: false };

  const windowsAfter = freeWindows(working, wake, sleep, nowRounded);
  const fit2 = windowsAfter.find(w => minutesBetween(w.start, w.end) >= required);
  if (!fit2) return { blocks: raw, success: false };

  const start2 = roundToNext15Minutes(
    new Date(Math.max(fit2.start.getTime(), nowRounded.getTime()))
  );
  const final = place(start2, required);
  return { blocks: final, success: true };
}

