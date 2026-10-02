import "server-only";
import { randomUUID } from "crypto";
import type { Customer } from "@/lib/schema";

/**
 * Payment gateway abstraction.
 *
 * Right now only the MOCK provider exists so the full checkout UI can be tested.
 * To go live:
 *   1. Implement a provider below (e.g. `razorpayProvider`) using the gateway's SDK.
 *   2. Set PAYMENT_PROVIDER=razorpay (plus its keys) in .env.local.
 *   3. Add the gateway's checkout script/modal in app/checkout/CheckoutForm.tsx
 *      where it says `// GATEWAY CHECKOUT GOES HERE`.
 */

export type CreateOrderInput = {
  amount: number; // in rupees
  currency: string;
  customer: Customer;
};

export type CreatedOrder = {
  orderId: string;
  provider: ProviderName;
  /** Anything the client-side checkout widget needs (key id, amount in paise, etc.). */
  clientData?: Record<string, unknown>;
};

export type VerifyInput = {
  orderId: string;
  /** Raw fields the gateway returns after payment (payment id, signature, ...). */
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

// TODO: Razorpay example skeleton
// const razorpayProvider: PaymentProvider = {
//   name: "razorpay",
//   async createOrder({ amount, currency }) {
//     const rp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });
//     const order = await rp.orders.create({ amount: amount * 100, currency });
//     return { orderId: order.id, provider: "razorpay", clientData: { keyId: process.env.RAZORPAY_KEY_ID, amount: order.amount } };
//   },
//   async verify({ orderId, payload }) {
//     // HMAC-SHA256(orderId + "|" + payload.razorpay_payment_id, KEY_SECRET) === payload.razorpay_signature
//   },
// };

const providers: Partial<Record<ProviderName, PaymentProvider>> = {
  mock: mockProvider,
};

export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER ?? "mock") as ProviderName;
  const provider = providers[name];
  if (!provider) throw new Error(`Payment provider "${name}" is not implemented yet`);
  if (provider.name === "mock" && process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    throw new Error("Mock payments are disabled in production. Configure a real PAYMENT_PROVIDER.");
  }
  return provider;
}
