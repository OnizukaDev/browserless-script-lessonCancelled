import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { config } from "./config";
import { scriptsRoutes } from "./routes";
import { scriptsQueue } from "./queues/queue";
import { initializeScriptWorker } from "./workers/script-worker";

// Initialize services first
console.log("✅ Service lessonCancelled initialized");

// Set up Bull Board for queue monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullAdapter(scriptsQueue)],
  serverAdapter: serverAdapter,
});

// Initialize Express app
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(
  cors({
    origin: config.frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 1 minute",
});

// Apply rate limiting to API routes
app.use("/api", apiLimiter);

// Set up routes
app.use("/admin/queues", serverAdapter.getRouter());
app.use("/api", scriptsRoutes);

// Initialize workers
initializeScriptWorker();
console.log("👷 Script worker initialized and ready to process jobs");

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📊 Bull Board available at http://localhost:${PORT}/admin/queues`
  );
});
