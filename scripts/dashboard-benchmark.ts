import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import {
  MembershipRole,
  MembershipStatus,
  PrismaClient,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { createApp } from "../apps/api/src/app.js";

const prisma = new PrismaClient();
const totalEmployeeCount = 50;
const workerCount = totalEmployeeCount - 1;
const taskCount = 2000;
const requestCount = 10;

async function seedBenchmarkCompany() {
  const companyId = randomUUID();
  const ownerUserId = randomUUID();
  const ownerMembershipId = randomUUID();
  const ownerEmployeeId = randomUUID();
  const departmentId = randomUUID();
  const teamId = randomUUID();
  const employeeIds = Array.from({ length: workerCount }, () => randomUUID());
  const userIds = employeeIds.map(() => randomUUID());
  const membershipIds = employeeIds.map(() => randomUUID());
  const taskIds = Array.from({ length: taskCount }, () => randomUUID());
  const now = new Date();

  await prisma.company.create({
    data: { id: companyId, name: "Dashboard Benchmark Company", sizeBand: "50" },
  });
  await prisma.user.create({
    data: {
      id: ownerUserId,
      email: `${ownerUserId}@benchmark.example`,
      name: "Benchmark Owner",
    },
  });
  await prisma.membership.create({
    data: {
      id: ownerMembershipId,
      companyId,
      userId: ownerUserId,
      role: MembershipRole.owner,
      status: MembershipStatus.active,
    },
  });
  await prisma.employee.create({
    data: {
      id: ownerEmployeeId,
      companyId,
      membershipId: ownerMembershipId,
      jobTitle: "Owner",
    },
  });
  await prisma.user.createMany({
    data: userIds.map((id, index) => ({
      id,
      email: `${id}@benchmark.example`,
      name: `Benchmark Employee ${index + 1}`,
    })),
  });
  await prisma.membership.createMany({
    data: membershipIds.map((id, index) => ({
      id,
      companyId,
      userId: userIds[index],
      role: MembershipRole.employee,
      status: MembershipStatus.active,
    })),
  });
  await prisma.employee.createMany({
    data: employeeIds.map((id, index) => ({
      id,
      companyId,
      membershipId: membershipIds[index],
      jobTitle: "Employee",
    })),
  });
  await prisma.department.create({
    data: {
      id: departmentId,
      companyId,
      name: "Benchmark Operations",
      headEmployeeId: ownerEmployeeId,
    },
  });
  await prisma.team.create({
    data: {
      id: teamId,
      companyId,
      name: "Benchmark Team",
      departmentId,
      leadEmployeeId: ownerEmployeeId,
    },
  });
  await prisma.teamMember.createMany({
    data: employeeIds.map((employeeId) => ({ companyId, teamId, employeeId })),
  });
  await prisma.task.createMany({
    data: taskIds.map((id, index) => ({
      id,
      companyId,
      title: `Benchmark task ${index + 1}`,
      assigneeEmployeeId: employeeIds[index % workerCount],
      createdByEmployeeId: ownerEmployeeId,
      teamId,
      priority: TaskPriority.medium,
      status: index % 11 === 0 ? TaskStatus.blocked : TaskStatus.todo,
      dueAt: new Date(now.getTime() + ((index % 21) - 10) * 86400000),
    })),
  });
  await prisma.activityLog.createMany({
    data: Array.from({ length: 5 }, (_, index) => ({
      companyId,
      actorUserId: ownerUserId,
      action: `benchmark.task.${index + 1}`,
      entityType: "task",
      entityId: taskIds[index],
      metadata: {},
    })),
  });

  return { companyId, ownerUserId };
}

async function listen(app: ReturnType<typeof createApp>) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Benchmark server did not expose a TCP address.");
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function main() {
  process.env.NODE_ENV = "test";
  const { companyId, ownerUserId } = await seedBenchmarkCompany();
  let server: ReturnType<typeof createServer> | undefined;

  try {
    const listening = await listen(createApp());
    server = listening.server;
    const headers = { "x-company-id": companyId, "x-user-id": ownerUserId };
    await fetch(`${listening.url}/api/v1/dashboard`, { headers });

    const durations: number[] = [];
    let result:
      | {
          metrics: {
            openTasks: number;
            overdue: number;
            dueThisWeek: number;
            blocked: number;
          };
          workload: unknown[];
        }
      | undefined;
    for (let index = 0; index < requestCount; index += 1) {
      const startedAt = performance.now();
      const response = await fetch(`${listening.url}/api/v1/dashboard`, { headers });
      const elapsed = performance.now() - startedAt;
      if (!response.ok) {
        throw new Error(
          `Dashboard benchmark request failed with HTTP ${response.status}.`,
        );
      }
      result = (await response.json()) as typeof result;
      durations.push(elapsed);
    }

    const sorted = [...durations].sort((left, right) => left - right);
    const percentile = (value: number) =>
      sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
    if (
      result?.metrics.openTasks !== taskCount ||
      result.workload.length !== totalEmployeeCount
    ) {
      throw new Error(
        `Unexpected dashboard result: ${JSON.stringify(result?.metrics)} with ${result?.workload.length ?? 0} workload rows.`,
      );
    }

    const linkedFilters = {
      openTasks: "open=true",
      overdue: "overdue=true",
      dueThisWeek: "dueThisWeek=true",
      blocked: "status=blocked",
    } as const;
    const linkedCounts = Object.fromEntries(
      await Promise.all(
        Object.entries(linkedFilters).map(async ([name, query]) => {
          const response = await fetch(`${listening.url}/api/v1/tasks?${query}`, {
            headers,
          });
          if (!response.ok) {
            throw new Error(
              `Linked task list request failed with HTTP ${response.status}.`,
            );
          }
          const payload = (await response.json()) as { tasks: unknown[] };
          return [name, payload.tasks.length];
        }),
      ),
    );
    const expectedLinkedCounts = {
      openTasks: result.metrics.openTasks,
      overdue: result.metrics.overdue,
      dueThisWeek: result.metrics.dueThisWeek,
      blocked: result.metrics.blocked,
    };
    if (JSON.stringify(linkedCounts) !== JSON.stringify(expectedLinkedCounts)) {
      throw new Error(
        `Dashboard counts do not match linked task lists: ${JSON.stringify({ linkedCounts, expectedLinkedCounts })}.`,
      );
    }
    console.log(
      JSON.stringify(
        {
          employees: totalEmployeeCount,
          tasks: taskCount,
          requests: requestCount,
          latencyMs: {
            min: Number(sorted[0].toFixed(2)),
            median: Number(percentile(0.5).toFixed(2)),
            p95: Number(percentile(0.95).toFixed(2)),
            max: Number(sorted[sorted.length - 1].toFixed(2)),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await prisma.company.delete({ where: { id: companyId } });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Dashboard benchmark failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
