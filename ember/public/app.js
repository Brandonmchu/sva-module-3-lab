// Shared baseline: product behavior lives here; copy and forms live in index.html.
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const visitorId = crypto.randomUUID();
const selectedTravelers = new Map();
let product;
let busy = false;
let wizardStep = 1;
let tripDraft;
let previousRoute;

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The request failed. Please try again.');
  return body;
}

function route() {
  const [view = 'home', encodedId = ''] = location.hash.slice(1).split('/');
  try { return { view, id: decodeURIComponent(encodedId) }; }
  catch { return { view: 'home', id: '' }; }
}
const trip = () => product?.trips.find(item => item.id === route().id);
const travelersFor = tripId => product.travelers.filter(person => person.trip_id === tripId);
const activitiesFor = tripId => product.activities.filter(activity => activity.trip_id === tripId);
const actor = () => selectedTravelers.get(trip()?.id) || visitorId;
// Bachelorette: one traveler per trip. Surprise activities are hidden whenever she is the viewer.
const brideFor =tripRecord => product.travelers.find(person => person.id === tripRecord?.bachelorette_id && person.trip_id === tripRecord.id);
const viewerIsBride = tripRecord => Boolean(tripRecord?.bachelorette_id) && selectedTravelers.get(tripRecord.id) === tripRecord.bachelorette_id;
const isSurprise = activity => activity.hidden_from_bachelorette === true;
const visibleTo = (tripRecord, activity) => !(viewerIsBride(tripRecord) && isSurprise(activity));
// Treating the bachelorette: she sees no prices, and everyone else's cost includes a split of her share.
const brideTreated = tripRecord => Boolean(brideFor(tripRecord)) && tripRecord.bachelorette_treated === true;
const hidePrices = tripRecord => brideTreated(tripRecord) && viewerIsBride(tripRecord);
const payingCount = tripRecord => travelersFor(tripRecord.id).length - (brideTreated(tripRecord) ? 1 : 0);
const shareOf = (tripRecord, perPerson) => brideTreated(tripRecord) && payingCount(tripRecord) > 0
  ? Math.round(perPerson * travelersFor(tripRecord.id).length / payingCount(tripRecord) * 100) / 100
  : perPerson;
