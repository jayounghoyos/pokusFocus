import { Task } from "./tasks";

export interface PlacedTask {
  task: Task;
  /** Fractional horizontal position within the day column, 0..1. */
  left: number;
  width: number;
  /** Full-width overlay tasks render on top of the packed ones. */
  overlay: boolean;
}

function start(t: Task): number {
  return t.startMin ?? 0;
}
function end(t: Task): number {
  return t.endMin ?? start(t) + 60;
}

/**
 * Google-Calendar-style column packing. Tasks that overlap in time are placed
 * side by side in separate columns so their text never stacks. Tasks flagged
 * `allowOverlap` are pulled out and drawn full-width on top.
 */
export function packDay(tasks: Task[]): PlacedTask[] {
  const overlay = tasks.filter((t) => t.allowOverlap);
  const packed = tasks
    .filter((t) => !t.allowOverlap)
    .sort((a, b) => start(a) - start(b) || end(a) - end(b));

  const result: PlacedTask[] = [];

  // Walk tasks, grouping into clusters where any task overlaps the running max.
  let cluster: Task[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment within the cluster.
    const columns: Task[][] = [];
    for (const t of cluster) {
      let placed = false;
      for (const col of columns) {
        if (start(t) >= end(col[col.length - 1])) {
          col.push(t);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([t]);
    }
    const n = columns.length;
    columns.forEach((col, ci) => {
      for (const t of col) {
        result.push({ task: t, left: ci / n, width: 1 / n, overlay: false });
      }
    });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const t of packed) {
    if (cluster.length > 0 && start(t) >= clusterEnd) flush();
    cluster.push(t);
    clusterEnd = Math.max(clusterEnd, end(t));
  }
  flush();

  for (const t of overlay) {
    result.push({ task: t, left: 0, width: 1, overlay: true });
  }

  return result;
}
