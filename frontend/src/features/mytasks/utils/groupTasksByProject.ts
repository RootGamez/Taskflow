import type { MyTask, MyTaskProject } from "@/features/mytasks/types/myTask.types";

export interface ProjectTaskGroup {
  project: MyTaskProject;
  tasks: MyTask[];
}

/**
 * Agrupa tareas consecutivas del mismo proyecto (comparando `project.id`,
 * NUNCA `project.name` -- dos proyectos distintos pueden compartir nombre).
 *
 * PRESERVA el orden recibido de la API (D32, DESIGN_SYSTEM.md 8.3): el
 * backend ya resuelve "agrupado por proyecto; vencidos primero, luego
 * fecha ascendente, sin fecha al final" con un solo `order_by`. Esta
 * funcion es deliberadamente tonta -- no reordena nada, solo pliega tareas
 * contiguas del mismo proyecto en un grupo.
 */
export function groupTasksByProject(tasks: readonly MyTask[]): ProjectTaskGroup[] {
  const groups: ProjectTaskGroup[] = [];

  for (const task of tasks) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.project.id === task.project.id) {
      lastGroup.tasks.push(task);
    } else {
      groups.push({ project: task.project, tasks: [task] });
    }
  }

  return groups;
}
