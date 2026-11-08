import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePlantChat } = await import("@/lib/chat/handler.server");
        return handlePlantChat(request);
      },
    },
  },
});
