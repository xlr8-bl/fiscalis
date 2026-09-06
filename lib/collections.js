/**
 * collections.js — what the site is made of.
 *
 * This file is the whole content model. The studio builds its forms from
 * these definitions, the API validates against them, and the home page
 * renderer reads them to fill its slots. Adding a content type — case
 * studies, testimonials, a team — is an entry here and a `data-cms-list`
 * in the markup. It is not a migration and it is not a new table.
 *
 * Field types:
 *   text      one line
 *   textarea  several lines
 *   markdown  several lines, rendered through the article parser
 *   media     a path under /media/ or /assets/, with a picker
 *   url       a link
 *   number    a figure
 */

export const COLLECTIONS = {
  projects: {
    label: 'Work',
    singular: 'Project',
    // what the home page's "symptoms" cards read from
    note: 'The cards in the work section. Order is the order they appear.',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true,
        help: 'The problem in the customer’s words, not the deliverable.' },
      { name: 'summary', type: 'textarea', label: 'Summary',
        help: 'Two sentences. What was leaking, and what it cost.' },
      { name: 'metric', type: 'text', label: 'The number',
        help: 'The one figure that lands. "11s", "30%", "0".' },
      { name: 'metricLabel', type: 'text', label: 'What the number means' },
      { name: 'image', type: 'media', label: 'Still' },
      { name: 'clip', type: 'media', label: 'Clip', help: 'Plays on hover. WebM, no audio.' },
      { name: 'link', type: 'url', label: 'Links to', help: 'Defaults to the booking page.' },
    ],
  },

  services: {
    label: 'Services',
    singular: 'Service',
    note: 'The list in the services section.',
    titleField: 'name',
    fields: [
      { name: 'name', type: 'text', label: 'Service', required: true },
      { name: 'blurb', type: 'textarea', label: 'One line about it' },
    ],
  },

  steps: {
    label: 'Process',
    singular: 'Stage',
    note: 'The stages in the process section.',
    titleField: 'heading',
    fields: [
      { name: 'heading', type: 'text', label: 'Stage', required: true },
      { name: 'body', type: 'textarea', label: 'What happens', required: true },
      { name: 'clip', type: 'media', label: 'Clip' },
    ],
  },

  faqs: {
    label: 'FAQs',
    singular: 'Question',
    note: 'Answer the question people actually ask, including when the answer is no.',
    titleField: 'question',
    fields: [
      { name: 'question', type: 'text', label: 'Question', required: true },
      { name: 'answer', type: 'markdown', label: 'Answer', required: true },
    ],
  },

  testimonials: {
    label: 'Testimonials',
    singular: 'Testimonial',
    note: 'Only real ones, with permission. An invented quote is the one placeholder that stops being harmless the day the site goes live.',
    titleField: 'name',
    fields: [
      { name: 'quote', type: 'textarea', label: 'What they said', required: true },
      { name: 'name', type: 'text', label: 'Who said it', required: true },
      { name: 'role', type: 'text', label: 'Their business' },
      { name: 'photo', type: 'media', label: 'Photo' },
    ],
  },
};

/**
 * Single values. Grouped only so the studio can lay them out; the store is
 * flat and keyed by the dotted name.
 */
