import { createServer } from 'node:http';
import { readFileSync, appendFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, 'public');
const dataFile = resolve(root, 'data/events.jsonl');
const schema = JSON.parse(readFileSync(resolve(root, 'data/schema.json'), 'utf8'));
const productFile = resolve(root, 'data/product.json');
const productSchema = JSON.parse(readFileSync(resolve(root, 'data/product.schema.json'), 'utf8'));
const config = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function validateValue(value, rule, label) {
  if (rule.$ref) rule = productSchema.$defs[rule.$ref.split('/').at(-1)];
  if (!rule) throw fail('Unknown model definition at ' + label);
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(label + ' must be an object.');
    for (const key of rule.required || []) if (!(key in value)) throw fail(label + '.' + key + ' is required.');
    for (const [key, item] of Object.entries(value)) {
      if (rule.properties?.[key]) validateValue(item, rule.properties[key], label + '.' + key);
    }
  } else if (rule.type === 'array') {
    if (!Array.isArray(value)) throw fail(label + ' must be an array.');
    value.forEach((item, index) => validateValue(item, rule.items, label + '[' + index + ']'));
  } else if (rule.type === 'number' || rule.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (rule.type === 'integer' && !Number.isInteger(value))) {
      throw fail(label + ' must be a finite ' + rule.type + '.');
    }
    if (rule.minimum !== undefined && value < rule.minimum) throw fail(label + ' must be at least ' + rule.minimum + '.');
  } else if (typeof value !== rule.type || (rule.minLength && value.length < rule.minLength)) {
    throw fail(label + ' must be a non-empty ' + rule.type + '.');
  }
  if (rule.enum && !rule.enum.includes(value)) throw fail(label + ' must be one of: ' + rule.enum.join(', '));
  if (rule.pattern && !new RegExp(rule.pattern).test(value)) throw fail(label + ' has an invalid format.');
  if (rule.format === 'date') {
    const date = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw fail(label + ' must be a valid YYYY-MM-DD date.');
  }
}

function validateProduct(product) {
  validateValue(product, productSchema, 'product');
  const records = {};
  for (const table of ['trips', 'travelers', 'activities', 'responses']) {
    records[table] = new Map();
    for (const row of product[table]) {
      if (records[table].has(row.id)) throw fail('Duplicate ' + table + ' id: ' + row.id);
      records[table].set(row.id, row);
    }
  }
  for (const trip of product.trips) if (trip.start_date > trip.end_date) throw fail('Trip end_date must follow start_date.');
  for (const table of ['travelers', 'activities', 'responses']) {
    for (const row of product[table]) if (!records.trips.has(row.trip_id)) throw fail(table + ' references an unknown trip_id: ' + row.trip_id);
  }
  for (const traveler of product.travelers) {
    if (traveler.available_from > traveler.available_to) throw fail('Traveler available_to must follow available_from.');
  }
  for (const response of product.responses) {
    if (records.travelers.get(response.traveler_id)?.trip_id !== response.trip_id) throw fail('Response traveler_id must belong to its trip.');
    if (records.activities.get(response.activity_id)?.trip_id !== response.trip_id) throw fail('Response activity_id must belong to its trip.');
  }
}

function readProduct() {
  const product = JSON.parse(readFileSync(productFile, 'utf8'));
  validateProduct(product);
  return product;
}

function saveProduct(product) {
  validateProduct(product);
  const temporary = productFile + '.tmp';
  writeFileSync(temporary, JSON.stringify(product, null, 2) + '\n');
  renameSync(temporary, productFile);
}

