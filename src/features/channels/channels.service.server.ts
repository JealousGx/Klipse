import "@tanstack/react-start/server-only"

// Re-export all public API from split modules so existing import sites keep working.

export { ChannelLimitError, ChannelNotFoundError } from "./channel-errors"
export type { ChannelRow } from "./channels-core.service.server"
export {
	createChannel,
	deleteChannel,
	ensureDefaultPublishingDestination,
	getChannelForUser,
	listChannelsForUser,
	toChannelRow,
	updateChannel,
	userHasAnotherDestinationWithExternalChannelId,
} from "./channels-core.service.server"
export {
	clearOAuthRefreshTokenOnly,
	disconnectChannelOAuth,
	getOAuthRefreshTokenForChannel,
	setChannelOAuthConnection,
	setChannelOAuthConnectionTx,
	updateChannelOAuthRefreshToken,
} from "./channels-oauth.service.server"
