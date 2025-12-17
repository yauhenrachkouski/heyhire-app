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

export type MagicLinkEmailProps = {
  url: string;
};

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to Heyhire</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <EmailLogo />
          <Heading style={emailStyles.heading}>Welcome to Heyhire!</Heading>
          <Text style={emailStyles.text}>Click the link below to sign in to your account:</Text>
          <Button href={url} style={emailStyles.button}>
            Sign In to Heyhire
          </Button>
          <Text style={emailStyles.text}>This link will expire in 5 minutes.</Text>
          <Text style={emailStyles.text}>
            If you didn&apos;t request this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
