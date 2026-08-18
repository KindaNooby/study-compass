import { z } from "zod";

export const questionTypeSchema = z.enum(["mcq", "structured"]);
export const timeOfDaySchema = z.enum(["morning", "afternoon", "evening", "night"]);
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const activityKindSchema = z.enum([
  "fsrs_review",
  "learn_new_content",
  "retrieval_practise",
  "mcq_practise",
  "structured_practise",
  "error_correction",
  "mixed_exam_practice",
  "mock_exam",
]);

export const activityStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
  "skipped",
  "missed",
  "postponed",
]);

export const activityPurposeSchema = z.enum([
  "learning",
  "application",
  "retention",
  "diagnosis",
  "assessment",
]);

export const subjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Enter a title").max(120),
});

export const unitSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1, "Enter a title").max(120),
});

export const topicSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  unitId: z.string().min(1),
  title: z.string().trim().min(1, "Enter a title").max(120),
});

export const learningObjectiveSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  topicId: z.string().min(1),
  title: z.string().trim().min(1, "Enter a title").max(200),
  importance: z.number().min(0).max(1),
  estimatedLearningMinutes: z.number().int().min(0).max(100000),
  estimatedPracticeMinutes: z.number().int().min(0).max(100000),
  prerequisiteIds: z.array(z.string()),
  questionTypes: z.array(questionTypeSchema),
});

const energyByTimeOfDaySchema = z.object({
  morning: z.number().min(0).max(1),
  afternoon: z.number().min(0).max(1),
  evening: z.number().min(0).max(1),
  night: z.number().min(0).max(1),
});

export const timeWindowSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: clockTimeSchema,
    end: clockTimeSchema,
  })
  .refine((window) => window.start < window.end, {
    message: "End time must be after start time",
  });

export const fixedCommitmentSchema = z
  .object({
    id: z.string().min(1),
    day: z.number().int().min(0).max(6),
    start: clockTimeSchema,
    end: clockTimeSchema,
    label: z.string().trim().min(1, "Enter a label").max(120),
  })
  .refine((commitment) => commitment.start < commitment.end, {
    message: "End time must be after start time",
  });

export const availabilitySchema = z.object({
  id: z.string().min(1),
  availableDays: z.array(z.number().int().min(0).max(6)),
  timeWindows: z.array(timeWindowSchema),
  maxDailyStudyMinutes: z.number().int().min(0).max(1440),
  bufferFactor: z.number().min(0).max(1).optional(),
  preferredSessionMinutes: z.number().int().min(0).max(1440),
  preferredStudyTimes: z.array(timeOfDaySchema),
  fixedCommitments: z.array(fixedCommitmentSchema),
  unavailableDates: z.array(dateKeySchema),
  restDays: z.array(z.number().int().min(0).max(6)),
  energyByTimeOfDay: energyByTimeOfDaySchema,
});

export const externalDeadlineSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Enter a label").max(120),
  date: dateKeySchema,
});

export const examGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Enter a name").max(120),
  examDate: dateKeySchema,
  subjectIds: z.array(z.string()),
  targetGrade: z.string().trim().max(40).optional(),
  targetScore: z.number().int().min(0).max(100).optional(),
  topicPriorities: z.record(z.string(), z.number().min(0).max(1)),
  minimumRequiredCoverage: z.number().min(0).max(1).optional(),
  optionalTopicIds: z.array(z.string()),
  subjectWeighting: z.record(z.string(), z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1).optional(),
  externalDeadlines: z.array(externalDeadlineSchema),
});

export const studyActivitySchema = z.object({
  id: z.string().min(1),
  examGoalId: z.string().optional(),
  date: dateKeySchema,
  kind: activityKindSchema,
  objectiveIds: z.array(z.string()),
  subjectId: z.string().min(1),
  questionType: questionTypeSchema.optional(),
  plannedMinutes: z.number().int().min(1),
  questionCount: z.number().int().min(0).optional(),
  cardCount: z.number().int().min(0).optional(),
  purpose: activityPurposeSchema,
  status: activityStatusSchema,
  completedMinutes: z.number().int().min(0).optional(),
  source: z.enum(["planner", "manual"]),
  pinned: z.boolean().optional(),
  start: clockTimeSchema.optional(),
  end: clockTimeSchema.optional(),
});

// --- Phase 2: measurement ---

export const cardStateSchema = z.enum(["New", "Learning", "Review", "Relearning"]);
export const reviewGradeSchema = z.enum(["Again", "Hard", "Good", "Easy"]);
export const isoDateTimeSchema = z.string().datetime();

export const fsrsCardSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  front: z.string().trim().min(1, "Enter the question side").max(1000),
  back: z.string().trim().min(1, "Enter the answer side").max(4000),
  due: isoDateTimeSchema,
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  elapsedDays: z.number().min(0),
  scheduledDays: z.number().min(0),
  learningSteps: z.number().int().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: cardStateSchema,
  lastReview: isoDateTimeSchema.nullable(),
  suspended: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const mcqOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, "Enter the option text").max(500),
});

export const questionSchema = z
  .object({
    id: z.string().min(1),
    objectiveId: z.string().min(1),
    kind: questionTypeSchema,
    prompt: z.string().trim().min(1, "Enter a prompt").max(4000),
    options: z.array(mcqOptionSchema),
    correctOptionId: z.string().nullable(),
    answerNote: z.string().max(4000),
    difficulty: z.number().min(0).max(1),
    errorCategoryIds: z.array(z.string()),
    createdAt: isoDateTimeSchema,
  })
  .refine(
    (question) =>
      question.kind !== "mcq" ||
      (question.options.length >= 2 &&
        question.correctOptionId !== null &&
        question.options.some((option) => option.id === question.correctOptionId)),
    { message: "MCQ questions need at least two options and a marked correct answer" },
  );

export const reviewLogSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  objectiveId: z.string().min(1),
  grade: reviewGradeSchema,
  state: cardStateSchema,
  due: isoDateTimeSchema,
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  scheduledDays: z.number().min(0),
  elapsedMs: z.number().int().min(0),
  activityId: z.string().optional(),
  reviewedAt: isoDateTimeSchema,
});

export const practiceAttemptSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().nullable(),
  objectiveId: z.string().min(1),
  kind: questionTypeSchema,
  correct: z.boolean(),
  score: z.number().min(0).nullable(),
  maxScore: z.number().min(0).nullable(),
  timeSeconds: z.number().int().min(0),
  difficulty: z.number().min(0).max(1),
  errorCategoryId: z.string().nullable(),
  activityId: z.string().optional(),
  attemptedAt: isoDateTimeSchema,
});

export const sessionStatusSchema = z.enum([
  "completed",
  "partial",
  "skipped",
  "missed",
  "postponed",
]);

export const sessionLogSchema = z.object({
  id: z.string().min(1),
  date: dateKeySchema,
  activityId: z.string().optional(),
  kind: activityKindSchema.optional(),
  objectiveIds: z.array(z.string()),
  plannedMinutes: z.number().int().min(0),
  actualMinutes: z.number().int().min(0),
  status: sessionStatusSchema,
  startedAt: isoDateTimeSchema.optional(),
  endedAt: isoDateTimeSchema.optional(),
  note: z.string().max(1000).optional(),
});
