import { bookingPlaceholder } from './booking-placeholder.js';
// Shared baseline: product behavior lives here; copy and forms live in index.html.
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const visitorId = crypto.randomUUID();
const selectedTravelers = new Map();
const openThreads = new Set();
let product;
let busy = false;
let wizardStep = 1;
let tripDraft;
let previousRoute;
let plannerPanel = 'itinerary';
const kindOf = activity => activity.plan_kind || (/flight|train|transport|rental/i.test(activity.category) ? 'transport' : /hotel|stay|airbnb|vrbo/i.test(activity.category) ? 'stays' : 'plans');
const panelTitles = {itinerary:'Shared itinerary',transport:'Flights, trains & cars',stays:'Places to stay',plans:'Food & activities',questions:'Questions on every plan'};
const countryFlags = {US:'🇺🇸',CA:'🇨🇦',PT:'🇵🇹',FR:'🇫🇷',GB:'🇬🇧',IT:'🇮🇹',ES:'🇪🇸',MX:'🇲🇽',JP:'🇯🇵'};
function pandaMood(current, activities) {
  if (current.mascot_stage && current.mascot_stage !== 'auto') return current.mascot_stage;
  if (!activities.length) return 'starting';
  const today = new Date().toLocaleDateString('en-CA');
  if (current.status === 'confirmed' && today >= current.start_date && today <= current.end_date) return 'vacation';
  if (current.status === 'confirmed' || activities.every(a => a.booking_state === 'booked' || a.status === 'accepted')) return 'relaxed';
  return activities.some(a => a.booking_state === 'booked' || a.status === 'accepted' || a.booking_state === 'pending') ? 'planning' : 'starting';
}
function moodOptions(value) { return [['auto','Follow planning progress'],['starting','Stressed · just starting'],['planning','Happier · plans taking shape'],['relaxed','Ready · sunglasses & bag'],['vacation','At destination · flag T-shirt']].map(([key,label])=>`<option value="${key}" ${value === key ? 'selected' : ''}>${label}</option>`).join(''); }
function partnerOffers() { return `<section class="partner-offers"><div class="offer-heading"><p class="eyebrow">Better together</p><h2>Partner discounts</h2><p>Illustrative group offers for the MVP. These are examples, not negotiated deals or live quotes.</p></div><div class="offer-examples">${[['Hotel group rate','20%','6+ rooms · fees and cancellation terms to confirm'],['Car rental / group van','10%','Seats, insurance, mileage and driver eligibility to confirm'],['Local guide & group experience','15%','6+ guests · language, meeting point and inclusions to confirm']].map(([name,rate,terms])=>`<article class="offer-example"><h3>${name}</h3><strong>${rate} example saving</strong><p>${terms}</p><p>Provider confirmation and final price required.</p><button class="secondary small" data-offer-title="${name}" data-offer-rate="${rate}" data-offer-terms="${terms}">Share an offer to discuss</button></article>`).join('')}</div><button class="small" data-action="add-activity" data-kind="offers">+ Share another partner offer</button><p class="profile-note">Offers you share below are saved with this trip and have their own discussion.</p></section>`; }

