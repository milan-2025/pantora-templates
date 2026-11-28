import { ToolPage, toolMetadata } from "@/components/tools/ToolPage";
import { WeddingBudgetCalculator } from "@/components/tools/WeddingBudgetCalculator";

export const metadata = toolMetadata("wedding-budget", "Wedding Budget Calculator for Indian Weddings (free)");

/** pandoratemplates.com/wedding-budget-calculator: free, no sign-in; leads to the wedding planner. */
export default function Page() {
  return (
    <ToolPage
      toolKey="wedding-budget"
      eyebrow="Free tool · no sign-up"
      heading="How much will our wedding cost?"
      intro="Pick your city, style, guest count and functions. You get a budget range and a split by venue, food, decor, outfits, photos and more, in seconds."
      guide={[
        { title: "Start with the guest list", text: "Food and venue are usually 40–50% of the total, and they grow with every plate. Cutting 50 guests saves more than any decor change." },
        { title: "Keep a 10% buffer", text: "Extra guests, overtime for the band, tips and last-minute shopping always come up. The estimate adds 10% so you aren't caught short." },
        { title: "Track what you actually spend", text: "Write down every advance and balance as you book vendors, so the family knows what is paid and what is still due." },
      ]}
      faq={[
        { question: "How much does an Indian wedding cost?", answer: "With this calculator's typical prices, a mid-range wedding for 300 guests in a city like Chandigarh or Jaipur with Haldi, Mehendi, Sangeet and the wedding comes to roughly ₹21–28 lakh. A simple wedding for 200 guests in a smaller town is closer to ₹6–8 lakh, and a grand six-function wedding for 500 guests in a metro is around ₹1 crore or more. Put your own numbers into the calculator above." },
        { question: "What is the biggest wedding expense?", answer: "Venue and catering, usually 40–50% of the budget, because they are charged per plate for every function. Outfits and jewellery, decor and photography come next." },
        { question: "How accurate is this calculator?", answer: "It uses typical 2025–26 prices for Indian cities and gives a range of about 15% either side. Real quotes depend on your dates (wedding season costs more), vendors and negotiation, so use it to set a starting budget." },
        { question: "How do I keep track of the wedding budget?", answer: "Write down every vendor's quote, advance and balance with the due date. The Pandora Online Wedding Planner does this with the whole family on one plan, and reminds you before each payment is due. The 14-day trial is free." },
      ]}
    >
      <WeddingBudgetCalculator />
    </ToolPage>
  );
}
