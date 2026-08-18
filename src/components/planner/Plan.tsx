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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACTIVITY_KIND_LABELS,
  applyPlan,
  buildDayTimetable,
  explainActivity,
  formatDateKey,
  isAvailabilityConfigured,
  isStudyDay,
  minutesToTime,
  moveActivity,
  nextExam,
  nextStudyDayAfter,
  occupiedBlocksForDate,
  placePlannedActivities,
  planStudy,
  projectRoadmap,
  recoveryPlan,
  replaceActivity,
  replacementCandidates,
  saveActivity,
  snapActivity,
  snoozeActivity,
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
  PlannedActivity,
  PlanDay,
  PlanState,
  ReplacementCandidate,
  StudyActivity,
} from "@/lib/planner";
import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  Loader2,
  Moon,
  Pin,
  PinOff,
  RefreshCw,
  SkipForward,
  Target,
  Undo2,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { CalendarView } from "./Calendar";
import { RoadmapView } from "./Roadmap";
import { allowActivityDrop, draggedActivityId, setActivityDrag } from "./dnd";
import { isActionableStatus, KIND_ICONS, STATUS_LABELS, statusClass } from "./shared";

type ExplainTarget = {
  date: string;
  kind: ActivityKind;
  objectiveIds: string[];
  plannedMinutes: number;
};

function restoreActivity(activity: StudyActivity): StudyActivity {
  const { completedMinutes: _completedMinutes, ...rest } = activity;
  return { ...rest, status: "planned", source: "planner" };
}

