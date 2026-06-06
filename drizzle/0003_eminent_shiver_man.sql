ALTER TABLE `video_jobs` ADD `publish_settings` json;--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `publish_caption_override` varchar(5000);--> statement-breakpoint
ALTER TABLE `video_jobs` ADD `publish_retry_count` int DEFAULT 0 NOT NULL;