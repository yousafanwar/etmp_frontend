export interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string | null;
}

export interface ProjectUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ProjectSkill {
  skillId: number;
  skillName: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateProjectRequest {
  name: string;
  description: string;
  startDate: string;
  endDate?: string | null;
}

/** Derived UI status — backend does not expose a status field yet. */
export type ProjectStatus = "OnTrack" | "AtRisk" | "Delayed" | "InReview";
