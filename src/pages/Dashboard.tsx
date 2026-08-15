import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import {
  activityLabel,
  buildPlannerView,
  createInitialPlannerState,
  formatExamDate,
  formatMinutes,
  type ActivityKind,
  type PlannerState,
  type RiskState,
  type StudyActivity,
} from "@/lib/planner";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudOff,
  Flame,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type View = "overview" | "week" | "roadmap";

const STORAGE_KEY = "study-compass-planner-v1";

const kindStyles: Record<ActivityKind, string> = {
  fsrs_review: "bg-[#e8efff] text-[#3157a2]",
  learn_new_content: "bg-[#f3eafd] text-[#6c458e]",
  retrieval_practise: "bg-[#e5f4f1] text-[#2b685f]",
  mcq_practise: "bg-[#fff0e4] text-[#87521f]",
  structured_practise: "bg-[#e9effb] text-[#31557a]",
  error_correction: "bg-[#fff0f0] text-[#9a4c53]",
  mixed_exam_practice: "bg-[#e8f3ec] text-[#38634c]",
  mock_exam: "bg-[#f1eafa] text-[#684789]",
};

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function riskTone(risk: RiskState) {
  if (risk === "On track") return "bg-[#e4f3e9] text-[#276641]";
  if (risk === "Tight") return "bg-[#fff0dc] text-[#87531b]";
  if (risk === "At risk") return "bg-[#ffebdf] text-[#a54e32]";
  return "bg-[#ffe6e6] text-[#9c3737]";
}

function AppMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-[0_6px_14px_rgba(52,81,162,0.18)]">
        <Sparkles className="size-[19px]" strokeWidth={2.4} />
        <span className="absolute bottom-[7px] right-[7px] size-1.5 rounded-full bg-[#c7d3ff]" />
      </div>
      <div>
        <p className="text-[17px] font-bold tracking-[-0.02em] text-[#1b1b20]">Study Compass</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#73737f]">Offline study PWA</p>
      </div>
    </div>
  );
}

function NavItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof LayoutDashboard;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-semibold transition-colors ${
        active
          ? "bg-[#e1e8ff] text-[#244a9c]"
          : "text-[#666672] hover:bg-[#f1f2f8] hover:text-[#33343d]"
      }`}
    >
      <Icon className={`size-[19px] ${active ? "text-[#365db8]" : "text-[#7b7c88]"}`} strokeWidth={active ? 2.4 : 2} />
      {label}
      {active && <span className="ml-auto size-1.5 rounded-full bg-[#4169cf]" />}
    </button>
  );
}

function ActivityTypeBadge({ type }: { type: ActivityKind }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.03em] ${kindStyles[type]}`}>
      {activityLabel(type)}
    </span>
  );
}

