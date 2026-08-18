import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_KIND_LABELS,
  applyPlan,
  formatDateKey,
  isAvailabilityConfigured,
  nextExam,
  planStudy,
  saveActivity,
  todayKey,
  useActivities,
  useAvailability,
  useCurriculum,
  useExamGoals,
  useMeasurementData,
  WEEKDAYS,
} from "@/lib/planner";
import type {
  ActivityKind,
  ActivityStatus,
  PlannedActivity,
  PlanDay,
  StudyActivity,
} from "@/lib/planner";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardList,
  Info,
  ListChecks,
  Loader2,
  PenLine,
  Pin,
  PinOff,
  RefreshCw,
  SkipForward,
  Target,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const KIND_ICONS: Record<ActivityKind, typeof BookOpen> = {
  fsrs_review: RefreshCw,
  learn_new_content: BookOpen,
  retrieval_practise: RefreshCw,
  mcq_practise: ListChecks,
  structured_practise: PenLine,
  error_correction: AlertTriangle,
  mixed_exam_practice: ListChecks,
  mock_exam: ClipboardList,
};

const STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  missed: "Missed",
  postponed: "Postponed",
};

function statusClass(status: ActivityStatus): string {
  switch (status) {
    case "completed":
      return "bg-[#e4f3e9] text-[#276641]";
    case "in_progress":
      return "bg-[#e6ecff] text-[#2c4b99]";
    case "skipped":
    case "missed":
      return "bg-[#fff0dc] text-[#87531b]";
    case "postponed":
      return "bg-[#f1ecff] text-[#5b4a94]";
    default:
      return "bg-[#f1f2f7] text-[#6f7079]";
  }
}

function restoreActivity(activity: StudyActivity): StudyActivity {
  const { completedMinutes: _completedMinutes, ...rest } = activity;
  return { ...rest, status: "planned", source: "planner" };
}

