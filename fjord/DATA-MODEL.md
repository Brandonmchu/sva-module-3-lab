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
Fjord adds ideas_requested. See Interest suggestions below.

## Interest suggestions (Fjord)

Each traveler card shows the top 3 things to do at the trip destination for each of that traveler's interests.
The local server asks the Gemini API, so the key never reaches the browser.

- **Key and models:** `.env` in this folder holds `GEMINI_API_KEY`. Optional `GEMINI_MODEL` defaults to `gemini-3.6-flash`. Optional `GEMINI_FALLBACK_MODEL` defaults to `gemini-3.5-flash-lite`. Real environment variables win over `.env`. UTF-8 (with or without a BOM) and UTF-16 files both load.
- **One lookup per interest:** the server looks up the trip's uncached interests in parallel, at most 12 per request. A busy or rate-limited answer (429, 500 or 503) is retried once, then sent to the fallback model.
- **Cache:** `data/suggestions.json` stores results by trip, destination, currency, and lowercase interest. Each lookup runs once. Changing the trip destination or currency triggers a fresh lookup.
- **Interest parsing:** a leading "and" or "&" is stripped, so "Food, photography, and sights" becomes Food, photography, sights.

```json
{ "version": 1, "lookups": [ { "id": "suggestion-…", "trip_id": "trip-001", "destination": "Quebec City", "currency": "CAD", "interest": "food",
  "model": "gemini-3.6-flash", "created_at": "2026-11-04T01:25:00.000Z",
  "ideas": [ { "title": "…", "description": "…", "estimated_cost_per_person": 45 } ] } ] }
```

GET /api/suggestions returns the cache.
POST /api/suggestions with `{ "trip_id": "…" }` looks up the trip's missing interests. It returns `{ lookups, added, failed, remaining }`, where `remaining` counts interests left for the next request.
Without a key it returns 503 with a setup message.
The suggestions cache is separate from data/product.json. PUT /api/product never changes it.
When a lookup finishes, the planner redraws only the ideas area of each traveler card. Unsaved votes and comments are kept.
The `ideas_requested` event records:
- `trip_id` and `traveler_id`
- `outcome`: found or failed
- `new_lookups`, `failed_lookups`, and `remaining_lookups`
- `reason` for a failure: not_configured, gemini_error, or request_failed

## Extend the model

You can add fields or collections. Preserve the base IDs and relationships for the customer handoff.
If you change base field rules, update data/product.schema.json and the local validation as necessary.
The server validates the subset of schema rules that the starter uses.
Run npm run check before you commit product data or events.
