"use server";

import { getErrorMessage } from "@/lib/handle-error";
import { z } from "zod";

const SURFE_API_KEY = process.env.SURFE_API_KEY;
const SURFE_API_URL = "https://api.surfe.com/v2/people/enrich";

// Schema for the enrichment request
const revealEmailSchema = z.object({
  linkedinUrl: z.string().url("Invalid LinkedIn URL"),
});

// Schema for the Surfe API v2 initial response (async)
const surfeInitialResponseSchema = z.object({
  message: z.string().optional(),
  enrichmentID: z.string(),
  enrichmentCallbackURL: z.string(),
}).passthrough();

// Schema for email and phone objects
const emailSchema = z.union([
  z.string(),
  z.object({
    email: z.string().optional(),
    value: z.string().optional(),
    type: z.string().optional(),
    confidence: z.number().optional(),
  }).passthrough(),
  z.any(), // Fallback for any other format
]);

const phoneSchema = z.union([
  z.string(),
  z.object({
    number: z.string().optional(),
    phoneNumber: z.string().optional(),
    phone: z.string().optional(),
    mobilePhone: z.string().optional(), // Added this field
    value: z.string().optional(),
    type: z.string().optional(),
    confidence: z.number().optional(),
    confidenceScore: z.number().optional(),
  }).passthrough(),
  z.any(), // Fallback for any other format
]);

// Schema for the Surfe API v2 enrichment result
const surfePersonSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  companyDomain: z.string().optional(),
  linkedinUrl: z.string().optional(),
  linkedInUrl: z.string().optional(), // API might use different casing
  jobTitle: z.string().optional(),
  emails: z.array(emailSchema).nullable().optional(),
  mobilePhones: z.array(phoneSchema).nullable().optional(),
  status: z.string().optional(),
}).passthrough();

const surfeEnrichmentResultSchema = z.object({
  id: z.string().optional(),
  enrichmentID: z.string().optional(),
  status: z.string().optional(),
  percentCompleted: z.number().optional(),
  // v2 API returns 'people' array
  people: z.array(surfePersonSchema).optional(),
  // Fallback for other possible formats
  results: z.array(surfePersonSchema).optional(),
  person: surfePersonSchema.optional(),
}).passthrough();

// Universal enrichment response type
export type EnrichmentResponse = {
  success: boolean;
  data?: {
    emails: string[]; // Array of all emails found
    phones: string[]; // Array of all phone numbers found
    status?: string;
    creditsUsed?: number;
  };
  error?: string;
};

// Legacy types for backward compatibility
export type RevealEmailResponse = {
  success: boolean;
  data?: {
    emails: string[]; // Array of all emails found
    status?: string;
    creditsUsed?: number;
  };
  error?: string;
};

export type RevealPhoneResponse = {
  success: boolean;
  data?: {
    phones: string[]; // Array of all phone numbers found
    status?: string;
    creditsUsed?: number;
  };
  error?: string;
};

/**
 * Reveal a person's email address using their LinkedIn URL via Surfe API v2
 * Uses the /v2/people/enrich endpoint (asynchronous with polling)
 * 
 * Process:
 * 1. Initiates enrichment request
 * 2. Polls callback URL for result (max 60 attempts, ~60 seconds)
 * 3. Returns all emails when enrichment completes
 * 
 * @param linkedinUrl - The LinkedIn profile URL
 * @returns Email enrichment data or error
 */
