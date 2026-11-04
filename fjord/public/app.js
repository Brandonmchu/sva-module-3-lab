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
let selectedGeneratedRoute = null;
let generatedRoutes = [];
let suggestions = [];
const lookingUp = new Set();
const openIdeas = new Set();

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error || 'The request failed. Please try again.'), { status: response.status });
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
const event = (name, properties, actorId = actor()) => ({ event: name, actor_id: actorId, source: 'product', properties: { visitor_id: visitorId, ...properties } });
// "Food, photography, and sights" becomes Food, photography, sights.
const interestLabel = value => String(value).trim().replace(/^(and|&)\s+/i, '');
const interestKey = value => interestLabel(value).toLowerCase();
const interests = value => [...new Set(value.split(',').map(interestLabel).filter(Boolean))];
const dateText = value => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
const dateRange = (start, end) => dateText(start) + ' – ' + dateText(end);
const money = (value, currency = trip()?.currency || 'CAD') => new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const statusName = value => ({ draft: 'Draft', planning: 'Planning', confirmed: 'Ready', cancelled: 'Cancelled', proposed: 'Proposed', accepted: 'Agreed', removed: 'Removed' })[value] || value;

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
    if (input) input.value = Array.isArray(value) ? value.join(', ') : value;
  }
}

function openEditor(kind, id) {
  const current = trip();
  if (!current) return;
  const form = $('#' + kind + '-form');
  let values;
  if (kind === 'trip') values = current;
  if (kind === 'traveler') {
    values = product.travelers.find(person => person.id === id) || { id: '', name: '', available_from: current.start_date, available_to: current.end_date, budget: current.budget_per_person, interests: [] };
    $('#traveler-dialog-heading').textContent = id ? 'Edit traveler' : 'Add traveler';
  }
  if (kind === 'activity') {
    values = product.activities.find(activity => activity.id === id) || { id: '', title: '', date: current.start_date, category: '', estimated_cost_per_person: 0, status: 'proposed' };
    $('#activity-dialog-heading').textContent = id ? 'Edit activity' : 'Add an activity';
  }
  fillForm(form, values);
  $('#' + kind + '-dialog').showModal();
}

function resetOnboarding() {
  wizardStep = 1;
  tripDraft = undefined;
  selectedGeneratedRoute = null;
  generatedRoutes = [];
  $('#new-trip-form').reset();
  $('.form-error', $('#new-trip-form')).textContent = '';
  renderOnboardingStep();
}