const event = (name, properties, actorId = actor()) => ({ event: name, actor_id: actorId, source: 'product', properties: { visitor_id: visitorId, ...properties } });
const interests = value => [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
const dateText = value => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
const dateRange = (start, end) => dateText(start) + ' – ' + dateText(end);
const money = (value, currency = trip()?.currency || 'CAD') => new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const statusName = value => ({ draft: 'Draft', planning: 'Planning', confirmed: 'Locked in', cancelled: 'Cancelled', proposed: 'Proposed', accepted: 'Agreed', removed: 'Removed' })[value] || value;

function notice(message, isError = false) {
  const element = $('#notice');
  element.textContent = message;
  element.classList.toggle('error', isError);
  element.hidden = !message;
}

function setBusy(value) {
  busy = value;
  document.body.setAttribute('aria-busy', String(value));
  document.querySelectorAll('button').forEach(button => { button.disabled = value; });
}

async function track(records) {
  await api('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(records) });
}

// Save the snapshot before recording the action. Never discard a successful save if logging fails.
async function saveChange(change, records) {
  if (busy) throw new Error('Please wait for the current change to finish.');
  const next = structuredClone(product);
  change(next);
  setBusy(true);
  try {
    await api('/api/product', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    product = next;
    let message = 'Saved.';
    try { await track(records); }
    catch (error) { console.warn('Usage log:', error.message); message = 'Your change is saved, but usage logging failed.'; }
    render();
    notice(message, message !== 'Saved.');
  } finally { setBusy(false); }
}

function checkDates(start, end, label) {
  if (start > end) throw new Error(label + ': the end date must be on or after the start date.');
}

function readTripForm(form) {
  const values = Object.fromEntries(new FormData(form));
  checkDates(values.start_date, values.end_date, 'Trip dates');
  return { title: values.title.trim(), destination: values.destination.trim(), start_date: values.start_date, end_date: values.end_date, budget_per_person: Number(values.budget_per_person), currency: values.currency.toUpperCase() };
}

function readTravelerForm(form) {
  const values = Object.fromEntries(new FormData(form));
  checkDates(values.available_from, values.available_to, 'Availability');
  return { name: values.name.trim(), available_from: values.available_from, available_to: values.available_to, budget: Number(values.budget), interests: interests(values.interests) };
}

function fillForm(form, values) {
  form.reset();
  $('.form-error', form).textContent = '';
  for (const [name, value] of Object.entries(values)) {
    const input = form.elements.namedItem(name);
    if (input?.type === 'checkbox') input.checked = value === true;
    else if (input) input.value = Array.isArray(value) ? value.join(', ') : value;
  }
}

function openEditor(kind, id) {
  const current = trip();
  if (!current) return;
  const form = $('#' + kind + '-form');
  let values;
  if (kind === 'trip') {
    values = current;
    const bride = brideFor(current);
    $('#treat-row').hidden = !bride || viewerIsBride(current);
    if (bride) $('#treat-help').textContent = `Hide prices from ${bride.name} and split her share across the rest of the squad.`;
  }
  // Price fields keep their saved values but are not shown to a treated bachelorette.
  document.querySelectorAll('#' + kind + '-form .price-field').forEach(field => { field.hidden = hidePrices(current); });
  if (kind === 'traveler') {
    const existing = product.travelers.find(person => person.id === id) || { id: '', name: '', available_from: current.start_date, available_to: current.end_date, budget: current.budget_per_person, interests: [] };
    values = { ...existing, is_bachelorette: Boolean(id) && current.bachelorette_id === id };
    $('#traveler-dialog-heading').textContent = id ? 'Edit squad member' : 'Add to the squad';
    $('#bride-row').hidden = viewerIsBride(current);
  }
  if (kind === 'activity') {
    values = product.activities.find(activity => activity.id === id) || { id: '', title: '', date: current.start_date, category: '', estimated_cost_per_person: 0, status: 'proposed', hidden_from_bachelorette: false };
    $('#activity-dialog-heading').textContent = id ? 'Edit activity' : 'Add an activity';
    // The bachelorette never sees the surprise control, so the feature itself stays a secret.
    const bride = brideFor(current);
    $('#surprise-row').hidden = !bride || viewerIsBride(current);
    if (bride) $('#surprise-help').textContent = `${bride.name} won't see this activity, its cost, or the squad's votes.`;
  }
  fillForm(form, values);
  $('#' + kind + '-dialog').showModal();
}

function resetOnboarding() {
  wizardStep = 1;
  tripDraft = undefined;
  $('#new-trip-form').reset();
  $('.form-error', $('#new-trip-form')).textContent = '';
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const basics = wizardStep === 1;
  $('#trip-basics').hidden = !basics;
  $('#trip-basics').disabled = !basics;
  $('#organizer-details').hidden = basics;
  $('#organizer-details').disabled = basics;
  $('#onboarding-back').hidden = basics;
  $('#onboarding-step').textContent = `Step ${wizardStep} of 2`;
  $('#onboarding-heading').textContent = basics ? 'Let\'s start the bachelorette trip.' : 'Now, a little about you.';
  $('#onboarding-intro').textContent = basics ? 'Pick a destination, dates and a budget per person. You can change these later.' : 'Tell the squad when you are free and what you are into. Add everyone else, including the bachelorette, next.';
  $('#onboarding-submit').textContent = basics ? 'Continue' : 'Create trip';
}

function renderHome() {
  const sample = product.trips[0];
  $('#sample-link').hidden = !sample;
  if (!sample) {
    $('#sample-preview').innerHTML = '<h2>The bachelorette trip starts here.</h2><p class="intro">Create a trip and bring the squad into the plan.</p>';
    return;
  }
  // The landing page is shared, so it never previews surprise activities.
  const ideas = activitiesFor(sample.id).filter(activity => activity.status !== 'removed' && !isSurprise(activity));
  // The landing page is shared too, so it shows no prices when the bachelorette is being treated.
  const noPrices = brideTreated(sample);
  $('#sample-link').href = '#trip/' + encodeURIComponent(sample.id);
  $('#sample-preview').innerHTML = `<p class="eyebrow">A sample to try</p><h2>${escapeHtml(sample.title)}</h2><p class="quiet">${escapeHtml(sample.destination)} · ${dateRange(sample.start_date, sample.end_date)}</p>
    <div class="sample-meta"><div><span>The squad</span><b>${travelersFor(sample.id).length} people</b></div>${noPrices ? '' : `<div><span>Budget per person</span><b>${escapeHtml(money(sample.budget_per_person, sample.currency))}</b></div>`}</div>
    ${ideas.slice(0, 3).map(activity => `<div class="sample-activity"><span>${escapeHtml(activity.title)}</span>${noPrices ? '' : `<b>${escapeHtml(money(activity.estimated_cost_per_person, sample.currency))}</b>`}</div>`).join('')}
    <a class="text-link" href="#trip/${encodeURIComponent(sample.id)}">Open this trip</a>`;
}

function responseFor(activityId, travelerId) {
  return product.responses.filter(response => response.activity_id === activityId && response.traveler_id === travelerId).at(-1);
}

function renderActivity(activity, current, people) {
  const responses = people.map(person => ({ person, response: responseFor(activity.id, person.id) })).filter(item => item.response);
  const selected = selectedTravelers.get(current.id);
  const person = people.find(item => item.id === selected);
  const mine = responseFor(activity.id, selected);
  const totals = ['yes', 'maybe', 'no'].map(vote => `<span class="vote-count ${vote}"><b>${responses.filter(item => item.response.vote === vote).length}</b> ${vote}</span>`).join('');
  const outsideDates = activity.date < current.start_date || activity.date > current.end_date;
  const bride = brideFor(current);
  const surprise = isSurprise(activity);
  const showSurpriseControls = bride && !viewerIsBride(current);
  const surpriseToggle = showSurpriseControls ? `<button class="text-button" data-action="toggle-surprise" data-id="${escapeHtml(activity.id)}">${surprise ? 'Show to ' + escapeHtml(bride.name) : 'Hide from ' + escapeHtml(bride.name)}</button>` : '';
  return `<article class="activity ${escapeHtml(activity.status)} ${surprise && showSurpriseControls ? 'surprise' : ''}" data-activity-id="${escapeHtml(activity.id)}">
    <div class="activity-meta"><span class="status-badge ${activity.status === 'proposed' ? 'proposed' : ''}">${escapeHtml(statusName(activity.status))}</span><span>${escapeHtml(activity.category)}</span>${surprise && showSurpriseControls ? `<span class="status-badge surprise">Surprise · hidden from ${escapeHtml(bride.name)}</span>` : ''}</div>
    <div class="activity-heading"><h3>${escapeHtml(activity.title)}</h3>${hidePrices(current) ? '' : `<span class="activity-cost" ${brideTreated(current) ? `title="${escapeHtml(money(activity.estimated_cost_per_person))} each, with ${escapeHtml(bride.name)}'s share split across the squad"` : ''}>${escapeHtml(money(shareOf(current, activity.estimated_cost_per_person)))}</span>`}</div>
    <div class="vote-totals">${totals}</div>
    ${outsideDates ? '<p class="budget-message">This activity is outside the trip dates.</p>' : ''}
    <details class="vote-box"><summary>${mine ? 'Your vote: ' + mine.vote[0].toUpperCase() + mine.vote.slice(1) + ' · change' : "Who's in? Add your vote"}</summary>
    <form class="response-form" data-activity-id="${escapeHtml(activity.id)}"><fieldset ${person ? '' : 'disabled'}><legend>${person ? 'Your vote as ' + escapeHtml(person.name) : 'Add someone to the squad to vote'}</legend>
      <div class="response-fields"><label>Vote<select name="vote" required><option value="" disabled ${mine ? '' : 'selected'}>Choose</option>${['yes', 'maybe', 'no'].map(vote => `<option value="${vote}" ${mine?.vote === vote ? 'selected' : ''}>${vote[0].toUpperCase() + vote.slice(1)}</option>`).join('')}</select></label>
      <label>Comment<input name="comment" value="${escapeHtml(mine?.comment || '')}" placeholder="An optional note" maxlength="500"></label><button class="secondary small" type="submit">Save vote</button></div>
      <p class="form-error" role="alert"></p></fieldset></form></details>
    ${responses.length ? `<details class="group-responses"><summary>See how the squad voted (${responses.length})</summary>${responses.map(item => `<div class="group-response"><b>${escapeHtml(item.person.name)} · ${item.response.vote}</b>${item.response.comment ? `<p>${escapeHtml(item.response.comment)}</p>` : ''}</div>`).join('')}</details>` : ''}
    <details class="action-menu"><summary aria-label="Activity actions" title="Actions"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></summary><div class="action-list"><button class="text-button" data-action="edit-activity" data-id="${escapeHtml(activity.id)}">Edit activity</button>${surpriseToggle}${activity.status !== 'accepted' ? `<button class="text-button" data-action="accept-activity" data-id="${escapeHtml(activity.id)}">Mark agreed</button>` : ''}<button class="text-button danger" data-action="remove-activity" data-id="${escapeHtml(activity.id)}">Remove</button></div></details>
  </article>`;
}

function renderPerson(person, current) {
  const partial = person.available_from > current.start_date || person.available_to < current.end_date;
  const isBride = current.bachelorette_id === person.id;
  // Once a bachelorette is set, only she can be unassigned; this avoids accidental swaps.
  const brideButton = viewerIsBride(current) ? '' : isBride
    ?`<button class="text-button" data-action="unset-bachelorette" data-id="${escapeHtml(person.id)}">Unassign</button>`
    : (!current.bachelorette_id ? `<button class="text-button" data-action="set-bachelorette" data-id="${escapeHtml(person.id)}">Make bachelorette</button>` : '');
  return `<article class="person"><div class="person-heading"><h3>${escapeHtml(person.name)}</h3>${hidePrices(current) ? '' : `<span class="quiet">${escapeHtml(money(person.budget))}</span>`}</div>
    ${isBride ? '<span class="status-badge bride">Bachelorette</span>' : ''}
    <p>${dateRange(person.available_from, person.available_to)}</p>${partial ? '<p class="availability-warning">Availability differs from the trip dates.</p>' : ''}
    ${person.interests.length ? `<p class="interests">${person.interests.map(interest => `<span>${escapeHtml(interest)}</span>`).join('')}</p>` : '<p>No interests added yet.</p>'}<div class="person-actions">${brideButton}<button class="text-button" data-action="edit-traveler" title="Edit preferences" data-id="${escapeHtml(person.id)}">Edit preferences</button><button class="text-button danger" data-action="remove-traveler" title="Remove" data-id="${escapeHtml(person.id)}">Remove</button></div></article>`;
}

function renderPlanner() {
  const current = trip();
  if (!current) {
    $('#planner-view').innerHTML = '<div class="empty-state"><h1>That trip is not here.</h1><p>Open another trip or create a new one.</p><a class="button" href="#new">Start a trip</a></div>';
    return;
  }
  const people = travelersFor(current.id);
  if (!people.some(person => person.id === selectedTravelers.get(current.id))) selectedTravelers.set(current.id, people[0]?.id || '');
  const visible = activitiesFor(current.id).filter(activity => visibleTo(current, activity));
  const activities = visible.filter(activity => activity.status !== 'removed').sort((a, b) => a.date.localeCompare(b.date));
  const removed = visible.filter(activity => activity.status === 'removed');
  const bride = brideFor(current);
  const surpriseCount = activities.filter(isSurprise).length;
  const surpriseNote = bride && !viewerIsBride(current)
    ? `<p class="surprise-note">${surpriseCount ? `${surpriseCount} surprise ${surpriseCount === 1 ? 'activity is' : 'activities are'} hidden from ${escapeHtml(bride.name)}. Switch “Viewing as” to ${escapeHtml(bride.name)} to see her version of the plan.` : `Use “Hide from ${escapeHtml(bride.name)}” on any activity to keep it a surprise.`}</p>`
    : '';
  const cost = activities.reduce((total, activity) => total + shareOf(current, activity.estimated_cost_per_person), 0);
  const treated = brideTreated(current);
  const treatButton = bride && !viewerIsBride(current)
    ? `<button class="text-button" data-action="toggle-treat">${treated ? 'Stop treating ' + escapeHtml(bride.name) : 'Treat ' + escapeHtml(bride.name) + ': split her share'}</button>`
    : '';
  // A treated bachelorette sees no totals or budget warnings at all.
  const summary = hidePrices(current) ? '' : `<div class="itinerary-summary"><strong>${escapeHtml(money(cost))}</strong><span>estimated per person · activities only${treated ? ` · includes ${escapeHtml(bride.name)}'s share, split ${payingCount(current)} ways` : ''}</span><span>Trip budget: ${escapeHtml(money(current.budget_per_person))}</span>${treatButton}</div>
      ${cost > current.budget_per_person ? '<p class="budget-message">The activities exceed the trip budget per person.</p>' : ''}`;
  const days = [...new Set(activities.map(activity => activity.date))];
  $('#planner-view').innerHTML = `<div class="planner-top"><div><p class="eyebrow">Your bachelorette trip</p><h1>${escapeHtml(current.title)}</h1><p>${escapeHtml(current.destination)} · ${dateRange(current.start_date, current.end_date)}</p></div>
    <label class="trip-selector">Your trips<select id="trip-select">${product.trips.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
    <div class="planner-toolbar"><span class="status-badge">${escapeHtml(statusName(current.status))}</span><div class="planner-actions"><button class="secondary small" data-action="edit-trip">Edit trip</button><button class="small" data-action="confirm-plan">${current.status === 'confirmed' ? 'Reopen planning' : 'Lock it in'}</button></div></div>
    <div class="planner-columns"><div class="itinerary"><div class="section-heading"><h2>The itinerary</h2><button class="small" data-action="add-activity">Add activity</button></div>
      ${summary}
      ${surpriseNote}
      ${activities.length ? days.map(day => `<h3 class="day-heading">${dateText(day)}</h3>${activities.filter(activity => activity.date === day).map(activity => renderActivity(activity, current, people)).join('')}`).join('') : '<div class="empty-state"><h3>The plan is open.</h3><p>Add an activity, give it a date and cost, then let the squad vote.</p><button data-action="add-activity">Add the first activity</button></div>'}
      ${removed.length ? `<details class="removed-list"><summary>Removed activities (${removed.length})</summary>${removed.map(activity => `<div class="removed-row"><span>${escapeHtml(activity.title)}</span><button class="text-button" data-action="restore-activity" data-id="${escapeHtml(activity.id)}">Restore</button></div>`).join('')}</details>` : ''}
    </div><aside class="people-panel"><div class="section-heading"><h2>The squad</h2><button class="text-button" data-action="add-traveler">Add to squad</button></div>
      ${people.length ? `<label class="viewing-as">Viewing as<select id="traveler-select">${people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === selectedTravelers.get(current.id) ? 'selected' : ''}>${escapeHtml(person.name)}${person.id === current.bachelorette_id ? ' (bachelorette)' : ''}</option>`).join('')}</select><span class="field-help">Switch to see the trip as each person in the squad.</span></label>${people.map(person => renderPerson(person, current)).join('')}` : '<div class="empty-state"><p>Add everyone who is coming, including the bachelorette.</p><button data-action="add-traveler">Add the first person</button></div>'}
    </aside></div>`;
}

function render() {
  if (!product) return;
  const currentRoute = route();
  const known = ['home', 'new', 'trip'].includes(currentRoute.view) ? currentRoute.view : 'home';
  $('#home-view').hidden = known !== 'home';
  $('#new-view').hidden = known !== 'new';
  $('#planner-view').hidden = known !== 'trip';
  const first = product.trips[0];
  $('#planner-link').hidden = !first;
  if (first) $('#planner-link').href = '#trip/' + encodeURIComponent(trip()?.id || first.id);
  if (known === 'home') renderHome();
  if (known === 'trip') renderPlanner();
  setBusy(busy);
}

function handleRoute() {
  const current = location.hash || '#home';
  if (current === previousRoute) { render(); return; }
  previousRoute = current;
  if (route().view === 'new') resetOnboarding();
  render();
  if (!product) return;
  let record;
  if (route().view === 'new') record = event('onboarding_started', {}, visitorId);
  else if (route().view === 'trip' && trip()) record = event('plan_viewed', { trip_id: trip().id });
  else record = event('landing_viewed', {}, visitorId);
  track(record).catch(error => console.warn('Usage log:', error.message));
}

async function submitForm(form, work) {
  $('.form-error', form).textContent = '';
  try { await work(); }
  catch (error) { $('.form-error', form).textContent = error.message; }
}

$('#new-trip-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    if (wizardStep === 1) {
      tripDraft = readTripForm(form);
      const fields = form.elements;
      fields.namedItem('available_from').value ||= tripDraft.start_date;
      fields.namedItem('available_to').value ||= tripDraft.end_date;
      fields.namedItem('budget').value ||= String(tripDraft.budget_per_person);
      wizardStep = 2;
      renderOnboardingStep();
      fields.namedItem('name').focus();
      return;
    }
    const person = { ...readTravelerForm(form), id: 'traveler-' + crypto.randomUUID() };
    const tripId = 'trip-' + crypto.randomUUID();
    person.trip_id = tripId;
    await saveChange(next => {
      next.trips.push({ ...tripDraft, id: tripId, status: 'planning' });
      next.travelers.push(person);
    }, [event('trip_created', { trip_id: tripId }, person.id), event('traveler_added', { trip_id: tripId, traveler_id: person.id }, person.id), event('onboarding_completed', { trip_id: tripId }, person.id)]);
    selectedTravelers.set(tripId, person.id);
    location.hash = '#trip/' + encodeURIComponent(tripId);
  });
});
$('#onboarding-back').addEventListener('click', () => { wizardStep = 1; renderOnboardingStep(); });

