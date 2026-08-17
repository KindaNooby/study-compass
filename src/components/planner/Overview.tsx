import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDateKey,
  isAvailabilityConfigured,
  nextExam,
  useAvailability,
  useCurriculum,
  useExamGoals,
} from "@/lib/planner";
import { ArrowRight, BookOpen, CalendarClock, Gauge, Loader2 } from "lucide-react";

type Destination = "curriculum" | "setup" | "plan";

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        ready ? "bg-[#e4f3e9] text-[#276641]" : "bg-[#fff0dc] text-[#87531b]"
      }`}
    >
      {ready ? "Ready" : "Needs setup"}
    </span>
  );
}

function SetupCard({
  icon: Icon,
  title,
  description,
  ready,
  detail,
  cta,
  destination,
  onNavigate,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  ready: boolean;
  detail: string;
  cta: string;
  destination: Destination;
  onNavigate: (destination: Destination) => void;
}) {
  return (
    <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
      <CardHeader className="flex flex-row items-start justify-between px-6 pb-2 pt-6">
        <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#e8edff] text-[#4c68b7]">
          <Icon className="size-5" />
        </div>
        <StatusPill ready={ready} />
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">{title}</CardTitle>
        <CardDescription className="mt-1 text-xs">{description}</CardDescription>
        <p className="mt-4 text-sm font-semibold text-[#5a5b68]">{detail}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 h-9 rounded-full px-0 font-bold text-[#3157a2] hover:bg-transparent hover:text-[#244a9c]"
          onClick={() => onNavigate(destination)}
        >
          {cta} <ArrowRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function Overview({ onNavigate }: { onNavigate: (destination: Destination) => void }) {
  const curriculum = useCurriculum();
  const goalsQuery = useExamGoals();
  const availabilityQuery = useAvailability();

  const goals = goalsQuery.data;
  const availability = availabilityQuery.availability;
  const upcoming = availability && goals.length > 0 ? nextExam(goals) : undefined;
  const loading =
    curriculum.loading || goalsQuery.loading || availabilityQuery.loading || availability === undefined;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const objectivesReady = curriculum.objectives.length > 0;
  const goalsReady = goals.length > 0;
  const availabilityReady = isAvailabilityConfigured(availability);

  return (
    <>
      <section>
        <p className="text-sm font-semibold text-[#71727e]">Workspace</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">
          Your study workspace
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71727e]">
          Build the curriculum, set your goals, then record real study sessions. Measurement turns
          those sessions into an honest picture of what you can actually cover.
        </p>
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-3">
        <SetupCard
          icon={BookOpen}
          title="Curriculum"
          description="Subjects → units → topics → learning objectives."
          ready={objectivesReady}
          detail={
            objectivesReady
              ? `${curriculum.subjects.length} subject${curriculum.subjects.length === 1 ? "" : "s"} · ${curriculum.objectives.length} objective${curriculum.objectives.length === 1 ? "" : "s"}`
              : "No objectives yet"
          }
          cta="Build curriculum"
          destination="curriculum"
          onNavigate={onNavigate}
        />
        <SetupCard
          icon={CalendarClock}
          title="Exam goals"
          description="One or more exams, with dates, targets, and scope."
          ready={goalsReady}
          detail={
            upcoming
              ? `Next: ${upcoming.name} · ${formatDateKey(upcoming.examDate)}`
              : goals.length > 0
                ? `${goals.length} goal${goals.length === 1 ? "" : "s"} scheduled`
                : "No goals yet"
          }
          cta="Set up goals"
          destination="setup"
          onNavigate={onNavigate}
        />
        <SetupCard
          icon={Gauge}
          title="Availability"
          description="Your days, time windows, and constraints."
          ready={availabilityReady}
          detail={
            availabilityReady
              ? `${availability.availableDays.length} study days · ${availability.maxDailyStudyMinutes} min/day`
              : "No schedule configured"
          }
          cta="Set availability"
          destination="setup"
          onNavigate={onNavigate}
        />
      </section>

      <Card className="mt-6 rounded-[24px] border-[#e3e4eb] bg-[#eef2ff] py-0 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#536da8]">
              Your plan is ready
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#5a6a94]">
              The planner turns your curriculum, exam goals, and observed study time into a weekly
              allocation with a feasibility check. Open it to see what to do first.
            </p>
            <p className="mt-2 text-xs text-[#7a86a8]">
              Apply it to get an editable schedule — mark work complete, skip it, move it, or pin it
              in place. Coming later: a full calendar and drag-and-drop rescheduling.
            </p>
          </div>
          <Button
            type="button"
            className="h-10 rounded-full bg-[#3159b7] px-5 font-bold text-white hover:bg-[#264b9f]"
            onClick={() => onNavigate("plan")}
          >
            Open your plan <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
