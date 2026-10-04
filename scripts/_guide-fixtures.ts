// TEMPORARY: demo data for the client guide screenshots (deleted afterwards).
import { getPayload } from "payload";
import config from "@payload-config";

const payload = await getPayload({ config });
const ctx = { disableRevalidate: true };
const mode = process.argv[2] ?? "setup";
const product = (await payload.find({ collection: "products", where: { slug: { equals: "wedding_planner" } }, limit: 1 })).docs[0];

if (mode === "setup") {
  await payload.create({ collection: "users", data: { email: "owner@pandoratemplates.com", password: "guide-demo-123", name: "Owner" } });
  const aff = await payload.create({
    collection: "affiliates",
    data: { name: "Priya Sharma", code: "PRIYA10", discountPercent: 10, commissionPercent: 20, active: true, email: "priya@example.com", payoutDetails: "UPI: priya@okaxis" },
  });
  await payload.create({ collection: "affiliates", data: { name: "Wedding Wali Didi", code: "DIDI15", discountPercent: 15, commissionPercent: 25, active: true } });
  const file = await payload.create({
    collection: "product-files",
    data: { note: "guide-demo" },
    file: { data: Buffer.from("demo"), mimetype: "text/plain", name: "wedding-planner-v1.xlsx", size: 4 },
  });
  await payload.update({
    collection: "products",
    id: product.id,
    context: ctx,
    data: {
      downloadFile: file.id,
      price: 2999,
      offer: { enabled: true, price: 2100, endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), cap: 200, showCountdown: true, showStock: true },
    },
  });
  const people = [
    ["Ananya Rao", "Bengaluru", aff.id],
    ["Rohit Mehta", "Jaipur", null],
    ["Sneha Kulkarni", "Pune", aff.id],
    ["Arjun Singh", "Chandigarh", null],
  ] as const;
  let i = 0;
  for (const [name, city, affiliate] of people) {
    i++;
    const list = 2100;
    const discount = affiliate ? 210 : 0;
    await payload.create({
      collection: "orders",
      data: {
        orderId: `demo_${1000 + i}`,
        product: product.id,
        paymentStatus: "paid",
        paidAt: new Date(Date.now() - i * 47 * 60_000).toISOString(),
        customerName: name,
        email: `${name.split(" ")[0].toLowerCase()}@example.com`,
        phone: "9876543210",
        city,
        listPrice: list,
        discountAmount: discount,
        amount: list - discount,
        offerApplied: true,
        promoCode: affiliate ? "PRIYA10" : undefined,
        affiliate: affiliate ?? undefined,
        commissionAmount: affiliate ? Math.round((list - discount) * 0.2) : 0,
        commissionStatus: affiliate ? "pending" : "none",
        provider: "mock",
      },
    });
  }
  await payload.create({
    collection: "contact-submissions",
    data: { name: "Kavya Nair", email: "kavya@example.com", phone: "9876500000", message: "Hi! Does the planner work for a 3-day wedding with mehendi and sangeet?", page: "/wedding_planner", handled: false },
  });
  console.log("guide fixtures ready");
}

if (mode === "teardown") {
  await payload.delete({ collection: "orders", where: { orderId: { like: "demo_" } } });
  await payload.delete({ collection: "affiliates", where: { code: { in: ["PRIYA10", "DIDI15"] } } });
  await payload.delete({ collection: "contact-submissions", where: { id: { exists: true } } });
  await payload.delete({ collection: "product-files", where: { note: { equals: "guide-demo" } } });
  await payload.delete({ collection: "users", where: { email: { equals: "owner@pandoratemplates.com" } } });
  await payload.update({
    collection: "products",
    id: product.id,
    context: ctx,
    data: { downloadFile: null, price: 2100, offer: { enabled: false, price: null, endsAt: null, cap: 200, showCountdown: true, showStock: true } },
  });
  console.log("guide fixtures removed");
}
process.exit(0);
