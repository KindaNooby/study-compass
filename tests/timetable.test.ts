import { describe, expect, test } from "bun:test";

import { emptyAvailability } from "../src/lib/planner/db";
import type { PlannedActivity } from "../src/lib/planner/plan";
import {
  DEFAULT_STUDY_WINDOW,
  minutesToTime,
  placePlannedActivities,
  placeTimetable,
  snapActivity,
  studyWindowsForWeekday,
  timeToMinutes,
  TIME_OF_DAY_WINDOWS,
} from "../src/lib/planner/timetable";
import type { Availability } from "../src/lib/planner/types";

function availability(overrides: Partial<Availability> = {}): Availability {
  return { ...emptyAvailability(), ...overrides };
}

describe("time helpers", () => {
  test("converts HH:MM to minutes and back", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(0)).toBe("00:00");
  });
});

describe("studyWindowsForWeekday", () => {
  test("uses explicit time windows for the weekday", () => {
    const a = availability({
      timeWindows: [
        { day: 1, start: "09:00", end: "10:00" },
        { day: 2, start: "14:00", end: "15:00" },
      ],
    });
    expect(studyWindowsForWeekday(a, 1)).toEqual([{ start: "09:00", end: "10:00" }]);
    expect(studyWindowsForWeekday(a, 2)).toEqual([{ start: "14:00", end: "15:00" }]);
  });

  test("derives windows from preferred study times when none are explicit", () => {
    const a = availability({ preferredStudyTimes: ["morning", "night"] });
    expect(studyWindowsForWeekday(a, 1)).toEqual([
      TIME_OF_DAY_WINDOWS.morning,
      TIME_OF_DAY_WINDOWS.night,
    ]);
  });

  test("falls back to the default window", () => {
    const a = availability();
    expect(studyWindowsForWeekday(a, 1)).toEqual([{ ...DEFAULT_STUDY_WINDOW }]);
  });
});

describe("placeTimetable", () => {
  test("places activities chronologically inside configured windows", () => {
    const result = placeTimetable({
      date: "2026-08-17", // Monday
      activities: [
        { id: "a", plannedMinutes: 30 },
        { id: "b", plannedMinutes: 45 },
      ],
      availability: availability({
        timeWindows: [{ day: 1, start: "09:00", end: "10:30" }],
      }),
    });
    expect(result.placed).toEqual([
      { activityId: "a", start: "09:00", end: "09:30", placedMinutes: 30 },
      { activityId: "b", start: "09:30", end: "10:15", placedMinutes: 45 },
    ]);
    expect(result.unplaced).toEqual([]);
  });

  test("carves fixed commitments out of the free time", () => {
    const result = placeTimetable({
      date: "2026-08-17",
      activities: [{ id: "a", plannedMinutes: 60 }],
      availability: availability({
        timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
        fixedCommitments: [{ id: "c", day: 1, start: "10:00", end: "11:00", label: "Class" }],
      }),
    });
    expect(result.placed).toEqual([
      { activityId: "a", start: "09:00", end: "10:00", placedMinutes: 60 },
    ]);
  });

  test("marks work that doesn't fit any window as unplaced", () => {
    const result = placeTimetable({
      date: "2026-08-17",
      activities: [{ id: "a", plannedMinutes: 90 }],
      availability: availability({
        timeWindows: [{ day: 1, start: "09:00", end: "10:00" }],
      }),
    });
    expect(result.placed).toEqual([]);
    expect(result.unplaced).toEqual([{ activityId: "a", minutes: 90 }]);
  });

  test("returns remaining free gaps after placement", () => {
    const result = placeTimetable({
      date: "2026-08-17",
      activities: [{ id: "a", plannedMinutes: 30 }],
      availability: availability({
        timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
      }),
    });
    expect(result.free).toEqual([{ start: "09:30", end: "11:00" }]);
  });

  test("treats occupied blocks as already taken", () => {
    const result = placeTimetable({
      date: "2026-08-17",
      activities: [{ id: "b", plannedMinutes: 30 }],
      availability: availability({
        timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
      }),
      occupied: [{ start: "09:00", end: "09:30" }],
    });
    expect(result.placed).toEqual([
      { activityId: "b", start: "09:30", end: "10:00", placedMinutes: 30 },
    ]);
  });
});

describe("snapActivity", () => {
  test("snaps to the requested start inside a free block", () => {
    expect(
      snapActivity({
        date: "2026-08-17",
        minutes: 30,
        requestedStart: "09:15",
        availability: availability({
          timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
        }),
      }),
    ).toEqual({ start: "09:15", end: "09:45" });
  });

  test("pushes past occupied blocks to the next free slot", () => {
    expect(
      snapActivity({
        date: "2026-08-17",
        minutes: 30,
        requestedStart: "09:00",
        availability: availability({
          timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
        }),
        occupied: [{ start: "09:00", end: "10:00" }],
      }),
    ).toEqual({ start: "10:00", end: "10:30" });
  });

  test("respects fixed commitments when snapping", () => {
    expect(
      snapActivity({
        date: "2026-08-17",
        minutes: 30,
        requestedStart: "09:30",
        availability: availability({
          timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
          fixedCommitments: [{ id: "c", day: 1, start: "10:00", end: "11:00", label: "Class" }],
        }),
      }),
    ).toEqual({ start: "09:30", end: "10:00" });
  });

  test("returns null when the activity fits no single free block", () => {
    expect(
      snapActivity({
        date: "2026-08-17",
        minutes: 120,
        requestedStart: "09:00",
        availability: availability({
          timeWindows: [{ day: 1, start: "09:00", end: "10:00" }],
        }),
      }),
    ).toBeNull();
  });

  test("returns null when the requested start is after every window", () => {
    expect(
      snapActivity({
        date: "2026-08-17",
        minutes: 30,
        requestedStart: "22:00",
        availability: availability({
          timeWindows: [{ day: 1, start: "09:00", end: "10:00" }],
        }),
      }),
    ).toBeNull();
  });
});

describe("placePlannedActivities", () => {
  test("returns clock placements keyed by stable activity key", () => {
    const planned: PlannedActivity[] = [
      {
        date: "2026-08-17",
        kind: "learn_new_content",
        objectiveIds: ["o1"],
        subjectId: "s1",
        plannedMinutes: 30,
        purpose: "learning",
        score: 0.8,
        reasons: ["test"],
      },
      {
        date: "2026-08-17",
        kind: "mcq_practise",
        objectiveIds: ["o1"],
        subjectId: "s1",
        questionType: "mcq",
        plannedMinutes: 30,
        purpose: "application",
        score: 0.7,
        reasons: ["test"],
      },
    ];
    const placements = placePlannedActivities(
      planned,
      availability({ timeWindows: [{ day: 1, start: "09:00", end: "10:00" }] }),
    );
    expect(placements.get("2026-08-17|learn_new_content|s1|o1")).toEqual({
      start: "09:00",
      end: "09:30",
    });
    expect(placements.size).toBe(2);
  });
});
