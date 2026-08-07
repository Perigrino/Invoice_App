import {
  Body,
  Container,
  Heading,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";

export function PasswordResetEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <Html>
      <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "sans-serif", padding: "24px" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "480px",
          }}
        >
          <Heading style={{ color: "#171923", fontSize: "22px", marginBottom: "8px" }}>
            Reset your password
          </Heading>
          <Text style={{ color: "#626b80", fontSize: "14px", lineHeight: "1.6" }}>
            We received a request to reset your InvoiceFlow password. Use the button below to
            choose a new one. This link expires in 1 hour.
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={resetUrl}
              style={{
                backgroundColor: "#059669",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              Reset password
            </Link>
          </Section>
          <Text style={{ color: "#626b80", fontSize: "14px" }}>
            Or copy this link into your browser:
          </Text>
          <Text style={{ wordBreak: "break-all", color: "#059669", fontSize: "13px" }}>
            {resetUrl}
          </Text>
          <Text style={{ color: "#626b80", fontSize: "13px", marginTop: "24px" }}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
