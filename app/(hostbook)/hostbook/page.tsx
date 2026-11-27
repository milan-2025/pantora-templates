import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarSync, ClipboardCheck, IdCard, IndianRupee, MessageCircle, ShieldCheck, Users2, Wrench } from "lucide-react";
import { getPayloadClient } from "@/lib/cms/queries";
import { publicPlans } from "@/lib/hostbook/server";
import { FEATURES } from "@/lib/hostbook/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HostBook: guest register, bookings & profit for Airbnb hosts | Pandora Templates",
  description: "Keep guest details and IDs, sync Airbnb and Booking.com calendars, track every expense and see real profit for each listing. Police register and Form C ready. Free for one listing.",
  alternates: { canonical: "/hostbook" },
  openGraph: { title: "Pandora HostBook for Airbnb & homestay hosts", description: "Guest records, online check-in, tasks, expenses and profit for every listing.", url: "/hostbook" },
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const POINTS = [
  { icon: IdCard, title: "Guest register with IDs", text: "Every guest's name, phones, address and ID in one place. Returning guests are spotted by phone number." },
  { icon: ClipboardCheck, title: "Online check-in links", text: "Send a WhatsApp link before arrival. Guests fill in their details, upload IDs and accept your house rules. You choose which fields are required." },
  { icon: IdCard, title: "IDs checked as they're typed", text: "Aadhaar must be 12 valid digits; PAN, voter ID, driving licence and passport numbers are checked too. Something wrong? Ask the guest to fix just that part." },
  { icon: BellRing, title: "Notifications, not inbox clutter", text: "Guest details in, new bookings, today's check-ins and tasks show up under the bell and on your phone. No daily email spam." },
  { icon: CalendarSync, title: "Airbnb & Booking.com sync", text: "Paste your calendar links and bookings come in on their own. One calendar for all your listings." },
  { icon: IndianRupee, title: "Real profit for each listing", text: "Payouts, fees, cleaning, bills, salaries and repairs. A bank-style account statement with a running balance, occupancy, nightly rate and Excel export for your CA." },
  { icon: Wrench, title: "Regular tasks & reminders", text: "AC service every 3 months, bills on the 5th, deep clean monthly. They come back on schedule in a morning email." },
  { icon: Users2, title: "Caretaker accounts", text: "Cleaners and managers get their own sign-in and see only what you allow. IDs and money stay private." },
  { icon: ShieldCheck, title: "Police register & Form C", text: "Print the guest register for any dates. Foreign guests get Form C details ready to copy, with a 24-hour reminder." },
  { icon: MessageCircle, title: "WhatsApp templates", text: "Confirmation, check-in details, checkout reminder and review request, filled in from the booking." },
];

