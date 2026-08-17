import {
  measureCurriculum,
  observeCapacity,
  shrinkAccuracy,
  weekdayOfDateKey,
  READY_ACCURACY_THRESHOLD,
  type ObjectiveMeasurement,
  type ObservedCapacity,
} from "./measurement";
import { allPrerequisites, nextExam, toDateKey, todayKey } from "./selectors";
import type {
  ActivityKind,
  ActivityPurpose,
  AcquisitionLevel,
  Availability,
  ExamGoal,
  FsrsCard,
  LearningObjective,
  PracticeAttempt,
  QuestionType,
  ReviewLog,
  SessionLog,
  StudyActivity,
} from "./types";

// --- Config (single source of truth for the allocator's dials) ---

/** How many days of the plan are materialized into concrete activities. */
export const PLAN_HORIZON_DAYS = 7;
/** Forecast window used when there is no exam goal. */
export const DEFAULT_FORECAST_DAYS = 14;
/** Fallback time per FSRS card when no review timing has been observed. */
export const DEFAULT_SECONDS_PER_CARD = 20;
/** Sane bounds for observed seconds-per-card, so one outlier can't skew a day. */
export const MIN_SECONDS_PER_CARD = 5;
export const MAX_SECONDS_PER_CARD = 120;
/** Default chunk size when no preferred session length is configured. */
export const DEFAULT_SESSION_MINUTES = 30;
/** Default length of a scheduled mock exam. */
export const MOCK_EXAM_MINUTES = 90;
/** Fallback time-per-question before real attempt timing is observed. */
export const DEFAULT_SECONDS_PER_MCQ = 60;
export const DEFAULT_SECONDS_PER_STRUCTURED = 300;

/**
 * Priority weights. The planner scores each objective as a weighted blend of
 * its declared importance, its topic priority, its subject weighting, and its
 * time-urgency to the next exam.
 */
export const PRIORITY_WEIGHTS = {
  importance: 0.35,
  topic: 0.25,
  subject: 0.2,
  urgency: 0.2,
} as const;

/** A dependent objective can be learned only once every prerequisite is at least this far along. */
export const UNLOCK_ACQUISITION_LEVELS = new Set<AcquisitionLevel>(["practised", "ready"]);

/** Fraction of estimated learning time still owed at each acquisition stage. */
const LEARNING_FRACTION: Record<AcquisitionLevel, number> = {
  not_started: 1,
  introduced: 0.75,
  partially_learned: 0.5,
  practised: 0,
  ready: 0,
};

// --- Types ---

export type PlanState = {
  objectives: LearningObjective[];
  cards: FsrsCard[];
  attempts: PracticeAttempt[];
  reviewLogs: ReviewLog[];
  sessionLogs: SessionLog[];
  examGoals: ExamGoal[];
  /**
   * Materialized schedule. Completed learning/practice activities count as
   * real progress so they aren't recommended again on the next replan.
   */
  activities?: StudyActivity[];
  /** Override the auto-selected next exam, e.g. when the student inspects a later goal. */
  activeGoalId?: string;
  availability: Availability;
  now: Date;
};

export type DueForecastPoint = {
  date: string;
  cardCount: number;
  objectiveIds: string[];
  minutes: number;
};

export type ObjectivePriority = {
  objectiveId: string;
  score: number;
  importance: number;
  topic: number;
  subject: number;
  urgency: number;
};

export type Feasibility = {
  achievable: boolean;
  requiredMinutes: number;
  availableMinutes: number;
  shortfallMinutes: number;
  /** Fraction of the required workload that fits in the available time (0..1). */
  workloadCoverage: number;
  /** The goal's minimum-required-curriculum-coverage target (informational). */
  targetCoverage: number;
};

export type PlannedActivity = {
  date: string;
  kind: ActivityKind;
  objectiveIds: string[];
  subjectId: string;
  examGoalId?: string;
  questionType?: QuestionType;
  plannedMinutes: number;
  questionCount?: number;
  cardCount?: number;
  purpose: ActivityPurpose;
  score: number;
  reasons: string[];
};

