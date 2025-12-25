CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
ALTER TABLE "cart_items"
	ADD CONSTRAINT "cart_items_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
	ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "cart_items"
	ADD CONSTRAINT "cart_items_product_id_products_id_fk"
	FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
	ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_product_cart"
	ON "cart_items" USING btree ("user_id", "product_id");
