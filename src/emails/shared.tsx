import * as React from "react";
import { Img } from "@react-email/components";

export const emailStyles = {
  body: {
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#ffffff",
    margin: 0,
    padding: "24px 0",
  } satisfies React.CSSProperties,
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "0 16px",
  } satisfies React.CSSProperties,
  logo: {
    display: "block",
    margin: "0 auto 24px",
    width: "48px",
    height: "48px",
  } satisfies React.CSSProperties,
  heading: {
    fontSize: "24px",
    lineHeight: "32px",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,
  text: {
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 16px",
  } satisfies React.CSSProperties,
  button: {
    display: "inline-block",
    padding: "12px 24px",
    backgroundColor: "#000000",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "5px",
    margin: "12px 0 20px",
  } satisfies React.CSSProperties,
};

export type EmailLogoProps = {
  appUrl?: string;
};

export function EmailLogo({ appUrl }: EmailLogoProps) {
  const resolvedAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return <Img alt="Heyhire" src={`${resolvedAppUrl}/favicon.png`} style={emailStyles.logo} />;
}
