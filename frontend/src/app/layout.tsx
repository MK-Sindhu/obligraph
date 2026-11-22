import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Friendly geometric sans for everything; mono only for reference numbers.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Obligraph", template: "%s · Obligraph" },
  description:
    "Regulatory obligations for Indian financial institutions: circulars, lineage, policy coverage and remediation in one place.",
  applicationName: "Obligraph",
  openGraph: {
    type: "website",
    siteName: "Obligraph",
    locale: "en_IN",
    images: [{ url: "/marketing/dashboard-light.jpg", alt: "The Obligraph dashboard on sample data" }],
  },
};

export const viewport: Viewport = {
  // Light is the default theme, whatever the OS uses.
  themeColor: "#a9d1fa",
};

// The page is served light (the default). Before first paint, switch to a saved "dark", or
// drop the attribute for a saved "system" so the OS setting applies.
const themeScript = `(function(){try{var t=localStorage.getItem("obligraph.theme"),r=document.documentElement;if(t==="dark")r.setAttribute("data-theme","dark");else if(t==="system")r.removeAttribute("data-theme")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
