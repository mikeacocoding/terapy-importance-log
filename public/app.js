(function () {
  "use strict";

  var API_BASE = "/api/days";
  var daysContainer = document.getElementById("days-container");

  var debounceTimers = new Map();

  function debounce(key, fn, delay) {
    if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
    var t = setTimeout(function () {
      debounceTimers.delete(key);
      fn();
    }, delay);
    debounceTimers.set(key, t);
  }

  function todayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatDate(iso) {
    var parts = iso.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var text = d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatTime12h(hhmm) {
    var parts = (hhmm || "00:00").split(":");
    var h = parseInt(parts[0], 10);
    var m = parts[1] || "00";
    if (isNaN(h)) h = 0;
    var period = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + period;
  }

  function formatTimeRange(start, end) {
    return formatTime12h(start) + " – " + formatTime12h(end);
  }

  // 24h "HH:MM" <-> the pair of selects (12h "hh:mm" + AM/PM) used in the form.
  function to12hSelectParts(hhmm) {
    var parts = (hhmm || "00:00").split(":");
    var h = parseInt(parts[0], 10);
    var m = parts[1] || "00";
    if (isNaN(h)) h = 0;
    var period = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return { time: String(h12).padStart(2, "0") + ":" + m, period: period };
  }

  function from12hSelectParts(time12, period) {
    var parts = (time12 || "12:00").split(":");
    var h = parseInt(parts[0], 10);
    var m = parts[1] || "00";
    if (isNaN(h)) h = 12;
    if (period === "AM") {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return String(h).padStart(2, "0") + ":" + m;
  }

  async function api(path, options) {
    var res = await fetch(API_BASE + path, Object.assign(
      { headers: { "Content-Type": "application/json" } },
      options
    ));
    if (!res.ok) {
      var msg = "Error de red";
      try {
        var body = await res.json();
        msg = body.error || msg;
      } catch (e) {
        // response had no JSON body
      }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function clampInt(value) {
    if (value === "" || value === null || value === undefined) return null;
    var n = parseInt(value, 10);
    if (isNaN(n)) return null;
    return Math.min(10, Math.max(1, n));
  }

  function clampScoreInput(input) {
    if (input.value === "") return;
    input.value = clampInt(input.value);
  }

  function updateScoreBar(input) {
    var wrap = input.closest(".score-wrap");
    if (!wrap) return;
    var fill = wrap.querySelector(".score-bar-fill");
    var v = parseInt(input.value, 10);
    fill.style.width = isNaN(v) ? "0%" : Math.max(0, Math.min(10, v)) * 10 + "%";
  }

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function updateDayStats(dayCard) {
    var enjoyVals = [];
    var impVals = [];
    dayCard.querySelectorAll(".entry-item").forEach(function (item) {
      var entry = item._entry;
      if (!entry || !entry.id) return; // unsaved draft: not counted yet
      if (entry.enjoyment != null) enjoyVals.push(entry.enjoyment);
      if (entry.importance != null) impVals.push(entry.importance);
    });
    var avg = function (arr) {
      if (!arr.length) return "—";
      return (arr.reduce(function (a, b) { return a + b; }, 0) / arr.length).toFixed(1);
    };
    dayCard.querySelector(".stat-enjoy").lastChild.textContent = " disfrute " + avg(enjoyVals);
    dayCard.querySelector(".stat-importance").lastChild.textContent = " importancia " + avg(impVals);
  }

  // ---- Entry item: a view (read-only) and a form (create/edit) sharing one element ----

  function setStatBarWidth(fillEl, value) {
    if (!fillEl) return;
    var v = typeof value === "number" ? value : NaN;
    fillEl.style.width = isNaN(v) ? "0%" : Math.max(0, Math.min(10, v)) * 10 + "%";
  }

  function renderEntryView(item, entry) {
    item.querySelector(".entry-view-time").textContent = formatTimeRange(entry.start, entry.end);
    item.querySelector(".entry-view-activity").textContent = entry.activity || "(sin nombre)";

    var enjoyStat = item.querySelector(".entry-stat-enjoy");
    var impStat = item.querySelector(".entry-stat-importance");
    enjoyStat.querySelector(".entry-view-stat-value").textContent = entry.enjoyment != null ? entry.enjoyment : "—";
    impStat.querySelector(".entry-view-stat-value").textContent = entry.importance != null ? entry.importance : "—";
    setStatBarWidth(enjoyStat.querySelector(".score-bar-fill"), entry.enjoyment);
    setStatBarWidth(impStat.querySelector(".score-bar-fill"), entry.importance);
  }

  function fillEntryForm(item, entry) {
    var startParts = to12hSelectParts(entry.start || "00:00");
    var endParts = to12hSelectParts(entry.end || "00:00");
    item.querySelector(".f-start-time").value = startParts.time;
    item.querySelector(".f-start-period").value = startParts.period;
    item.querySelector(".f-end-time").value = endParts.time;
    item.querySelector(".f-end-period").value = endParts.period;
    item.querySelector(".f-activity").value = entry.activity || "";
    item.querySelector(".f-enjoy").value = entry.enjoyment != null ? entry.enjoyment : "";
    item.querySelector(".f-importance").value = entry.importance != null ? entry.importance : "";
    updateScoreBar(item.querySelector(".f-enjoy"));
    updateScoreBar(item.querySelector(".f-importance"));
  }

  function readEntryForm(item) {
    var startTime = item.querySelector(".f-start-time").value;
    var startPeriod = item.querySelector(".f-start-period").value;
    var endTime = item.querySelector(".f-end-time").value;
    var endPeriod = item.querySelector(".f-end-period").value;
    return {
      start: from12hSelectParts(startTime, startPeriod),
      end: from12hSelectParts(endTime, endPeriod),
      activity: item.querySelector(".f-activity").value.trim(),
      enjoyment: clampInt(item.querySelector(".f-enjoy").value),
      importance: clampInt(item.querySelector(".f-importance").value),
    };
  }

  function buildEntryItem(entry) {
    var tpl = document.getElementById("tpl-entry-item");
    var frag = tpl.content.cloneNode(true);
    var item = frag.querySelector(".entry-item");
    item._entry = entry;
    if (entry.id) item.dataset.entryId = entry.id;
    renderEntryView(item, entry);
    fillEntryForm(item, entry);
    return item;
  }

  function enterEditMode(item) {
    fillEntryForm(item, item._entry);
    item.classList.add("is-editing");
    autoGrow(item.querySelector(".f-activity"));
    var focusEl = item.querySelector(".f-start-time");
    if (focusEl) focusEl.focus();
  }

  function exitEditMode(item) {
    item.classList.remove("is-editing");
  }

  function addDraftEntry(dayCard) {
    var entry = { id: null, start: "00:00", end: "00:00", activity: "", enjoyment: null, importance: null };
    var item = buildEntryItem(entry);
    item.classList.add("is-editing");
    dayCard.querySelector(".entries-list").appendChild(item);
    autoGrow(item.querySelector(".f-activity"));
    var focusEl = item.querySelector(".f-start-time");
    if (focusEl) focusEl.focus();
  }

  async function saveEntry(item, dayCard) {
    var dayId = dayCard.dataset.dayId;
    var payload = readEntryForm(item);
    var saveBtn = item.querySelector(".btn-save-entry");
    saveBtn.disabled = true;
    try {
      var entry;
      if (item._entry && item._entry.id) {
        entry = await api("/" + dayId + "/entries/" + item._entry.id, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        entry = await api("/" + dayId + "/entries", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        item.dataset.entryId = entry.id;
      }
      item._entry = entry;
      renderEntryView(item, entry);
      exitEditMode(item);
      updateDayStats(dayCard);
    } catch (err) {
      alert("No se pudo guardar la actividad: " + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  function cancelEntry(item) {
    if (!item._entry || !item._entry.id) {
      item.remove();
      return;
    }
    fillEntryForm(item, item._entry);
    exitEditMode(item);
  }

  async function deleteEntry(item, dayCard) {
    var entry = item._entry;
    if (!entry || !entry.id) {
      item.remove();
      return;
    }
    var dayId = dayCard.dataset.dayId;
    try {
      await api("/" + dayId + "/entries/" + entry.id, { method: "DELETE" });
      item.remove();
      updateDayStats(dayCard);
    } catch (err) {
      alert("No se pudo eliminar la actividad: " + err.message);
    }
  }

  // ---- Day card ----

  function buildDayCard(day) {
    var tpl = document.getElementById("tpl-day-card");
    var frag = tpl.content.cloneNode(true);
    var card = frag.querySelector(".day-card");
    card.dataset.dayId = day.id;
    card.querySelector(".day-date").textContent = formatDate(day.date);
    var list = card.querySelector(".entries-list");
    (day.entries || []).forEach(function (entry) {
      list.appendChild(buildEntryItem(entry));
    });
    var reflectionEl = card.querySelector(".reflection-text");
    reflectionEl.textContent = day.reflection || "";
    updateDayStats(card);
    return card;
  }

  function renderDays(days) {
    daysContainer.innerHTML = "";
    var sorted = days.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    sorted.forEach(function (day) {
      daysContainer.appendChild(buildDayCard(day));
    });
  }

  async function loadDays() {
    try {
      var days = await api("", { method: "GET" });
      renderDays(days);
    } catch (err) {
      alert("No se pudieron cargar los datos: " + err.message);
    }
  }

  function findDayCardByDayId(dayId) {
    return daysContainer.querySelector('.day-card[data-day-id="' + dayId + '"]');
  }

  function highlightCard(card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    var original = card.style.boxShadow;
    card.style.boxShadow = "0 0 0 3px var(--accent)";
    setTimeout(function () { card.style.boxShadow = original; }, 900);
  }

  async function addNewDay() {
    var today = todayISO();
    try {
      var day = await api("", {
        method: "POST",
        body: JSON.stringify({ date: today }),
      });
      var card = findDayCardByDayId(day.id);
      if (card) {
        highlightCard(card);
        return;
      }
      var newCard = buildDayCard(day);
      daysContainer.insertBefore(newCard, daysContainer.firstChild);
      addDraftEntry(newCard);
    } catch (err) {
      alert("No se pudo crear el día: " + err.message);
    }
  }

  async function deleteDay(dayCard) {
    var dayId = dayCard.dataset.dayId;
    if (!confirm("¿Eliminar este día completo, con todas sus actividades y la reflexión?")) return;
    try {
      await api("/" + dayId, { method: "DELETE" });
      dayCard.remove();
    } catch (err) {
      alert("No se pudo eliminar el día: " + err.message);
    }
  }

  function saveReflection(dayCard, text) {
    var dayId = dayCard.dataset.dayId;
    api("/" + dayId + "/reflection", {
      method: "PUT",
      body: JSON.stringify({ reflection: text }),
    }).catch(function (err) {
      alert("No se pudo guardar la reflexión: " + err.message);
    });
  }

  // ---- Delegacion de eventos ----

  document.addEventListener("click", function (e) {
    if (e.target.closest("#btn-new-day")) {
      addNewDay();
      return;
    }

    var addEntryBtn = e.target.closest('[data-action="add-entry"]');
    if (addEntryBtn) {
      var dc1 = addEntryBtn.closest(".day-card");
      if (dc1) addDraftEntry(dc1);
      return;
    }

    var editBtn = e.target.closest('[data-action="edit-entry"]');
    if (editBtn) {
      var item1 = editBtn.closest(".entry-item");
      if (item1) enterEditMode(item1);
      return;
    }

    var saveBtn = e.target.closest('[data-action="save-entry"]');
    if (saveBtn) {
      var item2 = saveBtn.closest(".entry-item");
      var dc2 = saveBtn.closest(".day-card");
      if (item2 && dc2) saveEntry(item2, dc2);
      return;
    }

    var cancelBtn = e.target.closest('[data-action="cancel-entry"]');
    if (cancelBtn) {
      var item3 = cancelBtn.closest(".entry-item");
      if (item3) cancelEntry(item3);
      return;
    }

    var delEntryBtn = e.target.closest('[data-action="del-entry"]');
    if (delEntryBtn) {
      var item4 = delEntryBtn.closest(".entry-item");
      var dc4 = delEntryBtn.closest(".day-card");
      if (item4 && dc4) deleteEntry(item4, dc4);
      return;
    }

    var delDayBtn = e.target.closest('[data-action="del-day"]');
    if (delDayBtn) {
      var dc5 = delDayBtn.closest(".day-card");
      if (dc5) deleteDay(dc5);
      return;
    }
  });

  document.addEventListener("input", function (e) {
    var target = e.target;
    if (target.classList.contains("f-activity")) {
      autoGrow(target);
      return;
    }
    if (target.classList.contains("f-enjoy") || target.classList.contains("f-importance")) {
      updateScoreBar(target);
      return;
    }
    if (target.classList.contains("reflection-text")) {
      var dayCard = target.closest(".day-card");
      if (!dayCard) return;
      var text = target.textContent;
      var refKey = dayCard.dataset.dayId + ":reflection";
      debounce(refKey, function () {
        saveReflection(dayCard, text);
      }, 1000);
    }
  });

  document.addEventListener(
    "blur",
    function (e) {
      if (
        e.target.classList &&
        (e.target.classList.contains("f-enjoy") || e.target.classList.contains("f-importance"))
      ) {
        clampScoreInput(e.target);
        updateScoreBar(e.target);
      }
    },
    true
  );

  loadDays();
})();
