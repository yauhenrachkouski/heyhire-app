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

export type InvitationEmailProps = {
  inviterNameOrEmail: string;
  organizationName: string;
  inviteLink: string;
  invitationExpiresInSeconds: number;
};

export function InvitationEmail({
  inviterNameOrEmail,
  organizationName,
  inviteLink,
  invitationExpiresInSeconds,
}: InvitationEmailProps) {
  const invitationExpiresInHours = Math.round(invitationExpiresInSeconds / 3600);
  return (
    <Html>
      <Head />
      <Preview>{`You’ve been invited to join ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>You&apos;ve been invited!</Heading>
          <Text style={emailStyles.text}>
            {inviterNameOrEmail} has invited you to join <strong>{organizationName}</strong> on
            Heyhire.
          </Text>
          <Button href={inviteLink} style={emailStyles.button}>
            Accept Invitation
          </Button>
          <Text style={emailStyles.text}>{`This invitation will expire in ${invitationExpiresInHours} hours.`}</Text>
          <Text style={emailStyles.text}>
            If you didn&apos;t expect this invitation, you can safely ignore this email.
          </Text>
          <EmailSignature />
        </Container>
      </Body>
    </Html>
  );
}

export default InvitationEmail;
