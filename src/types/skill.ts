export interface Skill {
  id: number;
  name: string;
}

export interface UserSkill {
  skillId: number;
  skillName: string;
}

export interface CreateSkillRequest {
  name: string;
}
