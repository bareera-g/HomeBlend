"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessionCode = generateSessionCode;
const crypto_1 = require("crypto");
const store_1 = require("../store");
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
const CODE_LEN = 5;
function generateSessionCode() {
    for (let i = 0; i < 20; i++) {
        const bytes = (0, crypto_1.randomBytes)(CODE_LEN);
        let code = "";
        for (let j = 0; j < CODE_LEN; j++) {
            code += CHARS[bytes[j] % CHARS.length];
        }
        if (!store_1.sessionsByCode.has(code))
            return code;
    }
    throw new Error("Could not generate unique session code");
}
