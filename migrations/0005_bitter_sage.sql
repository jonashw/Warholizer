ALTER TABLE "uploads" ADD COLUMN "type" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "base64_encoded_data" text NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" DROP COLUMN "bytes";