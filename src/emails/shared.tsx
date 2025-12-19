import * as React from "react";
import { Img, Text } from "@react-email/components";

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
    margin: "0 0 24px",
    width: "48px",
    height: "48px",
    textAlign: "left",
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
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "16px",
    textDecoration: "none",
    textAlign: "center",
    borderRadius: "5px",
    border: "1px solid #000000",
    margin: "12px 0 20px",
  } satisfies React.CSSProperties,
  footer: {
    margin: "40px 0 0",
  } satisfies React.CSSProperties,
  footerText: {
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 4px",
    color: "#666666",
  } satisfies React.CSSProperties,
};

export type EmailLogoProps = {
  appUrl?: string;
};

export function EmailLogo({ appUrl }: EmailLogoProps) {
  const resolvedAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return <Img alt="Heyhire" src={`${resolvedAppUrl}/favicon.png`} style={emailStyles.logo} />;
}

export function EmailSignature() {
  return (
    <div style={emailStyles.footer}>
      <Text style={{ ...emailStyles.text, margin: 0 }}>Yauhen Rachkouski</Text>
      <Text style={{ ...emailStyles.text, margin: "6px 0 0" }}>Co-founder @ Heyhire</Text>
      <Text style={{ ...emailStyles.text, margin: "6px 0 0" }}>360 NW 27th St, Miami, FL 33127</Text>
      <div style={{ height: "10px", lineHeight: "10px" }} />
      <div style={{ width: "100%", borderTop: "1px solid #eaeaea", height: 0, lineHeight: 0 }} />
      <div style={{ height: "10px", lineHeight: "10px" }} />
      <Text style={{ ...emailStyles.footerText, marginTop: 0 }}>
        You are receiving this email because you opted in via our site.
      </Text>
      <Text style={emailStyles.footerText}>Want to change how you receive these emails?</Text>
      <Text style={emailStyles.footerText}>You can unsubscribe from this list.</Text>
    </div>
  );
}
