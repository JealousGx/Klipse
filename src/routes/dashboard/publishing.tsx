import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Parent segment for `/dashboard/publishing` — must render `<Outlet />` so the
 * index list (`publishing.index.tsx`) and destination detail
 * (`publishing.$destinationId.tsx`) actually mount.
 */
export const Route = createFileRoute("/dashboard/publishing")({
	component: PublishingLayout,
});

function PublishingLayout() {
	return <Outlet />;
}
