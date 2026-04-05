import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { siteConfig } from "@/config/site";

import { AuthModalBridge } from "@/features/auth/AuthModalBridge";
import { AuthModalProvider } from "@/features/auth/AuthModalContext";
import { getRootSession } from "@/features/auth/get-root-session";

import { rootSearchSchema } from "@/lib/routes/root-search";

import { RootChrome } from "../components/root-chrome";
import { Toaster } from "../components/ui/sonner";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	/** Set in root `beforeLoad` (`getRootSession`); omitted in initial `getContext()` until navigation runs. */
	session?: Awaited<ReturnType<typeof getRootSession>> | null;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	validateSearch: (raw: Record<string, unknown>) => {
		const parsed = rootSearchSchema.safeParse(raw);
		return parsed.success ? parsed.data : {};
	},
	beforeLoad: async () => {
		const session = await getRootSession();

		return { session };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: siteConfig.name,
			},
			{
				name: "description",
				content: siteConfig.description,
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Inline bootstrap for theme flash avoidance; content is a static IIFE string. */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme init only */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased wrap-anywhere selection:bg-[rgba(79,184,178,0.24)]">
				<AuthModalProvider>
					<RootChrome>{children}</RootChrome>
					<AuthModalBridge />
					<Toaster />
				</AuthModalProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