export type PlanDay = {
  date: string;
  weekday: number;
  isStudyDay: boolean;
  capacityMinutes: number;
  allocatedMinutes: number;
  activities: PlannedActivity[];
  /** Minutes reserved by pinned activities, fixed regardless of replanning. */
  pinnedMinutes: number;
  pinnedActivities: StudyActivity[];
};

export type BlockedObjective = {
  objectiveId: string;
  title: string;
  missingPrerequisites: string[];
};

export type Plan = {
  goalId: string | null;
  goalName: string | null;
  examDate: string | null;
  generatedAt: string;
  horizonStart: string;
  horizonEnd: string;
  days: PlanDay[];
  dueForecast: DueForecastPoint[];
  feasibility: Feasibility;
  blockedObjectives: BlockedObjective[];
  warnings: string[];
};

// --- Internal working types ---

type WorkItem = {
  objective: LearningObjective;
  measurement: ObjectiveMeasurement;
  priority: ObjectivePriority;
  optional: boolean;
  remainingLearning: number;
  remainingPractice: number;
  weakType: QuestionType | null;
  hasErrors: boolean;
  unlocked: boolean;
};

type Candidate = {
  kind: ActivityKind;
  minutes: number;
  questionType?: QuestionType;
  purpose: ActivityPurpose;
  reasons: string[];
};

// --- Date helpers (local-time date keys, deterministic) ---

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function addDays(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()) / 86400000,
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- Capacity ---

export function isStudyDay(dateKey: string, availability: Availability): boolean {
  if (availability.unavailableDates.includes(dateKey)) return false;
  const weekday = weekdayOfDateKey(dateKey);
  if (availability.restDays.includes(weekday)) return false;
  return availability.availableDays.includes(weekday);
}

/**
 * Effective minutes for one date. Honest blend: never above the stated daily
 * cap, and pulled toward the observed completed-minutes-per-day as evidence
 * accumulates. With no evidence it equals the configured cap.
 */
export function effectiveDailyMinutes(
  dateKey: string,
  availability: Availability,
  capacity: ObservedCapacity,
): number {
  if (!isStudyDay(dateKey, availability)) return 0;
  const planned = availability.maxDailyStudyMinutes;
  const observed = capacity.averageCompletedMinutesPerDay;
  if (observed === null) return planned;
  const evidence = clamp01(capacity.completedSessions / 5);
  const blended = Math.round(observed * evidence + planned * (1 - evidence));
  return Math.min(planned, Math.max(0, blended));
}

// --- Review timing ---

export function observedSecondsPerCard(logs: ReviewLog[]): number {
  const withTime = logs.filter((log) => log.elapsedMs > 0);
  if (withTime.length === 0) return DEFAULT_SECONDS_PER_CARD;
  const seconds = withTime.reduce((sum, log) => sum + log.elapsedMs, 0) / withTime.length / 1000;
  return Math.min(MAX_SECONDS_PER_CARD, Math.max(MIN_SECONDS_PER_CARD, seconds));
}

/**
 * Buckets existing (non-new) cards by when they next come due. Already-overdue
 * cards land on today; cards beyond the horizon are ignored. New cards aren't
 * scheduled here — they become reviewable only after they've been learned.
 */
export function forecastDueReviews(
  cards: FsrsCard[],
  secondsPerCard: number,
  now: Date,
  horizonEnd: string,
): DueForecastPoint[] {
  const today = todayKey(now);
  const totalDays = daysBetween(today, horizonEnd);
  const buckets = new Map<string, { cardCount: number; objectiveIds: Set<string> }>();

  for (const card of cards) {
    if (card.suspended || card.state === "New") continue;
    const dueDate = toDateKey(new Date(card.due));
    const date = dueDate < today ? today : dueDate;
    if (date > horizonEnd) continue;
    const bucket = buckets.get(date) ?? { cardCount: 0, objectiveIds: new Set<string>() };
    bucket.cardCount += 1;
    bucket.objectiveIds.add(card.objectiveId);
    buckets.set(date, bucket);
  }

  const points: DueForecastPoint[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(today, i);
    const bucket = buckets.get(date);
    const cardCount = bucket?.cardCount ?? 0;
    points.push({
      date,
      cardCount,
      objectiveIds: bucket ? Array.from(bucket.objectiveIds).sort() : [],
      minutes: Math.ceil((cardCount * secondsPerCard) / 60),
    });
  }
  return points;
}

