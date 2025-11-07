import { v4 as uuidv4 } from "uuid";

const prefixes: Record<string, unknown> = {};

interface GenerateIdOptions {
  separator?: string;
}

/**
 * Generates a UUID v4 identifier
 * @param prefixOrOptions - Optional prefix key or options object
 * @param inputOptions - Additional options (when prefix is provided)
 * @returns A UUID v4 string, optionally with a prefix
 */
export function generateId(
  prefixOrOptions?: keyof typeof prefixes | GenerateIdOptions,
  inputOptions: GenerateIdOptions = {},
) {
  const finalOptions =
    typeof prefixOrOptions === "object" ? prefixOrOptions : inputOptions;

  const prefix =
    typeof prefixOrOptions === "object" ? undefined : prefixOrOptions;

  const { separator = "_" } = finalOptions;
  const id = uuidv4();

  return prefix && prefix in prefixes
    ? `${prefixes[prefix]}${separator}${id}`
    : id;
}
