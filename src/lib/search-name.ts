import type { MultiValueField, ParsedQuery } from "@/types/search";

export const SEARCH_NAME_MAX_LENGTH = 50;
const FALLBACK_NAME = "Untitled Search";

type NameField = string | MultiValueField | undefined;

function formatFieldForName(field: NameField): string {
  if (!field) return "";

  if (typeof field === "string") {
    return field.trim();
  }

  if (typeof field === "object" && "values" in field) {
    const values = field.values.map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) return "";
    if (values.length === 1) return values[0];

    const operator = field.operator.toLowerCase();
    if (values.length === 2) {
      return values.join(` ${operator} `);
    }

    const last = values[values.length - 1];
    const rest = values.slice(0, -1);
    return `${rest.join(", ")}, ${operator} ${last}`;
  }

  return "";
}

function truncateSearchName(name: string): string {
  if (name.length <= SEARCH_NAME_MAX_LENGTH) return name;
  return `${name.slice(0, SEARCH_NAME_MAX_LENGTH - 1)}…`;
}

function formatTagValues(tags: ParsedQuery["tags"]): string {
  const values = tags.map((tag) => tag.value.trim()).filter(Boolean);
  if (values.length === 0) return "";
  return values.join(", ");
}

export function generateSearchName(query: ParsedQuery): string {
  const jobTitle = formatFieldForName(query.job_title);
  if (jobTitle) return truncateSearchName(jobTitle);

  const skills = formatFieldForName(query.skills);
  if (skills) return truncateSearchName(`Skills: ${skills}`);

  const company = formatFieldForName(query.company);
  if (company) return truncateSearchName(`Company: ${company}`);

  const location = formatFieldForName(query.location);
  if (location) return truncateSearchName(`Location: ${location}`);

  const industry = formatFieldForName(query.industry);
  if (industry) return truncateSearchName(`Industry: ${industry}`);

  const tags = formatTagValues(query.tags ?? []);
  if (tags) return truncateSearchName(tags);

  return FALLBACK_NAME;
}