function ActivityRow({
  activity,
  objectiveById,
}: {
  activity: PlannedActivity;
  objectiveById: Map<string, string>;
}) {
  const Icon = KIND_ICONS[activity.kind];
  const objectiveLabel =
    activity.objectiveIds.length > 0
      ? activity.objectiveIds.map((id) => objectiveById.get(id) ?? id).join(", ")
      : "Whole-goal activity";

  return (
    <div className="rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5a6a94]">
          <Icon className="size-3.5 text-[#5871ae]" />
          {ACTIVITY_KIND_LABELS[activity.kind]}
        </span>
        <span className="text-xs font-bold text-[#3a3b45]">{activity.plannedMinutes} min</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#3a3b45]">{objectiveLabel}</p>
      {(activity.cardCount !== undefined || activity.questionCount !== undefined) && (
        <p className="mt-1 text-[11px] font-medium text-[#8a8b95]">
          {activity.cardCount !== undefined
            ? `${activity.cardCount} card${activity.cardCount === 1 ? "" : "s"}`
            : ""}
          {activity.cardCount !== undefined && activity.questionCount !== undefined ? " · " : ""}
          {activity.questionCount !== undefined
            ? `${activity.questionCount} question${activity.questionCount === 1 ? "" : "s"}`
            : ""}
        </p>
      )}
      <ul className="mt-2 space-y-0.5">
        {activity.reasons.map((reason, index) => (
          <li key={index} className="text-[11px] leading-4 text-[#8a8b95]">
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PinnedActivityRow({
  activity,
  objectiveById,
}: {
  activity: StudyActivity;
  objectiveById: Map<string, string>;
}) {
  const Icon = KIND_ICONS[activity.kind];
  const objectiveLabel =
    activity.objectiveIds.length > 0
      ? activity.objectiveIds.map((id) => objectiveById.get(id) ?? id).join(", ")
      : "Whole-goal activity";

  return (
    <div className="rounded-[14px] border border-[#c9d5f4] bg-[#eef2ff] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4562a1]">
          <Icon className="size-3.5 text-[#4562a1]" />
          {ACTIVITY_KIND_LABELS[activity.kind]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#d7e1ff] px-2 py-0.5 text-[10px] font-bold text-[#3557a5]">
          <Pin className="size-3" /> Pinned
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#3a3b45]">{objectiveLabel}</p>
      <p className="mt-1 text-[11px] font-medium text-[#7a86a8]">{activity.plannedMinutes} min reserved</p>
    </div>
  );
}

function DayCard({ day, objectiveById }: { day: PlanDay; objectiveById: Map<string, string> }) {
  const weekday = WEEKDAYS.find((item) => item.value === day.weekday);
  const hasPinned = day.pinnedActivities.length > 0;
  const hasDerived = day.activities.length > 0;

  return (
    <Card className="rounded-[22px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between px-5 pb-2 pt-5">
        <div>
          <CardTitle className="text-[15px] font-bold tracking-[-0.02em]">
            {weekday?.short} · {formatDateKey(day.date)}
          </CardTitle>
          <CardDescription className="mt-0.5 text-[11px]">
            {day.isStudyDay ? `${day.capacityMinutes} min available` : "Rest day"}
            {day.pinnedMinutes > 0 && ` · ${day.pinnedMinutes} min pinned`}
          </CardDescription>
        </div>
        {day.isStudyDay && (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              day.allocatedMinutes >= day.capacityMinutes
                ? "bg-[#e4f3e9] text-[#276641]"
                : "bg-[#e6ecff] text-[#2c4b99]"
            }`}
          >
            {day.allocatedMinutes}/{day.capacityMinutes} min
          </span>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {!hasPinned && !hasDerived ? (
          <p className="rounded-[12px] border border-dashed border-[#d8dae5] p-4 text-center text-xs text-muted-foreground">
            {day.isStudyDay ? "Nothing scheduled." : "No study planned."}
          </p>
        ) : (
          <div className="space-y-2">
            {day.pinnedActivities.map((activity) => (
              <PinnedActivityRow key={activity.id} activity={activity} objectiveById={objectiveById} />
            ))}
            {day.activities.map((activity, index) => (
              <ActivityRow
                key={`${activity.kind}-${activity.objectiveIds.join(",")}-${index}`}
                activity={activity}
                objectiveById={objectiveById}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleActivityRow({
  activity,
  objectiveById,
  onSave,
}: {
  activity: StudyActivity;
  objectiveById: Map<string, string>;
  onSave: (activity: StudyActivity) => void;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const Icon = KIND_ICONS[activity.kind];
  const objectiveLabel =
    activity.objectiveIds.length > 0
      ? activity.objectiveIds.map((id) => objectiveById.get(id) ?? id).join(", ")
      : "Whole-goal activity";
  const actionable =
    activity.status === "planned" ||
    activity.status === "postponed" ||
    activity.status === "missed" ||
    activity.status === "in_progress";

  return (
    <div className="rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5a6a94]">
          <Icon className="size-3.5 text-[#5871ae]" />
          {ACTIVITY_KIND_LABELS[activity.kind]}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave({ ...activity, pinned: !activity.pinned })}
            className={`cursor-pointer rounded-full p-1 transition-colors ${
              activity.pinned
                ? "bg-[#d7e1ff] text-[#3557a5]"
                : "text-[#9b9ca5] hover:bg-[#f1f2f8] hover:text-[#5a5b68]"
            }`}
            aria-label={activity.pinned ? "Unpin activity" : "Pin activity"}
            title={activity.pinned ? "Unpin" : "Pin to keep this where it is"}
          >
            {activity.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </button>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusClass(activity.status)}`}>
            {STATUS_LABELS[activity.status]}
          </span>
          <span className="text-xs font-bold text-[#3a3b45]">
            {activity.completedMinutes ?? activity.plannedMinutes} min
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm font-semibold text-[#3a3b45]">{objectiveLabel}</p>

      {rescheduling ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={activity.date}
            onChange={(event) => {
              const nextDate = event.target.value;
              if (!nextDate) return;
              onSave({
                ...activity,
                date: nextDate,
                status: activity.status === "postponed" ? "postponed" : "planned",
                source: "manual",
              });
              setRescheduling(false);
            }}
            className="h-8 w-fit rounded-lg border-[#dce0ed] text-xs font-semibold text-[#5a5b68]"
          />
          <button
            type="button"
            onClick={() => setRescheduling(false)}
            className="cursor-pointer rounded-full px-2 py-1 text-[11px] font-bold text-[#8a8b95] hover:bg-[#f4f5fa]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {actionable ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onSave({
                    ...activity,
                    status: "completed",
                    completedMinutes: activity.completedMinutes ?? activity.plannedMinutes,
                  })
                }
                className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-[#e4f3e9] px-2.5 py-1 text-[11px] font-bold text-[#276641] hover:bg-[#d5ecdd]"
              >
                <Check className="size-3" /> Complete
              </button>
              <button
                type="button"
                onClick={() => onSave({ ...activity, status: "skipped", source: "manual" })}
                className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-[#fff0dc] px-2.5 py-1 text-[11px] font-bold text-[#87531b] hover:bg-[#fbe6c8]"
              >
                <SkipForward className="size-3" /> Skip
              </button>
              <button
                type="button"
                onClick={() => setRescheduling(true)}
                className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#e3e4eb] px-2.5 py-1 text-[11px] font-bold text-[#5a5b68] hover:bg-[#f4f5fa]"
              >
                <CalendarPlus className="size-3" /> Move
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSave(restoreActivity(activity))}
              className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#e3e4eb] px-2.5 py-1 text-[11px] font-bold text-[#5a5b68] hover:bg-[#f4f5fa]"
            >
              <Undo2 className="size-3" /> Restore
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type ScheduleView = "recommendation" | "schedule";

export function Plan({ onNavigate }: { onNavigate: (view: "setup" | "study") => void }) {
  const curriculum = useCurriculum();
  const { data: goals, loading: goalsLoading } = useExamGoals();
  const { availability, loading: availabilityLoading } = useAvailability();
  const measurement = useMeasurementData();
  const { data: activities, loading: activitiesLoading } = useActivities();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [view, setView] = useState<ScheduleView>("recommendation");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const [today, setToday] = useState(() => todayKey());
  useEffect(() => {
    const rollover = () => setToday(todayKey());
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(rollover, nextMidnight.getTime() - Date.now() + 1000);
    document.addEventListener("visibilitychange", rollover);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", rollover);
    };
  }, []);
  const now = useMemo(() => new Date(`${today}T12:00:00`), [today]);
  const loading =
    curriculum.loading ||
    goalsLoading ||
    availabilityLoading ||
    measurement.loading ||
    activitiesLoading ||
    availability === undefined;

  const orderedGoals = useMemo(
    () => [...goals].sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [goals],
  );

  const activeGoal = useMemo(() => {
    if (selectedGoalId) {
      const match = goals.find((goal) => goal.id === selectedGoalId);
      if (match) return match;
    }
    return nextExam(goals, now);
  }, [goals, selectedGoalId, now]);

  const objectiveById = useMemo(
    () => new Map(curriculum.objectives.map((objective) => [objective.id, objective.title])),
    [curriculum.objectives],
  );

  const plan = useMemo(() => {
    if (loading || !availability) return null;
    return planStudy({
      objectives: curriculum.objectives,
      cards: measurement.cards,
      attempts: measurement.attempts,
      reviewLogs: measurement.reviewLogs,
      sessionLogs: measurement.sessionLogs,
      examGoals: goals,
      activeGoalId: activeGoal?.id,
      activities,
      availability,
      now,
    });
  }, [
    loading,
    availability,
    curriculum.objectives,
    measurement.cards,
    measurement.attempts,
    measurement.reviewLogs,
    measurement.sessionLogs,
    goals,
    activeGoal?.id,
    activities,
    now,
  ]);

  const scheduleDays = useMemo(() => {
    const upcoming = activities
      .filter((activity) => activity.date >= today)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.kind.localeCompare(b.kind) ||
          a.id.localeCompare(b.id),
      );
    const groups = new Map<string, StudyActivity[]>();
    for (const activity of upcoming) {
      const list = groups.get(activity.date) ?? [];
      list.push(activity);
      groups.set(activity.date, list);
    }
    return Array.from(groups, ([date, items]) => ({ date, items })).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [activities, today]);

  const nextAction = useMemo<{
    date: string;
    kind: ActivityKind;
    objectiveIds: string[];
    plannedMinutes: number;
    reasons?: string[];
  } | null>(() => {
    if (!plan) return null;
    for (const day of plan.days) {
      if (!day.isStudyDay) continue;
      const activity = day.pinnedActivities[0] ?? day.activities[0];
      if (!activity) continue;
      return {
        date: day.date,
        kind: activity.kind,
        objectiveIds: activity.objectiveIds,
        plannedMinutes: activity.plannedMinutes,
        reasons: day.activities[0]?.reasons,
      };
    }
    return null;
  }, [plan]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) return null;

  const configured = isAvailabilityConfigured(availability);
  const NextActionIcon = nextAction ? KIND_ICONS[nextAction.kind] : BookOpen;
  const remainingWarnings = plan.warnings.filter(
    (warning) => configured || !warning.startsWith("No availability configured"),
  );
  const flatActivities = plan.days.flatMap((day) => day.activities);
  const weekReviewCards = plan.dueForecast
    .slice(0, plan.days.length)
    .reduce((sum, point) => sum + point.cardCount, 0);

  const handleApply = async () => {
    if (!plan) return;
    setApplying(true);
    try {
      const lastDay = plan.days[plan.days.length - 1];
      await applyPlan(flatActivities, { start: plan.horizonStart, end: lastDay.date });
      setApplied(true);
      setView("schedule");
      toast.success("Plan applied to your schedule");
    } catch {
      toast.error("Could not apply the plan. Try again.");
    } finally {
      setApplying(false);
    }
  };

  const handleSaveActivity = async (activity: StudyActivity) => {
    try {
      // saveActivity persists the row and keeps its linked session log in step
      // (complete/skip writes the outcome; restore withdraws it).
      await saveActivity(activity);
      toast.success("Schedule updated");
    } catch {
      toast.error("Could not update the schedule. Try again.");
    }
  };

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#71727e]">Phase 3 · Planner</p>
          <h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">Your plan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71727e]">
            Priorities, review timing, and your real observed capacity — turned into a daily
            allocation and an honest feasibility check.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {orderedGoals.length > 1 && (
            <select
              value={activeGoal?.id ?? ""}
              onChange={(event) => setSelectedGoalId(event.target.value)}
              className="h-10 rounded-full border border-[#dce0ed] bg-white px-3 text-xs font-semibold text-[#5a5b68]"
              aria-label="Choose exam goal"
            >
              {orderedGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name} · {formatDateKey(goal.examDate)}
                </option>
              ))}
            </select>
          )}
          {view === "recommendation" && (
            <>
              {applied && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4f3e9] px-3 py-1.5 text-[11px] font-bold text-[#276641]">
                  <CheckCircle2 className="size-3.5" /> Applied
                </span>
              )}
              <Button
                type="button"
                disabled={!configured || flatActivities.length === 0 || applying}
                onClick={handleApply}
                className="h-10 rounded-full bg-[#3159b7] px-5 font-bold text-white hover:bg-[#264b9f]"
              >
                <RefreshCw className="size-4" />
                {applying ? "Applying…" : "Apply plan"}
              </Button>
            </>
          )}
        </div>
      </section>

      <div className="mt-6 flex w-fit rounded-full bg-[#f1f2f7] p-1">
        {(["recommendation", "schedule"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`cursor-pointer h-8 rounded-full px-4 text-xs font-bold transition-colors ${
              view === value ? "bg-[#e1e8ff] text-[#244a9c]" : "text-[#777883]"
            }`}
          >
            {value === "recommendation" ? "Recommendation" : "My schedule"}
          </button>
        ))}
      </div>

      {view === "recommendation" ? (
        <>
          {!configured && (
            <Card className="mt-7 rounded-[24px] border-[#f0e3c2] bg-[#fff8ea] py-0 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 text-[#a97a1f]" />
                  <div>
                    <p className="text-sm font-bold text-[#7a5a16]">Set your availability first</p>
                    <p className="mt-1 text-xs leading-5 text-[#8a6f2e]">
                      The planner needs your study days and a daily limit before it can allocate
                      anything. Everything is stored on this device.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => onNavigate("setup")}
                >
                  Set availability
                </Button>
              </CardContent>
            </Card>
          )}

          {remainingWarnings.length > 0 && (
            <Card className="mt-6 rounded-[24px] border-[#e9e2c8] bg-[#fffdf4] py-0 shadow-none">
              <CardContent className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7a3e]">Planner notes</p>
                <ul className="mt-2 space-y-1.5">
                  {remainingWarnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2 text-xs leading-5 text-[#6f663f]">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-[#a08c4a]" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {nextAction && (
            <Card className="mt-6 rounded-[24px] border-[#cdd8f6] bg-[#eef2ff] py-0 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#536da8]">
                    Do this next
                    {nextAction.date === plan.horizonStart ? " · today" : ` · ${formatDateKey(nextAction.date)}`}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <NextActionIcon className="size-4 text-[#4562a1]" />
                    <p className="text-sm font-bold text-[#2c3550]">
                      {ACTIVITY_KIND_LABELS[nextAction.kind]} · {nextAction.plannedMinutes} min
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#5a6a94]">
                    {nextAction.objectiveIds.length > 0
                      ? nextAction.objectiveIds.map((id) => objectiveById.get(id) ?? id).join(", ")
                      : "Whole-goal activity"}
                  </p>
                  {nextAction.reasons?.[0] && (
                    <p className="mt-1 text-xs text-[#7a86a8]">{nextAction.reasons[0]}</p>
                  )}
                </div>
                <Button
                  type="button"
                  className="h-10 rounded-full bg-[#3159b7] px-5 font-bold text-white hover:bg-[#264b9f]"
                  onClick={() => onNavigate("study")}
                >
                  Start now
                </Button>
              </CardContent>
            </Card>
          )}

          <section className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
              <CardHeader className="px-6 pb-3 pt-6">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-[#5871ae]" />
                  <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">Feasibility</CardTitle>
                </div>
                <CardDescription className="mt-1 text-xs">
                  Required workload versus your effective available time.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div
                  className={`rounded-[16px] p-4 ${
                    plan.feasibility.achievable ? "bg-[#f0f9f3]" : "bg-[#fff6e9]"
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      plan.feasibility.achievable ? "text-[#276641]" : "text-[#87531b]"
                    }`}
                  >
                    {plan.feasibility.achievable
                      ? "On track — the required work fits your available time."
                      : `Shortfall of ${plan.feasibility.shortfallMinutes} min — this target needs a choice.`}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Required</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">{plan.feasibility.requiredMinutes} min</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Available</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">{plan.feasibility.availableMinutes} min</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Workload fits</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">
                        {Math.round(plan.feasibility.workloadCoverage * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Coverage target</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">
                        {Math.round(plan.feasibility.targetCoverage * 100)}%
                      </p>
                    </div>
                  </div>
                  {!plan.feasibility.achievable && (
                    <p className="mt-3 text-[11px] leading-4 text-[#8a6f2e]">
                      Your choices: reduce optional topics, add study time, or move the exam date. The
                      plan below schedules the highest-value work first, not everything at once.
                    </p>
                  )}
                </div>

                {plan.goalName && (
                  <p className="mt-4 text-xs font-semibold text-[#5a5b68]">
                    Goal: <span className="text-[#3a3b45]">{plan.goalName}</span>
                    {plan.examDate && (
                      <span className="text-[#9b9ca5]"> · exam {formatDateKey(plan.examDate)}</span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
              <CardHeader className="px-6 pb-3 pt-6">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-[#5871ae]" />
                  <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">This week</CardTitle>
                </div>
                <CardDescription className="mt-1 text-xs">FSRS review load, next 7 days.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-[26px] font-bold tracking-[-0.03em] text-[#23242c]">
                  {weekReviewCards}
                  <span className="ml-2 text-sm font-semibold text-[#8a8b95]">cards due</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {plan.dueForecast.slice(0, plan.days.length).map((point) => {
                    const weekday = WEEKDAYS.find(
                      (item) => item.value === new Date(`${point.date}T12:00:00`).getDay(),
                    );
                    return (
                      <div
                        key={point.date}
                        className="flex min-w-12 flex-col items-center rounded-[12px] border border-[#e6e7ef] px-2 py-1.5"
                      >
                        <span className="text-[10px] font-bold text-[#9b9ca5]">{weekday?.short}</span>
                        <span className="mt-0.5 text-sm font-bold text-[#3a3b45]">{point.cardCount}</span>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 rounded-full"
                  onClick={() => onNavigate("study")}
                >
                  Start reviewing
                </Button>
              </CardContent>
            </Card>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#2c2d36]">Next 7 days</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Highest-value work first — reviews, then error correction, learning, and practice.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plan.days.map((day) => (
                <DayCard key={day.date} day={day} objectiveById={objectiveById} />
              ))}
            </div>
          </section>

          {plan.blockedObjectives.length > 0 && (
            <section className="mt-8">
              <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
                <CardHeader className="px-6 pb-2 pt-6">
                  <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">Waiting on prerequisites</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    These objectives can't be learned yet because an earlier topic isn't practised.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid gap-2">
                    {plan.blockedObjectives.map((blocked) => (
                      <div
                        key={blocked.objectiveId}
                        className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3"
                      >
                        <p className="text-sm font-semibold text-[#3a3b45]">{blocked.title}</p>
                        <span className="text-[11px] text-[#8a8b95]">
                          Needs: {blocked.missingPrerequisites.map((id) => objectiveById.get(id) ?? id).join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      ) : (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#2c2d36]">My schedule</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The work actually on your calendar, including your edits. Apply a plan from the
                Recommendation tab to populate it.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setView("recommendation")}
            >
              View recommendation
            </Button>
          </div>

          {scheduleDays.length === 0 ? (
            <Card className="mt-4 rounded-[24px] border-dashed border-[#d8dae5] bg-white py-0 shadow-none">
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
                <CalendarDays className="size-8 text-[#9b9ca5]" />
                <p className="mt-3 text-sm font-bold text-[#3a3b45]">Nothing scheduled yet.</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Open the Recommendation tab and apply a plan. You'll then be able to check work
                  off, skip it, or move it to a better day.
                </p>
                <Button
                  type="button"
                  className="mt-4 h-9 rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]"
                  onClick={() => setView("recommendation")}
                >
                  Generate a plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4">
              {scheduleDays.slice(0, 14).map((day) => {
                const weekday = WEEKDAYS.find(
                  (item) => item.value === new Date(`${day.date}T12:00:00`).getDay(),
                );
                const totalMinutes = day.items.reduce(
                  (sum, activity) => sum + (activity.completedMinutes ?? activity.plannedMinutes),
                  0,
                );
                return (
                  <Card
                    key={day.date}
                    className="rounded-[22px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]"
                  >
                    <CardHeader className="px-5 pb-2 pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-[15px] font-bold tracking-[-0.02em]">
                            {weekday?.short} · {formatDateKey(day.date)}
                          </CardTitle>
                          <CardDescription className="mt-0.5 text-[11px]">
                            {day.items.length} activit{day.items.length === 1 ? "y" : "ies"} · {totalMinutes} min
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      <div className="space-y-2">
                        {day.items.map((activity) => (
                          <ScheduleActivityRow
                            key={activity.id}
                            activity={activity}
                            objectiveById={objectiveById}
                            onSave={handleSaveActivity}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {scheduleDays.length > 14 && (
                <p className="text-center text-xs text-muted-foreground">
                  Showing the next 14 scheduled days.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
