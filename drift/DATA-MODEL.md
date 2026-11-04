# Starter data model

Every company starts with the same model and fictional sample data.
The working app uses this model. Your team chooses how to change the product experience.

## Product data

`data/product.json` holds the current product state.
`data/product.schema.json` defines the base fields and types.
The sample has one trip, three travelers, three activities, and two responses.
All prices, places, and people are fictional.

| Collection | Main fields | Relationship |
|---|---|---|
| trips | id, title, destination, start_date, end_date, budget_per_person, currency, status | One trip has many travelers and activities. |
| travelers | id, trip_id, name, available_from, available_to, budget, interests | Each traveler belongs to a trip. |
| activities | id, trip_id, title, date, category, estimated_cost_per_person, status | Each activity belongs to a trip. |
| responses | id, trip_id, traveler_id, activity_id, vote, comment | A traveler responds to an activity in that trip. |
| discussions (GroupAtion) | id, trip_id, activity_id (omit for the general trip thread), traveler_id, body, created_at | A traveler posts a question or comment on one activity, or on the whole trip. Saved locally, not live chat. |

Trips → travelers and activities → responses.
The response links one traveler to one activity through their IDs.

Dates use YYYY-MM-DD. Budgets and activity costs use the trip currency and represent one person's amount.
Availability can conflict with the trip dates. Preferences and votes can conflict too.
Your product decides how to help the group resolve those differences.

The base trip statuses are draft, planning, confirmed, and cancelled.
Activity statuses are proposed, accepted, and removed. Votes are yes, no, and maybe.

GroupAtion adds optional booking fields to activities: booking_state (idea, agreed, pending, booked; missing means idea), booking_owner_id (a traveler on the same trip) and booking_url (a shared link to the provider). A booking link is a reference, not proof of a booking; only booking_state records that.

## Read and save

GET /api/product returns the current product object.
PUT /api/product validates and saves the whole product object to data/product.json.
The server rejects invalid data before it writes the file.
It checks required fields, types, IDs, dates, and relationships.

```js
const product = await fetch('/api/product').then(response => response.json());
product.trips[0].title = 'Our weekend away';
const saved = await fetch('/api/product', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(product)
});
if (!saved.ok) throw new Error((await saved.json()).error);
```

PUT replaces the whole snapshot. Keep the other collections and records when you save a change.
The saved data survives a restart and travels with the team folder in Git.
One shared local screen is enough. Your product does not need accounts or a hosted database.

## Usage events

`data/events.jsonl` records product use. It is separate from the current product snapshot.
Use GET /api/events to read it. Use POST /api/events to append one event or a batch.
The shared event format stays the same. See mockdata.md.

Use a traveler ID as actor_id when it is known. Before that, a fictional visitor ID is enough.
Put trip_id and activity_id in properties when the event concerns those records.
The product snapshot does not need rows for virtual simulation actors.

Suggested event names: landing_viewed, onboarding_started, trip_created, traveler_added, activity_proposed, response_submitted, plan_viewed, plan_updated, plan_confirmed.
Your team can add event names as necessary.

## Extend the model

You can add fields or collections. Preserve the base IDs and relationships for the customer handoff.
If you change base field rules, update data/product.schema.json and the local validation as necessary.
The server validates the subset of schema rules that the starter uses.
Run npm run check before you commit product data or events.

## Shared travel details

Activities may also represent transport, stays, food/activities or partner offers through `plan_kind`. Optional details include provider, local start/end dates and times with IANA time zones, meeting point/route, participants, original provider quote/currency/price basis, offer eligibility/expiry and notes. `estimated_cost_per_person` remains in the trip currency; quotes are displayed separately with no automatic currency conversion. Partner offers are excluded from the itinerary estimate.

Trips may store `country_code` for the destination flag and `mascot_stage` (`auto`, `starting`, `planning`, `relaxed`, `vacation`). Auto follows shared planning, booking status, confirmation and trip dates. Manual mood selection is an MVP preview saved with the trip.

Generated fictional profile photos for the three sample travelers live under `public/avatars/`. Other travelers use initials. Photos are presentation assets, not identity verification or real user photographs. Booking provider flows and sample partner discounts remain explicitly labeled simulations. Planning details, booking ownership, votes, discussions and shared offers use the real local product API and persist.
