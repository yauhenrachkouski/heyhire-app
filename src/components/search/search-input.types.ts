export type ScenarioImportance = "low" | "medium" | "high" | "mandatory";

export interface Scenario {
  id: string;
  label: string;
  category: string;
  value: string;
  importance: ScenarioImportance;
  criterionId?: string;
  group: string;
  operator?: string;
}
