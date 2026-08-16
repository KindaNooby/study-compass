import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACQUISITION_LABELS,
  ERROR_CATEGORIES,
  WEEKDAYS,
  isDue,
  measureCurriculum,
  observeCapacity,
  useMeasurementData,
  useObjectives,
} from "@/lib/planner";
import type { AcquisitionLevel } from "@/lib/planner";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function num(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${Math.round(value * 10) / 10}${suffix}`;
}

function acquisitionClass(level: AcquisitionLevel): string {
  switch (level) {
    case "ready":
      return "bg-[#e4f3e9] text-[#276641]";
    case "practised":
      return "bg-[#e0f2f0] text-[#1f6e68]";
    case "partially_learned":
      return "bg-[#fff0dc] text-[#87531b]";
    case "introduced":
      return "bg-[#e6ecff] text-[#2c4b99]";
    default:
      return "bg-[#f1f2f7] text-[#6f7079]";
  }
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-[20px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
      <CardContent className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">{label}</p>
        <p className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#23242c]">{value}</p>
        {hint && <p className="mt-1 text-[11px] font-medium text-[#8a8b95]">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Measure() {
  const { cards, reviewLogs, attempts, sessionLogs, loading } = useMeasurementData();
  const { data: objectives } = useObjectives();
  const now = new Date();

  const measurements = useMemo(
    () => measureCurriculum({ objectives, cards, attempts, logs: reviewLogs, now }),
    [objectives, cards, attempts, reviewLogs, now],
  );
  const capacity = useMemo(
    () => observeCapacity({ sessionLogs, attempts }),
    [sessionLogs, attempts],
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCards = cards.filter((card) => !card.suspended);
  const dueCount = activeCards.filter((card) => isDue(card, now)).length;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const overdueCount = activeCards.filter(
    (card) => isDue(card, now) && new Date(card.due).getTime() < dayStart.getTime(),
  ).length;

  const objectiveList = objectives.map((objective) => ({
    objective,
    measurement: measurements.get(objective.id),
  }));

  return (
    <>
      <section>
        <p className="text-sm font-semibold text-[#71727e]">Phase 2 · Measurement</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">Measure</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71727e]">
          Every number here is computed from the reviews, attempts, and sessions you recorded — never
          assumed. Small samples are shown cautiously.
        </p>
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active cards" value={String(activeCards.length)} hint={`${dueCount} due now`} />
        <StatCard label="Overdue" value={String(overdueCount)} hint="due before today" />
        <StatCard label="Reviews logged" value={String(reviewLogs.length)} hint="FSRS grades" />
        <StatCard label="Practice attempts" value={String(attempts.length)} hint="MCQ + structured" />
        <StatCard label="Completion rate" value={pct(capacity.completionRate)} hint={`${capacity.completedSessions}/${capacity.totalSessions} sessions`} />
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#2c2d36]">Mastery by objective</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acquisition, retention, and application — tracked separately.
            </p>
          </div>
        </div>

        {objectives.length === 0 ? (
          <Card className="mt-4 rounded-[24px] border-dashed border-[#d8dae5] bg-white py-0 shadow-none">
            <CardContent className="flex min-h-[180px] flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-semibold text-[#5a5b68]">Nothing to measure yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add learning objectives in Curriculum, then record study in Study now.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 grid gap-3">
            {objectiveList.map(({ objective, measurement }) => {
              if (!measurement) return null;
              const errors = measurement.errorBreakdown
                .map((item) => ERROR_CATEGORIES.find((category) => category.id === item.categoryId))
                .filter((category): category is NonNullable<typeof category> => Boolean(category));
              return (
                <div key={objective.id} className="rounded-[18px] border border-[#e3e4eb] bg-white p-5 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-[#3a3b45]">{objective.title}</p>
                      <p className="mt-1 text-xs text-[#8a8b95]">
                        {measurement.retention.reviewCount} review{measurement.retention.reviewCount === 1 ? "" : "s"} ·{" "}
                        {measurement.totalAttempts} attempt{measurement.totalAttempts === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge className={`${acquisitionClass(measurement.acquisition)} border-0 px-3 py-1 text-[11px] font-bold`}>
                      {ACQUISITION_LABELS[measurement.acquisition]}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[14px] bg-[#f6f7fb] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Retention</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">
                        {pct(measurement.retention.averageRetrievability)} recall
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#8a8b95]">
                        {measurement.retention.dueCount} due · {measurement.retention.overdueCount} overdue · {num(measurement.retention.averageStability, "d")} stability
                      </p>
                    </div>
                    <div className="rounded-[14px] bg-[#f6f7fb] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">MCQ application</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">
                        {pct(measurement.mcq.adjusted)}
                        <span className="ml-1 text-[11px] font-semibold text-[#8a8b95]">n={measurement.mcq.attempts}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#8a8b95]">{measurement.mcq.attempts === 0 ? "No MCQ attempts yet" : "Adjusted for sample size"}</p>
                    </div>
                    <div className="rounded-[14px] bg-[#f6f7fb] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Structured application</p>
                      <p className="mt-1 text-sm font-bold text-[#3a3b45]">
                        {pct(measurement.structured.adjusted)}
                        <span className="ml-1 text-[11px] font-semibold text-[#8a8b95]">n={measurement.structured.attempts}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#8a8b95]">{measurement.structured.attempts === 0 ? "No structured attempts yet" : "Adjusted for sample size"}</p>
                    </div>
                  </div>

                  {errors.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[#8a8b95]">Common errors:</span>
                      {errors.slice(0, 3).map((category) => (
                        <Badge key={category.id} variant="outline" className="text-[10px]">{category.label}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
          <CardHeader className="px-6 pb-2 pt-6">
            <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Observed capacity</CardTitle>
            <CardDescription className="mt-1 text-xs">
              What your recorded sessions actually show, independent of what you planned.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {sessionLogs.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-[#d8dae5] p-6 text-center text-xs text-muted-foreground">
                No sessions logged yet. Log study time in Study now to build an observed picture.
              </p>
            ) : (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Avg session</p>
                    <p className="mt-1 text-sm font-bold text-[#3a3b45]">{num(capacity.averageSessionMinutes, " min")}</p>
                    <p className="text-[11px] text-[#8a8b95]">planned {num(capacity.averagePlannedMinutes, " min")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Time per MCQ</p>
                    <p className="mt-1 text-sm font-bold text-[#3a3b45]">{num(capacity.averageTimePerMcqSeconds, "s")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Time per structured</p>
                    <p className="mt-1 text-sm font-bold text-[#3a3b45]">{num(capacity.averageTimePerStructuredSeconds, "s")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Disrupted sessions</p>
                    <p className="mt-1 text-sm font-bold text-[#3a3b45]">
                      {capacity.postponedCount + capacity.missedCount + capacity.skippedCount + capacity.partialCount}
                    </p>
                    <p className="text-[11px] text-[#8a8b95]">
                      {capacity.postponedCount} postponed · {capacity.missedCount} missed · {capacity.skippedCount} skipped · {capacity.partialCount} partial
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b9ca5]">Completion by weekday</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const bucket = capacity.byWeekday[day.value];
                      const hasData = bucket && bucket.sessions > 0;
                      return (
                        <div
                          key={day.value}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                            hasData ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]" : "border-[#e6e7ef] text-[#a0a1ab]"
                          }`}
                        >
                          {day.short} {hasData ? `${Math.round((bucket.rate ?? 0) * 100)}% (${bucket.sessions})` : "—"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
