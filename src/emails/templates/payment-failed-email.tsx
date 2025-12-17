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

export type PaymentFailedEmailProps = {
  organizationName: string;
  ctaUrl?: string;
};

export function PaymentFailedEmail({ organizationName, ctaUrl }: PaymentFailedEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/billing`;

  return (
    <Html>
      <Head />
      <Preview>{`Payment failed for ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Payment failed</Heading>
          <Text style={emailStyles.text}>
            We couldn&apos;t process the latest payment for <strong>{organizationName}</strong>. Please update your payment method
            to avoid any interruption.
          </Text>
          <Button href={url} style={emailStyles.button}>
            Update payment method
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
