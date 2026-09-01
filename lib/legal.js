/**
 * legal.js — the two pages every platform review asks for.
 *
 * TikTok's App Review Guidelines require "a valid Privacy Policy and
 * Terms of Service", "visible on your official website" and reachable
 * "without navigating menus" — which is why both are linked in the
 * footer of every page rather than buried.
 *
 * They are written from what the code actually does, not from a
 * template. Every claim here is checkable against a file:
 *
 *   the booking form   functions/api/book.js — name, email, message,
 *                      the slots picked, and the country header
 *                      Cloudflare adds. Sent by Resend; stored in KV
 *                      only if the mail fails.
 *   the studio         lib/auth.js — one HttpOnly session cookie, no
 *                      third-party anything.
 *   the social side    lib/publishers.js, lib/insights.js — tokens for
 *                      the operator's own accounts, used to post to
 *                      them and read back the counts on those posts.
 *
 * There is no analytics script, no advertising pixel and no embedded
 * third-party player on this site. Saying so is only worth doing
 * because it is true; if that changes, this file changes with it.
 *
 * Not legal advice, and not reviewed by a solicitor.
 */

export const UPDATED = '1 September 2026';

const CONTACT = 'hello@web3ashley.com';

/**
 * A section is a heading and a run of paragraphs. Lists are a nested
 * array, which keeps the content readable here rather than being HTML
 * with prose hidden inside it.
 */
export const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy',
  description:
    'What this site collects, why, how long it is kept, and who else sees it. '
    + 'There is no analytics script and no advertising pixel.',
  intro:
    'This site is run by one person. It collects as little as it can get away with, '
    + 'and what it does collect is listed here in full rather than summarised.',
  sections: [
    {
      title: 'What is collected',
      body: [
        'Nothing at all, until you send something.',
        'There is no analytics script on this site, no advertising pixel, no session '
        + 'recording, and no embedded third-party player. Reading a page here does not '
        + 'create a record of you anywhere I can see.',
        ['When you send the booking form, I receive: your name, your email address, what '
         + 'you wrote about what is broken, the call length and the times you picked, the '
         + 'moment you sent it, and the two-letter country code Cloudflare attaches to the '
         + 'request. Not your IP address, and not your name from anywhere else.',
         'When you sign in to the private studio — which is me, and nobody else — the site '
         + 'sets one cookie holding a signed session. It is HttpOnly, Secure, '
         + 'SameSite=Strict, and it expires. That is the only cookie this site sets.'],
      ],
    },
    {
      title: 'Why',
      body: [
        'To answer you. That is the whole reason the booking form exists, and the only '
        + 'thing your message is used for.',
        'Your email address is not added to a mailing list, because there is no mailing '
        + 'list. It is not sold, shared or passed to anyone for their own purposes. If you '
        + 'want to talk again later, you write again.',
      ],
    },
    {
      title: 'Who else sees it',
      body: [
        'Three companies are involved in this site working at all, and each one sees only '
        + 'the part it handles:',
        ['Cloudflare hosts the site, serves every page, and stores its content and images. '
         + 'A booking is stored with them only in the case where the email fails to send, '
         + 'so that your message is not simply lost.',
         'Resend delivers the booking form as an email to me. They handle the message on '
         + 'its way to my inbox.',
         'Google, for the parts of my own content work that run through Gemini. It never '
         + 'receives anything you sent — it plans and draws posts about my own work, and '
         + 'has no access to the booking form or to anything you wrote.'],
        'No other service receives anything. There is no advertising network here to pass '
        + 'anything to.',
      ],
    },
    {
      title: 'My own social accounts',
      body: [
        'This site also posts to my own Instagram and TikTok accounts, on a schedule, after '
        + 'I have approved each post by hand. To do that it holds access tokens for those '
        + 'accounts and reads back the public engagement counts on posts it made — likes, '
        + 'comments, views.',
        'That is my data about my own accounts. It involves no visitor to this site and no '
        + 'other person\'s account. Nothing about you is posted anywhere, and no follower '
        + 'or viewer data is collected, stored or looked at.',
      ],
    },
    {
      title: 'How long it is kept',
      body: [
        'Booking emails stay in my inbox while the conversation is live and for as long as '
        + 'I need them for my own records afterwards. Ask me to delete yours and I will, and '
        + 'I will tell you when it is done.',
        'The session cookie expires on its own. Nothing about a visitor is kept beyond that.',
      ],
    },
    {
      title: 'What you can ask for',
      body: [
        'A copy of anything I hold about you, a correction to it, or its deletion. Write to '
        + `${CONTACT} and say which. There is no form and no process — it is one person `
        + 'reading an email.',
        'If you are in the UK or the EU, those rights are the ones the UK GDPR and the GDPR '
        + 'give you, and the lawful basis for handling a booking is that you asked me to get '
        + 'in touch. You can also complain to your data protection authority if you think I '
        + 'have handled something badly.',
      ],
    },
    {
      title: 'Children',
      body: [
        'This site is for businesses. It is not aimed at anyone under 18, and I do not '
        + 'knowingly collect anything from a child.',
      ],
    },
    {
      title: 'Changes',
      body: [
        `Last updated ${UPDATED}. If this changes in a way that matters, the date changes `
        + 'with it, and the previous version is in the site\'s version history.',
        `Anything unclear: ${CONTACT}.`,
      ],
    },
  ],
};

