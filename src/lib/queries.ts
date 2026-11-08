import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Machine = Tables<"machines">;
export type PaperRecord = Tables<"paper_records">;
export type MaintEvent = Tables<"maintenance_events">;

export const accessQuery = queryOptions({
  queryKey: ["plant-access"],
  queryFn: async () => {
    const { data, error } = await supabase.from("user_roles").select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },
});

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const machinesQuery = queryOptions({
  queryKey: ["machines"],
  queryFn: () => must<Machine[]>(supabase.from("machines").select("*").order("line").order("name")),
});
export const recordsQuery = queryOptions({
  queryKey: ["records"],
  queryFn: () => must<PaperRecord[]>(supabase.from("paper_records").select("*").order("recorded_at", { ascending: false })),
});
export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => must<MaintEvent[]>(supabase.from("maintenance_events").select("*").order("starts_at")),
});
