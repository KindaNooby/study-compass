import { CurriculumBrowser } from "@/components/planner/CurriculumBrowser";
import { Measure } from "@/components/planner/Measure";
import { Overview } from "@/components/planner/Overview";
import { Plan } from "@/components/planner/Plan";
import { Setup } from "@/components/planner/Setup";
import { Study } from "@/components/planner/Study";
import { useAuth } from "@/hooks/use-auth";
import { initDatabase } from "@/lib/planner";
import {
  Activity,
  BookOpen,
  CalendarDays,
  CloudOff,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PlayCircle,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

type View = "overview" | "plan" | "curriculum" | "setup" | "study" | "measure";

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

const NAV_ITEMS: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "plan", label: "Plan", icon: CalendarDays },
  { view: "study", label: "Study now", icon: PlayCircle },
  { view: "measure", label: "Measure", icon: Activity },
  { view: "curriculum", label: "Curriculum", icon: BookOpen },
  { view: "setup", label: "Setup", icon: Settings2 },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    void initDatabase();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#f8f8fc] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-[#e7e7ee] bg-[#fbfbfd] px-4 py-6 lg:flex">
        <div className="px-3">
          <AppMark />
        </div>
        <div className="mt-12">
          <p className="px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b9ca5]">Workspace</p>
          <nav className="mt-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.view}
                active={view === item.view}
                icon={item.icon}
                label={item.label}
                onClick={() => setView(item.view)}
              />
            ))}
          </nav>
        </div>
        <div className="mt-auto">
          <div className="flex items-center gap-3 rounded-[18px] bg-[#f2f3f8] px-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-[#d7e1ff] text-xs font-bold text-[#3557a5]">
              {(user?.name ?? "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#44454f]">{user?.name ?? "Your workspace"}</p>
              <p className="mt-0.5 text-[10px] font-medium text-[#898a94]">Personal plan</p>
            </div>
            <button type="button" onClick={handleSignOut} className="text-[#8c8d96] hover:text-[#474852]" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:pl-[232px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[#e7e7ee] bg-[#f8f8fc]/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="lg:hidden">
            <AppMark />
          </div>
          <div className="hidden items-center gap-2 text-xs font-bold text-[#777883] lg:flex">
            <GraduationCap className="size-4 text-[#5b70b2]" /> Study Compass
            <span className="text-[#c2c3cb]">/</span>
            <span className="text-[#3c3d47]">Personal workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[#dfe1eb] bg-white/70 px-3 py-2 text-[11px] font-bold text-[#777883] sm:flex">
              <CloudOff className="size-3.5 text-[#5871ae]" /> Saved on device
            </div>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full bg-[#d7e1ff] text-xs font-bold text-[#3557a5] lg:hidden"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              {(user?.name ?? "A").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-[#e7e7ee] bg-[#f8f8fc] px-5 py-3 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => setView(item.view)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${
                view === item.view ? "bg-[#e1e8ff] text-[#244a9c]" : "text-[#777883]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {view === "overview" && <Overview onNavigate={setView} />}
          {view === "plan" && <Plan onNavigate={setView} />}
          {view === "study" && <Study onNavigate={setView} />}
          {view === "measure" && <Measure />}
          {view === "curriculum" && <CurriculumBrowser />}
          {view === "setup" && <Setup />}
        </div>
      </main>
    </div>
  );
}
