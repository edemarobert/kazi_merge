import { MembershipRole, MembershipStatus } from "@prisma/client";

const requiredHeaders = ["name", "email", "phonee164", "jobtitle", "startdate"];

export type CsvEmployeeRow = {
  rowNumber: number;
  name: string;
  email?: string;
  phoneE164?: string;
  jobTitle?: string;
  startDate?: string;
};

export type CsvImportError = { rowNumber: number; message: string };

export type CsvPreview = {
  rows: CsvEmployeeRow[];
  errors: CsvImportError[];
};

function parseLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

export function previewEmployeeCsv(csv: string): CsvPreview {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length === 0) {
    return { rows: [], errors: [{ rowNumber: 1, message: "CSV content is empty." }] };
  }
  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: `Missing columns: ${missing.join(", ")}.` }],
    };
  }
  const rows: CsvEmployeeRow[] = [];
  const errors: CsvImportError[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseLine(lines[index]);
    const valueFor = (header: string) =>
      values[headers.indexOf(header)]?.trim() || undefined;
    const row: CsvEmployeeRow = {
      rowNumber: index + 1,
      name: valueFor("name") ?? "",
      email: valueFor("email"),
      phoneE164: valueFor("phonee164"),
      jobTitle: valueFor("jobtitle"),
      startDate: valueFor("startdate"),
    };
    const rowErrors: string[] = [];
    if (!row.name) rowErrors.push("Name is required");
    if (!row.email && !row.phoneE164) rowErrors.push("Email or phoneE164 is required");
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push("Email is invalid");
    }
    if (row.phoneE164 && !/^\+[1-9]\d{7,14}$/.test(row.phoneE164)) {
      rowErrors.push("phoneE164 must use E.164 format");
    }
    if (row.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.startDate)) {
      rowErrors.push("startDate must use YYYY-MM-DD format");
    }
    if (rowErrors.length > 0) {
      errors.push({ rowNumber: row.rowNumber, message: rowErrors.join("; ") });
    } else {
      rows.push(row);
    }
  }
  return { rows, errors };
}

type ImportStore = {
  user: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  membership: {
    create(args: unknown): Promise<{ id: string }>;
  };
  employee: {
    create(args: unknown): Promise<{ id: string }>;
  };
};

export async function importEmployeeRows(
  store: ImportStore,
  companyId: string,
  rows: CsvEmployeeRow[],
) {
  const imported: Array<{ rowNumber: number; employeeId: string }> = [];
  const errors: CsvImportError[] = [];
  for (const row of rows) {
    try {
      const user = await store.user.findFirst({
        where: {
          OR: [{ email: row.email }, { phoneE164: row.phoneE164 }],
        },
      });
      const userId =
        user?.id ??
        (
          await store.user.create({
            data: {
              name: row.name,
              email: row.email,
              phoneE164: row.phoneE164,
            },
          })
        ).id;
      const membership = await store.membership.create({
        data: {
          companyId,
          userId,
          role: MembershipRole.employee,
          status: MembershipStatus.active,
        },
      });
      const employee = await store.employee.create({
        data: {
          companyId,
          membershipId: membership.id,
          jobTitle: row.jobTitle,
          phoneE164: row.phoneE164,
          startDate: row.startDate
            ? new Date(`${row.startDate}T00:00:00.000Z`)
            : undefined,
        },
      });
      imported.push({ rowNumber: row.rowNumber, employeeId: employee.id });
    } catch (error) {
      errors.push({
        rowNumber: row.rowNumber,
        message:
          error instanceof Error ? error.message : "The row could not be imported.",
      });
    }
  }
  return { imported, errors };
}
