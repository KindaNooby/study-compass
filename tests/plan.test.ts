import { describe, expect, test } from "bun:test";

import { emptyAvailability } from "../src/lib/planner/db";
import { observeCapacity } from "../src/lib/planner/measurement";
import {
  effectiveDailyMinutes,
  forecastDueReviews,
  nextStudyDayAfter,
  planStudy,
  replacementCandidates,
  stableActivityKey,
  urgencyForDate,
  type PlanState,
} from "../src/lib/planner/plan";
import type {
  Availability,
  ExamGoal,
  FsrsCard,
  LearningObjective,
  SessionLog,
  StudyActivity,
} from "../src/lib/planner/types";

const NOW = new Date(2026, 7, 16, 10, 0, 0);

function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

function makeObjective(overrides: Partial<LearningObjective> = {}): LearningObjective {
  return {
    id: "o1",
    subjectId: "s1",
    topicId: "t1",
    title: "Objective 1",
    importance: 0.8,
    estimatedLearningMinutes: 60,
    estimatedPracticeMinutes: 60,
    prerequisiteIds: [],
    questionTypes: ["mcq"],
    ...overrides,
  };
}

function makeGoal(overrides: Partial<ExamGoal> = {}): ExamGoal {
  return {
    id: "g1",
    name: "Certification",
    examDate: "2026-08-30",
    subjectIds: ["s1"],
    topicPriorities: { t1: 0.5 },
    optionalTopicIds: [],
    subjectWeighting: { s1: 1 },
    externalDeadlines: [],
    ...overrides,
  };
}

function makeAvailability(overrides: Partial<Availability> = {}): Availability {
  return {
    ...emptyAvailability(),
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    maxDailyStudyMinutes: 120,
    preferredSessionMinutes: 30,
    ...overrides,
  };
}

function makeCard(overrides: Partial<FsrsCard> = {}): FsrsCard {
  return {
    id: "c1",
    objectiveId: "o1",
    front: "front",
    back: "back",
    due: localIso(2026, 7, 16, 8),
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: "New",
    lastReview: null,
    suspended: false,
    createdAt: localIso(2026, 7, 1),
    ...overrides,
  };
}

function session(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: "s",
    date: "2026-08-10",
    objectiveIds: [],
    plannedMinutes: 60,
    actualMinutes: 45,
    status: "completed",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<StudyActivity> = {}): StudyActivity {
  return {
    id: "a1",
    examGoalId: "g1",
    date: "2026-08-17",
    kind: "learn_new_content",
    objectiveIds: ["o1"],
    subjectId: "s1",
    plannedMinutes: 30,
    purpose: "learning",
    status: "planned",
    source: "planner",
    pinned: true,
    ...overrides,
  };
}

function makeState(overrides: Partial<PlanState> = {}): PlanState {
  return {
    objectives: [],
    cards: [],
    attempts: [],
    reviewLogs: [],
    sessionLogs: [],
    examGoals: [],
    availability: makeAvailability(),
    now: NOW,
    ...overrides,
  };
}

describe("urgencyForDate", () => {
  test("peaks at the exam and decays with distance", () => {
    expect(urgencyForDate("2026-08-16", NOW)).toBe(1);
    expect(urgencyForDate("2026-09-15", NOW)).toBeCloseTo(0.5, 5);
    expect(urgencyForDate("2026-08-10", NOW)).toBe(1); // past exam stays urgent
  });
});

describe("effectiveDailyMinutes", () => {
  const weekdays = makeAvailability({ availableDays: [1, 2, 3, 4, 5] });

  test("returns zero on non-study days", () => {
    expect(effectiveDailyMinutes("2026-08-16", weekdays, observeCapacity({ sessionLogs: [], attempts: [] }))).toBe(0);
  });

  test("uses the planned cap with no evidence", () => {
    const capacity = observeCapacity({ sessionLogs: [], attempts: [] });
    expect(effectiveDailyMinutes("2026-08-17", weekdays, capacity)).toBe(120);
  });

  test("blends toward observed minutes as evidence grows", () => {
    const capacity = observeCapacity({
      sessionLogs: [
        session({ date: "2026-08-10", actualMinutes: 45 }),
        session({ date: "2026-08-11", actualMinutes: 45 }),
      ],
      attempts: [],
    });
    // evidence = 2/5 -> 45 * 0.4 + 120 * 0.6 = 90
    expect(effectiveDailyMinutes("2026-08-17", weekdays, capacity)).toBe(90);
  });
});

