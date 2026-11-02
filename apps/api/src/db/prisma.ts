import { PrismaClient } from "@prisma/client";
import { getCompanyId, requireCompanyId } from "../context/company-context.js";

const companyModels = new Set([
  "Membership",
  "Employee",
  "Department",
  "Team",
  "TeamMember",
  "Task",
  "TaskUpdate",
  "Attachment",
  "Notification",
  "NotificationPreference",
  "IntegrationAccount",
  "ActivityLog",
]);

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
};

function scopeWhere(
  where: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const currentCompanyId = requireCompanyId();
  if (where?.companyId && where.companyId !== currentCompanyId) {
    throw new Error("The query company does not match the active company.");
  }
  const compoundCompanyKey = Object.keys(where ?? {}).find((key) =>
    key.endsWith("_companyId"),
  );
  if (compoundCompanyKey) {
    const compound = where?.[compoundCompanyKey];
    if (
      typeof compound === "object" &&
      compound !== null &&
      "companyId" in compound &&
      compound.companyId !== currentCompanyId
    ) {
      throw new Error("The query company does not match the active company.");
    }
    return where ?? {};
  }
  return { ...(where ?? {}), companyId: currentCompanyId };
}

function scopeData(
  data: Record<string, unknown> | Record<string, unknown>[],
): Record<string, unknown> | Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map((item) => scopeWhere(item));
  }
  return scopeWhere(data);
}

export function createPrismaClient() {
  const client = new PrismaClient();
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!companyModels.has(model) || !getCompanyId()) {
            return query(args);
          }

          const scopedArgs = { ...(args as QueryArgs) };
          if (
            ["findUnique", "findUniqueOrThrow"].includes(operation) &&
            scopedArgs.where
          ) {
            scopedArgs.where = scopeWhere(scopedArgs.where);
            return query(scopedArgs);
          }
          if (
            [
              "findFirst",
              "findFirstOrThrow",
              "findMany",
              "count",
              "aggregate",
              "groupBy",
              "deleteMany",
              "updateMany",
            ].includes(operation) &&
            scopedArgs.where
          ) {
            scopedArgs.where = scopeWhere(scopedArgs.where);
          }
          if (
            ["create", "update", "upsert", "createMany"].includes(operation) &&
            scopedArgs.data
          ) {
            scopedArgs.data = scopeData(scopedArgs.data);
          }
          if (operation === "upsert" && scopedArgs.where) {
            scopedArgs.where = scopeWhere(scopedArgs.where);
          }
          return query(scopedArgs);
        },
      },
    },
  });
}

export const prisma = createPrismaClient();
