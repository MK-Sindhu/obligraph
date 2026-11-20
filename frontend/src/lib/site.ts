// Public site settings for metadata, the sitemap and robots.txt.
// NEXT_PUBLIC_SITE_URL wins (set it for a custom domain); on Vercel the project's
// production domain is used automatically; locally, localhost.
const vercelDomain =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000")
).replace(/\/+$/, "");

export const SITE_NAME = "Obligraph";

/** Marketing routes: the only ones listed in the sitemap and open to crawlers. */
export const MARKETING_ROUTES = ["/", "/product", "/solutions", "/security", "/contact", "/privacy"] as const;