$('#trip-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const current = trip();
    const values = readTripForm(form);
    // Only someone other than the bachelorette can change whether she is treated.
    if (brideFor(current) && !viewerIsBride(current)) values.bachelorette_treated = form.elements.namedItem('bachelorette_treated').checked;
    const records = [event('trip_updated', { trip_id: current.id })];
    if ('bachelorette_treated' in values && values.bachelorette_treated !== (current.bachelorette_treated === true)) {
      records.push(event(values.bachelorette_treated ? 'bachelorette_treated' : 'bachelorette_not_treated', { trip_id: current.id, traveler_id: current.bachelorette_id }));
    }
    await saveChange(next => Object.assign(next.trips.find(item => item.id === current.id), values), records);
    $('#trip-dialog').close();
  });
});

$('#traveler-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const current = trip();
    const oldId = form.elements.namedItem('id').value;
    const person = { ...readTravelerForm(form), id: oldId || 'traveler-' + crypto.randomUUID(), trip_id: current.id };
    // When the bachelorette edits her own preferences the checkbox is hidden, so keep the current assignment.
    const wantsBride = viewerIsBride(current) ? current.bachelorette_id === person.id : form.elements.namedItem('is_bachelorette').checked;
    const wasBride = current.bachelorette_id === person.id;
    const records = [event(oldId ? 'traveler_updated' : 'traveler_added', { trip_id: current.id, traveler_id: person.id })];
    if (wantsBride && !wasBride) records.push(event('bachelorette_assigned', { trip_id: current.id, traveler_id: person.id }));
    if (!wantsBride && wasBride) records.push(event('bachelorette_unassigned', { trip_id: current.id, traveler_id: person.id }));
    await saveChange(next => {
      const old = next.travelers.find(item => item.id === person.id);
      if (old) Object.assign(old, person); else next.travelers.push(person);
      const nextTrip = next.trips.find(item => item.id === current.id);
      if (wantsBride) nextTrip.bachelorette_id = person.id;
      else if (wasBride) delete nextTrip.bachelorette_id;
    }, records);
    $('#traveler-dialog').close();
  });
});

