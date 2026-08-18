import { applyReview, emptyCardState } from "./fsrs";
import { db, uid } from "./db";
import { stableActivityKey, type PlannedActivity } from "./plan";
import {
  availabilitySchema,
  examGoalSchema,
  fsrsCardSchema,
  learningObjectiveSchema,
  practiceAttemptSchema,
  questionSchema,
  reviewLogSchema,
  sessionLogSchema,
  studyActivitySchema,
  subjectSchema,
  topicSchema,
  unitSchema,
} from "./schemas";
import type {
  ActivityKind,
  ActivityStatus,
  Availability,
  ExamGoal,
  FsrsCard,
  LearningObjective,
  PracticeAttempt,
  Question,
  QuestionType,
  ReviewGrade,
  ReviewLog,
  SessionLog,
  StudyActivity,
  Subject,
  Topic,
  Unit,
} from "./types";

type OmitId<T> = Omit<T, "id">;

function omitKey<T extends Record<string, unknown>>(record: T, key: string): T {
  const { [key]: _removed, ...rest } = record;
  return rest as T;
}

function omitKeys<T extends Record<string, unknown>>(record: T, keys: Set<string>): T {
  const result = { ...record };
  for (const key of keys) delete result[key];
  return result;
}

// --- Curriculum ---

export async function createSubject(title: string): Promise<Subject> {
  const subject = subjectSchema.parse({ id: uid(), title });
  await db.subjects.add(subject);
  return subject;
}

export async function createUnit(subjectId: string, title: string): Promise<Unit> {
  const unit = unitSchema.parse({ id: uid(), subjectId, title });
  await db.units.add(unit);
  return unit;
}

export async function createTopic(subjectId: string, unitId: string, title: string): Promise<Topic> {
  const topic = topicSchema.parse({ id: uid(), subjectId, unitId, title });
  await db.topics.add(topic);
  return topic;
}

export async function createObjective(input: OmitId<LearningObjective>): Promise<LearningObjective> {
  const objective = learningObjectiveSchema.parse({ ...input, id: uid() });
  const pruned = await prunePrerequisites(objective);
  await db.objectives.add(pruned);
  return pruned;
}

export async function updateObjective(objective: LearningObjective): Promise<void> {
  const parsed = learningObjectiveSchema.parse(objective);
  await db.objectives.put(await prunePrerequisites(parsed));
}

/** Only keep prerequisites that actually exist (and never allow self-reference). */
async function prunePrerequisites(objective: LearningObjective): Promise<LearningObjective> {
  const existing = new Set<string>(await db.objectives.toCollection().primaryKeys());
  return {
    ...objective,
    prerequisiteIds: objective.prerequisiteIds.filter(
      (id) => existing.has(id) && id !== objective.id,
    ),
  };
}

/** Removes cards, questions, and their logs for a set of removed objectives. */
async function deleteMeasurementForObjectives(objectiveIds: string[]): Promise<void> {
  if (objectiveIds.length === 0) return;
  await Promise.all([
    db.cards.where("objectiveId").anyOf(objectiveIds).delete(),
    db.questions.where("objectiveId").anyOf(objectiveIds).delete(),
    db.reviewLogs.where("objectiveId").anyOf(objectiveIds).delete(),
    db.practiceAttempts.where("objectiveId").anyOf(objectiveIds).delete(),
  ]);
}

/**
 * Drops deleted objectives from the schedule so no orphaned rows survive a
 * curriculum deletion. Single-objective rows (learning/practice) are deleted
 * outright; multi-objective rows (reviews, mocks) keep their other objectives.
 * Session logs are left as append-only history so capacity is never erased.
 */
async function cleanActivitiesForObjectives(objectiveIds: string[]): Promise<void> {
  if (objectiveIds.length === 0) return;
  const removed = new Set(objectiveIds);
  const activities = await db.activities.toArray();
  const toDelete: string[] = [];
  const toUpdate: StudyActivity[] = [];
  for (const activity of activities) {
    if (!activity.objectiveIds.some((id) => removed.has(id))) continue;
    const nextObjectiveIds = activity.objectiveIds.filter((id) => !removed.has(id));
    if (nextObjectiveIds.length === 0) toDelete.push(activity.id);
    else toUpdate.push({ ...activity, objectiveIds: nextObjectiveIds });
  }
  if (toDelete.length > 0) await db.activities.bulkDelete(toDelete);
  if (toUpdate.length > 0) await db.activities.bulkPut(toUpdate);
}