export default async function HostBookLanding() {
  const { plans, extraListingPrice, offerText } = await publicPlans(await getPayloadClient());
  return (
    <div className="bg-sand text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/hostbook" className="flex items-center gap-2 font-serif text-2xl">
          <svg viewBox="0 0 40 40" className="size-9" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#1F5F5B" /><path d="M10 19.5 20 11l10 8.5V29a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 10 29z" fill="#F6F1E9" /><path d="M16 30.5v-7h8v7" fill="#E9A23B" /><circle cx="20" cy="18.5" r="2" fill="#1F5F5B" /></svg>
          HostBook
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <a href="#plans" className="hidden px-3 py-2 sm:block">Plans</a>
          <Link href="/hostbook/app" className="px-3 py-2">Sign in</Link>
          <Link href="/hostbook/app?signup=1" className="rounded-full bg-teal px-4 py-2 text-white">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.1fr_.9fr] md:pt-16">
        <div>
          <p className="mb-3 inline-block rounded-full bg-mist px-3 py-1 text-xs font-semibold text-teal">For Airbnb, homestay & serviced-apartment hosts</p>
          <h1 className="font-serif text-5xl leading-[1.05] md:text-6xl">Every guest, booking and rupee. One book.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink/70">Keep a proper guest register with IDs, sync your Airbnb calendar, hand jobs to your caretaker and finally see what each listing really earns.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/hostbook/app?signup=1" className="rounded-full bg-teal px-6 py-3 font-semibold text-white">Start free: 1 listing</Link>
            <a href="#plans" className="rounded-full border border-ink/15 bg-white px-6 py-3 font-semibold">See plans</a>
          </div>
          {offerText && <p className="mt-4 text-sm font-semibold text-rust">{offerText}</p>}
          <p className="mt-4 text-xs text-muted">No card needed · Works on your phone, even offline · Yearly plans, no auto-renewal</p>
        </div>
        <div className="relative">
          <div className="rounded-[2rem] border border-line bg-white p-5 shadow-xl shadow-teal/10">
            <p className="text-xs text-muted">Thursday, 26 November</p>
            <p className="font-serif text-2xl">Good morning</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["2", "Arriving"], ["1", "Leaving"], ["78%", "Occupancy"]].map(([v, k]) => <div key={k} className="rounded-xl bg-sand p-2"><div className="font-serif text-2xl">{v}</div><div className="text-[10px] text-muted">{k}</div></div>)}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {[["Riya Mehta", "Pine View 2BHK · 3 nights", "Details OK"], ["James Clarke", "Studio 7 · 2 nights", "Form C due"], ["AC service", "Pine View · every 3 months", "Today"]].map(([a, b, c]) => (
                <div key={a} className="flex items-center justify-between rounded-xl border border-line px-3 py-2"><div><b>{a}</b><p className="text-xs text-muted">{b}</p></div><span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold text-teal">{c}</span></div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-teal p-3 text-white"><p className="text-xs text-white/70">November profit so far</p><p className="font-serif text-2xl">₹48,320</p></div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-2xl font-serif text-4xl">Built for how hosts in India actually work</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title}><div className="mb-3 grid size-11 place-items-center rounded-xl bg-mist text-teal"><Icon className="size-5" /></div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-ink/65">{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-serif text-4xl">Simple yearly plans</h2>
        <p className="mt-2 text-ink/65">Prices include GST. Need more listings? Add them for {inr(extraListingPrice)} each a year on any paid plan.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={`flex flex-col rounded-3xl border bg-white p-5 ${p.badge ? "border-teal ring-2 ring-teal" : "border-line"}`}>
              <div className="flex items-center justify-between"><h3 className="text-xl font-semibold">{p.name}</h3>{p.badge && <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-teal">{p.badge}</span>}</div>
              {p.tagline && <p className="text-sm text-muted">{p.tagline}</p>}
              <p className="mt-3 font-serif text-4xl">{p.isFree ? "Free" : inr(p.price)}<span className="font-sans text-sm text-muted">{p.isFree ? "" : " /year"}</span></p>
              <p className="mt-1 text-sm font-medium">{p.listings} listing{p.listings === 1 ? "" : "s"} · {p.staff} staff</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-ink/75">
                <li>✓ Bookings, calendar & guest register</li>
                <li>✓ Income & expenses</li>
                <li>✓ ID photos kept {p.idDays >= 365 ? `${Math.round(p.idDays / 365)} year${p.idDays >= 730 ? "s" : ""}` : p.idDays >= 60 ? `${Math.round(p.idDays / 30)} months` : `${p.idDays} days`}</li>
                {FEATURES.filter((f) => p.features.includes(f.key)).map((f) => <li key={f.key}>✓ {f.label}</li>)}
                {p.highlights.map((h) => <li key={h}>✓ {h}</li>)}
              </ul>
              <Link href="/hostbook/app?signup=1" className={`mt-5 rounded-full px-4 py-2.5 text-center text-sm font-semibold ${p.badge ? "bg-teal text-white" : "bg-mist text-teal"}`}>{p.isFree ? "Start free" : `Start free, upgrade anytime`}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="mb-6 font-serif text-3xl">Questions</h2>
        {[
          ["What if a guest makes a mistake?", "Aadhaar, PAN, voter ID, driving licence and passport numbers, phones and emails are checked as the guest types, so most mistakes never reach you. If something still needs fixing, tap \u201cAsk guest to fix\u201d on the booking: their link opens again with everything filled in and the parts you picked marked. Guests can also update their own details until you approve them."],
          ["Can I choose what guests must fill in?", "Yes. Under Settings \u2192 Check-in form, tick the fields that are required: phone, email, address, ID number, ID photos (front and back), and more. Apply them to the main guest or to every adult."],
          ["Will HostBook fill my inbox?", "No. Updates appear under the bell in the app and, if you allow it, as notifications on your phone. A morning summary email is optional and off unless you turn it on."],
          ["Is my guests' ID data safe?", "ID photos are stored privately and can only be opened through short-lived links by you and staff you allow. They're deleted automatically after your plan's keep period. The written register stays for your records."],
          ["Does it connect to Airbnb?", "Yes, through Airbnb's calendar export link (and Booking.com's). Bookings and blocked dates come in every few hours. Airbnb doesn't share guest names in the calendar, so HostBook sends each guest a check-in link to fill in their details."],
          ["Can my caretaker use it?", "Yes. Add them under Team with their own email. They see check-ins, tasks and cleaning lists, and can add expenses, without seeing IDs or your income unless you allow it."],
          ["What happens when my plan ends?", "Nothing is deleted. Paid features lock until you renew, and you can keep using the free features."],
          ["I list on Pandora Stays. Do I pay?", "Open HostBook from your Stays host portal and you get the Starter plan free while you're a Stays host."],
        ].map(([q, a]) => <details key={q} className="mb-2 rounded-2xl border border-line bg-white p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm text-ink/70">{a}</p></details>)}
      </section>
      <footer className="border-t border-line py-8 text-center text-xs text-muted">© Pandora Templates · <Link href="/" className="underline">pandoratemplates.com</Link></footer>
    </div>
  );
}
