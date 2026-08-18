import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";
import type { Card, Grade } from "ts-fsrs";

import type { CardState, FsrsCard, ReviewGrade } from "./types";

const scheduler = fsrs();

const STATE_TO_ENUM: Record<CardState, State> = {
  New: State.New,
  Learning: State.Learning,
  Review: State.Review,
  Relearning: State.Relearning,
};

const ENUM_TO_STATE: Record<State, CardState> = {
  [State.New]: "New",
  [State.Learning]: "Learning",
  [State.Review]: "Review",
  [State.Relearning]: "Relearning",
};

const GRADE_TO_RATING: Record<ReviewGrade, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

export function toFsrsCard(card: FsrsCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_ENUM[card.state],
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };
}

type StoredCardFields = Pick<
  FsrsCard,
  | "due"
  | "stability"
  | "difficulty"
  | "elapsedDays"
  | "scheduledDays"
  | "learningSteps"
  | "reps"
  | "lapses"
  | "state"
  | "lastReview"
>;

export function fromFsrsCard(card: Card): StoredCardFields {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: ENUM_TO_STATE[card.state],
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** The initial FSRS memory state for a brand-new card. */
export function emptyCardState(now = new Date()): StoredCardFields {
  return fromFsrsCard(createEmptyCard(now));
}

/**
 * Applies one FSRS grade and returns the next card state plus the fields the
 * review log records. Pure: the caller persists both.
 */
export function applyReview(
  card: FsrsCard,
  grade: ReviewGrade,
  now = new Date(),
): {
  card: FsrsCard;
  log: {
    grade: ReviewGrade;
    state: CardState;
    due: string;
    stability: number;
    difficulty: number;
    scheduledDays: number;
  };
} {
  const result = scheduler.next(toFsrsCard(card), now, GRADE_TO_RATING[grade]);
  // `result.card` is the post-review state; ts-fsrs' `result.log` uses pre-review
  // semantics for `state`/`due`, so derive the recorded history from the card.
  const next = fromFsrsCard(result.card);
  return {
    card: { ...card, ...next },
    log: {
      grade,
      state: next.state,
      due: next.due,
      stability: next.stability,
      difficulty: next.difficulty,
      scheduledDays: next.scheduledDays,
    },
  };
}

/** Probability of recall (0..1). New cards report 1; unstable cards report 0. */
export function retrievability(card: FsrsCard, now = new Date()): number {
  if (card.state === "New") return 1;
  if (card.stability <= 0) return 0;
  return scheduler.get_retrievability(toFsrsCard(card), now, false);
}

export function isDue(card: FsrsCard, now = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/**
 * Day-granular "is this card due today (or earlier)?" — matches the planner's
 * date-key bucketing so the review queue agrees with the weekly plan. The
 * wall-clock `isDue` above remains the exact "due right now" check used for
 * live counters.
 */
export function isDueByDay(card: FsrsCard, now = new Date()): boolean {
  const due = new Date(card.due);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return dueDay <= nowDay;
}
