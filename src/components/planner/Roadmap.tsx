import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateKey } from "@/lib/planner";
import type { Roadmap } from "@/lib/planner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Flag,
  TrendingUp,
} from "lucide-react";

function daysAwayLabel(days: number): string {
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${-days} day${days === -1 ? "" : "s"} ago`;
}

export function RoadmapView({
  roadmap,
  objectiveById,
  subjectById,
}: {
  roadmap: Roadmap;
  objectiveById: Map<string, string>;
  subjectById: Map<string, string>;
}) {
  const statusTone =
    roadmap.onTrack === null
      ? { bg: "bg-[#e6ecff]", text: "text-[#2c4b99]", label: "No exam goal yet" }
      : roadmap.onTrack
        ? { bg: "bg-[#e4f3e9]", text: "text-[#276641]", label: "On track" }
        : { bg: "bg-[#fff0dc]", text: "text-[#87531b]", label: "Behind schedule" };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#2c2d36]">Progress roadmap</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Projected finish, subject coverage, and the milestones ahead.
          </p>
        </div>
        <span className="rounded-full bg-[#e6ecff] px-3 py-1 text-[11px] font-bold text-[#2c4b99]">
          {roadmap.remainingMinutes} min remaining
        </span>
      </div>

      <Card className="mt-4 rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${statusTone.bg} ${statusTone.text}`}
              >
                {roadmap.onTrack === true ? (
                  <CheckCircle2 className="size-3.5" />
                ) : roadmap.onTrack === false ? (
                  <AlertTriangle className="size-3.5" />
                ) : (
                  <CalendarDays className="size-3.5" />
                )}
                {statusTone.label}
              </span>
              <div className="mt-3 flex flex-wrap gap-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">
                    Projected finish
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#23242c]">
                    {roadmap.projectedFinishDate
                      ? formatDateKey(roadmap.projectedFinishDate)
                      : "Not in range"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Exam</p>
                  <p className="mt-1 text-lg font-bold text-[#23242c]">
                    {roadmap.examDate ? formatDateKey(roadmap.examDate) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Pace</p>
                  <p className="mt-1 text-lg font-bold text-[#23242c]">
                    {roadmap.effectiveDailyMinutes} min/day
                  </p>
                </div>
              </div>
            </div>
            {roadmap.daysToExam !== null && (
              <div className="rounded-[16px] bg-[#f4f5fa] px-4 py-3 text-center">
                <p className="text-2xl font-bold tracking-[-0.03em] text-[#23242c]">
                  {Math.max(0, roadmap.daysToExam)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">
                  days to exam
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
          <CardHeader className="px-6 pb-3 pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-[#5871ae]" />
              <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">Subject coverage</CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs">
              Completed versus estimated work per subject.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {roadmap.subjects.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-[#d8dae5] p-4 text-center text-xs text-muted-foreground">
                No subjects in scope yet.
              </p>
            ) : (
              <div className="grid gap-4">
                {roadmap.subjects.map((subject) => {
                  const title = subjectById.get(subject.subjectId) ?? subject.subjectId;
                  const percent = Math.round(subject.coverage * 100);
                  return (
                    <div key={subject.subjectId}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#3a3b45]">{title}</p>
                        <span className="text-xs font-bold text-[#5a5b68]">
                          {percent}% · {subject.completedMinutes}/{subject.totalMinutes} min
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#eef0f6]">
                        <div
                          className="h-full rounded-full bg-[#3159b7]"
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[#8a8b95]">
                        {subject.remainingMinutes} min to go
                        {subject.blockedMinutes > 0 && ` · ${subject.blockedMinutes} min blocked`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
          <CardHeader className="px-6 pb-3 pt-6">
            <div className="flex items-center gap-2">
              <Flag className="size-4 text-[#5871ae]" />
              <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">Milestones</CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs">
              Deadlines and the exam, in date order.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {roadmap.milestones.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-[#d8dae5] p-4 text-center text-xs text-muted-foreground">
                No milestones yet — add an exam goal with deadlines.
              </p>
            ) : (
              <div className="grid gap-2">
                {roadmap.milestones.map((milestone) => {
                  const Icon = milestone.kind === "exam" ? Flag : CalendarDays;
                  const past = milestone.daysAway < 0;
                  return (
                    <div
                      key={milestone.id}
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0 text-[#5871ae]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#3a3b45]">
                            {milestone.label}
                          </p>
                          <p className="text-[11px] text-[#8a8b95]">{formatDateKey(milestone.date)}</p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-bold ${
                          past ? "text-[#9b9ca5]" : "text-[#2c4b99]"
                        }`}
                      >
                        {daysAwayLabel(milestone.daysAway)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {roadmap.blockedObjectives.length > 0 && (
        <Card className="mt-4 rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
          <CardHeader className="px-6 pb-2 pt-6">
            <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">Blocked work</CardTitle>
            <CardDescription className="mt-1 text-xs">
              Can't start until an earlier objective is practised.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid gap-2">
              {roadmap.blockedObjectives.map((blocked) => (
                <div
                  key={blocked.objectiveId}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3"
                >
                  <p className="text-sm font-semibold text-[#3a3b45]">{blocked.title}</p>
                  <span className="text-[11px] text-[#8a8b95]">
                    Needs:{" "}
                    {blocked.missingPrerequisites
                      .map((id) => objectiveById.get(id) ?? id)
                      .join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
