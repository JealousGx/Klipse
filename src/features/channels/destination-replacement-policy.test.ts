import { describe, expect, it } from "vitest";

import { consumesDestinationReplacementQuota } from "./destination-replacement-policy";

describe("consumesDestinationReplacementQuota", () => {
	it("does not consume on first connect to a destination", () => {
		expect(
			consumesDestinationReplacementQuota({
				plan: "empire",
				priorExternalChannelId: null,
				newExternalChannelId: "UC_new",
			}),
		).toBe(false);
	});

	it("does not consume when reconnecting the same channel", () => {
		expect(
			consumesDestinationReplacementQuota({
				plan: "creator",
				priorExternalChannelId: "UC_same",
				newExternalChannelId: "UC_same",
			}),
		).toBe(false);
	});

	it("consumes when switching to a different channel on a linked slot", () => {
		expect(
			consumesDestinationReplacementQuota({
				plan: "starter",
				priorExternalChannelId: "UC_old",
				newExternalChannelId: "UC_new",
			}),
		).toBe(true);
	});
});