async function removePrerequisiteReferences(objectiveIds: string[]): Promise<void> {
  if (objectiveIds.length === 0) return;
  const removed = new Set(objectiveIds);
  const objectives = await db.objectives.toArray();
  const updates = objectives
    .filter((objective) => objective.prerequisiteIds.some((id) => removed.has(id)))
    .map((objective) => ({
      ...objective,
      prerequisiteIds: objective.prerequisiteIds.filter((id) => !removed.has(id)),
    }));
  await Promise.all(updates.map((objective) => db.objectives.put(objective)));
}

async function cleanGoalsForRemoved(input: {
  subjectId?: string;
  topicIds: string[];
}): Promise<void> {
  const topicSet = new Set(input.topicIds);
  const goals = await db.examGoals.toArray();
  const changed = goals.filter((goal) => {
    const subjectTouched =
      input.subjectId !== undefined &&
      (goal.subjectIds.includes(input.subjectId) || input.subjectId in goal.subjectWeighting);
    const topicsTouched =
      goal.optionalTopicIds.some((id) => topicSet.has(id)) ||
      Object.keys(goal.topicPriorities).some((id) => topicSet.has(id));
    return subjectTouched || topicsTouched;
  });

  await Promise.all(
    changed.map((goal) =>
      db.examGoals.put({
        ...goal,
        subjectIds:
          input.subjectId !== undefined
            ? goal.subjectIds.filter((id) => id !== input.subjectId)
            : goal.subjectIds,
        subjectWeighting:
          input.subjectId !== undefined
            ? omitKey(goal.subjectWeighting, input.subjectId)
            : goal.subjectWeighting,
        optionalTopicIds: goal.optionalTopicIds.filter((id) => !topicSet.has(id)),
        topicPriorities: omitKeys(goal.topicPriorities, topicSet),
      }),
    ),
  );
}

export async function deleteSubject(subjectId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.subjects,
      db.units,
      db.topics,
      db.objectives,
      db.examGoals,
      db.cards,
      db.questions,
      db.reviewLogs,
      db.practiceAttempts,
      db.activities,
    ],
    async () => {
      const topicIds = (await db.topics.where("subjectId").equals(subjectId).toArray()).map(
        (topic) => topic.id,
      );
      const objectiveIds = (
        await db.objectives.where("subjectId").equals(subjectId).toArray()
      ).map((objective) => objective.id);

      await db.objectives.where("subjectId").equals(subjectId).delete();
      await db.topics.where("subjectId").equals(subjectId).delete();
      await db.units.where("subjectId").equals(subjectId).delete();
      await db.subjects.delete(subjectId);

      await deleteMeasurementForObjectives(objectiveIds);
      await cleanActivitiesForObjectives(objectiveIds);
      await removePrerequisiteReferences(objectiveIds);
      await cleanGoalsForRemoved({ subjectId, topicIds });
    },
  );
}

export async function deleteUnit(unitId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.units,
      db.topics,
      db.objectives,
      db.examGoals,
      db.cards,
      db.questions,
      db.reviewLogs,
      db.practiceAttempts,
      db.activities,
    ],
    async () => {
      const topics = await db.topics.where("unitId").equals(unitId).toArray();
      const topicIds = topics.map((topic) => topic.id);
      const objectiveIds = topicIds.length
        ? (await db.objectives.where("topicId").anyOf(topicIds).toArray()).map(
            (objective) => objective.id,
          )
        : [];

      if (topicIds.length) await db.objectives.where("topicId").anyOf(topicIds).delete();
      await db.topics.where("unitId").equals(unitId).delete();
      await db.units.delete(unitId);

      await deleteMeasurementForObjectives(objectiveIds);
      await cleanActivitiesForObjectives(objectiveIds);
      await removePrerequisiteReferences(objectiveIds);
      await cleanGoalsForRemoved({ topicIds });
    },
  );
}

export async function deleteTopic(topicId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.topics,
      db.objectives,
      db.examGoals,
      db.cards,
      db.questions,
      db.reviewLogs,
      db.practiceAttempts,
      db.activities,
    ],
    async () => {
      const objectiveIds = (await db.objectives.where("topicId").equals(topicId).toArray()).map(
        (objective) => objective.id,
      );
      await db.objectives.where("topicId").equals(topicId).delete();
      await db.topics.delete(topicId);

      await deleteMeasurementForObjectives(objectiveIds);
      await cleanActivitiesForObjectives(objectiveIds);
      await removePrerequisiteReferences(objectiveIds);
      await cleanGoalsForRemoved({ topicIds: [topicId] });
    },
  );
}

