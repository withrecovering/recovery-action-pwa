(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const RECORDS_KEY = "recovery_v29_records";
  const ACTIVE_KEY = "recovery_v29_active";
  const OPTIONS_KEY = "recovery_v29_options";

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const defaultOptions = {
    states: ["초록불", "노란불", "빨간불"],
    emotions: ["괜찮음", "무기력", "불안", "답답함", "공허함", "피곤함", "차분함"],
    values: ["공부", "몸 돌봄", "회복", "휴식", "자립", "연결", "공공성", "창작", "운동", "가사", "명상", "식사", "딴짓"],
    reasons: ["충분히 함", "집중 끊김", "피로", "잠듦/놓침", "다음 행동으로 전환", "여기까지"],
    sensations: ["조금 정돈됨", "별 느낌 없음", "조금 가벼움", "더 피곤함", "약간 안정됨", "답답함"],
    presets: [
      { action: "교재 읽기" },
      { action: "딴짓" },
      { action: "눈 감고 쉬기" },
      { action: "식사하기" },
      { action: "걷기" },
      { action: "정리하기" }
    ]
  };

  let options = loadOptions();
  let records = loadRecords();
  let activeSession = loadActive();
  let pendingEnd = null;
  let timerInterval = null;
  let selectedState = options.states[0] || "초록불";
  let selectedEmotions = [];
  let selectedValues = [];
  let selectedReason = "";
  let selectedSensation = "";
  let selectedDateKey = todayKey();
  let selectedMonthKey = todayKey().slice(0, 7);

  const valuePalette = [
    "#2563eb", "#16a34a", "#0f766e", "#7c3aed", "#be185d", "#db2777",
    "#0891b2", "#ea580c", "#dc2626", "#64748b", "#4f46e5", "#65a30d",
    "#9333ea", "#ca8a04", "#0284c7"
  ];

  const fixedValueColors = {
    "공부": "#2563eb",
    "몸 돌봄": "#16a34a",
    "회복": "#0f766e",
    "휴식": "#7c3aed",
    "자립": "#be185d",
    "연결": "#db2777",
    "공공성": "#0891b2",
    "창작": "#ea580c",
    "운동": "#dc2626",
    "가사": "#64748b",
    "명상": "#4f46e5",
    "식사": "#65a30d",
    "딴짓": "#475569"
  };

  function loadOptions() {
    try {
      const raw = localStorage.getItem(OPTIONS_KEY);
      if (!raw) return deepClone(defaultOptions);
      return { ...deepClone(defaultOptions), ...JSON.parse(raw) };
    } catch {
      return deepClone(defaultOptions);
    }
  }

  function saveOptions() {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  }

  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }

  function loadActive() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveActive() {
    if (activeSession) localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeSession));
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function monthKey(date = new Date()) {
    return todayKey(date).slice(0, 7);
  }

  function parseDateKey(iso) {
    return todayKey(new Date(iso));
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function formatDurationShort(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${r}초`;
    return `${r}초`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uid() {
    return `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function minutesSinceMidnight(iso) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }

  function valueColor(value) {
    if (fixedValueColors[value]) return fixedValueColors[value];
    let hash = 0;
    for (const ch of String(value || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return valuePalette[hash % valuePalette.length];
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.add("hidden"), 1800);
  }

  function switchTab(tab) {
    window.recoveryAppSwitchTab = switchTab;
    document.querySelectorAll(".tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
      button.disabled = false;
      button.setAttribute("aria-disabled", "false");
    });

    ["start", "today", "trophy", "calendar", "records", "settings"].forEach((name) => {
      $(`${name}Tab`).classList.toggle("hidden", name !== tab);
    });

    if (tab === "today") renderToday();
    if (tab === "trophy") renderTrophy();
    if (tab === "calendar") renderCalendar();
    if (tab === "records") renderRecords();
    if (tab === "settings") renderSettings();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderChips(containerId, items, selected, onClick, multi = false) {
    const container = $(containerId);
    container.innerHTML = "";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = item;
      const isSelected = multi ? selected.includes(item) : selected === item;
      button.classList.toggle("selected", isSelected);
      button.addEventListener("click", () => onClick(item));
      container.appendChild(button);
    });
  }

  function renderStartControls() {
    renderChips("stateChips", options.states, selectedState, (item) => {
      selectedState = item;
      renderStartControls();
    });

    renderChips("emotionChips", options.emotions, selectedEmotions, (item) => {
      selectedEmotions = selectSingleArrayItem(selectedEmotions, item);
      renderStartControls();
    }, true);

    renderChips("valueChips", options.values, selectedValues, (item) => {
      selectedValues = selectSingleArrayItem(selectedValues, item);
      renderStartControls();
    }, true);

    const presets = $("presetChips");
    presets.innerHTML = "";
    options.presets.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = preset.action;
      button.addEventListener("click", () => {
        $("actionText").value = preset.action;
        // 빠른 시작 프리셋은 행동만 채웁니다. 가치는 현재 맥락에서 따로 선택합니다.
        renderStartControls();
      });
      presets.appendChild(button);
    });
  }

  function toggleItem(list, item) {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  function selectSingleArrayItem(list, item) {
    return list.includes(item) ? [] : [item];
  }

  function showIdleView() {
    $("idleView").classList.remove("hidden");
    $("activeView").classList.add("hidden");
    $("finishView").classList.add("hidden");
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function showActiveView() {
    $("idleView").classList.add("hidden");
    $("activeView").classList.remove("hidden");
    $("finishView").classList.add("hidden");
    updateActiveView();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateActiveView, 1000);
  }

  function showFinishView() {
    $("idleView").classList.add("hidden");
    $("activeView").classList.add("hidden");
    $("finishView").classList.remove("hidden");
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    renderFinishControls();
  }

  function updateActiveView() {
    if (!activeSession) return;
    const elapsed = Math.floor((Date.now() - activeSession.startMs) / 1000);
    $("activeAction").textContent = activeSession.actionText;
    $("timer").textContent = formatDuration(elapsed);
    $("activeMeta").textContent = `시작: ${formatDateTime(activeSession.startAt)} · 상태: ${activeSession.stateBefore}`;
  }

  function startSession() {
    const actionText = $("actionText").value.trim();
    if (!actionText) {
      showToast("작은 행동을 입력해주세요");
      return;
    }

    const start = new Date();
    activeSession = {
      id: uid(),
      startAt: start.toISOString(),
      startMs: start.getTime(),
      stateBefore: selectedState,
      emotionsBefore: [...selectedEmotions],
      actionText,
      values: [...selectedValues],
      createdAt: nowIso()
    };
    saveActive();
    showActiveView();
    showToast("기록이 시작되었습니다");
  }

  function endSession(endType) {
    if (!activeSession) return;
    const end = new Date();
    pendingEnd = {
      ...activeSession,
      endAt: end.toISOString(),
      endMs: end.getTime(),
      durationSec: Math.max(0, Math.floor((end.getTime() - activeSession.startMs) / 1000)),
      endType
    };
    $("finishTitle").textContent = endType;
    $("finishMeta").textContent = `${formatDurationShort(pendingEnd.durationSec)}의 기록을 마무리합니다.`;
    selectedReason = endType === "잠듦/놓침" ? "잠듦/놓침" : "";
    selectedSensation = "";
    showFinishView();
  }

  function renderFinishControls() {
    renderChips("reasonChips", options.reasons, selectedReason, (item) => {
      selectedReason = item;
      renderFinishControls();
    });

    renderChips("sensationChips", options.sensations, selectedSensation, (item) => {
      selectedSensation = item;
      renderFinishControls();
    });
  }

  function savePendingRecord(afterSave = "today") {
    if (!pendingEnd) return;

    const record = {
      ...pendingEnd,
      dateKey: parseDateKey(pendingEnd.startAt),
      startMinute: minutesSinceMidnight(pendingEnd.startAt),
      endMinute: minutesSinceMidnight(pendingEnd.endAt),
      stopReason: selectedReason,
      sensationAfter: selectedSensation
    };

    records.unshift(record);
    saveRecords();

    activeSession = null;
    pendingEnd = null;
    saveActive();

    $("actionText").value = "";
    selectedEmotions = [];
    selectedValues = [];

    showIdleView();
    renderAll();

    if (afterSave === "start") {
      switchTab("start");
      showToast("저장했습니다. 다음 행동을 준비해볼 수 있습니다");
    } else {
      switchTab("today");
      showToast("회복 기록이 저장되었습니다");
    }
  }

  function backToActive() {
    if (!activeSession) {
      showIdleView();
      return;
    }
    pendingEnd = null;
    showActiveView();
  }

  function getLongRecordBadge(record) {
    const durationSec = Number(record?.durationSec || 0);
    if (durationSec >= 6 * 60 * 60) {
      return `<span class="badge long-record-badge likely-missed-end">종료 놓침 가능성</span>`;
    }
    if (durationSec >= 2 * 60 * 60) {
      return `<span class="badge long-record-badge check-needed">확인 필요</span>`;
    }
    return "";
  }

  function stateBadgeClass(state) {
    if (state === "초록불") return "green";
    if (state === "노란불") return "yellow";
    if (state === "빨간불") return "red";
    return "";
  }

  function renderToday() {
    const today = selectedDateKey || todayKey();
    const todayRecords = records.filter((r) => r.dateKey === today || parseDateKey(r.startAt) === today);
    renderDayBar(todayRecords);
    renderTimeline(todayRecords);
  }

  function renderDayBar(dayRecords) {
    const bar = $("dayBar");
    const axis = $("dayBarAxis");
    bar.innerHTML = "";
    if (axis) axis.innerHTML = "";
    const legendValues = new Set();

    for (let hour = 0; hour <= 24; hour += 3) {
      const line = document.createElement("div");
      line.className = "day-hour-grid";
      line.style.left = `${(hour / 24) * 100}%`;
      bar.appendChild(line);

      if (axis) {
        const tick = document.createElement("span");
        tick.className = "day-hour-label";
        tick.style.left = `${(hour / 24) * 100}%`;
        tick.textContent = String(hour);
        axis.appendChild(tick);
      }
    }

    dayRecords.forEach((record) => {
      const start = Math.max(0, Math.min(1440, record.startMinute ?? minutesSinceMidnight(record.startAt)));
      const end = Math.max(start + 1, Math.min(1440, record.endMinute ?? minutesSinceMidnight(record.endAt)));
      const value = (record.values && record.values[0]) || "기록";
      legendValues.add(value);

      const segment = document.createElement("div");
      segment.className = "day-segment";
      segment.style.left = `${(start / 1440) * 100}%`;
      segment.style.width = `${Math.max(0.3, ((end - start) / 1440) * 100)}%`;
      segment.style.background = valueColor(value);
      segment.title = `${record.actionText} · ${formatDurationShort(record.durationSec)}`;
      bar.appendChild(segment);
    });

    const legend = $("valueLegend");
    legend.innerHTML = "";
    [...legendValues].forEach((value) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-dot" style="background:${valueColor(value)}"></span>${escapeHtml(value)}`;
      legend.appendChild(item);
    });

    if (dayRecords.length === 0) {
      legend.innerHTML = `<span class="small">아직 오늘 기록이 없습니다.</span>`;
    }
  }

  function renderTimeline(dayRecords) {
    const timeline = $("todayTimeline");
    timeline.innerHTML = "";
    if (dayRecords.length === 0) {
      timeline.innerHTML = `<div class="empty">아직 기록이 없습니다.</div>`;
      return;
    }

    [...dayRecords].reverse().forEach((record) => {
      const value = (record.values && record.values[0]) || "기록";
      const item = document.createElement("div");
      item.className = "timeline-item";
      item.style.borderLeft = `8px solid ${valueColor(value)}`;
      item.innerHTML = `
        <div class="timeline-title">${escapeHtml(record.actionText)}</div>
        <div>${renderBadges(record)}</div>
        <div class="meta">${formatDateTime(record.startAt)} → ${formatDateTime(record.endAt)}</div>
      `;
      timeline.appendChild(item);
    });
  }

  function renderBadges(record) {
    const endMissedClass = record.endType === "잠듦/놓침" ? "end-type-missed" : "";
    const corrected = record.correctionType === "end_time_adjusted"
      ? `<span class="badge end-time-adjusted">종료 시간 정정됨</span>`
      : "";
    return `
      <span class="badge ${stateBadgeClass(record.stateBefore)}">${escapeHtml(record.stateBefore || "상태 없음")}</span>
      <span class="badge ${endMissedClass}">${escapeHtml(record.endType || "여기까지")}</span>
      <span class="badge">${formatDurationShort(record.durationSec)}</span>
      ${getLongRecordBadge(record)}
      ${corrected}
    `;
  }

  function renderTrophy() {
    const today = todayKey();
    const todayRecords = records.filter((r) => r.dateKey === today || parseDateKey(r.startAt) === today);
    const totalSec = todayRecords.reduce((sum, r) => sum + Number(r.durationSec || 0), 0);
    const values = countBy(todayRecords.flatMap((r) => r.values || []));
    const actions = countBy(todayRecords.map((r) => r.actionText));

    $("trophySummary").innerHTML = todayRecords.length
      ? `<p><strong>${todayRecords.length}개</strong>의 현실 접촉 기록이 남았습니다.</p><p>총 기록 시간은 <strong>${formatDurationShort(totalSec)}</strong>입니다.</p>`
      : `<div class="empty">오늘의 기록이 아직 없습니다.</div>`;

    $("rewardSummary").innerHTML = todayRecords.length
      ? `<p>오늘은 ${formatDurationShort(totalSec)}만큼 행동을 시작하고 닫았습니다.</p>`
      : `<p class="small">작은 기록 하나부터 시작할 수 있습니다.</p>`;

    $("centerAction").innerHTML = topEntry(actions)
      ? `<p><strong>${escapeHtml(topEntry(actions)[0])}</strong> 행동이 가장 자주 등장했습니다.</p>`
      : `<p class="small">아직 중심 행동이 없습니다.</p>`;

    $("valueSummary").innerHTML = topEntry(values)
      ? Object.entries(values).map(([value, count]) => `<span class="badge" style="border-color:${valueColor(value)}">${escapeHtml(value)} ${count}</span>`).join("")
      : `<p class="small">아직 살아난 가치 기록이 없습니다.</p>`;
  }

  function countBy(items) {
    return items.filter(Boolean).reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  }

  function topEntry(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
  }

  function renderCalendar() {
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const title = `${year}년 ${month}월`;
    $("monthTitle").textContent = title;

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const startDay = first.getDay();
    const totalDays = last.getDate();
    const calendar = $("monthCalendar");
    calendar.innerHTML = "";

    ["일", "월", "화", "수", "목", "금", "토"].forEach((day) => {
      const head = document.createElement("div");
      head.className = "cal-head";
      head.textContent = day;
      calendar.appendChild(head);
    });

    for (let i = 0; i < startDay; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-day";
      calendar.appendChild(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRecords = records.filter((r) => r.dateKey === key || parseDateKey(r.startAt) === key);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-day";
      cell.classList.toggle("has", dayRecords.length > 0);
      cell.classList.toggle("selected", key === selectedDateKey);
      cell.innerHTML = `<div>${day}</div>${dayRecords.length ? `<div class="cal-dots">●${dayRecords.length}</div>` : ""}`;
      cell.addEventListener("click", () => {
        selectedDateKey = key;
        renderCalendar();
      });
      calendar.appendChild(cell);
    }

    renderSelectedDateRecords();
  }

  function renderSelectedDateRecords() {
    $("selectedDateTitle").textContent = selectedDateKey;
    const list = $("selectedDateRecords");
    const dayRecords = records.filter((r) => r.dateKey === selectedDateKey || parseDateKey(r.startAt) === selectedDateKey);
    if (dayRecords.length === 0) {
      list.innerHTML = `<div class="empty">이 날짜에는 기록이 없습니다.</div>`;
      return;
    }
    list.innerHTML = dayRecords.map((record) => `
      <div class="record">
        <div class="record-title">${escapeHtml(record.actionText)}</div>
        <div>${renderBadges(record)}</div>
        <div class="meta">${formatDateTime(record.startAt)} → ${formatDateTime(record.endAt)}</div>
      </div>
    `).join("");
  }

  function renderRecords() {
    const list = $("recordsList");
    list.innerHTML = "";
    if (records.length === 0) {
      list.innerHTML = `<div class="empty">아직 기록이 없습니다.</div>`;
      return;
    }

    records.forEach((record) => {
      const item = document.createElement("div");
      item.className = "record";
      const missedButton = record.endType === "잠듦/놓침" ? "" : `<button class="btn secondary mark-missed" type="button">잠듦/놓침 표시</button>`;
      item.innerHTML = `
        <div class="record-title">${escapeHtml(record.actionText)}</div>
        <div>${renderBadges(record)}</div>
        <div class="meta">
          시작: ${formatDateTime(record.startAt)}<br />
          끝: ${formatDateTime(record.endAt)}<br />
          감정: ${(record.emotionsBefore || []).map(escapeHtml).join(", ") || "기록 없음"}<br />
          가치: ${(record.values || []).map(escapeHtml).join(", ") || "기록 없음"}<br />
          이유: ${escapeHtml(record.stopReason || "기록 없음")} · 감각: ${escapeHtml(record.sensationAfter || "기록 없음")}
        </div>
        <div class="record-actions">
          <button class="btn secondary edit-end-time" type="button">종료 시간 수정</button>
          ${missedButton}
          <button class="btn danger delete-record" type="button">삭제</button>
        </div>
      `;
      item.querySelector(".edit-end-time").addEventListener("click", () => updateRecordEndTime(record.id));
      const missed = item.querySelector(".mark-missed");
      if (missed) missed.addEventListener("click", () => markRecordAsMissedEnd(record.id));
      item.querySelector(".delete-record").addEventListener("click", () => deleteRecord(record.id));
      list.appendChild(item);
    });
  }

  function markRecordAsMissedEnd(id) {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    if (!confirm("이 기록을 ‘잠듦/놓침’으로 표시할까요?")) return;
    record.endType = "잠듦/놓침";
    saveRecords();
    renderAll();
    showToast("잠듦/놓침으로 표시했습니다");
  }

  function updateRecordEndTime(id) {
    const record = records.find((r) => r.id === id);
    if (!record) return;

    const current = formatTimeForPrompt(record.endAt);
    const input = prompt("새 종료 시간을 입력해주세요.\n예: 14:30 또는 2026-05-17 14:30", current);
    if (input === null) return;

    const newEnd = parseEndTimeInput(input, record.startAt);
    if (!newEnd) {
      showToast("시간 형식을 확인해주세요");
      return;
    }

    const start = new Date(record.startAt);
    if (newEnd < start) {
      showToast("종료 시간은 시작 시간보다 뒤여야 합니다");
      return;
    }

    record.endAt = newEnd.toISOString();
    record.endMs = newEnd.getTime();
    record.durationSec = Math.max(0, Math.floor((newEnd.getTime() - start.getTime()) / 1000));
    record.endMinute = minutesSinceMidnight(record.endAt);
    record.correctionType = "end_time_adjusted";
    record.correctedAt = nowIso();

    saveRecords();
    renderAll();
    showToast("종료 시간을 수정했습니다");
  }

  function formatTimeForPrompt(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function parseEndTimeInput(input, startIso) {
    const text = String(input || "").trim();
    const start = new Date(startIso);
    if (!text || Number.isNaN(start.getTime())) return null;

    const timeOnly = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnly) {
      const h = Number(timeOnly[1]);
      const m = Number(timeOnly[2]);
      const s = Number(timeOnly[3] || 0);
      if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
      const d = new Date(start);
      d.setHours(h, m, s, 0);
      return d;
    }

    const parsed = new Date(text.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function deleteRecord(id) {
    if (!confirm("이 기록을 삭제할까요?")) return;
    records = records.filter((r) => r.id !== id);
    saveRecords();
    renderAll();
    showToast("기록을 삭제했습니다");
  }


  function editOptionItem(key, index) {
    const current = options[key] && options[key][index];
    if (!current) return;

    const next = prompt("새 이름을 입력해주세요.", current);
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) {
      showToast("빈 이름으로는 수정할 수 없습니다");
      return;
    }

    const duplicateIndex = options[key].findIndex((item, itemIndex) => item === trimmed && itemIndex !== index);
    if (duplicateIndex >= 0) {
      showToast("이미 있는 항목입니다");
      return;
    }

    options[key][index] = trimmed;

    if (key === "emotions") {
      selectedEmotions = selectedEmotions.map((item) => item === current ? trimmed : item);
    }

    if (key === "values") {
      selectedValues = selectedValues.map((item) => item === current ? trimmed : item);
}

    if (key === "reasons" && selectedReason === current) selectedReason = trimmed;
    if (key === "sensations" && selectedSensation === current) selectedSensation = trimmed;

    saveOptions();
    renderAll();
    showToast("항목을 수정했습니다");
  }

  function editPresetItem(index) {
    const preset = options.presets[index];
    if (!preset) return;

    const currentAction = preset.action || "";
    const nextAction = prompt("프리셋 행동명을 수정해주세요.", currentAction);
    if (nextAction === null) return;

    const action = nextAction.trim();
    if (!action) {
      showToast("행동명은 비워둘 수 없습니다");
      return;
    }

    options.presets[index] = { action };

    saveOptions();
    renderAll();
    showToast("프리셋을 수정했습니다");
  }


  function renderSettings() {
    renderManageList("manageEmotions", options.emotions, "emotions");
    renderManageList("manageValues", options.values, "values");
    renderManageList("manageReasons", options.reasons, "reasons");
    renderManageList("manageSensations", options.sensations, "sensations");
    renderPresetManager();
  }

  function renderManageList(containerId, list, key) {
    const container = $(containerId);
    container.innerHTML = "";
    list.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "manage-row";
      row.innerHTML = `
        <span>${escapeHtml(item)}</span>
        <span class="manage-actions">
          <button class="btn secondary small-btn edit-option" type="button">수정</button>
          <button class="btn danger small-btn delete-option" type="button">삭제</button>
        </span>
      `;

      row.querySelector(".edit-option").addEventListener("click", () => {
        editOptionItem(key, index);
      });

      row.querySelector(".delete-option").addEventListener("click", () => {
        options[key] = options[key].filter((_, itemIndex) => itemIndex !== index);

        if (key === "emotions") selectedEmotions = selectedEmotions.filter((selected) => selected !== item);
        if (key === "values") selectedValues = selectedValues.filter((selected) => selected !== item);
        if (key === "reasons" && selectedReason === item) selectedReason = "";
        if (key === "sensations" && selectedSensation === item) selectedSensation = "";

        saveOptions();
        renderAll();
        showToast("항목을 삭제했습니다");
      });

      container.appendChild(row);
    });
  }

  function renderPresetManager() {
    const container = $("managePresets");
    container.innerHTML = "";
    options.presets.forEach((preset, index) => {
      const row = document.createElement("div");
      row.className = "manage-row";
      row.innerHTML = `
        <span>${escapeHtml(preset.action)}</span>
        <span class="manage-actions">
          <button class="btn secondary small-btn edit-preset" type="button">수정</button>
          <button class="btn danger small-btn delete-preset" type="button">삭제</button>
        </span>
      `;

      row.querySelector(".edit-preset").addEventListener("click", () => {
        editPresetItem(index);
      });

      row.querySelector(".delete-preset").addEventListener("click", () => {
        options.presets.splice(index, 1);
        saveOptions();
        renderAll();
        showToast("프리셋을 삭제했습니다");
      });

      container.appendChild(row);
    });
  }

  function addOption(inputId, key) {
    const input = $(inputId);
    const value = input.value.trim();
    if (!value) return;
    if (!options[key].includes(value)) options[key].push(value);
    input.value = "";
    saveOptions();
    renderAll();
  }

  function addPreset() {
    const action = $("newPresetActionInput").value.trim();
    if (!action) {
      showToast("행동명을 입력해주세요");
      return;
    }
    options.presets.push({ action });
    $("newPresetActionInput").value = "";
    saveOptions();
    renderAll();
  }

  function exportJson() {
    const payload = {
      exportedAt: nowIso(),
      version: "v29.1-runtime-cache-safe",
      records,
      options
    };
    downloadFile(`recovery-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    $("backupStatus").textContent = "JSON 백업을 내보냈습니다.";
  }

  function exportCsv() {
    const headers = [
      "id", "date", "startAt", "endAt", "durationSec", "durationText",
      "stateBefore", "emotionsBefore", "actionText", "values", "primaryValue",
      "endType", "stopReason", "sensationAfter", "correctionType", "correctedAt", "createdAt"
    ];
    const rows = records.map((r) => [
      r.id, r.dateKey || parseDateKey(r.startAt), r.startAt, r.endAt, r.durationSec, formatDurationShort(r.durationSec),
      r.stateBefore, (r.emotionsBefore || []).join("; "), r.actionText, (r.values || []).join("; "), (r.values || [])[0] || "",
      r.endType, r.stopReason || "", r.sensationAfter || "", r.correctionType || "", r.correctedAt || "", r.createdAt || ""
    ]);
    const csv = "\ufeff" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadFile(`recovery-records-${todayKey()}.csv`, csv, "text/csv;charset=utf-8");
    $("backupStatus").textContent = "CSV 파일을 내보냈습니다.";
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(payload.records)) records = payload.records;
        if (payload.options && typeof payload.options === "object") {
          options = { ...deepClone(defaultOptions), ...payload.options };
        }
        saveRecords();
        saveOptions();
        renderAll();
        showToast("JSON 백업을 가져왔습니다");
      } catch {
        showToast("JSON 파일을 확인해주세요");
      }
    };
    reader.readAsText(file);
  }

  function renderAll() {
    renderStartControls();
    renderToday();
    renderTrophy();
    renderCalendar();
    renderRecords();
    renderSettings();
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    $("startBtn").addEventListener("click", startSession);
    $("endPauseBtn").addEventListener("click", () => endSession("여기까지"));
    $("endCompleteBtn").addEventListener("click", () => endSession("완료"));
    $("endMissedBtn").addEventListener("click", () => endSession("잠듦/놓침"));
    $("saveRecordBtn").addEventListener("click", () => savePendingRecord("today"));
    $("saveNextBtn").addEventListener("click", () => savePendingRecord("start"));
    $("backToActiveBtn").addEventListener("click", backToActive);

    $("prevMonthBtn").addEventListener("click", () => {
      const [y, m] = selectedMonthKey.split("-").map(Number);
      selectedMonthKey = monthKey(new Date(y, m - 2, 1));
      renderCalendar();
    });

    $("nextMonthBtn").addEventListener("click", () => {
      const [y, m] = selectedMonthKey.split("-").map(Number);
      selectedMonthKey = monthKey(new Date(y, m, 1));
      renderCalendar();
    });

    $("exportJsonBtn").addEventListener("click", exportJson);
    $("exportCsvBtn").addEventListener("click", exportCsv);
    $("importJsonInput").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) importJsonFile(file);
      event.target.value = "";
    });

    $("addEmotionBtn").addEventListener("click", () => addOption("newEmotionInput", "emotions"));
    $("addValueBtn").addEventListener("click", () => addOption("newValueInput", "values"));
    $("addReasonBtn").addEventListener("click", () => addOption("newReasonInput", "reasons"));
    $("addSensationBtn").addEventListener("click", () => addOption("newSensationInput", "sensations"));
    $("addPresetBtn").addEventListener("click", addPreset);
  }

  function init() {
    bindEvents();
    renderAll();
    if (activeSession) showActiveView();
    else showIdleView();

    // Stability-first build: remove previous PWA service workers/caches so stale code does not block tab behavior.
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => registrations.forEach((registration) => registration.unregister()))
          .catch(() => {});
      }
      if ("caches" in window) {
        caches.keys()
          .then((keys) => Promise.all(keys
            .filter((key) => key.includes("minwoo") || key.includes("recovery"))
            .map((key) => caches.delete(key))))
          .catch(() => {});
      }
    } catch {
      // ignore cache cleanup failures
    }
  }

  function safeInit() {
    try {
      init();
    } catch (error) {
      console.error("Recovery app init failed:", error);
      if (window.recoveryEmergencySwitchTab) {
        window.recoveryEmergencySwitchTab("start");
      }
      showToastSafe("앱 초기화 오류가 있어 탭 fallback으로 전환했습니다");
    }
  }

  function showToastSafe(message) {
    try {
      const toast = $("toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.remove("hidden");
    } catch {
      // ignore
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }
})();
