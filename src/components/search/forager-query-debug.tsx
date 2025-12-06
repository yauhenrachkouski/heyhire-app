"use client";

import { useState, useEffect } from "react";
import { buildForagerPayloadForDebug } from "@/actions/search";
import type { ParsedQuery } from "@/types/search";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ForagerQueryDebugProps {
  parsedQuery: ParsedQuery;
}

export function ForagerQueryDebug({ parsedQuery }: ForagerQueryDebugProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [foragerData, setForagerData] = useState<{
    foragerIds: any;
    foragerPayload: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Load Forager data when opened
  useEffect(() => {
    if (isOpen && !foragerData && !isLoading) {
      loadForagerData();
    }
  }, [isOpen]);

  const loadForagerData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await buildForagerPayloadForDebug(parsedQuery);

      if (result.success && result.data) {
        setForagerData(result.data);
      } else {
        setError(result.error || "Failed to build Forager payload");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Only show in development or if NODE_ENV is not production
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between hover:bg-yellow-100/50 dark:hover:bg-yellow-900/30"
            >
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <CardTitle className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  🐛 Debug: Forager Query
                </CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="text-sm text-muted-foreground">
                Loading Forager data...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                Error: {error}
              </div>
            )}

            {foragerData && (
              <div className="space-y-4">
                {/* Resolved IDs Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">
                      Resolved Forager IDs
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(foragerData.foragerIds, null, 2),
                          "ids"
                        )
                      }
                    >
                      {copiedSection === "ids" ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code>{JSON.stringify(foragerData.foragerIds, null, 2)}</code>
                  </pre>
                </div>

                {/* Forager API Payload Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">
                      Forager API Payload
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(foragerData.foragerPayload, null, 2),
                          "payload"
                        )
                      }
                    >
                      {copiedSection === "payload" ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code>
                      {JSON.stringify(foragerData.foragerPayload, null, 2)}
                    </code>
                  </pre>
                </div>

                {/* cURL Command Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">
                      cURL Command
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const curl = `curl -i -X POST \\
  'https://api-v2.forager.ai/api/YOUR_ACCOUNT_ID/datastorage/person_role_search/' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-KEY: YOUR_API_KEY' \\
  -d '${JSON.stringify(foragerData.foragerPayload)}'`;
                        copyToClipboard(curl, "curl");
                      }}
                    >
                      {copiedSection === "curl" ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code>
                      {`curl -i -X POST \\
  'https://api-v2.forager.ai/api/YOUR_ACCOUNT_ID/datastorage/person_role_search/' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-KEY: YOUR_API_KEY' \\
  -d '${JSON.stringify(foragerData.foragerPayload)}'`}
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}




