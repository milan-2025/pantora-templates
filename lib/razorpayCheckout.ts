"use client";

/** Browser side of Razorpay Checkout: loads their script and opens the secure payment popup. */

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

type RazorpayInstance = { open: () => void; on: (event: string, cb: (res: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export class PaymentCancelled extends Error {
  constructor() {
    super("Payment was cancelled. You can try again whenever you're ready.");
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export async function openRazorpay(orderId: string, clientData: Record<string, unknown>): Promise<RazorpaySuccess> {
  await loadScript();
  return new Promise((resolve, reject) => {
    let settled = false;
    const rzp = new window.Razorpay!({
      ...clientData, // key, amount, currency, description, prefill
      order_id: orderId,
      name: "Pandora Templates",
      theme: { color: "#3B1F4A" },
      handler: (res: RazorpaySuccess) => {
        settled = true;
        resolve(res);
      },
      modal: {
        // Closing the popup without paying.
        ondismiss: () => {
          if (!settled) reject(new PaymentCancelled());
        },
        confirm_close: true,
      },
    });
    // A failed attempt keeps the popup open so the buyer can retry with another method;
    // we only react if they then close it (ondismiss above).
    rzp.on("payment.failed", () => {});
    rzp.open();
  });
}