export async function deleteObjective(objectiveId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.objectives, db.cards, db.questions, db.reviewLogs, db.practiceAttempts, db.activities],
    async () => {
      await db.objectives.delete(objectiveId);
      await deleteMeasurementForObjectives([objectiveId]);
      await cleanActivitiesForObjectives([objectiveId]);
      await removePrerequisiteReferences([objectiveId]);
    },
  );
}

// --- Exam goals ---

export async function createExamGoal(input: OmitId<ExamGoal>): Promise<ExamGoal> {
  const goal = examGoalSchema.parse({ ...input, id: uid() });
  await db.examGoals.add(goal);
  return goal;
}

export async function updateExamGoal(goal: ExamGoal): Promise<void> {
  await db.examGoals.put(examGoalSchema.parse(goal));
}

export async function deleteExamGoal(goalId: string): Promise<void> {
  await db.transaction("rw", [db.examGoals, db.activities], async () => {
    await db.examGoals.delete(goalId);
    await db.activities.where("examGoalId").equals(goalId).delete();
  });
}

// --- Availability ---

export async function saveAvailability(input: Availability): Promise<void> {
  await db.availability.put(availabilitySchema.parse(input));
}

// --- Activities (stored and queryable; scheduled by the planner in phase 3) ---

export async function addActivity(input: OmitId<StudyActivity>): Promise<StudyActivity> {
  const activity = studyActivitySchema.parse({ ...input, id: uid() });
  await db.activities.add(activity);
  return activity;
}

export async function activitiesForDate(date: string): Promise<StudyActivity[]> {
  return db.activities.where("date").equals(date).toArray();
}

/**
 * Persists a student edit to a scheduled activity (complete, skip, move,
 * postpone, restore) and keeps its linked session log in step with the row's
 * outcome. Completing/skipping writes the outcome fact; restoring a finished
 * row withdraws its previously recorded fact so the observed-capacity model
 * can't double-count when the row is later completed again.
 */
export async function saveActivity(activity: StudyActivity): Promise<void> {
  const parsed = studyActivitySchema.parse(activity);
  await db.transaction("rw", [db.activities, db.sessionLogs], async () => {
    const previous = await db.activities.get(parsed.id);
    const wasTerminal = previous?.status === "completed" || previous?.status === "skipped";
    const isTerminal = parsed.status === "completed" || parsed.status === "skipped";

    await db.activities.put(parsed);

    if (wasTerminal && !isTerminal) {
      // Restore: the row is no longer finished, so its outcome fact is withdrawn.
      await db.sessionLogs.where("activityId").equals(parsed.id).delete();
    } else if (isTerminal) {
      await db.sessionLogs.add(
        sessionLogSchema.parse({
          id: uid(),
          date: parsed.date,
          activityId: parsed.id,
          kind: parsed.kind,
          objectiveIds: parsed.objectiveIds,
          plannedMinutes: parsed.plannedMinutes,
          actualMinutes:
            parsed.status === "completed"
              ? Math.max(1, parsed.completedMinutes ?? parsed.plannedMinutes)
              : 0,
          status: parsed.status,
          endedAt: new Date().toISOString(),
        }),
      );
    }
  });
}

/** Shared persistence for a student-initiated reschedule: manual, pinned, fresh. */
async function writeReschedule(
  activityId: string,
  patch: { date: string; start?: string; end?: string; status: ActivityStatus },
): Promise<void> {
  const activity = await db.activities.get(activityId);
  if (!activity) return;
  await db.activities.put(
    studyActivitySchema.parse({
      ...activity,
      date: patch.date,
      start: patch.start,
      end: patch.end,
      source: "manual",
      pinned: true,
      status: patch.status,
      completedMinutes: undefined,
    }),
  );
}

/**
 * Persists a drag-and-drop reschedule. Moving a row makes it a student-owned
 * lock (`source: "manual"` + `pinned: true`) so the planner keeps it exactly
 * where the student put it instead of reallocating or deleting it on re-apply.
 * A `start`/`end` of undefined clears a clock placement.
 */
export async function moveActivity(
  activityId: string,
  target: { date: string; start?: string; end?: string },
): Promise<void> {
  await db.transaction("rw", db.activities, async () => {
    await writeReschedule(activityId, { ...target, status: "planned" });
  });
}

