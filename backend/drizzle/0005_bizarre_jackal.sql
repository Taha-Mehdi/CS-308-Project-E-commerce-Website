ALTER TABLE "reviews" ALTER COLUMN "status" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "moderated_by" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_product_review" ON "reviews" USING btree ("user_id","product_id");