function avatar(person, extra = '') {
  const sampleIds = ['traveler-001', 'traveler-002', 'traveler-003'];
  const index = sampleIds.indexOf(person?.id);
  return index < 0 ? `<span class="profile-photo profile-fallback ${extra}" aria-hidden="true">${escapeHtml((person?.name || '?').slice(0,1))}</span>` : `<img class="profile-photo ${extra}" src="/avatars/traveler-${index + 1}.png" alt="${escapeHtml(person.name)} — sample profile photo" width="40" height="40">`;
}
document.addEventListener('click', e => {
  const button = e.target.closest?.('[data-planner-panel]');
  if (!button) return;
  plannerPanel = button.dataset.plannerPanel;
  if (plannerPanel === 'questions') activitiesFor(trip().id).forEach(a => openThreads.add(a.id));
  renderPlanner();
});

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
const event = (name, properties, actorId = actor()) => ({ event: name, actor_id: actorId, source: 'product', properties: { visitor_id: visitorId, ...properties } });
const interests = value => [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
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
  if (kind === 'trip') values = { country_code: 'other', ...current };
  if (kind === 'traveler') {
    values = product.travelers.find(person => person.id === id) || { id: '', name: '', available_from: current.start_date, available_to: current.end_date, budget: current.budget_per_person, interests: [] };
    $('#traveler-dialog-heading').textContent = id ? 'Edit traveler' : 'Add traveler';
  }
  if (kind === 'activity') {
    values = product.activities.find(activity => activity.id === id) || { id: '', title: '', date: current.start_date, category: 'Group plan', estimated_cost_per_person: 0, status: 'proposed', plan_kind: ['transport','stays','plans','offers'].includes(plannerPanel) ? plannerPanel : 'plans', quote_currency: current.currency, price_basis: 'per person' };
    values = { ...values, plan_kind: kindOf(values), quote_currency: values.quote_currency || current.currency };
    form.elements.namedItem('booking_owner_id').innerHTML = '<option value="">No one yet</option>' + travelersFor(current.id).map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    $('#activity-dialog-heading').textContent = id ? 'Edit shared plan' : 'Share a plan or booking';

  }
  fillForm(form, values);
  $('#' + kind + '-dialog').showModal();
}

// Marketing: the occasion only personalizes onboarding hints. It is not saved with the trip.
const OCCASIONS = {
  bachelor: { title: "Jake's last ride", destination: 'Nashville, Vegas, Miami…', interests: 'Nightlife, good food, the pool' },
  birthday: { title: "Sam's 30th in the sun", destination: 'Cancún, Lisbon, Montréal…', interests: 'Beach, brunch, a big dinner' },
  reunion: { title: "Class of '16, back together", destination: 'Somewhere in the middle for everyone', interests: 'Catching up, hikes, a long dinner' },
  concert: { title: 'The concert weekend', destination: 'Wherever the show is', interests: 'The show, pre-drinks, late-night food' },
  sport: { title: 'Whistler ski weekend', destination: 'Whistler, Banff, Mont-Tremblant…', interests: 'Ski, hot tub, après' },
  getaway: { title: "Girls' beach weekend", destination: 'Tulum, Muskoka, Napa…', interests: 'Spa, wine, the beach' }
};
let pendingOccasion;

function applyOccasion(key) {
  const hints = OCCASIONS[key] || OCCASIONS.bachelor;
  const fields = $('#new-trip-form').elements;
  fields.namedItem('title').placeholder = hints.title;
  fields.namedItem('destination').placeholder = hints.destination;
  fields.namedItem('interests').placeholder = hints.interests;
}

function resetOnboarding() {
  wizardStep = 1;
  tripDraft = undefined;
  $('#new-trip-form').reset();
  $('.form-error', $('#new-trip-form')).textContent = '';
  if (pendingOccasion && OCCASIONS[pendingOccasion]) {
    const choice = $(`#new-trip-form input[name="occasion"][value="${pendingOccasion}"]`);
    if (choice) choice.checked = true;
  }
  pendingOccasion = undefined;
  applyOccasion($('#new-trip-form input[name="occasion"]:checked')?.value);
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const basics = wizardStep === 1;
  $('#trip-basics').hidden = !basics;
  $('#trip-basics').disabled = !basics;
  $('#organizer-details').hidden = basics;
  $('#organizer-details').disabled = basics;
  $('#onboarding-back').hidden = basics;
  $('#gx-progress-2')?.classList.toggle('is-on', !basics);
  $('#onboarding-step').textContent = `Step ${wizardStep} of 2 · ${basics ? 'The trip' : 'You'}`;
  $('#onboarding-heading').textContent = basics ? "Let's get this trip started." : "Now you. You're the organizer.";
  $('#onboarding-intro').textContent = basics ? 'Pick the occasion, then the basics. Nothing is locked in, so you can change anything later.' : "Add your own dates, budget and what you're into. Then add your friends, and each of them fills in theirs. No more chasing.";
  $('#onboarding-submit').textContent = basics ? 'Next: add yourself →' : 'Create trip & add the crew';
}

