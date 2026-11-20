import type { MetadataRoute } from "next";
import { docIndex } from "@/lib/docs";
import { MARKETING_ROUTES, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = MARKETING_ROUTES.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path === "/privacy" ? 0.3 : 0.7,
  }));
  const docs: MetadataRoute.Sitemap = docIndex().map((d) => ({
    url: `${SITE_URL}${d.href}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  return [...pages, ...docs];
}
