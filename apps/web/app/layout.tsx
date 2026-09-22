import { brandClerkAppearance } from "@chofex/ui/lib/clerk-appearance";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import type { Metadata } from "next";
import {
  ChunkLoadRecoverySuccess,
  UnhandledChunkErrorRecovery,
} from "@/components/chunk-load-recovery";
import { DocumentLang } from "@/components/document-lang";
import { brandName, metadataCopy } from "@/components/landing/content";
import {
  landingBrand,
  landingDisplay,
  landingMono,
  landingSans,
} from "@/components/landing/fonts";
import {
  AuthenticatedPostHogAnalytics,
  PostHogAnalytics,
} from "@/components/posthog-analytics";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "@chofex/ui/globals.css";
import "@clerk/themes/shadcn.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hacktheandes.com"),
  title: metadataCopy.title,
  description: metadataCopy.description,
  openGraph: {
    title: metadataCopy.title,
    description: metadataCopy.description,
    locale: "es_PE",
    siteName: brandName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: metadataCopy.title,
    description: metadataCopy.description,
  },
};

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(
  clerkPublishableKey &&
    !clerkPublishableKey.includes("replace_me") &&
    /^pk_(test|live)_/.test(clerkPublishableKey),
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const queryProvider = <QueryProvider>{children}</QueryProvider>;
  let content = queryProvider;
  let posthogAnalytics: React.ReactNode = <PostHogAnalytics />;

  if (clerkConfigured) {
    content = (
      <ClerkProvider
        appearance={{ theme: shadcn, ...brandClerkAppearance }}
        signInFallbackRedirectUrl="/auth/complete"
        signUpFallbackRedirectUrl="/auth/complete"
      >
        <AuthenticatedPostHogAnalytics />
        {queryProvider}
      </ClerkProvider>
    );
    posthogAnalytics = null;
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${landingBrand.variable} ${landingDisplay.variable} ${landingSans.variable} ${landingMono.variable} min-h-svh font-sans antialiased`}
      >
        <DocumentLang />
        {/*
          The brand has one theme. `forcedTheme` keeps the class next-themes
          writes deterministic, so a product page cannot follow the OS into a
          light that no surface of this project uses.
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          forcedTheme="dark"
        >
          {content}
          <UnhandledChunkErrorRecovery />
          <ChunkLoadRecoverySuccess />
        </ThemeProvider>
        {posthogAnalytics}
      </body>
    </html>
  );
}
