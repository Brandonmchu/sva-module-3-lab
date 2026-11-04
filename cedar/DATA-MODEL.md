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

Trips → travelers and activities → responses.
The response links one traveler to one activity through their IDs.

Dates use YYYY-MM-DD. Budgets and activity costs use the trip currency and represent one person's amount.
Activities may include an optional `time` in 24-hour HH:MM format (or an empty string for flexible timing). Times are local to the trip; no timezone conversion is performed. Activities sort by date, then time, with flexible activities last.
Availability can conflict with the trip dates. Preferences and votes can conflict too.
Your product decides how to help the group resolve those differences.

The base trip statuses are draft, planning, confirmed, and cancelled.
Activity statuses are proposed, accepted, and removed. Votes are yes, no, and maybe.

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
