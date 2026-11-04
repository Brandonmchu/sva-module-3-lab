# Groupation design direction

Status: Jessica approved publishing this design pass to the shared team/drift branch on 3 November 2026.

## First pass: colour

The travel inspiration supplies airy sky blue, turquoise, white surfaces, and small sunny-yellow highlights. The approved red panda supplies warm rust and cream. This design pass integrates Ronak's landing page, onboarding, and Nashville sample from `origin/team/drift` commit `703b0fa`. It applies the shared palette, Nunito typography, rounded controls/cards, and mascot placements while preserving the marketing copy and working trip flows.

Nunito is loaded from Google Fonts with local system fallbacks. The original approved image is unchanged; CSS selects each pose from the concept sheet. The panda appears beside the landing-page sample, in setup, and above the shared planner. Planner artwork follows the existing confirmed/planning status in this first pass; production readiness and explicit arrival rules still need Ben's decision.

| Token | Colour | Use |
| --- | --- | --- |
| Canvas | `#F3FAFF` | Sky background |
| Ocean | `#007DA6` | Primary actions and links |
| Deep ocean | `#006583` | Action hover |
| Deep ocean | `#006583` | Text links on pale surfaces |
| Ink | `#17374B` | Main text |
| Muted ink | `#4E6674` | Supporting text |
| Panda rust | `#BF5635` | Brand detail and focus ring |
| Deep rust | `#974025` | Eyebrow text |
| Cream | `#FFF8ED` | Warm background accent |
| Sunshine | `#FFE08A` | Proposed status and decorative highlight |
| Sea glass | `#E3F5F1` | Soft supporting surface |

Use dark text on pale colours and white text on the ocean primary buttons. Keep error text in berry so the panda's rust remains a welcoming brand colour.

## Mascot and friends

Approved concept: [red panda planning states](../public/assets/mascot/red-panda-concept-v1.png). This is the original concept sheet, with its blue background intact. Artwork and publishing are approved by Jessica.

Reading order: just starting, making progress, relaxed, vacation mode. The sheet establishes the character's visual style. Ben's additional travel-ready bag and destination-flag T-shirt variants are still to be designed. Confirm required-planning and explicit arrival rules with Ben before connecting moods to product state. Provide a readable mood label and reduced-motion support.

As members are added, grow the red panda crew. Let people choose their own friend, with options for markings, builds, outfits, glasses, and mobility aids. Keep names visible and preserve each friend's identity as the group grows. The group should support these choices without inferring a person's identity from their name or photo.

The full initial generation prompt and method are in [mascot/PROMPT.md](mascot/PROMPT.md).

## Next interaction concepts

Explore trip help for emergency contacts, booking references and document backups, offline access, meeting points, and backup plans for delays or cancellations. These are design ideas for review with Ben; no additional data fields or emergency services are implemented in this colour pass.

## Bring the people in earlier — design proposal

After naming the trip and choosing the occasion, introduce “Who's coming?” before the detailed preferences. Offer name and optional email entry, a shareable invitation-link concept for group chats, a visible “Add people later” option, and clear invited/accepted states. Each added person can grow the red panda crew. Actual invitations, email delivery, and any new persisted fields need Ben's implementation decision. Marketing should have a separate optional choice for the invitee, with Ronak owning that copy and messaging.

| Trip type | Design details to make easy to see or capture |
| --- | --- |
| Celebrations and milestone trips | Occasion, person being celebrated, surprise visibility, shared versus personal plans |
| Reunions and annual gatherings | Returning group members, different arrival points, flexible date choices |
| Couples and wedding guest groups | Partners/households, room-sharing preferences, guest counts |
| Ski, golf, and activity trips | Experience levels, equipment, optional activities and alternatives |
| Concerts, festivals, and sports | Fixed event dates, ticket status, venue and meetup details |
| All group trips | Private budget comfort, dietary/access needs, booking owner, arrival times, contacts and backup plans |

Jessica owns the screens, hierarchy, form interactions, states, accessibility, and visual language. Ben owns feature priorities, data, and behaviour. Ronak owns positioning, onboarding copy, marketing consent copy, and campaigns. These are proposals for review, not newly implemented functionality.
