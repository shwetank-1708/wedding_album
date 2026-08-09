import cors from "cors";
import express from "express";
import { PORT, corsOrigins } from "./config.js";
import { adminRouter } from "./routes/admin.js";
import { contactMessagesRouter } from "./routes/contactMessages.js";
import { findYouRouter } from "./routes/findYou.js";
import { infrastructureRouter } from "./routes/infrastructure.js";
import { mediaRouter } from "./routes/media.js";
import { pricingPlansRouter } from "./routes/pricingPlans.js";
import { subscriptionRouter } from "./routes/subscription.js";

const app = express();

app.disable("x-powered-by");

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

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "evebash-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/admin/control", adminRouter);
app.use("/api/admin", infrastructureRouter);
app.use("/api/contact-messages", contactMessagesRouter);
app.use("/api/find-you", findYouRouter);
app.use("/api/media", mediaRouter);
app.use("/api/pricing-plans", pricingPlansRouter);
app.use("/api/subscription", subscriptionRouter);

app.use((_request, response) => {
  response.status(404).json({ success: false, error: "Route not found." });
});

app.listen(PORT, () => {
  console.log(`[EveBashBackend] Listening on port ${PORT}`);
});
