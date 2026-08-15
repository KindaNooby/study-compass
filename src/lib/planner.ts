export type ActivityKind =
  | "fsrs_review"
  | "learn_new_content"
  | "retrieval_practise"
  | "mcq_practise"
  | "structured_practise"
  | "error_correction"
  | "mixed_exam_practice"
  | "mock_exam";

export type ActivityStatus = "planned" | "in_progress" | "completed" | "skipped";
export type RiskState = "On track" | "Tight" | "At risk" | "Infeasible";

export type Topic = {
  id: string;
  subject: string;
  name: string;
  unit: string;
  importance: number;
  acquisition: number;
  retention: number;
  application: number;
  remainingLearningMinutes: number;
  remainingPracticeMinutes: number;
  dueCards: number;
  structuredAccuracy?: number;
  mcqAccuracy?: number;
  errorLabel: string;
};

export type StudyActivity = {
  id: string;
  date: string;
  type: ActivityKind;
  title: string;
  topicId?: string;
  subject: string;
  plannedMinutes: number;
  completedMinutes: number;
  detail: string;
  reason: string;
  status: ActivityStatus;
  questionCount?: number;
  cardCount?: number;
  pinned?: boolean;
};

export type PlannerState = {
  exam: {
    name: string;
    date: string;
    target: string;
    subjects: string[];
  };
  capacity: {
    availableDays: number[];
    minutesPerDay: number;
    observedCompletionRate: number;
    studyWindow: string;
    lastWeekCompletedMinutes: number;
  };
  topics: Topic[];
  activities: StudyActivity[];
};

export type DayPlan = {
  date: string;
  label: string;
  dayNumber: number;
  plannedMinutes: number;
  completedMinutes: number;
  capacityMinutes: number;
  activities: StudyActivity[];
};

