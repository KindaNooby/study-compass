import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Fragment, useMemo, type DragEvent } from "react";
import { toast } from "sonner";

import {
  ACTIVITY_KIND_LABELS,
  buildDayTimetable,
  isAvailabilityConfigured,
  minutesToTime,
  moveActivity,
  nextDateKeys,
  occupiedBlocksForDate,
  snapActivity,
  todayKey,
  useActivities,
  useAvailability,
  WEEKDAYS,
} from "@/lib/planner";
import { allowActivityDrop, draggedActivityId, setActivityDrag } from "./dnd";
import { isActionableStatus, KIND_ICONS, STATUS_LABELS, statusClass } from "./shared";

function shortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${dateKey}T12:00:00`),
  );
}

export function CalendarView({
  objectiveById,
  onNavigate,
}: {
  objectiveById: Map<string, string>;
  onNavigate: (view: "setup" | "study") => void;
}) {
  const { data: activities } = useActivities();
  const { availability } = useAvailability();
  const today = todayKey();

  const days = useMemo(() => {
    if (!availability) return null;
    const week = nextDateKeys(today, 7);
    return week.map((date) => buildDayTimetable({ date, activities, availability }));
  }, [activities, availability, today]);

  const byId = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [
    activities,
  ]);

  if (!availability || !days) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleDrop = async (event: DragEvent, date: string) => {
    event.preventDefault();
    const activityId = draggedActivityId(event);
    if (!activityId) return;
    const dragged = activities.find((activity) => activity.id === activityId);
    if (!dragged) return;
    const day = days.find((item) => item.date === date);
    if (!day || !day.isStudyDay) {
      toast.error("That's a rest day — pick a study day.");
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-time-start]");
    let requested = day.dayStart;
    if (target) {
      const start = Number(target.dataset.timeStart);
      const end = Number(target.dataset.timeEnd);
      const rect = target.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
      requested = Math.round((start + ratio * (end - start)) / 5) * 5;
    }

    const occupied = occupiedBlocksForDate(activities, date, activityId);
    const placement = snapActivity({
      date,
      minutes: dragged.plannedMinutes,
      requestedStart: minutesToTime(requested),
      availability,
      occupied,
    });
    if (!placement) {
      toast.error("That spot doesn't fit this day's free time.");
      return;
    }
    try {
      await moveActivity(activityId, { date, start: placement.start, end: placement.end });
      toast.success("Activity moved");
    } catch {
      toast.error("Could not move the activity. Try again.");
    }
  };

  const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#2c2d36]">Calendar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Next 7 days, in clock time. Drag work to move it within or across days.
          </p>
        </div>
        <span className="rounded-full bg-[#e6ecff] px-3 py-1 text-[11px] font-bold text-[#2c4b99]">
          {totalMinutes} min planned
        </span>
      </div>

      {!isAvailabilityConfigured(availability) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#f0e3c2] bg-[#fff8ea] px-5 py-4">
          <p className="text-xs font-semibold text-[#7a5a16]">
            Set your availability to see a real week — every day is currently a rest day.
          </p>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onNavigate("setup")}
          >
            Set availability
          </Button>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const weekday = WEEKDAYS.find((item) => item.value === day.weekday);
          const isToday = day.date === today;
          return (
            <div
              key={day.date}
              onDragOver={allowActivityDrop}
              onDrop={(event) => handleDrop(event, day.date)}
              data-time-start={day.dayStart}
              data-time-end={day.dayEnd}
              className={`flex min-h-[260px] flex-col rounded-[18px] border bg-white p-3 ${
                isToday ? "border-[#c3d0f5] ring-2 ring-[#e6ecff]" : "border-[#e3e4eb]"
              }`}
            >
              <div className="mb-2 border-b border-[#f0f1f6] pb-2">
                <p className={`text-xs font-bold ${isToday ? "text-[#244a9c]" : "text-[#3a3b45]"}`}>
                  {isToday ? "Today" : weekday?.short} · {shortDate(day.date)}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#9b9ca5]">
                  {day.isStudyDay
                    ? `${day.totalMinutes} min · ${day.entries.length} block${day.entries.length === 1 ? "" : "s"}`
                    : "Rest day"}
                </p>
              </div>

              {!day.isStudyDay ? (
                <div className="flex flex-1 items-center justify-center rounded-[12px] border border-dashed border-[#d8dae5] p-3 text-center">
                  <p className="text-[11px] font-medium text-[#a0a1ab]">No study planned</p>
                </div>
              ) : day.entries.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[12px] border border-dashed border-[#d8dae5] p-3 text-center">
                  <p className="text-[11px] font-medium text-[#a0a1ab]">
                    {isToday ? "Nothing scheduled today" : "Nothing scheduled"}
                  </p>
                </div>
              ) : (
                <div className="flex-1 space-y-1">
                  {day.entries.map((entry, index) => {
                    const prev = day.entries[index - 1];
                    const gap =
                      prev && entry.start > prev.end ? { start: prev.end, end: entry.start } : null;
                    const activity = entry.activityId ? byId.get(entry.activityId) : undefined;
                    const Icon = activity ? KIND_ICONS[activity.kind] : null;
                    const actionable = activity ? isActionableStatus(activity.status) : false;
                    const objectiveLabel = activity
                      ? activity.objectiveIds.length > 0
                        ? activity.objectiveIds.map((id) => objectiveById.get(id) ?? id).join(", ")
                        : "Whole-goal activity"
                      : "";
                    return (
                      <Fragment key={`${day.date}-${index}`}>
                        {gap && (
                          <div
                            data-time-start={gap.start}
                            data-time-end={gap.end}
                            className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-medium text-[#b4b5bd]"
                          >
                            <span className="h-px flex-1 bg-[#ececf1]" />
                            free
                          </div>
                        )}
                        {entry.type === "commitment" ? (
                          <div
                            data-time-start={entry.start}
                            data-time-end={entry.end}
                            className="rounded-[10px] border border-[#f0e3c2] bg-[#fff8ea] px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[10px] font-bold text-[#7a5a16]">
                                Busy · {entry.label}
                              </span>
                              <span className="shrink-0 text-[9px] font-semibold text-[#8a6f2e]">
                                {minutesToTime(entry.start)}
                              </span>
                            </div>
                          </div>
                        ) : activity ? (
                          <div
                            draggable={actionable}
                            onDragStart={(event) => {
                              if (!actionable) return;
                              setActivityDrag(event, activity.id);
                            }}
                            data-time-start={entry.start}
                            data-time-end={entry.end}
                            className={`rounded-[10px] border border-[#e8e9f1] bg-[#fbfbfd] px-2 py-1.5 ${
                              actionable ? "cursor-grab active:cursor-grabbing" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#5a6a94]">
                                {Icon && <Icon className="size-3 shrink-0 text-[#5871ae]" />}
                                <span className="truncate">{ACTIVITY_KIND_LABELS[activity.kind]}</span>
                              </span>
                              <span className="shrink-0 text-[9px] font-semibold text-[#9b9ca5]">
                                {minutesToTime(entry.start)}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#3a3b45]">
                              {objectiveLabel}
                            </p>
                            <div className="mt-0.5 flex items-center justify-between gap-1">
                              <span className="text-[9px] font-semibold text-[#9b9ca5]">
                                {entry.end - entry.start} min
                              </span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${statusClass(activity.status)}`}
                              >
                                {STATUS_LABELS[activity.status]}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {day.unplaced.length > 0 && (
                    <p className="rounded-[10px] border border-[#fff0dc] bg-[#fff8ea] px-2 py-1.5 text-[10px] font-semibold text-[#87531b]">
                      {day.unplaced.length} don't fit today's windows
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
