import { getTransactionEmailFrom, sendEmail } from ".";

export async function sendAuthOTPEmail(data: { email: string; otp: string }) {
	await sendEmail({
		from: getTransactionEmailFrom(),
		to: data.email,
		template: {
			id: "email-verification",
			variables: {
				OTP_CODE: data.otp,
				CURRENT_YEAR: new Date().getFullYear(),
			},
		},
	});
}
