import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { EmailLogo, EmailSignature, emailStyles } from "../shared";

export type AccountDeletedEmailProps = {
  userNameOrEmail: string;
};

export function AccountDeletedEmail({ userNameOrEmail }: AccountDeletedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Account deleted</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Account deleted</Heading>
          <Text style={emailStyles.text}>Hi {userNameOrEmail},</Text>
          <Text style={emailStyles.text}>
            This confirms that your Heyhire account was deleted. If you did not request this change, please contact
            support.
          </Text>
          <EmailSignature />
        </Container>
      </Body>
    </Html>
  );
}

export default AccountDeletedEmail;
