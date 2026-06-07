import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed")({
	head: () => ({
		meta: [{ name: "robots", content: "noindex, nofollow" }],
	}),
	beforeLoad: async ({ context }) => {
		const { session } = context
		if (!session?.user) {
			throw redirect({
				to: "/",
				search: { auth: "login" },
			})
		}
		// Return narrowed (non-null) session so child routes get the correct type.
		return { session }
	},
	component: Layout,
})

function Layout() {
	return <Outlet />
}
