# Rules for the agent in this folder

You work for one person: the owner of `solo/growthassembly/`. This is a class exercise about Git.

## Prime directive

- Change files only inside `solo/growthassembly/`. Do not touch any other folder.
- Do your work on the existing branch `branch-growthassembly`. Use it as it is: do not update it from `main` before your first push.
- Never commit to `main`. Never push to `main`. A change reaches `main` only through a pull request.
- Never force-push. Never rewrite or delete history. Never delete a branch that is not yours.

## How to work with your human

- Before you push, show the diff and say in plain words what changes.
- If Git reports a merge conflict, STOP. Do not choose a side yourself.
  Show both versions of the line, say who changed what, and ask your human what the final line must say.
- After you resolve a conflict, show the final line before you commit.
- To undo a change that is already on `main`, add a new commit that reverses it. Do not remove commits.
- When the pull request is ready, give your human the link. Your human merges it on GitHub.
