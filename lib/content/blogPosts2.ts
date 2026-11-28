/**
 * Fifteen more blog posts: five each for Self-Improvement, Business Software and Hosts & Hospitality.
 * Published once by the "2026-11-blog-categories" content release (see lib/content/blogRelease.ts), with a cover
 * image each. A post whose slug already exists is left untouched. Every link points at a live page (tested).
 */
import type { BlogPost } from "./blogPosts";

export type CategorisedPost = BlogPost & { category: "self-improvement" | "business" | "hospitality" };

export const BLOG_POSTS_2: CategorisedPost[] = [
  /* ---------------- Self-Improvement ---------------- */
  {
    category: "self-improvement",
    slug: "home-workout-plan-for-beginners",
    title: "A 4-week home workout plan for beginners (no equipment)",
    excerpt: "Four weeks, 20 to 30 minutes a day, nothing but a mat. A simple plan that builds strength and stamina without a gym.",
    md: `
You don't need a gym, a trainer or fancy equipment to get fitter. You need a plan that tells you exactly what to do today, and that starts easy enough that you actually do it.

This four-week plan uses only your body weight. Most days take 20 to 30 minutes. If a move feels too hard, use the easier version and keep going: finishing beats perfect form on day one.

## Before you start

- Clear a space the size of a yoga mat. A towel works too.
- Warm up for five minutes every day: march on the spot, arm circles, hip circles and ten slow squats.
- Check with your doctor first if you have a health condition, are pregnant, or haven't exercised in years.

## Week 1: learn the moves

Three rounds of this circuit, resting a minute between rounds, on Monday, Wednesday and Friday. Walk for 20 minutes on the other days.

- 10 squats (or sit-to-stand from a chair)
- 8 knee push-ups (or wall push-ups)
- 20-second plank (on your knees is fine)
- 10 glute bridges
- 30 seconds of marching on the spot

## Week 2: a little more

Add one round, so you do four. Hold the plank for 30 seconds. Keep walking on rest days, and try to make one walk brisk enough that talking feels a little hard.

## Week 3: add a move

Add 10 reverse lunges (5 each leg) and 20 seconds of jumping jacks (or step jacks) to each round. Work out four days this week instead of three.

## Week 4: build stamina

Do the full circuit four times, five days this week. Try a 40-second plank. On one rest day, go for a 30-minute walk.

## How to stay on track

The hardest part of any plan is day 9, not day 1. Three things help more than anything else:

1. **Same time every day.** Attach the workout to something you already do, like right after your morning tea.
2. **Track it.** A tick on a calendar or a streak in an app makes skipping feel like losing something.
3. **Tell someone.** A friend who knows you're doing it will ask.

[Pandora Workout](/workout) does all three for you: it shows today's workout, counts the reps with you, keeps your streak, and lets friends and family join the same challenge. Prefer paper and spreadsheets? The [Workout Challenge Tracker](/workout_challange) works in Excel and Google Sheets.

## After week 4

Repeat the last week with harder versions of each move, or start a longer challenge. Our guide on [how to finish a workout challenge](/blog/how-to-finish-a-workout-challenge) has tips for the days you don't feel like it, and you'll find more in [Self-Improvement](/self-improvement).
`,
  },
  {
    category: "self-improvement",
    slug: "how-to-build-an-exercise-habit",
    title: "How to build an exercise habit that lasts",
    excerpt: "Motivation fades by week two. Habits don't. Here's how to make exercise automatic, with small starts, cues and streaks.",
    md: `
Almost everyone starts a fitness plan with energy. By the second week, work gets busy, a wedding comes up, it rains, and the plan quietly stops. That isn't a lack of willpower. It's what happens when exercise depends on motivation instead of habit.

A habit is something you do without deciding to. Here's how to get exercise there.

## Start smaller than feels useful

Ten minutes a day you actually do beats an hour a day you skip. Start with a workout so short it feels almost silly, and grow it after two weeks. The goal of the first month is not fitness. It's showing up.

## Give it a cue

Habits stick to things you already do. Pick one cue and use it every day:

- After brushing your teeth in the morning
- When you get home from work, before you sit down
- Straight after dropping the children at school

"I'll work out sometime today" almost never happens. "I work out after my morning tea" does.

## Make it easy to start

Lay out your clothes the night before. Keep the mat on the floor. Have today's workout already decided, so there's nothing to think about. Every small decision you remove makes it easier to begin.

## Use streaks, but plan for breaks

A streak, the number of days in a row you've done something, is a surprisingly strong motivator. Nobody wants to break a 20-day streak for one lazy evening.

But you will miss a day. Plan for it now: **never miss twice**. One missed day is life. Two in a row is the start of quitting. Some apps give you a "streak freeze" for exactly this.

## Do it with someone

People are far more likely to keep going when someone else is involved. A friend, your spouse, your siblings on a family group, or colleagues at the office. Our guide on [running a family or office fitness challenge](/blog/family-fitness-challenge) shows how to set one up.

## Reward the process, not just the result

Weight and inches change slowly, and some weeks they don't move at all. Celebrate the days you showed up instead: a small treat at 7 days, something bigger at 30.

## Tools that help

[Pandora Workout](/workout) is built around these ideas: a short daily plan, a streak with freezes, gifts at milestones, and friends or a buddy who notice when you skip. It also offers a money-back promise for people who log their workouts all year, which is a strong reason not to quit.

More guides are in [Self-Improvement](/self-improvement).
`,
  },
  {
    category: "self-improvement",
    slug: "family-fitness-challenge",
    title: "Get fit together: how to run a family or office fitness challenge",
    excerpt: "A shared challenge is the easiest way to keep everyone going. How to pick the challenge, set the rules and keep it fun.",
    md: `
Exercising alone is hard. Exercising when your sister, your father and three cousins can see whether you did today's workout is a lot easier. A group challenge turns fitness into something you do together, with a little friendly competition.

Here's how to run one with your family, friends or office team.

## 1. Pick one simple goal

Choose something everyone can do, whatever their fitness level:

- 30 days of a 20-minute home workout
- 8,000 steps a day for a month
- A yoga or stretching session every morning for 21 days

Keep it about showing up, not about who is fittest. That way your 60-year-old uncle and your gym-going cousin can both win.

## 2. Set clear rules

Agree on these before day one:

- What counts as done (for example, any workout of 20 minutes or more)
- The deadline each day (midnight is easiest)
- What happens if you miss a day: are you out, or do you get one free miss a week?

## 3. Make progress visible

The magic of a group challenge is seeing each other's ticks. A shared sheet, a WhatsApp group where everyone posts "done", or an app where the group's streaks are on one screen.

## 4. Add a small prize

It doesn't need to be big. The person with the longest streak picks the restaurant, or everyone who finishes gets a treat. Prizes for finishing work better than prizes for winning, because nobody gives up when they fall behind.

## 5. Check in weekly

A short message every Sunday keeps energy up: who's on a streak, a photo from someone's morning walk, encouragement for whoever missed a few days.

## Running it in Pandora Workout

[Pandora Workout](/workout) is made for this. Create a group, share the code on WhatsApp, and everyone joins the same challenge. The group screen shows each person's streak and today's tick, and the yearly plans include free places for family and friends.

New to working out? Start with our [4-week home workout plan for beginners](/blog/home-workout-plan-for-beginners). More in [Self-Improvement](/self-improvement).
`,
  },
  {
    category: "self-improvement",
    slug: "walking-to-running-first-5k",
    title: "From walking to your first 5K: a beginner's guide",
    excerpt: "Never run before? This eight-week walk-run plan takes you from brisk walks to running 5 km without stopping.",
    md: `
Running 5 km without stopping sounds impossible if you've never run. It isn't. With a gradual walk-run plan, most healthy adults can get there in about eight weeks, three sessions a week.

## The idea: mix walking and running

You don't start by running. You start by walking briskly with short bursts of easy running, and slowly make the running parts longer. Your heart, lungs, legs and joints all get time to adapt.

**Easy running** means a pace where you could still speak in short sentences. If you can't, slow down.

## The 8-week plan

Do each session three times in the week, with a rest day in between. Always start with a 5-minute brisk walk and finish with a 5-minute slow walk.

- **Week 1:** run 1 minute, walk 2 minutes. Repeat 8 times.
- **Week 2:** run 2 minutes, walk 2 minutes. Repeat 6 times.
- **Week 3:** run 3 minutes, walk 2 minutes. Repeat 5 times.
- **Week 4:** run 5 minutes, walk 2 minutes. Repeat 4 times.
- **Week 5:** run 8 minutes, walk 2 minutes. Repeat 3 times.
- **Week 6:** run 12 minutes, walk 2 minutes, run 12 minutes.
- **Week 7:** run 20 minutes, walk 2 minutes, run 10 minutes.
- **Week 8:** run 30 minutes without stopping. That's roughly 5 km for most beginners.

If a week feels too hard, repeat it. There's no prize for rushing.

## Shoes, timing and safety

- A comfortable pair of running shoes matters more than anything else you'll buy.
- Early morning is cooler and less crowded. In summer, avoid the afternoon heat and carry water.
- A little muscle soreness is normal. Sharp pain is not: stop and rest.
- Check with your doctor first if you have heart, joint or blood pressure concerns.

## Keep it going

Running is a habit like any other. Read [how to build an exercise habit that lasts](/blog/how-to-build-an-exercise-habit), and track your sessions so you can see the weeks add up.

[Pandora Workout](/workout) includes a Couch to 5K challenge with a session for every day, a timer that tells you when to run and walk, and a streak to keep you honest. More guides are in [Self-Improvement](/self-improvement).
`,
  },
  {
    category: "self-improvement",
    slug: "track-fitness-progress-without-scale",
    title: "Tracking progress beyond the weighing scale",
    excerpt: "The scale is the least useful way to see progress. Measurements, photos, fitness tests and streaks tell you much more.",
    md: `
You've been working out for three weeks, you feel stronger, and the scale hasn't moved. It's one of the most common reasons people give up. It's also a sign you're measuring the wrong thing.

Body weight goes up and down by a kilo or more in a single day with water, salt and food. When you exercise, you may also be building muscle while losing fat. The scale can't tell the difference.

## Better ways to see progress

### 1. Body measurements

Measure your waist, hips, chest and upper arms once every two weeks, at the same time of day. Inches often drop while weight stays the same.

### 2. Progress photos

Take a front and side photo every two weeks in the same spot, same light and similar clothes. Changes you can't see day to day are obvious side by side after a month. Keep them private: they're for you.

### 3. Simple fitness tests

Every four weeks, test:

- How many push-ups (or knee push-ups) you can do in a row
- How long you can hold a plank
- How long it takes to walk or run 1 km

These numbers improve steadily, and they show the real point of training: you're getting fitter.

### 4. How you feel

Note your energy, sleep and mood once a week. Climbing stairs without getting out of breath, sleeping better, fewer back aches: these count.

### 5. Consistency

The number of days you showed up is the one number you fully control. A 30-day streak is a result in itself.

## Keep it all in one place

Scattered notes get lost. Use one tracker for workouts, measurements and photos, so you can look back over months.

- The [Workout Challenge Tracker](/workout_challange) for Excel and Google Sheets has tabs for your daily log, body measurements and fitness tests, with charts.
- [Pandora Workout](/workout) keeps your log, private before-and-after photos, measurements and a year heatmap of every day you trained, and it can import the Excel tracker.

For your next step, read [how to finish a workout challenge](/blog/how-to-finish-a-workout-challenge), or see everything in [Self-Improvement](/self-improvement).
`,
  },

  /* ---------------- Business Software ---------------- */
  {
    category: "business",
    slug: "does-your-business-need-a-crm",
    title: "Does your small business need a CRM? 7 signs you've outgrown Excel and WhatsApp",
    excerpt: "Spreadsheets and WhatsApp work until they don't. Seven signs it's time for a simple CRM, and what to look for.",
    md: `
Most small businesses in India run sales on a mix of Excel sheets, WhatsApp chats and someone's memory. That works for the first few dozen customers. Then leads start slipping through, and nobody can say exactly why sales are down this month.

A CRM (customer relationship management) system is simply one place where every lead, call and follow-up lives. Here's how to tell if you need one.

## 7 signs it's time

1. **Leads are called hours or days late.** By then they've spoken to your competitor.
2. **Follow-ups depend on memory.** "I'll call him next week" turns into never.
3. **Two people call the same lead,** or nobody does, because nobody is sure who owns it.
4. **You can't see what was said.** When a salesperson leaves, their customer history leaves with them.
5. **Your spreadsheet has versions.** "Leads_final_v3_updated.xlsx" on three different laptops.
6. **You don't know which ads work.** You spend on Facebook and Instagram, but can't say which campaign brings paying customers.
7. **You spend your evenings chasing your team** for updates instead of reading a report.

If three or more of these sound familiar, a simple CRM will pay for itself quickly.

## What to look for in a small-business CRM

- **Works on the phone.** Your team lives on WhatsApp; the CRM must open on their phones.
- **A clear daily list.** Each person should see exactly who to call today, with overdue follow-ups at the top.
- **One-tap WhatsApp and calls,** logged automatically.
- **Easy imports** from your Meta leads file, CSV or Google Sheet, with duplicates skipped.
- **Roles.** Callers see their own leads; owners see everything.
- **Simple pricing.** Per-company pricing is far cheaper than per-user pricing for small teams.

## Where to start

[LeadFlow CRM](/crm-software) is built for small Indian teams that get leads from ads. It has a Today screen, one-tap WhatsApp and calls, Google Sheets sync and campaign reports, from ₹249 a month for the whole company, with a 14-day free trial. Selling property? [LeadFlow for Real Estate](/real-estate-crm) adds inventory and site visits.

Next, read [why most Meta ad leads never buy](/blog/meta-ad-leads-follow-up), or see all our [Business Software](/business).
`,
  },
  {
    category: "business",
    slug: "whatsapp-follow-up-message-templates",
    title: "WhatsApp follow-up messages that get replies: 12 templates for sales teams",
    excerpt: "Copy-ready WhatsApp messages for the first contact, follow-ups, quotes, site visits and lost leads, with tips on timing.",
    md: `
WhatsApp is where Indian customers actually reply. But a vague "Hi, any update?" gets ignored. Good follow-up messages are short, personal and give the customer an easy next step.

Here are 12 templates you can copy, with {name} where the customer's name goes.

## First contact (within 5 minutes of the enquiry)

1. "Hi {name}, this is Priya from Sunrise Interiors. Thanks for your enquiry about modular kitchens. Is now a good time for a 2-minute call?"
2. "Hi {name}, thanks for filling in our form. I've sent you our price list. Which size are you looking for: 2BHK or 3BHK?"

## When they don't pick up

3. "Hi {name}, I tried calling about your enquiry. When would be a better time to talk today?"
4. "Hi {name}, quick question so I can help better: is this for your home or your office?"

## After sending a quote

5. "Hi {name}, did you get a chance to look at the quote? Happy to explain any line item."
6. "Hi {name}, the offer price on the quote is valid till Saturday. Should I block it for you?"

## Booking a visit or demo

7. "Hi {name}, we have slots on Thursday at 11 am or Saturday at 4 pm for a site visit. Which suits you?"
8. "Reminder: your visit is tomorrow at 11 am. Here's the location: [map link]. See you there!"

## After a visit or meeting

9. "Hi {name}, thank you for visiting today. Any questions from the family? I can share the floor plan again."
10. "Hi {name}, sharing the photos and price sheet we discussed, so everyone at home can see them."

## Re-opening a cold lead

11. "Hi {name}, we spoke last month about {product}. We have a new offer this week. Would you like the details?"
12. "Hi {name}, just checking: are you still looking, or have you already decided? Either way is fine, it helps me plan."

The last one works surprisingly well: people reply to an honest question.

## Tips that matter more than the words

- **Speed beats wording.** A reply within 5 minutes converts far better than a perfect message the next day.
- **One question per message.** Make it easy to reply in a word.
- **Log every message,** so whoever picks up the lead next knows what was said.
- **Respect "no".** Stop after the customer says they aren't interested.

## Send these in one tap

In [LeadFlow CRM](/crm-software), you save templates like these once. Each caller taps WhatsApp on a lead and the message opens with the customer's name filled in, and the action is logged. Read more about [following up Meta ad leads fast](/blog/meta-ad-leads-follow-up), or see all our [Business Software](/business).
`,
  },
  {
    category: "business",
    slug: "track-which-ads-bring-customers",
    title: "Which ads actually bring customers? Tracking leads from Meta ads to sales",
    excerpt: "Clicks and leads aren't sales. How to follow each lead from the ad that brought it to the money it made.",
    md: `
Ads Manager tells you how many leads each campaign brought. It doesn't tell you which of those leads bought. So most businesses keep spending on the campaign with the cheapest leads, which is often the one with the worst customers.

Here's how to see what each ad really earns.

## Step 1: keep the campaign name on every lead

When a lead arrives, from a Meta lead form, a website form or a Google Sheet, its campaign or ad name must come with it and stay on the lead forever. In Meta lead forms, include the campaign and ad name in your download or sync. On your website, use UTM tags in the ad link (for example, utm_campaign=diwali_offer).

## Step 2: mark what happens to every lead

Every lead should move through a few clear stages: New, Contacted, Qualified, Proposal or Visit, Won or Lost. When a lead is won, note the sale value.

This is the step most teams skip, and the one that makes everything else possible.

## Step 3: compare campaigns on sales, not leads

Once a month, make a simple table for each campaign:

- Leads
- Qualified leads
- Won
- Sales value
- Ad spend
- **Cost per sale** = spend ÷ won

You'll usually find a surprise. A campaign with ₹80 leads might bring one sale in fifty, while one with ₹200 leads closes one in ten.

## Step 4: move the budget

Put more money into the campaigns with the lowest cost per sale, not the lowest cost per lead. Pause or rework the rest. Repeat next month.

## Common mistakes

- **Judging too early.** Some leads take weeks to buy. Look at least a month back.
- **Not logging lost reasons.** "Too expensive" and "wrong location" are different problems with different fixes.
- **Slow follow-up.** Even the best campaign looks bad if leads wait a day for a call. See [why most Meta ad leads never buy](/blog/meta-ad-leads-follow-up).

## Do it without spreadsheets

[LeadFlow CRM](/crm-software) keeps the campaign on every lead, tracks each lead's stage, and shows leads, qualified and won per campaign in its report, so you can see which ads sell. Real estate teams can do the same per project with [LeadFlow for Real Estate](/real-estate-crm). More in [Business Software](/business).
`,
  },
  {
    category: "business",
    slug: "real-estate-site-visit-to-booking",
    title: "How to turn more site visits into bookings",
    excerpt: "For builders and brokers: what to do before, during and after a site visit so more buyers book.",
    md: `
In real estate, the site visit is where buyers decide. A buyer who has visited is many times more likely to book than one who has only seen an ad. Yet many visits end with "we'll discuss at home" and are never followed up.

Here's a simple process for before, during and after the visit.

## Before the visit

- **Confirm the day before** on WhatsApp with the time, the location pin and the name of the person who will meet them.
- **Know the buyer.** Budget, family size, preferred floor and facing, loan or self-funded. Read the notes from earlier calls.
- **Hold the right units.** If the buyer liked two specific flats, put a short hold on them so nobody else sells them that day.
- **Remind again** two hours before.

## During the visit

- **Show the home, not the brochure.** Walk them through the actual unit they're interested in, then the amenities.
- **Involve the whole family.** The decision is usually made by three or four people. Ask what the parents care about.
- **Talk numbers clearly.** Base price, charges, payment plan and loan help. Confusion kills deals.
- **Agree on a next step before they leave:** a second visit, a call with the loan team, or a token amount.

## After the visit (the part most teams miss)

- **Same evening:** a thank-you message with the floor plan, price sheet and photos, so the family can discuss at home.
- **Day 2 or 3:** a call to answer questions from the family.
- **Within a week:** an update, such as a unit being booked nearby or a payment plan option, to keep the conversation alive.
- **Log the outcome** of every visit: interested, needs a second visit, budget issue or not interested, with a reason.

## Measure it

Track three numbers each month: visits scheduled, visits done, and bookings from visits. If many visits are scheduled but not done, your reminders need work. If many are done but few book, look at pricing, the unit shown or the follow-up.

## Tools that help

[LeadFlow for Real Estate](/real-estate-crm) has site visit scheduling (visits show on each caller's Today screen), unit holds that expire on their own, stages from visit to booking, and shareable project pages whose enquiries become leads. Read our guide to [real estate lead management](/blog/real-estate-lead-management) and [managing channel partners](/blog/channel-partner-management-real-estate), or see all our [Business Software](/business).
`,
  },
  {
    category: "business",
    slug: "channel-partner-management-real-estate",
    title: "Managing channel partners in real estate: registrations, disputes and commissions",
    excerpt: "Clear rules for registering buyers, avoiding disputes about who brought whom, and paying commissions on time.",
    md: `
Channel partners, the brokers who bring buyers to your project, can be a builder's biggest source of sales. They can also be the biggest source of arguments: two partners claiming the same buyer, a partner and your own team both calling the same family, commissions paid late or wrong.

Most of these problems come from one thing: no single record of who registered which buyer, and when.

## Rule 1: register before the visit

A partner gets credit for a buyer only if they register the buyer (name and phone number) before the buyer's first visit or call with your team. Put this in the partner agreement, and stick to it.

## Rule 2: first registration wins

If two partners register the same phone number, the first one gets the buyer. If your own team already has that buyer as a lead, the buyer stays with your team. This removes most disputes before they start.

## Rule 3: partners see only their own buyers

Partners should see the status of their own buyers (visited, negotiating, booked) and the project's availability, never your other leads or who is holding which unit.

## Rule 4: commissions are tied to bookings

When a unit is booked by a partner's buyer, the commission should be calculated right away: the agreed percentage of the sale value, recorded as pending. When the buyer's payments reach the agreed milestone, it moves to approved, then paid. If a booking is cancelled, the commission is cancelled too.

## Rule 5: one place, visible to everyone who needs it

Spreadsheets on different laptops are where disputes are born. Use one system where registrations have a timestamp, and both you and the partner can see the same status.

## What partners appreciate

- Quick confirmation that their buyer is registered
- Live availability, so they don't sell a flat that's already gone
- Commission statements they can check themselves
- Being paid on time

A builder who is easy to work with gets more of a partner's best buyers.

## Tools that help

[LeadFlow for Real Estate](/real-estate-crm) gives each channel partner their own login. They register buyers, see only their own, and track commissions, with "first registration wins" built in. Read [how to turn more site visits into bookings](/blog/real-estate-site-visit-to-booking), or see all our [Business Software](/business).
`,
  },

  /* ---------------- Hosts & Hospitality ---------------- */
  {
    category: "hospitality",
    slug: "guest-register-id-checks-for-hosts",
    title: "Guest registers and ID checks for homestay and Airbnb hosts in India",
    excerpt: "What guest details hosts usually need to keep, how to collect IDs without paper, and how to keep them safe.",
    md: `
If you host guests in India, whether on Airbnb, Booking.com or directly, you are usually expected to keep a record of who stays and to check their identity. Local police and state rules differ, so always check what your area requires. But the basics are similar almost everywhere.

## What a guest register usually includes

- Full name of every adult guest
- Address and phone number
- ID type and number (Aadhaar, passport, driving licence, voter ID)
- Check-in and check-out date and time
- For foreign guests: passport and visa details, and nationality
- Purpose of visit and where they're coming from

Some police stations ask hosts to share the register regularly or keep it ready for inspection. Foreign guests have extra requirements: see our guide to [Form C for foreign guests](/blog/form-c-foreign-guests-guide).

## Collecting IDs without the paperwork

The old way is a notebook at the door and photocopies of IDs. It's slow when guests arrive tired, easy to lose, and hard to search later.

A better way:

1. Send each guest a check-in link before they arrive.
2. They fill in their details and upload ID photos from their phone.
3. You check the details, and approve or ask them to fix something.
4. The register is ready to print for any date range.

## Check the IDs properly

- Make sure the name on the ID matches the booking.
- Check the number format: an Aadhaar number is 12 digits and has a check digit; a PAN has 5 letters, 4 digits and a letter.
- Look at the photo on arrival, not just the upload.

## Keep the data safe

Guest IDs are sensitive. Store them privately, share them only with people who need them (not every cleaner), and delete ID photos after you no longer need them. Never forward IDs on WhatsApp groups.

## How HostBook helps

[HostBook](/hostbook) sends guests a check-in link, checks ID numbers as they type (Aadhaar with its check digit, PAN, passport and more), stores ID photos privately with links that expire, prints the police register for any dates, and deletes old ID photos on schedule. Your caretaker sees only what you allow.

More guides for hosts are in [Hosts & Hospitality](/hospitality).
`,
  },
  {
    category: "hospitality",
    slug: "get-direct-bookings-for-your-homestay",
    title: "How to get direct bookings for your homestay (and keep the commission)",
    excerpt: "Platforms bring guests but take a cut. Simple ways to win repeat and direct bookings without losing your listings.",
    md: `
Airbnb, Booking.com and other platforms are great for being found. But every booking costs you a commission, and the guest belongs to the platform. Direct bookings, where guests contact and pay you directly, keep that money with you and build a base of repeat guests.

You don't have to leave the platforms. The aim is to add a direct channel next to them.

## 1. Have a simple website of your own

Guests who loved their stay, or who heard about you from a friend, need somewhere to find you. A simple page with your photos, prices, location area, house rules and free dates is enough. It looks professional and gives people a link to share.

## 2. Make enquiring easy

Indian guests prefer WhatsApp. A "message us on WhatsApp" button with the dates and number of guests already filled in turns a visitor into a conversation in one tap.

## 3. Look after past guests

Your best source of direct bookings is people who already stayed. With their permission:

- Thank them after check-out, and invite them back with a small returning-guest discount.
- Send a message before long weekends and holidays when they might travel again.
- Ask happy guests to recommend you to friends and family.

## 4. Use social media where your guests are

A few good photos and short videos on Instagram, with your booking link in the bio, bring steady enquiries, especially for family stays and workations.

## 5. Keep your calendar in one place

The biggest risk with direct bookings is a double booking. Sync your platform calendars, so a night booked on Airbnb is blocked everywhere, and add direct bookings to the same calendar.

## 6. Stay within platform rules

Don't ask platform guests to cancel and rebook directly, and don't share contact details through the platform where it's not allowed. Build your direct channel with new and returning guests the right way.

## Your own booking website, free with HostBook

[HostBook](/hostbook) gives every host a booking page at pandoratemplates.com/h/your-name, with your photos, prices and a calendar of free dates taken from your bookings and synced Airbnb and Booking.com calendars. Guests send an enquiry to your WhatsApp with their dates already filled in, and there's no booking fee.

Read [how to work out profit per listing](/blog/homestay-profit-per-listing), or see more in [Hosts & Hospitality](/hospitality).
`,
  },
  {
    category: "hospitality",
    slug: "form-c-foreign-guests-guide",
    title: "Form C for foreign guests: a simple guide for homestay and Airbnb hosts",
    excerpt: "Hosting a guest from abroad? What Form C is, when it's due, what details you need, and how to stay organised.",
    md: `
When a foreign national stays at a hotel, guest house, homestay or Airbnb in India, the host is required to report their stay to the immigration authorities. This report is commonly called Form C, and it's submitted online. Rules and portals can change, so check the official Bureau of Immigration and FRRO websites and your local police for the current process.

## What Form C is

Form C is a record of a foreign guest's stay: who they are, their passport and visa details, and where and when they are staying. It helps the authorities know where foreign visitors are staying in India.

## When it's due

The general rule is to submit it within 24 hours of the guest's arrival. Hosts usually need to register their property on the official portal once, and then submit a form for each foreign guest.

## Details you'll need from the guest

- Full name as in the passport, nationality, date of birth and gender
- Passport number, place and date of issue, and expiry date
- Visa number, type, place and date of issue, and expiry date
- Date of arrival in India and at your property
- Address in their home country and contact number
- Where they arrived from and where they're going next
- Expected date of departure

Collect these before check-in, so you're not chasing a tired traveller for visa dates at midnight.

## Tips to stay organised

- **Ask for passport and visa photos in advance** through a check-in link.
- **Set a reminder** the moment a foreign guest checks in.
- **Keep a copy** of each submission with the booking.
- **Store passport scans securely** and delete them when you no longer need them.

## How HostBook helps

[HostBook](/hostbook) collects passport and visa details through the guest's check-in link, lays out the Form C details ready to copy into the official portal, and reminds you within the 24 hours. Read about [guest registers and ID checks](/blog/guest-register-id-checks-for-hosts), or see more in [Hosts & Hospitality](/hospitality).
`,
  },
  {
    category: "hospitality",
    slug: "homestay-profit-per-listing",
    title: "Is your Airbnb actually profitable? How to work out profit per listing",
    excerpt: "Bookings feel like income, but fees, cleaning, bills and repairs add up. A simple way to see what each listing really earns.",
    md: `
A busy calendar feels like success. But many hosts with several listings don't know which ones actually make money once every cost is counted. The answer is usually a surprise.

## Start with what you really receive

Use your **payout**, not the booking price. Platform fees, taxes and payment charges come off before the money reaches you. For direct bookings, use what the guest actually paid.

## List every cost, per listing

Split your costs into two groups.

**Costs for each stay:**
- Cleaning and laundry
- Toiletries, tea, coffee and water
- Breakfast or welcome items, if you provide them

**Monthly costs:**
- Rent or EMI
- Electricity, water, gas and internet
- Caretaker or staff salary (split across listings if shared)
- Maintenance and repairs
- Society charges and taxes

## The simple formula

**Profit for the month = total payouts − cost per stay × number of stays − monthly costs**

Then look at two more numbers:

- **Occupancy:** nights booked ÷ nights in the month
- **Average nightly rate:** total payouts ÷ nights booked

## What the numbers tell you

- **High occupancy, low profit?** Your price is probably too low, or cleaning costs are eating each stay. Try a minimum stay of two nights or a cleaning fee.
- **Low occupancy, good rate?** Work on photos, reviews and direct bookings. See [how to get direct bookings](/blog/get-direct-bookings-for-your-homestay).
- **One listing always behind?** Look at its fixed costs. Sometimes one property quietly loses money every month.

## Make it a monthly habit

Fill in the numbers on the 1st of every month. Six months of data will tell you which listings to keep, which to improve and when to raise prices.

## Without the spreadsheet

[HostBook](/hostbook) records each booking's payout, fees and cleaning, your expenses and repeating bills like rent and internet, and shows profit, occupancy and nightly rate for every listing, with a statement your CA will like. Read [the turnover cleaning checklist](/blog/homestay-cleaning-checklist), or see more in [Hosts & Hospitality](/hospitality).
`,
  },
  {
    category: "hospitality",
    slug: "homestay-cleaning-checklist",
    title: "A turnover cleaning checklist for homestays (and how to hand it to your caretaker)",
    excerpt: "The room-by-room checklist that keeps reviews at five stars, and how to make sure it's done the same way every time.",
    md: `
Guests forgive a lot, but not a dirty bathroom or a hair on the pillow. Cleanliness is the most common reason for a bad review, and it's almost always a checklist problem: something was missed because it wasn't written down.

Here's a turnover checklist you can use between every check-out and check-in.

## Bedroom

- Strip and change all bed linen and pillow covers
- Check under the bed and behind the furniture
- Dust surfaces, switches and the headboard
- Empty the dustbin and replace the liner
- Check the wardrobe for left-behind items and spare hangers

## Bathroom

- Clean the toilet, sink, shower and mirror
- Remove hair from drains
- Replace towels, soap, shampoo and toilet paper
- Check that the geyser and exhaust fan work
- Mop the floor and wipe it dry

## Kitchen

- Wash and put away all dishes
- Clean the stove, counter and sink
- Check the fridge, throw away leftovers and wipe the shelves
- Refill tea, coffee, sugar and drinking water
- Empty the bin

## Living area

- Vacuum or sweep and mop the floors
- Dust the TV, remote, tables and windowsills
- Straighten cushions and throws
- Check that the Wi-Fi works and the details card is in place

## Final checks

- All lights, fans and AC work and remotes have batteries
- Windows and doors lock properly
- Note anything broken or damaged, with a photo
- Note supplies that are running low

## Making sure it's done every time

A checklist only works if it's used. Three things help:

1. **Give it to your caretaker as a checklist on their phone,** not a list stuck to the wall.
2. **Ask for a photo** of the made bed and the bathroom when they finish.
3. **Keep damage and low stock in one place,** so you can fix and restock before the next guest.

## How HostBook helps

[HostBook](/hostbook) creates a cleaning checklist for every check-out automatically, your caretaker ticks it off on their own login, and low stock and damage are logged with photos. Read [how to work out profit per listing](/blog/homestay-profit-per-listing), or see more in [Hosts & Hospitality](/hospitality).
`,
  },
];
