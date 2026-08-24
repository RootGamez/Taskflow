export type DateFilterPreset = "all" | "overdue" | "today" | "week" | "month" | "no_date" | "custom";

export interface TicketDateFilter {
  preset: DateFilterPreset;
  from: string | null;
  to: string | null;
}
