import "server-only";

import { query } from "@/src/lib/db";
import { getEnv } from "@/src/lib/env";

function formatSriLankanContact(value: number | string) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 9) return `+94${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+94${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("94")) return `+${digits}`;
  return null;
}

export async function sendReservationSms(userId: number, message: string) {
  const result = await query<{ contactNumber: number | null }>(
    `SELECT contact_number AS "contactNumber"
     FROM users
     WHERE id = $1 AND contact_number IS NOT NULL`,
    [userId],
  );
  const contact = result.rows[0]?.contactNumber;
  if (contact === null || contact === undefined) return;

  const phoneNumber = formatSriLankanContact(contact);
  if (!phoneNumber) {
    console.error("Reservation SMS skipped because the stored contact number is invalid.", { userId });
    return;
  }

  const env = getEnv();
  if (!env.SMSLENZ_USER_ID || !env.SMSLENZ_API_KEY || !env.SMSLENZ_SENDER_ID) {
    console.error("Reservation SMS skipped because SMSlenz credentials are not configured.");
    return;
  }

  const response = await fetch(env.SMSLENZ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: env.SMSLENZ_USER_ID,
      api_key: env.SMSLENZ_API_KEY,
      sender_id: env.SMSLENZ_SENDER_ID,
      contact: phoneNumber,
      message,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SMSlenz request failed (${response.status}): ${details.slice(0, 200)}`);
  }
}
