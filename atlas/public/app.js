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
let calendarView = 'month';
let calendarDate = todayDate();
let calendarTripId = '';
let calendarDisplay = 'calendar';
let calendarEventQuery = '';
let expenseTripId = '';
let settlementTripId = '';

function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
const utcDate = value => new Date(value + 'T00:00:00Z');
const dateKey = value => value.toISOString().slice(0, 10);
const addDays = (value, amount) => { const date = utcDate(value); date.setUTCDate(date.getUTCDate() + amount); return dateKey(date); };
const startOfWeek = value => addDays(value, -utcDate(value).getUTCDay());
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

function equalSplitValues(people, amount, mode) {
  const total = mode === 'amount' ? Math.max(0, cents(amount)) : 10000;
  const base = Math.floor(total / people.length);
  let remainder = total - base * people.length;
  return new Map(people.map(person => {
    const share = base + (remainder-- > 0 ? 1 : 0);
    return [person.id, mode === 'amount' ? fromCents(share).toFixed(2) : (share / 100).toFixed(2)];
  }));
}

function renderExpenseSplitInputs(tripId, mode, amount, expense, overrides) {
  const people = travelersFor(tripId);
  let values = overrides;
  if (!values && expense) {
    const included = expense.splits.map(split => ({ traveler_id: split.traveler_id, share: split.share }));
    if (expense.split_mode === mode) values = new Map(included.map(split => [split.traveler_id, split.share.toFixed(2)]));
    else if (mode === 'amount') {
      const allocations = percentageAllocations(cents(amount), included);
      values = new Map(included.map(split => [split.traveler_id, fromCents(allocations.get(split.traveler_id) || 0).toFixed(2)]));
    } else {
      const total = included.reduce((sum, split) => sum + cents(split.amount), 0);
      if (total > 0) {
        let pointsLeft = 10000;
        values = new Map(included.map((split, index) => {
          const points = index === included.length - 1 ? pointsLeft : Math.round(cents(split.amount) / total * 10000);
          pointsLeft -= points;
          return [split.traveler_id, (points / 100).toFixed(2)];
        }));
      } else values = equalSplitValues(included.map(split => ({ id: split.traveler_id })), amount, 'percentage');
    }
  }
  if (!values) values = equalSplitValues(people, amount, mode);
  const selectedIds = new Set(values.keys());
  $('#expense-split-fields').innerHTML = people.map(person => `<div class="expense-split-row">
    <label class="split-person"><input type="checkbox" data-split-included ${selectedIds.has(person.id) ? 'checked' : ''}><span>${escapeHtml(person.name)}</span></label>
    <label class="split-value"><span class="sr-only">${mode === 'percentage' ? 'Share percentage' : 'Share amount'} for ${escapeHtml(person.name)}</span><input type="number" min="0" step="0.01" value="${escapeHtml(values.get(person.id) ?? '0.00')}" data-split-value data-traveler-id="${escapeHtml(person.id)}" aria-label="${mode === 'percentage' ? 'Percent owed by ' + escapeHtml(person.name) : 'Amount owed by ' + escapeHtml(person.name)}"></label>
  </div>`).join('');
  $('#expense-split-mode').dataset.mode = mode;
  $('#split-unit').textContent = mode === 'percentage' ? 'Percent of total' : 'Amount';
}

function convertSplitMode(form, nextMode) {
  const fieldset = $('#expense-split-mode');
  const previousMode = fieldset.dataset.mode;
  const amount = Number(form.elements.namedItem('amount').value) || 0;
  const rows = [...$('#expense-split-fields').querySelectorAll('.expense-split-row')];
  const selected = rows.filter(row => $('[data-split-included]', row).checked).map(row => ({
    traveler_id: $('[data-split-value]', row).dataset.travelerId,
    share: Number($('[data-split-value]', row).value) || 0
  }));
  let values;
  if (nextMode === 'amount') {
    const allocations = previousMode === 'percentage' ? percentageAllocations(cents(amount), selected) : new Map(selected.map(item => [item.traveler_id, cents(item.share)]));
    values = new Map(selected.map(item => [item.traveler_id, fromCents(allocations.get(item.traveler_id) || 0).toFixed(2)]));
  } else {
    const amounts = previousMode === 'percentage' ? percentageAllocations(cents(amount), selected) : new Map(selected.map(item => [item.traveler_id, cents(item.share)]));
    const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
    let pointsLeft = 10000;
    values = new Map(selected.map((item, index) => {
      const points = index === selected.length - 1 ? pointsLeft : total ? Math.round((amounts.get(item.traveler_id) || 0) / total * 10000) : Math.floor(10000 / selected.length);
      pointsLeft -= points;
      return [item.traveler_id, (points / 100).toFixed(2)];
    }));
  }
  renderExpenseSplitInputs(expenseTripId, nextMode, amount, null, values);
}

