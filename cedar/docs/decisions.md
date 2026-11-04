# Cedar design decisions

## Planner hierarchy

Use warm cream surfaces, forest green accents, serif trip titles, and three overview cards for group agreement, estimated activity budget per person, and the next action. Preserve the existing trip, traveler, activity, response, and confirmation flows. Native select controls and semantic details retain keyboard support. Photo is decorative weekend inspiration, not location-specific imagery. Keep all layout and markup changes within Cedar.

Agreement counts active activities for which all current travelers voted yes. Keep manual activity status separate. Budget includes active activities only and caps the visual bar at 100% while showing the overage in text. Zero budget has no division by zero. Undo restores the prior activity status; the existing Removed activities list remains available after reload.