// --- Priority ---

export function urgencyForDate(examDate: string, now: Date): number {
  const days = daysBetween(todayKey(now), examDate);
  if (days < 0) return 1;
  return clamp01(1 / (1 + days / 30));
}

export function subjectWeightFor(goal: ExamGoal | undefined, subjectId: string): number {
  const configured = goal?.subjectWeighting[subjectId];
  if (configured !== undefined) return configured;
  const count = goal?.subjectIds.length ?? 0;
  return count > 0 ? 1 / count : 0;
}

export function topicPriorityFor(goal: ExamGoal | undefined, topicId: string): number {
  return goal?.topicPriorities[topicId] ?? 0.5;
}

export function objectivePriority(input: {
  objective: LearningObjective;
  goal: ExamGoal | undefined;
  subjectWeight: number;
  topicPriority: number;
  now: Date;
}): ObjectivePriority {
  const urgency = input.goal ? urgencyForDate(input.goal.examDate, input.now) : 0.5;
  const importance = input.objective.importance;
  const score =
    PRIORITY_WEIGHTS.importance * importance +
    PRIORITY_WEIGHTS.topic * input.topicPriority +
    PRIORITY_WEIGHTS.subject * input.subjectWeight +
    PRIORITY_WEIGHTS.urgency * urgency;
  return {
    objectiveId: input.objective.id,
    score,
    importance,
    topic: input.topicPriority,
    subject: input.subjectWeight,
    urgency,
  };
}

// --- Remaining work (derived from measurement, never guessed fresh) ---

export function remainingLearningMinutes(
  objective: LearningObjective,
  measurement: ObjectiveMeasurement,
): number {
  return Math.round(objective.estimatedLearningMinutes * LEARNING_FRACTION[measurement.acquisition]);
}

export function combinedAdjustedAccuracy(measurement: ObjectiveMeasurement): number | null {
  const total = measurement.mcq.attempts + measurement.structured.attempts;
  if (total === 0) return null;
  const correctWeighted =
    (measurement.mcq.raw ?? 0) * measurement.mcq.attempts +
    (measurement.structured.raw ?? 0) * measurement.structured.attempts;
  return shrinkAccuracy(correctWeighted, total);
}

export function practiceShortfall(measurement: ObjectiveMeasurement): number {
  const adjusted = combinedAdjustedAccuracy(measurement);
  if (adjusted === null) return 1;
  return clamp01((READY_ACCURACY_THRESHOLD - adjusted) / READY_ACCURACY_THRESHOLD);
}

export function remainingPracticeMinutes(
  objective: LearningObjective,
  measurement: ObjectiveMeasurement,
): number {
  return Math.round(objective.estimatedPracticeMinutes * practiceShortfall(measurement));
}

/** The question type to practise next: the weaker (or untried) of the two. */
export function weakQuestionType(
  objective: LearningObjective,
  measurement: ObjectiveMeasurement,
): QuestionType | null {
  const types = objective.questionTypes;
  if (types.length === 0) return null;
  if (types.length === 1) return types[0];
  const mcq = measurement.mcq.adjusted;
  const structured = measurement.structured.adjusted;
  if (mcq === null && structured === null) return types[0];
  const rank = (value: number | null) => (value === null ? -1 : value);
  return rank(mcq) <= rank(structured) ? "mcq" : "structured";
}

export function isUnlocked(
  objective: LearningObjective,
  measurements: Map<string, ObjectiveMeasurement>,
  objectives: LearningObjective[],
): boolean {
  return allPrerequisites(objective.id, objectives).every((id) => {
    const level = measurements.get(id)?.acquisition ?? "not_started";
    return UNLOCK_ACQUISITION_LEVELS.has(level);
  });
}

function isLearningKind(kind: ActivityKind): boolean {
  return kind === "learn_new_content" || kind === "retrieval_practise";
}

function isPracticeKind(kind: ActivityKind): boolean {
  return (
    kind === "mcq_practise" ||
    kind === "structured_practise" ||
    kind === "error_correction" ||
    kind === "mixed_exam_practice"
  );
}

