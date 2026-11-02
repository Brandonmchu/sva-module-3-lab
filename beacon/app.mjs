import { createServer } from 'node:http';
import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, 'public');
const dataFile = resolve(root, 'data/events.jsonl');
const schema = JSON.parse(readFileSync(resolve(root, 'data/schema.json'), 'utf8'));
const config = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

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
  const events = readEvents();
  if (process.argv.includes('--check')) {
    console.log('Valid data: ' + events.length + ' events.');
  } else {
    const port = Number(process.env.PORT ?? config.config.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw fail('PORT must be an integer from 0 to 65535.');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
    const server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (pathname === '/api/events') {
          if (request.method === 'GET') return json(response, 200, readEvents());
          if (request.method === 'POST') {
            if (!request.headers['content-type']?.startsWith('application/json')) throw fail('Send application/json.', 415);
            if (request.headers.origin && request.headers.origin !== 'http://' + request.headers.host) throw fail('Cross-origin writes are not supported.', 403);
            const chunks = [];
            let bytes = 0;
            for await (const chunk of request) {
              bytes += chunk.length;
              if (bytes > 5 * 1024 * 1024) throw fail('Keep each request under 5 MB.', 413);
              chunks.push(chunk);
            }
            const count = appendEvents(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            return json(response, 201, { added: count });
          }
          throw fail('Use GET or POST for events.', 405);
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