describe("forecastDueReviews", () => {
  test("buckets overdue cards to today and excludes new/suspended cards", () => {
    const cards = [
      makeCard({ id: "overdue", state: "Review", stability: 1, due: localIso(2026, 7, 15, 9) }),
      makeCard({ id: "future", state: "Review", stability: 1, due: localIso(2026, 7, 18, 9) }),
      makeCard({ id: "new", state: "New" }),
      makeCard({ id: "suspended", state: "Review", stability: 1, suspended: true, due: localIso(2026, 7, 15, 9) }),
    ];
    const forecast = forecastDueReviews(cards, 30, NOW, "2026-08-23");
    expect(forecast).toHaveLength(8);
    expect(forecast[0].date).toBe("2026-08-16");
    expect(forecast[0].cardCount).toBe(1);
    expect(forecast[0].objectiveIds).toEqual(["o1"]);
    expect(forecast[2].date).toBe("2026-08-18");
    expect(forecast[2].cardCount).toBe(1);
  });
});

describe("nextStudyDayAfter", () => {
  test("returns the next study day, skipping rest days", () => {
    expect(nextStudyDayAfter("2026-08-17", makeAvailability({ availableDays: [1, 3] }))).toBe(
      "2026-08-19",
    );
  });

  test("returns the immediately following day when it is a study day", () => {
    expect(nextStudyDayAfter("2026-08-17", makeAvailability({ availableDays: [1, 2] }))).toBe(
      "2026-08-18",
    );
  });

  test("returns null when no study day follows within a week", () => {
    expect(nextStudyDayAfter("2026-08-17", makeAvailability({ availableDays: [] }))).toBeNull();
  });
});

describe("replacementCandidates", () => {
  test("ranks other objectives and excludes the current slot's work", () => {
    const state = makeState({
      objectives: [
        makeObjective({ id: "o1", title: "Alpha", importance: 0.9 }),
        makeObjective({ id: "o2", title: "Beta", importance: 0.6 }),
        makeObjective({ id: "o3", title: "Gamma", importance: 0.3 }),
      ],
      examGoals: [makeGoal()],
    });

    const candidates = replacementCandidates({
      state,
      current: { kind: "learn_new_content", objectiveIds: ["o1"] },
    });

    expect(candidates.map((candidate) => candidate.objectiveId)).toEqual(["o2", "o3"]);
    expect(candidates[0].kind).toBe("learn_new_content");
  });

  test("returns no candidates when nothing else is available", () => {
    const state = makeState({
      objectives: [makeObjective({ id: "o1" })],
      examGoals: [makeGoal()],
    });

    expect(
      replacementCandidates({ state, current: { kind: "learn_new_content", objectiveIds: ["o1"] } }),
    ).toEqual([]);
  });
});

describe("stableActivityKey", () => {
  test("is stable regardless of objective order", () => {
    const a = stableActivityKey({ date: "2026-08-17", kind: "learn_new_content", objectiveIds: ["b", "a"], subjectId: "s1" });
    const b = stableActivityKey({ date: "2026-08-17", kind: "learn_new_content", objectiveIds: ["a", "b"], subjectId: "s1" });
    expect(a).toBe(b);
  });

  test("distinguishes kind and date", () => {
    const base = { date: "2026-08-17", kind: "learn_new_content" as const, objectiveIds: ["a"], subjectId: "s1" };
    expect(stableActivityKey(base)).not.toBe(stableActivityKey({ ...base, kind: "mcq_practise" }));
    expect(stableActivityKey(base)).not.toBe(stableActivityKey({ ...base, date: "2026-08-18" }));
  });
});

