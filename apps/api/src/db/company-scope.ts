import { CompanyId, requireCompanyId } from "../context/company-context.js";

type CompanyField = Record<string, unknown> & {
  companyId?: string;
};

export class CompanyScopeViolation extends Error {
  constructor(message = "The query company does not match the active company.") {
    super(message);
    this.name = "CompanyScopeViolation";
  }
}

function scopedValue<T extends CompanyField>(
  value: T,
  currentCompanyId: CompanyId,
): T & { companyId: CompanyId } {
  if (value.companyId && value.companyId !== currentCompanyId) {
    throw new CompanyScopeViolation();
  }

  return { ...value, companyId: currentCompanyId };
}

export function scopedWhere<T extends CompanyField>(
  where: T,
): T & { companyId: CompanyId } {
  return scopedValue(where, requireCompanyId());
}

export function scopedData<T extends CompanyField>(
  data: T,
): T & { companyId: CompanyId } {
  return scopedValue(data, requireCompanyId());
}

export function assertCompanyScope(targetCompanyId: string): void {
  if (targetCompanyId !== requireCompanyId()) {
    throw new CompanyScopeViolation();
  }
}
