import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getDb } from "./store.js";
import { Role, User } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    userContext?: {
      user: Omit<User, "passwordHash">;
      organizationId: string;
    };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = await request.jwtVerify<{ userId: string }>();
    const user = getDb().users.find((item) => item.id === token.userId);

    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    request.userContext = {
      user: safeUser,
      organizationId: user.organizationId,
    };
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const role = request.userContext?.user.role;
    if (!role || !roles.includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}

export function registerAuthDecorators(app: FastifyInstance) {
  app.decorate("authenticate", authenticate);
}
