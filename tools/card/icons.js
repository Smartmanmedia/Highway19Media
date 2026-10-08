/* THE CARD'S ICONS - ONE COLOUR, THE CARD'S.
 *
 * Every glyph is drawn in currentColor, so a card's theme colours all of them
 * at once and none of them arrives wearing its own company's colours: the
 * Facebook mark is recognisably Facebook's shape, in this card's accent.
 *
 * Two kinds, and the difference is only how they are filled:
 *   line   the interface - 24 grid, 1.75 stroke, round caps
 *   mark   the networks  - solid shapes (Simple Icons geometry, CC0)
 *
 * Only the icons a card actually uses are written into its page, as <symbol>s
 * in one hidden sprite - no request, nothing to go missing offline.
 */
const line = d => ({ kind: 'line', d });
const mark = d => ({ kind: 'mark', d });

const ICONS = {
  phone:   line('<path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5.9 5.9l1.3-2 4 1.6V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  message: line('<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4.5 20l1-3.9A7.5 7.5 0 1 1 20 12.5z"/>'),
  mail:    line('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>'),
  globe:   line('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  pin:     line('<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  calendar:line('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  userAdd: line('<circle cx="9.5" cy="8" r="3.7"/><path d="M2.8 20a6.8 6.8 0 0 1 13.4 0M19 8v6M16 11h6"/>'),
  share:   line('<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>'),
  qr:      line('<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h1M20.5 14v1"/>'),
  star:    line('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  play:    line('<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>'),
  chevron: line('<path d="m9 5 7 7-7 7"/>'),
  arrow:   line('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  mobile:  line('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  plusApp: line('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>'),
  iosShare:line('<path d="M12 3v11M8 6.5 12 2.8l4 3.7"/><path d="M8.5 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2"/>'),
  dots:    line('<circle cx="12" cy="5.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18.5" r="1"/>'),
  check:   line('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close:   line('<path d="M6 6l12 12M18 6 6 18"/>'),
  tag:     line('<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>'),
  send:    line('<path d="M20.5 3.5 3.5 10.5l7 3 3 7z"/><path d="m10.5 13.5 4-4"/>'),

  facebook:  mark('<path d="M9.1 23.7v-8H6.6V12h2.5v-1.6c0-4.1 1.8-6 5.9-6 .4 0 1 0 1.5.1l1.1.2V8l-.6-.1h-.7c-.7 0-1.3.1-1.7.3-.3.2-.5.4-.7.6-.3.4-.4 1-.4 1.8V12h3.9l-.4 2.1-.3 1.6h-3.2V24C19.4 23.2 24 18.2 24 12a12 12 0 1 0-14.9 11.7z"/>'),
  instagram: mark('<path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8C2.4 4 4 2.4 7.2 2.3c1.2-.1 1.6-.1 4.8-.1zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z"/>'),
  tiktok:    mark('<path d="M12.5 0h3.9c.1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8V10a10 10 0 0 1-5.8-1.9v8.7c-.1 1.4-.5 2.8-1.4 3.9a7.2 7.2 0 0 1-5.9 3.2 7.1 7.1 0 0 1-7.7-6.7v-1.5a7.1 7.1 0 0 1 8.7-6.7v4.4a3.3 3.3 0 0 0-4.4 2.1c-.2.5-.1 1.1-.1 1.6.2 1.6 1.8 3 3.5 2.9 1.1 0 2.2-.7 2.8-1.6.2-.3.4-.7.4-1.1.1-1.8.1-3.6.1-5.4V0z"/>'),
  youtube:   mark('<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6z"/>'),
  linkedin:  mark('<path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zm1.8 13.1H3.6V9h3.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/>'),
  whatsapp:  mark('<path d="M12 1.5A10.5 10.5 0 0 0 2.9 17.2L1.5 22.5l5.4-1.4A10.5 10.5 0 1 0 12 1.5zm0 19.1c-1.6 0-3.2-.4-4.5-1.2l-.3-.2-3.2.8.9-3.1-.2-.3A8.6 8.6 0 1 1 12 20.6z"/><path d="M16.8 14.3c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1a7 7 0 0 1-3.5-3c-.3-.5.3-.4.8-1.4.1-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3z"/>'),
  x:         mark('<path d="M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9zm-1.3 19.4h2L6.5 3.2H4.3z"/>'),
};

/* the networks a card can list, in the order they are shown, and how each is
   named on screen when there is room for a name */
const NETWORKS = [
  ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['whatsapp', 'WhatsApp'],
];

function sprite(names) {
  const syms = [...new Set(names)].map(n => {
    const i = ICONS[n];
    if (!i) throw new Error('card: no icon called ' + n);
    return i.kind === 'line'
      ? `<symbol id="i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${i.d}</symbol>`
      : `<symbol id="i-${n}" viewBox="0 0 24 24" fill="currentColor">${i.d}</symbol>`;
  });
  return `<svg class="sprite" aria-hidden="true" width="0" height="0">${syms.join('')}</svg>`;
}

module.exports = { ICONS, NETWORKS, sprite };
