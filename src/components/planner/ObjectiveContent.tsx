import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ERROR_CATEGORIES,
  createCard,
  createQuestion,
  deleteCard,
  deleteQuestion,
  uid,
  useCards,
  useQuestions,
} from "@/lib/planner";
import type { FsrsCard, LearningObjective, Question, QuestionType } from "@/lib/planner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function CardForm({ objectiveId }: { objectiveId: string }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      await createCard(objectiveId, front, back);
      setFront("");
      setBack("");
      setError(null);
      toast.success("Card added");
    } catch {
      setError("Enter both sides of the card.");
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="card-front">Question side</Label>
        <Textarea
          id="card-front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="e.g. What are the three stages of onboarding?"
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="card-back">Answer side</Label>
        <Textarea
          id="card-back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="e.g. Discover, configure, and validate."
          rows={2}
        />
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="button" className="h-9 w-fit rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]" onClick={submit}>
        <Plus className="size-4" /> Add card
      </Button>
    </div>
  );
}

function CardList({ cards }: { cards: FsrsCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-[#d8dae5] p-6 text-center text-xs text-muted-foreground">
        No flashcards yet. Add one above so FSRS can schedule its reviews.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <div key={card.id} className="group flex items-start justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#3a3b45]">{card.front}</p>
            <p className="mt-1 text-xs text-[#7a7b86]">{card.back}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">{card.state}</Badge>
              <Badge variant="outline" className="text-[10px]">{card.reps} review{card.reps === 1 ? "" : "s"}</Badge>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#9a4c53]"
            aria-label="Delete card"
            onClick={() => {
              void deleteCard(card.id);
              toast.success("Card deleted");
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function QuestionForm({ objectiveId }: { objectiveId: string }) {
  const [kind, setKind] = useState<QuestionType>("mcq");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<{ id: string; text: string }[]>([]);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [answerNote, setAnswerNote] = useState("");
  const [difficulty, setDifficulty] = useState(0.5);
  const [errorCategoryIds, setErrorCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const setOptionText = (id: string, text: string) =>
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, text } : option)));
  const removeOption = (id: string) => {
    setOptions((current) => current.filter((option) => option.id !== id));
    if (correctOptionId === id) setCorrectOptionId(null);
  };
  const toggleErrorCategory = (id: string) =>
    setErrorCategoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const submit = async () => {
    try {
      await createQuestion({
        objectiveId,
        kind,
        prompt,
        options: kind === "mcq" ? options : [],
        correctOptionId: kind === "mcq" ? correctOptionId : null,
        answerNote,
        difficulty,
        errorCategoryIds,
      });
      setPrompt("");
      setOptions([]);
      setCorrectOptionId(null);
      setAnswerNote("");
      setError(null);
      toast.success("Question added");
    } catch {
      setError(
        kind === "mcq"
          ? "Add at least two options and mark the correct answer."
          : "Enter a prompt and a mark scheme.",
      );
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(["mcq", "structured"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setKind(type)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              kind === type
                ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]"
                : "border-[#dce0ed] text-[#5a5b68] hover:bg-[#f4f5fa]"
            }`}
          >
            {type === "mcq" ? "Multiple choice" : "Structured / written"}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="question-prompt">Prompt</Label>
        <Textarea
          id="question-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={kind === "mcq" ? "e.g. Which step must happen before configuration?" : "e.g. Explain how to validate a migrated workspace."}
          rows={2}
        />
      </div>

      {kind === "mcq" && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-full px-3 text-xs font-bold text-[#3157a2]"
              onClick={() => setOptions((current) => [...current, { id: uid(), text: "" }])}
            >
              <Plus className="size-3.5" /> Add option
            </Button>
          </div>
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${objectiveId}`}
                  checked={correctOptionId === option.id}
                  onChange={() => setCorrectOptionId(option.id)}
                  className="size-4 accent-[#3159b7]"
                  aria-label="Mark as correct"
                />
                <Input
                  value={option.text}
                  onChange={(e) => setOptionText(option.id, e.target.value)}
                  placeholder="Option text"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-[#9a4c53]"
                  aria-label="Remove option"
                  onClick={() => removeOption(option.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground">Add at least two options.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="answer-note">{kind === "mcq" ? "Explanation" : "Mark scheme"}</Label>
        <Textarea
          id="answer-note"
          value={answerNote}
          onChange={(e) => setAnswerNote(e.target.value)}
          placeholder="Why this answer is correct, or how marks are awarded."
          rows={2}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Difficulty</Label>
          <span className="text-sm font-bold text-[#4562a1]">{Math.round(difficulty * 100)}%</span>
        </div>
        <Slider
          value={[difficulty * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={(values) => setDifficulty(values[0] / 100)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Common error categories</Label>
        <div className="flex flex-wrap gap-1.5">
          {ERROR_CATEGORIES.map((category) => (
            <label
              key={category.id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                errorCategoryIds.includes(category.id)
                  ? "border-[#c3d0f5] bg-[#e6ecff] text-[#244a9c]"
                  : "border-[#dce0ed] text-[#5a5b68]"
              }`}
            >
              <Checkbox
                checked={errorCategoryIds.includes(category.id)}
                onCheckedChange={() => toggleErrorCategory(category.id)}
              />
              {category.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="button" className="h-9 w-fit rounded-full bg-[#3159b7] px-4 font-bold text-white hover:bg-[#264b9f]" onClick={submit}>
        <Plus className="size-4" /> Add question
      </Button>
    </div>
  );
}

function QuestionList({ questions }: { questions: Question[] }) {
  if (questions.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-[#d8dae5] p-6 text-center text-xs text-muted-foreground">
        No practice questions yet. Add one above to start measuring application.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {questions.map((question) => (
        <div key={question.id} className="group flex items-start justify-between gap-3 rounded-[14px] border border-[#e8e9f1] bg-[#fbfbfd] p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#3a3b45]">{question.prompt}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {question.kind === "mcq" ? "MCQ" : "Structured"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{Math.round(question.difficulty * 100)}% difficulty</Badge>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#9a4c53]"
            aria-label="Delete question"
            onClick={() => {
              void deleteQuestion(question.id);
              toast.success("Question deleted");
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function ObjectiveContent({
  open,
  objective,
  onClose,
}: {
  open: boolean;
  objective: LearningObjective;
  onClose: () => void;
}) {
  const cardsQuery = useCards();
  const questionsQuery = useQuestions();
  const loading = cardsQuery.loading || questionsQuery.loading;

  const cards = cardsQuery.data.filter((card) => card.objectiveId === objective.id);
  const questions = questionsQuery.data.filter((question) => question.objectiveId === objective.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Content for “{objective.title}”</DialogTitle>
          <DialogDescription>
            Flashcards feed FSRS retention. Questions feed MCQ and structured-answer practice.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="cards" className="gap-4">
            <TabsList className="h-10 w-fit rounded-full bg-[#f1f2f7] p-1">
              <TabsTrigger value="cards" className="h-8 rounded-full px-4 text-xs font-bold">
                Flashcards · {cards.length}
              </TabsTrigger>
              <TabsTrigger value="questions" className="h-8 rounded-full px-4 text-xs font-bold">
                Questions · {questions.length}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cards" className="grid gap-4">
              <CardForm objectiveId={objective.id} />
              <CardList cards={cards} />
            </TabsContent>
            <TabsContent value="questions" className="grid gap-4">
              <QuestionForm objectiveId={objective.id} />
              <QuestionList questions={questions} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
