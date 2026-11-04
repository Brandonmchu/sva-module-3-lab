# GroupAtion — PM wireframe implementation status

The real app at `/` uses Jessica's planner design, palette, typography, card styling and panda art, with Ronak's landing page and onboarding. The separate `groupation-wireframe.html` remains a historical PM reference.

| Wireframe feature | Actual app behavior |
| --- | --- |
| Desktop sidebar | Overview, transport, stays, activities, discounts, booking preview, all questions, crew and chat switch the live planner's sections. |
| Mobile app preview | Existing Mobile view button presents a 390px phone frame. Navigation becomes a horizontally scrollable section menu. Same data and actions as desktop. This is a responsive web app, not an installed native app. |
| User headshots | Three generated fictional photos appear in the trip header, sidebar, traveler cards, responses and discussions. Added travelers fall back to initials. |
| Flights, trains and car rentals | Share and edit travel plans, provider/platform, routes, start/arrival dates, local times, time zones, participants and notes. Fictional flight example included. |
| Hotels, Airbnb and VRBO | Same saved sharing flow in Places to stay, with check-in/check-out, group quote, room-sharing notes and booking owner. Fictional stay example included. |
| Restaurants, concerts, tours and guides | Food & activities section uses the existing saved activity, vote and discussion flow, plus the extended travel detail fields. |
| Prices and budgets | Per-person estimate in the trip currency; provider quotes retain their own currency and basis (person, group, night, room-night). No automatic exchange-rate assumption. Summary and individual budget warnings remain visible. Partner offers do not inflate the estimate. |
| Booking ownership and state | Saved owner, idea/agreed/pending/booked state, and optional provider link on each shared plan. Links do not constitute reservations. |
| Partner discounts | Hotel, car/van and local-guide example offers with eligibility details. Share an example or a custom offer into the trip, then discuss and save ownership. All example discounts are explicitly unverified. |
| Questions per plan | Saved contextual discussion attached to each plan/offer, with author photo and timestamp. All questions collects every plan's thread, including offers. |
| General group chat | Saved trip-level discussion, separate from contextual questions. Select a sample traveler in The crew to change the posting identity. |
| Red panda progress | Auto progresses from stressed to happier to ready with sunglasses/bag, then destination T-shirt and flag. Manual stage preview is saved with the trip. Destination country is selected in Edit trip; unspecified countries use a globe. |
| Landing page integration | Ronak's planner entry points open the real planner containing these features. |

## Explicit MVP limits

Provider checkout, live prices/availability, real partner agreements, payments and actual reservations are simulated. Booking preview labels this clearly. Discussions persist through the local API; this is not a hosted, synchronized chat or account system. No native app-store package or currency conversion service was added.

## Validation

- JavaScript syntax checks, `npm run check` and `git diff --check` passed.
- In the live browser: navigated the sidebar sections; saved a sample car offer and its contextual question; reloaded and verified both persisted; checked the question appears under All questions; verified author photos load.
- Checked phone frame width 390px and no horizontal page overflow; reviewed desktop and phone screenshots.
- Previewed destination panda and restored automatic progression.

## Generated assets

Built-in imagegen was used. Photos depict fictional people.

- `public/avatars/traveler-1.png`: sample Priya photo.
- `public/avatars/traveler-2.png`: sample Maya photo.
- `public/avatars/traveler-3.png`: sample Dani photo.
- `public/assets/mascot/red-panda-travel-stages-v2.png`: four-stage mascot sheet, based on Jessica's existing character; destination flag is overlaid by the app.

The asset paths are inside the session's `drift/` folder and are committed with the app; no external avatar service is required.

Photo prompt template: “Use case: photorealistic-natural. Create one square fictional travel app profile photo. [subject]. Head and shoulders, face centered with generous space for circular avatar crop, natural daylight, candid approachable vacation mood. Single person only. No text, logos, borders or watermarks. Save as a project asset.”

Subjects, in file order:

1. Warm smiling South Asian woman in her late twenties, wavy dark hair, terracotta casual top, soft peach background.
2. Warm smiling woman in her late twenties, straight dark bob, light blue casual shirt, soft sky blue background.
3. Warm smiling Black woman in her early thirties, natural curly hair, sage green casual top, soft mint background.

Mascot edit prompt: “Edit this exact red panda 2-by-2 contact sheet for the GroupAtion app, preserving the same cute 3D character, light blue backgrounds and panel alignment. Top left: stressed, keep unchanged. Top right: cheerful planning with checklist, keep unchanged. Bottom left: ready to travel, same red panda smiling and wearing sunglasses, with a small packed travel bag beside it. Bottom right: at destination, same red panda in sunglasses and a white T-shirt with a small United States flag printed on its chest, with the bag beside it. No words, no panel dividers, no labels. Four equally sized panels aligned exactly as original.”

Final targeted edit: “Change only the bottom-right panda's white T-shirt: remove the printed United States flag and leave the shirt plain white, with the same fabric shading. Keep absolutely everything else, including all four panel sizes, alignment, character faces, sunglasses, bags, hats, colors, and background unchanged. This app will overlay the correct destination flag in code.”