/**
 * Splits schedule evidence into two different things:
 * - Completed minutes are real progress and reduce the total work required.
 * - Future manual/pinned minutes are reservations: they stop the allocator
 *   from double-booking that work, but they do not reduce required work.
 */
function progressAndReservationsByObjective(
  activities: StudyActivity[],
  today: string,
): {
  completedLearning: Map<string, number>;
  completedPractice: Map<string, number>;
  reservedLearning: Map<string, number>;
  reservedPractice: Map<string, number>;
} {
  const completedLearning = new Map<string, number>();
  const completedPractice = new Map<string, number>();
  const reservedLearning = new Map<string, number>();
  const reservedPractice = new Map<string, number>();

  for (const activity of activities) {
    if (!isLearningKind(activity.kind) && !isPracticeKind(activity.kind)) continue;
    const objectiveId = activity.objectiveIds[0];
    if (!objectiveId) continue;
    const isLearning = isLearningKind(activity.kind);

    if (activity.status === "completed") {
      const done =
        activity.completedMinutes !== undefined && activity.completedMinutes > 0
          ? activity.completedMinutes
          : activity.plannedMinutes;
      const target = isLearning ? completedLearning : completedPractice;
      target.set(objectiveId, (target.get(objectiveId) ?? 0) + done);
    } else if (
      (activity.source === "manual" || activity.pinned === true) &&
      activity.date >= today &&
      activity.status !== "skipped"
    ) {
      const reserved = Math.max(
        0,
        activity.plannedMinutes - (activity.completedMinutes ?? 0),
      );
      const target = isLearning ? reservedLearning : reservedPractice;
      target.set(objectiveId, (target.get(objectiveId) ?? 0) + reserved);
    }
  }

  return { completedLearning, completedPractice, reservedLearning, reservedPractice };
}

// --- Planner ---