export const TERMS = {
  slug: 'terms',
  title: 'Terms',
  description:
    'What this site is, what you may do with it, and where my responsibility '
    + 'for it starts and stops.',
  intro:
    'Short, because the site is small. Using it means these apply.',
  sections: [
    {
      title: 'What this is',
      body: [
        'web3ashley.com is the working site of one independent designer and developer. It '
        + 'describes what I do, carries writing about it, and lets you ask for an intro call.',
        'It is not a shop. Nothing is sold through it, no payment is taken on it, and no '
        + 'account is created for you.',
      ],
    },
    {
      title: 'Using it',
      body: [
        'Read it, quote it with attribution, link to it, send the form if you want to talk. '
        + 'Nothing here is behind a login for you, so there is nothing for you to keep '
        + 'secure.',
        'What is not on: sending the form to advertise at me or to send anything unlawful, '
        + 'trying to reach the private studio behind it, scraping it in a way that costs me '
        + 'money to serve, or presenting my writing as yours.',
      ],
    },
    {
      title: 'The private part',
      body: [
        'The studio at /studio is mine. It is password-protected, it publishes nothing about '
        + 'visitors, and attempting to get into it is not a grey area.',
      ],
    },
    {
      title: 'Booking a call',
      body: [
        'Sending the form is a request, not a booking. I reply, usually within one working '
        + 'day, and we agree a time — or I tell you I am not the right person, which happens '
        + 'and is not a bad outcome for either of us.',
        'The call is free and there is nothing to buy at the end of it. Any actual work is a '
        + 'separate written agreement, and these terms are not it.',
      ],
    },
    {
      title: 'What is mine',
      body: [
        'The writing, the design, the code and the images on this site are mine unless the '
        + 'page says otherwise. Quote a paragraph and credit it; copying a page wholesale to '
        + 'run as your own is not on.',
        'What you send me stays yours. I use it to answer you, and nothing else.',
      ],
    },
    {
      title: 'What I do not promise',
      body: [
        'The site is provided as it is. I keep it working and correct what I find wrong, but '
        + 'I do not promise it will never be down, never be wrong, or suit any particular '
        + 'purpose you have in mind.',
        'The writing here is a description of how I work, not advice about your business. '
        + 'Acting on it is your call, and I am not liable for what follows from it. Where the '
        + 'law lets me limit my liability, it is limited; where it does not — for death or '
        + 'personal injury caused by negligence, or for fraud — nothing here limits it.',
      ],
    },
    {
      title: 'Links out',
      body: [
        'Links to other sites are there because they were useful. What is on them is not '
        + 'mine and is not my responsibility.',
      ],
    },
    {
      title: 'Changes',
      body: [
        `Last updated ${UPDATED}. These can change; the date changes with them, and the `
        + 'version that applies is the one on the day you used the site.',
        `Anything unclear: ${CONTACT}.`,
      ],
    },
  ],
};

export const PAGES = { privacy: PRIVACY, terms: TERMS };
