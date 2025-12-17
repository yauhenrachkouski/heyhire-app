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

export type SubscriptionPlanChangedEmailProps = {
  organizationName: string;
  previousPlanName: string;
  newPlanName: string;
  effectiveAtLabel?: string;
  ctaUrl?: string;
};

export function SubscriptionPlanChangedEmail({
  organizationName,
  previousPlanName,
  newPlanName,
  effectiveAtLabel,
  ctaUrl,
}: SubscriptionPlanChangedEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Plan updated for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Plan updated</Heading>
          <Text style={emailStyles.text}>
            Your workspace <strong>{organizationName}</strong> plan changed from <strong>{previousPlanName}</strong> to
            <strong> {newPlanName}</strong>.
          </Text>
          {effectiveAtLabel ? (
            <Text style={emailStyles.text}>{`Effective: ${effectiveAtLabel}`}</Text>
          ) : null}
          <Button href={url} style={emailStyles.button}>
            Manage billing
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
