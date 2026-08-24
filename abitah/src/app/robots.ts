import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/conta", "/checkout", "/carrinho", "/api"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
