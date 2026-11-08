import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";
export const threadsQuery = queryOptions({
  queryKey: ["chat-threads"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("chat_threads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
});
export const threadQuery = (id: string) =>
  queryOptions({
    queryKey: ["chat-thread", id],
    queryFn: async () => {
      const { data: thread, error } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error("This conversation is not available.");
      const { data: rows, error: messageError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", id)
        .order("created_at")
        .order("id");
      if (messageError) throw new Error(messageError.message);
      return {
        thread,
        messages: rows.map((r) => ({ id: r.sdk_id, role: r.role, parts: r.parts }) as UIMessage),
      };
    },
  });
