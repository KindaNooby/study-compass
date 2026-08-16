import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_LABELS,
  ERROR_CATEGORIES,
  REVIEW_GRADES,
  addPracticeAttempt,
  addSessionLog,
  isDue,
  reviewCard,
  todayKey,
  useCards,
  useObjectives,
  useQuestions,
} from "@/lib/planner";
import type {
  ActivityKind,
  FsrsCard,
  Question,
  QuestionType,
  ReviewGrade,
  SessionStatus,
} from "@/lib/planner";
import { CheckCircle2, Loader2, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const SESSION_STATUSES: SessionStatus[] = ["completed", "partial", "skipped", "missed", "postponed"];

// --- Review cards ---

function ReviewRunner() {
  const { data: cards, loading } = useCards();
  const [queue, setQueue] = useState<FsrsCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [busy, setBusy] = useState(false);

  const due = useMemo(
    () =>
      cards
        .filter((card) => !card.suspended && isDue(card))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [cards],
  );

  const finished = queue !== null && index >= queue.length;
  const current = queue !== null && index < queue.length ? queue[index] : null;

  const start = () => {
    setQueue(due);
    setIndex(0);
    setRevealed(false);
    setStartedAt(Date.now());
  };

  const reset = () => {
    setQueue(null);
    setIndex(0);
    setRevealed(false);
    setStartedAt(0);
  };

  const grade = async (value: ReviewGrade) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await reviewCard(current, value, Date.now() - startedAt);
      setRevealed(false);
      setStartedAt(Date.now());
      setIndex((i) => i + 1);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#d8dae5] p-8 text-center">
        <p className="text-sm font-semibold text-[#5a5b68]">No flashcards yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add cards to a learning objective in Curriculum, then review them here.
        </p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="rounded-[16px] border border-[#e3e4eb] bg-[#f4faf6] p-8 text-center">
        <CheckCircle2 className="mx-auto size-8 text-[#3f9a63]" />
        <p className="mt-3 text-sm font-bold text-[#276641]">Session complete.</p>
        <p className="mt-1 text-xs text-[#5a7a66]">{queue?.length ?? 0} card{(queue?.length ?? 0) === 1 ? "" : "s"} reviewed.</p>
        <Button type="button" variant="outline" className="mt-4 rounded-full" onClick={reset}>
          <RotateCcw className="size-4" /> Done
        </Button>
      </div>
    );
  }

  if (current === null) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#d8dae5] p-8 text-center">
        <p className="text-sm font-semibold text-[#5a5b68]">
          {due.length === 0 ? "Nothing due right now." : `${due.length} card${due.length === 1 ? "" : "s"} ready.`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {due.length === 0
            ? "FSRS will schedule reviews as you learn. Come back when cards are due."
            : "Start the review session when you are ready."}
        </p>
        {due.length > 0 && (
          <Button type="button" className="mt-4 rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]" onClick={start}>
            <Play className="size-4" /> Start reviewing
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#8a8b95]">
        <span>{index + 1} of {queue?.length}</span>
        <span>Due · {cards.filter((card) => !card.suspended).length} active card{cards.filter((card) => !card.suspended).length === 1 ? "" : "s"}</span>
      </div>
      <div className="rounded-[20px] border border-[#e3e4eb] bg-white p-6 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9b9ca5]">Question</p>
        <p className="mt-2 text-lg font-semibold leading-7 text-[#2c2d36]">{current.front}</p>
        {revealed ? (
          <>
            <div className="my-4 h-px bg-[#ececf1]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9b9ca5]">Answer</p>
            <p className="mt-2 text-[15px] leading-6 text-[#3a3b45]">{current.back}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REVIEW_GRADES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => grade(value)}
                  className={`h-10 rounded-full font-bold text-white ${
                    value === "Again"
                      ? "bg-[#c6484e] hover:bg-[#b23d43]"
                      : value === "Hard"
                        ? "bg-[#d98a3d] hover:bg-[#c67a2f]"
                        : value === "Good"
                          ? "bg-[#3f9a63] hover:bg-[#358556]"
                          : "bg-[#4f74c9] hover:bg-[#4163b3]"
                  }`}
                >
                  {value}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <Button type="button" className="mt-5 rounded-full bg-[#3159b7] px-5 font-bold text-white hover:bg-[#264b9f]" onClick={() => setRevealed(true)}>
            Show answer
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Log practice ---

function PracticeLogger() {
  const { data: objectives } = useObjectives();
  const { data: questions } = useQuestions();

  const [objectiveId, setObjectiveId] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [kind, setKind] = useState<QuestionType>("mcq");
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);
  const [correct, setCorrect] = useState(true);
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("1");
  const [timeSeconds, setTimeSeconds] = useState("60");
  const [difficulty, setDifficulty] = useState(0.5);
  const [errorCategoryId, setErrorCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeObjectiveId = objectiveId || objectives[0]?.id || "";
  const objectiveQuestions = useMemo(
    () => questions.filter((question) => question.objectiveId === activeObjectiveId),
    [questions, activeObjectiveId],
  );
  const selectedQuestion: Question | undefined = objectiveQuestions.find(
    (question) => question.id === questionId,
  );

  const reset = () => {
    setQuestionId("");
    setChosenOptionId(null);
    setCorrect(true);
    setScore("");
    setMaxScore("1");
    setTimeSeconds("60");
    setDifficulty(0.5);
    setErrorCategoryId("");
    setError(null);
  };

  const chooseQuestion = (id: string) => {
    setQuestionId(id);
    const question = objectiveQuestions.find((item) => item.id === id);
    if (question) {
      setKind(question.kind);
      setDifficulty(question.difficulty);
      setChosenOptionId(null);
    }
  };

  const submit = async () => {
    try {
      const isMcq = selectedQuestion ? selectedQuestion.kind === "mcq" : kind === "mcq";
      const isCorrect = isMcq
        ? selectedQuestion
          ? chosenOptionId === selectedQuestion.correctOptionId
          : correct
        : false;

      await addPracticeAttempt({
        questionId: questionId || null,
        objectiveId: activeObjectiveId,
        kind: isMcq ? "mcq" : "structured",
        correct: isCorrect,
        score: isMcq ? null : score === "" ? null : Number(score),
        maxScore: isMcq ? null : Number(maxScore) || null,
        timeSeconds: Number(timeSeconds) || 0,
        difficulty,
        errorCategoryId: errorCategoryId || null,
        attemptedAt: new Date().toISOString(),
      });
      toast.success("Practice logged");
      reset();
    } catch {
      setError("Check the fields and try again.");
    }
  };

  if (objectives.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#d8dae5] p-8 text-center">
        <p className="text-sm font-semibold text-[#5a5b68]">Add a learning objective first.</p>
        <p className="mt-1 text-xs text-muted-foreground">Practice is measured against objectives, which live in Curriculum.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="practice-objective">Learning objective</Label>
        <select
          id="practice-objective"
          value={activeObjectiveId}
          onChange={(e) => {
            setObjectiveId(e.target.value);
            setQuestionId("");
            setChosenOptionId(null);
          }}
          className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
        >
          {objectives.map((objective) => (
            <option key={objective.id} value={objective.id}>{objective.title}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="practice-question">Question (optional)</Label>
        <select
          id="practice-question"
          value={questionId}
          onChange={(e) => chooseQuestion(e.target.value)}
          className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
        >
          <option value="">Free-form attempt</option>
          {objectiveQuestions.map((question) => (
            <option key={question.id} value={question.id}>
              {question.kind === "mcq" ? "MCQ · " : "Structured · "}
              {question.prompt.slice(0, 60)}
            </option>
          ))}
        </select>
      </div>

      {selectedQuestion?.kind === "mcq" ? (
        <div className="grid gap-2">
          <Label>Your answer</Label>
          <p className="text-sm font-semibold text-[#3a3b45]">{selectedQuestion.prompt}</p>
          <div className="grid gap-2">
            {selectedQuestion.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setChosenOptionId(option.id)}
                className={`rounded-[14px] border px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                  chosenOptionId === option.id
                    ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]"
                    : "border-[#e3e4eb] text-[#5a5b68] hover:bg-[#f4f5fa]"
                }`}
              >
                {option.text}
              </button>
            ))}
          </div>
          {chosenOptionId === null && (
            <p className="text-xs text-muted-foreground">Pick the option you believe is correct.</p>
          )}
        </div>
      ) : selectedQuestion?.kind === "structured" ? (
        <div className="grid gap-2">
          <Label>Self-mark</Label>
          <p className="text-sm font-semibold text-[#3a3b45]">{selectedQuestion.prompt}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="attempt-score">Marks earned</Label>
              <Input id="attempt-score" type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="attempt-max">Marks available</Label>
              <Input id="attempt-max" type="number" min={0} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {(["mcq", "structured"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setKind(type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  kind === type ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]" : "border-[#dce0ed] text-[#5a5b68]"
                }`}
              >
                {type === "mcq" ? "MCQ" : "Structured"}
              </button>
            ))}
          </div>
          {kind === "mcq" ? (
            <div className="flex flex-wrap gap-1.5">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setCorrect(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    correct === value ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]" : "border-[#dce0ed] text-[#5a5b68]"
                  }`}
                >
                  {value ? "Correct" : "Incorrect"}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="free-score">Marks earned</Label>
                <Input id="free-score" type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="free-max">Marks available</Label>
                <Input id="free-max" type="number" min={0} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="attempt-time">Time taken (seconds)</Label>
          <Input id="attempt-time" type="number" min={0} value={timeSeconds} onChange={(e) => setTimeSeconds(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="attempt-error">Error category (optional)</Label>
          <select
            id="attempt-error"
            value={errorCategoryId}
            onChange={(e) => setErrorCategoryId(e.target.value)}
            className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
          >
            <option value="">None</option>
            {ERROR_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Difficulty</Label>
          <span className="text-sm font-bold text-[#4562a1]">{Math.round(difficulty * 100)}%</span>
        </div>
        <Slider value={[difficulty * 100]} min={0} max={100} step={1} onValueChange={(values) => setDifficulty(values[0] / 100)} />
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="button" className="h-10 w-fit rounded-full bg-[#3159b7] px-5 font-bold text-white hover:bg-[#264b9f]" onClick={submit}>
        Log this attempt
      </Button>
    </div>
  );
}

// --- Log session ---

function SessionLogger() {
  const { data: objectives } = useObjectives();

  const [date, setDate] = useState(todayKey());
  const [kind, setKind] = useState<ActivityKind | "">("");
  const [objectiveId, setObjectiveId] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState("30");
  const [actualMinutes, setActualMinutes] = useState("30");
  const [status, setStatus] = useState<SessionStatus>("completed");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      await addSessionLog({
        date,
        kind: kind || undefined,
        objectiveIds: objectiveId ? [objectiveId] : [],
        plannedMinutes: Number(plannedMinutes) || 0,
        actualMinutes: Number(actualMinutes) || 0,
        status,
        startedAt: new Date().toISOString(),
        note: note.trim() || undefined,
      });
      toast.success("Session logged");
      setNote("");
      setError(null);
    } catch {
      setError("Check the fields and try again.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="session-date">Date</Label>
          <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="session-kind">Activity type</Label>
          <select
            id="session-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ActivityKind | "")}
            className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
          >
            <option value="">General study</option>
            {ACTIVITY_KINDS.map((value) => (
              <option key={value} value={value}>{ACTIVITY_KIND_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="session-objective">Learning objective (optional)</Label>
        <select
          id="session-objective"
          value={objectiveId}
          onChange={(e) => setObjectiveId(e.target.value)}
          className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
        >
          <option value="">None</option>
          {objectives.map((objective) => (
            <option key={objective.id} value={objective.id}>{objective.title}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="session-planned">Planned (minutes)</Label>
          <Input id="session-planned" type="number" min={0} value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="session-actual">Actual (minutes)</Label>
          <Input id="session-actual" type="number" min={0} value={actualMinutes} onChange={(e) => setActualMinutes(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="session-status">Outcome</Label>
        <select
          id="session-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as SessionStatus)}
          className="h-9 rounded-lg border border-[#dce0ed] bg-white px-2 text-xs font-semibold text-[#5a5b68]"
        >
          {SESSION_STATUSES.map((value) => (
            <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="session-note">Note (optional)</Label>
        <Textarea id="session-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="How did this session go?" />
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="button" className="h-10 w-fit rounded-full bg-[#3159b7] px-5 font-bold text-white hover:bg-[#264b9f]" onClick={submit}>
        Log session
      </Button>
    </div>
  );
}

export function Study() {
  const { data: objectives } = useObjectives();

  return (
    <>
      <section>
        <p className="text-sm font-semibold text-[#71727e]">Phase 2 · Measurement</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.045em] text-[#1e1f24]">Study now</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71727e]">
          Record what actually happens — card reviews, practice attempts, and study time. The
          measurement model reads these events to understand retention, application, and capacity.
        </p>
      </section>

      <section className="mt-7">
        <Tabs defaultValue="review" className="gap-5">
          <TabsList className="h-10 w-fit rounded-full bg-[#f1f2f7] p-1">
            <TabsTrigger value="review" className="h-8 rounded-full px-4 text-xs font-bold">
              Review cards
            </TabsTrigger>
            <TabsTrigger value="practice" className="h-8 rounded-full px-4 text-xs font-bold">
              Log practice
            </TabsTrigger>
            <TabsTrigger value="session" className="h-8 rounded-full px-4 text-xs font-bold">
              Log session
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
              <CardHeader className="px-6 pb-3 pt-6">
                <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">FSRS reviews</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Grade due cards to let FSRS schedule when you see them next.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <ReviewRunner />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="practice">
            <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
              <CardHeader className="px-6 pb-3 pt-6">
                <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Practice attempts</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  MCQ and structured answers are measured separately, never merged.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <PracticeLogger />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="session">
            <Card className="rounded-[24px] border-[#e3e4eb] bg-white py-0 shadow-[0_7px_20px_rgba(39,41,57,0.03)]">
              <CardHeader className="px-6 pb-3 pt-6">
                <CardTitle className="text-[18px] font-bold tracking-[-0.02em]">Study time</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Planned versus actual minutes feed the observed-capacity model.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <SessionLogger />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
