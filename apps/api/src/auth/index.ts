import { prisma } from "../db/prisma.js";
import { createSessionService } from "./session.js";

export const sessionService = createSessionService(prisma);
