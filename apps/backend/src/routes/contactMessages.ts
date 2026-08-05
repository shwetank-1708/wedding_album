import { Router } from "express";
import { getSupabaseAdminClient } from "../supabase.js";

type ContactMessageBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  message?: unknown;
  source?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const contactMessagesRouter = Router();

contactMessagesRouter.post("/", async (request, response) => {
  const body = (request.body || {}) as ContactMessageBody;
  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const email = cleanText(body.email, 160).toLowerCase();
  const message = cleanText(body.message, 4000);
  const source = body.source === "mobile" ? "mobile" : "web";

  if (!firstName || !lastName || !email || !message) {
    return response.status(400).json({ success: false, error: "Please fill in all fields." });
  }

  if (!isValidEmail(email)) {
    return response.status(400).json({ success: false, error: "Please enter a valid email address." });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return response.status(500).json({ success: false, error: "Contact message storage is not configured." });
  }

  const { error } = await supabaseAdmin.from("contact_messages").insert({
    first_name: firstName,
    last_name: lastName,
    email,
    message,
    source,
    user_agent: request.get("user-agent") || "",
  });

  if (error) {
    console.error("[BackendContactMessages] Insert failed:", error);
    return response.status(500).json({ success: false, error: "Unable to send message right now." });
  }

  return response.json({ success: true });
});
