import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { Customer } from "@/lib/schema";

/**
 * Payment gateway abstraction.
 *
 * - "razorpay": used automatically when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set.
 *   Test-mode keys (rzp_test_…) take test payments; live keys (rzp_live_…) take real money.
 * - "mock": a fake gateway for demos when no keys are set (refused in production unless
 *   ALLOW_MOCK_PAYMENTS=true).
 * PAYMENT_PROVIDER can force one or the other.
 */

export type CreateOrderInput = {
  amount: number; // in rupees
  currency: string;
  customer: Customer;
  /** Shown in the gateway's popup and stored on the gateway's order. */
  description: string;
};

export type CreatedOrder = {
  orderId: string;
  provider: ProviderName;
  /** Everything the browser-side checkout popup needs (public key, amount in paise, …). */
  clientData?: Record<string, unknown>;
};

export type VerifyInput = {
  orderId: string;
  /** Raw fields the gateway returns after payment (payment id, signature, …). */
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  name: ProviderName;
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  verify(input: VerifyInput): Promise<{ ok: boolean; paymentId?: string }>;
}

export type ProviderName = "mock" | "razorpay";

const mockProvider: PaymentProvider = {
  name: "mock",
  async createOrder() {
    return { orderId: `mock_${randomUUID().slice(0, 12)}`, provider: "mock" };
  },
  async verify({ orderId }) {
    return { ok: orderId.startsWith("mock_"), paymentId: `mockpay_${Date.now()}` };
  },
};

/* ---------------- Razorpay ---------------- */

const rzpKeyId = () => process.env.RAZORPAY_KEY_ID ?? "";
const rzpSecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";

/** Constant-time comparison of two hex HMAC signatures. */
export function signaturesMatch(expectedHex: string, given: unknown) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

const razorpayProvider: PaymentProvider = {
  name: "razorpay",

  async createOrder({ amount, currency, customer, description }) {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${rzpKeyId()}:${rzpSecret()}`).toString("base64"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency,
        receipt: `pt_${randomUUID().slice(0, 30)}`,
        notes: { customer_email: customer.email, product: description.slice(0, 250) },
      }),
    });
    if (!res.ok) {
      // Razorpay's error body describes the problem; it never contains our secret.
      throw new Error(`Razorpay order creation failed (${res.status}): ${await res.text().catch(() => "")}`);
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      orderId: order.id,
      provider: "razorpay",
      clientData: {
        key: rzpKeyId(), // the public key id; the secret never leaves the server
        amount: order.amount,
        currency: order.currency,
        description,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      },
    };
  },

  /** Razorpay signs `${order_id}|${payment_id}` with the key secret; a match proves the payment is genuine. */
  async verify({ orderId, payload }) {
    const paymentId = payload.razorpay_payment_id;
    if (typeof paymentId !== "string" || payload.razorpay_order_id !== orderId) return { ok: false };
    const expected = hmacHex(rzpSecret(), `${orderId}|${paymentId}`);
    return signaturesMatch(expected, payload.razorpay_signature) ? { ok: true, paymentId } : { ok: false };
  },
};

const providers: Record<ProviderName, PaymentProvider> = {
  mock: mockProvider,
  razorpay: razorpayProvider,
};

export const razorpayConfigured = () => Boolean(rzpKeyId() && rzpSecret());

export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER || (razorpayConfigured() ? "razorpay" : "mock")) as ProviderName;
  const provider = providers[name];
  if (!provider) throw new Error(`Payment provider "${name}" is not implemented`);
  if (provider.name === "razorpay" && !razorpayConfigured()) {
    throw new Error("PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing");
  }
  if (provider.name === "mock" && process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    throw new Error("Mock payments are disabled in production. Configure Razorpay keys.");
  }
  return provider;
}
