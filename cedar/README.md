# Cedar

This folder is your whole project. It has no dependency on another team folder.

## Your company

Your company helps groups of friends plan a weekend away that everyone wants to join.
Use AI for as much of the work as you can.

The minimum product must let customers:

- Create a trip with a destination, dates, and a budget per person.
- Add each traveler's availability, budget, and interests.
- Make a shared itinerary with activities and estimated costs.
- Respond to the plan and revise it.

Include a landing page with clear positioning and a simple path to the first trip.
Save product state in data/product.json. Record product use in data/events.jsonl.
Use the supplied model and fictional sample data. Read DATA-MODEL.md before you build.

## Three people, three roles

Assign one person to each role:

| Role | Responsible for |
|---|---|
| Product manager | Features and product behavior |
| Designer | Design, interaction design, and product aesthetics |
| Product marketer | Positioning, the landing page, and onboarding |

Each person leads their area and uses AI to do as much work as possible.
Work together on decisions that cross roles.

## Three phases

1. Build: 30 minutes, with four minutes of setup and 26 minutes to build. Save a v1 screenshot and commit reference.
2. Be customers: 30 minutes. Give qualitative feedback and create journeys for 100 distinct simulated customers.
3. Analyze and iterate: 30 minutes. Improve and retest for 15 minutes, then present in the main room for 15 minutes.

Each of the six or seven teams presents for two minutes. The screen-share handoff counts inside that time.
Show the original, feedback and data, then the iteration and retest.
Explain what AI did and what the humans decided.

Your team uses **Drift** during the customer rotation.

## Run it

Use Node.js 22 or newer. Node.js 24 LTS is suitable.
From this folder:

```sh
npm start
```

Open http://127.0.0.1:3003.
No package install, account, API key, or hosted database is necessary.
Open this folder in your AI tool. Read AGENTS.md, DATA-MODEL.md, and mockdata.md.

## Files

| File | Use |
|---|---|
| AGENTS.md | Folder-only prime directive and human roles |
| DATA-MODEL.md | Starter entities, relationships, and API examples |
| data/product.json | Current product state with sample data |
| data/product.schema.json | Base product fields and types |
| data/events.jsonl | Committed usage events, initially empty |
| data/schema.json | Shared event shape |
| mockdata.md | Product data and simulation instructions |
| feedback.md | Customer observations and scenario assumptions |
| public/ | Your interface and landing page |
| app.mjs | Local server, product API, event API, and data checks |

## Build and exchange

Replace the starter page with your product. Keep this folder independently runnable with npm start.
During the customer phase, open the host folder as the active project.
Change only its feedback.md, data/product.json, and data/events.jsonl. Commit and push those files.
Return to your own folder for the iteration and pull the latest data first.

```sh
npm run check
```

The check covers product fields, IDs, dates, relationships, and event IDs.
Use the path-scoped Git commands in AGENTS.md. Coordinate commits and pushes with your teammates.
