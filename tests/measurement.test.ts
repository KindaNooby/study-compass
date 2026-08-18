import { describe, expect, test } from "bun:test";

import { applyReview, emptyCardState, isDue, isDueByDay, retrievability } from "../src/lib/planner/fsrs";
import {
  acquisitionLevel,
  errorBreakdown,
  measureObjective,
  observeCapacity,
  shrinkAccuracy,
  summarizeMcq,
  summarizeStructured,
} from "../src/lib/planner/measurement";
import type {
  FsrsCard,
  PracticeAttempt,
  ReviewLog,
  SessionLog,
} from "../src/lib/planner/types";

const NOW = new Date("2026-08-16T10:00:00.000Z");

function makeCard(overrides: Partial<FsrsCard> = {}): FsrsCard {
  return {
    id: "c1",
    objectiveId: "o1",
    front: "front",
    back: "back",
    ...emptyCardState(NOW),
    suspended: false,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function attempt(overrides: Partial<PracticeAttempt> = {}): PracticeAttempt {
  return {
    id: "a",
    questionId: null,
    objectiveId: "o1",
    kind: "mcq",
    correct: false,
    score: null,
    maxScore: null,
    timeSeconds: 30,
    difficulty: 0.5,
    errorCategoryId: null,
    attemptedAt: NOW.toISOString(),
    ...overrides,
  };
}

function session(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: "s",
    date: "2026-08-10",
    objectiveIds: [],
    plannedMinutes: 60,
    actualMinutes: 30,
    status: "completed",
    ...overrides,
  };
}

describe("fsrs wrapper", () => {
  test("grading a new card returns a valid next state and log", () => {
    const result = applyReview(makeCard(), "Good", NOW);
    expect(result.card.state).not.toBe("New");
    expect(result.log.grade).toBe("Good");
    expect(result.log.state).toBe(result.card.state);
    expect(new Date(result.log.due).getTime()).toBeGreaterThan(NOW.getTime());
    expect(result.log.stability).toBeGreaterThan(0);
  });

  test("applyReview is deterministic for the same card and time", () => {
    const card = makeCard();
    expect(applyReview(card, "Good", NOW)).toEqual(applyReview(card, "Good", NOW));
  });

  test("new cards have full retrievability", () => {
    expect(retrievability(makeCard(), NOW)).toBe(1);
  });

  test("reviewed cards report retrievability in [0, 1]", () => {
    const reviewed = applyReview(makeCard(), "Good", NOW).card;
    const later = new Date("2026-08-17T10:00:00.000Z");
    const value = retrievability(reviewed, later);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  test("isDue compares the due time against now", () => {
    expect(isDue(makeCard({ due: "2026-08-16T09:00:00.000Z" }), NOW)).toBe(true);
    expect(isDue(makeCard({ due: "2026-08-16T11:00:00.000Z" }), NOW)).toBe(false);
  });
});

describe("isDueByDay", () => {
  test("counts a card due later today as due today, but not a card due tomorrow", () => {
    const now = new Date(2026, 7, 16, 8, 0, 0);
    expect(isDueByDay(makeCard({ due: new Date(2026, 7, 16, 23, 0, 0).toISOString() }), now)).toBe(true);
    expect(isDueByDay(makeCard({ due: new Date(2026, 7, 17, 0, 30, 0).toISOString() }), now)).toBe(false);
  });

  test("counts overdue cards as due today", () => {
    const now = new Date(2026, 7, 16, 8, 0, 0);
    expect(isDueByDay(makeCard({ due: new Date(2026, 7, 15, 20, 0, 0).toISOString() }), now)).toBe(true);
  });
});

describe("accuracy summaries", () => {
  test("MCQ accuracy shrinks small samples toward the prior", () => {
    const summary = summarizeMcq([attempt({ correct: true }), attempt({ correct: true }), attempt({ correct: true })]);
    expect(summary.attempts).toBe(3);
    expect(summary.raw).toBe(1);
    expect(summary.adjusted).toBeCloseTo(0.6875, 5);
  });

  test("structured accuracy averages per-attempt mark ratios", () => {
    const summary = summarizeStructured([
      attempt({ kind: "structured", score: 8, maxScore: 10 }),
      attempt({ kind: "structured", score: 4, maxScore: 5 }),
    ]);
    expect(summary.attempts).toBe(2);
    expect(summary.raw).toBeCloseTo(0.8, 5);
  });

  test("shrinkAccuracy returns null for empty samples", () => {
    expect(shrinkAccuracy(0, 0)).toBeNull();
  });
});

describe("acquisition level", () => {
  test("progresses from not started to ready", () => {
    expect(
      acquisitionLevel({ attemptCount: 0, reviewCount: 0, adjustedAccuracy: null, averageRetrievability: null }),
    ).toBe("not_started");
    expect(
      acquisitionLevel({ attemptCount: 1, reviewCount: 0, adjustedAccuracy: 0.9, averageRetrievability: null }),
    ).toBe("introduced");
    expect(
      acquisitionLevel({ attemptCount: 5, reviewCount: 0, adjustedAccuracy: 0.9, averageRetrievability: null }),
    ).toBe("partially_learned");
    expect(
      acquisitionLevel({ attemptCount: 10, reviewCount: 0, adjustedAccuracy: 0.6, averageRetrievability: 0.9 }),
    ).toBe("practised");
    expect(
      acquisitionLevel({ attemptCount: 10, reviewCount: 0, adjustedAccuracy: 0.85, averageRetrievability: 0.9 }),
    ).toBe("ready");
  });
});

describe("measureObjective", () => {
  test("combines retention and application from raw events", () => {
    const cards = [makeCard()];
    const attempts = [attempt({ correct: true }), attempt({ correct: false })];
    const logs: ReviewLog[] = [];

    const measurement = measureObjective({ objectiveId: "o1", cards, attempts, logs, now: NOW });
    expect(measurement.retention.cardCount).toBe(1);
    expect(measurement.mcq.attempts).toBe(2);
    expect(measurement.structured.attempts).toBe(0);
    expect(measurement.totalAttempts).toBe(2);
    expect(measurement.lastPractisedAt).toBe(NOW.toISOString());
  });

  test("errorBreakdown counts and sorts categories", () => {
    const breakdown = errorBreakdown([
      attempt({ errorCategoryId: "careless-slip" }),
      attempt({ errorCategoryId: "careless-slip" }),
      attempt({ errorCategoryId: "misconception" }),
    ]);
    expect(breakdown).toEqual([
      { categoryId: "careless-slip", count: 2 },
      { categoryId: "misconception", count: 1 },
    ]);
  });
});

describe("observeCapacity", () => {
  test("computes completion rate, session length, and time per question", () => {
    const sessionLogs: SessionLog[] = [
      session({ date: "2026-08-10", actualMinutes: 45, plannedMinutes: 60, status: "completed" }),
      session({ date: "2026-08-11", actualMinutes: 0, plannedMinutes: 60, status: "missed" }),
    ];
    const attempts = [
      attempt({ kind: "mcq", timeSeconds: 60 }),
      attempt({ kind: "mcq", timeSeconds: 120 }),
      attempt({ kind: "structured", timeSeconds: 300 }),
    ];

    const capacity = observeCapacity({ sessionLogs, attempts });
    expect(capacity.totalSessions).toBe(2);
    expect(capacity.completedSessions).toBe(1);
    expect(capacity.completionRate).toBe(0.5);
    expect(capacity.averageSessionMinutes).toBeCloseTo(45, 5);
    expect(capacity.averageCompletedMinutesPerDay).toBeCloseTo(45, 5);
    expect(capacity.averageTimePerMcqSeconds).toBeCloseTo(90, 5);
    expect(capacity.averageTimePerStructuredSeconds).toBeCloseTo(300, 5);
    expect(capacity.missedCount).toBe(1);
    expect(capacity.byWeekday[1].sessions).toBe(1);
    expect(capacity.byWeekday[1].completed).toBe(1);
    expect(capacity.byWeekday[2].sessions).toBe(1);
    expect(capacity.byWeekday[2].completed).toBe(0);
  });

  test("counts disrupted sessions by outcome", () => {
    const sessionLogs: SessionLog[] = [
      session({ status: "completed" }),
      session({ status: "partial" }),
      session({ status: "postponed" }),
      session({ status: "missed" }),
      session({ status: "skipped" }),
    ];
    const capacity = observeCapacity({ sessionLogs, attempts: [] });
    expect(capacity.completedSessions).toBe(1);
    expect(capacity.partialCount).toBe(1);
    expect(capacity.postponedCount).toBe(1);
    expect(capacity.missedCount).toBe(1);
    expect(capacity.skippedCount).toBe(1);
  });
});
