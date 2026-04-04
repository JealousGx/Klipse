import { polarClient } from "@polar-sh/better-auth/client";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { additionalUserFields } from "@/lib/auth/additional-user-fields";

export const authClient = createAuthClient({
	plugins: [
		emailOTPClient(),
		polarClient(),
		inferAdditionalFields({ user: additionalUserFields }),
	],
});

export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
