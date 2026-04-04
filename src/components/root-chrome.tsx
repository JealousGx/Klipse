import { useRouterState } from "@tanstack/react-router";

import Footer from "@/components/Footer";
import Header from "@/components/Header";

type RootChromeProps = {
	children: React.ReactNode;
};

/**
 * Marketing site uses header + footer; app routes (`/dashboard`) use their own shell.
 */
export function RootChrome({ children }: RootChromeProps) {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const isApp = pathname.startsWith("/dashboard");

	if (isApp) {
		return <>{children}</>;
	}

	return (
		<>
			<Header />
			{children}
			<Footer />
		</>
	);
}
