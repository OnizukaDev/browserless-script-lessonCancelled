"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const api_1 = require("@bull-board/api");
const express_2 = require("@bull-board/express");
const bullAdapter_1 = require("@bull-board/api/bullAdapter");
const config_1 = require("./config");
const routes_1 = require("./routes");
const queue_1 = require("./queues/queue");
const script_worker_1 = require("./workers/script-worker");
// Initialize services first
console.log("✅ Service lessonCancelled initialized");
// Set up Bull Board for queue monitoring
const serverAdapter = new express_2.ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
(0, api_1.createBullBoard)({
    queues: [new bullAdapter_1.BullAdapter(queue_1.scriptsQueue)],
    serverAdapter: serverAdapter,
});
// Initialize Express app
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ limit: "10mb", extended: true }));
app.use((0, cors_1.default)({
    origin: config_1.config.frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
}));
const apiLimiter = (0, express_rate_limit_1.default)({
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
app.use("/api", routes_1.scriptsRoutes);
// Initialize workers
(0, script_worker_1.initializeScriptWorker)();
console.log("👷 Script worker initialized and ready to process jobs");
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Bull Board available at http://localhost:${PORT}/admin/queues`);
});
