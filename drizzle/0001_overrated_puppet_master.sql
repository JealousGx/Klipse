CREATE TABLE `site_settings` (
	`id` varchar(64) NOT NULL,
	`registration_enabled` boolean NOT NULL DEFAULT true,
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
