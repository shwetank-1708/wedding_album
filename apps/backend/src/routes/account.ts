import type { Request, Response } from "express";
import { Router } from "express";
import { verifySupabaseUser } from "../auth.js";
import { deleteUserAccount } from "./admin.js";

export function createAccountRouter(
  verifyUser = verifySupabaseUser,
  deleteAccount = deleteUserAccount
) {
  const accountRouter = Router();

  accountRouter.options("/", (_request, response) => response.status(204).end());

  accountRouter.delete("/", async (request: Request, response: Response) => {
    try {
      const verified = await verifyUser(request);
      if (!verified) {
        return response.status(401).json({ success: false, error: "Authentication required." });
      }

      if (request.body?.confirmation !== "DELETE") {
        return response.status(400).json({
          success: false,
          error: "Type DELETE to confirm permanent account deletion.",
        });
      }

      await deleteAccount(verified.supabaseAdmin, verified.user.id);
      return response.json({ success: true });
    } catch (error) {
      request.log?.error({ err: error }, "Account deletion failed");
      return response.status(500).json({
        success: false,
        error: "Unable to delete the account. Please try again or contact support.",
      });
    }
  });

  return accountRouter;
}

export const accountRouter = createAccountRouter();
