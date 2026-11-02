# Module 3 · Company lab

Seven standalone company folders support six or seven teams of three.
Use Atlas through Fjord for six teams. Add Grove for seven.

| Team | Folder | Local URL |
|---|---|---|
| Atlas | atlas/ | http://127.0.0.1:3001 |
| Beacon | beacon/ | http://127.0.0.1:3002 |
| Cedar | cedar/ | http://127.0.0.1:3003 |
| Drift | drift/ | http://127.0.0.1:3004 |
| Ember | ember/ | http://127.0.0.1:3005 |
| Fjord | fjord/ | http://127.0.0.1:3006 |
| Grove | grove/ | http://127.0.0.1:3007 |

## Your company

Your company helps groups of friends plan a weekend away that everyone wants to join.
Use AI for as much of the work as you can.

## The working app is included

Run npm start and open your team URL. The app already provides:


- Create a trip with a destination, dates, and a budget per person.
- Add each traveler's availability, budget, and interests.
- Make a shared itinerary with activities and estimated costs.
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

## Customer rotation

Seven teams: Atlas → Beacon → Cedar → Drift → Ember → Fjord → Grove → Atlas.
Six teams: Atlas → Beacon → Cedar → Drift → Ember → Fjord → Atlas.
Stay with your three-person team and open the next company's folder.

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

Each folder has the same starter product model and fictional sample data.
DATA-MODEL.md explains trips, travelers, activities, responses, and usage events.
GET /api/product reads data/product.json. PUT /api/product validates and saves the whole snapshot.
GET and POST /api/events read and append the separate data/events.jsonl log.
All data stays inside the active team folder and travels through Git.

## Handoffs

Build in your team's folder.
For a customer rotation, run the host team's folder and add feedback and simulated events there.
The original team then pulls those changes and iterates.

Commit only the active project folder. Coordinate pushes inside your team.
During a rotation, open the host team's folder as your project.
Its AGENTS.md applies, so feedback and simulation changes stay in that folder.

Everyone uses the same main branch. Once you accept your collaborator invitation, you can pull and push across all seven folders.

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
After customer feedback, publish the host folder's feedback.md, data/product.json, and data/events.jsonl.
Before iteration, the original team pulls main again and restarts its app.

The repository is private. A link alone does not grant access.
Accept your GitHub invitation first.
