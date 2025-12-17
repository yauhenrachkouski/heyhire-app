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

export type InvitationAcceptedEmailProps = {
  inviterNameOrEmail: string;
  invitedNameOrEmail: string;
  organizationName: string;
  ctaUrl?: string;
};

export function InvitationAcceptedEmail({
  inviterNameOrEmail,
  invitedNameOrEmail,
  organizationName,
  ctaUrl,
}: InvitationAcceptedEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/members`;

  return (
    <Html>
      <Head />
      <Preview>{`${invitedNameOrEmail} joined ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Invitation accepted</Heading>
          <Text style={emailStyles.text}>Hi {inviterNameOrEmail},</Text>
          <Text style={emailStyles.text}>
            <strong>{invitedNameOrEmail}</strong> has accepted your invitation and joined{" "}
            <strong>{organizationName}</strong>.
          </Text>
          <Button href={url} style={emailStyles.button}>
            View team
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