export type PlannerView = {
  daysUntilExam: number;
  requiredMinutes: number;
  realisticCapacityMinutes: number;
  risk: RiskState;
  coverage: number;
  completedMinutes: number;
  plannedMinutes: number;
  dueCards: number;
  weeklyTargetMinutes: number;
  days: DayPlan[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

export function createInitialPlannerState(now = new Date()): PlannerState {
  const examDate = addDays(now, 39);
  const weekStart = startOfWeek(now);
  const day = (offset: number) => dateKey(addDays(weekStart, offset));

  const topics: Topic[] = [
    {
      id: "product.onboarding",
      subject: "Product",
      name: "Onboarding & activation",
      unit: "Module 04 · Customer onboarding",
      importance: 0.92,
      acquisition: 0.74,
      retention: 0.66,
      application: 0.58,
      remainingLearningMinutes: 20,
      remainingPracticeMinutes: 75,
      dueCards: 18,
      structuredAccuracy: 58,
      mcqAccuracy: 71,
      errorLabel: "Linking outcomes to evidence",
    },
    {
      id: "product.configuration",
      subject: "Product",
      name: "Advanced configuration",
      unit: "Module 06 · Workspace setup",
      importance: 0.86,
      acquisition: 0.61,
      retention: 0.72,
      application: 0.69,
      remainingLearningMinutes: 45,
      remainingPracticeMinutes: 90,
      dueCards: 11,
      structuredAccuracy: 64,
      mcqAccuracy: 78,
      errorLabel: "Choosing the right setup",
    },
    {
      id: "service.retention",
      subject: "Service",
      name: "Retention & renewal",
      unit: "Module 02 · Customer lifecycle",
      importance: 0.74,
      acquisition: 0.86,
      retention: 0.81,
      application: 0.77,
      remainingLearningMinutes: 0,
      remainingPracticeMinutes: 45,
      dueCards: 7,
      structuredAccuracy: 76,
      mcqAccuracy: 84,
      errorLabel: "Order of the lifecycle steps",
    },
    {
      id: "service.reporting",
      subject: "Service",
      name: "Reporting & insights",
      unit: "Module 03 · Measuring success",
      importance: 0.68,
      acquisition: 0.48,
      retention: 0.57,
      application: 0.52,
      remainingLearningMinutes: 60,
      remainingPracticeMinutes: 60,
      dueCards: 9,
      structuredAccuracy: 52,
      mcqAccuracy: 63,
      errorLabel: "Reading the right metrics",
    },
  ];

  const activities: StudyActivity[] = [
    {
      id: "activity-review-today",
      date: day(0),
      type: "fsrs_review",
      title: "Product review queue",
      subject: "Product",
      plannedMinutes: 25,
      completedMinutes: 25,
      detail: "18 due cards · 6 overdue",
      reason: "Overdue cards are the most time-sensitive work in your queue.",
      status: "completed",
      cardCount: 18,
    },
    {
      id: "activity-genetics-today",
      date: day(0),
      type: "structured_practise",
      title: "Onboarding: outcome questions",
      topicId: "product.onboarding",
      subject: "Product",
      plannedMinutes: 40,
      completedMinutes: 0,
      detail: "3 structured questions",
      reason: "Structured accuracy is 58%, and this topic unlocks two later objectives.",
      status: "planned",
      questionCount: 3,
      pinned: true,
    },
    {
      id: "activity-organic-today",
      date: day(0),
      type: "learn_new_content",
      title: "Configuration: first pass",
      topicId: "product.configuration",
      subject: "Product",
      plannedMinutes: 30,
      completedMinutes: 0,
      detail: "Reaction map · 1 concept",
      reason: "High exam importance with 45 minutes of learning still outstanding.",
      status: "planned",
    },
    {
      id: "activity-cells-tomorrow",
      date: day(1),
      type: "fsrs_review",
      title: "Retention & renewal reviews",
      topicId: "service.retention",
      subject: "Service",
      plannedMinutes: 20,
      completedMinutes: 0,
      detail: "7 due cards",
      reason: "Keeps strong retention stable with a short, timely review.",
      status: "planned",
      cardCount: 7,
    },
    {
      id: "activity-organic-tomorrow",
      date: day(1),
      type: "mcq_practise",
      title: "Configuration: quick checks",
      topicId: "product.configuration",
      subject: "Product",
      plannedMinutes: 35,
      completedMinutes: 0,
      detail: "12 multiple-choice questions",
      reason: "Tests whether new reaction patterns are becoming retrievable.",
      status: "planned",
      questionCount: 12,
    },
    {
      id: "activity-equilibrium-wed",
      date: day(2),
      type: "learn_new_content",
      title: "Reporting: core metrics",
      topicId: "service.reporting",
      subject: "Service",
      plannedMinutes: 35,
      completedMinutes: 0,
      detail: "Core concept · guided notes",
      reason: "A prerequisite gap is holding back application questions.",
      status: "planned",
    },
    {
      id: "activity-genetics-wed",
      date: day(2),
      type: "error_correction",
      title: "Onboarding error correction",
      topicId: "product.onboarding",
      subject: "Product",
      plannedMinutes: 25,
      completedMinutes: 0,
      detail: "2 misconceptions to resolve",
      reason: "Revisiting the error pattern is higher value than adding new cards.",
      status: "planned",
    },
    {
      id: "activity-mixed-thu",
      date: day(3),
      type: "mixed_exam_practice",
      title: "Mixed application set",
      subject: "Mixed",
      plannedMinutes: 45,
      completedMinutes: 0,
      detail: "Product + Service · timed",
      reason: "Builds transfer between topics without adding another long session.",
      status: "planned",
    },
    {
      id: "activity-review-fri",
      date: day(4),
      type: "fsrs_review",
      title: "Weekly FSRS reviews",
      subject: "Mixed",
      plannedMinutes: 30,
      completedMinutes: 0,
      detail: "20–25 cards forecast",
      reason: "Protects retention before the weekend practice block.",
      status: "planned",
      cardCount: 23,
    },
    {
      id: "activity-mock-sat",
      date: day(5),
      type: "mock_exam",
      title: "Mini mock: sections A–B",
      subject: "Mixed",
      plannedMinutes: 75,
      completedMinutes: 0,
      detail: "Timed · mark afterwards",
      reason: "A low-stakes checkpoint for pacing and question selection.",
      status: "planned",
    },
  ];

  return {
    exam: {
      name: "Customer success certification",
      date: dateKey(examDate),
      target: "80% / certified",
      subjects: ["Product", "Service"],
    },
    capacity: {
      availableDays: [1, 2, 3, 4, 5, 6],
      minutesPerDay: 90,
      observedCompletionRate: 0.84,
      studyWindow: "18:00 – 20:00",
      lastWeekCompletedMinutes: 365,
    },
    topics,
    activities,
  };
}

export function buildPlannerView(state: PlannerState, now = new Date()): PlannerView {
  const examDate = new Date(`${state.exam.date}T23:59:59`);
  const daysUntilExam = daysBetween(now, examDate);
  const remainingLearning = state.topics.reduce(
    (sum, topic) => sum + topic.remainingLearningMinutes,
    0,
  );
  const remainingPractice = state.topics.reduce(
    (sum, topic) => sum + topic.remainingPracticeMinutes,
    0,
  );
  const dueCards = state.topics.reduce((sum, topic) => sum + topic.dueCards, 0);
  const forecastReviewMinutes = Math.round((dueCards * 1.5 * 6) / 5);
  const requiredMinutes = remainingLearning + remainingPractice + forecastReviewMinutes;
  const realisticCapacityMinutes = Math.round(
    daysUntilExam * state.capacity.minutesPerDay * (state.capacity.availableDays.length / 7) * state.capacity.observedCompletionRate,
  );
  const ratio = realisticCapacityMinutes / Math.max(requiredMinutes, 1);
  const risk: RiskState =
    ratio >= 1.45 ? "On track" : ratio >= 1.08 ? "Tight" : ratio >= 0.82 ? "At risk" : "Infeasible";
  const completedMinutes = state.activities.reduce(
    (sum, activity) => sum + activity.completedMinutes,
    0,
  );
  const plannedMinutes = state.activities.reduce(
    (sum, activity) => sum + activity.plannedMinutes,
    0,
  );
  const coverage = Math.round(
    (state.topics.reduce((sum, topic) => sum + topic.acquisition, 0) / state.topics.length) * 100,
  );
  const weekStart = startOfWeek(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = dateKey(date);
    const activities = state.activities.filter((activity) => activity.date === key);
    return {
      date: key,
      label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
      dayNumber: date.getDate(),
      plannedMinutes: activities.reduce((sum, activity) => sum + activity.plannedMinutes, 0),
      completedMinutes: activities.reduce((sum, activity) => sum + activity.completedMinutes, 0),
      capacityMinutes: state.capacity.availableDays.includes(date.getDay())
        ? state.capacity.minutesPerDay
        : 0,
      activities,
    };
  });

  return {
    daysUntilExam,
    requiredMinutes,
    realisticCapacityMinutes,
    risk,
    coverage,
    completedMinutes,
    plannedMinutes,
    dueCards,
    weeklyTargetMinutes: state.capacity.minutesPerDay * state.capacity.availableDays.length,
    days,
  };
}

export function activityLabel(type: ActivityKind) {
  const labels: Record<ActivityKind, string> = {
    fsrs_review: "FSRS review",
    learn_new_content: "Learn new",
    retrieval_practise: "Retrieval",
    mcq_practise: "MCQ practice",
    structured_practise: "Structured",
    error_correction: "Error correction",
    mixed_exam_practice: "Mixed practice",
    mock_exam: "Mini mock",
  };
  return labels[type];
}

export function formatExamDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
