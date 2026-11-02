import { AsyncLocalStorage } from "node:async_hooks";

export type CompanyId = string & { readonly __brand: "CompanyId" };

type CompanyContext = {
  companyId: CompanyId;
};

const companyStorage = new AsyncLocalStorage<CompanyContext>();

function assertCompanyId(companyId: string): asserts companyId is CompanyId {
  if (!companyId.trim()) {
    throw new Error("A non-empty company ID is required.");
  }
}

export function companyId(value: string): CompanyId {
  assertCompanyId(value);
  return value;
}

export function getCompanyId(): CompanyId | undefined {
  return companyStorage.getStore()?.companyId;
}

export function requireCompanyId(): CompanyId {
  const currentCompanyId = getCompanyId();
  if (!currentCompanyId) {
    throw new Error("Company context is required for business data access.");
  }

  return currentCompanyId;
}

export function runWithCompanyContext<T>(
  currentCompanyId: CompanyId,
  callback: () => T,
): T {
  return companyStorage.run({ companyId: currentCompanyId }, callback);
}

export async function runWithCompanyContextAsync<T>(
  currentCompanyId: CompanyId,
  callback: () => Promise<T>,
): Promise<T> {
  return companyStorage.run({ companyId: currentCompanyId }, callback);
}
