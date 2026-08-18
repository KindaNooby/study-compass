import type { DragEvent } from "react";

/** Custom dataTransfer type used to carry a scheduled activity id between views. */
export const ACTIVITY_DND_TYPE = "application/x-study-compass-activity";

export function setActivityDrag(event: DragEvent, id: string): void {
  event.dataTransfer.setData(ACTIVITY_DND_TYPE, id);
  event.dataTransfer.effectAllowed = "move";
}

export function draggedActivityId(event: DragEvent): string {
  return event.dataTransfer.getData(ACTIVITY_DND_TYPE);
}

export function allowActivityDrop(event: DragEvent): void {
  if (Array.from(event.dataTransfer.types).includes(ACTIVITY_DND_TYPE)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }
}
