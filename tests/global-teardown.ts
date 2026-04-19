import { unlinkSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const KEYS_PATH = resolve(ROOT, ".test-keys.json");

export default async function globalTeardown() {
  try {
    unlinkSync(KEYS_PATH);
  } catch {
    // File may not exist
  }
  console.log("Test keys cleaned up.");
}
