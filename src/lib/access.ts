export type PlantRole = "production_manager" | "machine_operator";
export function isManager(role: PlantRole) { return role === "production_manager"; }
export function homeTitle(role: PlantRole) { return isManager(role) ? "Production overview" : "My machines"; }
export function visibleNavigation(role: PlantRole) {
  return isManager(role) ? ["/overview", "/paperwork", "/machines", "/search", "/maintenance", "/team"] : ["/overview", "/paperwork", "/machines", "/search"];
}