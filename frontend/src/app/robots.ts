import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The public site is crawlable; the signed-in app and the API are not.
const APP_PATHS = [
  "/dashboard",
  "/calendar",
  "/readiness",
  "/reports",
  "/regulations",
  "/graph",
  "/copilot",
  "/obligations",
  "/tasks",
  "/approvals",
  "/filings",
  "/policies",
  "/evidence",
  "/settings",
  "/admin",
  "/login",
  "/register",
  "/sso",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: APP_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
