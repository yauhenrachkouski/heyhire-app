import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { EmailLogo, EmailSignature, emailStyles } from "../shared";

export type CreditsRunningLowEmailProps = {
  organizationName: string;
  creditsRemaining: number;
  threshold: number;
  ctaUrl?: string;
};

export function CreditsRunningLowEmail({
  organizationName,
  creditsRemaining,
  threshold,
  ctaUrl,
}: CreditsRunningLowEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Credits running low for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Credits running low</Heading>
          <Text style={emailStyles.text}>
            Your workspace <strong>{organizationName}</strong> has <strong>{creditsRemaining}</strong> credits remaining.
          </Text>
          <Text style={emailStyles.text}>{`This alert triggers when your balance drops to ${threshold} or below.`}</Text>
          <Button href={url} style={emailStyles.button}>
            Review billing
          </Button>
          <EmailSignature />
        </Container>
      </Body>
    </Html>
  );
}

export default CreditsRunningLowEmail;
