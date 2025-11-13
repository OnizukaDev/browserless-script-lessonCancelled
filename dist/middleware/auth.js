"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = void 0;
const config_1 = require("../config");
const validateApiKey = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("token ")) {
        res.status(401).json({
            status: "error",
            message: "Authorization header missing or invalid format",
        });
        return;
    }
    const apiKey = authHeader.split(" ")[1];
    if (apiKey !== config_1.config.apiKey) {
        res.status(401).json({
            status: "error",
            message: "Invalid API key",
        });
        return;
    }
    next();
};
exports.validateApiKey = validateApiKey;
