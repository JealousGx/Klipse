CREATE TABLE `accounts` (
	`id` varchar(64) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`niche` varchar(512) NOT NULL,
	`config` json NOT NULL,
	`platform` enum('unlinked','youtube','tiktok','instagram') NOT NULL DEFAULT 'unlinked',
	`external_channel_id` varchar(64),
	`external_channel_title` varchar(512),
	`external_channel_handle` varchar(255),
	`external_channel_thumbnail_url` varchar(512),
	`oauth_refresh_token` text,
	`bound_external_account_id` varchar(64),
	`sound_enabled` boolean NOT NULL DEFAULT true,
	`sound_prompt_hint` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`type` enum('usage','purchase','refund') NOT NULL,
	`amount` int NOT NULL,
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_api_keys` (
	`id` varchar(64) NOT NULL,
	`provider` enum('openrouter','google_tts','replicate','unreal_speech','elevenlabs','gemini','pollinations','openai','kling','luma') NOT NULL,
	`secret_fingerprint` varchar(64) NOT NULL,
	`secret` text NOT NULL,
	`model_id` varchar(255),
	`task_type` enum('any','script','image','tts','voice','sound') NOT NULL DEFAULT 'any',
	`label` varchar(128),
	`sort_order` int NOT NULL DEFAULT 0,
	`disabled` boolean NOT NULL DEFAULT false,
	`cooldown_until` timestamp(3),
	`last_failure_at` timestamp(3),
	`failure_count` int NOT NULL DEFAULT 0,
	`error_type` varchar(32),
	`owner_email` varchar(255),
	`quota_reset_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `provider_api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_api_keys_provider_fp_uidx` UNIQUE(`provider`,`secret_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`channel_id` varchar(64) NOT NULL,
	`frequency` enum('daily','every_2_days','every_3_days','every_4_days','every_5_days','every_6_days','weekly','every_2_weeks','every_3_weeks','monthly') NOT NULL,
	`next_run_at` timestamp(3) NOT NULL,
	`jitter_minutes` int NOT NULL DEFAULT 360,
	`enabled` boolean NOT NULL DEFAULT true,
	`last_run_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `schedules_channelId_unique` UNIQUE(`channel_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(64) NOT NULL,
	`impersonated_by` varchar(64),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `expiring_assets` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`logical_key` varchar(512) NOT NULL,
	`video_job_id` varchar(64),
	`kind` varchar(32) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `expiring_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_idempotency` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`scope` varchar(32) NOT NULL,
	`client_key` varchar(128) NOT NULL,
	`status` enum('processing','completed') NOT NULL,
	`ref` varchar(128),
	`result` json,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `usage_idempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_idempotency_user_scope_key_uidx` UNIQUE(`user_id`,`scope`,`client_key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`role` varchar(64) DEFAULT 'user',
	`banned` boolean DEFAULT false,
	`ban_reason` text,
	`ban_expires` timestamp(3),
	`plan` enum('free','starter','creator','empire') NOT NULL DEFAULT 'free',
	`credits_remaining` int NOT NULL DEFAULT 0,
	`credits_used` int NOT NULL DEFAULT 0,
	`free_video_consumed` boolean NOT NULL DEFAULT false,
	`destination_replacements_used` int NOT NULL DEFAULT 0,
	`notify_video_approval` boolean NOT NULL DEFAULT true,
	`notify_video_ready` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` varchar(128) NOT NULL,
	`identifier` varchar(512) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_jobs` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`channel_id` varchar(64) NOT NULL,
	`pipeline_kind` varchar(32) NOT NULL DEFAULT 'stub_pipeline',
	`input_payload` json,
	`artifacts` json,
	`status` enum('queued','dispatched','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`current_stage` varchar(64),
	`cost_credits` int NOT NULL DEFAULT 0,
	`output_url` text,
	`error_message` text,
	`publish_approval_status` enum('pending','approved','rejected'),
	`published_video_id` varchar(64),
	`published_at` timestamp(3),
	`publish_started_at` timestamp(3),
	`publish_last_error` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `video_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channels` ADD CONSTRAINT `channels_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_transactions` ADD CONSTRAINT `credit_transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_channel_id_channels_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expiring_assets` ADD CONSTRAINT `expiring_assets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expiring_assets` ADD CONSTRAINT `expiring_assets_video_job_id_video_jobs_id_fk` FOREIGN KEY (`video_job_id`) REFERENCES `video_jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_idempotency` ADD CONSTRAINT `usage_idempotency_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD CONSTRAINT `video_jobs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD CONSTRAINT `video_jobs_channel_id_channels_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `channels_userId_idx` ON `channels` (`user_id`);--> statement-breakpoint
CREATE INDEX `channels_createdAt_idx` ON `channels` (`created_at`);--> statement-breakpoint
CREATE INDEX `credit_transactions_userId_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transactions_createdAt_idx` ON `credit_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `provider_api_keys_provider_idx` ON `provider_api_keys` (`provider`,`disabled`);--> statement-breakpoint
CREATE INDEX `schedules_userId_idx` ON `schedules` (`user_id`);--> statement-breakpoint
CREATE INDEX `schedules_enabled_nextRunAt_idx` ON `schedules` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `expiring_assets_expires_idx` ON `expiring_assets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `expiring_assets_user_idx` ON `expiring_assets` (`user_id`);--> statement-breakpoint
CREATE INDEX `usage_idempotency_userId_idx` ON `usage_idempotency` (`user_id`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `video_jobs_userId_idx` ON `video_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `video_jobs_channelId_idx` ON `video_jobs` (`channel_id`);--> statement-breakpoint
CREATE INDEX `video_jobs_createdAt_idx` ON `video_jobs` (`created_at`);