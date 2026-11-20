import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Friendly geometric sans for everything; mono only for reference numbers.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
    { media: "(prefers-color-scheme: light)", color: "#e8edf3" },
    { media: "(prefers-color-scheme: dark)", color: "#1e2330" },
  ],
};

// Applies the saved theme before first paint ("light" | "dark"; absent = follow the OS).
const themeScript = `(function(){try{var t=localStorage.getItem("obligraph.theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${poppins.variable} ${plexMono.variable} h-full antialiased`}
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
