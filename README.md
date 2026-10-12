# SlotShare

Pick a few time slots in your own timezone, get a shareable link — **no
account, no server, no calendar access**. The recipient opens the link and
sees every slot automatically converted to their own local time.

**Live app (after merge to `main`):** https://nabhyaraj-sonagara-vibe.github.io/slotshare/

## The problem

People coordinating meetings across timezones just want to say "here's when
I'm free" and have the other person see it in *their* local time — without
either side signing up, connecting a calendar, or wrestling with a bloated
scheduling SaaS. Existing tools (Calendly, Doodle, Zeeg, Calendar.com) all
demand accounts or calendar access, which is overkill for a one-off
scheduling ask.

SlotShare skips all of that: pick a few slots in your own detected
timezone, hit "Generate link," and send the URL. Everything — your chosen
slots and your timezone — is encoded directly into the link itself. There is
no backend and nothing is ever uploaded anywhere.

## How it works

- Your slots + your IANA timezone are serialized to JSON, base64url-encoded,
  and appended to the URL as a `?d=` query parameter.
- When someone opens that URL, the page decodes the parameter, detects
  *their* browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`,
  and renders each slot converted into their local time using
  `Intl.DateTimeFormat`, alongside a note of what was originally proposed.
- No build step, no external dependencies, no CDN calls — everything runs
  from three plain files (`index.html`, `style.css`, `script.js` +
  `slotshare-core.js`).

## Run it locally

```bash
git clone https://github.com/Nabhyaraj-Sonagara-Vibe/slotshare.git
cd slotshare
python3 -m http.server 8000
# open http://localhost:8000 in your browser
```

Or just open `index.html` directly in a browser (it works with `file://`
too, since there's no server-side logic).

## Run the tests

```bash
node test.js
```

This runs a smoke test over the core encode/decode logic (round-tripping a
sample payload through the URL encoding scheme) and checks that the HTML/JS
wiring (element ids, function names) is intact.

## Why I built this

Saw multiple threads of people specifically frustrated that every
timezone-scheduling tool forces an account or calendar OAuth just to send a
"pick a time" link for a single one-off meeting. This is the minimal version
of that: nothing to sign up for, nothing to install, nothing stored anywhere
except the link you already have.

## Scope (intentionally not included)

- No reply/RSVP write-back to the sender (there's no backend to write to).
- No recurring meetings.
- No multi-person "when2meet"-style availability grids.
- No calendar API integrations.
- No persistence beyond the URL itself — no accounts, no history of past
  links.
