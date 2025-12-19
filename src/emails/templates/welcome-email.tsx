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

export type WelcomeEmailProps = {
  userNameOrEmail: string;
  organizationName: string;
  ctaUrl?: string;
};

export function WelcomeEmail({ userNameOrEmail, organizationName, ctaUrl }: WelcomeEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/paywall`;

  return (
    <Html>
      <Head />
      <Preview>{`Welcome to Heyhire — ${organizationName} is ready`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Welcome to Heyhire!</Heading>
          <Text style={emailStyles.text}>
            Hi {userNameOrEmail}, your workspace <strong>{organizationName}</strong> has been created.
          </Text>
          <Text style={emailStyles.text}>You can now start searching and saving candidates.</Text>
          <Button href={url} style={emailStyles.button}>
            Continue
          </Button>
          <EmailSignature />
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
