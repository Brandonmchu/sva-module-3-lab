# GroupAtion — Team Drift

Initial product direction from Ben, product manager. Shared for team discussion and a Git access check.

## Product and customer

GroupAtion is a group trip planning and booking app for people travelling together for leisure.

Our target groups include:

- Bachelor and bachelorette parties.
- Reunions.
- Friends travelling to concerts, such as a Backstreet Boys concert.
- Other groups taking a leisure trip together.

## Proposed product promise

Help the whole group agree on a trip, organize the details, and keep track of what is booked in one shared place.

## Proposed first-version features

1. **Shared trip hub:** occasion, destination, dates, and budget per person.
2. **Group preferences:** each traveller's availability, budget, and interests.
3. **Shared itinerary:** flights, trains, hotels, Airbnb/VRBO stays, restaurants, concerts, activities, dates/time zones, and estimated costs in their original currency.
4. **Group decisions and questions:** votes, comments, questions attached to each plan, and a general trip discussion.
5. **Booking coordination:** tracking booking links, who is responsible, booking state, participants, and what still needs to be booked.
6. **Potential group offers:** explore group discounts from providers/hosts, with source, terms, and confirmation status. No discount is guaranteed or implemented yet.

The starter already supports trips, travellers, activities, and responses. Booking coordination is a proposed extension; actual booking transactions and integrations have not been implemented or chosen.

## Roles and decisions

- **Product manager — Ben:** features, priorities, and product behaviour.
- **Designer — Jessica:** design, interactions, and product aesthetics.
- **Product marketer — Ronak:** positioning, landing page, and onboarding.

The PM wireframe and design prompt are in `JESSICA-DESIGN-HANDOFF.md`. Open `/groupation-wireframe.html` while the app is running for the clickable proposal.

The team still needs to agree on the first occasion to focus on, the scope of booking for the class prototype, and how work is divided across files. AI can help implement the agreed direction; customer choice and product priorities remain human decisions.

## Git workflow and access check

- Each person works in their own session branch and worktree from the latest `origin/team/drift`.
- Keep all product changes inside `drift/` and follow its `AGENTS.md`.
- Coordinate one person at a time to merge ready sessions and push `team/drift`.
- Save the working v1, a screenshot, and its commit reference for the class presentation.

**Access test:** teammates should open `drift/GROUPATION-PLAN.md` on `team/drift` and confirm they can see the GroupAtion name and this plan.

To read the latest plan without changing your current branch or worktree:

```sh
git fetch origin
git show origin/team/drift:drift/GROUPATION-PLAN.md
```