function readExpenseForm(form, current, expenseId) {
  const values = Object.fromEntries(new FormData(form));
  const amountCents = cents(values.amount);
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error('Enter an expense amount greater than zero.');
  const mode = values.split_mode;
  const rows = [...$('#expense-split-fields').querySelectorAll('.expense-split-row')];
  const entries = rows.filter(row => $('[data-split-included]', row).checked).map(row => {
    const input = $('[data-split-value]', row);
    const raw = input.value;
    const share = Number(raw);
    if (raw === '' || !Number.isFinite(share) || share < 0) throw new Error('Enter a valid non-negative share for each selected traveler.');
    return { traveler_id: input.dataset.travelerId, share };
  });
  if (!entries.length) throw new Error('Select at least one traveler to share this expense.');
  let splits;
  if (mode === 'percentage') {
    const totalPoints = entries.reduce((sum, item) => sum + Math.round(item.share * 100), 0);
    if (totalPoints !== 10000) throw new Error('Percentage shares must add up to exactly 100%.');
    const allocations = percentageAllocations(amountCents, entries);
    splits = entries.map(item => ({ traveler_id: item.traveler_id, share: Math.round(item.share * 100) / 100, amount: fromCents(allocations.get(item.traveler_id) || 0) }));
  } else {
    const total = entries.reduce((sum, item) => sum + cents(item.share), 0);
    if (total !== amountCents) throw new Error('Amount shares must add up to the full expense total.');
    splits = entries.map(item => {
      const shareCents = cents(item.share);
      return { traveler_id: item.traveler_id, share: fromCents(shareCents), amount: fromCents(shareCents) };
    });
  }
  const payer = travelersFor(current.id).find(person => person.id === values.paid_by_traveler_id);
  if (!payer) throw new Error('Choose a payer from this trip.');
  return {
    id: expenseId || 'expense-' + crypto.randomUUID(),
    trip_id: current.id,
    title: values.title.trim(),
    date: values.date,
    category: values.category.trim(),
    amount: fromCents(amountCents),
    paid_by_traveler_id: payer.id,
    split_mode: mode,
    splits
  };
}