/**
 * Defers an activity to a later study day. Writes a `postponed` SessionLog for
 * the original date so the observed-capacity model learns the student's
 * postponement pattern, then re-places the row as a manual/pinned `postponed`
 * activity.
 */
export async function snoozeActivity(
  activityId: string,
  target: { date: string; start?: string; end?: string },
): Promise<void> {
  await db.transaction("rw", [db.activities, db.sessionLogs], async () => {
    const original = await db.activities.get(activityId);
    if (!original) return;
    await writeReschedule(activityId, { ...target, status: "postponed" });
    await db.sessionLogs.add(
      sessionLogSchema.parse({
        id: uid(),
        date: original.date,
        activityId: original.id,
        kind: original.kind,
        objectiveIds: original.objectiveIds,
        plannedMinutes: original.plannedMinutes,
        actualMinutes: 0,
        status: "postponed",
        endedAt: new Date().toISOString(),
      }),
    );
  });
}

/**
 * Swaps a scheduled slot's content in place, keeping its date and clock time.
 * The row becomes a student-owned lock (`manual` + `pinned`) so the planner
 * won't silently swap it back. Stale counts are cleared.
 */
export async function replaceActivity(
  activityId: string,
  replacement: {
    objectiveIds: string[];
    subjectId: string;
    kind: ActivityKind;
    questionType?: QuestionType;
  },
): Promise<void> {
  await db.transaction("rw", db.activities, async () => {
    const activity = await db.activities.get(activityId);
    if (!activity) return;
    await db.activities.put(
      studyActivitySchema.parse({
        ...activity,
        objectiveIds: replacement.objectiveIds,
        subjectId: replacement.subjectId,
        kind: replacement.kind,
        questionType: replacement.questionType,
        questionCount: undefined,
        cardCount: undefined,
        source: "manual",
        pinned: true,
        status: "planned",
        completedMinutes: undefined,
      }),
    );
  });
}

/**
 * Closes the schedule↔session loop when a real session fulfills an activity.
 * With `activityId`, the exact linked row is completed (any source — a dragged
 * manual row is still a real row). Without it (an FSRS review run that doesn't
 * link to a specific row), the matching untouched planner rows for that
 * date+kind are completed. Already-finished work is never rewritten.
 */
export async function closePlannedActivity(input: {
  date: string;
  kind: ActivityKind;
  minutes: number;
  activityId?: string;
}): Promise<void> {
  const candidates = (await db.activities.where("date").equals(input.date).toArray()).filter(
    (activity) =>
      activity.kind === input.kind &&
      (activity.status === "planned" || activity.status === "in_progress"),
  );
  const matches = input.activityId
    ? candidates.filter((activity) => activity.id === input.activityId)
    : candidates.filter((activity) => activity.source === "planner");
  if (matches.length === 0) return;
  await db.activities.bulkPut(
    matches.map((activity) => ({
      ...activity,
      status: "completed",
      completedMinutes:
        activity.completedMinutes !== undefined && activity.completedMinutes > 0
          ? Math.max(activity.completedMinutes, input.minutes)
          : input.minutes,
    })),
  );
}

/**
 * Reconciles the derived plan into the `activities` table by stable key:
 * - New planner activities are added as `planned`.
 * - Existing matching rows keep their status and refresh plan fields.
 * - Stale planner rows in the range that the student hasn't started are removed.
 * - `in_progress` / `completed` work is never deleted, and manual rows are untouched.
 * - Clock placements (keyed by stable activity key) are attached to new rows and
 *   refreshed on still-planned rows.
 */
