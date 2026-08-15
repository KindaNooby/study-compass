import { describe, expect, test } from "bun:test";

import {
  allPrerequisites,
  isAvailabilityConfigured,
  normalizeAvailability,
  prerequisiteOrder,
  toDateKey,
} from "../src/lib/planner/selectors";
import { emptyAvailability } from "../src/lib/planner/db";
import type { LearningObjective } from "../src/lib/planner/types";

describe("toDateKey", () => {
  test("formats dates with zero padding", () => {
    expect(toDateKey(new Date(2026, 7, 15))).toBe("2026-08-15");
    expect(toDateKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("normalizeAvailability", () => {
  test("sorts and dedupes days, clamps energy, drops invalid windows", () => {
    const base = emptyAvailability();
    const normalized = normalizeAvailability({
      ...base,
      availableDays: [5, 1, 5, 3],
      restDays: [6, 0, 6],
      timeWindows: [
        { day: 2, start: "09:00", end: "10:00" },
        { day: 2, start: "10:00", end: "09:00" }, // invalid, dropped
        { day: 1, start: "08:00", end: "08:30" },
      ],
      energyByTimeOfDay: { morning: 1.4, afternoon: -0.2, evening: 0.5, night: 0.8 },
    });

    expect(normalized.availableDays).toEqual([1, 3, 5]);
    expect(normalized.restDays).toEqual([0, 6]);
    expect(normalized.timeWindows).toEqual([
      { day: 1, start: "08:00", end: "08:30" },
      { day: 2, start: "09:00", end: "10:00" },
    ]);
    expect(normalized.energyByTimeOfDay).toEqual({
      morning: 1,
      afternoon: 0,
      evening: 0.5,
      night: 0.8,
    });
  });

  test("is idempotent", () => {
    const base = emptyAvailability();
    const once = normalizeAvailability({ ...base, availableDays: [3, 1, 3, 2] });
    expect(normalizeAvailability(once)).toEqual(once);
  });
});

describe("isAvailabilityConfigured", () => {
  test("requires at least one day and a daily limit", () => {
    const base = emptyAvailability();
    expect(isAvailabilityConfigured(base)).toBe(false);
    expect(isAvailabilityConfigured({ ...base, availableDays: [1] })).toBe(false);
    expect(
      isAvailabilityConfigured({ ...base, availableDays: [1], maxDailyStudyMinutes: 60 }),
    ).toBe(true);
  });
});

describe("prerequisiteOrder", () => {
  test("returns objectives in learning levels", () => {
    const objectives: LearningObjective[] = [
      objective("a", []),
      objective("b", ["a"]),
      objective("c", ["a", "b"]),
      objective("d", ["c"]),
    ];

    const { levels, cyclic } = prerequisiteOrder(objectives);
    expect(cyclic).toEqual([]);
    expect(levels).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  test("reports objectives stuck in a cycle", () => {
    const objectives: LearningObjective[] = [
      objective("a", ["b"]),
      objective("b", ["a"]),
      objective("c", []),
    ];

    const { levels, cyclic } = prerequisiteOrder(objectives);
    expect(levels).toEqual([["c"]]);
    expect(cyclic.sort()).toEqual(["a", "b"]);
  });
});

describe("allPrerequisites", () => {
  test("collects the transitive prerequisite chain", () => {
    const objectives: LearningObjective[] = [
      objective("a", []),
      objective("b", ["a"]),
      objective("c", ["b"]),
    ];

    expect(allPrerequisites("c", objectives).sort()).toEqual(["a", "b"]);
    expect(allPrerequisites("a", objectives)).toEqual([]);
  });
});

function objective(id: string, prerequisiteIds: string[]): LearningObjective {
  return {
    id,
    subjectId: "s",
    topicId: "t",
    title: id,
    importance: 0.5,
    estimatedLearningMinutes: 30,
    estimatedPracticeMinutes: 30,
    prerequisiteIds,
    questionTypes: ["mcq"],
  };
}
