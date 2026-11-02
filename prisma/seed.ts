import { MembershipRole, MembershipStatus, PrismaClient } from "@prisma/client";
import { demoCompanies } from "../apps/api/src/seed/demo-data.js";

const prisma = new PrismaClient();

async function seedCompany(company: (typeof demoCompanies)[number]) {
  await prisma.company.upsert({
    where: { id: company.id },
    update: {
      name: company.name,
      industry: company.industry,
      sizeBand: company.sizeBand,
    },
    create: {
      id: company.id,
      name: company.name,
      industry: company.industry,
      sizeBand: company.sizeBand,
    },
  });

  const people = [company.owner, company.employee];
  for (const [index, person] of people.entries()) {
    const role: MembershipRole =
      index === 0 ? MembershipRole.owner : MembershipRole.employee;
    await prisma.user.upsert({
      where: { id: person.id },
      update: { email: person.email, name: person.name },
      create: {
        id: person.id,
        email: person.email,
        name: person.name,
      },
    });
    await prisma.membership.upsert({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: person.id,
        },
      },
      update: { role, status: MembershipStatus.active },
      create: {
        id: person.membershipId,
        companyId: company.id,
        userId: person.id,
        role,
        status: MembershipStatus.active,
      },
    });
    await prisma.employee.upsert({
      where: {
        membershipId_companyId: {
          membershipId: person.membershipId,
          companyId: company.id,
        },
      },
      update: {
        companyId: company.id,
        jobTitle: role === "owner" ? "Owner" : "Employee",
      },
      create: {
        id: person.employeeId,
        companyId: company.id,
        membershipId: person.membershipId,
        jobTitle: role === "owner" ? "Owner" : "Employee",
      },
    });
  }

  await prisma.department.upsert({
    where: { id_companyId: { id: company.department.id, companyId: company.id } },
    update: { name: company.department.name },
    create: {
      id: company.department.id,
      companyId: company.id,
      name: company.department.name,
      headEmployeeId: company.owner.employeeId,
    },
  });
  await prisma.team.upsert({
    where: { id_companyId: { id: company.team.id, companyId: company.id } },
    update: { name: company.team.name },
    create: {
      id: company.team.id,
      companyId: company.id,
      name: company.team.name,
      departmentId: company.department.id,
      leadEmployeeId: company.owner.employeeId,
    },
  });
  await prisma.teamMember.upsert({
    where: {
      companyId_teamId_employeeId: {
        companyId: company.id,
        teamId: company.team.id,
        employeeId: company.employee.employeeId,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      teamId: company.team.id,
      employeeId: company.employee.employeeId,
    },
  });
  await prisma.task.upsert({
    where: { id_companyId: { id: company.task.id, companyId: company.id } },
    update: { title: company.task.title },
    create: {
      id: company.task.id,
      companyId: company.id,
      title: company.task.title,
      assigneeEmployeeId: company.employee.employeeId,
      createdByEmployeeId: company.owner.employeeId,
      teamId: company.team.id,
    },
  });
}

async function main() {
  for (const company of demoCompanies) {
    await seedCompany(company);
  }
  console.log(`Seeded ${demoCompanies.length} companies.`);
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
