import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CloudOff,
  Menu,
  Play,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router";

const principles = [
  {
    icon: Target,
    title: "One next step",
    text: "A deterministic planner turns your curriculum, capacity, and exam date into the highest-value action now.",
  },
  {
    icon: TrendingUp,
    title: "Adapts to reality",
    text: "Miss a session or finish early? Your plan redistributes work without punishing tomorrow.",
  },
  {
    icon: CloudOff,
    title: "Works offline",
    text: "Your plan, progress, and review queue stay available on this device, even without a connection.",
  },
];

function Mark() {
  return <div className="flex size-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-[0_6px_14px_rgba(52,81,162,0.18)]"><Sparkles className="size-[19px]" strokeWidth={2.4} /></div>;
}

export default function Landing() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f8fc] text-[#1f2026]">
      <div className="absolute left-[-10%] top-[-18%] -z-0 size-[560px] rounded-full bg-[#e6ebff] blur-3xl" />
      <div className="absolute right-[-12%] top-[28%] -z-0 size-[480px] rounded-full bg-[#f0e8f8] blur-3xl" />
      <nav className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10 lg:py-7"><div className="flex items-center gap-3"><Mark /><div>        <p className="text-[17px] font-bold tracking-[-0.02em]">Study Compass</p><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#73737f]">Offline study PWA</p></div></div><div className="hidden items-center gap-8 text-sm font-semibold text-[#676873] md:flex"><button type="button" className="cursor-pointer transition-colors hover:text-primary" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How it works</button><button type="button" className="cursor-pointer transition-colors hover:text-primary" onClick={() => document.getElementById("principles")?.scrollIntoView({ behavior: "smooth" })}>Principles</button><Button type="button" variant="outline" className="h-10 rounded-full border-[#d5d8e5] bg-white/60 px-5 font-bold" onClick={() => navigate("/dashboard")}>Open workspace</Button></div><Button type="button" variant="ghost" size="icon" className="rounded-full md:hidden" onClick={() => navigate("/dashboard")} aria-label="Open workspace"><Menu className="size-5" /></Button></nav>

      <section className="relative z-10 mx-auto grid max-w-[1240px] gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}><div className="inline-flex items-center gap-2 rounded-full border border-[#d8def5] bg-white/75 px-3 py-2 text-[11px] font-bold text-[#536ca7] shadow-sm"><span className="size-1.5 rounded-full bg-[#4e6fc4]" /> A calmer way to prepare</div><h1 className="mt-7 max-w-[640px] text-[48px] font-bold leading-[1.04] tracking-[-0.06em] text-[#1e2c52] sm:text-[66px]">Make every study session <span className="text-[#4967bc]">count.</span></h1><p className="mt-6 max-w-[560px] text-[17px] leading-8 text-[#6b6c78]">Study Compass is an offline-first study companion for the people you serve. It knows what each learner needs, fits their real life, and points to the most useful next step.</p><div className="mt-8 flex flex-wrap items-center gap-3"><Button type="button" className="h-12 rounded-full bg-[#3159b7] px-6 text-sm font-bold text-white shadow-[0_8px_16px_rgba(49,89,183,0.2)] hover:bg-[#264b9f]" onClick={() => navigate("/dashboard")}>Build my plan <ArrowRight className="size-4" /></Button><Button type="button" variant="ghost" className="h-12 rounded-full px-5 text-sm font-bold text-[#4b5f9b] hover:bg-white/70" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}><Play className="size-4 fill-current" /> See how it works</Button></div><div className="mt-8 flex items-center gap-2 text-xs font-semibold text-[#858691]"><Check className="size-4 text-[#4e9a6d]" /> Offline-first · deterministic · forgiving</div></motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative"><div className="absolute -inset-5 rounded-[40px] bg-white/40 blur-2xl" /><div className="relative rounded-[32px] border border-white/80 bg-white/85 p-3 shadow-[0_24px_70px_rgba(51,64,113,0.14)] backdrop-blur"><div className="rounded-[25px] bg-[#f8f8fc] p-4 sm:p-5"><div className="flex items-center justify-between border-b border-[#e8e9f0] pb-4"><div className="flex items-center gap-2"><Mark /><div><p className="text-xs font-bold text-[#30313a]">Good evening, Morgan.</p><p className="mt-1 text-[10px] font-medium text-[#888995]">Your plan is ready</p></div></div><div className="rounded-full bg-[#e6ecff] px-2.5 py-1 text-[10px] font-bold text-[#4260a9]">Week 3 of 6</div></div><div className="mt-5 rounded-[23px] bg-[#dfe8ff] p-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#536da8]"><Sparkles className="size-3.5" /> Recommended next</div><p className="mt-4 text-[21px] font-bold leading-tight tracking-[-0.03em] text-[#263a73]">Onboarding: outcome questions</p><p className="mt-2 text-xs leading-5 text-[#617198]">Structured accuracy is 58%, so this comes before new content.</p><div className="mt-5 flex items-center justify-between"><span className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-[10px] font-bold text-[#4562a1]">Structured practice</span><span className="text-[10px] font-bold text-[#617198]">40 minutes</span></div></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-[18px] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a8b95]">Today</p><p className="mt-3 text-xl font-bold text-[#343640]">65 min</p><div className="mt-2 h-1.5 rounded-full bg-[#e7e9f2]"><div className="h-full w-[38%] rounded-full bg-[#5877cf]" /></div></div><div className="rounded-[18px] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a8b95]">Roadmap</p><p className="mt-3 text-xl font-bold text-[#343640]">Tight</p><p className="mt-2 text-[10px] font-semibold text-[#a16a2b]">39 days to go</p></div></div></div></div><div className="absolute -bottom-5 -left-6 hidden items-center gap-3 rounded-[18px] border border-white bg-white p-3 shadow-[0_12px_30px_rgba(51,64,113,0.12)] sm:flex"><div className="flex size-9 items-center justify-center rounded-full bg-[#e4f2ed] text-[#36745a]"><Check className="size-4" /></div><div><p className="text-xs font-bold text-[#454650]">Memory protected</p><p className="mt-1 text-[10px] font-medium text-[#898a94]">18 reviews forecast today</p></div></div></motion.div>
      </section>

      <section id="how-it-works" className="relative z-10 border-y border-[#e7e7ee] bg-white/55"><div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-20"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6178b8]">From curriculum to clarity</p><h2 className="mt-4 max-w-md text-[32px] font-bold leading-tight tracking-[-0.045em] text-[#2a2b34]">A planner that thinks beyond flashcards.</h2></div><div className="grid gap-6 sm:grid-cols-3"><div><p className="text-[28px] font-bold text-[#516fbe]">01</p><p className="mt-3 text-sm font-bold text-[#393a44]">Map the work</p><p className="mt-2 text-xs leading-5 text-[#7c7d88]">Your customers carry their curriculum, progress, and plan on every device.</p></div><div><p className="text-[28px] font-bold text-[#8464a5]">02</p><p className="mt-3 text-sm font-bold text-[#393a44]">Fit real capacity</p><p className="mt-2 text-xs leading-5 text-[#7c7d88]">See learning, practice, retention, and application in one place.</p></div><div><p className="text-[28px] font-bold text-[#4b936d]">03</p><p className="mt-3 text-sm font-bold text-[#393a44]">Adapt each week</p><p className="mt-2 text-xs leading-5 text-[#7c7d88]">Their available time and observed habits shape a plan they can keep.</p></div></div></div></section>

      <section id="principles" className="relative z-10 mx-auto max-w-[1240px] px-5 py-16 sm:px-8 lg:px-10 lg:py-24"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6178b8]">Designed for the long haul</p><h2 className="mt-4 text-[32px] font-bold leading-tight tracking-[-0.045em] text-[#2a2b34]">Less guilt. More useful work.</h2></div><div className="mt-9 grid gap-4 md:grid-cols-3">{principles.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-[26px] border border-[#e3e4eb] bg-white/70 p-6 shadow-[0_7px_20px_rgba(39,41,57,0.03)]"><div className="flex size-11 items-center justify-center rounded-[16px] bg-[#e8edff] text-[#4c68b7]"><Icon className="size-5" /></div><h3 className="mt-6 text-[17px] font-bold text-[#373842]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#797a86]">{text}</p></div>)}</div><div className="mt-12 rounded-[30px] bg-[#273b75] p-7 text-white shadow-[0_15px_35px_rgba(39,59,117,0.16)] sm:p-10"><div className="flex flex-col justify-between gap-7 md:flex-row md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b9c8f6]">Start with the foundation</p><h2 className="mt-3 max-w-lg text-[28px] font-bold leading-tight tracking-[-0.04em]">Give every learner a plan that can change with them.</h2></div><Button type="button" className="h-12 shrink-0 rounded-full bg-white px-6 font-bold text-[#31539f] hover:bg-[#edf1ff]" onClick={() => navigate("/dashboard")}>Open my workspace <ArrowRight className="size-4" /></Button></div></div></section>
      <footer className="mx-auto flex max-w-[1240px] items-center justify-between border-t border-[#e7e7ee] px-5 py-7 text-xs font-semibold text-[#8b8c96] sm:px-8 lg:px-10"><span>Study Compass · Your next best session</span><span>Made to be revisable.</span></footer>
    </main>
  );
}
