import { createFileRoute } from "@tanstack/react-router"

import { siteConfig } from "@/config/site"

const PUBLIC_ROUTES = [
	{ path: "/", changefreq: "weekly", priority: "1.0" },
	{ path: "/terms", changefreq: "monthly", priority: "0.3" },
	{ path: "/privacy", changefreq: "monthly", priority: "0.3" },
	{ path: "/refund", changefreq: "monthly", priority: "0.3" },
] as const

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () => {
				const now = new Date().toISOString().split("T")[0]
				const urls = PUBLIC_ROUTES.map(
					(r) => `  <url>
    <loc>${siteConfig.origin}${r.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
				).join("\n")

				const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

				return new Response(xml, {
					headers: { "Content-Type": "application/xml; charset=utf-8" },
				})
			},
		},
	},
})
