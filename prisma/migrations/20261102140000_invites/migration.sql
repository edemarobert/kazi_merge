CREATE TABLE "invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "inviter_user_id" UUID NOT NULL,
    "invitee_user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");
CREATE INDEX "invites_company_id_invitee_user_id_idx" ON "invites"("company_id", "invitee_user_id");
CREATE INDEX "invites_expires_at_idx" ON "invites"("expires_at");
ALTER TABLE "invites" ADD CONSTRAINT "invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_invitee_user_id_fkey" FOREIGN KEY ("invitee_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
