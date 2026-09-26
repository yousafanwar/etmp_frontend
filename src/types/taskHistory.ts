export interface TaskHistory {
  id: number;
  taskId: number;
  userId: number | null;
  userName: string | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}
