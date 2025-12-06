import { ParsedQuery } from "@/types/search";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SearchInterpretationProps {
  parsedQuery: ParsedQuery;
  className?: string;
  action?: ReactNode;
}

function formatNaturalList(field: string | { values: string[]; operator: string } | undefined): string {
  if (!field) return "";
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && 'values' in field) {
    const { values, operator } = field;
    if (values.length === 0) return "";
    const op = operator === "OR" ? " or " : " and ";
    
    // Handle array of strings properly
    return values.map(v => v.trim()).filter(Boolean).join(op);
  }
  return "";
}

export function SearchInterpretation({ parsedQuery, className, action }: SearchInterpretationProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-4 min-h-[32px]">
        <h3 className="text-sm font-semibold text-foreground">
          How we understand your search:
        </h3>
        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>
      
      <div className="bg-muted/50 rounded-lg border border-border/50 p-4">
        <p className="text-sm leading-relaxed text-foreground/80">
          <span className="text-muted-foreground">Looking for </span>
          <span className="font-semibold text-foreground">
            {formatNaturalList(parsedQuery.job_title) || "candidates"}
          </span>

          {parsedQuery.is_current && (
            <span className="text-muted-foreground"> (currently in this role)</span>
          )}

          {parsedQuery.location && (
            <>
              <span className="text-muted-foreground"> based in </span>
              <span className="font-semibold text-foreground">{formatNaturalList(parsedQuery.location)}</span>
            </>
          )}

          {parsedQuery.remote_preference && (
            <>
              <span className="text-muted-foreground"> working </span>
              <span className="font-semibold text-foreground">{parsedQuery.remote_preference}</span>
            </>
          )}

          {(parsedQuery.skills || parsedQuery.web_technologies) && (
            <>
              <span className="text-muted-foreground"> with expertise in </span>
              <span className="font-semibold text-foreground">
                {[
                  formatNaturalList(parsedQuery.skills),
                  formatNaturalList(parsedQuery.web_technologies)
                ].filter(Boolean).join(", ")}
              </span>
            </>
          )}

          {parsedQuery.years_of_experience && (
            <>
              <span className="text-muted-foreground"> with </span>
              <span className="font-semibold text-foreground">{formatNaturalList(parsedQuery.years_of_experience)}</span>
              <span className="text-muted-foreground"> of experience</span>
            </>
          )}

          {parsedQuery.industry && (
            <>
              <span className="text-muted-foreground"> in the </span>
              <span className="font-semibold text-foreground">{formatNaturalList(parsedQuery.industry)}</span>
              <span className="text-muted-foreground"> industry</span>
            </>
          )}

          {parsedQuery.company && (
            <>
              <span className="text-muted-foreground"> from </span>
              <span className="font-semibold text-foreground">{formatNaturalList(parsedQuery.company)}</span>
            </>
          )}

          {(parsedQuery.company_size || parsedQuery.revenue_range || parsedQuery.funding_types) && (
            <>
              <span className="text-muted-foreground"> (companies: </span>
              <span className="italic text-foreground/90">
                {[
                  formatNaturalList(parsedQuery.company_size) && `Size: ${formatNaturalList(parsedQuery.company_size)}`,
                  formatNaturalList(parsedQuery.revenue_range) && `Rev: ${formatNaturalList(parsedQuery.revenue_range)}`,
                  formatNaturalList(parsedQuery.funding_types) && `Funding: ${formatNaturalList(parsedQuery.funding_types)}`
                ].filter(Boolean).join(", ")}
              </span>
              <span className="text-muted-foreground">)</span>
            </>
          )}

          {parsedQuery.education && (
            <>
              <span className="text-muted-foreground"> with education from </span>
              <span className="font-semibold text-foreground">{formatNaturalList(parsedQuery.education)}</span>
            </>
          )}

          <span className="text-muted-foreground">.</span>
        </p>
      </div>
    </div>
  );
}
