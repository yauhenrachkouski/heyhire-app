"use client";

import { Mail, Phone, Plus, Eye, Loader2, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PeopleSearchResult } from "@/types/search";
import { BRANDFETCH_LINKEDIN_LOGO_URL } from "@/lib/constants";
import { enrichPerson } from "@/actions/enrichment";
import { toast } from "sonner";

interface CandidateCardProps {
  candidate: PeopleSearchResult;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAddToOutreach?: () => void;
  onShowCandidate?: (candidate?: PeopleSearchResult) => void;
}

export function CandidateCard({
  candidate,
  isSelected = false,
  onSelect = () => {},
  onAddToOutreach = () => {},
  onShowCandidate = () => {},
}: CandidateCardProps) {
  const [revealedEmails, setRevealedEmails] = useState<string[]>([]);
  const [isRevealingEmail, setIsRevealingEmail] = useState(false);
  const [revealedPhones, setRevealedPhones] = useState<string[]>([]);
  const [isRevealingPhone, setIsRevealingPhone] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState(false);

  const firstName = candidate.person?.first_name || "";
  const lastName = candidate.person?.last_name || "";
  const currentRole = candidate.role_title || "----";
  const skills = candidate.person?.skills || [];
  const photo = candidate.person?.photo || null;
  const email = candidate.person?.email || null;
  const phone = candidate.person?.phone || null;
  const organizationName = candidate.organization?.name || "";
  const organizationLogo = candidate.organization?.logo;
  const linkedInPersonUrl = candidate.person?.linkedin_info?.public_profile_url;
  const linkedInOrgUrl = candidate.organization?.linkedin_info?.public_profile_url;

  // Generate initials for fallback avatar
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleOpenLinkedIn = () => {
    if (linkedInPersonUrl) {
      window.open(linkedInPersonUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleRevealEmail = async () => {
    if (!linkedInPersonUrl || typeof linkedInPersonUrl !== 'string' || linkedInPersonUrl.trim() === '') {
      toast.error("LinkedIn URL not available");
      return;
    }

    if (revealedEmails.length > 0) {
      // Already revealed, copy all emails to clipboard
      const emailsText = revealedEmails.join(', ');
      try {
        await navigator.clipboard.writeText(emailsText);
        toast.success(`${revealedEmails.length > 1 ? 'Emails' : 'Email'} copied to clipboard`);
      } catch (error) {
        toast.error("Failed to copy to clipboard");
      }
      return;
    }

    setIsRevealingEmail(true);

    try {
      const result = await enrichPerson(linkedInPersonUrl, { includeEmail: true, includePhone: false });

      if (result.success && result.data) {
        const emails = result.data.emails;
        
        if (emails && emails.length > 0) {
          setRevealedEmails(emails);
          const emailCount = emails.length;
          toast.success(
            `${emailCount} email${emailCount > 1 ? 's' : ''} revealed - Credits used: ${result.data.creditsUsed || 1}`
          );
        } else {
          toast.error("No emails found");
        }
      } else {
        toast.error(result.error || "Failed to reveal email");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reveal email");
    } finally {
      setIsRevealingEmail(false);
    }
  };

  const handleRevealPhone = async () => {
    if (!linkedInPersonUrl || typeof linkedInPersonUrl !== 'string' || linkedInPersonUrl.trim() === '') {
      toast.error("LinkedIn URL not available");
      return;
    }

    if (revealedPhones.length > 0) {
      // Already revealed, copy all phones to clipboard
      const phonesText = revealedPhones.join(', ');
      try {
        await navigator.clipboard.writeText(phonesText);
        toast.success(`${revealedPhones.length > 1 ? 'Phone numbers' : 'Phone number'} copied to clipboard`);
      } catch (error) {
        toast.error("Failed to copy to clipboard");
      }
      return;
    }

    setIsRevealingPhone(true);

    try {
      const result = await enrichPerson(linkedInPersonUrl, { includeEmail: false, includePhone: true });

      if (result.success && result.data) {
        const phones = result.data.phones;
        
        if (phones && phones.length > 0) {
          setRevealedPhones(phones);
          const phoneCount = phones.length;
          toast.success(
            `${phoneCount} phone number${phoneCount > 1 ? 's' : ''} revealed - Credits used: ${result.data.creditsUsed || 2}`
          );
        } else {
          toast.error("No phone numbers found");
        }
      } else {
        toast.error(result.error || "Failed to reveal phone");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reveal phone");
    } finally {
      setIsRevealingPhone(false);
    }
  };

  const handleRevealBoth = async () => {
    if (!linkedInPersonUrl || typeof linkedInPersonUrl !== 'string' || linkedInPersonUrl.trim() === '') {
      toast.error("LinkedIn URL not available");
      return;
    }

    if (revealedEmails.length > 0 && revealedPhones.length > 0) {
      // Already revealed both, copy all to clipboard
      const allData = [...revealedEmails, ...revealedPhones].join(', ');
      try {
        await navigator.clipboard.writeText(allData);
        toast.success('Email and phone copied to clipboard');
      } catch (error) {
        toast.error("Failed to copy to clipboard");
      }
      return;
    }

    setIsRevealingEmail(true);
    setIsRevealingPhone(true);

    try {
      const result = await enrichPerson(linkedInPersonUrl, { includeEmail: true, includePhone: true });

      if (result.success && result.data) {
        const emails = result.data.emails;
        const phones = result.data.phones;
        
        if (emails && emails.length > 0) {
          setRevealedEmails(emails);
        }
        
        if (phones && phones.length > 0) {
          setRevealedPhones(phones);
        }

        if ((emails && emails.length > 0) || (phones && phones.length > 0)) {
          const parts = [];
          if (emails && emails.length > 0) {
            parts.push(`${emails.length} email${emails.length > 1 ? 's' : ''}`);
          }
          if (phones && phones.length > 0) {
            parts.push(`${phones.length} phone${phones.length > 1 ? 's' : ''}`);
          }
          toast.success(
            `${parts.join(' and ')} revealed - Credits used: ${result.data.creditsUsed || 3}`
          );
        } else {
          toast.error("No contact information found");
        }
      } else {
        toast.error(result.error || "Failed to reveal contact information");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reveal contact information");
    } finally {
      setIsRevealingEmail(false);
      setIsRevealingPhone(false);
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-start justify-between gap-4 rounded-lg border p-4 transition-all ${
        isSelected 
          ? "ring-2 ring-blue-100" 
          : "bg-card hover:bg-accent/50"
      }`}>
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className={`mt-1 transition-transform ${isSelected ? "scale-110" : ""}`}
            aria-label={`Select ${firstName} ${lastName}`}
          />
        </div>

        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar className="h-12 w-12">
            {photo && <AvatarImage src={photo} alt={`${firstName} ${lastName}`} />}
            <AvatarFallback className="font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Left section: Candidate info */}
        <div className="flex-1 min-w-0">
          {/* Name - plain text, no links */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-foreground truncate">
              {firstName}
            </span>
            <span className="font-semibold text-foreground truncate">{lastName}</span>
          </div>

          {/* Current role with organization instead of headline */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">{currentRole}</span>
              {organizationName && (
                <>
                  <span className="text-sm text-muted-foreground">at</span>
                  <div className="flex items-center gap-1">
                    {organizationLogo && (
                      <Image
                        src={organizationLogo}
                        alt={organizationName}
                        width={16}
                        height={16}
                        className="rounded object-cover flex-shrink-0"
                      />
                    )}
                    {linkedInOrgUrl ? (
                      <Link
                        href={linkedInOrgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline truncate"
                      >
                        {organizationName}
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground truncate">
                        {organizationName}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Skills */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-muted-foreground">Skills:</p>
            {skills.length > 0 ? (
              <>
                {skills.slice(0, 5).map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {typeof skill === "string" ? skill : skill?.name || ""}
                  </Badge>
                ))}
                {skills.length > 5 && !expandedSkills && (
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setExpandedSkills(true)}
                  >
                    {`+${skills.length - 5} more`}
                  </Badge>
                )}
                {expandedSkills && skills.length > 5 && 
                  skills.slice(5).map((skill, idx) => (
                    <Badge key={`expanded-${idx}`} variant="secondary" className="text-xs">
                      {typeof skill === "string" ? skill : skill?.name || ""}
                    </Badge>
                  ))
                }
              </>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>

          {/* Email and Phone */}
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            {/* Email Section */}
            {revealedEmails.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRevealEmail}
                    className="flex items-center gap-2 flex-wrap cursor-pointer hover:opacity-80 transition-opacity group"
                  >
                    <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex flex-wrap gap-2">
                      {revealedEmails.map((email, idx) => (
                        <span key={idx} className="text-sm text-foreground">
                          {email}
                          {idx < revealedEmails.length - 1 && ','}
                        </span>
                      ))}
                    </div>
                    <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Click to copy to clipboard</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevealEmail}
                    disabled={isRevealingEmail}
                    className="h-8"
                  >
                    {isRevealingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Revealing...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        email (1 credit)
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {isRevealingEmail
                      ? "Revealing email..."
                      : "Click to reveal email"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Phone Section */}
            {revealedPhones.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRevealPhone}
                    className="flex items-center gap-2 flex-wrap cursor-pointer hover:opacity-80 transition-opacity group"
                  >
                    <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex flex-wrap gap-2">
                      {revealedPhones.map((phoneNum, idx) => (
                        <span key={idx} className="text-sm text-foreground">
                          {phoneNum}
                          {idx < revealedPhones.length - 1 && ','}
                        </span>
                      ))}
                    </div>
                    <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Click to copy to clipboard</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevealPhone}
                    disabled={isRevealingPhone}
                    className="h-8"
                  >
                    {isRevealingPhone ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Revealing...
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4" />
                        phone (2 credits)
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {isRevealingPhone
                      ? "Revealing phone..."
                      : "Click to reveal phone"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Right section: Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {linkedInPersonUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleOpenLinkedIn}
                  className="h-8 w-8"
                >
                  <Image
                    src={BRANDFETCH_LINKEDIN_LOGO_URL}
                    alt="LinkedIn"
                    width={16}
                    height={16}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Open LinkedIn profile</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onAddToOutreach}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Add to outreach sequence</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onShowCandidate(candidate)}
                className="h-8 w-8"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Show candidate details</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