function nearestStudyDayAtOrBefore(dateKey: string, availability: Availability): string | null {
  let cursor = dateKey;
  for (let i = 0; i < 8; i++) {
    if (isStudyDay(cursor, availability)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return null;
}

function subjectForObjectives(
  objectiveIds: string[],
  objectives: LearningObjective[],
): string {
  const byId = new Map(objectives.map((objective) => [objective.id, objective]));
  for (const id of objectiveIds) {
    const objective = byId.get(id);
    if (objective) return objective.subjectId;
  }
  return "";
}

function questionCountFor(
  kind: ActivityKind,
  questionType: QuestionType | undefined,
  minutes: number,
  capacity: ObservedCapacity,
): number | undefined {
  if (!questionType) return undefined;
  const seconds =
    questionType === "mcq"
      ? capacity.averageTimePerMcqSeconds ?? DEFAULT_SECONDS_PER_MCQ
      : capacity.averageTimePerStructuredSeconds ?? DEFAULT_SECONDS_PER_STRUCTURED;
  if (seconds <= 0) return undefined;
  return Math.max(1, Math.round((minutes * 60) / seconds));
}

function nextCandidate(item: WorkItem, sessionMinutes: number): Candidate | null {
  if (item.remainingLearning > 0) {
    if (!item.unlocked) return null;
    const minutes = Math.min(item.remainingLearning, sessionMinutes);
    return {
      kind: "learn_new_content",
      minutes,
      purpose: "learning",
      reasons: [
        `Priority ${Math.round(item.priority.score * 100)}/100`,
        `${item.remainingLearning} min learning remaining`,
      ],
    };
  }

  if (item.hasErrors && item.remainingPractice > 0) {
    const minutes = Math.min(item.remainingPractice, sessionMinutes);
    return {
      kind: "error_correction",
      minutes,
      purpose: "diagnosis",
      reasons: [
        "Accuracy is below target",
        "Errors recorded in practice",
        `${item.remainingPractice} min correction remaining`,
      ],
    };
  }

  if (item.remainingPractice > 0 && item.weakType) {
    const minutes = Math.min(item.remainingPractice, sessionMinutes);
    const kind: ActivityKind = item.weakType === "mcq" ? "mcq_practise" : "structured_practise";
    return {
      kind,
      minutes,
      questionType: item.weakType,
      purpose: "application",
      reasons: [
        "Accuracy is below target",
        `${item.remainingPractice} min practice remaining`,
      ],
    };
  }

  return null;
}

/**
 * The planner core. Pure and deterministic: same inputs + same `now` produce
 * the same plan. It reads phases 1–2 state and turns it into a daily/weekly
 * allocation with a feasibility verdict. The plan is derived, not stored
 * wholesale — only the resulting activities are materialized by the caller.
 */
export function planStudy(state: PlanState): Plan {
  const { now, availability, activeGoalId } = state;
  const today = todayKey(now);
  const upcoming = nextExam(state.examGoals, now);
  const goal = activeGoalId
    ? state.examGoals.find((item) => item.id === activeGoalId) ?? upcoming
    : upcoming;
  const horizonEnd = goal ? goal.examDate : addDays(today, DEFAULT_FORECAST_DAYS);
  const materializeDays = Math.max(
    1,
    Math.min(PLAN_HORIZON_DAYS, daysBetween(today, horizonEnd) + 1),
  );

  const warnings: string[] = [];
  if (availability.availableDays.length === 0 || availability.maxDailyStudyMinutes <= 0) {
    warnings.push("No availability configured — there is no study time to allocate yet.");
  }
  if (!goal) {
    warnings.push("No upcoming exam goal — using default priorities and a 14-day window.");
  }
  if (state.objectives.length === 0) {
    warnings.push("No learning objectives yet.");
  }

  const measurements = measureCurriculum({
    objectives: state.objectives,
    cards: state.cards,
    attempts: state.attempts,
    logs: state.reviewLogs,
    now,
  });
  const capacity = observeCapacity({ sessionLogs: state.sessionLogs, attempts: state.attempts });
  const secondsPerCard = observedSecondsPerCard(state.reviewLogs);
  const progress = progressAndReservationsByObjective(state.activities ?? [], today);

  // Pinned future work is fixed: it reserves capacity on its date and is never
  // reallocated. Past pins don't reserve anything (their date is gone).
  const pinnedByDate = new Map<string, StudyActivity[]>();
  for (const activity of state.activities ?? []) {
    if (
      activity.pinned !== true ||
      activity.date < today ||
      activity.status === "completed" ||
      activity.status === "skipped"
    ) {
      continue;
    }
    const list = pinnedByDate.get(activity.date) ?? [];
    list.push(activity);
    pinnedByDate.set(activity.date, list);
  }

  const inScope = goal
    ? state.objectives.filter((objective) => goal.subjectIds.includes(objective.subjectId))
    : state.objectives;

  const work: WorkItem[] = inScope.map((objective) => {
    const measurement = measurements.get(objective.id)!;
    const priority = objectivePriority({
      objective,
      goal,
      subjectWeight: subjectWeightFor(goal, objective.subjectId),
      topicPriority: topicPriorityFor(goal, objective.topicId),
      now,
    });
    return {
      objective,
      measurement,
      priority,
      optional: goal ? goal.optionalTopicIds.includes(objective.topicId) : false,
      remainingLearning: Math.max(
        0,
        remainingLearningMinutes(objective, measurement) -
          (progress.completedLearning.get(objective.id) ?? 0) -
          (progress.reservedLearning.get(objective.id) ?? 0),
      ),
      remainingPractice: Math.max(
        0,
        remainingPracticeMinutes(objective, measurement) -
          (progress.completedPractice.get(objective.id) ?? 0) -
          (progress.reservedPractice.get(objective.id) ?? 0),
      ),
      weakType: weakQuestionType(objective, measurement),
      hasErrors: measurement.errorBreakdown.length > 0,
      unlocked: isUnlocked(objective, measurements, state.objectives),
    };
  });

  const blockedObjectives: BlockedObjective[] = work
    .filter((item) => item.remainingLearning > 0 && !item.unlocked)
    .map((item) => ({
      objectiveId: item.objective.id,
      title: item.objective.title,
      missingPrerequisites: allPrerequisites(item.objective.id, state.objectives).filter((id) => {
        const level = measurements.get(id)?.acquisition ?? "not_started";
        return !UNLOCK_ACQUISITION_LEVELS.has(level);
      }),
    }));

  const dueForecast = forecastDueReviews(state.cards, secondsPerCard, now, horizonEnd);
  const dueByDate = new Map(dueForecast.map((point) => [point.date, point]));

  // Mock exams land on (or just before) each external deadline within scope.
  const mocks: { date: string; label: string; objectiveIds: string[]; subjectId: string }[] = [];
  if (goal) {
    const anchorSubjectId = goal.subjectIds.length
      ? goal.subjectIds
          .slice()
          .sort((a, b) => subjectWeightFor(goal, b) - subjectWeightFor(goal, a))[0]
      : inScope[0]?.subjectId ?? "";
    if (anchorSubjectId) {
      for (const deadline of goal.externalDeadlines) {
        if (deadline.date < today || deadline.date > horizonEnd) continue;
        const scheduled = nearestStudyDayAtOrBefore(deadline.date, availability);
        if (scheduled && scheduled >= today) {
          mocks.push({
            date: scheduled,
            label: deadline.label,
            objectiveIds: inScope.map((objective) => objective.id),
            subjectId: anchorSubjectId,
          });
        }
      }
    }
  }

  // Feasibility: required workload (learning + practice + reviews + mocks) vs.
  // effective available minutes from today through the exam.
  // Feasibility uses "work still owed" = estimate minus completed progress.
  // Reservations are not subtracted: pinned/moved work is still work to do.
  const requiredWorkMinutes = inScope
    .filter((objective) => (goal ? !goal.optionalTopicIds.includes(objective.topicId) : true))
    .reduce((sum, objective) => {
      const measurement = measurements.get(objective.id)!;
      const learning = Math.max(
        0,
        remainingLearningMinutes(objective, measurement) -
          (progress.completedLearning.get(objective.id) ?? 0),
      );
      const practice = Math.max(
        0,
        remainingPracticeMinutes(objective, measurement) -
          (progress.completedPractice.get(objective.id) ?? 0),
      );
      return sum + learning + practice;
    }, 0);
  const reviewMinutes = dueForecast.reduce((sum, point) => sum + point.minutes, 0);
  const mockMinutes = mocks.reduce((sum, mock) => sum + MOCK_EXAM_MINUTES, 0);
  const requiredMinutes = requiredWorkMinutes + reviewMinutes + mockMinutes;

  let availableMinutes = 0;
  for (let i = 0; i <= daysBetween(today, horizonEnd); i++) {
    availableMinutes += effectiveDailyMinutes(addDays(today, i), availability, capacity);
  }

  const targetCoverage = goal?.minimumRequiredCoverage ?? 1;
  const feasibility: Feasibility = {
    achievable: availableMinutes >= requiredMinutes,
    requiredMinutes,
    availableMinutes,
    shortfallMinutes: Math.max(0, requiredMinutes - availableMinutes),
    workloadCoverage: requiredMinutes === 0 ? 1 : clamp01(availableMinutes / requiredMinutes),
    targetCoverage,
  };

  const sessionMinutes =
    availability.preferredSessionMinutes > 0
      ? availability.preferredSessionMinutes
      : DEFAULT_SESSION_MINUTES;

  // Mutated per-day as work is allocated; unallocated work rolls forward.
  const workItems: WorkItem[] = work.map((item) => ({ ...item }));
  const days: PlanDay[] = [];

  for (let i = 0; i < materializeDays; i++) {
    const date = addDays(today, i);
    const studyDay = isStudyDay(date, availability);
    const cap = effectiveDailyMinutes(date, availability, capacity);
    const pinned = pinnedByDate.get(date) ?? [];
    const pinnedMinutes = pinned.reduce((sum, activity) => sum + activity.plannedMinutes, 0);
    const activities: PlannedActivity[] = [];
    let budget = Math.max(0, cap - pinnedMinutes);

    // 1. Time-critical reviews first, so recall doesn't lapse.
    const due = dueByDate.get(date);
    if (due && due.cardCount > 0 && budget > 0) {
      const takeMinutes = Math.min(due.minutes, budget);
      if (takeMinutes > 0) {
        activities.push({
          date,
          kind: "fsrs_review",
          objectiveIds: due.objectiveIds,
          subjectId: subjectForObjectives(due.objectiveIds, state.objectives),
          examGoalId: goal?.id,
          plannedMinutes: takeMinutes,
          cardCount: due.cardCount,
          purpose: "retention",
          score: 1,
          reasons: [
            `${due.cardCount} card${due.cardCount === 1 ? "" : "s"} due`,
            "Scheduled first so recall doesn't lapse",
          ],
        });
        budget -= takeMinutes;
      }
    }

    // 2. Fixed-date mock exams.
    for (const mock of mocks) {
      if (mock.date !== date || budget <= 0) continue;
      const takeMinutes = Math.min(MOCK_EXAM_MINUTES, budget);
      if (takeMinutes > 0) {
        activities.push({
          date,
          kind: "mock_exam",
          objectiveIds: mock.objectiveIds,
          subjectId: mock.subjectId,
          examGoalId: goal?.id,
          plannedMinutes: takeMinutes,
          purpose: "assessment",
          score: 1,
          reasons: [`External deadline: ${mock.label}`],
        });
        budget -= takeMinutes;
      }
    }

    // 3. Flexible work by priority, respecting prerequisites and mastery state.
    // Recompute candidates after each session so a day is filled with the next
    // highest-value work, one preferred-session chunk at a time. Chunks of the
    // same objective and kind are merged so each schedule row stays unique.
    const flexibleByKey = new Map<string, PlannedActivity>();
    while (budget > 0) {
      const candidates = workItems
        .map((item) => ({ item, candidate: nextCandidate(item, sessionMinutes) }))
        .filter(
          (entry): entry is { item: WorkItem; candidate: Candidate } => entry.candidate !== null,
        )
        .sort((a, b) => {
          if (a.item.optional !== b.item.optional) return a.item.optional ? 1 : -1;
          const scoreDiff = b.item.priority.score - a.item.priority.score;
          if (scoreDiff !== 0) return scoreDiff;
          return a.item.objective.id.localeCompare(b.item.objective.id);
        });

      const best = candidates[0];
      if (!best) break;
      const take = Math.min(best.candidate.minutes, budget);
      if (take <= 0) break;
      if (best.candidate.kind === "learn_new_content") {
        best.item.remainingLearning -= take;
      } else {
        best.item.remainingPractice -= take;
      }

      const next: PlannedActivity = {
        date,
        kind: best.candidate.kind,
        objectiveIds: [best.item.objective.id],
        subjectId: best.item.objective.subjectId,
        examGoalId: goal?.id,
        questionType: best.candidate.questionType,
        plannedMinutes: take,
        questionCount: questionCountFor(best.candidate.kind, best.candidate.questionType, take, capacity),
        purpose: best.candidate.purpose,
        score: round2(best.item.priority.score),
        reasons: best.candidate.reasons,
      };

      const key = stableActivityKey(next);
      const merged = flexibleByKey.get(key);
      if (merged) {
        merged.plannedMinutes += take;
        if (next.questionCount !== undefined) {
          merged.questionCount = (merged.questionCount ?? 0) + next.questionCount;
        }
      } else {
        flexibleByKey.set(key, next);
      }
      budget -= take;
    }
    activities.push(...flexibleByKey.values());

    days.push({
      date,
      weekday: weekdayOfDateKey(date),
      isStudyDay: studyDay,
      capacityMinutes: cap,
      allocatedMinutes:
        pinnedMinutes + activities.reduce((sum, activity) => sum + activity.plannedMinutes, 0),
      activities,
      pinnedMinutes,
      pinnedActivities: pinned,
    });
  }

  return {
    goalId: goal?.id ?? null,
    goalName: goal?.name ?? null,
    examDate: goal?.examDate ?? null,
    generatedAt: now.toISOString(),
    horizonStart: today,
    horizonEnd,
    days,
    dueForecast,
    feasibility,
    blockedObjectives,
    warnings,
  };
}

/**
 * Stable identity for a planner activity. Reconciliation uses this key so that
 * replanning updates/removes/adjusts rows instead of wiping the schedule.
 */
export function stableActivityKey(activity: {
  date: string;
  kind: ActivityKind;
  objectiveIds: string[];
  subjectId: string;
}): string {
  return [activity.date, activity.kind, activity.subjectId, [...activity.objectiveIds].sort().join(",")].join(
    "|",
  );
}
