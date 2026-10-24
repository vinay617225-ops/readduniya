import { api, json } from "./api";
import type { Book } from "./types";
type PaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (p: PaymentResponse) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};
declare global {
  interface Window {
    Razorpay?: new (o: CheckoutOptions) => {
      open: () => void;
      on: (name: string, cb: () => void) => void;
    };
  }
}
let checkoutScript: Promise<void> | undefined;
async function loadCheckout() {
  if (window.Razorpay) return;
  checkoutScript ||= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScript = undefined;
      reject(new Error("Unable to load secure checkout. Please try again."));
    };
    document.head.appendChild(script);
  });
  await checkoutScript;
}
export async function purchase(book: Book): Promise<void> {
  await loadCheckout();
  const order = await api<{
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
  }>(`/books/${book.id}/orders`, json("POST"));
  await new Promise<void>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Checkout unavailable."));
      return;
    }
    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: "ReadDuniya",
      description: book.title,
      theme: { color: "#173d35" },
      modal: {
        ondismiss: () =>
          reject(
            new Error(
              "Checkout closed. Your payment history is available in your library.",
            ),
          ),
      },
      handler: async (result) => {
        try {
          await api("/payments/verify", json("POST", result));
          resolve();
        } catch {
          reject(
            new Error(
              "Payment is awaiting capture or reconciliation. Check your library shortly; do not pay again.",
            ),
          );
        }
      },
    });
    checkout.on("payment.failed", () =>
      reject(
        new Error(
          "Payment failed. Check your purchase history before retrying.",
        ),
      ),
    );
    checkout.open();
  });
}
export async function downloadBook(bookId: number) {
  const result = await api<{ url: string }>(
    `/books/${bookId}/download-link`,
    json("POST"),
  );
  window.location.assign(result.url);
}