$('#activity-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const values = Object.fromEntries(new FormData(form));
    const current = trip();
    const existing = product.activities.find(item => item.id === values.id);
    // Only someone other than the bachelorette can change surprise status; her edits keep the current value.
    const hidden = brideFor(current) && !viewerIsBride(current) ? form.elements.namedItem('hidden_from_bachelorette').checked : existing?.hidden_from_bachelorette === true;
    const activity = { ...values, id: values.id || 'activity-' + crypto.randomUUID(), trip_id: current.id, title: values.title.trim(), category: values.category.trim(), estimated_cost_per_person: Number(values.estimated_cost_per_person), hidden_from_bachelorette: hidden };
    await saveChange(next => {
      const old = next.activities.find(item => item.id === activity.id);
      if (old) Object.assign(old, activity); else next.activities.push(activity);
    }, event(values.id ? 'plan_updated' : 'activity_proposed', { trip_id: current.id, activity_id: activity.id, hidden_from_bachelorette: hidden }));
    $('#activity-dialog').close();
  });
});

// Delegated handlers keep the planner small and work after its lists are re-rendered.
document.addEventListener('submit', eventObject => {
  const form = eventObject.target;
  if (!form.matches('.response-form')) return;
  eventObject.preventDefault();
  submitForm(form, async () => {
    const current = trip();
    const travelerId = selectedTravelers.get(current.id);
    if (!travelerId) throw new Error('Add someone to the squad first.');
    const activityId = form.dataset.activityId;
    const values = Object.fromEntries(new FormData(form));
    const previous = responseFor(activityId, travelerId);
    const response = { ...previous, id: previous?.id || 'response-' + crypto.randomUUID(), trip_id: current.id, traveler_id: travelerId, activity_id: activityId, vote: values.vote, comment: values.comment.trim() };
    await saveChange(next => {
      next.responses = next.responses.filter(item => item.activity_id !== activityId || item.traveler_id !== travelerId);
      next.responses.push(response);
    }, event('response_submitted', { trip_id: current.id, activity_id: activityId, vote: response.vote }, travelerId));
  });
});

