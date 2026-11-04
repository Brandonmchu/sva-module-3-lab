const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types = [['flights','✈','Flights & trains','Coordinate arrivals and departures'],['stays','⌂','Hotels & stays','Compare hotels, Airbnb and VRBO'],['cars','↗','Car rentals','Find a car or van for the crew'],['experiences','✦','Tours & experiences','Plan restaurants, guides and activities']];
export function bookingPlaceholder(trip) {
  return `<section class="booking-preview" aria-labelledby="booking-preview-heading"><div class="booking-preview-heading"><div><p class="eyebrow">Plan it. Then book it.</p><h2 id="booking-preview-heading">Group bookings</h2></div><span class="booking-demo-label">MVP preview</span></div><p class="booking-preview-intro">Keep the whole crew’s travel in one place. Preview the booking steps below.</p><div class="booking-preview-grid">${types.map(([id,icon,title,description])=>`<article class="booking-preview-card"><span class="booking-preview-icon" aria-hidden="true">${icon}</span><h3>${title}</h3><p>${description}</p><span class="booking-not-added">Not added yet</span><button type="button" class="secondary small" data-booking-preview="${id}" data-destination="${escape(trip.destination)}" data-start="${escape(trip.start_date)}" data-end="${escape(trip.end_date)}">Preview ${title.toLowerCase()}</button></article>`).join('')}</div><p class="booking-preview-note">Booking providers and payments are placeholders. No reservation or charge is made.</p></section>`;
}
let dialog;
document.addEventListener('click', event => {
  const button = event.target.closest('[data-booking-preview]');
  if (!button) return;
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.className = 'booking-demo-dialog';
    dialog.setAttribute('aria-labelledby','booking-demo-title'); document.body.append(dialog);
    dialog.addEventListener('click', event => { if(event.target.closest('[data-booking-close]')) dialog.close(); });
    dialog.addEventListener('submit', event => {
      event.preventDefault();
      dialog.querySelector('.booking-demo-content').innerHTML = '<div class="booking-demo-success"><span aria-hidden="true">✓</span><h3>That’s the booking flow.</h3><p>In the full product, you would review the provider’s final price, availability, cancellation policy and payment details here.</p><p><strong>This was an MVP preview. No booking, payment or provider request was made.</strong></p><button type="button" data-booking-close>Back to the trip</button></div>';
    });
  }
  const type = types.find(t=>t[0]===button.dataset.bookingPreview);
  dialog.innerHTML = `<div class="dialog-header"><div><p class="eyebrow">MVP booking preview</p><h2 id="booking-demo-title">${type[2]}</h2></div><button type="button" class="text-button" data-booking-close>Close</button></div><div class="booking-demo-content"><p>1. Share the plan → 2. Compare options → 3. Review with the provider</p><form><label>Destination<input value="${escape(button.dataset.destination)}" readonly></label><div class="form-grid"><label>From<input type="date" value="${escape(button.dataset.start)}" readonly></label><label>Until<input type="date" value="${escape(button.dataset.end)}" readonly></label></div><label>Who is joining?<select><option>The whole group</option><option>Some trip mates</option></select></label><label>Booking preference<input placeholder="e.g. shared rooms, direct flight, or a six-seat van" maxlength="200"></label><div class="booking-provider-slot"><strong>Provider options and group prices</strong><p>Availability, offers and prices will appear here when a booking provider is connected.</p></div><p class="booking-preview-note">Preview only. Your entries are not sent to a provider or saved as a reservation.</p><button type="submit">Preview next step</button></form></div>`;
  dialog.showModal();
});
