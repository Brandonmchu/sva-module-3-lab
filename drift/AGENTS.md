# AGENTS.md

## Prime directive

The active project is `drift/`.

Make and run all product changes locally.
Edit, create, delete, stage, and commit files only inside this project folder.
Publish only your changes to `drift/`. Do not include unrelated local commits.
Do not change another team folder or repository-root files.
You can read other folders.

Before a commit, inspect `git diff --cached --name-only`.
From this project folder, use a path-scoped commit:

```sh
git add -- .
git commit --only -m "Drift: project update" -- .
```

If a change outside this folder is necessary, stop and ask Brandon.

## Data

Read DATA-MODEL.md and mockdata.md before you build.
Use the supplied data/product.json model and fictional sample data.
Save product state through /api/product and append usage through /api/events.
Keep both data files inside this project folder.

## Human roles

The product manager leads feature decisions.
The designer leads design, interaction design, and product aesthetics.
The product marketer leads positioning, the landing page, and onboarding.
Each role uses AI for execution. Keep decisions across roles visible to the humans.
