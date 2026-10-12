/**
 * slotshare-core.js — pure logic for encoding/decoding SlotShare links.
 * Works in both the browser (loaded via <script>, exposes window.SlotShareCore)
 * and Node (via module.exports) so the same code can be unit tested with `node test.js`.
 *
 * Encoding scheme: JSON -> UTF-8 bytes -> base64url (no external deps, no
 * compression library needed — slot lists are tiny so plain base64 is fine).
 */

(function (root) {
  "use strict";

  /**
   * Convert a UTF-8 string to a base64url string (no padding, URL-safe chars).
   */
  function base64urlEncode(str) {
    var bytes = utf8Encode(str);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    var b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * Decode a base64url string back to a UTF-8 string.
   */
  function base64urlDecode(b64url) {
    var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) {
      b64 += "=";
    }
    var binary = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    var bytes = new Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return utf8Decode(bytes);
  }

  function utf8Encode(str) {
    var utf8 = [];
    for (var i = 0; i < str.length; i++) {
      var charcode = str.charCodeAt(i);
      if (charcode < 0x80) {
        utf8.push(charcode);
      } else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(
          0xe0 | (charcode >> 12),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      } else {
        // surrogate pair
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      }
    }
    return utf8;
  }

  function utf8Decode(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var c = bytes[i];
      if (c < 0x80) {
        out += String.fromCharCode(c);
        i += 1;
      } else if (c >> 5 === 0x06) {
        out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 2;
      } else if (c >> 4 === 0x0e) {
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
        );
        i += 3;
      } else {
        var cp =
          ((c & 0x07) << 18) |
          ((bytes[i + 1] & 0x3f) << 12) |
          ((bytes[i + 2] & 0x3f) << 6) |
          (bytes[i + 3] & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        i += 4;
      }
    }
    return out;
  }

  /**
   * Encode a payload { tz: string, slots: [{start: isoString, end: isoString, label?: string}] }
   * into a URL-safe string.
   */
  function encodePayload(payload) {
    var json = JSON.stringify(payload);
    return base64urlEncode(json);
  }

  /**
   * Decode a URL-safe string back into the payload object.
   * Returns null if decoding/parsing fails (malformed or missing data).
   */
  function decodePayload(encoded) {
    try {
      var json = base64urlDecode(encoded);
      var payload = JSON.parse(json);
      if (!payload || !Array.isArray(payload.slots) || typeof payload.tz !== "string") {
        return null;
      }
      return payload;
    } catch (e) {
      return null;
    }
  }

  /**
   * Build a full shareable URL from a base URL (location.origin + pathname),
   * the sender's timezone, and a list of slots ({start: Date|isoString, end: Date|isoString}).
   */
  function buildShareUrl(baseUrl, tz, slots) {
    var normalized = slots.map(function (s) {
      return {
        start: s.start instanceof Date ? s.start.toISOString() : s.start,
        end: s.end instanceof Date ? s.end.toISOString() : s.end,
      };
    });
    var encoded = encodePayload({ tz: tz, slots: normalized });
    var base = baseUrl.split("#")[0].split("?")[0];
    return base + "?d=" + encoded;
  }

  /**
   * Extract the encoded data param ("d") from a full URL or query string.
   */
  function extractEncodedFromUrl(url) {
    var qIndex = url.indexOf("?");
    if (qIndex === -1) {
      return null;
    }
    var query = url.slice(qIndex + 1).split("#")[0];
    var params = query.split("&");
    for (var i = 0; i < params.length; i++) {
      var pair = params[i].split("=");
      if (pair[0] === "d" && pair[1]) {
        return decodeURIComponent(pair[1]);
      }
    }
    return null;
  }

  /**
   * Format a Date (an instant in time) as a human string in a given IANA timezone,
   * e.g. "Tue, Oct 14, 2025, 2:00 PM PDT".
   */
  function formatInTimeZone(date, timeZone) {
    var dtf = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timeZone,
    });
    return dtf.format(date);
  }

  /**
   * Format just the time portion (no date) in a given timezone, e.g. "2:00 PM PDT".
   */
  function formatTimeInTimeZone(date, timeZone) {
    var dtf = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timeZone,
    });
    return dtf.format(date);
  }

  var api = {
    base64urlEncode: base64urlEncode,
    base64urlDecode: base64urlDecode,
    encodePayload: encodePayload,
    decodePayload: decodePayload,
    buildShareUrl: buildShareUrl,
    extractEncodedFromUrl: extractEncodedFromUrl,
    formatInTimeZone: formatInTimeZone,
    formatTimeInTimeZone: formatTimeInTimeZone,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SlotShareCore = api;
  }
})(typeof window !== "undefined" ? window : this);
