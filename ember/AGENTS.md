# AGENTS.md

## Prime directive

The active project is `ember/`.

Make and run all product changes locally.
Edit, create, delete, stage, and commit files only inside this project folder.
Publish only your changes to `ember/` on `team/ember`. Do not include unrelated local commits.
Do not change another team folder or repository-root files.
You can read other folders.

Git worktree setup can create folders and Git metadata outside this project folder.

Before a commit, inspect `git diff --cached --name-only`.
From this project folder, use a path-scoped commit:

```sh
git add -- .
git commit --only -m "Ember: project update" -- .
```

If a change outside this folder is necessary, stop and ask Brandon.

## Team branch and local sessions

The shared branch for Ember is `team/ember`.
Push ready work only to `origin/team/ember`.
Keep `main` as the instructor's starter.
Do not push session branches or another team's branch.

Each AI session needs its own local worktree and local session branch.
A worktree is a separate folder for one Git branch.
Give each session a unique name: `session/ember/<person>-<task>-<unique>`.
Start each session from the latest `origin/team/ember`.
Never give two sessions the same folder or session branch.

Open only `ember/` inside that session worktree in your AI tool.

### Start a session

If this folder came from a ZIP, clone the repository first.
A ZIP has no Git history or remote branches.
From the repository root, inspect the current state:

```sh
git status --short
git worktree list
git fetch origin
```

Create a fresh worktree outside the clone.
Replace `yourname-task-01` with a unique session name:

```sh
git worktree add -b session/ember/yourname-task-01 ../sva-ember-yourname-task-01 origin/team/ember
cd ../sva-ember-yourname-task-01/ember
npm start
```

Commit small changes in this session branch.
Use the path-scoped commands in the prime directive.
Use a different local port if another app already uses this team's port.
For example, `PORT=4011 npm start`.
Do not stop another person's server.

### Merge ready work into the team branch

Choose one teammate to publish merges at a time.
Several sessions can work in parallel.
Only one session merges and pushes at a time for this team.
This is coordination within the team, not a GitHub permission rule.

1. Save and commit the session's work inside `ember/`.
2. Run `npm run check` from that folder.
3. Confirm that each new commit changes only `ember/`.
4. Merge the ready session branch into a separate local worktree for `team/ember`.
5. Check the merged app and push only the team branch.

Inspect `git worktree list` before you create the worktree for team merges.
Reuse the worktree if it already holds `team/ember`.
Git cannot check out the same branch in two worktrees.
If the branch exists locally but has no worktree, omit `--track -b team/ember` and use that local branch.
For the first merge from a fresh clone, run this from the repository root:

```sh
git worktree add --track -b team/ember ../sva-ember-publish origin/team/ember
```

In that worktree, replace the session name with the actual ready branch:

```sh
cd ../sva-ember-publish
git status --short
git pull --ff-only origin team/ember
git log --format= --name-only origin/team/ember..session/ember/yourname-task-01
git merge --no-ff --no-edit session/ember/yourname-task-01
cd ember
npm run check
cd ..
git log --format= --name-only origin/team/ember..HEAD
git diff --name-only origin/team/ember HEAD
git push origin HEAD:refs/heads/team/ember
```

Stop before the merge if the worktree contains uncommitted changes.
Stop before the merge or push if any new commit includes another folder.
Do not merge another team's branch or a session based on it.
Ask the humans who edited a file with conflicts to resolve its intent.

If a push fails because the remote advanced, keep your local commits.
Fetch the remote branch and merge it into the team branch.
Do not rebase the shared branch or force-push.
Check the merged result again before another push.

```sh
git fetch origin
git merge --no-edit origin/team/ember
cd ember
npm run check
cd ..
git log --format= --name-only origin/team/ember..HEAD
git push origin HEAD:refs/heads/team/ember
```

Keep session worktrees until their commits reach the remote team branch.
Remove only a clean, merged worktree after the session ends.
Never use forced worktree removal or discard another session's files.

## Customer rotation

When another team reviews Ember, it uses `origin/team/ember`.
The reviewers create a fresh local session worktree from that branch.
They open this `ember/` folder and follow this file.

They change only `feedback.md`, `data/product.json`, and `data/events.jsonl` here.
They merge and push the feedback to `team/ember` through the same workflow.
Coordinate one publisher during this handoff.
The Ember builders pause changes until reviewers finish.

Before iteration, fetch the feedback and start fresh sessions from `origin/team/ember`.
Do not merge the reviewer's own company branch into this branch.

## Starting point

The basic app already works. Run it and try a complete trip before you make changes.
Use AI to develop your team's customer promise, features, design, positioning, and onboarding.
Keep the core trip flow usable during the customer rotation.
The editable frontend files are public/index.html, public/styles.css, and public/app.js.

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