async function createRouteOptions() {
  const form = $('#new-trip-form');
  const fields = form.elements;
  const brief = $('#trip-brief').value.trim();
  const destination = fields.namedItem('destination').value.trim();
  const start_date = fields.namedItem('start_date').value;
  const end_date = fields.namedItem('end_date').value;
  const budget_per_person = Number(fields.namedItem('budget_per_person').value);
  const currency = fields.namedItem('currency').value.trim().toUpperCase();
  if (!destination || !start_date || !end_date || !fields.namedItem('budget_per_person').value || !/^[A-Z]{3}$/.test(currency)) { $('.form-error', form).textContent = 'Add a destination, both dates, a budget, and a three-letter currency before generating routes.'; return; }
  if (end_date < start_date) { $('.form-error', form).textContent = 'End date must be on or after start date.'; return; }
  $('.form-error', form).textContent = '';
  if (!fields.namedItem('title').value) fields.namedItem('title').value = `A weekend in ${destination}`;
  const button = $('#route-options-button'); button.disabled = true; button.textContent = 'Planning your routes…';
  try {
    const plan = await api('/api/routes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ destination, start_date, end_date, budget_per_person, currency, brief }) });
    generatedRoutes = plan.options; selectedGeneratedRoute = null;
    $('#route-options').hidden = false;
    $('#route-options').innerHTML = `<p class="field-help route-disclaimer">Suggested times and costs are estimates. Check hours, transport, and bookings before travel.</p><div class="route-option-grid">${generatedRoutes.map((option,index) => `<article class="route-option"><p class="eyebrow">ROUTE ${index+1}</p><h3>${escapeHtml(option.name)}</h3><p>${escapeHtml(option.summary)}</p><b>${escapeHtml(money(option.estimated_total_per_person,currency))} estimated / person · ${option.stops.length} stops</b><details><summary>See the full route</summary>${option.stops.map(stop => `<div class="route-stop"><strong>${escapeHtml(dateText(stop.date))} · ${escapeHtml(stop.time)} · ${escapeHtml(stop.title)}</strong><span>${escapeHtml(stop.place)} · ${escapeHtml(stop.duration_minutes)} min · ${escapeHtml(money(stop.estimated_cost_per_person,currency))}</span><p>${escapeHtml(stop.description)}</p><small>${escapeHtml(stop.travel_from_previous)} · ${escapeHtml(stop.booking_note)}</small></div>`).join('')}</details><button type="button" class="small" data-route-choice="${index}">Choose this draft</button></article>`).join('')}</div>`;
  } catch (error) { $('.form-error', form).textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Make my route options'; }
}

$('#route-options-button').addEventListener('click', createRouteOptions);
$('#route-options').addEventListener('click', e => {
  const choice = e.target.closest('[data-route-choice]'); if (!choice) return;
  selectedGeneratedRoute = Number(choice.dataset.routeChoice);
  $('#route-options').querySelectorAll('.route-option').forEach(card => card.classList.toggle('chosen', card.contains(choice)));
  $('#onboarding-submit').textContent = 'Continue with this draft';
});
$('#voice-button').addEventListener('click', () => {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = $('#voice-button');
  if (!Speech) { $('#voice-status').textContent = 'Voice input is not supported in this browser. Try the latest Chrome or Edge, or type your trip idea.'; return; }
  const recognition = new Speech(); recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
  button.disabled = true; $('#voice-status').textContent = 'Listening… Speak your trip idea now.';
  recognition.onresult = e => { $('#trip-brief').value = e.results[0][0].transcript; $('#voice-status').textContent = 'Voice note captured. Review or edit the text, then make your route options.'; };
  recognition.onerror = e => {
    const messages = { 'not-allowed':'Microphone access is blocked. Allow microphone access for this site in your browser, then try again.', 'service-not-allowed':'Voice recognition is unavailable here. Try Chrome or Edge, or type your trip idea.', 'audio-capture':'No microphone was found. Connect a microphone or type your trip idea.', 'no-speech':'No speech was detected. Try again and speak after Listening appears.', 'network':'Voice recognition could not connect. Check your connection and try again.' };
    $('#voice-status').textContent = messages[e.error] || 'Voice input could not start. Check microphone access, or type your trip idea.';
  };
  recognition.onend = () => { button.disabled = false; if ($('#voice-status').textContent === 'Listening… Speak your trip idea now.') $('#voice-status').textContent = 'No speech was captured. Try again or type your trip idea.'; };
  try { recognition.start(); } catch { button.disabled = false; $('#voice-status').textContent = 'Voice input could not start. Check microphone access, or type your trip idea.'; }
});

function renderOnboardingStep() {
  const basics = wizardStep === 1;
  $('#trip-basics').hidden = !basics;
  $('#trip-basics').disabled = !basics;
  $('#organizer-details').hidden = basics;
  $('#organizer-details').disabled = basics;
  $('#onboarding-back').hidden = basics;
  $('#onboarding-step').textContent = `Step ${wizardStep} of 2`;
  $('#onboarding-heading').textContent = basics ? 'Pick a place to begin.' : 'Put yourself on the map.';
  $('#onboarding-intro').textContent = basics ? 'Set a destination, dates, and a comfortable budget. Your group can fine-tune the plan together.' : 'Add your availability, budget, and favorite things. You can bring in the rest of the crew next.';
  $('#onboarding-submit').textContent = basics ? 'Next: your details' : 'Start our plan';
}

function renderHome() {
  const sample = product.trips[0];
  const posterArt = `<div class="poster-art" aria-hidden="true"><svg viewBox="0 0 640 430" role="presentation" focusable="false">
    <rect width="640" height="430" fill="#e8b67c"/>
    <circle cx="472" cy="116" r="62" fill="#a83e36"/>
    <path d="M0 242 142 91l105 123 88-104 180 177v143H0Z" fill="#5b8a72"/>
    <path d="m0 278 157-93 102 94 108-72 117 69 156-105v229H0Z" fill="#315746"/>
    <path d="M0 340q114-43 229 0t229 0 182-2v92H0Z" fill="#f3ead3"/>
    <path d="M0 376q115-34 229 0t229 0 182-2" fill="none" stroke="#a83e36" stroke-width="8"/>
    <path d="M0 405q115-28 229 0t229 0 182-2" fill="none" stroke="#d4a574" stroke-width="7"/>
    <path d="m145 91 24 28 27-8-54-20 3-25 21 22" fill="#f3ead3" opacity=".9"/>
    <path d="m335 110 28 31 31-10-57-21 4-31 22 27" fill="#f3ead3" opacity=".9"/>
  </svg><span class="poster-label">TAKE THE LONG WAY</span></div>`;
  $('#sample-link').hidden = !sample;
  if (!sample) {
    $('#sample-preview').innerHTML = `${posterArt}<div class="poster-details"><p class="eyebrow">YOUR NEXT STORY</p><h2>Your next weekend starts here.</h2><p class="quiet">Choose a destination, then bring your people into the plan.</p></div>`;
    return;
  }
  const ideas = activitiesFor(sample.id).filter(activity => activity.status !== 'removed');
  $('#sample-link').href = '#trip/' + encodeURIComponent(sample.id);
  $('#sample-preview').innerHTML = `${posterArt}<div class="poster-details"><p class="eyebrow">A WEEKEND IN THE MAKING</p><h2>${escapeHtml(sample.destination)}</h2><p class="quiet">${dateRange(sample.start_date, sample.end_date)} · ${travelersFor(sample.id).length} travelers</p>
    <div class="sample-meta"><div><span>THE GROUP BUDGET</span><b>${escapeHtml(money(sample.budget_per_person, sample.currency))} <small>/ person</small></b></div><div><span>ON THE PLAN</span><b>${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}</b></div></div>
    <a class="text-link" href="#trip/${encodeURIComponent(sample.id)}">See the shared plan <span aria-hidden="true">→</span></a></div>`;
}

function responseFor(activityId, travelerId) {
  return product.responses.filter(response => response.activity_id === activityId && response.traveler_id === travelerId).at(-1);
}

function renderActivity(activity, current, people) {
  const responses = people.map(person => ({ person, response: responseFor(activity.id, person.id) })).filter(item => item.response);
  const selected = selectedTravelers.get(current.id);
  const person = people.find(item => item.id === selected);
  const mine = responseFor(activity.id, selected);
  const totals = ['yes', 'maybe', 'no'].map(vote => responses.filter(item => item.response.vote === vote).length + ' ' + vote).join(' · ');
  const outsideDates = activity.date < current.start_date || activity.date > current.end_date;
  return `<article class="activity" data-activity-id="${escapeHtml(activity.id)}">
    <div class="activity-heading"><h3>${escapeHtml(activity.title)}</h3><span class="activity-cost">${escapeHtml(money(activity.estimated_cost_per_person))}</span></div>
    <div class="activity-meta"><span>${escapeHtml(activity.category)}</span><span class="status-badge ${activity.status === 'proposed' ? 'proposed' : ''}">${escapeHtml(statusName(activity.status))}</span><span class="vote-totals">${totals}</span></div>
    ${activity.description ? `<div class="activity-detail"><p><strong>${escapeHtml(activity.time || '')}${activity.place ? ' · ' + escapeHtml(activity.place) : ''}</strong>${activity.duration_minutes ? ' · about ' + escapeHtml(activity.duration_minutes) + ' min' : ''}</p><p>${escapeHtml(activity.description)}</p>${activity.travel_from_previous ? `<p><b>Getting there:</b> ${escapeHtml(activity.travel_from_previous)}</p>` : ''}${activity.booking_note ? `<p><b>Before you go:</b> ${escapeHtml(activity.booking_note)}</p>` : ''}</div>` : ''}
    ${outsideDates ? '<p class="budget-message">This activity is outside the trip dates.</p>' : ''}
    <div class="activity-actions"><button class="text-button" data-action="edit-activity" data-id="${escapeHtml(activity.id)}">Edit activity</button>${activity.status !== 'accepted' ? `<button class="text-button" data-action="accept-activity" data-id="${escapeHtml(activity.id)}">Mark agreed</button>` : ''}<button class="text-button danger" data-action="remove-activity" data-id="${escapeHtml(activity.id)}">Remove</button></div>
    <form class="response-form" data-activity-id="${escapeHtml(activity.id)}"><fieldset ${person ? '' : 'disabled'}><legend>${person ? 'Your response as ' + escapeHtml(person.name) : 'Add a traveler to respond'}</legend>
      <div class="response-fields"><label>Vote<select name="vote" required><option value="" disabled ${mine ? '' : 'selected'}>Choose</option>${['yes', 'maybe', 'no'].map(vote => `<option value="${vote}" ${mine?.vote === vote ? 'selected' : ''}>${vote[0].toUpperCase() + vote.slice(1)}</option>`).join('')}</select></label>
      <label>Comment<input name="comment" value="${escapeHtml(mine?.comment || '')}" placeholder="An optional note" maxlength="500"></label><button class="secondary small" type="submit">Save response</button></div>
      <p class="form-error" role="alert"></p></fieldset></form>
    ${responses.length ? `<details class="group-responses"><summary>View ${responses.length} group ${responses.length === 1 ? 'response' : 'responses'}</summary>${responses.map(item => `<div class="group-response"><b>${escapeHtml(item.person.name)} · ${item.response.vote}</b>${item.response.comment ? `<p>${escapeHtml(item.response.comment)}</p>` : ''}</div>`).join('')}</details>` : ''}
  </article>`;
}

// Top 3 things to do per interest, from the cached Gemini lookups for this trip and destination.
function renderIdeas(person, current) {
  const items = person.interests.filter(interestKey);
  if (!items.length) return '';
  const found = items.map(interest => ({ interest, lookup: suggestions.find(item => item.trip_id === current.id && item.destination === current.destination && item.currency === current.currency && item.interest === interestKey(interest)) })).filter(item => item.lookup);
  const loading = lookingUp.has(current.id);
  const label = loading ? 'Looking up things to do…' : found.length ? 'Find ideas for the new interests' : 'Find the top 3 things to do';
  const button = found.length < items.length ? `<div class="ideas-actions"><button class="text-button" data-action="find-ideas" data-id="${escapeHtml(person.id)}" ${loading ? 'aria-disabled="true"' : ''}>${label}</button></div>` : '';
  const list = found.length ? `<details class="group-responses ideas" data-traveler-id="${escapeHtml(person.id)}" ${openIdeas.has(person.id) ? 'open' : ''}><summary>Top 3 things to do in ${escapeHtml(current.destination)}</summary>
    ${found.map(({ interest, lookup }) => `<div class="idea-group"><b>${escapeHtml(interestLabel(interest))}</b><ol>${lookup.ideas.map(idea => `<li><span class="idea-title">${escapeHtml(idea.title)}</span> <span class="idea-cost">· ${idea.estimated_cost_per_person ? 'about ' + escapeHtml(money(idea.estimated_cost_per_person, lookup.currency)) + ' per person' : 'free'}</span>${idea.description ? `<p>${escapeHtml(idea.description)}</p>` : ''}</li>`).join('')}</ol></div>`).join('')}</details>` : '';
  return list + button;
}

// Redraw only the ideas area of each traveler card, so a lookup that finishes later
// never wipes a vote or comment someone is typing elsewhere in the planner.
function refreshIdeas(tripId) {
  const current = trip();
  if (route().view !== 'trip' || current?.id !== tripId) return;
  for (const person of travelersFor(tripId)) {
    const slot = document.querySelector(`.ideas-slot[data-traveler-id="${CSS.escape(person.id)}"]`);
    if (slot) slot.innerHTML = renderIdeas(person, current);
  }
  setBusy(busy);
}

async function findIdeas(current, travelerId) {
  if (lookingUp.has(current.id)) return;
  const actorId = actor();
  lookingUp.add(current.id);
  openIdeas.add(travelerId);
  refreshIdeas(current.id);
  let properties = { trip_id: current.id, traveler_id: travelerId };
  try {
    const result = await api('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trip_id: current.id }) });
    suggestions = result.lookups;
    properties = { ...properties, outcome: 'found', new_lookups: result.added, failed_lookups: result.failed.length, remaining_lookups: result.remaining };
    if (result.failed.length) notice('These interests could not be looked up: ' + result.failed.join(', ') + '. Please try again.', true);
    else if (result.remaining) notice('There are more interests to look up. Select the button again to continue.');
    else notice('');
  } catch (error) {
    properties = { ...properties, outcome: 'failed', reason: error.status === 503 ? 'not_configured' : error.status === 502 ? 'gemini_error' : 'request_failed' };
    notice(error.message, true);
  } finally {
    lookingUp.delete(current.id);
    refreshIdeas(current.id);
  }
  track(event('ideas_requested', properties, actorId)).catch(error => console.warn('Usage log:', error.message));
}

function renderPerson(person, current) {
  const partial = person.available_from > current.start_date || person.available_to < current.end_date;
  return `<article class="person"><div class="person-heading"><h3>${escapeHtml(person.name)}</h3><span class="quiet">${escapeHtml(money(person.budget))}</span></div>
    <p>${dateRange(person.available_from, person.available_to)}</p>${partial ? '<p class="availability-warning">Availability differs from the trip dates.</p>' : ''}
    <p>${escapeHtml(person.interests.map(interestLabel).join(', ') || 'No interests added yet.')}</p><div class="ideas-slot" data-traveler-id="${escapeHtml(person.id)}">${renderIdeas(person, current)}</div><div class="person-actions"><button class="text-button" data-action="edit-traveler" data-id="${escapeHtml(person.id)}">Edit preferences</button><button class="text-button danger" data-action="remove-traveler" data-id="${escapeHtml(person.id)}">Remove</button></div></article>`;
}

function renderPlanner() {
  const current = trip();
  if (!current) {
    $('#planner-view').innerHTML = '<div class="empty-state"><h1>That trip is not here.</h1><p>Open another trip or create a new one.</p><a class="button" href="#new">Start a trip</a></div>';
    return;
  }
  const people = travelersFor(current.id);
  if (!people.some(person => person.id === selectedTravelers.get(current.id))) selectedTravelers.set(current.id, people[0]?.id || '');
  const activities = activitiesFor(current.id).filter(activity => activity.status !== 'removed').sort((a, b) => a.date.localeCompare(b.date));
  const removed = activitiesFor(current.id).filter(activity => activity.status === 'removed');
  const cost = activities.reduce((total, activity) => total + activity.estimated_cost_per_person, 0);
  const days = [...new Set(activities.map(activity => activity.date))];
  const routeActivities = activities.slice(0, 4);
  const routeY = [62, 36, 68, 42];
  const routePoints = routeActivities.map((_, index) => ({
    x: routeActivities.length === 1 ? 400 : 145 + index * (510 / (routeActivities.length - 1)),
    y: routeY[index]
  }));
  const routePath = routePoints.length === 1
    ? `M 70 ${routePoints[0].y} Q 230 ${routePoints[0].y} ${routePoints[0].x} ${routePoints[0].y}`
    : routePoints.slice(1).map((point, index) => {
      const previous = routePoints[index];
      const segment = `Q ${(previous.x + point.x) / 2} ${previous.y} ${point.x} ${point.y}`;
      return index === 0 ? `M ${previous.x} ${previous.y} ${segment}` : segment;
    }).join(' ');
  const routeLine = `<div class="route-visual"><div class="route-visual-heading"><div><p class="eyebrow">THE ROUTE</p><h2>Your weekend, at a glance</h2></div><span class="field-help">Illustrative route · confirm local details</span></div><svg viewBox="0 0 800 132" role="img" aria-label="A suggested route connecting ${routeActivities.length} trip stops"><path d="${routePath}" fill="none" stroke="#315746" stroke-width="4" stroke-dasharray="8 9"/>${routeActivities.map((activity,index)=>{const point=routePoints[index];return `<g transform="translate(${point.x},${point.y})"><circle r="19" fill="#a83e36"/><text y="5" text-anchor="middle" fill="#fffdf7" font-size="14">${index+1}</text><text y="43" text-anchor="middle" fill="#3e2f26" font-size="12">${escapeHtml(activity.title.slice(0,22))}</text></g>`;}).join('')}</svg></div>`;
  $('#planner-view').innerHTML = `<div class="planner-top"><div><p class="eyebrow">Your shared weekend</p><h1>${escapeHtml(current.title)}</h1><p>${escapeHtml(current.destination)} · ${dateRange(current.start_date, current.end_date)}</p></div>
    <label class="trip-selector">Your trips<select id="trip-select">${product.trips.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
    <div class="planner-toolbar"><span class="status-badge">${escapeHtml(statusName(current.status))}</span><div class="planner-actions"><button class="secondary small" data-action="edit-trip">Edit trip</button><button class="small" data-action="confirm-plan">${current.status === 'confirmed' ? 'Reopen planning' : 'Confirm plan'}</button></div></div>
    ${activities.length ? routeLine : ''}
    <div class="planner-columns"><div class="itinerary"><div class="section-heading"><h2>Shared itinerary</h2><button class="small" data-action="add-activity">Add activity</button></div>
      <div class="itinerary-summary"><strong>${escapeHtml(money(cost))}</strong><span>estimated per person · activities only</span><span>Trip budget: ${escapeHtml(money(current.budget_per_person))}</span></div>
      ${cost > current.budget_per_person ? '<p class="budget-message">The activities exceed the trip budget per person.</p>' : ''}
      ${activities.length ? days.map(day => `<h3 class="day-heading">${dateText(day)}</h3>${activities.filter(activity => activity.date === day).map(activity => renderActivity(activity, current, people)).join('')}`).join('') : '<div class="empty-state"><h3>The plan is open.</h3><p>Add an activity, give it a date and cost, then ask the group to respond.</p><button data-action="add-activity">Add the first activity</button></div>'}
      ${removed.length ? `<details class="removed-list"><summary>Removed activities (${removed.length})</summary>${removed.map(activity => `<div class="removed-row"><span>${escapeHtml(activity.title)}</span><button class="text-button" data-action="restore-activity" data-id="${escapeHtml(activity.id)}">Restore</button></div>`).join('')}</details>` : ''}
    </div><aside class="people-panel"><div class="section-heading"><h2>Travelers</h2><button class="text-button" data-action="add-traveler">Add traveler</button></div>
      ${people.length ? `<label class="viewing-as">Viewing as<select id="traveler-select">${people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === selectedTravelers.get(current.id) ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('')}</select><span class="field-help">Take turns as different travelers on this screen.</span></label>${people.map(person => renderPerson(person, current)).join('')}` : '<div class="empty-state"><p>Add the people who are going on this trip.</p><button data-action="add-traveler">Add a traveler</button></div>'}
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
      if (selectedGeneratedRoute !== null) {
        generatedRoutes[selectedGeneratedRoute].stops.forEach(stop => {
          next.activities.push({ id: 'activity-' + crypto.randomUUID(), trip_id: tripId, title: stop.title, date: stop.date, category: stop.category || 'Experience', estimated_cost_per_person: stop.estimated_cost_per_person, status: 'proposed', time:stop.time, place:stop.place, description:stop.description, duration_minutes:stop.duration_minutes, travel_from_previous:stop.travel_from_previous, booking_note:stop.booking_note });
        });
      }
    }, [event('trip_created', { trip_id: tripId }, person.id), event('traveler_added', { trip_id: tripId, traveler_id: person.id }, person.id), event('onboarding_completed', { trip_id: tripId, generated_route: selectedGeneratedRoute }, person.id)]);
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
    await saveChange(next => Object.assign(next.trips.find(item => item.id === current.id), values), event('trip_updated', { trip_id: current.id }));
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
    await saveChange(next => {
      const old = next.travelers.find(item => item.id === person.id);
      if (old) Object.assign(old, person); else next.travelers.push(person);
    }, event(oldId ? 'traveler_updated' : 'traveler_added', { trip_id: current.id, traveler_id: person.id }));
    $('#traveler-dialog').close();
  });
});

$('#activity-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const values = Object.fromEntries(new FormData(form));
    const current = trip();
    const activity = { ...values, id: values.id || 'activity-' + crypto.randomUUID(), trip_id: current.id, title: values.title.trim(), category: values.category.trim(), estimated_cost_per_person: Number(values.estimated_cost_per_person), duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : 0 };
    await saveChange(next => {
      const old = next.activities.find(item => item.id === activity.id);
      if (old) Object.assign(old, activity); else next.activities.push(activity);
    }, event(values.id ? 'plan_updated' : 'activity_proposed', { trip_id: current.id, activity_id: activity.id }));
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
    if (!travelerId) throw new Error('Add a traveler first.');
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
  if (action === 'find-ideas') return findIdeas(current, id);
  if (action === 'remove-traveler') {
    return saveChange(next => {
      next.travelers = next.travelers.filter(person => person.id !== id);
      next.responses = next.responses.filter(response => response.traveler_id !== id);
    }, event('traveler_removed', { trip_id: current.id, traveler_id: id }));
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

// Keep a traveler's idea list open across re-renders. Toggle events do not bubble, so listen in the capture phase.
document.addEventListener('toggle', eventObject => {
  const details = eventObject.target;
  if (!details.matches?.('.ideas')) return;
  if (details.open) openIdeas.add(details.dataset.travelerId); else openIdeas.delete(details.dataset.travelerId);
}, true);

document.addEventListener('click', eventObject => {
  const close = eventObject.target.closest('[data-close]');
  if (close) $('#' + close.dataset.close).close();
  const button = eventObject.target.closest('[data-action]');
  if (button && !busy) handleAction(button).catch(error => notice(error.message, true));
});

async function load() {
  $('#app-loading').hidden = false;
  $('#load-error').hidden = true;
  try {
    product = await api('/api/product');
    // Suggestions are optional. The trip planner still loads if they cannot be read.
    suggestions = (await api('/api/suggestions').catch(() => ({ lookups: [] }))).lookups;
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
