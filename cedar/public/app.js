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
let undoRemoval;

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
  if (undoRemoval && !isError && trip()?.id === undoRemoval.tripId) {
    const button = document.createElement('button');
    button.className = 'text-button';
    button.dataset.action = 'undo-removal';
    button.textContent = 'Undo removal';
    element.append(' ', button);
  }
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
    values = product.activities.find(activity => activity.id === id) || { id: '', title: '', date: current.start_date, category: '', time: '', estimated_cost_per_person: 0, status: 'proposed' };
    $('#activity-dialog-heading').textContent = id ? 'Edit activity' : 'Add an activity';
    $('#activity-submit').textContent = id ? 'Save changes' : 'Add to itinerary';
    $('#activity-details').open = Boolean(id && (values.time || values.estimated_cost_per_person || values.status !== 'proposed'));
    const categories = form.elements.namedItem('category');
    categories.querySelectorAll('[data-custom-category]').forEach(option => option.remove());
    if (values.category && !Array.from(categories.options).some(option => option.value === values.category)) {
      const option = new Option(values.category, values.category);
      option.dataset.customCategory = 'true';
      categories.add(option);
    }
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
  $('#onboarding-heading').textContent = basics ? 'Set the starting point for your weekend.' : 'Add your preferences, then your group\'s.';
  $('#onboarding-intro').textContent = basics ? 'Choose a destination, dates, and a target budget per person. It is a starting point for the group, and you can change it anytime.' : 'Start with when you can go, what you can spend, and what you enjoy. Next, you will add each friend\'s preferences and put activities to a vote until everyone agrees.';
  $('#onboarding-submit').textContent = basics ? 'Continue' : 'Create trip';
}

function renderHome() {
  const sample = product.trips[0];
  $('#sample-link').hidden = !sample;
  if (!sample) {
    $('#sample-preview').innerHTML = '<h2>Your next weekend starts here.</h2><p class="intro">Create a trip and invite your group into the plan.</p>';
    return;
  }
  const ideas = activitiesFor(sample.id).filter(activity => activity.status !== 'removed');
  $('#sample-link').href = '#trip/' + encodeURIComponent(sample.id);
  $('#sample-preview').innerHTML = `<p class="eyebrow">A sample to try</p><h2>${escapeHtml(sample.title)}</h2><p class="quiet">${escapeHtml(sample.destination)} · ${dateRange(sample.start_date, sample.end_date)}</p>
    <div class="sample-meta"><div><span>Travelers</span><b>${travelersFor(sample.id).length} people</b></div><div><span>Budget per person</span><b>${escapeHtml(money(sample.budget_per_person, sample.currency))}</b></div></div>
    ${ideas.slice(0, 3).map(activity => `<div class="sample-activity"><span>${escapeHtml(activity.title)}</span><b>${escapeHtml(money(activity.estimated_cost_per_person, sample.currency))}</b></div>`).join('')}
    <a class="text-link" href="#trip/${encodeURIComponent(sample.id)}">Open this trip</a>`;
}

function responseFor(activityId, travelerId) {
  return product.responses.filter(response => response.activity_id === activityId && response.traveler_id === travelerId).at(-1);
}

const initials = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const categoryIcon = category => {
  const name = category.toLowerCase();
  return /food|drink/.test(name) ? '☕' : /outdoor|nature/.test(name) ? '♧' : /music|night/.test(name) ? '♫' : /wellness|relax/.test(name) ? '☀' : /water/.test(name) ? '≈' : /art|culture/.test(name) ? '▧' : /sport|adventure/.test(name) ? '↗' : /game|entertain/.test(name) ? '♟' : /shop|market/.test(name) ? '▱' : /workshop|class/.test(name) ? '✎' : '⌖';
};

