import { useRouteContext } from "@tanstack/react-router";

export const useRootRouteContext = () => {
	return useRouteContext({ from: "/" });
};
