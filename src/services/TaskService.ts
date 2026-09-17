import type { Task } from "../interfaces/Task";
import type { PagedResult } from "../interfaces/PagedResult";
import type { GetTasksParams } from "../interfaces/Task";

const API_URL = "https://localhost:7010/api/Tasks";

export const getTasks = async ( params: GetTasksParams = {} ): Promise<PagedResult<Task>> => {

  const queryParams = new URLSearchParams();

  if (params.pageNumber) {
    queryParams.append("pageNumber", params.pageNumber.toString());
  }

  if (params.pageSize) {
    queryParams.append("pageSize", params.pageSize.toString());
  }

  if (params.title) {
    queryParams.append("title", params.title);
  }

  if (params.status) {
    queryParams.append("status", params.status);
  }

  if (params.assigneeId) {
    queryParams.append("assigneeId", params.assigneeId.toString());
  }

  if (params.sortBy) {
    queryParams.append("sortBy", params.sortBy);
  }

  if (params.sortDescending !== undefined) {
    queryParams.append(
      "sortDescending",
      params.sortDescending.toString()
    );
  }

  const response = await fetch(
    `${API_URL}?${queryParams.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tasks");
  }

  return response.json();
};