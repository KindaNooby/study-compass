import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  createExamGoal,
  deleteExamGoal,
  formatDateKey,
  isAvailabilityConfigured,
  normalizeAvailability,
  saveAvailability,
  toDateKey,
  uid,
  updateExamGoal,
  useAvailability,
  useCurriculum,
  useExamGoals,
} from "@/lib/planner";
import type {
  Availability,
  ExamGoal,
  ExternalDeadline,
  FixedCommitment,
  TimeOfDay,
  TimeWindow,
} from "@/lib/planner";
import { TIME_OF_DAY_LABELS, WEEKDAYS } from "@/lib/planner";
import {
  Loader2,
  Pencil,
  Plus,
  Save,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DAY_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day.value), label: day.short }));
const TIME_OF_DAYS: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function WeekdayToggle({
  value,
  selected,
  onToggle,
}: {
  value: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const day = WEEKDAYS.find((item) => item.value === value);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex size-9 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
        selected ? "bg-[#dfe8ff] text-[#244a9c]" : "bg-[#f1f2f7] text-[#7b7c88] hover:bg-[#e8e9f1]"
      }`}
      aria-pressed={selected}
      title={day?.long}
    >
      {day?.short}
    </button>
  );
}

// --- Exam goals ---

type GoalFormState = {
  name: string;
  examDate: string;
  subjectIds: string[];
  targetGrade: string;
  targetScore: string;
  minimumRequiredCoverage: number;
  confidence: number;
  optionalTopicIds: string[];
  subjectWeighting: Record<string, number>;
  topicPriorities: Record<string, number>;
  externalDeadlines: ExternalDeadline[];
};

function emptyGoalForm(): GoalFormState {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  return {
    name: "",
    examDate: toDateKey(future),
    subjectIds: [],
    targetGrade: "",
    targetScore: "",
    minimumRequiredCoverage: 0.8,
    confidence: 0.5,
    optionalTopicIds: [],
    subjectWeighting: {},
    topicPriorities: {},
    externalDeadlines: [],
  };
}

function goalToForm(goal: ExamGoal): GoalFormState {
  return {
    name: goal.name,
    examDate: goal.examDate,
    subjectIds: goal.subjectIds,
    targetGrade: goal.targetGrade ?? "",
    targetScore: goal.targetScore !== undefined ? String(goal.targetScore) : "",
    minimumRequiredCoverage: goal.minimumRequiredCoverage ?? 0.8,
    confidence: goal.confidence ?? 0.5,
    optionalTopicIds: goal.optionalTopicIds,
    subjectWeighting: goal.subjectWeighting,
    topicPriorities: goal.topicPriorities,
    externalDeadlines: goal.externalDeadlines,
  };
}

function GoalDialog({
  open,
  goal,
  subjects,
  topics,
  onClose,
}: {
  open: boolean;
  goal?: ExamGoal;
  subjects: { id: string; title: string }[];
  topics: { id: string; subjectId: string; title: string }[];
  onClose: () => void;
}) {
  const isEdit = Boolean(goal);
  const [form, setForm] = useState<GoalFormState>(() => (goal ? goalToForm(goal) : emptyGoalForm()));
  const [error, setError] = useState<string | null>(null);

  const topicsInScope = useMemo(
    () => topics.filter((topic) => form.subjectIds.includes(topic.subjectId)),
    [topics, form.subjectIds],
  );

  const setField = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    try {
      const subjectCount = form.subjectIds.length;
      const baseWeight = subjectCount > 0 ? 1 / subjectCount : 0;
      const subjectWeighting: Record<string, number> = {};
      for (const id of form.subjectIds) {
        subjectWeighting[id] = form.subjectWeighting[id] ?? baseWeight;
      }
      const topicPriorities: Record<string, number> = {};
      for (const topic of topicsInScope) {
        topicPriorities[topic.id] = form.topicPriorities[topic.id] ?? 0.5;
      }
      const externalDeadlines = form.externalDeadlines.filter(
        (deadline) => deadline.label.trim().length > 0 && deadline.date,
      );

      const payload = {
        name: form.name,
        examDate: form.examDate,
        subjectIds: form.subjectIds,
        targetGrade: form.targetGrade.trim() || undefined,
        targetScore: form.targetScore === "" ? undefined : Number(form.targetScore),
        topicPriorities,
        minimumRequiredCoverage: form.minimumRequiredCoverage,
        optionalTopicIds: form.optionalTopicIds.filter((id) =>
          topicsInScope.some((topic) => topic.id === id),
        ),
        subjectWeighting,
        confidence: form.confidence,
        externalDeadlines,
      };

      if (isEdit && goal) {
        await updateExamGoal({ ...goal, ...payload });
        toast.success("Goal updated");
      } else {
        await createExamGoal(payload);
        toast.success("Exam goal added");
      }
      onClose();
    } catch {
      setError("Check the fields and try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit exam goal" : "Add exam goal"}</DialogTitle>
          <DialogDescription>
            What the student is working toward, and how it is weighted.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Customer Success certification"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-date">Exam date</Label>
              <Input
                id="goal-date"
                type="date"
                value={form.examDate}
                onChange={(e) => setField("examDate", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-grade">Target grade</Label>
              <Input
                id="goal-grade"
                value={form.targetGrade}
                onChange={(e) => setField("targetGrade", e.target.value)}
                placeholder="e.g. Distinction"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-score">Target score (0–100)</Label>
              <Input
                id="goal-score"
                type="number"
                min={0}
                max={100}
                value={form.targetScore}
                onChange={(e) => setField("targetScore", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Confidence</Label>
                <span className="text-sm font-bold text-[#4562a1]">{Math.round(form.confidence * 100)}%</span>
              </div>
              <Slider
                value={[form.confidence * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={(values) => setField("confidence", values[0] / 100)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Minimum required coverage</Label>
              <span className="text-sm font-bold text-[#4562a1]">{Math.round(form.minimumRequiredCoverage * 100)}%</span>
            </div>
            <Slider
              value={[form.minimumRequiredCoverage * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(values) => setField("minimumRequiredCoverage", values[0] / 100)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Subjects in scope</Label>
            {subjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add subjects in the Curriculum view first, then include them here.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => {
                  const selected = form.subjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => setField("subjectIds", toggleValue(form.subjectIds, subject.id))}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]"
                          : "border-[#dce0ed] text-[#5a5b68] hover:bg-[#f4f5fa]"
                      }`}
                    >
                      {subject.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {form.subjectIds.length > 0 && (
            <div className="grid gap-2">
              <Label>Subject weighting</Label>
              <div className="space-y-3 rounded-lg border border-[#e6e7ef] p-3">
                {form.subjectIds.map((subjectId) => {
                  const subject = subjects.find((item) => item.id === subjectId);
                  const value = form.subjectWeighting[subjectId] ?? 0;
                  return (
                    <div key={subjectId} className="grid gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#5a5b68]">{subject?.title ?? subjectId}</span>
                        <span className="text-xs font-bold text-[#4562a1]">{Math.round(value * 100)}%</span>
                      </div>
                      <Slider
                        value={[value * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(values) =>
                          setField("subjectWeighting", { ...form.subjectWeighting, [subjectId]: values[0] / 100 })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {topicsInScope.length > 0 && (
            <div className="grid gap-2">
              <Label>Topic priorities</Label>
              <div className="space-y-3 rounded-lg border border-[#e6e7ef] p-3">
                {topicsInScope.map((topic) => {
                  const value = form.topicPriorities[topic.id] ?? 0.5;
                  const optional = form.optionalTopicIds.includes(topic.id);
                  return (
                    <div key={topic.id} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#5a5b68]">{topic.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#4562a1]">{Math.round(value * 100)}%</span>
                          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#8a8b95]">
                            <Checkbox
                              checked={optional}
                              onCheckedChange={() =>
                                setField("optionalTopicIds", toggleValue(form.optionalTopicIds, topic.id))
                              }
                            />
                            Optional
                          </label>
                        </div>
                      </div>
                      <Slider
                        value={[value * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(values) =>
                          setField("topicPriorities", { ...form.topicPriorities, [topic.id]: values[0] / 100 })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>External deadlines</Label>
              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-full px-3 text-xs font-bold text-[#3157a2]"
                onClick={() =>
                  setField("externalDeadlines", [
                    ...form.externalDeadlines,
                    { id: uid(), label: "", date: "" },
                  ])
                }
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            {form.externalDeadlines.length === 0 ? (
              <p className="text-xs text-muted-foreground">Mocks and other milestone dates are optional.</p>
            ) : (
              <div className="space-y-2">
                {form.externalDeadlines.map((deadline) => (
                  <div key={deadline.id} className="flex items-center gap-2">
                    <Input
                      value={deadline.label}
                      onChange={(e) =>
                        setField(
                          "externalDeadlines",
                          form.externalDeadlines.map((item) =>
                            item.id === deadline.id ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="e.g. Mock exam"
                      className="flex-1"
                    />
                    <Input
                      type="date"
                      value={deadline.date}
                      onChange={(e) =>
                        setField(
                          "externalDeadlines",
                          form.externalDeadlines.map((item) =>
                            item.id === deadline.id ? { ...item, date: e.target.value } : item,
                          ),
                        )
                      }
                      className="w-36"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-[#9a4c53]"
                      aria-label="Remove deadline"
                      onClick={() =>
                        setField(
                          "externalDeadlines",
                          form.externalDeadlines.filter((item) => item.id !== deadline.id),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit}>{isEdit ? "Save changes" : "Add goal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalsSection() {
  const { data: goals, loading } = useExamGoals();
  const curriculum = useCurriculum();
  const [dialogGoal, setDialogGoal] = useState<ExamGoal | "new" | null>(null);

  const subjects = useMemo(
    () => curriculum.subjects.map((subject) => ({ id: subject.id, title: subject.title })),
    [curriculum.subjects],
  );
  const topics = useMemo(
    () =>
      curriculum.topics.map((topic) => ({
        id: topic.id,
        subjectId: topic.subjectId,
        title: topic.title,
      })),
    [curriculum.topics],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-6">
        <div>
          <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Exam goals</CardTitle>
          <CardDescription className="mt-1 text-xs">
            One or more targets, each with a date, scope, and weighting.
          </CardDescription>
        </div>
        <Button
          type="button"
          className="h-10 rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]"
          onClick={() => setDialogGoal("new")}
        >
          <Plus className="size-4" /> Add goal
        </Button>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {goals.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#d8dae5] p-8 text-center">
            <Target className="mx-auto size-8 text-[#a9aab4]" />
            <p className="mt-3 text-sm font-semibold text-[#5a5b68]">No exam goals yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the first goal so the planner knows what you are working toward.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals
              .slice()
              .sort((a, b) => a.examDate.localeCompare(b.examDate))
              .map((goal) => (
                <div
                  key={goal.id}
                  className="group flex items-center justify-between gap-4 rounded-[16px] border border-[#e8e9f1] bg-[#fbfbfd] p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#3a3b45]">{goal.name}</p>
                    <p className="mt-1 text-xs font-medium text-[#8a8b95]">
                      {formatDateKey(goal.examDate)}
                      <span className="mx-2 text-[#c4c4ca]">·</span>
                      {goal.subjectIds.length} subject{goal.subjectIds.length === 1 ? "" : "s"}
                    </p>
                    {goal.targetGrade && <Badge variant="secondary" className="mt-2 text-[10px]">Target: {goal.targetGrade}</Badge>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit goal"
                      onClick={() => setDialogGoal(goal)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-[#9a4c53]"
                      aria-label="Delete goal"
                      onClick={() => {
                        if (window.confirm(`Delete "${goal.name}"?`)) {
                          void deleteExamGoal(goal.id);
                          toast.success("Goal deleted");
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      {dialogGoal !== null && (
        <GoalDialog
          key={dialogGoal === "new" ? "new" : dialogGoal.id}
          open
          goal={dialogGoal === "new" ? undefined : dialogGoal}
          subjects={subjects}
          topics={topics}
          onClose={() => setDialogGoal(null)}
        />
      )}
    </Card>
  );
}

// --- Availability ---

function AvailabilitySection() {
  const { availability, loading } = useAvailability();
  const [draft, setDraft] = useState<Availability | null>(null);

  useEffect(() => {
    if (availability) setDraft(availability);
  }, [availability]);

  if (loading || !draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const update = (patch: Partial<Availability>) => setDraft({ ...draft, ...patch });
  const toggleDay = (key: "availableDays" | "restDays", value: number) => {
    if (key === "availableDays") {
      update({ availableDays: toggleValue(draft.availableDays, value) });
    } else {
      update({ restDays: toggleValue(draft.restDays, value) });
    }
  };
  const toggleTimeOfDay = (value: TimeOfDay) =>
    update({ preferredStudyTimes: toggleValue(draft.preferredStudyTimes, value) });
  const setEnergy = (time: TimeOfDay, value: number) => {
    const energyByTimeOfDay: Record<TimeOfDay, number> = {
      ...draft.energyByTimeOfDay,
      [time]: value,
    };
    update({ energyByTimeOfDay });
  };

  const updateWindow = (index: number, patch: Partial<TimeWindow>) =>
    update({
      timeWindows: draft.timeWindows.map((window, i) => (i === index ? { ...window, ...patch } : window)),
    });
  const updateCommitment = (index: number, patch: Partial<FixedCommitment>) =>
    update({
      fixedCommitments: draft.fixedCommitments.map((commitment, i) =>
        i === index ? { ...commitment, ...patch } : commitment,
      ),
    });

  const save = async () => {
    try {
      await saveAvailability(normalizeAvailability(draft));
      toast.success("Availability saved");
    } catch {
      toast.error("Could not save availability. Check the times and try again.");
    }
  };

  const configured = isAvailabilityConfigured(draft);

  return (
    <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between px-6 pb-2 pt-6">
        <div>
          <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Availability</CardTitle>
          <CardDescription className="mt-1 text-xs">
            The days and windows the planner is allowed to use.
          </CardDescription>
        </div>
        {configured && (
          <span className="rounded-full bg-[#e4f3e9] px-2.5 py-1 text-[11px] font-bold text-[#276641]">
            Configured
          </span>
        )}
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label>Study days</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => (
                <WeekdayToggle
                  key={day.value}
                  value={day.value}
                  selected={draft.availableDays.includes(day.value)}
                  onToggle={() => toggleDay("availableDays", day.value)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Rest days</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => (
                <WeekdayToggle
                  key={day.value}
                  value={day.value}
                  selected={draft.restDays.includes(day.value)}
                  onToggle={() => toggleDay("restDays", day.value)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="max-daily">Max daily study (minutes)</Label>
              <Input
                id="max-daily"
                type="number"
                min={0}
                value={draft.maxDailyStudyMinutes}
                onChange={(e) => update({ maxDailyStudyMinutes: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-len">Preferred session length (minutes)</Label>
              <Input
                id="session-len"
                type="number"
                min={0}
                value={draft.preferredSessionMinutes}
                onChange={(e) => update({ preferredSessionMinutes: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Buffer (planned slack)</Label>
              <span className="text-sm font-bold text-[#4562a1]">
                {Math.round((draft.bufferFactor ?? 0) * 100)}%
              </span>
            </div>
            <Slider
              value={[(draft.bufferFactor ?? 0) * 100]}
              min={0}
              max={40}
              step={5}
              onValueChange={(values) => update({ bufferFactor: values[0] / 100 })}
            />
            <p className="text-xs text-muted-foreground">
              Hold back this much of your daily limit so real life doesn't break the plan.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Preferred study times</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIME_OF_DAYS.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => toggleTimeOfDay(time)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    draft.preferredStudyTimes.includes(time)
                      ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]"
                      : "border-[#dce0ed] text-[#5a5b68] hover:bg-[#f4f5fa]"
                  }`}
                >
                  {TIME_OF_DAY_LABELS[time]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Energy by time of day</Label>
            <div className="grid gap-3 rounded-lg border border-[#e6e7ef] p-3 sm:grid-cols-2">
              {TIME_OF_DAYS.map((time) => (
                <div key={time} className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#5a5b68]">{TIME_OF_DAY_LABELS[time]}</span>
                    <span className="text-xs font-bold text-[#4562a1]">{Math.round(draft.energyByTimeOfDay[time] * 100)}%</span>
                  </div>
                  <Slider
                    value={[draft.energyByTimeOfDay[time] * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(values) => setEnergy(time, values[0] / 100)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Time windows</Label>
              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-full px-3 text-xs font-bold text-[#3157a2]"
                onClick={() =>
                  update({
                    timeWindows: [
                      ...draft.timeWindows,
                      { day: draft.availableDays[0] ?? 1, start: "09:00", end: "10:00" },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" /> Add window
              </Button>
            </div>
            {draft.timeWindows.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Optional. Add windows if study must happen at specific times.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.timeWindows.map((window, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={String(window.day)}
                      onChange={(e) => updateWindow(index, { day: Number(e.target.value) })}
                      className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
                    >
                      {DAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={window.start}
                      onChange={(e) => updateWindow(index, { start: e.target.value })}
                      className="w-28"
                    />
                    <span className="text-xs font-semibold text-[#9a9ba4]">to</span>
                    <Input
                      type="time"
                      value={window.end}
                      onChange={(e) => updateWindow(index, { end: e.target.value })}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-[#9a4c53]"
                      aria-label="Remove window"
                      onClick={() =>
                        update({ timeWindows: draft.timeWindows.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Fixed commitments</Label>
              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-full px-3 text-xs font-bold text-[#3157a2]"
                onClick={() =>
                  update({
                    fixedCommitments: [
                      ...draft.fixedCommitments,
                      { id: uid(), day: 1, start: "09:00", end: "10:00", label: "" },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            {draft.fixedCommitments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Work, classes, and other blocks the planner must avoid.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.fixedCommitments.map((commitment, index) => (
                  <div key={commitment.id} className="flex flex-wrap items-center gap-2">
                    <select
                      value={String(commitment.day)}
                      onChange={(e) => updateCommitment(index, { day: Number(e.target.value) })}
                      className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
                    >
                      {DAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={commitment.start}
                      onChange={(e) => updateCommitment(index, { start: e.target.value })}
                      className="w-28"
                    />
                    <span className="text-xs font-semibold text-[#9a9ba4]">to</span>
                    <Input
                      type="time"
                      value={commitment.end}
                      onChange={(e) => updateCommitment(index, { end: e.target.value })}
                      className="w-28"
                    />
                    <Input
                      value={commitment.label}
                      onChange={(e) => updateCommitment(index, { label: e.target.value })}
                      placeholder="Label"
                      className="min-w-28 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-[#9a4c53]"
                      aria-label="Remove commitment"
                      onClick={() =>
                        update({ fixedCommitments: draft.fixedCommitments.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#ececf1] pt-4">
            <p className="text-xs font-medium text-[#8a8b95]">
              Everything is stored locally on this device.
            </p>
            <Button type="button" className="h-10 rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]" onClick={save}>
              <Save className="size-4" /> Save availability
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Setup() {
  return (
    <>
      <section>
        <p className="text-sm font-semibold text-[#71727e]">Phase 1 · Foundation</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">Setup</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71727e]">
          Tell the planner what you are aiming for and when you can actually study.
        </p>
      </section>

      <section className="mt-7 grid gap-5">
        <GoalsSection />
        <AvailabilitySection />
      </section>
    </>
  );
}
