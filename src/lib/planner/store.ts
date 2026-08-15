import { useLiveQuery } from "dexie-react-hooks";

import { AVAILABILITY_ID, db } from "./db";
import type {
  Availability,
  ExamGoal,
  LearningObjective,
  StudyActivity,
  Subject,
  Topic,
  Unit,
} from "./types";

function useTable<T>(querier: () => Promise<T[]>): { data: T[]; loading: boolean } {
  const result = useLiveQuery(querier, []);
  return { data: result ?? [], loading: result === undefined };
}

export function useSubjects() {
  return useTable<Subject>(() => db.subjects.toArray());
}

export function useUnits() {
  return useTable<Unit>(() => db.units.toArray());
}

export function useTopics() {
  return useTable<Topic>(() => db.topics.toArray());
}

export function useObjectives() {
  return useTable<LearningObjective>(() => db.objectives.toArray());
}

export function useCurriculum() {
  const subjects = useSubjects();
  const units = useUnits();
  const topics = useTopics();
  const objectives = useObjectives();
  return {
    subjects: subjects.data,
    units: units.data,
    topics: topics.data,
    objectives: objectives.data,
    loading:
      subjects.loading || units.loading || topics.loading || objectives.loading,
  };
}

export function useExamGoals() {
  return useTable<ExamGoal>(() => db.examGoals.toArray());
}

export function useAvailability(): {
  availability: Availability | undefined;
  loading: boolean;
} {
  const availability = useLiveQuery(() => db.availability.get(AVAILABILITY_ID), []);
  return { availability, loading: availability === undefined };
}

export function useActivities() {
  return useTable<StudyActivity>(() => db.activities.toArray());
}
