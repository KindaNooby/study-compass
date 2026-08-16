import { isDue, retrievability } from "./fsrs";
import type {
  AcquisitionLevel,
  FsrsCard,
  LearningObjective,
  PracticeAttempt,
  ReviewLog,
  SessionLog,
} from "./types";

/**
 * Sample-size caution: shrink raw accuracy toward a neutral prior so a few
 * lucky answers never read as mastery. `adjusted = (correct + prior*strength) / (n + strength)`.
 */
export const SHRINKAGE_PRIOR = 0.5;
export const SHRINKAGE_STRENGTH = 5;

export const READY_ACCURACY_THRESHOLD = 0.75;
export const READY_RETENTION_THRESHOLD = 0.7;
export const PRACTISED_ATTEMPTS_THRESHOLD = 8;
export const INTRODUCED_INTERACTIONS_THRESHOLD = 3;

export type AccuracySummary = {
  attempts: number;
  /** Raw accuracy: MCQ = correct/attempts; structured = mean(score/maxScore). */
  raw: number | null;
  /** Accuracy shrunk toward the prior to reflect small samples. */
  adjusted: number | null;
};

export function shrinkAccuracy(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return (correct + SHRINKAGE_PRIOR * SHRINKAGE_STRENGTH) / (total + SHRINKAGE_STRENGTH);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function summarizeMcq(attempts: PracticeAttempt[]): AccuracySummary {
  const relevant = attempts.filter((attempt) => attempt.kind === "mcq");
  const correct = relevant.filter((attempt) => attempt.correct).length;
  return {
    attempts: relevant.length,
    raw: relevant.length === 0 ? null : correct / relevant.length,
    adjusted: shrinkAccuracy(correct, relevant.length),
  };
}

export function summarizeStructured(attempts: PracticeAttempt[]): AccuracySummary {
  const relevant = attempts.filter((attempt) => attempt.kind === "structured");
  const ratios = relevant
    .map((attempt) =>
      attempt.maxScore && attempt.maxScore > 0
        ? clampUnit((attempt.score ?? 0) / attempt.maxScore)
        : null,
    )
    .filter((ratio): ratio is number => ratio !== null);
  const sum = ratios.reduce((acc, ratio) => acc + ratio, 0);
  return {
    attempts: relevant.length,
    raw: ratios.length === 0 ? null : sum / ratios.length,
    adjusted: shrinkAccuracy(sum, ratios.length),
  };
}

export function errorBreakdown(
  attempts: PracticeAttempt[],
): { categoryId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.errorCategoryId) continue;
    counts.set(attempt.errorCategoryId, (counts.get(attempt.errorCategoryId) ?? 0) + 1);
  }
  return Array.from(counts, ([categoryId, count]) => ({ categoryId, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export type RetentionSummary = {
  cardCount: number;
  dueCount: number;
  overdueCount: number;
  reviewCount: number;
  averageRetrievability: number | null;
  averageStability: number | null;
};

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function summarizeRetention(
  cards: FsrsCard[],
  logs: ReviewLog[],
  now = new Date(),
): RetentionSummary {
  const active = cards.filter((card) => !card.suspended);
  const due = active.filter((card) => isDue(card, now));
  const dayStart = startOfDay(now).getTime();
  const overdue = due.filter((card) => new Date(card.due).getTime() < dayStart);

  const measurable = active.filter(
    (card) => card.state !== "New" && card.stability > 0,
  );
  const retrievabilities = measurable
    .map((card) => retrievability(card, now))
    .filter((value) => Number.isFinite(value));
  const stabilities = measurable.map((card) => card.stability).filter((value) => value > 0);

  return {
    cardCount: active.length,
    dueCount: due.length,
    overdueCount: overdue.length,
    reviewCount: logs.length,
    averageRetrievability:
      retrievabilities.length === 0
        ? null
        : retrievabilities.reduce((acc, value) => acc + value, 0) / retrievabilities.length,
    averageStability:
      stabilities.length === 0
        ? null
        : stabilities.reduce((acc, value) => acc + value, 0) / stabilities.length,
  };
}

export function acquisitionLevel(input: {
  attemptCount: number;
  reviewCount: number;
  adjustedAccuracy: number | null;
  averageRetrievability: number | null;
}): AcquisitionLevel {
  const { attemptCount, reviewCount, adjustedAccuracy, averageRetrievability } = input;
  if (attemptCount === 0 && reviewCount === 0) return "not_started";
  if (attemptCount + reviewCount < INTRODUCED_INTERACTIONS_THRESHOLD) return "introduced";
  if (attemptCount < PRACTISED_ATTEMPTS_THRESHOLD) return "partially_learned";

  const accuracyOk = adjustedAccuracy !== null && adjustedAccuracy >= READY_ACCURACY_THRESHOLD;
  const retentionOk =
    averageRetrievability === null || averageRetrievability >= READY_RETENTION_THRESHOLD;
  if (accuracyOk && retentionOk) return "ready";
  return "practised";
}

export type ObjectiveMeasurement = {
  objectiveId: string;
  acquisition: AcquisitionLevel;
  retention: RetentionSummary;
  mcq: AccuracySummary;
  structured: AccuracySummary;
  totalAttempts: number;
  errorBreakdown: { categoryId: string; count: number }[];
  lastPractisedAt: string | null;
};

function latestIso(values: string[]): string | null {
  return values.length === 0 ? null : values.slice().sort().reverse()[0];
}

export function measureObjective(input: {
  objectiveId: string;
  cards: FsrsCard[];
  attempts: PracticeAttempt[];
  logs: ReviewLog[];
  now?: Date;
}): ObjectiveMeasurement {
  const now = input.now ?? new Date();
  const cards = input.cards.filter((card) => card.objectiveId === input.objectiveId);
  const attempts = input.attempts.filter((attempt) => attempt.objectiveId === input.objectiveId);
  const logs = input.logs.filter((log) => log.objectiveId === input.objectiveId);

  const mcq = summarizeMcq(attempts);
  const structured = summarizeStructured(attempts);
  const retention = summarizeRetention(cards, logs, now);

  const totalAttempts = mcq.attempts + structured.attempts;
  const weightedAccuracy =
    totalAttempts === 0
      ? null
      : shrinkAccuracy(
          (mcq.raw ?? 0) * mcq.attempts + (structured.raw ?? 0) * structured.attempts,
          totalAttempts,
        );

  return {
    objectiveId: input.objectiveId,
    acquisition: acquisitionLevel({
      attemptCount: totalAttempts,
      reviewCount: retention.reviewCount,
      adjustedAccuracy: weightedAccuracy,
      averageRetrievability: retention.averageRetrievability,
    }),
    retention,
    mcq,
    structured,
    totalAttempts,
    errorBreakdown: errorBreakdown(attempts),
    lastPractisedAt: latestIso([
      ...attempts.map((attempt) => attempt.attemptedAt),
      ...logs.map((log) => log.reviewedAt),
    ]),
  };
}

export function measureCurriculum(input: {
  objectives: LearningObjective[];
  cards: FsrsCard[];
  attempts: PracticeAttempt[];
  logs: ReviewLog[];
  now?: Date;
}): Map<string, ObjectiveMeasurement> {
  const result = new Map<string, ObjectiveMeasurement>();
  for (const objective of input.objectives) {
    result.set(
      objective.id,
      measureObjective({
        objectiveId: objective.id,
        cards: input.cards,
        attempts: input.attempts,
        logs: input.logs,
        now: input.now,
      }),
    );
  }
  return result;
}

// --- Observed capacity ---

export type WeekdayCapacity = {
  sessions: number;
  completed: number;
  rate: number | null;
};

export type ObservedCapacity = {
  totalSessions: number;
  completedSessions: number;
  completionRate: number | null;
  averageSessionMinutes: number | null;
  averagePlannedMinutes: number | null;
  averageTimePerMcqSeconds: number | null;
  averageTimePerStructuredSeconds: number | null;
  postponedCount: number;
  missedCount: number;
  skippedCount: number;
  partialCount: number;
  byWeekday: Record<number, WeekdayCapacity>;
};

export function weekdayOfDateKey(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00`).getDay();
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function observeCapacity(input: {
  sessionLogs: SessionLog[];
  attempts: PracticeAttempt[];
}): ObservedCapacity {
  const { sessionLogs, attempts } = input;

  const completed = sessionLogs.filter((log) => log.status === "completed").length;
  const byWeekday: Record<number, WeekdayCapacity> = {};
  for (let day = 0; day < 7; day++) {
    byWeekday[day] = { sessions: 0, completed: 0, rate: null };
  }
  for (const log of sessionLogs) {
    const bucket = byWeekday[weekdayOfDateKey(log.date)];
    if (!bucket) continue;
    bucket.sessions += 1;
    if (log.status === "completed") bucket.completed += 1;
  }
  for (let day = 0; day < 7; day++) {
    const bucket = byWeekday[day];
    bucket.rate = bucket.sessions === 0 ? null : bucket.completed / bucket.sessions;
  }

  const mcqSeconds = attempts
    .filter((attempt) => attempt.kind === "mcq")
    .map((attempt) => attempt.timeSeconds);
  const structuredSeconds = attempts
    .filter((attempt) => attempt.kind === "structured")
    .map((attempt) => attempt.timeSeconds);

  return {
    totalSessions: sessionLogs.length,
    completedSessions: completed,
    completionRate: sessionLogs.length === 0 ? null : completed / sessionLogs.length,
    averageSessionMinutes: mean(sessionLogs.map((log) => log.actualMinutes)),
    averagePlannedMinutes: mean(sessionLogs.map((log) => log.plannedMinutes)),
    averageTimePerMcqSeconds: mean(mcqSeconds),
    averageTimePerStructuredSeconds: mean(structuredSeconds),
    postponedCount: sessionLogs.filter((log) => log.status === "postponed").length,
    missedCount: sessionLogs.filter((log) => log.status === "missed").length,
    skippedCount: sessionLogs.filter((log) => log.status === "skipped").length,
    partialCount: sessionLogs.filter((log) => log.status === "partial").length,
    byWeekday,
  };
}