document.addEventListener('change', eventObject => {
  if (eventObject.target.id === 'trip-select') location.hash = '#trip/' + encodeURIComponent(eventObject.target.value);
  if (eventObject.target.id === 'traveler-select') { selectedTravelers.set(trip().id, eventObject.target.value); renderPlanner(); setBusy(busy); }
});

async function handleAction(button) {
  const { action, id } = button.dataset;
  const current = trip();
  if (action === 'edit-trip') return openEditor('trip');
  if (action === 'add-traveler' || action === 'edit-traveler') return openEditor('traveler', id);
  if (action === 'add-activity' || action === 'edit-activity') return openEditor('activity', id);
  if (action === 'remove-traveler') {
    return saveChange(next => {
      next.travelers = next.travelers.filter(person => person.id !== id);
      next.responses = next.responses.filter(response => response.traveler_id !== id);
      const nextTrip = next.trips.find(item => item.id === current.id);
      if (nextTrip.bachelorette_id === id) delete nextTrip.bachelorette_id;
    }, event('traveler_removed', { trip_id: current.id, traveler_id: id }));
  }
  if (action === 'set-bachelorette' || action === 'unset-bachelorette') {
    const assign = action === 'set-bachelorette';
    return saveChange(next => {
      const nextTrip = next.trips.find(item => item.id === current.id);
      if (assign) nextTrip.bachelorette_id = id; else delete nextTrip.bachelorette_id;
    }, event(assign ? 'bachelorette_assigned' : 'bachelorette_unassigned', { trip_id: current.id, traveler_id: id }));
  }
  if (action === 'toggle-treat') {
    const treat = !brideTreated(current);
    return saveChange(next => { next.trips.find(item => item.id === current.id).bachelorette_treated = treat; },
      event(treat ? 'bachelorette_treated' : 'bachelorette_not_treated', { trip_id: current.id, traveler_id: current.bachelorette_id }));
  }
  if (action === 'toggle-surprise') {
    const hidden = !isSurprise(product.activities.find(activity => activity.id === id));
    return saveChange(next => { next.activities.find(activity => activity.id === id).hidden_from_bachelorette = hidden; },
      event(hidden ? 'activity_hidden_from_bachelorette' : 'activity_shown_to_bachelorette', { trip_id: current.id, activity_id: id }));
  }
  if (['accept-activity', 'remove-activity', 'restore-activity'].includes(action)) {
    const status = { 'accept-activity': 'accepted', 'remove-activity': 'removed', 'restore-activity': 'proposed' }[action];
    return saveChange(next => { next.activities.find(activity => activity.id === id).status = status; }, event('plan_updated', { trip_id: current.id, activity_id: id, status }));
  }
  if (action === 'confirm-plan') {
    const status = current.status === 'confirmed' ? 'planning' : 'confirmed';
    return saveChange(next => { next.trips.find(item => item.id === current.id).status = status; }, event(status === 'confirmed' ? 'plan_confirmed' : 'plan_updated', { trip_id: current.id, status }));
  }
}

document.addEventListener('click', eventObject => {
  const close = eventObject.target.closest('[data-close]');
  if (close) $('#' + close.dataset.close).close();
  document.querySelectorAll('.action-menu[open]').forEach(menu => { if (!menu.contains(eventObject.target) || eventObject.target.closest('[data-action]')) menu.open = false; });
  const button = eventObject.target.closest('[data-action]');
  if (button && !busy) handleAction(button).catch(error => notice(error.message, true));
});

async function load() {
  $('#app-loading').hidden = false;
  $('#load-error').hidden = true;
  try {
    product = await api('/api/product');
    $('#app-loading').hidden = true;
    previousRoute = undefined;
    handleRoute();
  } catch (error) {
    $('#app-loading').hidden = true;
    $('#load-error').hidden = false;
    $('#load-error-message').textContent = error.message;
  }
}
$('#retry-load').addEventListener('click', load);
window.addEventListener('hashchange', handleRoute);
load();
