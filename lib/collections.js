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
 * The home page's sections, and the mode that removes each one.
 *
 * Named for the absence rather than the presence, because that is what
 * the markup carries: an element is tagged with the modes that REMOVE
 * it, and a section nobody has hidden carries a mode nobody ever adds.
 * `data-off-when` holds several, so the nav link to the work section can
 * go both when the site is booking only and when the work itself is
 * switched off, without being tagged twice.
 */
export const SECTIONS = [
  { key: 'nav', mode: 'noNav', label: 'The menu at the top' },
  { key: 'problems', mode: 'noProblems', label: 'What goes wrong' },
  { key: 'statement', mode: 'noStatement', label: 'The statement' },
  { key: 'work', mode: 'noWork', label: 'My work' },
  { key: 'services', mode: 'noServices', label: 'What I do' },
  { key: 'process', mode: 'noProcess', label: 'How it goes' },
  { key: 'journal', mode: 'noJournal', label: 'The journal, in the menus' },
  { key: 'faqs', mode: 'noFaqs', label: 'Questions' },
  { key: 'cta', mode: 'noCta', label: 'The closing invitation to book' },
  { key: 'footer', mode: 'noFooter', label: 'The footer' },
];

/*
 * What each section switch actually does, said in terms of what a
 * visitor loses. "Hides the works section" is a restatement of the
 * label; what somebody deciding needs to know is what goes with it.
 */
const SECTION_HELP = {
  nav: 'The bar across the top, with the menu and the button that books. '
     + 'Turning this off leaves a visitor no way to reach anything but the '
     + 'opening screen, so leave it on unless that is the point.',
  problems: 'The run of things that go wrong, under the opening.',
  statement: 'The numbered statement about how the work is done.',
  work: 'The portfolio. Every link to it goes too, in the menu and the '
      + 'footer, because a menu item that scrolls to nothing reads as a '
      + 'broken site rather than a deliberate one.',
  services: 'What I do, and its links.',
  process: 'The stages of a job, and its links.',
  journal: 'Only the links to the journal, in the menu and the footer. The '
         + 'journal itself stays where it is and keeps working.',
  faqs: 'The questions and answers.',
  cta: 'The invitation to book at the foot of the page. This is the last '
     + 'thing between a reader and a booking, so it is the one to keep.',
  footer: 'The whole footer, including the contact details and the big '
        + 'wordmark.',
};