function openExpenseEditor(id) {
  const current = trip();
  if (!current) return;
  expenseTripId = current.id;
  const expense = product.expenses.find(item => item.id === id);
  const form = $('#expense-form');
  fillForm(form, expense || {
    id: '',
    title: '',
    date: todayDate(),
    category: 'Other',
    amount: '',
    paid_by_traveler_id: travelersFor(current.id)[0]?.id || '',
    split_mode: 'percentage'
  });
  $('#expense-dialog-heading').textContent = expense ? 'Edit expense' : 'Add an expense';
  $('#expense-payer').innerHTML = travelersFor(current.id).map(person => `<option value="${escapeHtml(person.id)}" ${person.id === (expense?.paid_by_traveler_id || travelersFor(current.id)[0]?.id) ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('');
  renderExpenseSplitInputs(current.id, expense?.split_mode || 'percentage', expense?.amount || 0, expense);
  $('#expense-dialog').showModal();
}

function openSettlementEditor(fromId, toId, amount) {
  const current = trip();
  if (!current) return;
  settlementTripId = current.id;
  const people = travelersFor(current.id);
  fillForm($('#settlement-form'), { date: todayDate(), amount: fromCents(amount), note: '' });
  $('#settlement-from').innerHTML = people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === fromId ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('');
  $('#settlement-to').innerHTML = people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === toId ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('');
  $('#settlement-dialog').showModal();
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
    values = product.activities.find(activity => activity.id === id) || { id: '', title: '', date: current.start_date, start_time: '', end_time: '', category: '', estimated_cost_per_person: 0, status: 'proposed' };
    $('#activity-dialog-heading').textContent = id ? 'Edit activity' : 'Add an activity';
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
  $('#onboarding-heading').textContent = basics ? 'Give your weekend a starting point.' : 'Add your preferences.';
  $('#onboarding-intro').textContent = basics ? 'Choose a destination, dates, and a budget. You can change these later.' : 'Tell the group when you can go and what you enjoy. Add the other travelers next.';
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
  return `<article class="person"><div class="person-heading"><h3>${escapeHtml(person.name)}</h3><span class="quiet">${escapeHtml(money(person.budget))}</span></div>
    <p>${dateRange(person.available_from, person.available_to)}</p>${partial ? '<p class="availability-warning">Availability differs from the trip dates.</p>' : ''}
    <p>${escapeHtml(person.interests.join(', ') || 'No interests added yet.')}</p><div class="person-actions"><button class="text-button" data-action="edit-traveler" data-id="${escapeHtml(person.id)}">Edit preferences</button><button class="text-button danger" data-action="remove-traveler" data-id="${escapeHtml(person.id)}">Remove</button></div></article>`;
}

const cents = value => Math.round(Number(value) * 100);
const fromCents = value => value / 100;

function percentageAllocations(totalCents, entries) {
  const totalPoints = entries.reduce((sum, entry) => sum + Math.max(0, Math.round(Number(entry.share) * 100)), 0);
  const allocations = entries.map(entry => {
    const points = totalPoints ? Math.max(0, Math.round(Number(entry.share) * 100)) / totalPoints : 1 / entries.length;
    const raw = totalCents * points;
    return { id: entry.traveler_id, amount: Math.floor(raw), remainder: raw % 1 };
  });
  let centsLeft = totalCents - allocations.reduce((sum, item) => sum + item.amount, 0);
  [...allocations].sort((a, b) => b.remainder - a.remainder).slice(0, centsLeft).forEach(item => { item.amount += 1; });
  return new Map(allocations.map(item => [item.id, item.amount]));
}

function expenseBalances(tripId) {
  const balances = new Map(travelersFor(tripId).map(person => [person.id, 0]));
  for (const expense of product.expenses.filter(item => item.trip_id === tripId)) {
    balances.set(expense.paid_by_traveler_id, (balances.get(expense.paid_by_traveler_id) || 0) + cents(expense.amount));
    for (const split of expense.splits) balances.set(split.traveler_id, (balances.get(split.traveler_id) || 0) - cents(split.amount));
  }
  for (const settlement of product.settlements.filter(item => item.trip_id === tripId)) {
    balances.set(settlement.from_traveler_id, (balances.get(settlement.from_traveler_id) || 0) - cents(settlement.amount));
    balances.set(settlement.to_traveler_id, (balances.get(settlement.to_traveler_id) || 0) + cents(settlement.amount));
  }
  return balances;
}

function paymentSuggestions(tripId, people) {
  const balances = expenseBalances(tripId);
  const debtors = people.map(person => ({ person, amount: -(balances.get(person.id) || 0) })).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const creditors = people.map(person => ({ person, amount: balances.get(person.id) || 0 })).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const suggestions = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);
    suggestions.push({ from: debtor.person, to: creditor.person, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (!debtor.amount) debtorIndex += 1;
    if (!creditor.amount) creditorIndex += 1;
  }
  return { balances, suggestions };
}

function renderExpenseSection(current, people) {
  const expenses = product.expenses.filter(item => item.trip_id === current.id).sort((a, b) => b.date.localeCompare(a.date));
  const settlements = product.settlements.filter(item => item.trip_id === current.id).sort((a, b) => b.date.localeCompare(a.date));
  const total = expenses.reduce((sum, item) => sum + cents(item.amount), 0);
  const { balances, suggestions } = paymentSuggestions(current.id, people);
  const personName = id => people.find(person => person.id === id)?.name || 'Unknown traveler';
  return `<section class="expense-section" aria-labelledby="expense-heading"><div class="section-heading expense-section-heading"><div><p class="eyebrow">Keep the costs fair</p><h2 id="expense-heading">Expenses &amp; balances</h2></div>
      ${people.length ? '<button class="small" data-action="add-expense">Add expense</button>' : ''}</div>
    ${people.length ? `<div class="expense-overview"><div><span>Total recorded</span><strong>${escapeHtml(money(fromCents(total), current.currency))}</strong></div><div><span>Expenses</span><strong>${expenses.length}</strong></div><div><span>Payments recorded</span><strong>${settlements.length}</strong></div></div>
      <div class="expense-columns"><section class="expense-balances"><div class="section-heading"><h3>Who owes what</h3></div>
        <div class="balance-list">${people.map(person => {
          const balance = balances.get(person.id) || 0;
          return `<div class="balance-row"><span>${escapeHtml(person.name)}</span><strong class="${balance < 0 ? 'owes' : balance > 0 ? 'owed' : ''}">${balance < 0 ? 'Owes ' : balance > 0 ? 'Is owed ' : 'Settled'}${balance ? escapeHtml(money(fromCents(Math.abs(balance)), current.currency)) : ''}</strong></div>`;
        }).join('')}</div>
        ${suggestions.length ? `<div class="suggested-payments"><h4>Suggested payments</h4>${suggestions.map(item => `<div class="suggestion-row"><span><b>${escapeHtml(item.from.name)}</b> pays <b>${escapeHtml(item.to.name)}</b></span><strong>${escapeHtml(money(fromCents(item.amount), current.currency))}</strong><button class="text-button" data-action="record-payment" data-from="${escapeHtml(item.from.id)}" data-to="${escapeHtml(item.to.id)}" data-amount="${fromCents(item.amount)}">Record payment</button></div>`).join('')}</div>` : '<p class="all-settled">Everyone is settled up.</p>'}
      </section><section class="expense-list"><div class="section-heading"><h3>Expense history</h3></div>
        ${expenses.length ? expenses.map(expense => `<article class="expense-card"><div class="expense-card-top"><div><h4>${escapeHtml(expense.title)}</h4><p>${dateText(expense.date)} · ${escapeHtml(expense.category)} · paid by ${escapeHtml(personName(expense.paid_by_traveler_id))}</p></div><strong>${escapeHtml(money(expense.amount, current.currency))}</strong></div>
          <div class="expense-shares">${expense.splits.map(split => `<span>${escapeHtml(personName(split.traveler_id))}: ${escapeHtml(money(split.amount, current.currency))}</span>`).join('')}</div>
          <div class="expense-actions"><span class="quiet">Split ${expense.split_mode === 'percentage' ? 'by percentage' : 'by amount'}</span><button class="text-button" data-action="edit-expense" data-id="${escapeHtml(expense.id)}">Edit</button><button class="text-button danger" data-action="remove-expense" data-id="${escapeHtml(expense.id)}">Remove</button></div></article>`).join('') : '<p class="expense-empty">Add a shared cost to start tracking who paid and each person’s share.</p>'}
        ${settlements.length ? `<div class="settlement-history"><h4>Payments recorded</h4>${settlements.map(item => `<div class="settlement-row"><span><b>${escapeHtml(personName(item.from_traveler_id))}</b> paid <b>${escapeHtml(personName(item.to_traveler_id))}</b>${item.note ? ` · ${escapeHtml(item.note)}` : ''}<small>${dateText(item.date)}</small></span><strong>${escapeHtml(money(item.amount, current.currency))}</strong><button class="text-button danger" data-action="remove-settlement" data-id="${escapeHtml(item.id)}" aria-label="Remove payment record">Remove</button></div>`).join('')}</div>` : ''}
      </section></div>` : '<div class="empty-state"><p>Add travelers before recording shared expenses.</p><button class="secondary" data-action="add-traveler">Add a traveler</button></div>'}
  </section>`;
}

function renderPlanner() {
  const current = trip();
  if (!current) {
    $('#planner-view').innerHTML = '<div class="empty-state"><h1>That trip is not here.</h1><p>Open another trip or create a new one.</p><a class="button" href="#new">Start a trip</a></div>';
    return;
  }
  const people = travelersFor(current.id);
  if (!people.some(person => person.id === selectedTravelers.get(current.id))) selectedTravelers.set(current.id, people[0]?.id || '');
  const activities = activitiesFor(current.id).filter(activity => activity.status !== 'removed').sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''));
  const removed = activitiesFor(current.id).filter(activity => activity.status === 'removed');
  const cost = activities.reduce((total, activity) => total + activity.estimated_cost_per_person, 0);
  const days = [...new Set(activities.map(activity => activity.date))];
  $('#planner-view').innerHTML = `<div class="planner-top"><div><p class="eyebrow">Your shared weekend</p><h1>${escapeHtml(current.title)}</h1><p>${escapeHtml(current.destination)} · ${dateRange(current.start_date, current.end_date)}</p></div>
    <label class="trip-selector">Your trips<select id="trip-select">${product.trips.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
    <div class="planner-toolbar"><span class="status-badge">${escapeHtml(statusName(current.status))}</span><div class="planner-actions"><button class="secondary small" data-action="edit-trip">Edit trip</button><button class="small" data-action="confirm-plan">${current.status === 'confirmed' ? 'Reopen planning' : 'Confirm plan'}</button></div></div>
    <div class="planner-columns"><div class="itinerary"><div class="section-heading"><h2>Shared itinerary</h2><button class="small" data-action="add-activity">Add activity</button></div>
      <div class="itinerary-summary"><strong>${escapeHtml(money(cost))}</strong><span>estimated per person · activities only</span><span>Trip budget: ${escapeHtml(money(current.budget_per_person))}</span></div>
      ${cost > current.budget_per_person ? '<p class="budget-message">The activities exceed the trip budget per person.</p>' : ''}
      ${activities.length ? days.map(day => `<h3 class="day-heading">${dateText(day)}</h3>${activities.filter(activity => activity.date === day).map(activity => renderActivity(activity, current, people)).join('')}`).join('') : '<div class="empty-state"><h3>The plan is open.</h3><p>Add an activity, give it a date and cost, then ask the group to respond.</p><button data-action="add-activity">Add the first activity</button></div>'}
      ${removed.length ? `<details class="removed-list"><summary>Removed activities (${removed.length})</summary>${removed.map(activity => `<div class="removed-row"><span>${escapeHtml(activity.title)}</span><button class="text-button" data-action="restore-activity" data-id="${escapeHtml(activity.id)}">Restore</button></div>`).join('')}</details>` : ''}
    </div><aside class="people-panel"><div class="section-heading"><h2>Travelers</h2><button class="text-button" data-action="add-traveler">Add traveler</button></div>
      ${people.length ? `<label class="viewing-as">Viewing as<select id="traveler-select">${people.map(person => `<option value="${escapeHtml(person.id)}" ${person.id === selectedTravelers.get(current.id) ? 'selected' : ''}>${escapeHtml(person.name)}</option>`).join('')}</select><span class="field-help">Take turns as different travelers on this screen.</span></label>${people.map(person => renderPerson(person, current)).join('')}` : '<div class="empty-state"><p>Add the people who are going on this trip.</p><button data-action="add-traveler">Add a traveler</button></div>'}
    </aside></div>${renderExpenseSection(current, people)}`;
}

function calendarHeading() {
  const date = utcDate(calendarDate);
  if (calendarView === 'day') return new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  if (calendarView === 'week') {
    const start = startOfWeek(calendarDate);
    const end = addDays(start, 6);
    return `${dateRange(start, end)}${start.slice(0, 4) === end.slice(0, 4) ? `, ${start.slice(0, 4)}` : `, ${start.slice(0, 4)} – ${end.slice(0, 4)}`}`;
  }
  return new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function calendarActivities(start, end) {
  const query = calendarEventQuery.trim().toLocaleLowerCase();
  return product.activities
    .filter(activity => activity.status !== 'removed' && activity.date >= start && activity.date <= end)
    .filter(activity => !calendarTripId || activity.trip_id === calendarTripId)
    .filter(activity => !query || activity.title.toLocaleLowerCase().includes(query))
    .map(activity => ({ activity, trip: product.trips.find(item => item.id === activity.trip_id) }))
    .filter(item => item.trip)
    .sort((a, b) => a.activity.date.localeCompare(b.activity.date) || (a.activity.start_time || '').localeCompare(b.activity.start_time || '') || a.trip.title.localeCompare(b.trip.title) || a.activity.title.localeCompare(b.activity.title));
}

function timeText(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 1, hours, minutes)));
}

function renderCalendarEvent({ activity, trip: current }) {
  const time = activity.start_time ? `<span class="calendar-event-time">${escapeHtml(timeText(activity.start_time))}${activity.end_time ? `–${escapeHtml(timeText(activity.end_time))}` : ''}</span>` : '';
  return `<a class="calendar-event" href="#trip/${encodeURIComponent(current.id)}" title="${escapeHtml(current.title)}: ${escapeHtml(activity.title)}">
    ${time}<span class="calendar-event-title">${escapeHtml(activity.title)}</span><span class="calendar-event-trip">${escapeHtml(current.title)}</span>
    <span class="calendar-event-cost">${escapeHtml(money(activity.estimated_cost_per_person, current.currency))} per person</span></a>`;
}

function renderCalendarList(start, end) {
  const entries = calendarActivities(start, end);
  if (!entries.length) return `<div class="empty-state calendar-empty"><h2>No activities in this view</h2><p>Try another date or trip, or add ideas to a trip itinerary.</p>${product.trips[0] ? `<a class="button small" href="#trip/${encodeURIComponent(calendarTripId || product.trips[0].id)}">Open a trip</a>` : '<a class="button small" href="#new">Start a trip</a>'}</div>`;
  const dates = [...new Set(entries.map(({ activity }) => activity.date))];
  return dates.map(day => `<section class="calendar-day-group"><h2>${new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(utcDate(day))}</h2>
    <div class="calendar-day-events">${entries.filter(({ activity }) => activity.date === day).map(renderCalendarEvent).join('')}</div></section>`).join('');
}

function renderCalendarMonth() {
  const monthStart = calendarDate.slice(0, 7) + '-01';
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = addDays(gridStart, index);
    const entries = calendarActivities(day, day);
    const outsideMonth = day.slice(0, 7) !== monthStart.slice(0, 7);
    return `<div class="calendar-cell${outsideMonth ? ' outside-month' : ''}${day === todayDate() ? ' today' : ''}">
      <button class="calendar-date" type="button" data-calendar-date="${day}" aria-label="Show ${new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(utcDate(day))}">${Number(day.slice(-2))}</button>
      <div class="calendar-cell-events">${entries.slice(0, 3).map(renderCalendarEvent).join('')}${entries.length > 3 ? `<button class="calendar-more" type="button" data-calendar-date="${day}">+${entries.length - 3} more</button>` : ''}</div>
    </div>`;
  });
  return `<div class="calendar-grid-shell"><div class="calendar-weekdays" aria-hidden="true">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></div>`;
}

function renderCalendar() {
  if (!product.trips.some(item => item.id === calendarTripId)) calendarTripId = '';
  const heading = calendarHeading();
  const tripOptions = product.trips.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === calendarTripId ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('');
  const eventFilter = `<label class="calendar-event-filter">Event name<input type="search" id="calendar-event-filter" value="${escapeHtml(calendarEventQuery)}" placeholder="Search events"></label>`;
  const monthStart = calendarDate.slice(0, 7) + '-01';
  const start = calendarView === 'day' ? calendarDate : calendarView === 'week' ? startOfWeek(calendarDate) : calendarDisplay === 'agenda' ? monthStart : startOfWeek(monthStart);
  const end = calendarView === 'day' ? calendarDate : calendarView === 'week' ? addDays(start, 6) : calendarDisplay === 'agenda' ? dateKey(new Date(Date.UTC(utcDate(monthStart).getUTCFullYear(), utcDate(monthStart).getUTCMonth() + 1, 0))) : addDays(start, 41);
  $('#calendar-view').innerHTML = `<div class="calendar-header"><div><p class="eyebrow">Plan together</p><h1>Trip calendar</h1><p class="calendar-intro">See what’s on across your group trips.</p></div>
    </div><div class="calendar-toolbar"><div class="calendar-toolbar-leading"><div class="calendar-display-switch" role="group" aria-label="Calendar display">${[['calendar', 'Calendar'], ['agenda', 'Agenda']].map(([display, label]) => `<button type="button" class="calendar-display-button${calendarDisplay === display ? ' active' : ''}" data-calendar-display="${display}" aria-pressed="${calendarDisplay === display}">${label}</button>`).join('')}</div>
      <div class="calendar-view-switch" role="group" aria-label="Date range">${['day', 'week', 'month'].map(view => `<button type="button" class="calendar-view-button${calendarView === view ? ' active' : ''}" data-calendar-view="${view}" aria-pressed="${calendarView === view}">${view[0].toUpperCase() + view.slice(1)}</button>`).join('')}</div></div>
      <div class="calendar-date-nav"><button type="button" class="secondary small" data-calendar-shift="-1" aria-label="Previous ${calendarView}">‹</button><button type="button" class="secondary small" data-calendar-today>Today</button><button type="button" class="secondary small" data-calendar-shift="1" aria-label="Next ${calendarView}">›</button><h2>${escapeHtml(heading)}</h2></div>
      <div class="calendar-filters">${eventFilter}<label class="calendar-trip-filter">Trip name<select id="calendar-trip-filter"><option value="">All trips</option>${tripOptions}</select></label></div></div>
    ${calendarDisplay === 'calendar' && calendarView === 'month' ? renderCalendarMonth() : `<div class="calendar-list${calendarDisplay === 'agenda' ? ' agenda-list' : ''}">${renderCalendarList(start, end)}</div>`}`;
}

function render() {
  if (!product) return;
  const currentRoute = route();
  const known = ['home', 'new', 'trip', 'calendar'].includes(currentRoute.view) ? currentRoute.view : 'home';
  $('#home-view').hidden = known !== 'home';
  $('#new-view').hidden = known !== 'new';
  $('#planner-view').hidden = known !== 'trip';
  $('#calendar-view').hidden = known !== 'calendar';
  const first = product.trips[0];
  $('#planner-link').hidden = !first;
  $('#calendar-link').hidden = !first;
  if (first) $('#planner-link').href = '#trip/' + encodeURIComponent(trip()?.id || first.id);
  if (known === 'home') renderHome();
  if (known === 'trip') renderPlanner();
  if (known === 'calendar') renderCalendar();
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
  else if (route().view === 'calendar') record = event('calendar_viewed', calendarTripId ? { trip_id: calendarTripId } : {});
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
    if (values.currency !== current.currency && (product.expenses.some(item => item.trip_id === current.id) || product.settlements.some(item => item.trip_id === current.id))) {
      throw new Error('Remove this trip’s expenses and payments before changing its currency.');
    }
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
    const activity = { ...values, id: values.id || 'activity-' + crypto.randomUUID(), trip_id: current.id, title: values.title.trim(), category: values.category.trim(), estimated_cost_per_person: Number(values.estimated_cost_per_person) };
    if (!activity.start_time) delete activity.start_time;
    if (!activity.end_time) delete activity.end_time;
    if (activity.start_time && activity.end_time && activity.end_time <= activity.start_time) throw new Error('End time must be after start time.');
    await saveChange(next => {
      const old = next.activities.find(item => item.id === activity.id);
      if (old) Object.assign(old, activity); else next.activities.push(activity);
    }, event(values.id ? 'plan_updated' : 'activity_proposed', { trip_id: current.id, activity_id: activity.id }));
    $('#activity-dialog').close();
  });
});

$('#expense-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const current = product.trips.find(item => item.id === expenseTripId);
    if (!current) throw new Error('This trip is no longer available.');
    const oldId = form.elements.namedItem('id').value;
    const expense = readExpenseForm(form, current, oldId);
    await saveChange(next => {
      const old = next.expenses.find(item => item.id === expense.id);
      if (old) Object.assign(old, expense); else next.expenses.push(expense);
    }, event(oldId ? 'expense_updated' : 'expense_added', { trip_id: current.id, expense_id: expense.id, amount: expense.amount, split_mode: expense.split_mode }, expense.paid_by_traveler_id));
    $('#expense-dialog').close();
  });
});

$('#settlement-form').addEventListener('submit', eventObject => {
  eventObject.preventDefault();
  const form = eventObject.currentTarget;
  submitForm(form, async () => {
    const current = product.trips.find(item => item.id === settlementTripId);
    if (!current) throw new Error('This trip is no longer available.');
    const values = Object.fromEntries(new FormData(form));
    const amountCents = cents(values.amount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error('Enter a payment amount greater than zero.');
    if (values.from_traveler_id === values.to_traveler_id) throw new Error('Choose two different travelers.');
    const balances = expenseBalances(current.id);
    const debt = -(balances.get(values.from_traveler_id) || 0);
    const credit = balances.get(values.to_traveler_id) || 0;
    if (debt <= 0 || credit <= 0) throw new Error('Choose someone who owes money and someone who is owed money.');
    if (amountCents > Math.min(debt, credit)) throw new Error('The payment cannot exceed the current amount owed.');
    const settlement = {
      id: 'settlement-' + crypto.randomUUID(),
      trip_id: current.id,
      from_traveler_id: values.from_traveler_id,
      to_traveler_id: values.to_traveler_id,
      amount: fromCents(amountCents),
      date: values.date,
      note: values.note.trim()
    };
    await saveChange(next => next.settlements.push(settlement), event('settlement_recorded', { trip_id: current.id, settlement_id: settlement.id, amount: settlement.amount, to_traveler_id: settlement.to_traveler_id }, settlement.from_traveler_id));
    $('#settlement-dialog').close();
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
  if (eventObject.target.id === 'calendar-trip-filter') { calendarTripId = eventObject.target.value; renderCalendar(); }
  if (eventObject.target.id === 'expense-split-mode') convertSplitMode($('#expense-form'), eventObject.target.value);
});

document.addEventListener('input', eventObject => {
  if (eventObject.target.id === 'calendar-event-filter') {
    const cursor = eventObject.target.selectionStart;
    calendarEventQuery = eventObject.target.value;
    renderCalendar();
    const input = $('#calendar-event-filter');
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }
});

async function handleAction(button) {
  const { action, id } = button.dataset;
  const current = trip();
  if (action === 'edit-trip') return openEditor('trip');
  if (action === 'add-traveler' || action === 'edit-traveler') return openEditor('traveler', id);
  if (action === 'add-activity' || action === 'edit-activity') return openEditor('activity', id);
  if (action === 'add-expense' || action === 'edit-expense') return openExpenseEditor(id);
  if (action === 'record-payment') return openSettlementEditor(button.dataset.from, button.dataset.to, cents(button.dataset.amount));
  if (action === 'remove-traveler') {
    if (product.expenses.some(expense => expense.trip_id === current.id && (expense.paid_by_traveler_id === id || expense.splits.some(split => split.traveler_id === id))) || product.settlements.some(item => item.trip_id === current.id && (item.from_traveler_id === id || item.to_traveler_id === id))) {
      throw new Error('Remove this traveler’s expenses and payments before removing them from the trip.');
    }
    return saveChange(next => {
      next.travelers = next.travelers.filter(person => person.id !== id);
      next.responses = next.responses.filter(response => response.traveler_id !== id);
    }, event('traveler_removed', { trip_id: current.id, traveler_id: id }));
  }
  if (action === 'remove-expense') {
    return saveChange(next => { next.expenses = next.expenses.filter(expense => expense.id !== id); }, event('expense_removed', { trip_id: current.id, expense_id: id }));
  }
  if (action === 'remove-settlement') {
    return saveChange(next => { next.settlements = next.settlements.filter(item => item.id !== id); }, event('settlement_removed', { trip_id: current.id, settlement_id: id }));
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
  const calendarDateButton = eventObject.target.closest('[data-calendar-date]');
  if (calendarDateButton) {
    calendarDate = calendarDateButton.dataset.calendarDate;
    calendarView = 'day';
    renderCalendar();
    return;
  }
  const calendarViewButton = eventObject.target.closest('[data-calendar-view]');
  if (calendarViewButton) {
    calendarView = calendarViewButton.dataset.calendarView;
    renderCalendar();
    return;
  }
  const calendarDisplayButton = eventObject.target.closest('[data-calendar-display]');
  if (calendarDisplayButton) {
    calendarDisplay = calendarDisplayButton.dataset.calendarDisplay;
    renderCalendar();
    return;
  }
  const calendarShiftButton = eventObject.target.closest('[data-calendar-shift]');
  if (calendarShiftButton) {
    const amount = Number(calendarShiftButton.dataset.calendarShift);
    calendarDate = calendarView === 'month' ? dateKey(new Date(Date.UTC(utcDate(calendarDate).getUTCFullYear(), utcDate(calendarDate).getUTCMonth() + amount, 1))) : addDays(calendarDate, amount * (calendarView === 'week' ? 7 : 1));
    renderCalendar();
    return;
  }
  if (eventObject.target.closest('[data-calendar-today]')) {
    calendarDate = todayDate();
    renderCalendar();
    return;
  }
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
