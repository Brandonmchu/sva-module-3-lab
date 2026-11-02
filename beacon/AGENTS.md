# AGENTS.md

## Prime directive

The active project is `beacon/`.

Make and run all product changes locally.
Edit, create, delete, stage, and commit files only inside this project folder.
Publish only your changes to `beacon/`. Do not include unrelated local commits.
Do not change another team folder or repository-root files.
Reading other folders is allowed.

Before a commit, inspect `git diff --cached --name-only`.
From this project folder, use a path-scoped commit:

~~~sh
git add -- .
git commit --only -m "Beacon: project update" -- .
~~~

If a change outside this folder is necessary, stop and ask Brandon.

## Data

Use the synthetic data described in mockdata.md.