/** Whole hours as options, so a window is picked rather than typed. */
const hours = (lo, hi) => {
  const out = [];
  for (let h = lo; h <= hi; h++) {
    out.push([String(h), h === 0 ? 'Midnight' : h === 12 ? 'Midday'
      : h === 24 ? 'Midnight, end of day'
        : `${String(h).padStart(2, '0')}:00`]);
  }
  return out;
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
    group: 'When you are free',
    fields: [
      { name: 'book.days', type: 'text', label: 'Days you take calls',
        help: 'Comma separated, three letters each: mon,tue,wed,thu,fri.' },
      { name: 'book.hours', type: 'text', label: 'Between',
        help: 'Your local time, as 10:00-16:00.' },
      { name: 'book.minutes', type: 'select', label: 'How long a call is',
        options: [['30', '30 minutes'], ['45', '45 minutes'], ['60', 'An hour']] },
      { name: 'book.gap', type: 'select', label: 'Gap between calls',
        options: [['0', 'None'], ['15', '15 minutes'], ['30', 'Half an hour']],
        help: 'Nobody books back to back well. Fifteen minutes is the usual answer.' },
      { name: 'book.lead', type: 'select', label: 'Earliest somebody can book',
        options: [['0', 'Today'], ['1', 'Tomorrow'], ['2', 'The day after tomorrow'],
                  ['3', 'In three days'], ['5', 'In five days'], ['7', 'In a week']],
        help: 'This has to be longer than the gap between you reading your '
            + 'email. At one day, a request that arrives after you have read '
            + 'today is answered after the hour it asked for has already gone.' },
      { name: 'book.window', type: 'select', label: 'How far ahead to show',
        options: [['3', 'Three days'], ['5', 'Five days'], ['7', 'A week'], ['14', 'A fortnight']],
        help: 'Short windows book better and cancel less than long ones. Five is '
            + 'the number the research keeps landing on, and it is the default.' },
      { name: 'book.perDay', type: 'select', label: 'Most calls in one day',
        options: [['1', 'One'], ['2', 'Two'], ['3', 'Three'], ['4', 'Four'], ['6', 'Six']] },
      { name: 'book.callFrom', type: 'text', label: 'The number you ring from',
        help: 'Optional. Shown to somebody who picked a phone or WhatsApp '
            + 'call, so they know the number before it rings.' },
      { name: 'book.platforms', type: 'text', label: 'How you take calls',
        help: 'Comma separated, in the order you want them offered: meet, '
            + 'zoom, teams, whatsapp, phone, facetime. Whichever they pick '
            + 'comes through with the request, so you know which link to '
            + 'send without asking. WhatsApp, phone and FaceTime ask them '
            + 'for a number; the others do not. Leave it blank for Google '
            + 'Meet, Zoom and a phone call.' },
      { name: 'book.hold', type: 'select', label: 'How long a request holds its time',
        options: [['12', 'Twelve hours'], ['24', 'A day'], ['36', 'A day and a half'],
                  ['72', 'Three days']],
        help: 'A held time is out of the diary until you answer. After this it '
            + 'lets go on its own, which is also what stops anybody reserving '
            + 'your whole week and never turning up.' },
    ],
  },
  {
    group: 'How posts go out',
    fields: [
      { name: 'post.route', type: 'select', label: 'Which road they take',
        options: [['direct', 'Straight to the platforms'], ['buffer', 'Through Buffer']],
        help: 'Straight means my own apps talk to Instagram, TikTok and '
            + 'Facebook, which needs each one to have approved the app. '
            + 'Buffer posts under its apps instead, so nothing waits on a '
            + 'review: connect the channels in Buffer, take the key from '
            + 'Buffer under Settings, API, and set it as BUFFER_API_KEY. '
            + 'Switch back the day TikTok approves: nothing else changes, '
            + 'and no redeploy.' },
      { name: 'post.gap_minutes', type: 'text', label: 'Minutes between platforms',
        help: 'When one carousel goes to more than one place, the second waits '
            + 'this long after the first. Neither Instagram nor TikTok requires '
            + 'a gap; this is so somebody who follows both does not get the same '
            + 'sheets twice in the same second. 30 by default. Set 0 to post '
            + 'them together.' },
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
                  ['6', 'Six'], ['8', 'Eight'], ['10', 'Ten'], ['12', 'Twelve'],
                  ['16', 'Sixteen'], ['20', 'Twenty'], ['30', 'Thirty'],
                  ['40', 'Forty'], ['50', 'Fifty']],
        help: 'Past about a dozen a day you need the hours below opened up, or '
            + 'there is no room in the day to space them out and the run will '
            + 'say so rather than stacking them.' },
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
      { name: 'writing.from', type: 'select', label: 'Earliest anything goes out',
        options: hours(0, 23),
        help: 'Local time. Set this to midnight and the one below to midnight '
            + 'for round the clock.' },
      { name: 'writing.to', type: 'select', label: 'Latest',
        options: hours(1, 24),
        help: 'A twelve hour day holds about nine posts at a natural spacing. '
            + 'Round the clock holds about nineteen. Past that they start to '
            + 'come out close enough together to read as a machine.' },
    ],
  },
  {
    group: 'Sections',
    fields: [
      /*
       * One switch each, all of them on.
       *
       * Hero only and booking only are both all-or-nothing, and what is
       * usually wanted sits between them: keep the menu, keep the way to
       * book, keep the footer, and take out only the parts still showing
       * work that does not exist yet. Neither of those switches can say
       * that. These can, one section at a time, and the default is that
       * everything shows, so a site nobody has touched is unchanged.
       */
      ...SECTIONS.map((s) => ({
        name: `show.${s.key}`, type: 'toggle', label: s.label,
        help: SECTION_HELP[s.key],
      })),
    ],
  },
  {
    group: "What's showing",
    fields: [
      { name: 'site.heroOnly', type: 'toggle', label: 'Hero only',
        help: 'One screen and nothing else, for while the work that will fill '
            + 'the site is being made. The opening is all anybody sees: no '
            + 'navigation, no questions, no closing call, no footer. It fills '
            + 'the phone screen exactly, and the wordmark clears the notch at '
            + 'the top and Safari\'s floating bar at the bottom. Implies booking '
            + 'only, so the journal still redirects rather than 404s. Turn it '
            + 'off and everything is back, immediately.' },
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
