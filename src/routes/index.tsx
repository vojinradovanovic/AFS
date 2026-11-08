import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AFS — AI Factory System" },
      { name: "description", content: "AI layer for CPG plants: paperwork, live machine data, AI search and predictive maintenance." },
      { property: "og:title", content: "AFS — AI Factory System" },
      { property: "og:description", content: "AI layer for CPG plants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/overview" });
  },
});
