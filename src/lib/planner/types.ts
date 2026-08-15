export type QuestionType = "mcq" | "structured";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export type Subject = {
  id: string;
  title: string;
};

export type Unit = {
  id: string;
  subjectId: string;
  title: string;
};

export type Topic = {
  id: string;
  subjectId: string;
  unitId: string;
  title: string;
};

export type LearningObjective = {
  id: string;
  subjectId: string;
  topicId: string;
  title: string;
  /** How much this objective matters for the exam, 0..1. */
  importance: number;
  /** Estimated minutes for first exposure to the material. */
  estimatedLearningMinutes: number;
  /** Estimated minutes of practice required to apply the material. */
  estimatedPracticeMinutes: number;
  /** Objective ids that must be learned first. */
  prerequisiteIds: string[];
  /** Question types that assess this objective. */
  questionTypes: QuestionType[];
};

export type ExternalDeadline = {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
};

export type ExamGoal = {
  id: string;
  name: string;
  examDate: string; // YYYY-MM-DD
  subjectIds: string[];
  targetGrade?: string;
  targetScore?: number; // 0..100
  /** topicId -> priority 0..1 */
  topicPriorities: Record<string, number>;
  /** Minimum curriculum coverage required, 0..1. */
  minimumRequiredCoverage?: number;
  optionalTopicIds: string[];
  /** subjectId -> weight 0..1 */
  subjectWeighting: Record<string, number>;
  confidence?: number; // 0..1
  externalDeadlines: ExternalDeadline[];
};

export type TimeWindow = {
  day: number; // 0=Sun..6=Sat
  start: string; // HH:MM
  end: string; // HH:MM
};

export type FixedCommitment = {
  id: string;
  day: number; // 0=Sun..6=Sat
  start: string; // HH:MM
  end: string; // HH:MM
  label: string;
};

export type Availability = {
  id: string;
  availableDays: number[]; // 0=Sun..6=Sat
  timeWindows: TimeWindow[];
  maxDailyStudyMinutes: number;
  preferredSessionMinutes: number;
  preferredStudyTimes: TimeOfDay[];
  fixedCommitments: FixedCommitment[];
  unavailableDates: string[]; // YYYY-MM-DD
  restDays: number[]; // 0=Sun..6=Sat
  energyByTimeOfDay: Record<TimeOfDay, number>; // 0..1
};

export type ActivityKind =
  | "fsrs_review"
  | "learn_new_content"
  | "retrieval_practise"
  | "mcq_practise"
  | "structured_practise"
  | "error_correction"
  | "mixed_exam_practice"
  | "mock_exam";

export type ActivityStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "skipped"
  | "missed"
  | "postponed";

export type ActivityPurpose =
  | "learning"
  | "application"
  | "retention"
  | "diagnosis"
  | "assessment";

export type StudyActivity = {
  id: string;
  examGoalId?: string;
  date: string; // YYYY-MM-DD
  kind: ActivityKind;
  objectiveIds: string[];
  subjectId: string;
  questionType?: QuestionType;
  plannedMinutes: number;
  questionCount?: number;
  cardCount?: number;
  purpose: ActivityPurpose;
  status: ActivityStatus;
  completedMinutes?: number;
  source: "planner" | "manual";
};

export type Curriculum = {
  subjects: Subject[];
  units: Unit[];
  topics: Topic[];
  objectives: LearningObjective[];
};

/**
 * The versioned, serializable state that phases 2–4 consume. Phase 1 defines
 * the contract; the planner (phase 3) turns this plus `now` into a weekly plan.
 */
export type PlannerState = {
  version: 1;
  curriculum: Curriculum;
  examGoals: ExamGoal[];
  availability: Availability;
  activities: StudyActivity[];
};

export const ACTIVITY_KINDS: ActivityKind[] = [
  "fsrs_review",
  "learn_new_content",
  "retrieval_practise",
  "mcq_practise",
  "structured_practise",
  "error_correction",
  "mixed_exam_practice",
  "mock_exam",
];

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  fsrs_review: "FSRS review",
  learn_new_content: "Learn new content",
  retrieval_practise: "Retrieval practice",
  mcq_practise: "MCQ practice",
  structured_practise: "Structured practice",
  error_correction: "Error correction",
  mixed_exam_practice: "Mixed exam practice",
  mock_exam: "Mock exam",
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export const WEEKDAYS = [
  { value: 0, short: "Sun", long: "Sunday" },
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
] as const;
