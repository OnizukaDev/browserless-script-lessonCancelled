"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
const sleep = (ms = 1000) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
exports.sleep = sleep;
