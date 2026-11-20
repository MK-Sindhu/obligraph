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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#a9d1fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1b2d" },
  ],
};

// Applies the saved theme before first paint ("light" | "dark"; absent = follow the OS).
const themeScript = `(function(){try{var t=localStorage.getItem("obligraph.theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
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