$('#new-trip-form').addEventListener('change', eventObject => {
  if (eventObject.target.name === 'occasion') applyOccasion(eventObject.target.value);
});
document.addEventListener('click', eventObject => {
  const card = eventObject.target.closest?.('[data-occasion]');
  if (card) pendingOccasion = card.dataset.occasion;
});

function renderHome() {
  const sample = product.trips[0];
  $('#sample-link').hidden = !sample;
  if (!sample) {
    $('#sample-preview').innerHTML = '<h2>Your next group trip starts here.</h2><p class="intro">Create a trip and add your friends to the plan.</p>';
    return;
  }
  const ideas = activitiesFor(sample.id).filter(activity => activity.status !== 'removed');
  $('#sample-link').href = '#trip/' + encodeURIComponent(sample.id);
  $('#sample-preview').innerHTML = `<p class="eyebrow">Sample trip · try it</p><h2>${escapeHtml(sample.title)}</h2><p class="quiet">${escapeHtml(sample.destination)} · ${dateRange(sample.start_date, sample.end_date)}</p>
    <div class="sample-meta"><div><span>Travelers</span><b>${travelersFor(sample.id).length} people</b></div><div><span>Budget per person</span><b>${escapeHtml(money(sample.budget_per_person, sample.currency))}</b></div></div>
    ${ideas.slice(0, 3).map(activity => `<div class="sample-activity"><span>${escapeHtml(activity.title)}</span><b>${escapeHtml(money(activity.estimated_cost_per_person, sample.currency))}</b></div>`).join('')}
    <a class="text-link" href="#trip/${encodeURIComponent(sample.id)}">Open the sample trip</a>`;
}

function responseFor(activityId, travelerId) {
  return product.responses.filter(response => response.activity_id === activityId && response.traveler_id === travelerId).at(-1);
}