async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw fail('Send application/json.', 415);
  if (request.headers.origin && request.headers.origin !== 'http://' + request.headers.host) throw fail('Cross-origin writes are not supported.', 403);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 5 * 1024 * 1024) throw fail('Keep each request under 5 MB.', 413);
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function generateRoutes(input) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw fail('AI route planning is not configured. Set OPENAI_API_KEY on the server and restart Fjord.', 503);
  const { destination, start_date, end_date, budget_per_person, currency, brief } = input || {};
  if (typeof destination !== 'string' || !destination.trim() || typeof start_date !== 'string' || typeof end_date !== 'string' || !Number.isFinite(budget_per_person) || budget_per_person < 0 || typeof currency !== 'string') throw fail('Add a destination, dates, budget, and currency first.');
  validateValue(start_date, { type:'string', format:'date' }, 'start_date');
  validateValue(end_date, { type:'string', format:'date' }, 'end_date');
  if (end_date < start_date) throw fail('End date must follow start date.');
  const days = Math.round((Date.parse(end_date) - Date.parse(start_date)) / 86400000) + 1;
  if (days > 4) throw fail('Choose a trip of up to four days for route suggestions.');
  const system = `You are Fjord's careful trip planner. Return ONLY a JSON object with an options array of exactly 3 distinct routes: Best fit, Lower cost, More to explore. Each option has name, summary, estimated_total_per_person (number), and stops (array). Each stop has date (YYYY-MM-DD), time (HH:MM 24-hour), title, place, category, description (2 useful sentences explaining what to do and why it fits), duration_minutes (number), travel_from_previous (realistic mode and approximate time, or "Start of day"), estimated_cost_per_person (number), booking_note (what to check before going). Use real, destination-specific places; group nearby places in sensible order; cover every trip day with a reasonable morning, afternoon and evening plan. Include meal breaks. Avoid impossible travel or invented addresses. Use the request's interests and must-see places. Respect the per-person budget; describe exclusions like lodging and long-distance transport in each summary. Costs and times are estimates, never claim verified opening hours or availability. Keep all text in English. No markdown.`;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60000);
  let result;
  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ Authorization:'Bearer ' + key, 'Content-Type':'application/json' }, body:JSON.stringify({ model:process.env.OPENAI_MODEL || 'gpt-4.1-mini', instructions:system, input:JSON.stringify({ destination:destination.trim(), start_date, end_date, budget_per_person, currency, brief:String(brief || '').slice(0,2000) }), text:{ format:{ type:'json_object' } }, max_output_tokens:6500 }), signal:controller.signal });
    result = await upstream.json();
    if (!upstream.ok) throw fail('AI planner request failed: ' + (result.error?.message || upstream.status), 502);
  } catch (error) { if (error.status) throw error; throw fail('AI planner could not connect. Try again shortly.', 502); }
  finally { clearTimeout(timeout); }
  const content = result.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  let plan; try { plan = JSON.parse(content); } catch { throw fail('AI planner returned an incomplete route. Please try again.', 502); }
  const expectedDates = Array.from({length:days}, (_,index) => new Date(Date.parse(start_date) + index * 86400000).toISOString().slice(0,10));
  if (!Array.isArray(plan.options) || plan.options.length !== 3 || plan.options.some(option => !option.name || !option.summary || !Number.isFinite(option.estimated_total_per_person) || !Array.isArray(option.stops) || option.stops.length < days * 2 || expectedDates.some(date => !option.stops.some(stop => stop.date === date)) || option.stops.some(stop => stop.date < start_date || stop.date > end_date || !/^\d{2}:\d{2}$/.test(stop.time) || !stop.title || !stop.place || !stop.description || !stop.travel_from_previous || !stop.booking_note || !Number.isFinite(stop.duration_minutes) || !Number.isFinite(stop.estimated_cost_per_person) || stop.estimated_cost_per_person < 0))) throw fail('AI planner returned an incomplete route. Please try again.', 502);
  return plan;
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw fail('Each event must be an object.');
  for (const field of schema.required) {
    if (!(field in event)) throw fail('Missing field: ' + field);
  }
  for (const [field, value] of Object.entries(event)) {
    const rule = schema.properties[field];
    if (!rule) throw fail('Unknown field: ' + field + '. Put custom values in properties.');
    if (rule.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(field + ' must be an object.');
    } else if (typeof value !== rule.type || value.length < (rule.minLength || 0)) {
      throw fail(field + ' must be a non-empty ' + rule.type + '.');
    }
    if (rule.format === 'date-time') {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
        throw fail(field + ' must be a UTC ISO timestamp, such as 2026-11-03T23:00:00.000Z.');
      }
    }
  }
}

function readEvents() {
  const raw = readFileSync(dataFile, 'utf8');
  if (!raw) return [];
  const lines = raw.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const ids = new Set();
  return lines.map((line, index) => {
    try {
      const event = JSON.parse(line);
      validateEvent(event);
      if (ids.has(event.id)) throw fail('Duplicate id: ' + event.id);
      ids.add(event.id);
      return event;
    } catch (error) {
      throw fail('data/events.jsonl line ' + (index + 1) + ': ' + error.message);
    }
  });
}

function appendEvents(input) {
  const batch = Array.isArray(input) ? input : [input];
  if (!batch.length) throw fail('Send one event or a non-empty array.');
  const ids = new Set(readEvents().map(event => event.id));
  const events = batch.map(inputEvent => {
    if (!inputEvent || typeof inputEvent !== 'object' || Array.isArray(inputEvent)) throw fail('Each event must be an object.');
    const event = { id: randomUUID(), at: new Date().toISOString(), source: 'product', properties: {}, ...inputEvent };
    validateEvent(event);
    if (ids.has(event.id)) throw fail('Duplicate id: ' + event.id);
    ids.add(event.id);
    return event;
  });
  const raw = readFileSync(dataFile, 'utf8');
  const separator = raw && !raw.endsWith('\n') ? '\n' : '';
  appendFileSync(dataFile, separator + events.map(event => JSON.stringify(event)).join('\n') + '\n');
  return events.length;
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

try {
  const product = readProduct();
  const events = readEvents();
  if (process.argv.includes('--check')) {
    console.log('Valid product: ' + product.trips.length + ' trips, ' + product.travelers.length + ' travelers, ' + product.activities.length + ' activities, ' + product.responses.length + ' responses.');
    console.log('Valid data: ' + events.length + ' events.');
  } else {
    const port = Number(process.env.PORT ?? config.config.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw fail('PORT must be an integer from 0 to 65535.');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
    const server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (pathname === '/api/product') {
          if (request.method === 'GET') return json(response, 200, readProduct());
          if (request.method === 'PUT') {
            saveProduct(await readJson(request));
            return json(response, 200, { saved: true });
          }
          throw fail('Use GET or PUT for the product.', 405);
        }
        if (pathname === '/api/events') {
          if (request.method === 'GET') return json(response, 200, readEvents());
          if (request.method === 'POST') {
            const count = appendEvents(await readJson(request));
            return json(response, 201, { added: count });
          }
          throw fail('Use GET or POST for events.', 405);
        }
        if (pathname === '/api/routes') {
          if (request.method !== 'POST') throw fail('Use POST for route generation.', 405);
          return json(response, 200, await generateRoutes(await readJson(request)));
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') throw fail('Method not supported.', 405);
        const file = resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(publicRoot + sep)) throw fail('Not found.', 404);
        const content = readFileSync(file);
        response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : content);
      } catch (error) {
        const status = ['ENOENT', 'EISDIR'].includes(error.code) ? 404 : error.status || 400;
        json(response, status, { error: error.message });
      }
    });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(config.name + ' is ready: http://127.0.0.1:' + server.address().port));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
