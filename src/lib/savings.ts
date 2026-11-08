export const DEFAULT_SAVINGS = {
  paperwork_minutes: 5,
  ai_minutes: 10,
  hourly_cost: 25,
  monthly_service_cost: 0,
  currency: "EUR",
};
export type SavingsAssumptions = typeof DEFAULT_SAVINGS;
export type SavingsActivity = { kind: string; created_at: string };
export function calculateSavings(
  activity: SavingsActivity[],
  settings: SavingsAssumptions,
  start: Date,
  end: Date,
) {
  const eligible = activity.filter(
    (a) => new Date(a.created_at) >= start && new Date(a.created_at) < end,
  );
  const paperwork = eligible.filter((a) => a.kind === "paperwork").length;
  const answers = eligible.filter((a) => a.kind === "ai_answer").length;
  const paperworkMinutes = paperwork * settings.paperwork_minutes;
  const aiMinutes = answers * settings.ai_minutes;
  const hours = (paperworkMinutes + aiMinutes) / 60;
  const gross = hours * settings.hourly_cost;
  const days = Math.max(0, (end.getTime() - start.getTime()) / 86400000);
  const cost = (settings.monthly_service_cost * days) / 30;
  return { paperwork, answers, paperworkMinutes, aiMinutes, hours, gross, cost, net: gross - cost };
}
