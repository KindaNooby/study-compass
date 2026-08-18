import type { Availability, ExamGoal, LearningObjective } from "./types";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function uniqueSorted(arr: number[]): number[] {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function uniqueSortedStrings(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

/** Adds whole days to a local YYYY-MM-DD key, rolling months/years correctly. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}

/** A rolling window of consecutive local date keys starting at `startKey`. */
export function nextDateKeys(startKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDaysToDateKey(startKey, index));
}

export function formatDateKey(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

/** Sorts, dedupes, clamps, and drops invalid time windows. Pure and idempotent. */
export function normalizeAvailability(input: Availability): Availability {
  return {
    ...input,
    availableDays: uniqueSorted(input.availableDays),
    restDays: uniqueSorted(input.restDays),
    unavailableDates: uniqueSortedStrings(input.unavailableDates),
    timeWindows: input.timeWindows
      .filter((window) => window.start < window.end)
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
    fixedCommitments: [...input.fixedCommitments]
      .filter((commitment) => commitment.start < commitment.end)
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
    energyByTimeOfDay: {
      morning: clamp01(input.energyByTimeOfDay.morning),
      afternoon: clamp01(input.energyByTimeOfDay.afternoon),
      evening: clamp01(input.energyByTimeOfDay.evening),
      night: clamp01(input.energyByTimeOfDay.night),
    },
  };
}

export function isAvailabilityConfigured(availability: Availability): boolean {
  return availability.availableDays.length > 0 && availability.maxDailyStudyMinutes > 0;
}

/**
 * Orders objectives so prerequisites come before dependents (Kahn's algorithm).
 * Returns learning levels plus any objectives stuck in a cycle.
 */
export function prerequisiteOrder(objectives: LearningObjective[]): {
  levels: string[][];
  cyclic: string[];
} {
  const ids = new Set(objectives.map((objective) => objective.id));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const objective of objectives) {
    indegree.set(objective.id, 0);
    dependents.set(objective.id, []);
  }

  for (const objective of objectives) {
    for (const prerequisite of objective.prerequisiteIds) {
      if (!ids.has(prerequisite)) continue;
      indegree.set(objective.id, (indegree.get(objective.id) ?? 0) + 1);
      dependents.get(prerequisite)?.push(objective.id);
    }
  }

  const queue = objectives
    .filter((objective) => (indegree.get(objective.id) ?? 0) === 0)
    .map((objective) => objective.id);
  const levels: string[][] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const level = [...queue];
    queue.length = 0;
    levels.push(level);
    for (const id of level) {
      visited.add(id);
      for (const dependent of dependents.get(id) ?? []) {
        const next = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, next);
        if (next === 0) queue.push(dependent);
      }
    }
  }

  const cyclic = objectives.filter((objective) => !visited.has(objective.id)).map(
    (objective) => objective.id,
  );

  return { levels, cyclic };
}

/** Returns the full transitive set of prerequisites for an objective. */
export function allPrerequisites(
  objectiveId: string,
  objectives: LearningObjective[],
): string[] {
  const byId = new Map(objectives.map((objective) => [objective.id, objective]));
  const result = new Set<string>();
  const stack = [...(byId.get(objectiveId)?.prerequisiteIds ?? [])];

  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || result.has(id)) continue;
    result.add(id);
    const objective = byId.get(id);
    if (objective) stack.push(...objective.prerequisiteIds);
  }

  return Array.from(result);
}

/** The next upcoming exam goal by date, or undefined when nothing is scheduled ahead. */
export function nextExam(goals: ExamGoal[], now = new Date()): ExamGoal | undefined {
  const today = todayKey(now);
  return goals
    .filter((goal) => goal.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
}
