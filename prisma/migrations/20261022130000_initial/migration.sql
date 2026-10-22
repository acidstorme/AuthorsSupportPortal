-- Apply atomically; failing DDL rolls back this migration.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateEnum
CREATE TYPE "app"."Role" AS ENUM ('AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "app"."TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "app"."TicketPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "app"."TicketCategory" AS ENUM ('Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry');

-- CreateEnum
CREATE TYPE "app"."AiStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "app"."AiProvider" AS ENUM ('OPENAI', 'MOCK');

-- CreateEnum
CREATE TYPE "app"."TicketEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNMENT_CHANGED', 'MANUAL_CLASSIFICATION_CHANGED', 'AI_CLASSIFICATION_SUCCEEDED', 'AI_CLASSIFICATION_FAILED', 'MESSAGE_ADDED', 'NOTE_ADDED', 'AUTHOR_REPLY_ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "app"."users" (
    "id" UUID NOT NULL,
    "role" "app"."Role" NOT NULL,
    "login_email" VARCHAR(254) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."author_profiles" (
    "author_id" VARCHAR(20) NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "city" VARCHAR(200) NOT NULL,
    "joined_date" DATE NOT NULL,

    CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("author_id")
);

-- CreateTable
CREATE TABLE "app"."books" (
    "book_id" VARCHAR(20) NOT NULL,
    "author_id" VARCHAR(20) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "isbn" VARCHAR(50) NOT NULL,
    "genre" VARCHAR(200) NOT NULL,
    "publication_date" DATE,
    "status" VARCHAR(200) NOT NULL,
    "mrp" DECIMAL(12,2),
    "author_royalty_per_copy" DECIMAL(12,2),
    "total_copies_sold" INTEGER NOT NULL,
    "total_royalty_earned" DECIMAL(12,2) NOT NULL,
    "royalty_paid" DECIMAL(12,2) NOT NULL,
    "royalty_pending" DECIMAL(12,2) NOT NULL,
    "last_royalty_payout_date" DATE,
    "print_partner" VARCHAR(200),
    "available_on" TEXT[],

    CONSTRAINT "books_pkey" PRIMARY KEY ("book_id")
);

-- CreateTable
CREATE TABLE "app"."tickets" (
    "id" UUID NOT NULL,
    "author_id" VARCHAR(20) NOT NULL,
    "book_id" VARCHAR(20),
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "app"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" UUID,
    "creation_request_id" UUID NOT NULL,
    "ai_category" "app"."TicketCategory",
    "ai_priority" "app"."TicketPriority",
    "manual_category" "app"."TicketCategory",
    "manual_priority" "app"."TicketPriority",
    "ai_status" "app"."AiStatus" NOT NULL DEFAULT 'PENDING',
    "ai_provider" "app"."AiProvider",
    "ai_started_at" TIMESTAMPTZ(6),
    "ai_completed_at" TIMESTAMPTZ(6),
    "ai_error_code" VARCHAR(100),
    "ai_model" VARCHAR(100),
    "ai_prompt_version" VARCHAR(100),
    "draft_text" TEXT,
    "draft_context_hash" VARCHAR(64),
    "draft_provider" "app"."AiProvider",
    "draft_model" VARCHAR(100),
    "draft_prompt_version" VARCHAR(100),
    "draft_generated_at" TIMESTAMPTZ(6),
    "draft_started_at" TIMESTAMPTZ(6),
    "draft_error_code" VARCHAR(100),
    "resolved_author_reply_at" TIMESTAMPTZ(6),
    "author_reply_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "client_request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ticket_notes" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."ticket_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "app"."TicketEventType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_email_key" ON "app"."users"("login_email");

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_user_id_key" ON "app"."author_profiles"("user_id");

-- CreateIndex
CREATE INDEX "books_author_id_idx" ON "app"."books"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "books_book_id_author_id_key" ON "app"."books"("book_id", "author_id");

-- CreateIndex
CREATE INDEX "tickets_author_id_created_at_id_idx" ON "app"."tickets"("author_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "tickets_book_id_author_id_idx" ON "app"."tickets"("book_id", "author_id");

-- CreateIndex
CREATE INDEX "tickets_status_created_at_id_idx" ON "app"."tickets"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_id_status_idx" ON "app"."tickets"("assigned_to_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_author_id_creation_request_id_key" ON "app"."tickets"("author_id", "creation_request_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_id_idx" ON "app"."ticket_messages"("ticket_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ticket_messages_sender_id_idx" ON "app"."ticket_messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_messages_ticket_id_sender_id_client_request_id_key" ON "app"."ticket_messages"("ticket_id", "sender_id", "client_request_id");

-- CreateIndex
CREATE INDEX "ticket_notes_ticket_id_created_at_id_idx" ON "app"."ticket_notes"("ticket_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ticket_notes_creator_id_idx" ON "app"."ticket_notes"("creator_id");

-- CreateIndex
CREATE INDEX "ticket_events_ticket_id_created_at_id_idx" ON "app"."ticket_events"("ticket_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ticket_events_actor_id_idx" ON "app"."ticket_events"("actor_id");

-- AddForeignKey
ALTER TABLE "app"."author_profiles" ADD CONSTRAINT "author_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."books" ADD CONSTRAINT "books_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app"."author_profiles"("author_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."tickets" ADD CONSTRAINT "tickets_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app"."author_profiles"("author_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."tickets" ADD CONSTRAINT "tickets_book_id_author_id_fkey" FOREIGN KEY ("book_id", "author_id") REFERENCES "app"."books"("book_id", "author_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."tickets" ADD CONSTRAINT "tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app"."tickets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."ticket_messages" ADD CONSTRAINT "ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."ticket_notes" ADD CONSTRAINT "ticket_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app"."tickets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."ticket_notes" ADD CONSTRAINT "ticket_notes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app"."tickets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "app"."ticket_events" ADD CONSTRAINT "ticket_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Hand-written constraints not represented by Prisma's schema language.
-- Supabase owns auth.users; Prisma must never create, seed or migrate that table.
ALTER TABLE "app"."users" ADD CONSTRAINT "users_auth_id_fkey"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "app"."books" ALTER COLUMN "available_on" SET NOT NULL;
ALTER TABLE "app"."books" ADD CONSTRAINT "books_nonnegative_values_check" CHECK (
  ("mrp" IS NULL OR "mrp" >= 0) AND
  ("author_royalty_per_copy" IS NULL OR "author_royalty_per_copy" >= 0) AND
  "total_copies_sold" >= 0 AND "total_royalty_earned" >= 0 AND
  "royalty_paid" >= 0 AND "royalty_pending" >= 0
);
ALTER TABLE "app"."users" ADD CONSTRAINT "users_login_email_lowercase_check" CHECK ("login_email" = lower("login_email"));
ALTER TABLE "app"."tickets" ADD CONSTRAINT "tickets_text_check" CHECK (
  char_length(btrim("subject")) BETWEEN 1 AND 200 AND
  char_length(btrim("description")) BETWEEN 1 AND 10000
);
ALTER TABLE "app"."ticket_messages" ADD CONSTRAINT "ticket_messages_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 10000);
ALTER TABLE "app"."ticket_notes" ADD CONSTRAINT "ticket_notes_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 10000);

-- Runtime queries must use the same COALESCE expressions for manual precedence.
CREATE INDEX "tickets_effective_priority_created_idx" ON "app"."tickets"
  ((COALESCE("manual_priority", "ai_priority")), "created_at", "id");
CREATE INDEX "tickets_effective_category_created_idx" ON "app"."tickets"
  ((COALESCE("manual_category", "ai_category")), "created_at", "id");
CREATE INDEX "tickets_unseen_resolved_replies_idx" ON "app"."tickets" ("resolved_author_reply_at", "id")
  WHERE "resolved_author_reply_at" IS NOT NULL AND
    ("author_reply_seen_at" IS NULL OR "resolved_author_reply_at" > "author_reply_seen_at");

-- Browser Auth is permitted; direct browser table access is deliberately not.
-- Keep app OUT of the Supabase API exposed schemas list.
REVOKE ALL ON SCHEMA "app" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "app" FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "app" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

COMMIT;
