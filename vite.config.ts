import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const root = process.cwd();
loadDotenv({ path: resolve(root, ".env"), override: true });
loadDotenv({ path: resolve(root, ".env.local"), override: true });

const config = defineConfig({
	// So other processes (e.g. external-video-processor in Docker calling
	// host.docker.internal:PORT) can reach the dev server. Default is localhost-only.
	server: {
		host: true,
		// Processor container uses Host: host.docker.internal when calling webhooks.
		allowedHosts: ["localhost", "host.docker.internal"],
	},
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		sentryTanstackStart({
			org: "klipse",
			project: "klipse-main",
			authToken: process.env.SENTRY_AUTH_TOKEN,
		}),
	],
});

export default config;
