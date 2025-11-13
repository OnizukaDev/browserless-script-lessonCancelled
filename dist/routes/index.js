"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptsRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const scripts_controller_1 = require("../controllers/scripts.controller");
const router = (0, express_1.Router)();
const scriptsController = new scripts_controller_1.ScriptsController();
router.use(auth_1.validateApiKey);
// add route here "/lessons-cancelled"
router.post("/invoices", scriptsController.handleInvoiceScript);
router.post("/regenerate-invoice", scriptsController.handleRegenerateInvoice);
router.post("/payment-orders", scriptsController.handlePaymentOrderScript);
router.post("/unpaid-invoices", scriptsController.handleUnpaidInvoicesScript);
router.post("/email-unpaid-invoices", scriptsController.handleEmailUnpaidInvoicesScript); // New endpoint
exports.scriptsRoutes = router;
