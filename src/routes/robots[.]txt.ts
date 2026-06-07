import { createFileRoute } from "@tanstack/react-router"

import { isAllowedToIndex, siteConfig } from "@/config/site"

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () => {
				const shouldIndex = isAllowedToIndex(
					new URL(siteConfig.origin).hostname,
				)

				const content = shouldIndex
					? `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /api/
Disallow: /admin/

Sitemap: ${siteConfig.origin}/sitemap.xml
`
					: `User-agent: *
Disallow: /
`

				return new Response(content, {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				})
			},
		},
	},
})
