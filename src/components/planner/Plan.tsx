import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ACTIVITY_KIND_LABELS,
  applyPlan,
  formatDateKey,
  isAvailabilityConfigured,
  planStudy,
  useAvailability,
  useCurriculum,
  useExamGoals,
  useMeasurementData,
  WEEKDAYS,
} from "@/lib/planner";
import type { ActivityKind, PlannedActivity, PlanDay } from "@/lib/planner";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  Loader2,
  PenLine,
  RefreshCw,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
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

function DayCard({ day, objectiveById }: { day: PlanDay; objectiveById: Map<string, string> }) {
  const weekday = WEEKDAYS.find((item) => item.value === day.weekday);
  return (
    <Card className="rounded-[22px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between px-5 pb-2 pt-5">
        <div>
          <CardTitle className="text-[15px] font-bold tracking-[-0.02em]">
            {weekday?.short} · {formatDateKey(day.date)}
          </CardTitle>
          <CardDescription className="mt-0.5 text-[11px]">
            {day.isStudyDay ? `${day.capacityMinutes} min available` : "Rest day"}
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
        {day.activities.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[#d8dae5] p-4 text-center text-xs text-muted-foreground">
            {day.isStudyDay ? "Nothing scheduled." : "No study planned."}
          </p>
        ) : (
          <div className="space-y-2">
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

export function Plan({ onNavigate }: { onNavigate: (view: "setup" | "study") => void }) {
  const curriculum = useCurriculum();
  const { data: goals, loading: goalsLoading } = useExamGoals();
  const { availability, loading: availabilityLoading } = useAvailability();
  const measurement = useMeasurementData();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const now = useMemo(() => new Date(), []);
  const loading =
    curriculum.loading ||
    goalsLoading ||
    availabilityLoading ||
    measurement.loading ||
    availability === undefined;

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
    now,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) return null;

  const configured = isAvailabilityConfigured(availability);
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
      toast.success("Plan applied to your schedule");
    } catch {
      toast.error("Could not apply the plan. Try again.");
    } finally {
      setApplying(false);
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
        <div className="flex items-center gap-2">
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
        </div>
      </section>

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
                const weekday = WEEKDAYS.find((item) => item.value === new Date(`${point.date}T12:00:00`).getDay());
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
                  <div key={blocked.objectiveId} className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
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
  );
}
