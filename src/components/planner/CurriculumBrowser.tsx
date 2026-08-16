import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  createObjective,
  createSubject,
  createTopic,
  createUnit,
  deleteObjective,
  deleteSubject,
  deleteTopic,
  deleteUnit,
  updateObjective,
  useCurriculum,
} from "@/lib/planner";
import type { LearningObjective, QuestionType, Subject } from "@/lib/planner";
import { ObjectiveContent } from "@/components/planner/ObjectiveContent";
import {
  BookOpen,
  ChevronRight,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DialogState =
  | { kind: "subject" }
  | { kind: "unit"; subjectId: string }
  | { kind: "topic"; subjectId: string; unitId: string }
  | { kind: "objective-create"; subjectId: string; topicId: string }
  | { kind: "objective-edit"; objective: LearningObjective }
  | { kind: "objective-content"; objective: LearningObjective }
  | null;

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm font-medium text-destructive">{error}</p>;
}

function SubjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      await createSubject(title);
      toast.success("Subject added");
      onClose();
    } catch {
      setError("Enter a subject title.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add subject</DialogTitle>
          <DialogDescription>The top level of your curriculum.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="subject-title">Title</Label>
          <Input
            id="subject-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Product knowledge"
            autoFocus
          />
        </div>
        <FieldError error={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit}>Add subject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnitDialog({
  open,
  onClose,
  subjectId,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: string;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      await createUnit(subjectId, title);
      toast.success("Unit added");
      onClose();
    } catch {
      setError("Enter a unit title.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add unit</DialogTitle>
          <DialogDescription>A section within this subject.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="unit-title">Title</Label>
          <Input
            id="unit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Customer onboarding"
            autoFocus
          />
        </div>
        <FieldError error={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit}>Add unit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopicDialog({
  open,
  onClose,
  subjectId,
  unitId,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  unitId: string;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      await createTopic(subjectId, unitId, title);
      toast.success("Topic added");
      onClose();
    } catch {
      setError("Enter a topic title.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add topic</DialogTitle>
          <DialogDescription>Learning objectives live inside topics.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="topic-title">Title</Label>
          <Input
            id="topic-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Onboarding outcomes"
            autoFocus
          />
        </div>
        <FieldError error={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit}>Add topic</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveDialog({
  open,
  onClose,
  objective,
  defaultSubjectId,
  defaultTopicId,
  allObjectives,
  subjects,
}: {
  open: boolean;
  onClose: () => void;
  objective?: LearningObjective;
  defaultSubjectId?: string;
  defaultTopicId?: string;
  allObjectives: LearningObjective[];
  subjects: Subject[];
}) {
  const isEdit = Boolean(objective);
  const [title, setTitle] = useState(objective?.title ?? "");
  const [importance, setImportance] = useState(objective?.importance ?? 0.5);
  const [learningMinutes, setLearningMinutes] = useState(objective?.estimatedLearningMinutes ?? 30);
  const [practiceMinutes, setPracticeMinutes] = useState(objective?.estimatedPracticeMinutes ?? 30);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(objective?.questionTypes ?? []);
  const [prerequisiteIds, setPrerequisiteIds] = useState<string[]>(objective?.prerequisiteIds ?? []);
  const [error, setError] = useState<string | null>(null);

  const prerequisiteOptions = useMemo(
    () => allObjectives.filter((candidate) => candidate.id !== objective?.id),
    [allObjectives, objective?.id],
  );

  const toggleQuestionType = (type: QuestionType) => {
    setQuestionTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const togglePrerequisite = (id: string) => {
    setPrerequisiteIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = async () => {
    const payload = {
      title,
      importance,
      estimatedLearningMinutes: learningMinutes,
      estimatedPracticeMinutes: practiceMinutes,
      questionTypes,
      prerequisiteIds,
    };
    try {
      if (isEdit && objective) {
        await updateObjective({ ...objective, ...payload });
        toast.success("Objective updated");
      } else {
        await createObjective({
          subjectId: defaultSubjectId ?? objective?.subjectId ?? "",
          topicId: defaultTopicId ?? objective?.topicId ?? "",
          ...payload,
        });
        toast.success("Objective added");
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
          <DialogTitle>{isEdit ? "Edit objective" : "Add learning objective"}</DialogTitle>
          <DialogDescription>
            This is the unit of planning — what the student learns and practices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="objective-title">Title</Label>
            <Input
              id="objective-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Set up a customer workspace"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Exam importance</Label>
              <span className="text-sm font-bold text-[#4562a1]">{Math.round(importance * 100)}%</span>
            </div>
            <Slider
              value={[importance * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(values) => setImportance(values[0] / 100)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="learn-minutes">Learning minutes</Label>
              <Input
                id="learn-minutes"
                type="number"
                min={0}
                value={learningMinutes}
                onChange={(e) => setLearningMinutes(Number(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="practice-minutes">Practice minutes</Label>
              <Input
                id="practice-minutes"
                type="number"
                min={0}
                value={practiceMinutes}
                onChange={(e) => setPracticeMinutes(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Question types</Label>
            <div className="flex flex-wrap gap-2">
              {(["mcq", "structured"] as const).map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-[#dce0ed] px-3 py-1.5 text-xs font-semibold text-[#5a5b68]"
                >
                  <Checkbox
                    checked={questionTypes.includes(type)}
                    onCheckedChange={() => toggleQuestionType(type)}
                  />
                  {type === "mcq" ? "Multiple choice" : "Structured / written"}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Prerequisites</Label>
            <p className="text-xs text-muted-foreground">
              Objectives that should be learned before this one.
            </p>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[#e6e7ef] p-2">
              {prerequisiteOptions.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Add other objectives first, then choose prerequisites here.
                </p>
              ) : (
                prerequisiteOptions.map((candidate) => {
                  const subject = subjects.find((item) => item.id === candidate.subjectId);
                  return (
                    <label
                      key={candidate.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-[#f4f5fa]"
                    >
                      <Checkbox
                        checked={prerequisiteIds.includes(candidate.id)}
                        onCheckedChange={() => togglePrerequisite(candidate.id)}
                        className="mt-0.5"
                      />
                      <span>
                        {candidate.title}
                        <span className="ml-1 text-[#9a9ba4]">· {subject?.title ?? ""}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <FieldError error={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit}>{isEdit ? "Save changes" : "Add objective"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveRow({
  objective,
  onEdit,
  onContent,
  onDelete,
}: {
  objective: LearningObjective;
  onEdit: () => void;
  onContent: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-[14px] border border-[#e8e9f1] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#3a3b45]">{objective.title}</p>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onContent} aria-label="Manage content">
            <Layers className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit objective">
            <Pencil className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete objective">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{Math.round(objective.importance * 100)}% important</Badge>
        <Badge variant="outline" className="text-[10px]">{objective.estimatedLearningMinutes} min learn</Badge>
        <Badge variant="outline" className="text-[10px]">{objective.estimatedPracticeMinutes} min practice</Badge>
        {objective.questionTypes.map((type) => (
          <Badge key={type} variant="secondary" className="text-[10px]">
            {type === "mcq" ? "MCQ" : "Structured"}
          </Badge>
        ))}
        {objective.prerequisiteIds.length > 0 && (
          <Badge variant="outline" className="text-[10px]">{objective.prerequisiteIds.length} prereq</Badge>
        )}
      </div>
    </div>
  );
}

export function CurriculumBrowser() {
  const { subjects, units, topics, objectives, loading } = useCurriculum();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) setSelectedSubjectId(subjects[0].id);
    if (selectedSubjectId && !subjects.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0]?.id ?? null);
    }
  }, [subjects, selectedSubjectId]);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unitsForSubject = units.filter((unit) => unit.subjectId === selectedSubjectId);
  const topicsForUnit = (unitId: string) => topics.filter((topic) => topic.unitId === unitId);
  const objectivesForTopic = (topicId: string) => objectives.filter((objective) => objective.topicId === topicId);
  const objectivesForSubject = objectives.filter((objective) => objective.subjectId === selectedSubjectId);

  const confirmDelete = (message: string) => window.confirm(message);

  return (
    <>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#71727e]">Phase 1 · Foundation</p>
          <h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">Curriculum</h1>
          <p className="mt-2 text-sm leading-6 text-[#71727e]">
            Build the structure the planner will schedule against: subjects → units → topics → learning objectives.
          </p>
        </div>
        <Button
          type="button"
          className="h-10 rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]"
          onClick={() => setDialog({ kind: "subject" })}
        >
          <Plus className="size-4" /> Add subject
        </Button>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.6fr)]">
        <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
          <CardContent className="p-4">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9b9ca5]">Subjects</p>
            {subjects.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                No subjects yet. Add your first subject to begin.
              </p>
            ) : (
              <div className="space-y-1">
                {subjects.map((subject) => {
                  const unitCount = units.filter((unit) => unit.subjectId === subject.id).length;
                  const objectiveCount = objectives.filter((objective) => objective.subjectId === subject.id).length;
                  const active = subject.id === selectedSubjectId;
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(subject.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left transition-colors ${
                        active ? "bg-[#e6ecff] text-[#2c4b99]" : "text-[#5a5b68] hover:bg-[#f4f5fa]"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <BookOpen className={`size-4 shrink-0 ${active ? "text-[#4166c2]" : "text-[#8f909b]"}`} />
                        <span className="truncate text-sm font-bold">{subject.title}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#9a9ba4]">
                        {unitCount}u · {objectiveCount}o
                        <ChevronRight className="size-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          {!selectedSubject ? (
            <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
              <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
                <BookOpen className="size-8 text-[#a9aab4]" />
                <p className="text-sm font-semibold text-[#5a5b68]">Select a subject to browse its units and objectives.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
                <CardContent className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-[18px] font-bold tracking-[-0.02em] text-[#2f3039]">{selectedSubject.title}</p>
                    <p className="mt-1 text-xs font-medium text-[#8a8b95]">
                      {unitsForSubject.length} unit{unitsForSubject.length === 1 ? "" : "s"} · {objectivesForSubject.length} objective{objectivesForSubject.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-[#d5d7e2] bg-white px-3 text-xs font-bold text-[#555764]"
                      onClick={() => setDialog({ kind: "unit", subjectId: selectedSubject.id })}
                    >
                      <Plus className="size-3.5" /> Unit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-[#9a4c53]"
                      aria-label="Delete subject"
                      onClick={() => {
                        if (confirmDelete(`Delete "${selectedSubject.title}" and everything inside it?`)) {
                          void deleteSubject(selectedSubject.id);
                          toast.success("Subject deleted");
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {unitsForSubject.length === 0 ? (
                <Card className="rounded-[24px] border-dashed border-[#d8dae5] bg-white py-0 shadow-none">
                  <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-8 text-center">
                    <p className="text-sm font-semibold text-[#5a5b68]">This subject has no units yet.</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setDialog({ kind: "unit", subjectId: selectedSubject.id })}
                    >
                      <Plus className="size-4" /> Add the first unit
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                unitsForSubject.map((unit) => {
                  const unitTopics = topicsForUnit(unit.id);
                  return (
                    <div key={unit.id} className="rounded-[24px] border border-[#e3e4eb] bg-white p-5 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-bold text-[#3a3b45]">{unit.title}</p>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Add topic"
                            onClick={() => setDialog({ kind: "topic", subjectId: unit.subjectId, unitId: unit.id })}
                          >
                            <Plus className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete unit"
                            onClick={() => {
                              if (confirmDelete(`Delete "${unit.title}" and everything inside it?`)) {
                                void deleteUnit(unit.id);
                                toast.success("Unit deleted");
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {unitTopics.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "topic", subjectId: unit.subjectId, unitId: unit.id })}
                            className="w-full rounded-[14px] border border-dashed border-[#d8dae5] px-4 py-3 text-left text-xs font-semibold text-[#8a8b95] hover:bg-[#f7f8fc]"
                          >
                            + Add a topic
                          </button>
                        ) : (
                          unitTopics.map((topic) => {
                            const topicObjectives = objectivesForTopic(topic.id);
                            return (
                              <div key={topic.id} className="rounded-[16px] bg-[#f6f7fb] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-bold text-[#454650]">{topic.title}</p>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Add objective"
                                      onClick={() => setDialog({ kind: "objective-create", subjectId: topic.subjectId, topicId: topic.id })}
                                    >
                                      <Plus className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Delete topic"
                                      onClick={() => {
                                        if (confirmDelete(`Delete "${topic.title}" and its objectives?`)) {
                                          void deleteTopic(topic.id);
                                          toast.success("Topic deleted");
                                        }
                                      }}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {topicObjectives.length === 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setDialog({ kind: "objective-create", subjectId: topic.subjectId, topicId: topic.id })}
                                      className="w-full rounded-[12px] border border-dashed border-[#d8dae5] px-3 py-2.5 text-left text-[11px] font-semibold text-[#8a8b95] hover:bg-white"
                                    >
                                      + Add a learning objective
                                    </button>
                                  ) : (
                                    topicObjectives.map((objective) => (
                                      <ObjectiveRow
                                        key={objective.id}
                                        objective={objective}
                                        onEdit={() => setDialog({ kind: "objective-edit", objective })}
                                        onContent={() => setDialog({ kind: "objective-content", objective })}
                                        onDelete={() => {
                                          if (confirmDelete(`Delete "${objective.title}"?`)) {
                                            void deleteObjective(objective.id);
                                            toast.success("Objective deleted");
                                          }
                                        }}
                                      />
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {dialog?.kind === "subject" && <SubjectDialog open onClose={() => setDialog(null)} />}
      {dialog?.kind === "unit" && (
        <UnitDialog open subjectId={dialog.subjectId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "topic" && (
        <TopicDialog open subjectId={dialog.subjectId} unitId={dialog.unitId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "objective-create" && (
        <ObjectiveDialog
          key="create"
          open
          defaultSubjectId={dialog.subjectId}
          defaultTopicId={dialog.topicId}
          allObjectives={objectives}
          subjects={subjects}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "objective-edit" && (
        <ObjectiveDialog
          key={dialog.objective.id}
          open
          objective={dialog.objective}
          allObjectives={objectives}
          subjects={subjects}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "objective-content" && (
        <ObjectiveContent
          key={dialog.objective.id}
          open
          objective={dialog.objective}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
