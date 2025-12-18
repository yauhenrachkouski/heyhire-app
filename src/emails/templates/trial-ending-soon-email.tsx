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

export type TrialEndingSoonEmailProps = {
  organizationName: string;
  trialEndsAtLabel: string;
  ctaUrl?: string;
};

export function TrialEndingSoonEmail({ organizationName, trialEndsAtLabel, ctaUrl }: TrialEndingSoonEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Trial ending soon for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Your trial is ending soon</Heading>
          <Text style={emailStyles.text}>
            Your trial for <strong>{organizationName}</strong> will end on <strong>{trialEndsAtLabel}</strong>.
          </Text>
          <Text style={emailStyles.text}>
            To avoid interruption, please make sure your payment method is up to date.
          </Text>
          <Button href={url} style={emailStyles.button}>
            Manage billing
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
