import { api } from "../api/client";
import type { CreateSkillRequest, Skill } from "../types/skill";

export const getSkills = (signal?: AbortSignal) =>
  api.get<Skill[]>("/skills", signal);

export const getSkill = (id: number, signal?: AbortSignal) =>
  api.get<Skill>(`/skills/${id}`, signal);

export const createSkill = (request: CreateSkillRequest) =>
  api.post<Skill>("/skills", request);