function renderAvatars(people, activityId) {
  return `<div class="avatar-stack">${people.map(person => {
    const vote = activityId ? responseFor(activityId, person.id)?.vote : undefined;
    const label = person.name + (activityId ? ': ' + (vote || 'No response') : '');
    return `<span class="avatar ${vote || ''}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(initials(person.name))}${activityId ? `<span class="vote-mark" aria-hidden="true">${({yes: '✓', no: '×', maybe: '?'})[vote] || '·'}</span>` : ''}</span>`;
  }).join('')}</div>`;
}

function renderActivity(activity, current, people) {
  const responses = people.map(person => ({ person, response: responseFor(activity.id, person.id) })).filter(item => item.response);
  const selected = selectedTravelers.get(current.id);
  const person = people.find(item => item.id === selected);
  const mine = responseFor(activity.id, selected);
  const totals = ['yes', 'maybe', 'no'].map(vote => responses.filter(item => item.response.vote === vote).length + ' ' + vote).join(' · ');
  const waiting = people.length - responses.length;
  const allYes = people.length > 0 && responses.length === people.length && responses.every(item => item.response.vote === 'yes');
  const agreement = allYes ? 'Everyone’s in' : waiting ? `Waiting for ${waiting} ${waiting === 1 ? 'person' : 'people'}` : people.length ? 'Everyone responded · review the votes' : 'Add travelers to decide together';
  const outsideDates = activity.date < current.start_date || activity.date > current.end_date;
  return `<article class="activity" data-activity-id="${escapeHtml(activity.id)}">
    <div class="activity-heading"><div class="activity-title"><span class="category-icon" aria-hidden="true">${categoryIcon(activity.category)}</span><div><span class="activity-time">${activity.time ? escapeHtml(activity.time) : 'Time is flexible'}</span><h3>${escapeHtml(activity.title)}</h3></div></div><span class="activity-cost">${escapeHtml(money(activity.estimated_cost_per_person))}<small>per person</small></span></div>
    <div class="activity-meta"><span>${escapeHtml(activity.category)}</span><span class="status-badge ${activity.status === 'proposed' ? 'proposed' : ''}">${escapeHtml(statusName(activity.status))}</span><span class="vote-totals">${totals}</span></div>
    <div class="agreement ${allYes ? 'unanimous' : ''}">${renderAvatars(people, activity.id)}<span>${agreement}</span></div>
    ${outsideDates ? '<p class="budget-message">This activity is outside the trip dates.</p>' : ''}
    <div class="activity-actions"><button class="text-button" data-action="edit-activity" data-id="${escapeHtml(activity.id)}">Edit activity</button>${activity.status !== 'accepted' ? `<button class="text-button" data-action="accept-activity" data-id="${escapeHtml(activity.id)}">Mark agreed</button>` : ''}<button class="text-button danger" data-action="remove-activity" data-id="${escapeHtml(activity.id)}">Remove</button></div>
    <form class="response-form" data-activity-id="${escapeHtml(activity.id)}"><fieldset ${person ? '' : 'disabled'}><legend>${person ? 'Your response as ' + escapeHtml(person.name) : 'Add a traveler to respond'}</legend>
      <div class="response-fields"><label>Vote<select name="vote" required><option value="" disabled ${mine ? '' : 'selected'}>Choose</option>${['yes', 'maybe', 'no'].map(vote => `<option value="${vote}" ${mine?.vote === vote ? 'selected' : ''}>${vote[0].toUpperCase() + vote.slice(1)}</option>`).join('')}</select></label>
      <label>Comment<input name="comment" value="${escapeHtml(mine?.comment || '')}" placeholder="An optional note" maxlength="500"></label><button class="secondary small" type="submit">Save response</button></div>
      <p class="form-error" role="alert"></p></fieldset></form>
    ${responses.length ? `<details class="group-responses"><summary>View ${responses.length} group ${responses.length === 1 ? 'response' : 'responses'}</summary>${responses.map(item => `<div class="group-response"><b>${escapeHtml(item.person.name)} · ${item.response.vote}</b>${item.response.comment ? `<p>${escapeHtml(item.response.comment)}</p>` : ''}</div>`).join('')}</details>` : ''}
  </article>`;
}

function renderPerson(person, current) {
  const partial = person.available_from > current.start_date || person.available_to < current.end_date;
  const activities = activitiesFor(current.id).filter(activity => activity.status !== 'removed');
  const responded = activities.filter(activity => responseFor(activity.id, person.id)).length;
  return `<article class="person"><div class="person-heading"><h3><span class="avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</span> ${escapeHtml(person.name)}</h3><span class="quiet">${escapeHtml(money(person.budget))}</span></div>
    <p class="traveler-status">${activities.length ? `${responded} of ${activities.length} activities reviewed` : 'Ready for the first idea'} · ${partial ? 'Check dates' : 'Available for the trip'}</p>
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
  const activities = activitiesFor(current.id).filter(activity => activity.status !== 'removed').sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99'));
  const removed = activitiesFor(current.id).filter(activity => activity.status === 'removed');
  const cost = activities.reduce((total, activity) => total + activity.estimated_cost_per_person, 0);
  const days = [...new Set(activities.map(activity => activity.date))];
  const unanimous = activities.filter(activity => people.length && people.every(person => responseFor(activity.id, person.id)?.vote === 'yes')).length;
  const agreementPercent = activities.length ? Math.round(unanimous / activities.length * 100) : 0;
  const budgetPercent = current.budget_per_person > 0 ? Math.min(100, cost / current.budget_per_person * 100) : cost > 0 ? 100 : 0;
  const nextAction = !people.length ? 'Add your people' : !activities.length ? 'Add your first activity' : unanimous < activities.length ? 'Review the group’s responses' : current.status === 'confirmed' ? 'Your plan is ready' : 'Confirm your weekend';
  $('#planner-view').innerHTML = `<div class="trip-cover"><span>Good company.<br>Great weekends.</span><small>Weekend inspiration</small></div><div class="planner-top"><div><p class="eyebrow">Your shared weekend</p><h1>${escapeHtml(current.title)}</h1><div class="trip-chips"><span>⌖ ${escapeHtml(current.destination)}</span><span>▦ ${dateRange(current.start_date, current.end_date)}</span><span>${people.length} ${people.length === 1 ? 'traveler' : 'travelers'}</span></div></div>
    <label class="trip-selector">Your trips<select id="trip-select">${product.trips.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
    <div class="planner-toolbar"><span class="status-badge">${escapeHtml(statusName(current.status))}</span><div class="planner-actions"><button class="secondary small" data-action="edit-trip">Edit trip</button><button class="small" data-action="confirm-plan">${current.status === 'confirmed' ? 'Reopen planning' : 'Confirm plan'}</button></div></div>
    <div class="trip-dashboard"><section class="overview-card"><p class="eyebrow">Group agreement</p><div class="metric"><strong>${agreementPercent}%</strong><span>${unanimous} of ${activities.length} activities have everyone’s yes</span></div><div class="meter" role="progressbar" aria-label="Activities everyone voted yes on" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${agreementPercent}"><span style="width:${agreementPercent}%"></span></div><div class="agreement">${renderAvatars(people)}<span>${people.length ? 'A plan for everyone' : 'Add travelers to start voting'}</span></div></section>
    <section class="overview-card ${cost > current.budget_per_person ? 'over-budget' : ''}"><p class="eyebrow">Budget per person</p><div class="metric"><strong>${escapeHtml(money(cost))}</strong><span>of ${escapeHtml(money(current.budget_per_person))} planned</span></div><div class="meter" role="progressbar" aria-label="Activity budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(budgetPercent)}" aria-valuetext="${escapeHtml(money(cost))} of ${escapeHtml(money(current.budget_per_person))}"><span style="width:${budgetPercent}%"></span></div><p class="field-help">${escapeHtml(money(Math.abs(current.budget_per_person - cost)))} ${cost > current.budget_per_person ? 'over budget' : 'left to plan'} · Activities only</p></section>
    <section class="overview-card next-step"><p class="eyebrow">Up next</p><h2>${nextAction}</h2><p>${!activities.length ? 'One idea is all it takes to get going.' : 'Use the itinerary below to keep everyone involved.'}</p><button class="small" data-action="${!people.length ? 'add-traveler' : !activities.length ? 'add-activity' : unanimous === activities.length ? 'confirm-plan' : 'review-responses'}">${!people.length ? 'Add traveler' : !activities.length ? 'Add an activity' : unanimous === activities.length ? current.status === 'confirmed' ? 'Reopen planning' : 'Confirm plan' : 'Review itinerary'} <span aria-hidden="true">↗</span></button></section></div>
    <div class="planner-columns"><div class="itinerary"><div class="section-heading"><h2>Shared itinerary</h2><button class="small" data-action="add-activity">Add activity</button></div>
      <p class="itinerary-note">A little adventure. A little downtime. Make room for both.</p>
      ${cost > current.budget_per_person ? '<p class="budget-message">The activities exceed the trip budget per person.</p>' : ''}
      ${activities.length ? days.map(day => `<section class="itinerary-day" aria-label="${day}"><h3 class="day-heading"><span>${new Intl.DateTimeFormat('en-CA', {weekday: 'long', timeZone: 'UTC'}).format(new Date(day + 'T12:00:00Z'))}</span>${dateText(day)}</h3>${activities.filter(activity => activity.date === day).map(activity => renderActivity(activity, current, people)).join('')}</section>`).join('') : '<div class="empty-state weekend-empty"><span class="empty-icon" aria-hidden="true">☀</span><p class="eyebrow">The best weekends start with an idea</p><h3>What should we do first?</h3><p>Pick a starting point. Your people can help shape the rest.</p><div class="idea-shortcuts"><button class="secondary" data-action="suggest-activity" data-category="Food &amp; drink">☕ Add a meal</button><button class="secondary" data-action="suggest-activity" data-category="Outdoors &amp; nature">♧ Plan something outdoors</button><button class="secondary" data-action="suggest-activity" data-category="Wellness &amp; relaxation">☀ Leave time to relax</button></div></div>'}
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

$('#activity-form').addEventListener('invalid', eventObject => {
  if (eventObject.target.closest('#activity-details')) $('#activity-details').open = true;
}, true);

$('#activity-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const values = Object.fromEntries(new FormData(form));
    const current = trip();
    const activity = { ...values, id: values.id || 'activity-' + crypto.randomUUID(), trip_id: current.id, title: values.title.trim(), category: values.category.trim(), estimated_cost_per_person: Number(values.estimated_cost_per_person) };
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
  if (action === 'review-responses') {
    const target = $('.response-form select', $('#planner-view'));
    if (target) { target.scrollIntoView({block: 'center'}); target.focus({preventScroll: true}); }
    return;
  }
  if (action === 'suggest-activity') {
    openEditor('activity');
    $('#activity-form').elements.namedItem('category').value = button.dataset.category;
    $('#activity-form').elements.namedItem('title').focus();
    return;
  }
  if (action === 'undo-removal' && undoRemoval?.tripId === current.id) {
    const removed = undoRemoval;
    await saveChange(next => { next.activities.find(activity => activity.id === removed.id).status = removed.status; }, event('plan_updated', {trip_id: current.id, activity_id: removed.id, status: removed.status}));
    undoRemoval = undefined;
    notice('Activity restored.');
    return;
  }
  if (action === 'edit-trip') return openEditor('trip');
  if (action === 'add-traveler' || action === 'edit-traveler') return openEditor('traveler', id);
  if (action === 'add-activity' || action === 'edit-activity') return openEditor('activity', id);
  if (action === 'remove-traveler') {
    return saveChange(next => {
      next.travelers = next.travelers.filter(person => person.id !== id);
      next.responses = next.responses.filter(response => response.traveler_id !== id);
    }, event('traveler_removed', { trip_id: current.id, traveler_id: id }));
  }
  if (['accept-activity', 'remove-activity', 'restore-activity'].includes(action)) {
    const status = { 'accept-activity': 'accepted', 'remove-activity': 'removed', 'restore-activity': 'proposed' }[action];
    const previousStatus = product.activities.find(activity => activity.id === id).status;
    await saveChange(next => { next.activities.find(activity => activity.id === id).status = status; }, event('plan_updated', { trip_id: current.id, activity_id: id, status }));
    if (action === 'remove-activity') { undoRemoval = {id, tripId: current.id, status: previousStatus}; notice('Activity removed.'); }
    if (action === 'restore-activity' && undoRemoval?.id === id) { undoRemoval = undefined; notice('Activity restored.'); }
    return;
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