function ActivityRow({
  activity,
  objectiveById,
  onExplain,
}: {
  activity: PlannedActivity;
  objectiveById: Map<string, string>;
  onExplain: (activity: ExplainTarget) => void;
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#3a3b45]">{activity.plannedMinutes} min</span>
          <button
            type="button"
            onClick={() => onExplain(activity)}
            className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#e3e4eb] px-2 py-0.5 text-[10px] font-bold text-[#5a5b68] hover:bg-[#f4f5fa]"
            title="Why this activity?"
          >
            <HelpCircle className="size-3" /> Why?
          </button>
        </div>
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

function DayCard({
  day,
  objectiveById,
  onExplain,
}: {
  day: PlanDay;
  objectiveById: Map<string, string>;
  onExplain: (activity: ExplainTarget) => void;
}) {
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
                onExplain={onExplain}
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
  onSnooze,
  onReplace,
  onExplain,
  onMove,
}: {
  activity: StudyActivity;
  objectiveById: Map<string, string>;
  onSave: (activity: StudyActivity) => void;
  onSnooze: (activity: StudyActivity) => void;
  onReplace: (activity: StudyActivity) => void;
  onExplain: (activity: ExplainTarget) => void;
  onMove: (activity: StudyActivity, date: string) => void;
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
  const replaceable =
    activity.objectiveIds.length === 1 &&
    activity.kind !== "fsrs_review" &&
    activity.kind !== "mock_exam";

  return (
    <div
      draggable={actionable}
      onDragStart={(event) => {
        if (!actionable) return;
        setActivityDrag(event, activity.id);
      }}
      className={`rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3 ${
        actionable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
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
              onMove(activity, nextDate);
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
              <button
                type="button"
                onClick={() => onSnooze(activity)}
                className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#e3e4eb] px-2.5 py-1 text-[11px] font-bold text-[#5a5b68] hover:bg-[#f4f5fa]"
              >
                <Moon className="size-3" /> Snooze
              </button>
              {replaceable && (
                <button
                  type="button"
                  onClick={() => onReplace(activity)}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#e3e4eb] px-2.5 py-1 text-[11px] font-bold text-[#5a5b68] hover:bg-[#f4f5fa]"
                >
                  <ArrowRightLeft className="size-3" /> Replace
                </button>
              )}
              <button
                type="button"
                onClick={() => onExplain(activity)}
                className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[#e3e4eb] px-2.5 py-1 text-[11px] font-bold text-[#5a5b68] hover:bg-[#f4f5fa]"
              >
                <HelpCircle className="size-3" /> Why?
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

type ScheduleView = "recommendation" | "calendar" | "roadmap" | "today" | "schedule";

function TodayView({
  objectiveById,
  onNavigate,
}: {
  objectiveById: Map<string, string>;
  onNavigate: (view: "setup" | "study") => void;
}) {
  const { data: activities } = useActivities();
  const { availability } = useAvailability();
  const today = todayKey();

  const model = useMemo(
    () => (availability ? buildDayTimetable({ date: today, activities, availability }) : null),
    [activities, availability, today],
  );
  const byId = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities],
  );

  if (!availability || !model) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    const activityId = draggedActivityId(event);
    if (!activityId) return;
    const dragged = activities.find((activity) => activity.id === activityId);
    if (!dragged) return;

    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-time-start]");
    let requested = model.dayStart;
    if (target) {
      const start = Number(target.dataset.timeStart);
      const end = Number(target.dataset.timeEnd);
      const rect = target.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
      requested = Math.round((start + ratio * (end - start)) / 5) * 5;
    }

    const occupied = occupiedBlocksForDate(activities, today, activityId);
    const placement = snapActivity({
      date: today,
      minutes: dragged.plannedMinutes,
      requestedStart: minutesToTime(requested),
      availability,
      occupied,
    });
    if (!placement) {
      toast.error("That spot doesn't fit today's free time — try a wider gap.");
      return;
    }
    try {
      await moveActivity(activityId, { date: today, start: placement.start, end: placement.end });
      toast.success("Activity moved");
    } catch {
      toast.error("Could not move the activity. Try again.");
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#2c2d36]">Today</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateKey(today)} · your schedule in clock time.
          </p>
        </div>
        <span className="rounded-full bg-[#e6ecff] px-3 py-1 text-[11px] font-bold text-[#2c4b99]">
          {model.totalMinutes} min planned
        </span>
      </div>

      {!model.isStudyDay ? (
        <Card className="mt-4 rounded-[24px] border-dashed border-[#d8dae5] bg-white py-0 shadow-none">
          <CardContent className="flex min-h-[180px] flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="size-8 text-[#9b9ca5]" />
            <p className="mt-3 text-sm font-bold text-[#3a3b45]">Rest day — nothing scheduled.</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Today isn't a study day in your availability. Your next plan will skip it.
            </p>
          </CardContent>
        </Card>
      ) : model.entries.length === 0 ? (
        <Card className="mt-4 rounded-[24px] border-dashed border-[#d8dae5] bg-white py-0 shadow-none">
          <CardContent className="flex min-h-[180px] flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="size-8 text-[#9b9ca5]" />
            <p className="mt-3 text-sm font-bold text-[#3a3b45]">Nothing scheduled today.</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Apply a plan from the Recommendation tab, then your work will appear here as clock
              slots.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => onNavigate("study")}
            >
              Study now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-4 rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
          <CardContent
            className="p-5"
            data-time-start={model.dayStart}
            data-time-end={model.dayEnd}
            onDragOver={allowActivityDrop}
            onDrop={handleDrop}
          >
            <div className="space-y-1.5">
              {model.entries.map((entry, index) => {
                const prev = model.entries[index - 1];
                const gap = prev && entry.start > prev.end ? { start: prev.end, end: entry.start } : null;
                const activity = entry.activityId ? byId.get(entry.activityId) : undefined;
                const Icon = activity ? KIND_ICONS[activity.kind] : null;
                const actionable = activity ? isActionableStatus(activity.status) : false;
                const objectiveLabel = activity
                  ? activity.objectiveIds.length > 0
                    ? activity.objectiveIds.map((id) => objectiveById.get(id) ?? id).join(", ")
                    : "Whole-goal activity"
                  : "";
                return (
                  <Fragment key={index}>
                    {gap && (
                      <div
                        data-time-start={gap.start}
                        data-time-end={gap.end}
                        className="flex items-center gap-2 px-2 py-1 text-[11px] font-medium text-[#a0a1ab]"
                      >
                        <span className="h-px flex-1 bg-[#ececf1]" />
                        {minutesToTime(gap.start)}–{minutesToTime(gap.end)} free
                      </div>
                    )}
                    {entry.type === "commitment" ? (
                      <div
                        data-time-start={entry.start}
                        data-time-end={entry.end}
                        className="flex items-center justify-between rounded-[14px] border border-[#f0e3c2] bg-[#fff8ea] px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5 text-[#a97a1f]" />
                          <span className="text-xs font-bold text-[#7a5a16]">Busy · {entry.label}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#8a6f2e]">
                          {minutesToTime(entry.start)}–{minutesToTime(entry.end)}
                        </span>
                      </div>
                    ) : (
                      <div
                        draggable={actionable}
                        onDragStart={(event) => {
                          if (!activity || !actionable) return;
                          setActivityDrag(event, activity.id);
                        }}
                        data-time-start={entry.start}
                        data-time-end={entry.end}
                        className={`flex items-center justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] px-3 py-2.5 ${
                          actionable ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5a6a94]">
                            {Icon && <Icon className="size-3.5 text-[#5871ae]" />}
                            {ACTIVITY_KIND_LABELS[activity!.kind]}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[#3a3b45]">{objectiveLabel}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusClass(activity!.status)}`}>
                            {STATUS_LABELS[activity!.status]}
                          </span>
                          <span className="text-xs font-bold text-[#3a3b45]">
                            {minutesToTime(entry.start)}–{minutesToTime(entry.end)}
                          </span>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
            {model.unplaced.length > 0 && (
              <p className="mt-3 rounded-[12px] border border-[#fff0dc] bg-[#fff8ea] px-3 py-2 text-[11px] font-semibold text-[#87531b]">
                {model.unplaced.length} activit{model.unplaced.length === 1 ? "y" : "ies"} don't fit
                today's windows — widen a window or split the work.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

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
  const [replacing, setReplacing] = useState<StudyActivity | null>(null);
  const [explaining, setExplaining] = useState<ExplainTarget | null>(null);

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

  const subjectById = useMemo(
    () => new Map(curriculum.subjects.map((subject) => [subject.id, subject.title])),
    [curriculum.subjects],
  );

  const planState = useMemo<PlanState | null>(() => {
    if (loading || !availability) return null;
    return {
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
    };
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

  const plan = useMemo(() => (planState ? planStudy(planState) : null), [planState]);

  const replacementOptions = useMemo(() => {
    if (!replacing || !planState) return [];
    return replacementCandidates({
      state: planState,
      current: { kind: replacing.kind, objectiveIds: replacing.objectiveIds },
      limit: 5,
    });
  }, [replacing, planState]);

  const roadmap = useMemo(() => (planState ? projectRoadmap(planState) : null), [planState]);

  const recovery = useMemo(() => (planState ? recoveryPlan(planState) : null), [planState]);

  const explanation = useMemo(() => {
    if (!explaining || !planState) return null;
    return explainActivity({ state: planState, target: explaining });
  }, [explaining, planState]);

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
    if (!plan || !availability) return;
    setApplying(true);
    try {
      const lastDay = plan.days[plan.days.length - 1];
      const occupiedByDate = new Map<string, { start: string; end: string }[]>();
      for (const activity of activities) {
        if (!activity.start || !activity.end) continue;
        if (activity.source !== "manual" && activity.pinned !== true) continue;
        const list = occupiedByDate.get(activity.date) ?? [];
        list.push({ start: activity.start, end: activity.end });
        occupiedByDate.set(activity.date, list);
      }
      const placements = placePlannedActivities(flatActivities, availability, occupiedByDate);
      await applyPlan(flatActivities, { start: plan.horizonStart, end: lastDay.date }, placements);
      setApplied(true);
      setView("today");
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

  const handleScheduleDayDrop = async (event: DragEvent, date: string) => {
    event.preventDefault();
    if (!availability) return;
    const activityId = draggedActivityId(event);
    if (!activityId) return;
    const dragged = activities.find((activity) => activity.id === activityId);
    if (!dragged) return;

    if (!isStudyDay(date, availability)) {
      toast.error("That's a rest day — pick a study day.");
      return;
    }
    const occupied = occupiedBlocksForDate(activities, date, activityId);
    const placement = snapActivity({
      date,
      minutes: dragged.plannedMinutes,
      requestedStart: "00:00",
      availability,
      occupied,
    });
    if (!placement) {
      toast.error("That day has no free window that fits this activity.");
      return;
    }
    try {
      await moveActivity(activityId, { date, start: placement.start, end: placement.end });
      toast.success(`Moved to ${formatDateKey(date)}`);
    } catch {
      toast.error("Could not move the activity. Try again.");
    }
  };

  const handleSnooze = async (activity: StudyActivity) => {
    if (!availability) return;
    const target = nextStudyDayAfter(activity.date, availability);
    if (!target) {
      toast.error("No study day found in the next week.");
      return;
    }
    const occupied = occupiedBlocksForDate(activities, target, activity.id);
    const placement = snapActivity({
      date: target,
      minutes: activity.plannedMinutes,
      requestedStart: "00:00",
      availability,
      occupied,
    });
    try {
      await snoozeActivity(activity.id, {
        date: target,
        start: placement?.start,
        end: placement?.end,
      });
      toast.success(`Snoozed to ${formatDateKey(target)}`);
    } catch {
      toast.error("Could not snooze the activity. Try again.");
    }
  };

  const handleMove = async (activity: StudyActivity, date: string) => {
    if (!availability) return;
    if (!isStudyDay(date, availability)) {
      toast.error("That's a rest day — pick a study day.");
      return;
    }
    const occupied = occupiedBlocksForDate(activities, date, activity.id);
    const placement = snapActivity({
      date,
      minutes: activity.plannedMinutes,
      requestedStart: "00:00",
      availability,
      occupied,
    });
    if (!placement) {
      toast.error("That day has no free window that fits this activity.");
      return;
    }
    try {
      await moveActivity(activity.id, { date, start: placement.start, end: placement.end });
      toast.success(`Moved to ${formatDateKey(date)}`);
    } catch {
      toast.error("Could not move the activity. Try again.");
    }
  };

  const handleReplace = async (candidate: ReplacementCandidate) => {
    if (!replacing) return;
    try {
      await replaceActivity(replacing.id, {
        objectiveIds: [candidate.objectiveId],
        subjectId: candidate.subjectId,
        kind: candidate.kind,
        questionType: candidate.questionType,
      });
      toast.success("Activity replaced");
      setReplacing(null);
    } catch {
      toast.error("Could not replace the activity. Try again.");
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
        {(["recommendation", "calendar", "roadmap", "today", "schedule"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`cursor-pointer h-8 rounded-full px-4 text-xs font-bold transition-colors ${
              view === value ? "bg-[#e1e8ff] text-[#244a9c]" : "text-[#777883]"
            }`}
          >
            {value === "recommendation"
              ? "Recommendation"
              : value === "calendar"
                ? "Calendar"
                : value === "roadmap"
                  ? "Roadmap"
                  : value === "today"
                    ? "Today"
                    : "My schedule"}
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
                    <div className="mt-3">
                      {recovery && recovery.options.length > 0 ? (
                        <div className="rounded-[12px] bg-white/70 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a6f2e]">
                            Your catch-up options
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {recovery.options.map((option) => (
                              <li key={option.kind} className="text-[11px] leading-4 text-[#8a6f2e]">
                                {option.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-[11px] leading-4 text-[#8a6f2e]">
                          Your choices: reduce optional topics, add study time, or move the exam date.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] leading-4 text-[#8a6f2e]">
                        The plan below schedules the highest-value work first, not everything at
                        once.
                      </p>
                    </div>
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
                <DayCard
                  key={day.date}
                  day={day}
                  objectiveById={objectiveById}
                  onExplain={(activity) => setExplaining(activity)}
                />
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
      ) : view === "calendar" ? (
        <CalendarView objectiveById={objectiveById} onNavigate={onNavigate} />
      ) : view === "roadmap" ? (
        roadmap ? (
          <RoadmapView roadmap={roadmap} objectiveById={objectiveById} subjectById={subjectById} />
        ) : null
      ) : view === "today" ? (
        <TodayView objectiveById={objectiveById} onNavigate={onNavigate} />
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
                    onDragOver={allowActivityDrop}
                    onDrop={(event) => handleScheduleDayDrop(event, day.date)}
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
                            onSnooze={handleSnooze}
                            onReplace={setReplacing}
                            onExplain={(activity) => setExplaining(activity)}
                            onMove={handleMove}
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

      <Dialog open={replacing !== null} onOpenChange={(open) => !open && setReplacing(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Replace this activity</DialogTitle>
            <DialogDescription>
              Swap the slot's content for the next-highest-value work. The date and time stay put.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {replacementOptions.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-[#d8dae5] p-4 text-center text-xs text-muted-foreground">
                No alternative work is available right now — everything else is already scheduled or
                blocked.
              </p>
            ) : (
              replacementOptions.map((candidate) => {
                const Icon = KIND_ICONS[candidate.kind];
                return (
                  <button
                    key={`${candidate.objectiveId}-${candidate.kind}`}
                    type="button"
                    onClick={() => handleReplace(candidate)}
                    className="cursor-pointer flex items-start gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3 text-left hover:bg-[#f4f5fa]"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-[#5871ae]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#3a3b45]">
                        {candidate.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-[#5a6a94]">
                        {ACTIVITY_KIND_LABELS[candidate.kind]}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#8a8b95]">
                        {candidate.reason}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={explaining !== null} onOpenChange={(open) => !open && setExplaining(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Why this activity?</DialogTitle>
            <DialogDescription>
              {explanation
                ? `${ACTIVITY_KIND_LABELS[explanation.kind]} · ${
                    explanation.objectiveTitles.length === 0
                      ? "Whole-goal activity"
                      : explanation.objectiveTitles.length <= 3
                        ? explanation.objectiveTitles.join(", ")
                        : `${explanation.objectiveTitles.length} objectives`
                  } · ${formatDateKey(explanation.date)} · ${explanation.plannedMinutes} min`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {explanation && (
            <div className="grid gap-3">
              {explanation.priority && (
                <div className="rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Priority</p>
                  <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#23242c]">
                    {Math.round(explanation.priority.score * 100)}
                    <span className="text-sm font-semibold text-[#8a8b95]">/100</span>
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["Importance", explanation.priority.importance],
                        ["Topic", explanation.priority.topic],
                        ["Subject", explanation.priority.subject],
                        ["Urgency", explanation.priority.urgency],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-[10px] bg-[#f1f2f7] px-2 py-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9b9ca5]">{label}</p>
                        <p className="text-sm font-bold text-[#3a3b45]">{Math.round(value * 100)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanation.due && (
                <div className="rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Due review</p>
                  <p className="mt-1 text-sm font-semibold text-[#3a3b45]">
                    {explanation.due.cardCount} card{explanation.due.cardCount === 1 ? "" : "s"} due
                    {explanation.due.overdueCount > 0 && ` · ${explanation.due.overdueCount} overdue`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8a8b95]">
                    ~{explanation.due.minutes} min at your observed review pace.
                  </p>
                </div>
              )}

              {explanation.prereqs && (
                <div
                  className={`rounded-[14px] border p-3 ${
                    explanation.prereqs.unlocked
                      ? "border-[#e4f3e9] bg-[#f0f9f3]"
                      : "border-[#fff0dc] bg-[#fff8ea]"
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Prerequisites</p>
                  <p className="mt-1 text-sm font-semibold text-[#3a3b45]">
                    {explanation.prereqs.unlocked
                      ? "Unlocked — earlier topics are practised."
                      : `Waiting on: ${explanation.prereqs.missingTitles.join(", ") || "earlier topics"}`}
                  </p>
                </div>
              )}

              <div className="rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Capacity</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9b9ca5]">Effective</p>
                    <p className="text-sm font-bold text-[#3a3b45]">{explanation.capacity.effectiveMinutes} min</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9b9ca5]">Configured</p>
                    <p className="text-sm font-bold text-[#3a3b45]">{explanation.capacity.configuredCap} min</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9b9ca5]">Observed</p>
                    <p className="text-sm font-bold text-[#3a3b45]">
                      {explanation.capacity.observedPerDay === null
                        ? "—"
                        : `${Math.round(explanation.capacity.observedPerDay)} min`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9b9ca5]">Sessions</p>
                    <p className="text-sm font-bold text-[#3a3b45]">{explanation.capacity.evidenceSessions}</p>
                  </div>
                </div>
              </div>

              {explanation.reasons.length > 0 && (
                <div className="rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">In plain terms</p>
                  <ul className="mt-1.5 space-y-1">
                    {explanation.reasons.map((reason, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs leading-5 text-[#5a5b68]">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-[#5871ae]" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
