// Pure plant rules: out-of-range flagging (U1) and machine health (U12).

export type WeightCheck = { target: number; tolerance: number; samples: number[] };

export function flagWeightCheck({ target, tolerance, samples }: WeightCheck): string[] {
  const min = target - tolerance;
  const max = target + tolerance;
  const flags: string[] = [];
  samples.forEach((s, i) => {
    if (s < min) flags.push(`Sample ${i + 1} (${s} g) is below the ${min} g minimum`);
    else if (s > max) flags.push(`Sample ${i + 1} (${s} g) is above the ${max} g maximum`);
  });
  return flags;
}

export function flagBatchSheet(d: { mix_temp_c: number; target_temp_c: number; tolerance: number }): string[] {
  const diff = Math.abs(d.mix_temp_c - d.target_temp_c);
  return diff > d.tolerance
    ? [`Mix temperature ${d.mix_temp_c} °C is outside ${d.target_temp_c} ± ${d.tolerance} °C`]
    : [];
}

export function flagChangeover(checklist: Record<string, boolean>): string[] {
  return Object.entries(checklist)
    .filter(([, done]) => !done)
    .map(([step]) => `${step}: not completed`);
}

export type HealthInput = {
  hours_since_pm: number;
  pm_interval_hours: number;
  criticality: number;
  status: string;
  recent_failures: number;
};

/** 0–100 risk of unplanned failure in the coming week. */
export function failureRisk(m: HealthInput): number {
  const pmRatio = m.pm_interval_hours > 0 ? m.hours_since_pm / m.pm_interval_hours : 1;
  let risk = Math.min(pmRatio, 1.5) * 50; // up to 75 from overdue PM
  risk += m.recent_failures * 12;
  if (m.status === "down") risk += 20;
  risk *= 0.8 + m.criticality * 0.05; // criticality 1..5 => x0.85..x1.05
  return Math.max(0, Math.min(100, Math.round(risk)));
}

export function riskLevel(risk: number): "low" | "watch" | "high" {
  if (risk >= 60) return "high";
  if (risk >= 35) return "watch";
  return "low";
}

/** Hours left before the PM interval is reached (negative = overdue). */
export function hoursToPm(m: { hours_since_pm: number; pm_interval_hours: number }): number {
  return Math.round(m.pm_interval_hours - m.hours_since_pm);
}
