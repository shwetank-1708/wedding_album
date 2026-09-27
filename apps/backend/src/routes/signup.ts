import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase.js";

type AuthDirectory = Pick<ReturnType<typeof getSupabaseAdminClient>["auth"]["admin"], "listUsers">;

export async function authEmailExists(directory: AuthDirectory, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await directory.listUsers({ page, perPage });
    if (error) throw error;
    if (data.users.some(user => user.email?.trim().toLowerCase() === normalized)) return true;
    if (data.users.length < perPage) return false;
  }
}

export function createSignupRouter(getDirectory: () => AuthDirectory = () => getSupabaseAdminClient().auth.admin) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    // A service-wide budget also works behind Railway's proxy without trusting
    // client-supplied forwarding headers or grouping users by a proxy IP.
    limit: 60,
    keyGenerator: () => "signup-auth-directory",
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many signup checks. Please try again later." },
  }));
  router.post("/check-email", async (req, res) => {
    const input = z.object({ email: z.string().trim().email().max(254) }).safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    try {
      const exists = await authEmailExists(getDirectory(), input.data.email);
      res.json({ exists });
    } catch {
      // Never report an email as available if the Auth directory could not be checked.
      res.status(503).json({ error: "Unable to check your email right now. Please try again later." });
    }
  });
  return router;
}
