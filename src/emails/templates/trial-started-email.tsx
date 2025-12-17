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
import { EmailLogo, emailStyles } from "../shared";

export type TrialStartedEmailProps = {
  organizationName: string;
  trialEndsAtLabel: string;
  ctaUrl?: string;
};

export function TrialStartedEmail({ organizationName, trialEndsAtLabel, ctaUrl }: TrialStartedEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Trial started for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Trial started</Heading>
          <Text style={emailStyles.text}>
            Your trial for <strong>{organizationName}</strong> has started. It will end on <strong>{trialEndsAtLabel}</strong>.
          </Text>
          <Button href={url} style={emailStyles.button}>
            Manage billing
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
