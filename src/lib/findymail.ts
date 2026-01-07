/**
 * Findymail API client for email and phone lookup
 * Documentation: https://app.findymail.com/docs/
 */

const FINDYMAIL_BASE_URL = "https://app.findymail.com";

export type FindymailEmailResponse = {
  contact?: {
    name: string;
    domain: string;
    email: string;
  };
  error?: string;
};

export type FindymailPhoneResponse = {
  phone?: string;
  error?: string;
};

export type FindymailCreditsResponse = {
  credits: number;
  verifier_credits: number;
};

export class FindymailError extends Error {
  constructor(
    message: string,
    public code: "NOT_ENOUGH_CREDITS" | "SUBSCRIPTION_PAUSED" | "UNAUTHORIZED" | "NOT_FOUND" | "UNKNOWN",
    public statusCode?: number
  ) {
    super(message);
    this.name = "FindymailError";
  }
}

function getApiToken(): string {
  const token = process.env.FINDYMAIL_API_TOKEN;
  if (!token) {
    throw new FindymailError("FINDYMAIL_API_TOKEN is not configured", "UNKNOWN");
  }
  return token;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    throw new FindymailError("Unauthenticated - check your API token", "UNAUTHORIZED", 401);
  }

  if (response.status === 402) {
    throw new FindymailError("Not enough Findymail credits", "NOT_ENOUGH_CREDITS", 402);
  }

  if (response.status === 423) {
    throw new FindymailError("Findymail subscription is paused", "SUBSCRIPTION_PAUSED", 423);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new FindymailError(`Findymail API error: ${text}`, "UNKNOWN", response.status);
  }

  return response.json() as Promise<T>;
}

/**
 * Find email from LinkedIn profile URL
 * Uses 1 finder credit if a verified email is found
 * @param linkedinUrl - Full LinkedIn URL or just username
 */
export async function findEmailByLinkedIn(linkedinUrl: string): Promise<FindymailEmailResponse> {
  const token = getApiToken();

  const response = await fetch(`${FINDYMAIL_BASE_URL}/api/search/business-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ linkedin_url: linkedinUrl }),
  });

  return handleResponse<FindymailEmailResponse>(response);
}

/**
 * Find phone from LinkedIn profile URL
 * Uses 10 finder credits if a phone is found
 * Note: EU citizens will not return results for legal reasons
 * @param linkedinUrl - Full LinkedIn URL or just username
 */
export async function findPhoneByLinkedIn(linkedinUrl: string): Promise<FindymailPhoneResponse> {
  const token = getApiToken();

  const response = await fetch(`${FINDYMAIL_BASE_URL}/api/search/phone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ linkedin_url: linkedinUrl }),
  });

  return handleResponse<FindymailPhoneResponse>(response);
}

/**
 * Get remaining Findymail credits
 */
export async function getFindymailCredits(): Promise<FindymailCreditsResponse> {
  const token = getApiToken();

  const response = await fetch(`${FINDYMAIL_BASE_URL}/api/credits`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<FindymailCreditsResponse>(response);
}

/**
 * Find both email and phone from LinkedIn profile URL
 * Fetches email first, then phone
 */
export async function findContactByLinkedIn(linkedinUrl: string): Promise<{
  email?: string;
  phone?: string;
  name?: string;
  domain?: string;
}> {
  const [emailResult, phoneResult] = await Promise.allSettled([
    findEmailByLinkedIn(linkedinUrl),
    findPhoneByLinkedIn(linkedinUrl),
  ]);

  const result: {
    email?: string;
    phone?: string;
    name?: string;
    domain?: string;
  } = {};

  if (emailResult.status === "fulfilled" && emailResult.value.contact) {
    result.email = emailResult.value.contact.email;
    result.name = emailResult.value.contact.name;
    result.domain = emailResult.value.contact.domain;
  }

  if (phoneResult.status === "fulfilled" && phoneResult.value.phone) {
    result.phone = phoneResult.value.phone;
  }

  return result;
}
