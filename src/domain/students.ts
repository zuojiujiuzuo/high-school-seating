import type { ProjectState } from "../types";

export function removeStudentFromProject(project: ProjectState, studentId: string): ProjectState {
  return {
    ...project,
    solutionConfirmed: false,
    students: project.students.filter((student) => student.id !== studentId),
    assignments: Object.fromEntries(
      Object.entries(project.assignments).filter(([, assignedStudentId]) => assignedStudentId !== studentId),
    ),
    constraints: project.constraints.filter((constraint) => (
      constraint.pair.a !== studentId && constraint.pair.b !== studentId
    )),
  };
}
