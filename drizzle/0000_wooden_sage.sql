CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`filename` text NOT NULL,
	`content_type` text,
	`storage_path` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `collabs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cosplayer_id` integer NOT NULL,
	`reply_token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`cosplayer_id`) REFERENCES `cosplayers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collabs_reply_token_unique` ON `collabs` (`reply_token`);--> statement-breakpoint
CREATE TABLE `cosplayers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`fandoms` text DEFAULT '' NOT NULL,
	`photo_url` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cosplayers_email_unique` ON `cosplayers` (`email`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collab_id` integer NOT NULL,
	`direction` text NOT NULL,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`resend_email_id` text,
	`message_id_header` text,
	`scheduled_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`collab_id`) REFERENCES `collabs`(`id`) ON UPDATE no action ON DELETE no action
);
