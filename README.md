# Module 3 · Company lab

Five teams share one repository. Each folder is a complete, independent project.

| Team | Folder | Local URL |
|---|---|---|
| Atlas | atlas/ | http://127.0.0.1:3001 |
| Beacon | beacon/ | http://127.0.0.1:3002 |
| Cedar | cedar/ | http://127.0.0.1:3003 |
| Drift | drift/ | http://127.0.0.1:3004 |
| Ember | ember/ | http://127.0.0.1:3005 |

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

Customer rotation: Atlas → Beacon → Cedar → Drift → Ember → Atlas.
Stay with your team and open the next team's folder.

## Start

You need Git, a GitHub account, and Node.js 22 or newer.
Node.js 24 LTS is a suitable choice.

```sh
git clone https://github.com/Brandonmchu/sva-module-3-lab.git
cd sva-module-3-lab/atlas
npm start
```

Open the URL for your team. No package install is needed.
Use your own team's folder instead of atlas.

## Download only one team folder

```sh
git clone --filter=blob:none --sparse https://github.com/Brandonmchu/sva-module-3-lab.git
cd sva-module-3-lab
git sparse-checkout set atlas
cd atlas
npm start
```

To add another team for the rotation, run this from the repository root:

```sh
git sparse-checkout add beacon
```

All team files stay inside the team folder. You can also copy one folder elsewhere and run it.

## Shared data

Each team has the same schema in data/schema.json.
Its local data store is data/events.jsonl: one fictional event per line.
Custom product data goes in each event's properties object.
Each folder's mockdata.md explains the format and API.

The data file is committed to Git. It does not live in browser localStorage or a hosted service.
In Phase 2, an agent appends usage journeys for 100 distinct simulated customers.
Set source to "simulation" and identify the reviewer team in properties.reviewer_team.
Each team has its own data file, so teams do not share a live database.

## Handoffs

Build in your team's folder.
For a customer rotation, run the host team's folder and add feedback and simulated events there.
The original team then pulls those changes and iterates.

Commit only the active project folder. Coordinate pushes inside your team.
During a rotation, open the host team's folder as your project.
Its AGENTS.md applies, so feedback and simulation changes stay in that folder.

Everyone uses the same main branch. Once you accept your collaborator invitation, you can pull and push across all five folders.

From your project folder, stop the server, check the data, and commit your work:

```sh
npm run check
git status
git add -- .
git diff --cached --name-only
git commit --only -m "Atlas: prototype handoff" -- .
git pull --no-rebase origin main
git push origin main
```

Run these commands inside the active team folder.
The path-scoped commit excludes staged files from other folders.
Use your team's name in the commit message.
If another team pushed first, pull their changes and retry the push.
Resolve any same-file conflict with the people who edited it. Do not force-push.

Before the rotation, publish the product and its data.
After customer feedback, publish the host folder's feedback.md and data/events.jsonl.
Before iteration, the original team pulls main again and restarts its app.

The repository is private. A link alone does not grant access.
Accept your GitHub invitation first.