export const SETTINGS = [
  {
    group: 'Hero',
    fields: [
      { name: 'hero.line1', type: 'textarea', label: 'Opening line',
        help: 'The first thing anyone reads.' },
      { name: 'hero.line2', type: 'textarea', label: 'Second line' },
    ],
  },
  {
    group: 'The gap',
    fields: [
      { name: 'gap.heading', type: 'textarea', label: 'The big statement',
        help: 'Lights up as it scrolls. Keep it to a couple of sentences.' },
      { name: 'gap.statA', type: 'text', label: 'First figure' },
      { name: 'gap.statALabel', type: 'textarea', label: 'What it means' },
      { name: 'gap.statB', type: 'text', label: 'Second figure' },
      { name: 'gap.statBLabel', type: 'textarea', label: 'What it means' },
    ],
  },
  {
    group: 'Closing call',
    fields: [
      { name: 'cta.quote', type: 'textarea', label: 'The closing note' },
    ],
  },
  {
    group: 'Contact',
    fields: [
      { name: 'contact.email', type: 'text', label: 'Email' },
      { name: 'contact.availability', type: 'text', label: 'Availability line',
        help: 'Shown in the footer beside the clock.' },
      { name: 'contact.location', type: 'text', label: 'Where you work' },
      { name: 'social.instagram', type: 'url', label: 'Instagram' },
      { name: 'social.tiktok', type: 'url', label: 'TikTok' },
      { name: 'social.x', type: 'url', label: 'X' },
    ],
  },
  {
    group: 'Writing on a schedule',
    fields: [
      { name: 'writing.every', type: 'select', label: 'How often',
        options: [['off', 'Off, only when I ask'], ['daily', 'Every day'],
                  ['weekdays', 'Every weekday'], ['weekly', 'Once a week'],
                  ['fortnightly', 'Every other week']],
        help: 'This is the plan, not the clock. Spark fires it from its own '
            + 'recurring task, so changing it here changes what happens on the '
            + 'next run rather than when the next run is.' },
      { name: 'writing.day', type: 'select', label: 'Which day',
        options: [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'],
                  ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'],
                  ['sun', 'Sunday']],
        help: 'For once a week and every other week. Ignored otherwise.' },
      { name: 'writing.at', type: 'text', label: 'What time',
        help: 'Your local time, as 09:00.' },
      { name: 'writing.count', type: 'select', label: 'How many each time',
        options: [['1', 'One'], ['2', 'Two'], ['3', 'Three'], ['4', 'Four'], ['5', 'Five'],
                  ['6', 'Six'], ['8', 'Eight'], ['10', 'Ten'], ['12', 'Twelve']] },
      { name: 'writing.then', type: 'select', label: 'When they are written',
        options: [['review', 'Leave them for me to read'],
                  ['schedule', 'Space them out over the next few days'],
                  ['publish', 'Put them straight on the site']],
        help: 'Straight on the site means articles go live without anybody '
            + 'reading them first. Every check still runs, and you can unpublish '
            + 'from here in a tap.' },
      { name: 'writing.across', type: 'select', label: 'Spread over how many days',
        options: [['1', 'One day'], ['2', 'Two'], ['3', 'Three'], ['5', 'Five'], ['7', 'A week']],
        help: 'Only used when they are spaced out.' },
    ],
  },
  {
    group: "What's showing",
    fields: [
      { name: 'site.bookingOnly', type: 'toggle', label: 'Booking only',
        help: 'Turns the site into one page with one thing to do. The opening, '
            + 'the questions and the closing call stay; the pitch, the statement, '
            + 'Work, Services, Process and the Journal all go, along with every '
            + 'link to them. The journal itself answers with a temporary redirect '
            + 'to the booking page, so nothing is lost in search. Turn it off and '
            + 'everything is back, immediately.' },
    ],
  },
  {
    group: 'Search',
    fields: [
      { name: 'seo.title', type: 'text', label: 'Page title',
        help: 'What Google prints as the headline of the result.' },
      { name: 'seo.description', type: 'textarea', label: 'Description',
        help: 'The sentence underneath it. About 160 characters.' },
      { name: 'seo.ogImage', type: 'media', label: 'Share image',
        help: 'What every shared link renders as. 1200×630.' },
    ],
  },
];

/** Flat map of every settings field, by name. */
export const SETTING_FIELDS = Object.fromEntries(
  SETTINGS.flatMap((g) => g.fields.map((f) => [f.name, f]))
);

export function collection(name) {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, name)
    ? COLLECTIONS[name]
    : null;
}

/**
 * Keep only the fields the collection defines, trimmed and capped. An entry
 * cannot carry keys nobody asked for, whoever posted it.
 */
export function sanitiseEntry(name, input) {
  const def = collection(name);
  if (!def) return null;
  const out = {};
  for (const field of def.fields) {
    const raw = input?.[field.name];
    if (raw === undefined || raw === null) continue;
    const max = field.type === 'markdown' || field.type === 'textarea' ? 4000 : 500;
    out[field.name] = String(raw).trim().slice(0, max);
  }
  return out;
}

export function missingRequired(name, data) {
  const def = collection(name);
  if (!def) return [];
  return def.fields
    .filter((f) => f.required && !String(data?.[f.name] ?? '').trim())
    .map((f) => f.label);
}
