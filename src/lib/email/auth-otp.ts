import { getTransactionEmailFrom, sendEmail } from ".";

export async function sendAuthOTPEmail(data: { email: string; otp: string }) {
	await sendEmail({
		from: getTransactionEmailFrom(),
		to: data.email,
		template: {
			id: "email-verification",
			variables: {
				OTP: data.otp,
				CURR_YEAR: String(new Date().getFullYear()),
			},
		},
	});
}
