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
  /** Student lock: the planner keeps this where it is instead of reallocating it. */
  pinned?: boolean;
  /** Clock placement on `date`, assigned by the timetable (phase 4). */
  start?: string; // HH:MM
  end?: string; // HH:MM
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

// --- Phase 2: measurement ---

export type CardState = "New" | "Learning" | "Review" | "Relearning";
export type ReviewGrade = "Again" | "Hard" | "Good" | "Easy";

/**
 * A flashcard with FSRS memory state. Dates are stored as ISO strings so the
 * whole store stays JSON-serializable; the fsrs wrapper converts to/from
 * ts-fsrs `Card` objects at the boundary.
 */
export type FsrsCard = {
  id: string;
  objectiveId: string;
  front: string;
  back: string;
  due: string; // ISO datetime
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: string | null; // ISO datetime
  suspended: boolean;
  createdAt: string; // ISO datetime
};

export type McqOption = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  objectiveId: string;
  kind: QuestionType;
  prompt: string;
  /** MCQ only. */
  options: McqOption[];
  /** MCQ only; the id of the correct option. */
  correctOptionId: string | null;
  /** Explanation or structured mark scheme. */
  answerNote: string;
  /** 0..1, harder questions sit closer to 1. */
  difficulty: number;
  errorCategoryIds: string[];
  createdAt: string; // ISO datetime
};

export type ReviewLog = {
  id: string;
  cardId: string;
  objectiveId: string;
  grade: ReviewGrade;
  /** Card state after this review. */
  state: CardState;
  /** Next due time after this review. */
  due: string; // ISO datetime
  stability: number;
  difficulty: number;
  scheduledDays: number;
  elapsedMs: number;
  activityId?: string;
  reviewedAt: string; // ISO datetime
};

export type PracticeAttempt = {
  id: string;
  /** Null when the attempt is logged without a specific question. */
  questionId: string | null;
  objectiveId: string;
  kind: QuestionType;
  /** MCQ: whether the chosen answer was correct. */
  correct: boolean;
  /** Structured: marks earned. */
  score: number | null;
  /** Structured: marks available. */
  maxScore: number | null;
  timeSeconds: number;
  /** 0..1, mirrors the question difficulty. */
  difficulty: number;
  errorCategoryId: string | null;
  activityId?: string;
  attemptedAt: string; // ISO datetime
};

export type SessionStatus = "completed" | "partial" | "skipped" | "missed" | "postponed";

export type SessionLog = {
  id: string;
  date: string; // YYYY-MM-DD
  activityId?: string;
  kind?: ActivityKind;
  objectiveIds: string[];
  plannedMinutes: number;
  actualMinutes: number;
  status: SessionStatus;
  startedAt?: string; // ISO datetime
  endedAt?: string; // ISO datetime
  note?: string;
};

export type AcquisitionLevel =
  | "not_started"
  | "introduced"
  | "partially_learned"
  | "practised"
  | "ready";

export type ErrorCategory = {
  id: string;
  label: string;
};

/** Fixed, configurable taxonomy for classifying practice mistakes. */
export const ERROR_CATEGORIES: ErrorCategory[] = [
  { id: "knowledge-gap", label: "Knowledge gap" },
  { id: "misconception", label: "Misconception" },
  { id: "careless-slip", label: "Careless slip" },
  { id: "misread-question", label: "Misread question" },
  { id: "time-pressure", label: "Time pressure" },
  { id: "recall-failure", label: "Recall failure" },
  { id: "other", label: "Other" },
];

export const REVIEW_GRADES: ReviewGrade[] = ["Again", "Hard", "Good", "Easy"];

export const ACQUISITION_LABELS: Record<AcquisitionLevel, string> = {
  not_started: "Not started",
  introduced: "Introduced",
  partially_learned: "Partially learned",
  practised: "Practised",
  ready: "Ready",
};
