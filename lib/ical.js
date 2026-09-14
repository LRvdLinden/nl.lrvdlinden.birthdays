'use strict';

const crypto = require('crypto');

function unfold(input) {
  return String(input || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/)
    .map(line => line.replace(/\r$/, ''));
}

function decodeQuotedPrintable(value) {
  return String(value || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function unescapeText(value, parameters = '') {
  let text = String(value || '');
  if (/ENCODING=QUOTED-PRINTABLE/i.test(parameters)) text = decodeQuotedPrintable(text);
  return text
    .replace(/\\[nN]/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function dateFromValue(value) {
  const compact = String(value || '').trim();
  const match = compact.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanSummary(summary) {
  return String(summary || '')
    .replace(/^[\u{1F382}\u{1F389}\u{1F4C5}\s]+/u, '')
    .replace(/^(birthday|birthday of|birthday:|verjaardag|verjaardag van|geburtstag|geburtstag von|anniversaire|anniversaire de|compleanno|cumpleaños|urodziny)\s*[:\-]?\s*/i, '')
    .replace(/(?:'s birthday|’s birthday| verjaardag| birthday| geburtstag| anniversaire| compleanno| cumpleaños| urodziny)$/i, '')
    .trim();
}

function parseProperty(line) {
  const separator = line.indexOf(':');
  if (separator < 0) return null;
  const left = line.slice(0, separator);
  const semicolon = left.indexOf(';');
  return {
    name: (semicolon < 0 ? left : left.slice(0, semicolon)).trim().toLowerCase(),
    parameters: semicolon < 0 ? '' : left.slice(semicolon + 1),
    value: line.slice(separator + 1),
  };
}

function parseIcal(input, sourceId, sourceName) {
  const events = [];
  let event = null;

  function finishEvent(current) {
    if (!current) return;
    const rawDate = current.dtstart || current.bday || current['x-abdate'];
    const dateOfBirth = dateFromValue(rawDate);
    const rawName = current.summary || current.fn || current.description || '';
    const name = cleanSummary(unescapeText(rawName.value || rawName, rawName.parameters || ''));
    if (!dateOfBirth || !name) return;

    const rawUid = current.uid && (current.uid.value || current.uid);
    const uid = unescapeText(rawUid || '') ||
      crypto.createHash('sha1').update(`${name}|${dateOfBirth}`).digest('hex');
    const omitYear = Boolean(current['x-apple-omit-year']) || Number(dateOfBirth.slice(0, 4)) <= 1904;
    const description = current.description
      ? unescapeText(current.description.value || current.description, current.description.parameters || '')
      : '';

    events.push({
      id: `ical:${sourceId}:${uid}`,
      name,
      dateOfBirth,
      mobile: '',
      mobile2: '',
      message: description,
      category: sourceName || 'iCal',
      imageUrl: '',
      isBaby: omitYear,
      icalSourceId: sourceId,
      icalUid: uid,
    });
  }

  for (const originalLine of unfold(input)) {
    const line = originalLine.trimEnd();
    const marker = line.trim().toUpperCase();
    if (marker === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (marker === 'END:VEVENT') {
      finishEvent(event);
      event = null;
      continue;
    }
    if (!event) continue;

    const property = parseProperty(line);
    if (!property) continue;
    if (['uid', 'summary', 'description', 'dtstart', 'bday', 'x-abdate', 'fn', 'x-apple-omit-year'].includes(property.name)) {
      event[property.name] = property;
    }
  }

  // Keep one item per source/UID when calendars contain expanded recurring instances.
  return Array.from(new Map(events.map(person => [person.id, person])).values());
}

function mergeSource(existing, imported, sourceId) {
  const otherSourcesAndManual = (Array.isArray(existing) ? existing : [])
    .filter(person => person.icalSourceId !== sourceId);
  return otherSourcesAndManual.concat(imported);
}

module.exports = { parseIcal, mergeSource };
