export type PlanId = "pro";

export const PLAN_LIMITS: Record<PlanId, { credits: number; trialCredits: number }> = {
  pro: {
    credits: 1000,
    trialCredits: 100,
  },
};
