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
});
