# GroupAtion — PM wireframe and design handoff

## People and purpose

- Ben: product manager — features and behaviour.
- Jessica: designer — UI, interaction design, and visual direction.
- Ronak: product marketer — positioning, landing page, and onboarding.

Customer: leisure groups travelling together, including bachelor/bachelorette parties, reunions, and friends travelling to concerts.

Product promise: help the group agree on a trip and keep the plans, bookings, prices, and conversations in one place.

## Open the clickable wireframe

Run `npm start` from `drift/`, then open:

`http://127.0.0.1:3004/groupation-wireframe.html`

Source: `drift/public/groupation-wireframe.html`.

This is a low-fidelity PM proposal, using fictional sample data. Its changes stay in memory and reset on reload. It does not write product data, make bookings, process payments, retrieve provider prices, or offer a live multi-user chat. The production app remains at `/`.

## Screens and flows for Jessica

### 1. Shared trip board

Trip header: name, occasion, destination, dates, and traveller count.

Sections: Overview; Flights & trains; Places to stay; Food & activities; All questions.

Each plan or booking card shows:

- Type/provider: flight, train, hotel, Airbnb, VRBO, restaurant, concert, or other activity.
- Title, relevant dates/times, and explicit time zones for international journeys.
- Price, original currency, and price basis: per person, group total, per night, or per room/night.
- Booking state: Idea → Group agreed → Booking pending → Booked.
- Who shared it and who is responsible for booking it.
- Shared provider/booking link, participants, and notes people need to coordinate.
- A Discuss action and comment count tied to this specific plan.

For actual arrival/departure and check-in/check-out screens, show separate relevant times and time zones. A traveller's flight can have a different departure zone and arrival zone.

Do not add prices in different currencies together without an explicit conversion source and rate. The class MVP can show separate currency subtotals instead.

### 2. Share a plan or booking

The wireframe's “Share a plan or booking” dialog demonstrates entry of a title, section, provider, date/time/time zone, price/currency/basis, booking state, link, and notes.

Treat links as shared references to an external provider. Opening a link is not evidence that something has been booked. A user must explicitly record a booking state.

### 3. Ask questions in context

“Discuss” on a card opens its conversation, with the plan title visible above the messages. A member can post a question or comment while viewing that plan.

Keep conversations separate for each plan. A question about a flight must not appear in the hotel's thread. “All questions” lists discussions with their context, and “General trip discussion” holds questions about the whole trip.

For the class app, persist messages locally with the supplied product API. Do not label local file storage as a live chat shared across different laptops. No chat service is required for this prototype.

### Group photos and friendly conversation

Use round member headshots beside chat messages, in the current-person control, and in the trip's member list. Keep each person's name visible, with clear authorship and comfortable spacing. Use a friendly, approachable visual treatment. The wireframe uses fictional illustrated sample portraits; real group headshots must come from member-provided profile photos. Provide an initials fallback and accessible labels when a photo is missing. Do not substitute stock portraits as real members.

### 4. Potential group offers

Hotels, Airbnb/VRBO hosts, transport, or activities may have group offers. This is an idea to explore, not an existing commercial integration or guaranteed discount.

An offer should show its source, terms, group size requirement, and verification state. Unverified offers must be labelled clearly. Do not count hypothetical savings in a confirmed price.

## Cute red panda trip mascot

The mascot is a cute red panda whose mood follows the group's planning progress. Keep the tone warm, encouraging, playful, and visually consistent across desktop and mobile.

- **Just starting:** a little stressed or overwhelmed while key trip details are undecided.
- **Planning:** becomes more relaxed and happier as the group adds details and agrees on decisions.
- **Travel-ready:** happy, wearing sunglasses and carrying a travel bag when the required essentials are ready.
- **At the destination:** wears a T-shirt with the flag for the trip's explicitly selected current location. The demo uses Portugal for its fictional Lisbon trip. For multi-country trips, update the shirt for the current stop.

The wireframe includes a mascot-state preview selector and a simple illustrative progress response. Jessica should refine the artwork and motion. Agree with Ben on production readiness rules: use confirmed required details, not the number of optional items. Arrival/current location should be explicit trip state; do not infer physical location from the browser. Use a text mood label, accessible alternatives, and reduced-motion behaviour. The prototype's SVG is a functional art placeholder, not the final character asset.

## Mobile app and preview requirements

GroupAtion must support a mobile app experience as well as desktop. The wireframe includes a **Mobile view / Desktop view** button: it switches the same live demo into a 390-pixel phone layout without discarding the current discussion or shared items.

For Jessica's product UI:

