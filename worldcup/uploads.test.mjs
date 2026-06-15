import assert from "node:assert/strict";
import test from "node:test";
import { isTelegramOversizeError } from "./modules/uploads.mjs";
import { WorldCupError } from "./modules/utils.mjs";

test("Telegram 413 upload errors are recognized as oversize fallbacks", () => {
  const error = new WorldCupError("Telegram sendDocument failed with HTTP 413.", {
    status: 413,
    code: "TELEGRAM_UPLOAD_FAILED",
    details: {
      ok: false,
      error_code: 413,
      description: "Request Entity Too Large",
    },
  });

  assert.equal(isTelegramOversizeError(error), true);
});

test("non-oversize Telegram upload errors are not treated as Drive fallbacks", () => {
  const error = new WorldCupError("Telegram sendDocument failed with HTTP 400.", {
    status: 400,
    code: "TELEGRAM_UPLOAD_FAILED",
    details: {
      ok: false,
      error_code: 400,
      description: "Bad Request",
    },
  });

  assert.equal(isTelegramOversizeError(error), false);
});
