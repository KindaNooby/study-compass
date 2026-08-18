import type { ActivityKind, ActivityStatus } from "@/lib/planner";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  ListChecks,
  PenLine,
  RefreshCw,
} from "lucide-react";

export const KIND_ICONS: Record<ActivityKind, typeof BookOpen> = {
  fsrs_review: RefreshCw,
  learn_new_content: BookOpen,
  retrieval_practise: RefreshCw,
  mcq_practise: ListChecks,
  structured_practise: PenLine,
  error_correction: AlertTriangle,
  mixed_exam_practice: ListChecks,
  mock_exam: ClipboardList,
};

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  missed: "Missed",
  postponed: "Postponed",
};

export function statusClass(status: ActivityStatus): string {
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

/** A row the student can still act on (drag, complete, skip, snooze, replace). */
export function isActionableStatus(status: ActivityStatus): boolean {
  return status !== "completed" && status !== "skipped";
}
