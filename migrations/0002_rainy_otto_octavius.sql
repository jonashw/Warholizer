CREATE TABLE "user_logins" (
	"user_id" varchar(255) NOT NULL,
	"signed_in_at" timestamp with time zone DEFAULT now() NOT NULL
);
