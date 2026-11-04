# Atlas

This folder is your whole project. It has no dependency on another team folder.

## Your company

Your company helps groups of friends plan a weekend away that everyone wants to join.
Use AI for as much of the work as you can.

## The working app is included

Run npm start and open your team URL. The app already provides:


- Create a trip with a destination, dates, and a budget per person.
- Add each traveler's availability, budget, and interests.
- Make a shared itinerary with activities and estimated costs.
- Browse trip activities in a day, week, or month calendar or agenda, and filter by trip and event name.
- Track shared expenses, set custom amount or percentage splits, and record repayments.
- Respond to the plan and revise it.

A basic landing page and two-step first-trip onboarding are also included.
The app saves product changes and records usage events automatically.
Save product state in data/product.json. Record product use in data/events.jsonl.
Use the sample trip or create one from the landing page. Read DATA-MODEL.md for the fields and relationships.

## Make it your product

Choose the customer and promise your company will focus on.
Use AI to change the features, design, positioning, and onboarding for that customer.
Keep the core trip flow working. Save the version your team creates before the customer rotation.

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

1. Build: 30 minutes, with four minutes of setup and 26 minutes to differentiate the product. Save a v1 screenshot and commit reference.
2. Be customers: 30 minutes. Give qualitative feedback and create journeys for 100 distinct simulated customers.
3. Analyze and iterate: 30 minutes. Improve and retest for 15 minutes, then present in the main room for 15 minutes.

Each of the six or seven teams presents for two minutes. The screen-share handoff counts inside that time.
Show the original, feedback and data, then the iteration and retest.
Explain what AI did and what the humans decided.

Your team uses **Beacon** during the customer rotation.

## Git sessions and team branch

Your shared branch is `team/atlas`.
Each AI session uses a unique local session branch and worktree from `origin/team/atlas`.
Read AGENTS.md for the exact setup and merge commands before you start.
One teammate merges ready sessions into the team branch and pushes it.
Keep local session branches off GitHub. Keep all product changes inside `atlas/`.

During a review, use the host team's branch and folder.
Merge feedback into that host branch before its builders resume.
A ZIP can run the app. Clone the repository for branches, worktrees, and team handoffs.

## Start the app

Use Node.js 22 or newer. Node.js 24 LTS is suitable.
From this folder:

```sh
npm start
```

Open http://127.0.0.1:3001.
No package install, account, API key, or hosted database is necessary.
Open this folder in your AI tool. Read AGENTS.md, DATA-MODEL.md, and mockdata.md.

## Files

| File | Use |
|---|---|
| AGENTS.md | Folder boundary, team branch, session worktrees, merge rules, and human roles |
| DATA-MODEL.md | Starter entities, relationships, and API examples |
| data/product.json | Current product state with sample data |
| data/product.schema.json | Base product fields and types |
| data/events.jsonl | Committed usage events, initially empty |
| data/schema.json | Shared event shape |
| mockdata.md | Product data and simulation instructions |
| feedback.md | Customer observations and scenario assumptions |
| public/index.html | Landing page, onboarding, and form markup |
| public/styles.css | Visual design and responsive layout |
| public/app.js | Trip features, interactions, and usage events |
| app.mjs | Local server, product API, event API, and data checks |

## Build and exchange

Start with the working app. Change it for your chosen customer. Keep this folder independently runnable with npm start.

During the customer phase, open the host folder as the active project.
Change only its feedback.md, data/product.json, and data/events.jsonl. Commit and push those files.
Return to your own folder for the iteration and pull the latest data first.

```sh
npm run check
```

The check covers product fields, IDs, dates, relationships, and event IDs.
Use the worktree and merge commands in AGENTS.md. Coordinate one team-branch publisher at a time.
