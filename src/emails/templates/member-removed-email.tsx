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

export type MemberRemovedEmailProps = {
  removedUserNameOrEmail: string;
  organizationName: string;
  removedByNameOrEmail: string;
  ctaUrl?: string;
};

export function MemberRemovedEmail({
  removedUserNameOrEmail,
  organizationName,
  removedByNameOrEmail,
  ctaUrl,
}: MemberRemovedEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = ctaUrl || `${appUrl}/auth/signin`;

  return (
    <Html>
      <Head />
      <Preview>{`You were removed from ${organizationName}`}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Access removed</Heading>
          <Text style={emailStyles.text}>Hi {removedUserNameOrEmail},</Text>
          <Text style={emailStyles.text}>
            <strong>{removedByNameOrEmail}</strong> removed you from <strong>{organizationName}</strong> on
            Heyhire.
          </Text>
          <Text style={emailStyles.text}>
            If you believe this was a mistake, please contact your workspace owner or admin.
          </Text>
          <Button href={url} style={emailStyles.button}>
            Sign in
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
