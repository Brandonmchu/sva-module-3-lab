# Mock data

All data in this project is fictional.

The local data store is data/events.jsonl. Each line is one JSON event.
The file starts empty. It is tracked in Git, so a commit includes your data.
The schema is in data/schema.json.

## Shared event shape

| Field | Meaning |
|---|---|
| id | A unique event ID |
| event | The event name your product uses |
| actor_id | A fictional customer or user ID |
| at | A UTC ISO timestamp with milliseconds |
| source | Where the event came from, such as product or a reviewer team |
| properties | An object for any product-specific values |

Keep these shared fields. Put extra fields inside properties.
Event names and properties are open. The product problem is not set yet.

This is a format example. It is not in the data file:

```json
{"id":"example-001","event":"signup","actor_id":"customer-001","at":"2026-11-03T23:00:00.000Z","source":"example","properties":{"scenario":"format example"}}
```

## Use the data

GET /api/events returns all events.

POST /api/events appends one event or an array of events.
Supply event and actor_id.
The server fills id, at, source, and properties if absent.

The server rejects invalid rows and duplicate IDs.

Your agent can also append complete rows directly to data/events.jsonl.
Run npm run check before you commit.

Reload the app after a pull or data change.

For a customer simulation, use fictional actors and identify your team in source.
Record qualitative feedback and explain the simulation in feedback.md.
Commit both the feedback and the changed data file.
