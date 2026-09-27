import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { PORT, corsOrigins } from "./config.js";
import { adminRouter } from "./routes/admin.js";
import { contactMessagesRouter } from "./routes/contactMessages.js";
import { findYouRouter } from "./routes/findYou.js";
import { infrastructureRouter } from "./routes/infrastructure.js";
import { mediaRouter } from "./routes/media.js";
import { pricingPlansRouter } from "./routes/pricingPlans.js";
import { subscriptionRouter } from "./routes/subscription.js";
import { paymentsRouter } from "./routes/payments.js";
import { tenantAuthRouter } from "./routes/tenantAuth.js";
import { permissionsRouter } from "./routes/permissions.js";
import { runMediaWatchdog } from "./services/watchdog.js";

// ── Process-Level Crash Protection ──────────────────────────────────────────
// Prevent unhandled promise rejections from crashing the process (Node 16+)
process.on("unhandledRejection", (reason, promise) => {
  console.error("[EveBashBackend] Unhandled Promise Rejection:", {
    reason: reason instanceof Error ? reason.stack || reason.message : reason,
    promise,
  });
});

// Catch synchronous exceptions that escape error handlers to prevent abrupt process termination
process.on("uncaughtException", (error, origin) => {
  console.error("[EveBashBackend] Uncaught Exception:", {
    error: error instanceof Error ? error.stack || error.message : error,
    origin,
  });
});

process.on("warning", (warning) => {
  console.warn("[EveBashBackend] Process Warning:", warning.name, warning.message);
});

export const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(pinoHttp());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));

const contactMessagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many contact requests. Please try again later." },
});

// Health checks for Railway, load balancers, and monitoring tools
app.get(["/", "/health", "/api/health"], (_request, response) => {
  response.json({
    ok: true,
    service: "evebash-backend",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/admin/control", adminRouter);
app.use("/api/admin", infrastructureRouter);
app.use("/api/contact-messages", contactMessagesLimiter, contactMessagesRouter);
app.use("/api/v1/contact-messages", contactMessagesLimiter, contactMessagesRouter);
app.use("/api/find-you", findYouRouter);
app.use("/api/media", mediaRouter);
app.use("/api/v1/media", mediaRouter);
app.use("/api/pricing-plans", pricingPlansRouter);
app.use("/api/v1/pricing-plans", pricingPlansRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/create-order", paymentsRouter);
app.use("/api/verify-payment", paymentsRouter);
app.use("/api/v1/tenant-auth", tenantAuthRouter);
app.use("/api/v1/permissions", permissionsRouter);

app.use((_request, response) => {
  response.status(404).json({ success: false, error: "Route not found." });
});

// ── Global Error Handling Middleware ─────────────────────────────────────────
// Catches unhandled errors across all routes, body parsers, and CORS
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  const isCorsError = typeof err?.message === "string" && err.message.startsWith("Origin not allowed by CORS");
  const isSyntaxError = err instanceof SyntaxError && "body" in err;
  const status = isCorsError
    ? 403
    : isSyntaxError
      ? 400
      : typeof err?.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500;

  console.error("[EveBashBackend] Handled route error:", {
    method: req.method,
    url: req.originalUrl,
    status,
    message: err?.message || "Internal server error",
  });

  res.status(status).json({
    success: false,
    error: isSyntaxError ? "Invalid JSON payload" : err?.message || "Internal server error",
  });
});

// ── Graceful Shutdown Handling ───────────────────────────────────────────────
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[EveBashBackend] Listening on 0.0.0.0:${PORT}`);
});

let isShuttingDown = false;

const safeRunWatchdog = async (context: string) => {
  try {
    await runMediaWatchdog();
  } catch (err) {
    console.error(`[WatchdogRunner] ${context} watchdog cycle failed:`, err);
  }
};

// Start background self-healing watchdog (runs every 10 minutes)
const WATCHDOG_INTERVAL_MS = 10 * 60 * 1000;
const watchdogInterval = setInterval(() => {
  safeRunWatchdog("Background").catch(() => {});
}, WATCHDOG_INTERVAL_MS);

// Also run once 30 seconds after server startup
const startupWatchdogTimeout = setTimeout(() => {
  safeRunWatchdog("Startup").catch(() => {});
}, 30 * 1000);

function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[EveBashBackend] Received ${signal}. Starting graceful shutdown...`);

  clearInterval(watchdogInterval);
  clearTimeout(startupWatchdogTimeout);

  // Stop accepting new connections
  server.close(() => {
    console.log("[EveBashBackend] All active connections closed. Exiting process.");
    process.exit(0);
  });

  // Force exit if connections don't drain within 10 seconds
  setTimeout(() => {
    console.error("[EveBashBackend] Forced exit after shutdown timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));


