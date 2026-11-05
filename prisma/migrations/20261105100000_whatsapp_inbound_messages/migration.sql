CREATE TABLE "whatsapp_inbound_messages" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_inbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_inbound_messages_company_id_message_id_key" ON "whatsapp_inbound_messages"("company_id", "message_id");
CREATE INDEX "whatsapp_inbound_messages_company_id_phone_e164_idx" ON "whatsapp_inbound_messages"("company_id", "phone_e164");
ALTER TABLE "whatsapp_inbound_messages" ADD CONSTRAINT "whatsapp_inbound_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD COLUMN "provider_message_id" TEXT;
