"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const PORT = process.env.PORT ?? "3000";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
exports.config = {
    port: parseInt(PORT, 10),
    corsOrigin: CORS_ORIGIN,
    nodeEnv: process.env.NODE_ENV ?? "development",
};
