import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase.js";

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

const contactMessageSchema = z.object({
  firstName: z.preprocess((value) => cleanText(value, 80), z.string().min(1, "Please fill in all fields.")),
  lastName: z.preprocess((value) => cleanText(value, 80), z.string().min(1, "Please fill in all fields.")),
  email: z.preprocess(
    (value) => cleanText(value, 160).toLowerCase(),
    z.string().min(1, "Please fill in all fields.").email("Please enter a valid email address."),
  ),
  message: z.preprocess((value) => cleanText(value, 4000), z.string().min(1, "Please fill in all fields.")),
  source: z.enum(["web", "mobile"]).default("web").catch("web"),
});

export const contactMessagesRouter = Router();

contactMessagesRouter.post("/", async (request, response) => {
  try {
    const parsed = contactMessageSchema.safeParse(request.body || {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return response.status(400).json({ success: false, error: firstIssue?.message || "Invalid request body." });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { firstName, lastName, email, message, source } = parsed.data;

    const { error } = await supabaseAdmin.from("contact_messages").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      message,
      source,
      user_agent: request.get("user-agent") || "",
    });

    if (error) {
      request.log.error({ error }, "[BackendContactMessages] Insert failed");
      return response.status(500).json({ success: false, error: "Unable to send message right now." });
    }

    return response.json({ success: true });
  } catch (error) {
    request.log.error({ error }, "[BackendContactMessages] Request failed");
    return response.status(500).json({ success: false, error: "Unable to send message right now." });
  }
});
