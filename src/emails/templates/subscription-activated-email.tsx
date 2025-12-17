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

export type SubscriptionActivatedEmailProps = {
  organizationName: string;
  planName: string;
  ctaUrl?: string;
};

export function SubscriptionActivatedEmail({ organizationName, planName, ctaUrl }: SubscriptionActivatedEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Subscription active for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Subscription active</Heading>
          <Text style={emailStyles.text}>
            Your <strong>{organizationName}</strong> subscription is now active on the <strong>{planName}</strong> plan.
          </Text>
          <Button href={url} style={emailStyles.button}>
            Manage billing
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
