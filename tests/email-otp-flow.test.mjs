import test from "node:test";
import assert from "node:assert/strict";
import {
  OTP_RESEND_SECONDS,
  getOtpHelpMessage,
  mapOtpErrorMessage,
  verifyOtpWithFallbacks,
} from "../src/lib/auth/email-otp.js";

test("verifyOtpWithFallbacks prueba tipos alternativos hasta encontrar uno valido", async () => {
  const attempted = [];
  const supabase = {
    auth: {
      verifyOtp: async ({ type }) => {
        attempted.push(type);
        return type === "magiclink" ? { error: null } : { error: { message: "invalid token" } };
      },
    },
  };

  const result = await verifyOtpWithFallbacks(supabase, {
    email: "qa@verijob.es",
    token: "123456",
    types: ["email", "magiclink"],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(attempted, ["email", "magiclink"]);
});

test("OTP copy deja claro que el ultimo codigo invalida a los anteriores", () => {
  assert.equal(OTP_RESEND_SECONDS, 90);
  assert.match(getOtpHelpMessage(45), /ultimo codigo enviado/i);
  assert.match(mapOtpErrorMessage("otp_expired"), /ultimo codigo enviado/i);
});
