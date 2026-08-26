export const myTaskQueryKeys = {
  all: ["my-tasks"] as const,
  list: () => ["my-tasks", "list"] as const,
};
