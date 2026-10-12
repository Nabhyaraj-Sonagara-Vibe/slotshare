/**
 * test.js — smoke test for slotshare-core.js
 * Run with: node test.js
 */

const core = require("./slotshare-core.js");
const fs = require("fs");

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
    console.log("PASS:", label);
  } else {
    failed++;
    console.error("FAIL:", label);
    console.error("  expected:", b);
    console.error("  actual:  ", a);
  }
}

function assertTrue(cond, label) {
  if (cond) {
    passed++;
    console.log("PASS:", label);
  } else {
    failed++;
    console.error("FAIL:", label);
  }
}

// --- round-trip encode/decode ---

const samplePayload = {
  tz: "America/Los_Angeles",
  slots: [
    { start: "2025-10-14T21:00:00.000Z", end: "2025-10-14T22:00:00.000Z" },
    { start: "2025-10-15T17:30:00.000Z", end: "2025-10-15T18:00:00.000Z" },
  ],
};

const encoded = core.encodePayload(samplePayload);
assertTrue(typeof encoded === "string" && encoded.length > 0, "encodePayload returns a non-empty string");
assertTrue(!/[+/=]/.test(encoded), "encodePayload output is URL-safe (no +, /, =)");

const decoded = core.decodePayload(encoded);
assertEqual(decoded, samplePayload, "decodePayload round-trips the original payload exactly");

// --- malformed input handling ---
assertEqual(core.decodePayload("not-valid-base64!!!"), null, "decodePayload returns null for garbage input");
assertEqual(core.decodePayload(core.base64urlEncode("{}")), null, "decodePayload returns null when required fields are missing");

// --- buildShareUrl / extractEncodedFromUrl round trip ---
const slots = [
  { start: new Date("2025-11-01T18:00:00.000Z"), end: new Date("2025-11-01T19:00:00.000Z") },
];
const url = core.buildShareUrl("https://example.github.io/slotshare/index.html", "Europe/London", slots);
assertTrue(url.indexOf("?d=") !== -1, "buildShareUrl appends a ?d= query param");

const extracted = core.extractEncodedFromUrl(url);
const roundTripped = core.decodePayload(extracted);
assertEqual(roundTripped.tz, "Europe/London", "extractEncodedFromUrl + decodePayload recovers the sender timezone");
assertEqual(roundTripped.slots[0].start, "2025-11-01T18:00:00.000Z", "extractEncodedFromUrl + decodePayload recovers the slot start time");

// --- URL without data param ---
assertEqual(core.extractEncodedFromUrl("https://example.github.io/slotshare/index.html"), null, "extractEncodedFromUrl returns null when there's no query string");

// --- formatInTimeZone sanity check (doesn't throw, contains expected pieces) ---
const formatted = core.formatInTimeZone(new Date("2025-10-14T21:00:00.000Z"), "America/Los_Angeles");
assertTrue(typeof formatted === "string" && formatted.length > 0, "formatInTimeZone produces a non-empty string");
assertTrue(/2025/.test(formatted), "formatInTimeZone includes the year");

// --- static file sanity checks (index.html / script.js wiring) ---
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
assertTrue(html.includes('id="senderView"'), "index.html contains #senderView");
assertTrue(html.includes('id="recipientView"'), "index.html contains #recipientView");
assertTrue(html.includes('id="generateBtn"'), "index.html contains #generateBtn");
assertTrue(html.includes('src="slotshare-core.js"'), "index.html loads slotshare-core.js");
assertTrue(html.includes('src="script.js"'), "index.html loads script.js");

const script = fs.readFileSync(__dirname + "/script.js", "utf8");
assertTrue(script.includes("function generateLink"), "script.js defines generateLink()");
assertTrue(script.includes("function renderRecipientView"), "script.js defines renderRecipientView()");
assertTrue(script.includes("SlotShareCore"), "script.js uses SlotShareCore");

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
