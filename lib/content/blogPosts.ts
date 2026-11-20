/**
 * Ten blog posts, written in Markdown (see lib/cms/richTextMd.ts) and published by
 * `npm run publish-content:apply`. A post whose slug already exists is left untouched.
 * Every link points at a live page on this site (checked in tests/content-pack.test.ts).
 */
export type BlogPost = { slug: string; title: string; excerpt: string; seoTitle?: string; md: string };

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "indian-wedding-planning-checklist",
    title: "Wedding planning checklist: a month-by-month timeline for Indian weddings",
    excerpt: "What to book, decide and send, and when: a calm, month-by-month plan from the first family meeting to the vidaai.",
    md: `
An Indian wedding is not one event. It is a mehendi, a haldi, a sangeet, the wedding itself and often a reception, each with its own guests, vendors and outfits. The secret to staying calm is simple: decide the big things early, and give every task a month.

Here is a timeline that works for most families. If you have less time, keep the order and squeeze the months together.

## 10 to 12 months before

- Sit down as a family and agree on the **total budget** and who is paying for what.
- Pick a rough guest count. It decides the venue, the catering and most of your costs.
- Shortlist dates, keeping auspicious dates and family availability in mind.
- Book the venue. Popular venues for wedding season go first.

## 8 to 9 months before

- Book the photographer, caterer and decorator. Ask each for a written quote and payment schedule.
- Decide which functions you are having and roughly how many guests each one will have.
- Start the guest list. One shared list is far easier than five separate notebooks. Our [online wedding planner](/planner) lets the whole family add guests to the same list.

## 6 to 7 months before

- Book the mehendi artist, makeup artist, DJ or band, and the pandit or officiant.
- Shop for the main outfits and jewellery, leaving time for alterations.
- Book rooms for outstation guests. Read our guide to [booking stays for wedding guests](/blog/wedding-guest-accommodation-chandigarh-tricity).

## 4 to 5 months before

- Send save-the-dates to outstation guests.
- Finalise the menu for each function.
- Plan transport for guests and the baraat.

## 2 to 3 months before

- Send the invitations. A [digital wedding invite](/shaadi) can go out on WhatsApp in minutes and collect RSVPs for you.
- Confirm the final guest count for each function with the caterer.
- Pay the second instalments to vendors and note every payment down.

## The last month

- Confirm every vendor, with timings and a contact person on the day.
- Make a day-by-day schedule for each function and share it with the family.
- Keep a simple record of shagun and gifts so thank-yous are easy later.

## Keep it all in one place

The checklist is the easy part. The hard part is keeping track of who has paid what, which guests have replied and what is still pending. You can use our [Wedding Planner Sheet](/wedding_planner_sheet) if you love spreadsheets, or the [online planner](/planner) if you want the whole family working from the same screen on their phones.
`,
  },
  {
    slug: "manage-wedding-guest-list-rsvps",
    title: "How to manage your wedding guest list and RSVPs with the whole family",
    excerpt: "Five notebooks, three WhatsApp groups and one very stressed mother: here is a better way to build the guest list together.",
    md: `
Every family has the same guest-list story. Papa has a list, Mummy has a longer list, the bride and groom have their friends, and somebody's cousin is in two lists at once. Then the RSVPs arrive on WhatsApp, on calls and in passing at a family function.

Here is how to keep it under control.

## 1. Start with one list, not five

Agree that there is only one guest list, and that everyone adds to it. Give each person a "side" or group (bride's family, groom's friends, office colleagues) so you can see who invited whom.

## 2. Count households, then people

Add each family as one row, then note how many people are coming. It is much easier to send invitations to 180 families than to work out 640 names.

## 3. Mark which functions each guest is invited to

Not everyone comes to the haldi. Note the functions for each household, so the caterer gets a separate, accurate number for each event.

## 4. Collect RSVPs in one place

Ask guests to reply in one way only. A [digital invite with built-in RSVP](/shaadi) does this for you: guests tap a button, choose how many are coming, and the count updates without anyone typing it in.

## 5. Follow up a week before the deadline

Filter for households who have not replied and share that short list with the family member who knows them best. A friendly call works better than a fourth message.

## 6. Plan rooms and transport from the same list

Outstation guests need somewhere to stay and a way to reach the venue. Mark them in the list, then use it to book rooms. If your wedding is in or near Chandigarh, [Pandora Stays](/stays) lists holiday homes and family stays around the tricity.

## Do it together

The [Pandora online wedding planner](/planner) was built for exactly this: one guest list the whole family can share, with RSVPs, budget, vendors, payments, stays and shagun in the same place. Prefer a spreadsheet? The [Wedding Planner Sheet](/wedding_planner_sheet) has a ready-made guest list tab for Excel and Google Sheets.
`,
  },
  {
    slug: "digital-wedding-invites-vs-printed-cards",
    title: "Digital wedding invites vs printed cards: cost, speed and etiquette",
    excerpt: "Is it okay to invite people on WhatsApp? A practical look at when digital invites make sense, and when a printed card still matters.",
    md: `
Ten years ago, a wedding card was delivered by hand with a box of sweets. Today, most guests first hear about a wedding on WhatsApp. So which should you choose? For most families the answer is both, used in the right places.

## Where digital invites win

- **Speed.** You can send a digital invite to hundreds of guests in an afternoon, wherever they live.
- **Cost.** There is no printing, packing or courier for every guest.
- **Everything in one link.** Dates and timings for every function, the venue on a map, dress codes and even music, all in one place.
- **RSVPs.** Guests reply with a tap, and you see the numbers straight away instead of chasing replies.
- **Easy updates.** If a timing changes, you change it once and everyone sees the new details.

## Where printed cards still matter

- **Elders and close family.** For grandparents, senior relatives and family elders, a card delivered in person shows respect.
- **Tradition.** Some families like a printed card for the puja or to keep as a memory.
- **Guests who are not on WhatsApp.** A small number of guests will always prefer paper.

## The etiquette

A digital invite is not rude, as long as it is personal. Address each guest by name, send it from your own number with a short note, and call the people who matter most. For close family, print a small batch of cards and deliver them by hand, then share the digital invite so they have the details and the map on their phone.

## A simple plan

1. Print a small number of cards for elders and close family.
2. Send a digital invite to everyone else, with RSVPs switched on.
3. Use the RSVP numbers to give your caterer an accurate count for each function.

You can design a beautiful digital invite with RSVPs, maps and music in the [Pandora Wedding Invite Maker](/shaadi), and share it on WhatsApp in minutes. Want help with the words? Read our guide to [wedding invitation wording for every function](/blog/wedding-invitation-wording-ideas).
`,
  },
  {
    slug: "wedding-invitation-wording-ideas",
    title: "Wedding invitation wording for every function: mehendi, haldi, sangeet and the wedding",
    excerpt: "Ready-to-use wording ideas for each function, from formal to fun, plus the details every invitation must include.",
    md: `
Finding the right words for an invitation is surprisingly hard. It needs to be warm, clear and right for the family. Here are simple templates you can adapt for each function.

## What every invitation needs

- Who is inviting (usually the parents or the family)
- The couple's names
- The function, date and time
- The venue, ideally with a map link
- A dress code or theme, if there is one
- How and by when to reply

## The wedding

**Formal:** "With the blessings of our elders, Mr. and Mrs. Sharma request the pleasure of your company at the wedding of their daughter Ananya with Rohan, son of Mr. and Mrs. Mehta, on Sunday, 8 February, at 7 pm, at [venue name], [city]."

**Warm:** "Two families, one celebration. Ananya and Rohan are getting married, and it would not be the same without you. Join us on 8 February at 7 pm."

## Mehendi

"Come for the henna, stay for the music! Join us for Ananya's mehendi on Friday, 6 February, from 4 pm. Wear something green and bring your dancing shoes."

## Haldi

"A little turmeric, a lot of laughter. Join us for the haldi ceremony on Saturday, 7 February, at 11 am. Yellow outfits encouraged, and old clothes recommended!"

## Sangeet

"Practice your best moves. You're invited to the sangeet on Saturday, 7 February, at 8 pm, an evening of music, dance and family performances."

## Reception

"Celebrate the newlyweds with us at a reception in honour of Ananya and Rohan on Monday, 9 February, at 7:30 pm."

## Tips

- Keep each function's invite short, and put the details (map, dress code, timing) right below it.
- Use the same tone across all functions so they feel like one celebration.
- Add a clear RSVP date, about three weeks before the wedding.

With the [Pandora Wedding Invite Maker](/shaadi), each function gets its own section with timings, maps and an RSVP button, and you can share the whole invite on WhatsApp. Then use the replies to [manage the guest list with the whole family](/blog/manage-wedding-guest-list-rsvps).
`,
  },
  {
    slug: "track-wedding-vendor-payments",
    title: "How to track wedding vendor advances and payments without losing a rupee",
    excerpt: "Advances, instalments, cash, UPI and five family members paying different vendors: here is a simple system that keeps it straight.",
    md: `
Wedding payments are messy. The decorator wants 30% now, the caterer wants an advance and a balance on the day, and three different family members are paying three different vendors, some in cash and some by UPI. Weeks later, nobody is sure what is still due.

A simple system fixes this.

## 1. Write down every vendor, before you pay anyone

For each vendor, note the service, contact person, total agreed amount and payment schedule (for example "30% on booking, 50% a month before, 20% on the day"). Ask for the agreement in writing, even if it is only a WhatsApp message.

## 2. Log every payment the same day

For each payment, note the date, the amount, the mode (cash, UPI, bank transfer, card), who paid, and the receipt or transaction ID. Do it the same day. Memory fades fast in wedding season.

## 3. Let the balance calculate itself

Total agreed minus total paid equals the balance due. If you track this in a sheet or an app, you never have to add it up by hand, and the whole family can see what is left.

## 4. Put due dates in one calendar

Most disputes happen when a payment is late or forgotten. List the next due date for every vendor and check the list every week.

## 5. Keep a buffer

Final bills almost always include extras: more guests, extra hours, transport. Keep 10 to 15% of the budget aside for these.

## 6. Settle up after the wedding

Once the celebrations are over, go through every vendor, confirm the final balance, and collect receipts for all payments.

## Tools that do the adding up for you

The [Wedding Planner Sheet](/wedding_planner_sheet) has ready-made budget, vendor and payment tabs for Excel and Google Sheets, with balances and totals already built in. If the family wants to work together on their phones, the [online wedding planner](/planner) keeps vendors, payments and the budget in one place everyone can see. And for the big picture, start with our [month-by-month wedding planning checklist](/blog/indian-wedding-planning-checklist).
`,
  },
  {
    slug: "shagun-gift-tracking",
    title: "Shagun tracking: a simple way to record gifts and say thank you",
    excerpt: "Who gave what, and to whom? Keep a clean shagun record during the wedding so thank-yous and future occasions are easy.",
    md: `
In many Indian families, shagun is more than a gift. It is part of a long relationship between families, and many people like to remember what each family gave, so they can return the gesture at the next wedding in that family.

The problem is that shagun arrives in envelopes, in hands, at the stage and at the door, often in the busiest hours of the wedding. Here is how to keep a clean record.

## Before the wedding

- Choose one or two trusted people to receive shagun at each function.
- Give them a simple list or app to note gifts in, rather than writing on the envelopes alone.
- Decide where the envelopes will be kept safely.

## During each function

For every gift, note:

- The family or guest's name
- The function
- The amount or a short description of the gift
- Who received it

Writing the name on the envelope helps, but a separate record is what saves you when envelopes are opened later.

## After the wedding

- Count the envelopes against your record within a day or two.
- Send thank-you messages. A short, personal WhatsApp message or call means a lot.
- Keep the record somewhere safe. You will want it for the next family wedding.

## Keep it with your guest list

The easiest shagun record is the one linked to your guest list, so each gift sits next to the family who gave it. The [Pandora online wedding planner](/planner) keeps guests, RSVPs and shagun together, so the whole family can see the record on their phones.

Planning everything else as well? Our guide to [tracking vendor payments](/blog/track-wedding-vendor-payments) keeps the money going out as tidy as the money coming in.
`,
  },
  {
    slug: "wedding-guest-accommodation-chandigarh-tricity",
    title: "Where to put up wedding guests: booking stays near Chandigarh, Zirakpur and Panchkula",
    excerpt: "Outstation guests coming for the wedding? How to choose, book and manage stays for family and friends around the tricity.",
    md: `
When relatives travel for a wedding, where they stay shapes their whole experience. Put them close to the venue in a comfortable place and they will remember the wedding fondly. Leave it to the last minute and you will spend the sangeet on the phone arranging rooms.

## Count your outstation guests early

From your guest list, mark every household that is travelling. Note how many people are in each, any elders or small children, and which nights they will stay. Do this four to six months before the wedding, especially in peak season.

## Choose the right kind of stay

- **Holiday homes and family apartments** suit big families who want to stay together, cook a little and have space for the kids.
- **Hotels** suit couples and small groups who want daily housekeeping.
- **A mix** often works best: a large home for close family, and hotel rooms for friends.

## Think about distance

Pick stays within a short drive of the venue. Around Chandigarh, Zirakpur and Panchkula, guests can often reach most wedding venues quickly, but check timings for the evening functions, when traffic is heavier.

## Book in a block, then confirm

Book all stays together if you can, and get the details in writing: check-in and check-out times, the number of guests and the price. A week before, confirm every booking and share the address and map link with each family.

## Share the details with your guests

Send each family a message with their stay, address, map, check-in time and the contact person for any questions. If you are using a [digital wedding invite](/shaadi), you can add a section with travel and stay details.

## Find a stay

[Pandora Stays](/stays) lists holiday homes and family stays around Chandigarh, Zirakpur and Panchkula, so you can find space for the whole family close to the celebrations. And keep track of who is staying where in the [online wedding planner](/planner), alongside your guest list and RSVPs.
`,
  },
  {
    slug: "meta-ad-leads-follow-up",
    title: "Why most Meta ad leads never buy, and the 5-minute follow-up fix",
    excerpt: "You paid for the lead. The ad did its job. Here is why so many Facebook and Instagram leads go cold, and how to fix it.",
    md: `
If you run lead ads on Facebook or Instagram, you know the feeling. The leads come in, the cost per lead looks good, and yet sales barely move. Most of the time, the problem is not the ad. It is what happens after the form is filled.

## Why leads go cold

- **Slow first contact.** Someone fills your form while scrolling at lunch. If you call them the next day, they have forgotten your ad, or spoken to a competitor.
- **No follow-up system.** Many people do not answer the first call. Without a reminder, nobody tries again.
- **Leads in too many places.** Some leads are in the Leads Center, some in a spreadsheet, some in a salesperson's WhatsApp. Some are never called at all.
- **No feedback to the ads.** If you do not know which campaign brings buyers, you keep spending on the ones that only bring clicks.

## The fix: speed, persistence and one list

### 1. Call within minutes

Call new leads as soon as possible, while your ad is still fresh in their mind. If you cannot call, send a short WhatsApp message to say you will call soon.

### 2. Follow up more than once

Plan several attempts over the first few days, at different times of day, with a mix of calls and WhatsApp messages. Most sales come from follow-up, not the first call.

### 3. Log every call outcome

"No answer", "call back tomorrow", "interested", "not interested". Every outcome should create the next action, so no lead is forgotten.

### 4. Keep every lead in one place

Every lead, from every campaign, in one list your whole team can see, with each lead assigned to one person.

### 5. Measure per campaign

Track how many leads from each campaign were qualified and how many bought. Then put your budget behind the campaigns that bring customers.

## A simple tool for this

[LeadFlow CRM](/crm-software) was built for exactly this. Import your Meta leads or connect a Google Sheet, give each caller a Today screen of who to call, follow up with one-tap WhatsApp and calls, and see leads, qualified and won for each campaign. You can try it free for 14 days. Selling property? Read our guide to [real estate lead management](/blog/real-estate-lead-management).
`,
  },
  {
    slug: "real-estate-lead-management",
    title: "Real estate lead management: from ad click to site visit to booking",
    excerpt: "How small real estate teams can turn property enquiries into site visits and bookings, without double-selling a unit.",
    md: `
Real estate sales have a long journey. A buyer sees an ad, fills a form, talks to an agent, visits the site, negotiates and finally books. Each step is a chance to lose them. A clear process, and one shared system, keeps them moving.

## The stages that matter

Define the same stages for everyone on the team, for example:

1. New enquiry
2. Contacted
3. Site visit scheduled
4. Site visit done
5. Negotiation
6. Booked

When everyone uses the same stages, you can see where buyers are getting stuck.

## Capture the right details early

On the first call, note the project the buyer is interested in, their budget and the type of unit (for example 2 BHK or 3 BHK). These three details decide which units to show and how to follow up.

## Make site visits easy

The site visit is where most decisions happen. Confirm the visit the day before, share the location as a map link, and note the outcome the same day, along with the next step.

## Never double-sell a unit

When a buyer is serious, hold the unit for them for a fixed time (for example 48 hours). The whole team should see which units are available, on hold, booked or sold, so two agents never promise the same flat.

## Share projects in a way that creates leads

Send buyers a link to the project or a specific unit, with photos, location and price. When someone enquires from that page, the enquiry should land straight in your lead list.

## Work with channel partners

If brokers bring you buyers, give them a simple way to register customers, and keep track of what each partner has earned.

## One CRM for all of it

[LeadFlow CRM](/crm-software) has a one-click real estate mode that adds projects and a colour-coded unit grid, unit holds that expire on their own, site visit stages, shareable project and unit pages that turn enquiries into leads, and channel partner commissions. It also does everything in our [5-minute follow-up guide](/blog/meta-ad-leads-follow-up). Try it free for 14 days.
`,
  },
  {
    slug: "how-to-finish-a-workout-challenge",
    title: "How to finish a 30-day workout challenge (and actually stick to it)",
    excerpt: "Most challenges fade by week two. Here is how to plan, track and keep going, even after a missed day.",
    md: `
Starting a workout challenge is easy. The first few days feel great. Then life happens: a late night, a busy week, a missed day. By week two, many challenges quietly fade away.

The people who finish are not the most motivated. They have a plan, they track their days, and they know what to do when they slip.

## 1. Pick a challenge that fits your life

Choose something you can do on your busiest day, not your best one. If you are starting from scratch, a beginner home workout or a walking challenge of about 30 minutes a day is a great place to begin. Set a length you believe in, whether that is 14, 30 or 75 days.

## 2. Decide today's workout in advance

"I'll do something" usually turns into nothing. A day-by-day plan removes the decision: you open it, see today's workout, and do it.

## 3. Start easy, then build

Good plans start with a gentle foundation phase, then build up step by step, with recovery days along the way. If day one leaves you too sore to move on day two, you started too hard.

## 4. Track more than workouts

Water, sleep, steps and a few minutes of stretching all add up. Give yourself a short list of daily checkpoints, and count a day as complete when you do the workout and hit most of them.

## 5. Watch your streak

A streak is a powerful motivator. Seeing "12 days in a row" makes it much harder to skip day 13.

## 6. Test yourself and retest

On day one, test a few simple things: push-ups, a plank hold, squats in 60 seconds. Retest a third and two-thirds of the way in. Seeing your plank time double is better motivation than any mirror.

## 7. Never miss twice

You will miss a day. That is normal. The rule is simple: never miss two days in a row. Tomorrow is a fresh start.

## A tracker that does the work

The [Pandora Workout Challenge Tracker](/workout_challange) for Excel and Google Sheets includes six ready-made challenges, from home workouts and walking to Couch to 5K and yoga. You choose any length from 14 to 100 days, and you get a day-by-day plan, a daily tracker with streaks, a meal and body log, a personal records tracker, and a dashboard that shows how far you have come.

Please check with your doctor before starting a new exercise plan, and stop if anything hurts.
`,
  },
];