function ActivityRow({
  activity,
  onComplete,
  onSkip,
  compact = false,
}: {
  activity: StudyActivity;
  onComplete: () => void;
  onSkip?: () => void;
  compact?: boolean;
}) {
  const completed = activity.status === "completed";
  return (
    <div className={`group flex items-center gap-3 ${compact ? "py-2.5" : "py-3.5"}`}>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-[12px] ${completed ? "bg-[#e3f3e9] text-[#2c7650]" : "bg-[#eef0f8] text-[#57617b]"}`}>
        {completed ? <Check className="size-4" strokeWidth={2.5} /> : <Clock3 className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`truncate text-sm font-bold ${completed ? "text-[#7d7e87] line-through" : "text-[#292a31]"}`}>{activity.title}</p>
          {!compact && <ActivityTypeBadge type={activity.type} />}
        </div>
        <p className="mt-1 text-xs text-[#777883]">{activity.detail} <span className="mx-1 text-[#c4c4ca]">·</span> {activity.plannedMinutes} min</p>
      </div>
      {!completed && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button type="button" variant="ghost" size="icon-sm" className="text-[#686975]" onClick={onSkip} aria-label={`Skip ${activity.title}`}>
            <X className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" className="text-[#3157a2]" onClick={onComplete} aria-label={`Complete ${activity.title}`}>
            <Check className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Clock3;
  tone: string;
}) {
  return (
    <div className="rounded-[20px] bg-[#f4f4f9] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#747580]">{label}</span>
        <div className={`flex size-8 items-center justify-center rounded-full ${tone}`}><Icon className="size-4" /></div>
      </div>
      <p className="mt-4 text-[26px] font-bold tracking-[-0.04em] text-[#202126]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#81828d]">{detail}</p>
    </div>
  );
}

function Overview({
  state,
  planner,
  nextActivity,
  todayActivities,
  onStart,
  onComplete,
  onSkip,
  onViewWeek,
  firstName,
}: {
  state: PlannerState;
  planner: ReturnType<typeof buildPlannerView>;
  nextActivity: StudyActivity;
  todayActivities: StudyActivity[];
  onStart: (activity: StudyActivity) => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onViewWeek: () => void;
  firstName: string;
}) {
  const completedToday = todayActivities.filter((activity) => activity.status === "completed").reduce((sum, activity) => sum + activity.completedMinutes, 0);
  const plannedToday = todayActivities.reduce((sum, activity) => sum + activity.plannedMinutes, 0);
  const progressToday = plannedToday ? Math.min(100, Math.round((completedToday / plannedToday) * 100)) : 0;

  return (
    <>
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#6f707b]">{formatToday()} <span className="mx-2 text-[#c2c3cb]">/</span> Week 3 of 6</p>
          <h1 className="mt-2 text-[32px] font-bold leading-tight tracking-[-0.045em] text-[#1e1f24] sm:text-[38px]">Good evening, {firstName}.</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#71727d]">One clear next step is better than a perfect plan. Here&apos;s what will move your exam readiness forward today.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[#dce0ed] bg-white/70 px-3 py-2 text-xs font-bold text-[#5a5b68] md:self-auto">
          <CloudOff className="size-4 text-[#536ca8]" />
          Saved on this device
        </div>
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(300px,0.8fr)]">
        <Card className="overflow-hidden rounded-[28px] border-0 bg-[#dfe8ff] py-0 shadow-[0_12px_30px_rgba(55,77,142,0.08)]">
          <CardContent className="relative flex min-h-[300px] flex-col justify-between p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-24 size-[270px] rounded-full border-[38px] border-[#c8d5ff]/70" />
            <div className="pointer-events-none absolute bottom-[-90px] right-[18%] size-[220px] rounded-full border-[28px] border-[#cad7ff]/40" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#4663a0]"><Sparkles className="size-4" /> Recommended next</div>
              <h2 className="mt-5 max-w-lg text-[25px] font-bold leading-tight tracking-[-0.035em] text-[#1f356b] sm:text-[30px]">{nextActivity.title}</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#52658e]">{nextActivity.reason}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <ActivityTypeBadge type={nextActivity.type} />
                <span className="text-xs font-semibold text-[#52658e]">{nextActivity.plannedMinutes} min · {nextActivity.detail}</span>
              </div>
            </div>
            <div className="relative mt-8 flex flex-wrap items-center gap-3">
              <Button type="button" className="h-11 rounded-full bg-[#3159b7] px-5 font-bold text-white shadow-[0_5px_12px_rgba(49,89,183,0.22)] hover:bg-[#264b9f]" onClick={() => onStart(nextActivity)}>
                <Play className="size-4 fill-current" /> Start focus
              </Button>
              <Button type="button" variant="ghost" className="h-11 rounded-full px-4 font-bold text-[#3f5790] hover:bg-white/50" onClick={onViewWeek}>
                See this week <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-[#e2e3ea] bg-white py-0 shadow-[0_8px_24px_rgba(39,41,57,0.04)]">
          <CardHeader className="flex flex-row items-center justify-between px-6 pb-0 pt-6">
            <div>
              <CardTitle className="text-[17px] font-bold tracking-[-0.02em]">Today at a glance</CardTitle>
              <p className="mt-1 text-xs font-medium text-[#858691]">A plan you can actually keep</p>
            </div>
            <div className="relative flex size-[58px] items-center justify-center rounded-full" style={{ background: `conic-gradient(#4e6fc4 ${progressToday}%, #e7e9f2 0)` }}>
              <div className="flex size-[44px] items-center justify-center rounded-full bg-white text-xs font-bold text-[#3d579d]">{progressToday}%</div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-5">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Time planned" value={formatMinutes(plannedToday || 90)} detail={`${formatMinutes(completedToday)} complete`} icon={TimerReset} tone="bg-[#e5edff] text-[#4563a9]" />
              <MetricCard label="FSRS demand" value={`${planner.dueCards} cards`} detail="6 overdue · protected" icon={RotateCcw} tone="bg-[#e4f2ed] text-[#36745a]" />
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-[#ececf1] pt-4 text-xs">
              <span className="font-semibold text-[#767783]">Available window</span>
              <span className="font-bold text-[#353640]">{state.capacity.studyWindow}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <Card className="rounded-[28px] border-[#e2e3ea] bg-white py-0 shadow-[0_8px_24px_rgba(39,41,57,0.04)]">
          <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-6 sm:px-7">
            <div>
              <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Today&apos;s plan</CardTitle>
              <p className="mt-1 text-xs font-medium text-[#858691]">{todayActivities.length || 1} activities · ordered by value</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="rounded-full text-[#777985]" onClick={onViewWeek} aria-label="Open weekly plan"><MoreHorizontal className="size-5" /></Button>
          </CardHeader>
          <CardContent className="px-6 pb-4 sm:px-7">
            {todayActivities.length ? todayActivities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} onComplete={() => onComplete(activity.id)} onSkip={() => onSkip(activity.id)} />
            )) : <ActivityRow activity={nextActivity} onComplete={() => onComplete(nextActivity.id)} onSkip={() => onSkip(nextActivity.id)} />}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-[#e2e3ea] bg-white py-0 shadow-[0_8px_24px_rgba(39,41,57,0.04)]">
          <CardHeader className="px-6 pb-2 pt-6 sm:px-7">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Why this plan?</CardTitle><p className="mt-1 text-xs font-medium text-[#858691]">Your compass is adapting</p></div>
              <div className="flex size-9 items-center justify-center rounded-full bg-[#f0effa] text-[#72539a]"><CircleHelp className="size-[18px]" /></div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-7">
            <div className="rounded-[18px] bg-[#f6f6fb] p-4 text-sm leading-6 text-[#5f606c]">Structured answers are your current gap in Onboarding. This comes before new content because the exam is in <strong className="font-bold text-[#373844]">{planner.daysUntilExam} days</strong> and the topic is a prerequisite for two further objectives.</div>
            <div className="mt-5 space-y-4">
              <div className="flex gap-3"><div className="mt-1 size-2 shrink-0 rounded-full bg-[#4c6bc0]" /><div><p className="text-xs font-bold text-[#444550]">Memory is protected first</p><p className="mt-1 text-xs leading-5 text-[#858691]">Due reviews are forecast at roughly 1.5 minutes per card and reserved before practice.</p></div></div>
              <div className="flex gap-3"><div className="mt-1 size-2 shrink-0 rounded-full bg-[#8b68ad]" /><div><p className="text-xs font-bold text-[#444550]">Your capacity is part of the plan</p><p className="mt-1 text-xs leading-5 text-[#858691]">Recent completion suggests planning around {Math.round(state.capacity.observedCompletionRate * 100)}% of your declared time.</p></div></div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function WeekView({
  planner,
  onComplete,
  onSkip,
}: {
  planner: ReturnType<typeof buildPlannerView>;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#71727e]">Planning horizon <span className="mx-2 text-[#c2c3cb]">/</span> this week</p><h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">Weekly plan</h1><p className="mt-2 text-sm leading-6 text-[#71727e]">A rolling plan with room for real life. Move, skip, or finish anything without losing the thread.</p></div><Button type="button" variant="outline" className="h-10 rounded-full border-[#d5d7e2] bg-white px-4 font-bold text-[#555764]"><Plus className="size-4" /> Add activity</Button></section>
      <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4"><MetricCard label="Weekly target" value={formatMinutes(planner.weeklyTargetMinutes)} detail="declared capacity" icon={Target} tone="bg-[#e5edff] text-[#4563a9]" /><MetricCard label="Planned" value={formatMinutes(planner.plannedMinutes)} detail="across 6 days" icon={CalendarDays} tone="bg-[#f1eafa] text-[#684789]" /><MetricCard label="Completed" value={formatMinutes(planner.completedMinutes)} detail="keep the rhythm" icon={Check} tone="bg-[#e4f2ed] text-[#36745a]" /><MetricCard label="Buffer" value="1h 25m" detail="recovery space" icon={Gauge} tone="bg-[#fff0e4] text-[#87521f]" /></section>
      <Card className="mt-5 overflow-hidden rounded-[28px] border-[#e2e3ea] bg-white py-0 shadow-[0_8px_24px_rgba(39,41,57,0.04)]">
        <CardContent className="overflow-x-auto p-3 sm:p-5">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 gap-2 border-b border-[#ececf1] pb-4">{planner.days.map((day) => <div key={day.date} className="px-2 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#898a95]">{day.label}</p><p className="mt-1 text-lg font-bold text-[#30313a]">{day.dayNumber}</p><div className="mx-auto mt-2 h-1.5 w-12 overflow-hidden rounded-full bg-[#eceef4]"><div className="h-full rounded-full bg-[#6b83cf]" style={{ width: `${Math.min(100, (day.plannedMinutes / Math.max(day.capacityMinutes, 1)) * 100)}%` }} /></div><p className="mt-1 text-[10px] font-semibold text-[#8a8b95]">{day.plannedMinutes ? `${day.plannedMinutes}m` : "Rest"}</p></div>)}</div>
            <div className="grid grid-cols-7 gap-2 pt-3">{planner.days.map((day) => <div key={day.date} className="min-h-[320px] rounded-[18px] bg-[#f8f8fb] p-2">{day.activities.length ? day.activities.map((activity) => <div key={activity.id} className={`mb-2 rounded-[14px] border border-transparent p-3 ${activity.status === "completed" ? "bg-[#eef5f0] opacity-75" : "bg-white shadow-[0_2px_8px_rgba(50,52,70,0.06)]"}`}><div className="flex items-start justify-between gap-1"><span className={`mt-0.5 size-2 shrink-0 rounded-full ${activity.status === "completed" ? "bg-[#55a373]" : activity.subject === "Product" ? "bg-[#6d96d0]" : activity.subject === "Service" ? "bg-[#a783c5]" : "bg-[#73a887]"}`} /><button type="button" className="ml-auto text-[#a0a1aa] opacity-0 transition-opacity hover:text-[#585965] group-hover:opacity-100" aria-label="Activity options"><MoreHorizontal className="size-4" /></button></div><p className={`mt-2 text-xs font-bold leading-4 ${activity.status === "completed" ? "text-[#7c8e82] line-through" : "text-[#42434e]"}`}>{activity.title}</p><p className="mt-2 text-[10px] font-semibold leading-4 text-[#92939d]">{activity.plannedMinutes} min</p>{activity.status !== "completed" && <div className="mt-2 flex gap-1"><button type="button" onClick={() => onComplete(activity.id)} className="rounded-full bg-[#e8f0ff] px-2 py-1 text-[10px] font-bold text-[#4562a1]">Done</button><button type="button" onClick={() => onSkip(activity.id)} className="rounded-full px-2 py-1 text-[10px] font-bold text-[#8d8e98] hover:bg-[#f0f0f5]">Skip</button></div>}</div>) : <div className="flex h-full items-center justify-center text-center text-[11px] font-semibold text-[#afb0b9]">Recovery<br />space</div>}</div>)}</div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#787984]"><LockKeyhole className="size-4 text-[#7181b4]" /> The compass leaves {formatMinutes(85)} unallocated as a buffer for missed work or low-energy days.</div>
    </>
  );
}

function RoadmapView({ state, planner }: { state: PlannerState; planner: ReturnType<typeof buildPlannerView> }) {
  return (
    <>
      <section><p className="text-sm font-semibold text-[#71727e]">Macro horizon <span className="mx-2 text-[#c2c3cb]">/</span> exam roadmap</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">The bigger picture</h1><p className="mt-2 text-sm leading-6 text-[#71727e]">See what remains, what is improving, and whether your target fits the time you have.</p></div><div className="flex items-center gap-2 rounded-full bg-[#eef2ff] px-4 py-2 text-xs font-bold text-[#4663a1]"><Flame className="size-4" /> {planner.daysUntilExam} days to go</div></div></section>
      <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card className="rounded-[28px] border-0 bg-[#e8edff] py-0 shadow-[0_10px_28px_rgba(55,77,142,0.07)]"><CardContent className="p-6 sm:p-8"><div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#566da4]">{state.exam.name}</p><h2 className="mt-3 text-[26px] font-bold tracking-[-0.035em] text-[#283d78]">Target: {state.exam.target}</h2><p className="mt-2 text-sm font-medium text-[#62729b]">Exam date · {formatExamDate(state.exam.date)}</p></div><div className={`rounded-full px-3 py-1.5 text-xs font-bold ${riskTone(planner.risk)}`}>{planner.risk}</div></div><div className="mt-8"><div className="flex items-end justify-between"><span className="text-xs font-bold text-[#53658f]">Curriculum coverage</span><span className="text-2xl font-bold text-[#334c91]">{planner.coverage}%</span></div><Progress value={planner.coverage} className="mt-3 h-3 bg-[#cbd6fa]" /><p className="mt-3 text-xs font-medium leading-5 text-[#64749a]">{formatMinutes(planner.requiredMinutes)} remains against {formatMinutes(planner.realisticCapacityMinutes)} of realistic capacity.</p></div></CardContent></Card>
        <Card className="rounded-[28px] border-[#e2e3ea] bg-white py-0 shadow-[0_8px_24px_rgba(39,41,57,0.04)]"><CardHeader className="px-6 pb-2 pt-6"><CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Capacity check</CardTitle><p className="mt-1 text-xs font-medium text-[#858691]">Declared × observed completion</p></CardHeader><CardContent className="px-6 pb-6"><div className="mt-3 flex items-center gap-4"><div className="flex size-[74px] shrink-0 items-center justify-center rounded-full border-[10px] border-[#dce6ff] border-r-[#5877cf] text-lg font-bold text-[#3f5fae]">{Math.round(state.capacity.observedCompletionRate * 100)}%</div><p className="text-sm leading-6 text-[#656671]">Your last week landed at <strong className="text-[#353640]">{formatMinutes(state.capacity.lastWeekCompletedMinutes)}</strong>. The compass uses that pattern openly, not silently.</p></div><div className="mt-5 rounded-[16px] bg-[#f7f7fa] p-3 text-xs font-semibold text-[#7c7d87]">To get comfortably on track, add 20 minutes to two study days or prioritise Onboarding and Reporting.</div></CardContent></Card>
      </section>
      <Card className="mt-5 rounded-[28px] border-[#e2e3ea] bg-white py-0 shadow-[0_8px_24px_rgba(39,41,57,0.04)]"><CardHeader className="flex flex-row items-end justify-between px-6 pb-2 pt-6 sm:px-7"><div><CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Learning objectives</CardTitle><p className="mt-1 text-xs font-medium text-[#858691]">Learning, recall, and application are tracked separately</p></div><span className="hidden text-xs font-bold text-[#8a8b95] sm:block">4 objectives in scope</span></CardHeader><CardContent className="px-6 pb-5 sm:px-7">{state.topics.map((topic) => <div key={topic.id} className="grid gap-3 border-b border-[#eeeff3] py-4 last:border-0 md:grid-cols-[minmax(190px,1.3fr)_90px_90px_90px_minmax(160px,1fr)] md:items-center"><div><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${topic.subject === "Product" ? "bg-[#6d96d0]" : "bg-[#a783c5]"}`} /><p className="text-sm font-bold text-[#3a3b45]">{topic.name}</p></div><p className="mt-1 pl-4 text-xs font-medium text-[#94959e]">{topic.unit}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a9ba4]">Learned</p><p className="mt-1 text-sm font-bold text-[#454650]">{Math.round(topic.acquisition * 100)}%</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a9ba4]">Recall</p><p className="mt-1 text-sm font-bold text-[#454650]">{Math.round(topic.retention * 100)}%</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a9ba4]">Apply</p><p className="mt-1 text-sm font-bold text-[#454650]">{Math.round(topic.application * 100)}%</p></div><div><div className="flex items-center justify-between text-[10px] font-bold text-[#888993]"><span>{topic.errorLabel}</span><span>{topic.dueCards} due</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0f5]"><div className={`h-full rounded-full ${topic.subject === "Product" ? "bg-[#6d96d0]" : "bg-[#a783c5]"}`} style={{ width: `${Math.round(topic.application * 100)}%` }} /></div></div></div>)}</CardContent></Card>
    </>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("overview");
  const [state, setState] = useState<PlannerState>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as PlannerState) : createInitialPlannerState();
    } catch {
      return createInitialPlannerState();
    }
  });

  const planner = useMemo(() => buildPlannerView(state), [state]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayActivities = useMemo(() => state.activities.filter((activity) => activity.date === todayKey), [state.activities, todayKey]);
  const nextActivity = useMemo(() => {
    const candidates = state.activities.filter((activity) => activity.status === "planned" || activity.status === "in_progress");
    return candidates.find((activity) => activity.pinned) ?? candidates[0] ?? state.activities[0];
  }, [state.activities]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateActivity = (id: string, status: "completed" | "skipped" | "in_progress") => {
    setState((current) => ({
      ...current,
      activities: current.activities.map((activity) => activity.id === id ? {
        ...activity,
        status,
        completedMinutes: status === "completed" ? activity.plannedMinutes : activity.completedMinutes,
      } : activity),
    }));
    const activity = state.activities.find((item) => item.id === id);
    if (activity && status === "completed") toast.success(`${activity.title} complete`, { description: "Your plan has been updated locally." });
    if (activity && status === "skipped") toast("Activity skipped", { description: "Low-priority work stays out of tomorrow unless it is still valuable." });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#f8f8fc] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-[#e7e7ee] bg-[#fbfbfd] px-4 py-6 lg:flex">
        <div className="px-3"><AppMark /></div>
        <div className="mt-12"><p className="px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b9ca5]">Your plan</p><nav className="mt-3 space-y-1"><NavItem active={view === "overview"} icon={LayoutDashboard} label="Overview" onClick={() => setView("overview")} /><NavItem active={view === "week"} icon={CalendarDays} label="Weekly plan" onClick={() => setView("week")} /><NavItem active={view === "roadmap"} icon={TrendingUp} label="Roadmap" onClick={() => setView("roadmap")} /></nav></div>
        <div className="mt-auto space-y-1"><button type="button" className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold text-[#666672] hover:bg-[#f1f2f8]"><Settings2 className="size-[19px] text-[#7b7c88]" /> Preferences</button><div className="mt-4 flex items-center gap-3 rounded-[18px] bg-[#f2f3f8] px-3 py-3"><div className="flex size-9 items-center justify-center rounded-full bg-[#d7e1ff] text-xs font-bold text-[#3557a5]">{(user?.name ?? "A").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#44454f]">{user?.name ?? "Your workspace"}</p><p className="mt-0.5 text-[10px] font-medium text-[#898a94]">Personal plan</p></div><button type="button" onClick={handleSignOut} className="text-[#8c8d96] hover:text-[#474852]" aria-label="Sign out"><LogOut className="size-4" /></button></div></div>
      </aside>

      <main className="lg:pl-[232px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[#e7e7ee] bg-[#f8f8fc]/90 px-5 backdrop-blur-md sm:px-8 lg:px-10"><div className="lg:hidden"><AppMark /></div><div className="hidden items-center gap-2 text-xs font-bold text-[#777883] lg:flex"><GraduationCap className="size-4 text-[#5b70b2]" /> {state.exam.name} <ChevronRight className="size-3" /> <span className="text-[#3c3d47]">Personal workspace</span></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-[#dfe1eb] bg-white/70 px-3 py-2 text-[11px] font-bold text-[#777883] sm:flex"><CloudOff className="size-3.5 text-[#5871ae]" /> Offline-ready</div><button type="button" className="flex size-9 items-center justify-center rounded-full bg-[#d7e1ff] text-xs font-bold text-[#3557a5] lg:hidden" onClick={handleSignOut}>{(user?.name ?? "A").slice(0, 1).toUpperCase()}</button></div></header>
        <div className="flex gap-2 overflow-x-auto border-b border-[#e7e7ee] bg-[#f8f8fc] px-5 py-3 lg:hidden"><button type="button" onClick={() => setView("overview")} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${view === "overview" ? "bg-[#e1e8ff] text-[#244a9c]" : "text-[#777883]"}`}>Overview</button><button type="button" onClick={() => setView("week")} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${view === "week" ? "bg-[#e1e8ff] text-[#244a9c]" : "text-[#777883]"}`}>Weekly plan</button><button type="button" onClick={() => setView("roadmap")} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${view === "roadmap" ? "bg-[#e1e8ff] text-[#244a9c]" : "text-[#777883]"}`}>Roadmap</button></div>
        <div className="mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{view === "overview" && <Overview state={state} planner={planner} nextActivity={nextActivity} todayActivities={todayActivities} firstName={(user?.name?.split(" ")[0]) ?? "there"} onStart={(activity) => { updateActivity(activity.id, "in_progress"); toast("Focus session ready", { description: `${activity.plannedMinutes} minutes of ${activity.title}.` }); }} onComplete={(id) => updateActivity(id, "completed")} onSkip={(id) => updateActivity(id, "skipped")} onViewWeek={() => setView("week")} />}{view === "week" && <WeekView planner={planner} onComplete={(id) => updateActivity(id, "completed")} onSkip={(id) => updateActivity(id, "skipped")} />}{view === "roadmap" && <RoadmapView state={state} planner={planner} />}</div>
      </main>
    </div>
  );
}
