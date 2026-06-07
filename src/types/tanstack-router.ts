export {}

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** Shown in the dashboard shell header (nested routes under `/dashboard`). */
		dashboardTitle?: string
	}
}
