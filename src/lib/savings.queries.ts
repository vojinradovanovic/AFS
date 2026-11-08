import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const savingsQuery = queryOptions({
  queryKey: ["savings"],
  queryFn: async () => {
    const [a, s] = await Promise.all([
      supabase.from("savings_activity").select("*").order("created_at"),
      supabase.from("savings_settings").select("*").maybeSingle(),
    ]);
    if (a.error || s.error) throw new Error("Could not load savings.");
    return { activity: a.data, settings: s.data };
  },
});