export async function applyPlan(
  planned: PlannedActivity[],
  range: { start: string; end: string },
  placements: Map<string, { start: string; end: string }> = new Map(),
): Promise<void> {
  const existing = (
    await db.activities.where("date").between(range.start, range.end, true, true).toArray()
  ).filter((activity) => activity.source === "planner");

  const plannedByKey = new Map<string, PlannedActivity>();
  for (const item of planned) plannedByKey.set(stableActivityKey(item), item);
  const existingByKey = new Map<string, StudyActivity>();
  for (const item of existing) {
    // Completed rows are a historical record of finished work: they must never
    // absorb newly-owed minutes on a re-apply, so exclude them from matching.
    if (item.status === "completed") continue;
    existingByKey.set(stableActivityKey(item), item);
  }

  const toAdd: StudyActivity[] = [];
  const toUpdate: StudyActivity[] = [];
  const toDelete: string[] = [];

  for (const item of planned) {
    const key = stableActivityKey(item);
    const current = existingByKey.get(key);
    const placement = placements.get(key);
    if (current) {
      // A pinned row is a student lock: keep its date, minutes, and status as-is.
      if (current.pinned) continue;
      toUpdate.push({
        ...current,
        examGoalId: item.examGoalId,
        plannedMinutes: item.plannedMinutes,
        questionCount: item.questionCount,
        cardCount: item.cardCount,
        questionType: item.questionType,
        purpose: item.purpose,
        start: placement?.start,
        end: placement?.end,
      });
    } else {
      toAdd.push(
        studyActivitySchema.parse({
          id: uid(),
          examGoalId: item.examGoalId,
          date: item.date,
          kind: item.kind,
          objectiveIds: item.objectiveIds,
          subjectId: item.subjectId,
          questionType: item.questionType,
          plannedMinutes: item.plannedMinutes,
          questionCount: item.questionCount,
          cardCount: item.cardCount,
          purpose: item.purpose,
          status: "planned",
          source: "planner",
          start: placement?.start,
          end: placement?.end,
        }),
      );
    }
  }

  for (const current of existing) {
    const key = stableActivityKey(current);
    if (plannedByKey.has(key)) continue;
    if (current.pinned) continue;
    if (
      current.status === "planned" ||
      current.status === "missed" ||
      current.status === "postponed" ||
      current.status === "skipped"
    ) {
      toDelete.push(current.id);
    }
  }

  await db.transaction("rw", db.activities, async () => {
    if (toDelete.length > 0) await db.activities.bulkDelete(toDelete);
    if (toAdd.length > 0) await db.activities.bulkAdd(toAdd);
    if (toUpdate.length > 0) await db.activities.bulkPut(toUpdate);
  });
}

// --- Cards (phase 2) ---

export async function createCard(objectiveId: string, front: string, back: string): Promise<FsrsCard> {
  const now = new Date();
  const card = fsrsCardSchema.parse({
    id: uid(),
    objectiveId,
    front,
    back,
    ...emptyCardState(now),
    suspended: false,
    createdAt: now.toISOString(),
  });
  await db.cards.add(card);
  return card;
}

export async function deleteCard(cardId: string): Promise<void> {
  await db.transaction("rw", [db.cards, db.reviewLogs], async () => {
    await db.cards.delete(cardId);
    await db.reviewLogs.where("cardId").equals(cardId).delete();
  });
}

/** Grades a card, persists the new FSRS state, and appends the review log atomically. */
export async function reviewCard(
  card: FsrsCard,
  grade: ReviewGrade,
  elapsedMs: number,
  now = new Date(),
): Promise<ReviewLog> {
  const result = applyReview(card, grade, now);
  const log = reviewLogSchema.parse({
    id: uid(),
    cardId: card.id,
    objectiveId: card.objectiveId,
    grade,
    state: result.log.state,
    due: result.log.due,
    stability: result.log.stability,
    difficulty: result.log.difficulty,
    scheduledDays: result.log.scheduledDays,
    elapsedMs,
    reviewedAt: now.toISOString(),
  });
  await db.transaction("rw", [db.cards, db.reviewLogs], async () => {
    await db.cards.put(result.card);
    await db.reviewLogs.add(log);
  });
  return log;
}

// --- Questions (phase 2) ---

export async function createQuestion(input: Omit<Question, "id" | "createdAt">): Promise<Question> {
  const question = questionSchema.parse({
    ...input,
    id: uid(),
    createdAt: new Date().toISOString(),
  });
  await db.questions.add(question);
  return question;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await db.transaction("rw", [db.questions, db.practiceAttempts], async () => {
    await db.questions.delete(questionId);
    await db.practiceAttempts.where("questionId").equals(questionId).delete();
  });
}

// --- Event logs (phase 2) ---

export async function addPracticeAttempt(input: OmitId<PracticeAttempt>): Promise<PracticeAttempt> {
  const attempt = practiceAttemptSchema.parse({ ...input, id: uid() });
  await db.practiceAttempts.add(attempt);
  return attempt;
}

export async function addSessionLog(input: OmitId<SessionLog>): Promise<SessionLog> {
  const log = sessionLogSchema.parse({ ...input, id: uid() });
  await db.sessionLogs.add(log);
  return log;
}
