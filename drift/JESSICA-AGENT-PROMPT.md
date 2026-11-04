# Instructions for Jessica's design agent — GroupAtion / Team Drift

You are working with Jessica, Team Drift's designer. Ben is the product manager and Ronak is the product marketer. Jessica owns the final UI, interaction design, and visual direction.

## Start safely in your own worktree

1. Fetch the latest `origin/team/drift`.
2. Read `drift/AGENTS.md` and `drift/CLAUDE.md`. Create your own uniquely named local session branch and worktree from the latest remote team branch, following those instructions.
3. Open only the `drift/` folder in that worktree.
4. Read `GROUPATION-PLAN.md`, `JESSICA-DESIGN-HANDOFF.md`, `DATA-MODEL.md`, and `mockdata.md` inside that folder.
5. Run `npm start`. Open `/` to try the working app and `/groupation-wireframe.html` to review Ben's clickable PM wireframe. Use the printed local URL, overriding the port if another local server is using it.

The wireframe and handoff were published on `team/drift` in merge commit `ba83884`. Start from the latest branch, including any newer team work. Preserve Jessica's existing Groupation branding and Ronak's marketing changes.

## What to design and implement

Create a polished group leisure travel experience for bachelor/bachelorette trips, reunions, concerts, and friends travelling abroad together. Use the PM wireframe to understand the proposed information and interactions; improve its visual design rather than copying its low-fidelity styling.

- **Shared trip board:** flights, trains, hotels, Airbnb/VRBO stays, restaurants, concerts, and other activities.
- **Clear trip details:** dates, departure/arrival and local time zones, original currency, price basis, participants, booking state, booking owner, and shared booking/provider links.
- **Contextual discussion:** questions/comments attached to each plan, an All questions view, and general trip chat. Keep each message linked to its context.
- **Friendly member identity:** circular headshots beside messages and in the group member list, visible names, and initials fallbacks. Use real member-provided photos when available. The wireframe's illustrated portraits are fictional examples.
- **Mobile app experience:** responsive phone and desktop layouts, touch-friendly navigation and forms, and a Mobile view / Desktop view button that previews the same state. Plan home-screen installation separately if time allows; do not present a phone preview as a delivered native iOS/Android app.
- **Cute red panda mascot:** starts a little stressed, becomes happier as required plans are completed, becomes travel-ready with sunglasses and a bag, then wears a T-shirt with the current destination's flag. The wireframe includes sample SVG states and a mood selector. Jessica should refine the artwork and motion. Agree with Ben on the progress and arrival rules, and support reduced motion.
- **Potential group offers:** show source, terms, and confirmation status. Do not portray hypothetical discounts as confirmed savings or live provider integrations.

## Coordinate scope and functionality

Coordinate shared frontend file ownership with Ben and Ronak before editing. Preserve Ronak's positioning, landing page, and onboarding work. Preserve the existing create-trip, traveller, itinerary, vote, and revision flows.

Agree on new persisted data fields with Ben. Keep the starter IDs and relationships intact. Use `/api/product` for local product persistence and `/api/events` for usage events, preserving prior data. The standalone wireframe is an in-memory demonstration that resets on reload; its chat is not a live multi-user service. Make implemented product items/comments survive reload through the local API. Keep real booking transactions, payment processing, and external booking integrations outside the class prototype unless separately agreed.

## Verify and publish

- Test the affected flows in the browser and at a narrow phone width, including questions staying attached to the correct item, mobile preview state preservation, form usability, and mascot states.
- Run `npm run check` and inspect the staged file paths.
- Save the v1 screenshots and commit reference inside `drift/`.
- Commit only your intended Drift changes.
- Coordinate one team publisher at a time. Merge ready work through the `team/drift` publish worktree and push only `team/drift`, following `AGENTS.md`.
- Keep session branches local. Do not push to `main` or another team's branch, discard another session's work, or force-push.


## Latest PM refinement: calmer main screen

Use a collapsible left sidebar in the desktop web view for trip sections, general chat, people/status details, and the mascot controls. Keep the main screen focused on the trip title, its primary action, and the selected plans. Hide secondary metrics and demo mood controls under expandable sidebar sections. Open contextual discussions on demand in a side drawer instead of displaying a chat panel permanently. On mobile, use a Trip menu button to reveal the sidebar and keep it closed while browsing plans. The PM wireframe now demonstrates this behaviour.


## Dedicated partner discounts section

Add a visible **Partner discounts** navigation entry, separate from the itinerary. Cover hotel partners, car rentals/vans, local guides, tours/activities, and other travel partners. Each offer must show the provider/source link, eligible dates, expiry, group-size requirements, original price, discount type and amount, currency, fees/exclusions, cancellation terms, and verification status. Keep the final payable total clear. Offer cards can have contextual group questions and a responsible person to check the deal. The wireframe now includes fictional hotel, car rental, and guide offers. These are examples, not existing partnerships, live quotes, negotiated deals, or guaranteed savings. Do not count unverified offers as confirmed trip bookings or mascot readiness.


Ronak has now published redesigned GroupAtion onboarding at `/#new`; preserve that working, persisted flow. The PM planner preview remains separately available at `/groupation-wireframe.html`. Integrate the agreed design into the working product in coordination with the team; do not replace real trip creation with the in-memory preview.