export async function revealEmail(
  linkedinUrl: string
): Promise<RevealEmailResponse> {
  try {
    console.log("[Enrichment] Revealing email for LinkedIn URL:", linkedinUrl);

    // Validate API key
    if (!SURFE_API_KEY) {
      throw new Error("SURFE_API_KEY is not set in environment variables");
    }

    // Validate input - check for null, undefined, or empty string
    if (!linkedinUrl || typeof linkedinUrl !== 'string' || linkedinUrl.trim() === '') {
      throw new Error("Valid LinkedIn URL is required");
    }

    // Validate input format
    const validatedInput = revealEmailSchema.parse({ linkedinUrl });

    // Make request to Surfe API v2
    const response = await fetch(SURFE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SURFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        include: {
          email: true,
          mobile: false,
        },
        people: [
          {
            linkedinUrl: validatedInput.linkedinUrl,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Enrichment] Surfe API error:", errorData);
      throw new Error(`Surfe API error: ${response.status} - ${errorData}`);
    }

    const initialData = await response.json();
    console.log("[Enrichment] Surfe API v2 initial response:", initialData);

    // Validate initial response
    const initialResponse = surfeInitialResponseSchema.parse(initialData);
    console.log("[Enrichment] Enrichment started, callback URL:", initialResponse.enrichmentCallbackURL);

    // Poll the callback URL to get the actual result
    // Wait a bit before first poll (API suggests ~1s)
    await new Promise(resolve => setTimeout(resolve, 1500));

    let attempts = 0;
    const maxAttempts = 60; // 60 attempts = ~60 seconds of polling
    const pollInterval = 1000; // 1 second between polls

    while (attempts < maxAttempts) {
      console.log(`[Enrichment] Polling attempt ${attempts + 1}/${maxAttempts}...`);

      const resultResponse = await fetch(initialResponse.enrichmentCallbackURL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SURFE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!resultResponse.ok) {
        console.error(`[Enrichment] Poll error: ${resultResponse.status}`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      const resultData = await resultResponse.json();
      console.log("[Enrichment] Poll response:", resultData);
      
      // Log the raw emails array to see its structure
      if (resultData.people?.[0]?.emails) {
        console.log("[Enrichment] Raw emails data:", JSON.stringify(resultData.people[0].emails, null, 2));
      }

      // Use safeParse to get better error messages
      const validationResult = surfeEnrichmentResultSchema.safeParse(resultData);
      
      if (!validationResult.success) {
        console.error("[Enrichment] Validation error:", validationResult.error.issues);
        // Continue without validation for now to extract data
      }
      
      const validatedResult = validationResult.success ? validationResult.data : resultData;

      // Extract person data - v2 API returns 'people' array
      const personData = validatedResult.people?.[0] || validatedResult.results?.[0] || validatedResult.person;
      
      // Extract all emails from the person data - handle various formats
      const emailsArray = personData?.emails || [];
      console.log("[Enrichment] Emails array type:", Array.isArray(emailsArray), "length:", emailsArray?.length);
      
      const emails = emailsArray
        .map((emailData: any) => {
          // Handle string format
          if (typeof emailData === 'string') {
            return emailData;
          }
          // Handle object format - try multiple possible field names
          if (typeof emailData === 'object' && emailData !== null) {
            return emailData.email || emailData.value || emailData.emailAddress;
          }
          return null;
        })
        .filter((email: any): email is string => typeof email === 'string' && email.length > 0);
      
      const status = personData?.status || validatedResult.status;

      console.log("[Enrichment] Extracted person data:", personData);
      console.log("[Enrichment] Extracted emails array:", emailsArray);
      console.log("[Enrichment] Parsed emails:", emails);
      console.log("[Enrichment] Status:", status);

      // If we have at least one email, return success
      if (emails.length > 0) {
        console.log("[Enrichment] Email(s) found successfully:", emails);
        return {
          success: true,
          data: {
            emails,
            status,
            creditsUsed: 1,
          },
        };
      }

      // If status is COMPLETED but no email, that means no email was found
      if (status === "COMPLETED") {
        console.log("[Enrichment] Enrichment completed but no email found");
        return {
          success: false,
          error: "No email found for this LinkedIn profile",
        };
      }

      // If still processing, continue polling
      console.log(`[Enrichment] Status: ${status}, emails: ${personData?.emails}, continuing to poll...`);
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // Max attempts reached (60 seconds)
    return {
      success: false,
      error: "Enrichment timeout after 60 seconds - please try again",
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Enrichment] Error revealing email:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Reveal a person's phone number using their LinkedIn URL via Surfe API v2
 * Uses the /v2/people/enrich endpoint (asynchronous with polling)
 * 
 * Process:
 * 1. Initiates enrichment request for mobile phones
 * 2. Polls callback URL for result (max 60 attempts, ~60 seconds)
 * 3. Returns all phone numbers when enrichment completes
 * 
 * @param linkedinUrl - The LinkedIn profile URL
 * @returns Phone enrichment data or error
 */
export async function revealPhone(
  linkedinUrl: string
): Promise<RevealPhoneResponse> {
  try {
    console.log("[Enrichment] Revealing phone for LinkedIn URL:", linkedinUrl);

    // Validate API key
    if (!SURFE_API_KEY) {
      throw new Error("SURFE_API_KEY is not set in environment variables");
    }

    // Validate input - check for null, undefined, or empty string
    if (!linkedinUrl || typeof linkedinUrl !== 'string' || linkedinUrl.trim() === '') {
      throw new Error("Valid LinkedIn URL is required");
    }

    // Validate input format
    const validatedInput = revealEmailSchema.parse({ linkedinUrl });

    // Make request to Surfe API v2 - requesting mobile phones
    const response = await fetch(SURFE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SURFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        include: {
          email: false,
          mobile: true, // Request phone numbers instead of emails
        },
        people: [
          {
            linkedinUrl: validatedInput.linkedinUrl,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Enrichment] Surfe API error:", errorData);
      throw new Error(`Surfe API error: ${response.status} - ${errorData}`);
    }

    const initialData = await response.json();
    console.log("[Enrichment] Surfe API v2 initial response (phone):", initialData);

    // Validate initial response
    const initialResponse = surfeInitialResponseSchema.parse(initialData);
    console.log("[Enrichment] Enrichment started, callback URL:", initialResponse.enrichmentCallbackURL);

    // Poll the callback URL to get the actual result
    await new Promise(resolve => setTimeout(resolve, 1500));

    let attempts = 0;
    const maxAttempts = 60;
    const pollInterval = 1000;

    while (attempts < maxAttempts) {
      console.log(`[Enrichment] Polling attempt ${attempts + 1}/${maxAttempts}...`);

      const resultResponse = await fetch(initialResponse.enrichmentCallbackURL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SURFE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!resultResponse.ok) {
        console.error(`[Enrichment] Poll error: ${resultResponse.status}`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      const resultData = await resultResponse.json();
      console.log("[Enrichment] Poll response (phone):", resultData);
      
      // Log the raw mobilePhones array to see its structure
      if (resultData.people?.[0]?.mobilePhones) {
        console.log("[Enrichment] Raw mobilePhones data:", JSON.stringify(resultData.people[0].mobilePhones, null, 2));
      }

      // Use safeParse to get better error messages
      const validationResult = surfeEnrichmentResultSchema.safeParse(resultData);
      
      if (!validationResult.success) {
        console.error("[Enrichment] Validation error:", validationResult.error.issues);
        // Continue without validation for now to extract data
      }
      
      const validatedResult = validationResult.success ? validationResult.data : resultData;

      // Extract person data
      const personData = validatedResult.people?.[0] || validatedResult.results?.[0] || validatedResult.person;
      
      // Extract all phone numbers from the person data - handle various formats
      const phonesArray = personData?.mobilePhones || [];
      console.log("[Enrichment] Phones array type:", Array.isArray(phonesArray), "length:", phonesArray?.length);
      
      const phones = phonesArray
        .map((phoneData: any) => {
          // Handle string format
          if (typeof phoneData === 'string') {
            return phoneData;
          }
          // Handle object format - try multiple possible field names
          if (typeof phoneData === 'object' && phoneData !== null) {
            return phoneData.number || phoneData.phoneNumber || phoneData.phone || phoneData.mobilePhone || phoneData.value;
          }
          return null;
        })
        .filter((phone: any): phone is string => typeof phone === 'string' && phone.length > 0);
      
      const status = personData?.status || validatedResult.status;

      console.log("[Enrichment] Extracted person data:", personData);
      console.log("[Enrichment] Extracted phones array:", phonesArray);
      console.log("[Enrichment] Parsed phones:", phones);
      console.log("[Enrichment] Status:", status);

      // If we have at least one phone, return success
      if (phones.length > 0) {
        console.log("[Enrichment] Phone(s) found successfully:", phones);
        return {
          success: true,
          data: {
            phones,
            status,
            creditsUsed: 2, // Phone typically costs more credits
          },
        };
      }

      // If status is COMPLETED but no phone, that means no phone was found
      if (status === "COMPLETED") {
        console.log("[Enrichment] Enrichment completed but no phone found");
        return {
          success: false,
          error: "No phone number found for this LinkedIn profile",
        };
      }

      // If still processing, continue polling
      console.log(`[Enrichment] Status: ${status}, phones: ${personData?.mobilePhones}, continuing to poll...`);
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // Max attempts reached
    return {
      success: false,
      error: "Enrichment timeout after 60 seconds - please try again",
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Enrichment] Error revealing phone:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Universal enrichment function that can reveal both email and phone
 * Uses the /v2/people/enrich endpoint (asynchronous with polling)
 * 
 * @param linkedinUrl - The LinkedIn profile URL
 * @param options - What to include in the enrichment (email, phone, or both)
 * @returns Enrichment data with both emails and phones arrays
 */
export async function enrichPerson(
  linkedinUrl: string,
  options: { includeEmail?: boolean; includePhone?: boolean } = { includeEmail: true, includePhone: false }
): Promise<EnrichmentResponse> {
  try {
    console.log("[Enrichment] Enriching person for LinkedIn URL:", linkedinUrl);
    console.log("[Enrichment] Options:", options);

    // Validate API key
    if (!SURFE_API_KEY) {
      throw new Error("SURFE_API_KEY is not set in environment variables");
    }

    // Validate input - check for null, undefined, or empty string
    if (!linkedinUrl || typeof linkedinUrl !== 'string' || linkedinUrl.trim() === '') {
      throw new Error("Valid LinkedIn URL is required");
    }

    // Validate input format
    const validatedInput = revealEmailSchema.parse({ linkedinUrl });

    // Default to including email if nothing is specified
    const includeEmail = options.includeEmail ?? true;
    const includePhone = options.includePhone ?? false;

    // Make request to Surfe API v2
    const response = await fetch(SURFE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SURFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        include: {
          email: includeEmail,
          mobile: includePhone,
        },
        people: [
          {
            linkedinUrl: validatedInput.linkedinUrl,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Enrichment] Surfe API error:", errorData);
      throw new Error(`Surfe API error: ${response.status} - ${errorData}`);
    }

    const initialData = await response.json();
    console.log("[Enrichment] Surfe API v2 initial response:", initialData);

    // Validate initial response
    const initialResponse = surfeInitialResponseSchema.parse(initialData);
    console.log("[Enrichment] Enrichment started, callback URL:", initialResponse.enrichmentCallbackURL);

    // Poll the callback URL to get the actual result
    await new Promise(resolve => setTimeout(resolve, 1500));

    let attempts = 0;
    const maxAttempts = 60;
    const pollInterval = 1000;

    while (attempts < maxAttempts) {
      console.log(`[Enrichment] Polling attempt ${attempts + 1}/${maxAttempts}...`);

      const resultResponse = await fetch(initialResponse.enrichmentCallbackURL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SURFE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!resultResponse.ok) {
        console.error(`[Enrichment] Poll error: ${resultResponse.status}`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      const resultData = await resultResponse.json();
      console.log("[Enrichment] Poll response:", resultData);
      
      // Log the raw data arrays to see their structure
      if (resultData.people?.[0]) {
        if (resultData.people[0].emails) {
          console.log("[Enrichment] Raw emails data:", JSON.stringify(resultData.people[0].emails, null, 2));
        }
        if (resultData.people[0].mobilePhones) {
          console.log("[Enrichment] Raw mobilePhones data:", JSON.stringify(resultData.people[0].mobilePhones, null, 2));
        }
      }

      // Use safeParse to get better error messages
      const validationResult = surfeEnrichmentResultSchema.safeParse(resultData);
      
      if (!validationResult.success) {
        console.error("[Enrichment] Validation error:", validationResult.error.issues);
        // Continue without validation for now to extract data
      }
      
      const validatedResult = validationResult.success ? validationResult.data : resultData;

      // Extract person data
      const personData = validatedResult.people?.[0] || validatedResult.results?.[0] || validatedResult.person;
      
      // Extract emails
      const emailsArray = personData?.emails || [];
      const emails = emailsArray
        .map((emailData: any) => {
          if (typeof emailData === 'string') return emailData;
          if (typeof emailData === 'object' && emailData !== null) {
            return emailData.email || emailData.value || emailData.emailAddress;
          }
          return null;
        })
        .filter((email: any): email is string => typeof email === 'string' && email.length > 0);
      
      // Extract phones
      const phonesArray = personData?.mobilePhones || [];
      const phones = phonesArray
        .map((phoneData: any) => {
          if (typeof phoneData === 'string') return phoneData;
          if (typeof phoneData === 'object' && phoneData !== null) {
            return phoneData.number || phoneData.phoneNumber || phoneData.phone || phoneData.mobilePhone || phoneData.value;
          }
          return null;
        })
        .filter((phone: any): phone is string => typeof phone === 'string' && phone.length > 0);
      
      const status = personData?.status || validatedResult.status;

      console.log("[Enrichment] Extracted emails:", emails);
      console.log("[Enrichment] Extracted phones:", phones);
      console.log("[Enrichment] Status:", status);

      // Calculate credits used (phone typically costs more)
      let creditsUsed = 0;
      if (includeEmail && emails.length > 0) creditsUsed += 1;
      if (includePhone && phones.length > 0) creditsUsed += 2;

      // If we have data for what was requested, return success
      const hasRequestedData = 
        (!includeEmail || emails.length > 0) && 
        (!includePhone || phones.length > 0);

      if (status === "COMPLETED" && hasRequestedData) {
        console.log("[Enrichment] Enrichment completed successfully");
        return {
          success: true,
          data: {
            emails,
            phones,
            status,
            creditsUsed,
          },
        };
      }

      // If status is COMPLETED but missing requested data
      if (status === "COMPLETED") {
        const missingData = [];
        if (includeEmail && emails.length === 0) missingData.push("email");
        if (includePhone && phones.length === 0) missingData.push("phone");
        
        console.log("[Enrichment] Enrichment completed but data not found:", missingData);
        return {
          success: false,
          error: `No ${missingData.join(" or ")} found for this LinkedIn profile`,
        };
      }

      // If still processing, continue polling
      console.log(`[Enrichment] Status: ${status}, continuing to poll...`);
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // Max attempts reached
    return {
      success: false,
      error: "Enrichment timeout after 60 seconds - please try again",
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Enrichment] Error enriching person:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch reveal emails for multiple LinkedIn URLs
 * @param linkedinUrls - Array of LinkedIn profile URLs
 * @returns Array of email enrichment results
 */
export async function revealEmailsBatch(
  linkedinUrls: string[]
): Promise<{
  success: boolean;
  data?: Array<{ linkedinUrl: string; emails?: string[]; error?: string }>;
  error?: string;
}> {
  try {
    console.log("[Enrichment] Batch revealing emails for", linkedinUrls.length, "profiles");

    if (!SURFE_API_KEY) {
      throw new Error("SURFE_API_KEY is not set in environment variables");
    }

    // Process all URLs in parallel
    const results = await Promise.all(
      linkedinUrls.map(async (linkedinUrl) => {
        const result = await revealEmail(linkedinUrl);
        return {
          linkedinUrl,
          emails: result.data?.emails,
          error: result.error,
        };
      })
    );

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("[Enrichment] Error in batch email reveal:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

