// Simulated PLC feed: deterministic-ish readings per machine until real connectors are attached.
export type Reading = { t: number; speed: number; rejects: number; temp: number; oee: number };

function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function readingAt(machineId: string, nominal: number, status: string, t: number): Reading {
  const seed = [...machineId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const step = Math.floor(t / 2000);
  const n = noise(seed + step);
  if (status === "down") return { t, speed: 0, rejects: 0, temp: Math.round((24 + n) * 10) / 10, oee: 0 };
  const factor = status === "idle" ? 0 : 0.86 + n * 0.14 + Math.sin(step / 9 + seed) * 0.04;
  const speed = Math.max(0, Math.round(nominal * factor));
  const rejects = status === "idle" ? 0 : Math.round(n * n * 4);
  const temp = 38 + Math.sin(step / 15 + seed) * 3 + n * 2;
  const oee = status === "idle" ? 0 : Math.round(Math.min(99, factor * 100 - rejects * 1.5));
  return { t, speed, rejects, temp: Math.round(temp * 10) / 10, oee };
}

export function history(machineId: string, nominal: number, status: string, now: number, points = 40): Reading[] {
  return Array.from({ length: points }, (_, i) => readingAt(machineId, nominal, status, now - (points - 1 - i) * 2000));
}
