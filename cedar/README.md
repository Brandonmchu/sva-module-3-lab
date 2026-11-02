# Cedar

This folder is your whole project. It has no dependency on another team folder.

## Your company

Your company helps groups of friends plan a weekend away that everyone wants to join.
Use AI for as much of the work as you can. Your team chooses how the company operates.

The minimum product must let customers:

- Create a trip with a destination, dates, and a budget per person.
- Add each traveler's availability, budget, and interests.
- Make a shared itinerary with activities and estimated costs.
- Respond to the plan and revise it.

Save trip data and changes in data/events.jsonl so they survive a restart.
Mock travel details are enough. You can take turns as different travelers on one local screen.

## Three phases

1. Build your first product: 30 minutes, including setup. Save a v1 screenshot and commit reference in your folder.
2. Use another team's product: 30 minutes. Give qualitative feedback and add journeys for 100 distinct simulated customers.
3. Analyze and iterate: 30 minutes. Use 15 minutes to improve and retest, then 15 minutes for all five team presentations.

Each team presents for three minutes: original product, feedback and data, then the iteration and retest.
Explain what AI did and what your humans decided.

Your team uses **Drift** during the customer rotation.

## Run it

Install Node.js 24 LTS if you do not already have Node.js 22 or newer.

From this folder:

```sh
npm start
```

Open http://127.0.0.1:3003.
No package install, account, API key, or hosted database is needed.
Use Ctrl+C to stop.

Open this folder in your AI coding tool.
Start with AGENTS.md and mockdata.md.

## Files

| File | Use |
|---|---|
| AGENTS.md | Your team's agent instructions |
| mockdata.md | Shared data format and examples |
| data/schema.json | Shared event schema |
| data/events.jsonl | The committed local data store |
| feedback.md | Notes from the customer rotation |
| public/ | The prototype; index.html is the current start page |
| app.mjs | Local server and event API |
| package.json | Start and data-check commands |

## Build and exchange

Replace the starter page with your prototype.
Keep the project runnable from this folder with npm start.
Keep the shared event format so another team can add simulation data.

During a customer rotation, run drift/ as the active project.
Change only the host feedback.md and data/events.jsonl in this phase.
Add observations to that folder's feedback.md.
Add simulated events to that folder's data/events.jsonl.
Commit the changes so the original team can pull them.

```sh
npm run check
```

This checks the event format and duplicate IDs.
Git handoff commands are in the repository README.