- Design for a narrow phone screen first, with desktop layouts built from the same components and data.
- Add a clearly labelled Mobile view / Desktop view button to the class demo. It previews the app's layout and keeps the same state; it must not create a separate disconnected version of the trip.
- On phones, use a compact section switcher or bottom navigation, single-column booking cards, and full-width discussion panels or sheets. Keep the plan context visible while asking a question.
- Use touch targets of at least 44 pixels, labelled inputs, readable text, visible focus, and controls that work without hover. Keep the message composer usable with the mobile keyboard.
- Verify that cards, dialogs, booking links, dates, currency labels, and discussions fit at 390 pixels with no horizontal page scrolling.
- Plan a home-screen-installable mobile web app as the first mobile deliverable if time allows. Verify current platform requirements using official platform documentation when implementing installation and offline support. Do not cache stale booking states as if they were confirmed live information.
- A desktop phone preview alone is not an installed iOS/Android app. Native app packaging, distribution, and device testing remain follow-up work unless explicitly implemented and verified.

## Recommended first slice for this class

1. Organize shared trip items into the sections above while keeping the starter trip flow working.
2. Show booking details and clear price/currency/time-zone labels.
3. Add per-item questions/comments and a general trip discussion.
4. Add a simple manual booking status and booking owner.
5. Keep group offers as a clearly labelled future idea if time is short.

## Suggested data contract, for coordination

Preserve the starter's trips, travellers, activities, responses, and IDs. Proposed additions can be scoped to the current trip:

- `bookingItems`: ID, trip ID, section/type, title, provider, provider URL, dates/times/time zones, original price/currency/basis, participant IDs, booking state, owner, notes, and optional offer details.
- `discussions`: ID, trip ID, context type (`general` or `booking_item`), optional item ID, author/traveller ID, body, and timestamp.

These collections are proposals, not implemented API fields. Agree on the schema with Ben before multiple agents implement it. Persist through `/api/product`; append real usage to `/api/events`, preserving earlier events. Read `DATA-MODEL.md` and `mockdata.md` and run `npm run check` before publishing.

## Acceptance checks

- A traveller can find a flight, stay, or activity and understand its date, time zone, price basis, booking state, and owner.
- A question posted to one item remains associated with that item and is discoverable through All questions.
- General questions remain separate from individual booking threads.
- Once implemented in the app, saved items/comments survive reload through local product persistence.
- Sample prices and unverified group offers cannot be mistaken for live confirmed deals.
- The existing create trip, add traveller, itinerary, vote, and revise flows still work.
- The layout supports a narrow mobile screen as well as desktop; controls have labels and keyboard focus states.

## Copy/paste prompt for Jessica's agent

You are working with Jessica, the designer for Team Drift's GroupAtion app. Ben is PM and Ronak owns marketing. Fetch the latest `origin/team/drift`, read `drift/AGENTS.md` and `drift/CLAUDE.md`, and create a unique local session branch/worktree from that remote team branch. Open only its `drift/` folder.

Read `drift/GROUPATION-PLAN.md`, this `drift/JESSICA-DESIGN-HANDOFF.md`, `drift/DATA-MODEL.md`, and `drift/mockdata.md`. Run the app and open `/groupation-wireframe.html` to review the PM's clickable proposal. Carry forward Jessica's Groupation branding commit `0055822`. Use the wireframe to understand structure and behaviour; Jessica owns the final visual design.

Include the cute red panda trip buddy: initially stressed, increasingly happy as required plans are completed, travel-ready with sunglasses and a bag, and wearing the current destination’s flag on a T-shirt at arrival. Refine the sample SVG and agree on progress/arrival states with Ben. Design the shared trip dashboard and booking cards for flights/trains, hotels/Airbnb/VRBO, restaurants, concerts, and other activities. Make dates, time zones, original currency, price basis, booking state, responsible person, and shared links clear. Design a mobile app experience as well as desktop, and add a Mobile view / Desktop view button that previews the same app and preserves its current state. Use touch-friendly phone navigation, cards, forms, and contextual discussion panels. Treat home-screen installation as a separate implementation task and do not claim native iOS/Android delivery from a responsive preview alone. Use friendly circular member headshots beside messages and in the trip member list, with member names and initials fallbacks. The wireframe portraits are fictional samples; use actual member-provided photos in the product. Add an interaction design for questions/comments attached to each item, an All questions view, and general trip discussion. Distinguish proposed group offers from confirmed prices. Keep real booking/payment integrations outside the class MVP.

Coordinate actual code/file ownership with Ben and Ronak before editing shared frontend files. Preserve Ronak's landing-page/onboarding copy and existing working trip flows. Agree on new persisted data fields with Ben; the standalone wireframe is an in-memory demonstration, not the finished feature. If a backend field is unavailable, label the UI as a proposal rather than pretending it works.

Work only within `drift/`. Run `npm run check`, verify the affected flows in the browser and on a narrow screen, and save the v1 screenshot and commit reference inside the team folder. Commit only your intended Drift paths. Coordinate one team publisher, merge ready work into the `team/drift` publish worktree, and push only `team/drift`. Keep session branches local; do not push to `main` or other teams' branches.
