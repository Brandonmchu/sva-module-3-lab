# Fjord

This folder is your whole project. It has no dependency on another team folder.

Fjord's product brand is **FriendGO**. The `fjord/` folder, the `team/fjord` branch, and the package name stay as the lab set them.
The logo is an inline SVG mark in the header of public/index.html, with matching favicon. Its styles are in the FriendGO brand section of public/styles.css.

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

Your team uses **Grove** during the customer rotation.
If the class has six teams, use **Atlas** instead.

## Git sessions and team branch

Your shared branch is `team/fjord`.
Each AI session uses a unique local session branch and worktree from `origin/team/fjord`.
Read AGENTS.md for the exact setup and merge commands before you start.
One teammate merges ready sessions into the team branch and pushes it.
Keep local session branches off GitHub. Keep all product changes inside `fjord/`.

During a review, use the host team's branch and folder.
Merge feedback into that host branch before its builders resume.
A ZIP can run the app. Clone the repository for branches, worktrees, and team handoffs.

## Start the app

Use Node.js 22 or newer. Node.js 24 LTS is suitable.
From this folder:

```sh
npm start
```

Open http://127.0.0.1:3006.
No package install, account, or hosted database is necessary.
The "Top 3 things to do" interest suggestions call the Gemini API with the key in `.env` in this folder (`GEMINI_API_KEY=...`).
Git ignores `.env`, so each teammate creates their own. Never commit a key.
Restart the app after you change `.env`. Without a key, the rest of the app works and saved suggestions still show.
Open this folder in your AI tool. Read AGENTS.md, DATA-MODEL.md, and mockdata.md.

### AI route suggestions

The basic shared planner still runs without an API key. Generating destination-specific route options requires `OPENAI_API_KEY` in the server environment. Set the variable locally before `npm start`, and keep the key out of Git and browser code. `OPENAI_MODEL` can optionally choose another Responses API model; the default is `gpt-4.1-mini`. The app sends the reviewed trip brief, destination, dates, budget, and currency to the AI planner. Suggested place details, travel times, and costs are estimates to verify before travel.

## Files

| File | Use |
|---|---|
| AGENTS.md | Folder boundary, team branch, session worktrees, merge rules, and human roles |
| DATA-MODEL.md | Starter entities, relationships, and API examples |
| data/product.json | Current product state with sample data |
| data/product.schema.json | Base product fields and types |
| data/events.jsonl | Committed usage events, initially empty |
| data/schema.json | Shared event shape |
| data/suggestions.json | Cached Gemini "Top 3 things to do" for each trip interest |
| .env | Gemini key and optional model settings for the suggestions |
| mockdata.md | Product data and simulation instructions |
| feedback.md | Customer observations and scenario assumptions |
| public/index.html | Landing page, onboarding, and form markup |
| public/styles.css | Visual design and responsive layout |
| public/app.js | Trip features, interactions, and usage events |
| app.mjs | Local server, product API, event API, suggestions API, and data checks |

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
