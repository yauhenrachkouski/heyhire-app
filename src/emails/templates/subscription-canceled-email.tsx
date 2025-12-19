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

export type SubscriptionCanceledEmailProps = {
  organizationName: string;
  ctaUrl?: string;
};

export function SubscriptionCanceledEmail({ organizationName, ctaUrl }: SubscriptionCanceledEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Subscription canceled for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Subscription canceled</Heading>
          <Text style={emailStyles.text}>
            Your subscription for <strong>{organizationName}</strong> has been canceled. You can reactivate anytime.
          </Text>
          <Button href={url} style={emailStyles.button}>
            Review billing
          </Button>
          <EmailSignature />
        </Container>
      </Body>
    </Html>
  );
}

export default SubscriptionCanceledEmail;
