const PLAN_IDS = ["pro"] as const

export type PlanId = (typeof PLAN_IDS)[number]

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value)
}

export const PLAN_LIMITS: Record<PlanId, { credits: number; trialCredits: number }> = {
 
  pro: {
    credits: 1000,
    trialCredits: 100,
  },

}
