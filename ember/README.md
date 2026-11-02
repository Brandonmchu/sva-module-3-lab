# Ember

This folder is your whole project. It has no dependency on another team folder.
The product problem, team roles, and exercise rules will come later.

## Run it

Install Node.js 24 LTS if you do not already have Node.js 22 or newer.

From this folder:

```sh
npm start
```

Open http://127.0.0.1:3005.
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

During a customer rotation, run the other team's folder.
Add observations to that folder's feedback.md.
Add simulated events to that folder's data/events.jsonl.
Commit the changes so the original team can pull them.

```sh
npm run check
```

This checks the event format and duplicate IDs.
Git handoff commands are in the repository README.