describe("planStudy", () => {
  test("is deterministic for identical inputs", () => {
    const state = makeState({
      objectives: [makeObjective()],
      examGoals: [makeGoal()],
    });
    expect(planStudy(state)).toEqual(planStudy(state));
  });

  test("blocks dependents whose prerequisites aren't practised", () => {
    const state = makeState({
      objectives: [
        makeObjective({ id: "a", importance: 0.9 }),
        makeObjective({ id: "b", prerequisiteIds: ["a"] }),
      ],
      examGoals: [makeGoal()],
    });
    const plan = planStudy(state);
    expect(plan.blockedObjectives.map((blocked) => blocked.objectiveId)).toContain("b");
    expect(plan.blockedObjectives.find((blocked) => blocked.objectiveId === "b")?.missingPrerequisites).toEqual(["a"]);

    const learnIds = plan.days
      .flatMap((day) => day.activities)
      .filter((activity) => activity.kind === "learn_new_content")
      .map((activity) => activity.objectiveIds[0]);
    expect(learnIds.length).toBeGreaterThan(0);
    expect(learnIds.every((id) => id === "a")).toBe(true);
  });

  test("schedules due reviews before flexible work", () => {
    const state = makeState({
      objectives: [makeObjective()],
      cards: [
        makeCard({
          state: "Review",
          stability: 1,
          due: localIso(2026, 7, 16, 8),
          lastReview: localIso(2026, 7, 10),
        }),
      ],
      examGoals: [makeGoal()],
    });
    const plan = planStudy(state);
    const day0 = plan.days[0];
    expect(day0.activities.length).toBeGreaterThan(0);
    expect(day0.activities[0].kind).toBe("fsrs_review");
  });

  test("reports a shortfall when required work exceeds available time", () => {
    const state = makeState({
      objectives: [makeObjective({ estimatedLearningMinutes: 600, estimatedPracticeMinutes: 600 })],
      examGoals: [makeGoal({ examDate: "2026-08-18" })],
      availability: makeAvailability({ availableDays: [1], maxDailyStudyMinutes: 30 }),
    });
    const plan = planStudy(state);
    expect(plan.feasibility.achievable).toBe(false);
    expect(plan.feasibility.shortfallMinutes).toBeGreaterThan(0);
    expect(plan.feasibility.workloadCoverage).toBeLessThan(1);
  });

  test("materializes at most seven days", () => {
    const state = makeState({
      objectives: [makeObjective()],
      examGoals: [makeGoal({ examDate: "2026-09-30" })],
    });
    const plan = planStudy(state);
    expect(plan.days).toHaveLength(7);
  });
});

describe("planStudy progress and reservations", () => {
  test("completed learning minutes are not recommended again", () => {
    const state = makeState({
      objectives: [makeObjective({ estimatedLearningMinutes: 60 })],
      examGoals: [makeGoal()],
      activities: [
        makeActivity({
          pinned: false,
          status: "completed",
          completedMinutes: 30,
        }),
      ],
    });
    const plan = planStudy(state);
    const learningMinutes = plan.days
      .flatMap((day) => day.activities)
      .filter((activity) => activity.kind === "learn_new_content")
      .reduce((sum, activity) => sum + activity.plannedMinutes, 0);
    expect(learningMinutes).toBe(30);
  });

  test("pinned work reserves its day and is not double-booked", () => {
    const state = makeState({
      objectives: [makeObjective({ estimatedLearningMinutes: 60 })],
      examGoals: [makeGoal()],
      activities: [
        makeActivity({
          date: "2026-08-17",
          plannedMinutes: 30,
          pinned: true,
        }),
      ],
    });
    const plan = planStudy(state);
    const pinnedDay = plan.days.find((day) => day.date === "2026-08-17");
    expect(pinnedDay?.pinnedMinutes).toBe(30);
    expect(pinnedDay?.pinnedActivities).toHaveLength(1);

    const learningMinutes = plan.days
      .flatMap((day) => day.activities)
      .filter((activity) => activity.kind === "learn_new_content")
      .reduce((sum, activity) => sum + activity.plannedMinutes, 0);
    expect(learningMinutes).toBe(30);
  });
});