// GroupAtion: booking status, owner and link on each activity; questions per activity and for the whole trip.
const BOOKING_STATES = [['idea', 'Idea'], ['agreed', 'Group agreed'], ['pending', 'Booking pending'], ['booked', 'Booked']];
const bookingName = value => (BOOKING_STATES.find(([key]) => key === value) || BOOKING_STATES[0])[1];
const safeUrl = value => /^https?:\/\//i.test(value || '') ? value : '';
const discussionsFor = (tripId, activityId) => (product.discussions || []).filter(item => item.trip_id === tripId && (activityId ? item.activity_id === activityId : !item.activity_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
const timeText = value => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

function renderBooking(activity, people) {
  const state = activity.booking_state || 'idea';
  const owner = people.find(person => person.id === activity.booking_owner_id);
  const url = safeUrl(activity.booking_url);
  return `<div class="booking-row"><span class="booking-badge booking-${escapeHtml(state)}">${escapeHtml(bookingName(state))}</span>
      <span class="booking-owner">${owner ? 'Booking: <b>' + escapeHtml(owner.name) + '</b>' : 'No one is booking this yet'}</span>
      ${url ? `<a class="booking-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : ''}</div>
    <details class="booking-edit"><summary>Update booking</summary>
      <form class="booking-form" data-activity-id="${escapeHtml(activity.id)}"><div class="booking-fields">
        <label>Status<select name="booking_state">${BOOKING_STATES.map(([key, name]) => `<option value="${key}" ${key === state ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
        <label>Who's booking it<select name="booking_owner_id"><option value="">No one yet</option>${people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === activity.booking_owner_id ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('')}</select></label>
        <label class="booking-url">Booking link (optional)<input name="booking_url" type="url" maxlength="500" placeholder="https://…" value="${escapeHtml(activity.booking_url || '')}"></label>
        <button class="secondary small" type="submit">Save booking</button></div>
        <p class="field-help">A link is just shared for reference. Set the status to Booked once it's actually booked.</p>
        <p class="form-error" role="alert"></p></form></details>`;
}

function renderThread(current, activityId, people, title) {
  const posts = discussionsFor(current.id, activityId);
  const person = people.find(item => item.id === selectedTravelers.get(current.id));
  const thread = posts.length ? posts.map(post => {
    const author = people.find(item => item.id === post.traveler_id);
    const name = author?.name || 'Former traveler';
    return `<div class="discussion-post">${avatar(author, 'discussion-photo')}<div><p class="discussion-meta"><b>${escapeHtml(name)}</b> · ${escapeHtml(timeText(post.created_at))}</p><p>${escapeHtml(post.body)}</p></div></div>`;
  }).join('') : '<p class="quiet">No questions yet. Ask the first one.</p>';
  return `<div class="discussion-thread">${title ? `<p class="discussion-context">About: <b>${escapeHtml(title)}</b></p>` : ''}${thread}
    <form class="discussion-form" data-activity-id="${escapeHtml(activityId || '')}"><fieldset ${person ? '' : 'disabled'}><legend class="sr-only">Post a question</legend>
      <label>${person ? 'Ask as ' + escapeHtml(person.name) : 'Add a traveler to ask a question'}<textarea name="body" required maxlength="1000" rows="2" placeholder="${activityId ? 'e.g. Does the price include tax and tip?' : 'e.g. Are we all flying in Friday morning?'}"></textarea></label>
      <button class="secondary small" type="submit">Post</button><p class="form-error" role="alert"></p></fieldset></form></div>`;
}

function renderActivity(activity, current, people) {
  const responses = people.map(person => ({ person, response: responseFor(activity.id, person.id) })).filter(item => item.response);
  const selected = selectedTravelers.get(current.id);
  const person = people.find(item => item.id === selected);
  const mine = responseFor(activity.id, selected);
  const totals = ['yes', 'maybe', 'no'].map(vote => responses.filter(item => item.response.vote === vote).length + ' ' + vote).join(' · ');
  const outsideDates = activity.date < current.start_date || activity.date > current.end_date;
  return `<article class="activity" data-kind="${escapeHtml(kindOf(activity))}" data-activity-id="${escapeHtml(activity.id)}">
    <div class="activity-heading"><h3>${escapeHtml(activity.title)}</h3><span class="activity-cost">${kindOf(activity) === 'offers' ? 'Price to confirm' : escapeHtml(money(activity.estimated_cost_per_person)) + ' / person'}</span></div>
    <div class="activity-meta"><span>${escapeHtml(activity.category)}</span><span class="status-badge ${activity.status === 'proposed' ? 'proposed' : ''}">${escapeHtml(statusName(activity.status))}</span><span class="vote-totals">${totals}</span></div>
    ${outsideDates ? '<p class="budget-message">This activity is outside the trip dates.</p>' : ''}
    <dl class="plan-details">${[['Provider',activity.provider],['Date & local time',activity.date + (activity.local_time ? ' · ' + activity.local_time + ' · ' + (activity.time_zone || 'Time zone not specified') : '')],['Arrival / check-out',activity.end_date ? activity.end_date + (activity.end_time ? ' · ' + activity.end_time : '') + (activity.end_time_zone ? ' · ' + activity.end_time_zone : '') : ''],['Meeting point / route',activity.location],['Shared quote',activity.quote_price ? activity.quote_currency + ' ' + activity.quote_price + ' · ' + (activity.price_basis || 'per person') + ' · unverified' : ''],['Who is joining',activity.participants],['Offer & eligibility',activity.offer_terms]].filter(([,v])=>v).map(([label,value])=>`<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    ${activity.details ? `<p class="plan-notes">${escapeHtml(activity.details)}</p>` : ''}
    ${renderBooking(activity, people)}
    <div class="activity-actions"><button class="text-button" data-action="edit-activity" data-id="${escapeHtml(activity.id)}">Edit activity</button>${activity.status !== 'accepted' ? `<button class="text-button" data-action="accept-activity" data-id="${escapeHtml(activity.id)}">Mark agreed</button>` : ''}<button class="text-button danger" data-action="remove-activity" data-id="${escapeHtml(activity.id)}">Remove</button></div>
    <form class="response-form" data-activity-id="${escapeHtml(activity.id)}"><fieldset ${person ? '' : 'disabled'}><legend>${person ? 'Your response as ' + escapeHtml(person.name) : 'Add a traveler to respond'}</legend>
      <div class="response-fields"><label>Vote<select name="vote" required><option value="" disabled ${mine ? '' : 'selected'}>Choose</option>${['yes', 'maybe', 'no'].map(vote => `<option value="${vote}" ${mine?.vote === vote ? 'selected' : ''}>${vote[0].toUpperCase() + vote.slice(1)}</option>`).join('')}</select></label>
      <label>Comment<input name="comment" value="${escapeHtml(mine?.comment || '')}" placeholder="An optional note" maxlength="500"></label><button class="secondary small" type="submit">Save response</button></div>
      <p class="form-error" role="alert"></p></fieldset></form>
    ${responses.length ? `<details class="group-responses"><summary>View ${responses.length} group ${responses.length === 1 ? 'response' : 'responses'}</summary>${responses.map(item => `<div class="group-response">${avatar(item.person)} <b>${escapeHtml(item.person.name)} · ${item.response.vote}</b>${item.response.comment ? `<p>${escapeHtml(item.response.comment)}</p>` : ''}</div>`).join('')}</details>` : ''}
    <details class="discussion" data-thread="${escapeHtml(activity.id)}" ${openThreads.has(activity.id) ? 'open' : ''}><summary>💬 Discuss (${discussionsFor(current.id, activity.id).length})</summary>${renderThread(current, activity.id, people, activity.title)}</details>
  </article>`;
}

function renderPerson(person, current) {
  const partial = person.available_from > current.start_date || person.available_to < current.end_date;
  return `<article class="person"><div class="person-heading"><h3>${avatar(person)}${escapeHtml(person.name)}</h3><span class="quiet">${escapeHtml(money(person.budget))}</span></div>
    <p>${dateRange(person.available_from, person.available_to)}</p>${partial ? '<p class="availability-warning">Availability differs from the trip dates.</p>' : ''}
    <p>${escapeHtml(person.interests.join(', ') || 'No interests added yet.')}</p><div class="person-actions"><button class="text-button" data-action="edit-traveler" data-id="${escapeHtml(person.id)}">Edit preferences</button><button class="text-button danger" data-action="remove-traveler" data-id="${escapeHtml(person.id)}">Remove</button></div></article>`;
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
  const cost = activities.filter(a => kindOf(a) !== 'offers').reduce((total, activity) => total + activity.estimated_cost_per_person, 0);
  const visibleActivities = plannerPanel === 'questions' ? activities : ['transport','stays','plans','offers'].includes(plannerPanel) ? activities.filter(a => kindOf(a) === plannerPanel) : activities.filter(a => kindOf(a) !== 'offers');
  const days = [...new Set(visibleActivities.map(activity => activity.date))];
  const mood = pandaMood(current, activities.filter(a => kindOf(a) !== 'offers'));
  const booked = activities.filter(a => kindOf(a) !== 'offers' && a.booking_state === 'booked').length;
  const budget = people.filter(p => cost > p.budget).map(p => p.name);
  const moodLabel = {starting:'So many ideas. Let’s make a plan.',planning:'Our trip is coming together!',relaxed:'Packed, shades on. Ready to go!',vacation:'Hello, '+current.destination+'!'}[mood];
  $('#planner-view').dataset.panel = plannerPanel;
  $('#planner-view').innerHTML = `<div class="planner-layout"><aside class="trip-sidebar"><p class="sidebar-label">YOUR GROUP GETAWAY</p><h2>Make room<br>for memories.</h2><nav aria-label="Trip sections">${[['itinerary','✦','Overview'],['transport','✈','Flights, trains & cars'],['stays','⌂','Places to stay'],['plans','♫','Food & activities'],['offers','%','Partner discounts'],['bookings','↗','Booking preview'],['questions','?','All questions'],['people','☺','The crew'],['discussion','☏','Group chat']].map(([key,icon,label]) => `<button type="button" data-planner-panel="${key}" aria-pressed="${plannerPanel === key}"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav><div class="sidebar-crew"><div class="crew-avatars">${people.slice(0,5).map(p => avatar(p)).join('')}</div><p>${people.length} friends, one great trip.</p><small>Fictional sample profile photos</small></div><div class="panda-progress"><label>Trip buddy<select class="panda-stage">${moodOptions(current.mascot_stage || 'auto')}</select></label><p>${escapeHtml(moodLabel)}</p><span class="profile-note">${booked} booked · ${activities.filter(a => kindOf(a) !== 'offers').length} shared plans</span></div><a href="#home">← Back to home</a></aside><div class="planner-content"><section class="escape-hero">
      <div class="escape-scene" aria-hidden="true"><span class="escape-sun"></span><div class="skyline"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="music-note">♪</span><span class="music-note second">♫</span></div>
      <div class="escape-copy"><div class="escape-label">✦ YOUR NEXT GREAT MEMORY</div><h1>${escapeHtml(current.title)}</h1><p class="escape-sub">Good times. Great company. One shared plan.</p><div class="escape-details"><span>↗ ${escapeHtml(current.destination)}</span><span>◷ ${dateRange(current.start_date, current.end_date)}</span></div><div class="crew-line"><div class="crew-avatars">${people.slice(0,5).map(p => avatar(p)).join('')}</div><strong>${people.length} trip mates. All the possibilities.</strong></div></div>
      <div class="escape-buddy"><div class="mascot-frame"><div class="panda-art" data-mood="${mood}" role="img" aria-label="Red panda: ${escapeHtml(moodLabel)}"></div>${mood === 'vacation' ? `<span class="destination-flag" aria-label="Destination flag">${countryFlags[current.country_code || 'other'] || '🌍'}</span>` : ''}</div><span class="buddy-sticker">${escapeHtml(moodLabel)}</span></div>
      <span class="postcard-stamp" aria-hidden="true">LET’S<br>GO PLACES ↗</span>
    </section>
    <div class="trip-ribbon"><span><b>THE VIBE</b> A getaway with your favourite people</span><label class="trip-selector">Your trips<select id="trip-select">${product.trips.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
    <div class="panda-mobile-control"><label>Trip buddy<select class="panda-stage">${moodOptions(current.mascot_stage || 'auto')}</select></label></div><div class="planner-toolbar"><span class="status-badge">${escapeHtml(statusName(current.status))}</span><div class="planner-actions"><button class="secondary small" data-action="edit-trip">Edit trip</button><button class="small" data-action="confirm-plan">${current.status === 'confirmed' ? 'Reopen planning' : 'Confirm plan'}</button></div></div>
    ${bookingPlaceholder(current)}
    <div class="planner-columns"><div class="itinerary"><div class="section-heading"><h2>${panelTitles[plannerPanel] || 'Shared plans'}</h2><button class="small" data-action="add-activity">+ Share a plan</button></div>
      <div class="itinerary-summary"><strong>${escapeHtml(money(cost))}</strong><span>estimated per person · shared travel plans</span><span>Trip budget: ${escapeHtml(money(current.budget_per_person))}</span></div>
      ${budget.length ? `<p class="budget-message">Above ${escapeHtml(budget.join(', '))}’s stated budget. Check preferences with the crew.</p>` : ''}
      ${cost > current.budget_per_person ? '<p class="budget-message">The shared travel plans exceed the trip budget per person.</p>' : ''}
      ${visibleActivities.length ? days.map(day => `<h3 class="day-heading">${dateText(day)}</h3>${visibleActivities.filter(activity => activity.date === day).map(activity => renderActivity(activity, current, people)).join('')}`).join('') : '<div class="empty-state"><h3>No plans in this section yet.</h3><p>Share a link, dates, prices and details for the group.</p><button data-action="add-activity">Share the first plan</button></div>'}
      ${partnerOffers()}
      ${removed.length ? `<details class="removed-list"><summary>Removed activities (${removed.length})</summary>${removed.map(activity => `<div class="removed-row"><span>${escapeHtml(activity.title)}</span><button class="text-button" data-action="restore-activity" data-id="${escapeHtml(activity.id)}">Restore</button></div>`).join('')}</details>` : ''}
      <section class="general-discussion"><div class="section-heading"><h2>💬 General trip discussion</h2><span class="quiet">${discussionsFor(current.id).length} posts</span></div>
        <p class="quiet">Questions about the whole trip. Questions about one plan go in that plan's Discuss thread.</p>${renderThread(current, '', people)}</section>
    </div><aside class="people-panel"><div class="section-heading"><h2>Travelers</h2><button class="text-button" data-action="add-traveler">Add traveler</button></div>
      ${people.length ? `<label class="viewing-as">Viewing as<select id="traveler-select">${people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === selectedTravelers.get(current.id) ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('')}</select><span class="field-help">Take turns as different travelers on this screen.</span></label>${people.map(person => renderPerson(person, current)).join('')}` : '<div class="empty-state"><p>Add the people who are going on this trip.</p><button data-action="add-traveler">Add a traveler</button></div>'}
    </aside></div></div></div>`;
}

function render() {
  if (!product) return;
  const currentRoute = route();
  const known = ['home', 'new', 'trip'].includes(currentRoute.view) ? currentRoute.view : 'home';
  document.body.classList.toggle('design-prototype', known === 'trip');
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
    const values = { ...readTripForm(form), country_code: form.elements.namedItem('country_code').value };
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
    if (values.end_date) checkDates(values.date, values.end_date, 'Travel dates');
    for (const zone of [values.time_zone, values.end_time_zone].filter(Boolean)) { try { new Intl.DateTimeFormat('en', {timeZone:zone}); } catch { throw new Error('Use a valid time zone, such as America/Toronto or Europe/Lisbon.'); } }
    if (values.booking_url && !safeUrl(values.booking_url)) throw new Error('Use an http or https provider link.');
    const activity = { ...values, id: values.id || 'activity-' + crypto.randomUUID(), trip_id: current.id, title: values.title.trim(), category: values.category.trim(), estimated_cost_per_person: Number(values.estimated_cost_per_person) };
    if (!activity.booking_url) delete activity.booking_url;
    if (!activity.booking_owner_id) delete activity.booking_owner_id;
    await saveChange(next => {
      const old = next.activities.find(item => item.id === activity.id);
      if (old && !values.booking_url) delete old.booking_url;
      if (old && !values.booking_owner_id) delete old.booking_owner_id;
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

document.addEventListener('submit', eventObject => {
  const form = eventObject.target;
  if (!form.matches('.booking-form')) return;
  eventObject.preventDefault();
  submitForm(form, async () => {
    const current = trip();
    const activityId = form.dataset.activityId;
    const values = Object.fromEntries(new FormData(form));
    const url = values.booking_url.trim();
    if (url && !safeUrl(url)) throw new Error('Use a link that starts with http:// or https://');
    await saveChange(next => {
      const activity = next.activities.find(item => item.id === activityId);
      activity.booking_state = values.booking_state;
      if (values.booking_owner_id) activity.booking_owner_id = values.booking_owner_id; else delete activity.booking_owner_id;
      if (url) activity.booking_url = url; else delete activity.booking_url;
    }, event('booking_updated', { trip_id: current.id, activity_id: activityId, booking_state: values.booking_state }));
  });
});

document.addEventListener('submit', eventObject => {
  const form = eventObject.target;
  if (!form.matches('.discussion-form')) return;
  eventObject.preventDefault();
  submitForm(form, async () => {
    const current = trip();
    const travelerId = selectedTravelers.get(current.id);
    if (!travelerId) throw new Error('Add a traveler first.');
    const body = new FormData(form).get('body').trim();
    if (!body) throw new Error('Write a question or comment first.');
    const activityId = form.dataset.activityId;
    const post = { id: 'discussion-' + crypto.randomUUID(), trip_id: current.id, traveler_id: travelerId, body, created_at: new Date().toISOString() };
    if (activityId) post.activity_id = activityId;
    if (activityId) openThreads.add(activityId);
    await saveChange(next => {
      next.discussions ||= [];
      next.discussions.push(post);
    }, event('question_posted', { trip_id: current.id, activity_id: activityId || 'general' }, travelerId));
  });
});

document.addEventListener('toggle', eventObject => {
  const thread = eventObject.target.closest?.('details[data-thread]');
  if (!thread || eventObject.target !== thread) return;
  if (thread.open) openThreads.add(thread.dataset.thread); else openThreads.delete(thread.dataset.thread);
}, true);

document.addEventListener('change', eventObject => {
  if (eventObject.target.matches('.panda-stage')) {
    const value = eventObject.target.value;
    saveChange(next => { next.trips.find(t => t.id === trip().id).mascot_stage = value; }, event('mascot_stage_changed', {trip_id:trip().id,stage:value})).catch(error => notice(error.message,true));
  }
  if (eventObject.target.id === 'trip-select') location.hash = '#trip/' + encodeURIComponent(eventObject.target.value);
  if (eventObject.target.id === 'traveler-select') { selectedTravelers.set(trip().id, eventObject.target.value); renderPlanner(); setBusy(busy); }
});

async function handleAction(button) {
  const { action, id } = button.dataset;
  const current = trip();
  if (action === 'edit-trip') return openEditor('trip');
  if (action === 'add-traveler' || action === 'edit-traveler') return openEditor('traveler', id);
  if (action === 'add-activity' || action === 'edit-activity') { openEditor('activity', id); if (button.dataset.kind) $('#activity-form').elements.namedItem('plan_kind').value = button.dataset.kind; return; }
  if (action === 'remove-traveler') {
    return saveChange(next => {
      next.travelers = next.travelers.filter(person => person.id !== id);
      next.responses = next.responses.filter(response => response.traveler_id !== id);
      next.activities.forEach(activity => { if (activity.booking_owner_id === id) delete activity.booking_owner_id; });
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

document.addEventListener('click', eventObject => {
 const button = eventObject.target.closest?.('[data-offer-title]');
 if (!button) return;
 openEditor('activity');
 const form = $('#activity-form');
 form.elements.namedItem('title').value = button.dataset.offerTitle;
 form.elements.namedItem('plan_kind').value = 'offers';
 form.elements.namedItem('category').value = 'Partner offer';
 form.elements.namedItem('offer_terms').value = button.dataset.offerRate + ' illustrative discount. ' + button.dataset.offerTerms + '. Provider confirmation required.';
 form.elements.namedItem('details').value = 'MVP example only. No partnership or discount has been confirmed.';
});
