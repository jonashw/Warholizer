CREATE TABLE "composition_revisions" (
	"composition_id" varchar(32) NOT NULL,
	"revision" integer NOT NULL,
	"document" jsonb NOT NULL,
	"inputs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "composition_revisions_composition_id_revision_pk" PRIMARY KEY("composition_id","revision")
);
--> statement-breakpoint
CREATE TABLE "compositions" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"revision" integer NOT NULL,
	"preview_sha256" varchar(64),
	"public_slug" varchar(32),
	"share_sources" boolean DEFAULT false NOT NULL,
	"share_remix" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compositions_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "images" (
	"sha256" varchar(64) PRIMARY KEY NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"has_thumbnail" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_images" (
	"user_id" varchar(255) NOT NULL,
	"image_sha256" varchar(64) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_images_user_id_image_sha256_pk" PRIMARY KEY("user_id","image_sha256")
);
--> statement-breakpoint
ALTER TABLE "composition_revisions" ADD CONSTRAINT "composition_revisions_composition_id_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_preview_sha256_images_sha256_fk" FOREIGN KEY ("preview_sha256") REFERENCES "public"."images"("sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_image_sha256_images_sha256_fk" FOREIGN KEY ("image_sha256") REFERENCES "public"."images"("sha256") ON DELETE no action ON UPDATE no action;