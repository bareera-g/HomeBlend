import { randomBytes } from "crypto";
import { sessionsByCode } from "../store";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
const CODE_LEN = 5;

export function generateSessionCode(): string {
  for (let i = 0; i < 20; i++) {
    const bytes = randomBytes(CODE_LEN);
    let code = "";
    for (let j = 0; j < CODE_LEN; j++) {
      code += CHARS[bytes[j]! % CHARS.length];
    }
    if (!sessionsByCode.has(code)) return code;
  }
  throw new Error("Could not generate unique session code");
}
