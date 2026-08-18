import Dexie, { type EntityTable } from "dexie";

import type {
  Availability,
  ExamGoal,
  FsrsCard,
  LearningObjective,
  PracticeAttempt,
  Question,
  ReviewLog,
  SessionLog,
  StudyActivity,
  Subject,
  Topic,
  Unit,
} from "./types";

export type MetaDoc = {
  id: string;
  schemaVersion: number;
};

export const SCHEMA_VERSION = 2;
export const AVAILABILITY_ID = "main";
export const META_ID = "main";

export const db = new Dexie("study-compass") as Dexie & {
  meta: EntityTable<MetaDoc, "id">;
  subjects: EntityTable<Subject, "id">;
  units: EntityTable<Unit, "id">;
  topics: EntityTable<Topic, "id">;
  objectives: EntityTable<LearningObjective, "id">;
  examGoals: EntityTable<ExamGoal, "id">;
  availability: EntityTable<Availability, "id">;
  activities: EntityTable<StudyActivity, "id">;
  cards: EntityTable<FsrsCard, "id">;
  questions: EntityTable<Question, "id">;
  reviewLogs: EntityTable<ReviewLog, "id">;
  practiceAttempts: EntityTable<PracticeAttempt, "id">;
  sessionLogs: EntityTable<SessionLog, "id">;
};

// v1: curriculum, goals, availability, activities (phase 1 foundation).
db.version(1).stores({
  meta: "id",
  subjects: "id",
  units: "id, subjectId",
  topics: "id, subjectId, unitId",
  objectives: "id, subjectId, topicId",
  examGoals: "id",
  availability: "id",
  activities: "id, date, examGoalId, [date+status]",
});

// v2: measurement content and the append-only event log (phase 2).
// Study activity is event-sourced: reviewLogs, practiceAttempts, and sessionLogs
// hold immutable facts. `cards` is the projected FSRS state, written atomically
// alongside its `card.reviewed` event by repository.reviewCard.
db.version(2).stores({
  cards: "id, objectiveId, due",
  questions: "id, objectiveId",
  reviewLogs: "id, cardId, objectiveId, reviewedAt",
  practiceAttempts: "id, questionId, objectiveId, attemptedAt",
  sessionLogs: "id, date, activityId, [date+status]",
});

export function uid(): string {
  return crypto.randomUUID();
}

export function emptyAvailability(): Availability {
  return {
    id: AVAILABILITY_ID,
    availableDays: [],
    timeWindows: [],
    maxDailyStudyMinutes: 0,
    bufferFactor: 0,
    preferredSessionMinutes: 0,
    preferredStudyTimes: [],
    fixedCommitments: [],
    unavailableDates: [],
    restDays: [],
    energyByTimeOfDay: { morning: 0, afternoon: 0, evening: 0, night: 0 },
  };
}

/** Idempotent initialization: stamps the schema version and creates the availability profile. */
export async function initDatabase(): Promise<void> {
  await db.meta.put({ id: META_ID, schemaVersion: SCHEMA_VERSION });
  const existing = await db.availability.get(AVAILABILITY_ID);
  if (!existing) {
    await db.availability.put(emptyAvailability());
  }
}
