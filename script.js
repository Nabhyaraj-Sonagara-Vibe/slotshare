/**
 * script.js — UI wiring for SlotShare.
 * Relies on SlotShareCore (slotshare-core.js) for encode/decode logic.
 */
(function () {
  "use strict";

  var senderTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var slots = []; // { start: Date, end: Date }

  var senderView = document.getElementById("senderView");
  var recipientView = document.getElementById("recipientView");
  var errorView = document.getElementById("errorView");

  function init() {
    var encoded = window.SlotShareCore.extractEncodedFromUrl(window.location.href);
    if (encoded) {
      renderRecipientView(encoded);
    } else {
      renderSenderView();
    }
  }

  // ---------- Sender view ----------

  function renderSenderView() {
    senderView.hidden = false;
    document.getElementById("senderTz").textContent = senderTz;

    var dateInput = document.getElementById("slotDate");
    var startInput = document.getElementById("slotStart");
    var endInput = document.getElementById("slotEnd");
    var today = new Date();
    dateInput.value = today.toISOString().slice(0, 10);
    startInput.value = "09:00";
    endInput.value = "09:30";

    document.getElementById("addSlotForm").addEventListener("submit", function (e) {
      e.preventDefault();
      addSlot(dateInput.value, startInput.value, endInput.value);
    });

    document.getElementById("generateBtn").addEventListener("click", generateLink);
    document.getElementById("copyBtn").addEventListener("click", copyLink);

    renderSlotList();
  }

  function addSlot(dateStr, startStr, endStr) {
    if (!dateStr || !startStr || !endStr) return;
    var start = new Date(dateStr + "T" + startStr + ":00");
    var end = new Date(dateStr + "T" + endStr + ":00");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      alert("End time must be after start time.");
      return;
    }
    slots.push({ start: start, end: end });
    slots.sort(function (a, b) {
      return a.start - b.start;
    });
    renderSlotList();
  }

  function removeSlot(index) {
    slots.splice(index, 1);
    renderSlotList();
  }

  function renderSlotList() {
    var listEl = document.getElementById("slotList");
    listEl.innerHTML = "";

    if (slots.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No slots added yet. Add one below.";
      listEl.appendChild(empty);
    } else {
      slots.forEach(function (slot, i) {
        var item = document.createElement("div");
        item.className = "slot-item";

        var label = document.createElement("span");
        label.className = "slot-label";
        label.textContent =
          window.SlotShareCore.formatInTimeZone(slot.start, senderTz) +
          " – " +
          window.SlotShareCore.formatTimeInTimeZone(slot.end, senderTz);
        item.appendChild(label);

        var removeBtn = document.createElement("button");
        removeBtn.className = "btn-remove";
        removeBtn.setAttribute("aria-label", "Remove this slot");
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", function () {
          removeSlot(i);
        });
        item.appendChild(removeBtn);

        listEl.appendChild(item);
      });
    }

    document.getElementById("generateBtn").disabled = slots.length === 0;
    document.getElementById("shareResult").hidden = true;
  }

  function generateLink() {
    if (slots.length === 0) return;
    var baseUrl = window.location.origin + window.location.pathname;
    var url = window.SlotShareCore.buildShareUrl(baseUrl, senderTz, slots);
    var shareUrlInput = document.getElementById("shareUrl");
    shareUrlInput.value = url;
    document.getElementById("shareResult").hidden = false;
    shareUrlInput.focus();
    shareUrlInput.select();
  }

  function copyLink() {
    var shareUrlInput = document.getElementById("shareUrl");
    var status = document.getElementById("copyStatus");
    var text = shareUrlInput.value;

    function showCopied() {
      status.textContent = "Copied to clipboard!";
      setTimeout(function () {
        status.textContent = "";
      }, 2500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied, function () {
        shareUrlInput.select();
        document.execCommand("copy");
        showCopied();
      });
    } else {
      shareUrlInput.select();
      document.execCommand("copy");
      showCopied();
    }
  }

  // ---------- Recipient view ----------

  function renderRecipientView(encoded) {
    var payload = window.SlotShareCore.decodePayload(encoded);
    if (!payload || !payload.slots.length) {
      errorView.hidden = false;
      return;
    }

    var recipientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    recipientView.hidden = false;
    document.getElementById("recipientTz").textContent = recipientTz;
    document.getElementById("senderTzLabel").textContent = payload.tz;

    var listEl = document.getElementById("recipientSlotList");
    listEl.innerHTML = "";

    payload.slots.forEach(function (slot) {
      var start = new Date(slot.start);
      var end = new Date(slot.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      var item = document.createElement("div");
      item.className = "slot-item slot-item-recipient";

      var localLabel = document.createElement("div");
      localLabel.className = "slot-label slot-label-local";
      localLabel.textContent =
        window.SlotShareCore.formatInTimeZone(start, recipientTz) +
        " – " +
        window.SlotShareCore.formatTimeInTimeZone(end, recipientTz);
      item.appendChild(localLabel);

      var originalLabel = document.createElement("div");
      originalLabel.className = "slot-sublabel";
      originalLabel.textContent =
        "Originally proposed: " +
        window.SlotShareCore.formatInTimeZone(start, payload.tz) +
        " – " +
        window.SlotShareCore.formatTimeInTimeZone(end, payload.tz);
      item.appendChild(originalLabel);

      listEl.appendChild(item);
    });

    if (!listEl.children.length) {
      errorView.hidden = false;
      recipientView.hidden = true;
    }
  }

  init();
})();
