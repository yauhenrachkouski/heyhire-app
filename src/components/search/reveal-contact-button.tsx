"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import {
  IconLoader2,
  IconMail,
  IconPhone,
  IconCoin,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRevealContact } from "@/hooks/use-reveal-contact";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RevealContactButtonProps = {
  candidateId: string;
  searchCandidateId?: string;
  isContactRevealed?: boolean;
  revealedEmail?: string | null;
  revealedPhone?: string | null;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  fullWidth?: boolean;
  onClick?: ComponentProps<typeof Button>["onClick"];
};

export function RevealContactButton({
  candidateId,
  searchCandidateId,
  isContactRevealed: initialRevealed,
  revealedEmail: initialEmail,
  revealedPhone: initialPhone,
  className,
  size = "sm",
  variant,
  fullWidth = true,
  onClick,
}: RevealContactButtonProps) {
  const { revealContact, isLoading } = useRevealContact();
  const [revealed, setRevealed] = useState(Boolean(initialRevealed));
  const [email, setEmail] = useState<string | null>(initialEmail ?? null);
  const [phone, setPhone] = useState<string | null>(initialPhone ?? null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setRevealed(Boolean(initialRevealed));
    setEmail(initialEmail ?? null);
    setPhone(initialPhone ?? null);
  }, [initialRevealed, initialEmail, initialPhone]);

  const hasContact = email || phone;
  const resolvedVariant = variant ?? (revealed && hasContact ? "outline" : "default");

  const handleReveal = async (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);

    // If already revealed, just show the popover
    if (revealed && hasContact) {
      setPopoverOpen(true);
      return;
    }

    const result = await revealContact({
      candidateId,
      searchCandidateId,
      type: "both",
    });

    if (result?.success) {
      setRevealed(true);
      setEmail(result.email ?? null);
      setPhone(result.phone ?? null);
      if (result.email || result.phone) {
        setPopoverOpen(true);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // If revealed and has contact, show popover button
  if (revealed && hasContact) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size={size}
            variant={resolvedVariant}
            type="button"
            className={cn("font-medium", fullWidth && "w-full", className)}
            onClick={handleReveal}
            disabled={isLoading}
          >
            {isLoading ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconCheck className="h-4 w-4" />
            )}
            <span>Contact</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Contact Info</p>
            {email && (
              <div className="flex items-center gap-2">
                <IconMail className="h-4 w-4 text-muted-foreground shrink-0" />
                <button
                  className="text-sm text-left truncate hover:underline focus:outline-none"
                  onClick={() => copyToClipboard(email)}
                  title="Click to copy"
                >
                  {email}
                </button>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2">
                <IconPhone className="h-4 w-4 text-muted-foreground shrink-0" />
                <button
                  className="text-sm text-left truncate hover:underline focus:outline-none"
                  onClick={() => copyToClipboard(phone)}
                  title="Click to copy"
                >
                  {phone}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Click to copy</p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Not revealed or no contact - show reveal button
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={resolvedVariant}
            type="button"
            className={cn("font-medium", fullWidth && "w-full", className)}
            onClick={handleReveal}
            disabled={isLoading}
          >
            {isLoading ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : revealed ? (
              <IconMail className="h-4 w-4" />
            ) : (
              <IconCoin className="h-4 w-4" />
            )}
            <span>{revealed ? "No contact" : "Get Contact"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading
            ? "Searching..."
            : revealed
              ? "No contact info found"
              : "1 credit for email, 10 for phone"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Separate Email Button (1 credit)
type RevealEmailButtonProps = {
  candidateId: string;
  searchCandidateId?: string;
  revealedEmail?: string | null;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  fullWidth?: boolean;
};

export function RevealEmailButton({
  candidateId,
  searchCandidateId,
  revealedEmail: initialEmail,
  className,
  size = "sm",
  variant,
  fullWidth = true,
}: RevealEmailButtonProps) {
  const { revealContact, isLoading } = useRevealContact();
  const [email, setEmail] = useState<string | null>(initialEmail ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEmail(initialEmail ?? null);
  }, [initialEmail]);

  const resolvedVariant = variant ?? (email ? "outline" : "default");

  const handleReveal = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    // If already revealed, copy to clipboard
    if (email) {
      navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const result = await revealContact({
      candidateId,
      searchCandidateId,
      type: "email",
    });

    if (result?.success && result.email) {
      setEmail(result.email);
    }
  };

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <IconLoader2 className="h-4 w-4 animate-spin" />
          <span>Finding...</span>
        </>
      );
    }

    if (email) {
      return (
        <>
          {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
          <span className="truncate max-w-[120px]">{email}</span>
        </>
      );
    }

    return (
      <>
        <IconMail className="h-4 w-4" />
        <span>Get Email</span>
      </>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={resolvedVariant}
            type="button"
            className={cn("font-medium", fullWidth && "w-full", className)}
            onClick={handleReveal}
            disabled={isLoading}
          >
            {getButtonContent()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading
            ? "Searching..."
            : email
              ? "Click to copy"
              : "1 credit"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Separate Phone Button (10 credits)
type RevealPhoneButtonProps = {
  candidateId: string;
  searchCandidateId?: string;
  revealedPhone?: string | null;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  fullWidth?: boolean;
};

export function RevealPhoneButton({
  candidateId,
  searchCandidateId,
  revealedPhone: initialPhone,
  className,
  size = "sm",
  variant,
  fullWidth = true,
}: RevealPhoneButtonProps) {
  const { revealContact, isLoading } = useRevealContact();
  const [phone, setPhone] = useState<string | null>(initialPhone ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPhone(initialPhone ?? null);
  }, [initialPhone]);

  const resolvedVariant = variant ?? (phone ? "outline" : "default");

  const handleReveal = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    // If already revealed, copy to clipboard
    if (phone) {
      navigator.clipboard.writeText(phone);
      setCopied(true);
      toast.success("Phone copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const result = await revealContact({
      candidateId,
      searchCandidateId,
      type: "phone",
    });

    if (result?.success && result.phone) {
      setPhone(result.phone);
    }
  };

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <IconLoader2 className="h-4 w-4 animate-spin" />
          <span>Finding...</span>
        </>
      );
    }

    if (phone) {
      return (
        <>
          {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
          <span className="truncate max-w-[120px]">{phone}</span>
        </>
      );
    }

    return (
      <>
        <IconPhone className="h-4 w-4" />
        <span>Get Phone</span>
      </>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={resolvedVariant}
            type="button"
            className={cn("font-medium", fullWidth && "w-full", className)}
            onClick={handleReveal}
            disabled={isLoading}
          >
            {getButtonContent()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading
            ? "Searching..."
            : phone
              ? "Click to copy"
              : "10 credits"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
