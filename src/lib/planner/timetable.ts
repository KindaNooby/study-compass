import { weekdayOfDateKey } from "./measurement";
import type { Availability, TimeOfDay } from "./types";

/**
 * The timetable is a pure projection: given a study day's scheduled activities
 * and the student's availability, it places each activity into concrete clock
 * slots inside the configured time windows (minus fixed commitments). It never
 * mutates inputs and is deterministic for identical inputs.
 */

/** Fallback study block when neither time windows nor preferred times are set. */
export const DEFAULT_STUDY_WINDOW = { start: "09:00", end: "17:00" } as const;

/** Default clock ranges for each preferred time-of-day, used to derive windows. */
export const TIME_OF_DAY_WINDOWS: Record<TimeOfDay, { start: string; end: string }> = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "21:00" },
  night: { start: "21:00", end: "23:00" },
};

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Minutes since midnight, inclusive start and exclusive end. */
type Range = { start: number; end: number };

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of sorted) {
    if (range.end <= range.start) continue;
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function subtractRanges(base: Range[], blocked: Range[]): Range[] {
  const cuts = mergeRanges(blocked);
  const result: Range[] = [];
  for (const range of mergeRanges(base)) {
    let cursor = range.start;
    for (const cut of cuts) {
      if (cut.end <= cursor) continue;
      if (cut.start >= range.end) break;
      if (cut.start > cursor) result.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
    }
    if (cursor < range.end) result.push({ start: cursor, end: range.end });
  }
  return result;
}

/**
 * The study blocks available on a weekday, in chronological order:
 * explicit time windows for that day → derived from preferred study times →
 * the default 9–5 block.
 */
export function studyWindowsForWeekday(
  availability: Availability,
  weekday: number,
): { start: string; end: string }[] {
  const explicit = availability.timeWindows
    .filter((window) => window.day === weekday)
    .map((window) => ({ start: window.start, end: window.end }))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (explicit.length > 0) return explicit;

  const derived = availability.preferredStudyTimes
    .map((time) => TIME_OF_DAY_WINDOWS[time])
    .sort((a, b) => a.start.localeCompare(b.start));
  if (derived.length > 0) return derived;

  return [{ ...DEFAULT_STUDY_WINDOW }];
}

/** Study windows for a weekday with the day's fixed commitments removed. */
export function freeRangesForWeekday(availability: Availability, weekday: number): Range[] {
  const windows = studyWindowsForWeekday(availability, weekday).map((window) => ({
    start: timeToMinutes(window.start),
    end: timeToMinutes(window.end),
  }));
  const commitments = availability.fixedCommitments
    .filter((commitment) => commitment.day === weekday)
    .map((commitment) => ({
      start: timeToMinutes(commitment.start),
      end: timeToMinutes(commitment.end),
    }));
  return subtractRanges(windows, commitments);
}

export type PlacedBlock = {
  activityId: string;
  start: string; // HH:MM
  end: string; // HH:MM
  placedMinutes: number;
};

export type UnplacedBlock = {
  activityId: string;
  minutes: number;
};

export type TimetableResult = {
  placed: PlacedBlock[];
  unplaced: UnplacedBlock[];
  /** Free time left after placement, for rendering gaps. */
  free: { start: string; end: string }[];
};

/**
 * Packs a day's activities into the first free slots that fit, in input order.
 * Activities are not split across commitments: one row stays one contiguous
 * block, and anything too large for any single free block is reported as
 * unplaced (an honest "this doesn't fit your windows" signal). Callers should
 * only invoke this for study days (see `isStudyDay` in the planner).
 */
export function placeTimetable(input: {
  date: string;
  activities: { id: string; plannedMinutes: number }[];
  availability: Availability;
}): TimetableResult {
  const weekday = weekdayOfDateKey(input.date);
  const free = freeRangesForWeekday(input.availability, weekday);

  const placed: PlacedBlock[] = [];
  const unplaced: UnplacedBlock[] = [];

  for (const activity of input.activities) {
    const minutes = Math.max(0, Math.round(activity.plannedMinutes));
    if (minutes <= 0) continue;

    let fit = false;
    for (const range of free) {
      if (range.end - range.start < minutes) continue;
      placed.push({
        activityId: activity.id,
        start: minutesToTime(range.start),
        end: minutesToTime(range.start + minutes),
        placedMinutes: minutes,
      });
      range.start += minutes;
      fit = true;
      break;
    }
    if (!fit) unplaced.push({ activityId: activity.id, minutes });
  }

  const remaining = free
    .filter((range) => range.end - range.start > 0)
    .map((range) => ({ start: minutesToTime(range.start), end: minutesToTime(range.end) }));

  return { placed, unplaced, free: remaining };
}
