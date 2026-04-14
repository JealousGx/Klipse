import { polarClient } from "@polar-sh/better-auth/client";
import {
	adminClient,
	emailOTPClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { additionalUserFields } from "@/lib/auth/additional-user-fields";

import { ac, adminRoles } from "./admin-access-control";

export const authClient = createAuthClient({
	plugins: [
		emailOTPClient(),
		polarClient(),
		adminClient({ ac, roles: adminRoles }),
		inferAdditionalFields({ user: additionalUserFields }),
	],
});

export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
