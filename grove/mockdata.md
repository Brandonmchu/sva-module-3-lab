# Mock data

All data in this project is fictional.

## Start with the product model

Read DATA-MODEL.md. The starter already has one trip, three travelers, three activities, and two responses.
The current product state is data/product.json. The schema is data/product.schema.json.

GET /api/product reads the current state.
PUT /api/product validates and saves the whole state.
The saved file survives a restart and stays inside this team folder.

## Product use

The event store is data/events.jsonl. Each line is one JSON event.
The file starts empty. It is tracked in Git, so a commit includes your data.
The event schema is data/schema.json.

| Field | Meaning |
|---|---|
| id | A unique event ID |
| event | The event name your product uses |
| actor_id | A fictional visitor or traveler ID |
| at | A UTC ISO timestamp with milliseconds |
| source | product, simulation, or another identified source |
| properties | Product values such as trip_id, activity_id, and reviewer_team |

Keep these shared fields. Put extra values inside properties.
Use the same actor_id across one customer's journey.
Use a traveler ID when it is known. A fictional visitor ID is enough before that.

This example is not in the event file:

```json
{"id":"example-001","event":"response_submitted","actor_id":"traveler-001","at":"2026-11-03T23:00:00.000Z","source":"example","properties":{"trip_id":"trip-001","activity_id":"activity-003","vote":"yes"}}
```

GET /api/events returns all events.
POST /api/events appends one event or an array of events.
Supply event and actor_id. The server fills id, at, source, and properties if absent.
The server rejects invalid rows and duplicate IDs.

Your agent can also append complete rows directly to data/events.jsonl.
Run npm run check before you commit. Reload the app after a pull or data change.

## Customer rotation

Change only the host feedback.md, data/product.json, and data/events.jsonl during the customer phase.
Keep the host product code intact. Save snapshot changes from actual product use.
Use the host product normally first. Then describe what happened in feedback.md.

For the simulation, set source to "simulation" and identify the reviewer team in properties.reviewer_team.
Create journeys for exactly 100 distinct fictional actor_id values across group trips.
Keep customer and trip references consistent. Simulation actors do not need product snapshot records.

Append records to the event file. Preserve all earlier data. Use unique event IDs.
The scenario can include completed plans, abandoned journeys, and changes to dates or budgets.
Explain the scenario assumptions in feedback.md.
Commit the feedback, product snapshot, and event file.
