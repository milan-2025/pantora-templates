import { ToolPage, toolMetadata } from "@/components/tools/ToolPage";
import { AirbnbProfitCalculator } from "@/components/tools/AirbnbProfitCalculator";

export const metadata = toolMetadata("airbnb-profit", "Airbnb Profit Calculator India: homestay income & break-even (free)");

/** pandoratemplates.com/airbnb-profit-calculator: free, no sign-in; leads to HostBook. */
export default function Page() {
  return (
    <ToolPage
      toolKey="airbnb-profit"
      eyebrow="Free tool · no sign-up"
      heading="Is my Airbnb making money?"
      intro="Put in your nightly rate, occupancy and costs. See your monthly and yearly profit, the occupancy you need to break even, and how long it takes to earn back the setup cost."
      guide={[
        { title: "Know your break-even", text: "Rent, bills and staff have to be paid even in an empty month. The break-even occupancy tells you how many nights you must sell before you make a rupee." },
        { title: "Direct bookings pay more", text: "Every repeat guest who books on WhatsApp saves you the platform fee. Moving 20% of bookings direct can add thousands a month." },
        { title: "Count every cleaning", text: "Short stays mean more cleanings and laundry. If most guests stay one night, a minimum stay or a cleaning fee can change your profit a lot." },
      ]}
      faq={[
        { question: "How much does an Airbnb earn in India?", answer: "It depends on rate, occupancy and costs. With the calculator's starting numbers (₹3,500 a night, 55% occupancy, ₹18,000 rent, a caretaker and bills), a rented flat leaves only about ₹4,800 a month and needs close to 49% occupancy just to cover its costs. The same flat if you own it (no rent) leaves around ₹23,000 a month. Use the calculator with your own numbers." },
        { question: "How much commission does Airbnb take from hosts?", answer: "With the split fee, hosts usually pay about 3% and guests pay a service fee on top. With the host-only fee, hosts pay around 14–16% and guests pay no service fee. Check the fee in your own payout report, as it can change." },
        { question: "What GST applies to homestays?", answer: "From 22 September 2025, room nights up to ₹1,000 have no GST, ₹1,001 to ₹7,500 are taxed at 5% (without input tax credit), and above ₹7,500 at 18%. Tick \"My rate includes GST\" if you are registered and pay it out of your rate. Ask your CA about your own case." },
        { question: "What occupancy is good for an Airbnb?", answer: "Around 50–65% across the year is healthy for city homestays, with weekends and holidays fuller than weekdays. Look at the break-even figure: if it is above 70%, the listing has little room for a slow month." },
      ]}
    >
      <AirbnbProfitCalculator />
    </ToolPage>
  );
}
