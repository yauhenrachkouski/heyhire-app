import type { CategoryTag, Concept, Criterion, ParsedQuery } from "@/types/search";

const EXCLUDE_OPERATORS = new Set(["must_exclude", "must_not_be_in_list"]);

function toStringValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const languageCode =
      typeof obj.language_code === "string" ? obj.language_code : undefined;
    const minimumLevelRaw =
      (typeof obj.minimum_level === "string" && obj.minimum_level) ||
      (typeof obj["minimum _level"] === "string" && obj["minimum _level"]);
    if (languageCode) {
      const levelSuffix = minimumLevelRaw ? ` (${minimumLevelRaw})` : "";
      return [`${languageCode}${levelSuffix}`];
    }
    const candidate =
      (typeof obj.name === "string" && obj.name) ||
      (typeof obj.label === "string" && obj.label) ||
      (typeof obj.value === "string" && obj.value) ||
      (typeof obj.title === "string" && obj.title);
    if (candidate) return [candidate];
    if (typeof obj.city === "string" && typeof obj.country === "string") {
      return [`${obj.city}, ${obj.country}`];
    }
    return [JSON.stringify(obj)];
  }
  return [];
}

function mapPriorityToImportance(
  priority: Criterion["priority_level"]
): CategoryTag["importance"] {
  if (priority === "mandatory") return "mandatory";
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function resolveCriterionValues(
  criterion: Criterion,
  concepts: Record<string, Concept> | undefined
): string[] {
  const concept = criterion.concept_id ? concepts?.[criterion.concept_id] : undefined;
  const conceptLabel =
    concept?.display_label && concept.display_label.trim() ? concept.display_label.trim() : "";
  const values = conceptLabel ? [conceptLabel] : toStringValues(criterion.value);
  return values.map((value) => value.trim()).filter(Boolean);
}

/**
 * Convert V3 criteria list to ParsedQuery
 */
export function mapCriteriaToParsedQuery(
  criteria: Criterion[],
  concepts: Record<string, Concept> | undefined
): ParsedQuery {
  const allTags: CategoryTag[] = [];
  const titles: string[] = [];
  const locations: string[] = [];
  const skills: string[] = [];
  const industries: string[] = [];
  const companies: string[] = [];
  const educations: string[] = [];
  const years: string[] = [];
  let remotePreference = "";

  for (const criterion of criteria) {
    const values = resolveCriterionValues(criterion, concepts);
    if (values.length === 0) continue;

    const importance = mapPriorityToImportance(criterion.priority_level);
    const isExclude = EXCLUDE_OPERATORS.has(criterion.operator);

    switch (criterion.type) {
      case "logistics_location":
        locations.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "location" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "logistics_work_mode":
        if (!remotePreference) remotePreference = values[0];
        break;
      case "language_requirement":
        allTags.push(
          ...values.map((value) => ({
            category: "language" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "minimum_years_of_experience":
      case "minimum_relevant_years_of_experience":
        years.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "years_of_experience" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "company_constraint":
        if (isExclude) {
          allTags.push(
            ...values.map((value) => ({
              category: "excluded_company" as const,
              value,
              importance,
              criterion_id: criterion.id,
            }))
          );
        } else {
          companies.push(...values);
          allTags.push(
            ...values.map((value) => ({
              category: "company" as const,
              value,
              importance,
              criterion_id: criterion.id,
            }))
          );
        }
        break;
      case "capability_requirement":
        skills.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "hard_skills" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "tool_requirement":
        skills.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "tools" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "domain_requirement":
        industries.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "industry" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "certification_requirement":
        educations.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "education_field" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      case "career_signal_constraints":
        titles.push(...values);
        allTags.push(
          ...values.map((value) => ({
            category: "job_title" as const,
            value,
            importance,
            criterion_id: criterion.id,
          }))
        );
        break;
      default:
        break;
    }
  }

  const toField = (values: string[], operator: "OR" | "AND" = "OR") => {
    const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
    if (unique.length === 0) return "";
    if (unique.length === 1) return unique[0];
    return { values: unique, operator };
  };

  const yearsValue = (() => {
    const numeric = years
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value));
    if (numeric.length > 0) {
      return String(Math.max(...numeric));
    }
    return years[0] || "";
  })();

  return {
    job_title: toField(titles, "OR"),
    location: toField(locations, "OR"),
    skills: toField(skills, "AND"),
    industry: toField(industries, "OR"),
    company: toField(companies, "OR"),
    years_of_experience: yearsValue,
    education: toField(educations, "OR"),

    is_current: null,
    company_size: "",
    revenue_range: "",
    remote_preference: remotePreference,
    funding_types: "",
    founded_year_range: "",
    web_technologies: "",

    tags: allTags,
  };
}
