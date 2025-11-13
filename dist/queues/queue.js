"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptsQueue = void 0;
const bull_1 = __importDefault(require("bull"));
const redis_1 = require("../config/redis");
const scriptsQueue = new bull_1.default("scripts-queue", {
    redis: redis_1.redisConfig,
    limiter: {
        max: 1,
        duration: 180000,
    },
});
exports.scriptsQueue = scriptsQueue;
