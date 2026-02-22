export type NumericOperator = "<" | "<=" | ">" | ">=";
export type StatusOperator = "any-of" | "all-of";
export type ConditionType = "hp-percent" | "hp-value" | "in-combat" | "status-effect";

export type UiCondition =
  | { type: "hp-percent"; operator: NumericOperator; value: number }
  | { type: "hp-value"; operator: NumericOperator; value: number }
  | { type: "in-combat"; value: boolean }
  | { type: "status-effect"; operator: StatusOperator; value: string[] };

export type ConditionOption = { slug: string; name: string };

export const conditionTypeOptions: Array<{ value: ConditionType; label: string }> = [
  { value: "hp-percent", label: "HP Percent" },
  { value: "hp-value", label: "HP Value" },
  { value: "in-combat", label: "In Combat" },
  { value: "status-effect", label: "Status Effect" },
];

export const numericOperatorOptions: Array<{ value: NumericOperator; label: string }> = [
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
];

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function defaultCondition(type: ConditionType = "hp-percent"): UiCondition {
  switch (type) {
    case "hp-percent":
      return { type, operator: "<=", value: 0.5 };
    case "hp-value":
      return { type, operator: "<=", value: 10 };
    case "in-combat":
      return { type, value: true };
    case "status-effect":
      return { type, operator: "any-of", value: [] };
  }
}

export function conditionDisplayText(values: string[], conditionOptions: ConditionOption[]): string {
  if (values.length === 0) return "Select conditions";
  const names = values.map((slug) => conditionOptions.find((option) => option.slug === slug)?.name ?? slug);
  return names.join(", ");
}

export function formatConditionSummary(condition: UiCondition): string {
  if (condition.type === "hp-percent") return `HP % ${condition.operator} ${condition.value}`;
  if (condition.type === "hp-value") return `HP ${condition.operator} ${condition.value}`;
  if (condition.type === "in-combat") return condition.value ? "In Combat: Yes" : "In Combat: No";
  const mode = condition.operator === "all-of" ? "all" : "any";
  return `Status (${mode}): ${condition.value.join(", ") || "Select conditions"}`;
}

export function tokenStateConditionsSummary(conditions: UiCondition[]): string {
  if (conditions.length === 0) return "No conditions configured";
  if (conditions.length === 1) return formatConditionSummary(conditions[0]);
  return `${conditions.length} conditions configured`;
}

export function soundConditionSummary(trigger: UiCondition, conditions: UiCondition[]): string {
  const triggerText = `Trigger: ${formatConditionSummary(trigger)}`;
  if (conditions.length === 0) return `${triggerText}; no extra conditions`;
  if (conditions.length === 1) return `${triggerText}; if ${formatConditionSummary(conditions[0])}`;
  return `${triggerText}; ${conditions.length} extra conditions`;
}
