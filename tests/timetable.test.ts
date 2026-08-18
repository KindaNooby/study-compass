import { describe, expect, test } from "bun:test";

import { emptyAvailability } from "../src/lib/planner/db";
import type { PlannedActivity } from "../src/lib/planner/plan";
import {
  buildDayTimetable,
  DEFAULT_STUDY_WINDOW,
  minutesToTime,
  occupiedBlocksForDate,
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

describe("occupiedBlocksForDate", () => {
  test("collects placed rows on the date and excludes the moved row itself", () => {
    expect(
      occupiedBlocksForDate(
        [
          { id: "a", date: "2026-08-17", start: "09:00", end: "09:30" },
          { id: "b", date: "2026-08-17", start: "10:00", end: "10:30" },
          { id: "c", date: "2026-08-18", start: "09:00", end: "09:30" },
          { id: "d", date: "2026-08-17" },
        ],
        "2026-08-17",
        "b",
      ),
    ).toEqual([{ start: "09:00", end: "09:30" }]);
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

describe("buildDayTimetable", () => {
  test("places unplaced work into the first window and keeps commitments", () => {
    const result = buildDayTimetable({
      date: "2026-08-17", // Monday
      activities: [{ id: "a", date: "2026-08-17", plannedMinutes: 30 }],
      availability: availability({
        availableDays: [1],
        timeWindows: [{ day: 1, start: "09:00", end: "11:00" }],
        fixedCommitments: [{ id: "c", day: 1, start: "10:00", end: "11:00", label: "Class" }],
      }),
    });

    expect(result.isStudyDay).toBe(true);
    expect(result.dayStart).toBe(540);
    expect(result.dayEnd).toBe(660);
    expect(result.entries).toEqual([
      { start: 540, end: 570, type: "activity", activityId: "a" },
      { start: 600, end: 660, type: "commitment", label: "Class" },
    ]);
    expect(result.unplaced).toEqual([]);
    expect(result.totalMinutes).toBe(30);
  });

  test("keeps already-placed rows and reports overflow as unplaced", () => {
    const result = buildDayTimetable({
      date: "2026-08-17",
      activities: [
        { id: "a", date: "2026-08-17", plannedMinutes: 30, start: "09:00", end: "09:30" },
        { id: "b", date: "2026-08-17", plannedMinutes: 120 },
      ],
      availability: availability({
        availableDays: [1],
        timeWindows: [{ day: 1, start: "09:00", end: "10:00" }],
      }),
    });

    expect(result.entries).toEqual([
      { start: 540, end: 570, type: "activity", activityId: "a" },
    ]);
    expect(result.unplaced).toEqual([{ activityId: "b", minutes: 120 }]);
  });

  test("flags non-study days", () => {
    const result = buildDayTimetable({
      date: "2026-08-17",
      activities: [],
      availability: availability(),
    });

    expect(result.isStudyDay).toBe(false);
    expect(result.entries).toEqual([]);
  });

  test("counts completed minutes over planned when present", () => {
    const result = buildDayTimetable({
      date: "2026-08-17",
      activities: [
        { id: "a", date: "2026-08-17", plannedMinutes: 60, completedMinutes: 40 },
        { id: "b", date: "2026-08-17", plannedMinutes: 30 },
      ],
      availability: availability({ availableDays: [1] }),
    });

    expect(result.totalMinutes).toBe(70);
  });
});
