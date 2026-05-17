// build: v22-focus-overlay-optimized; no feature changes; syntax verified
const STORAGE_KEY = "minwoo_recovery_records_v2";
    const OLD_STORAGE_KEY = "minwoo_recovery_records_v1";
    const ACTIVE_KEY = "minwoo_recovery_active_v2";
    const REFLECTION_KEY = "minwoo_daily_reflection_v1";
    const CUSTOM_EMOTION_DICT_KEY = "recovery_app_custom_emotions_v1";
    const CUSTOM_VALUE_DICT_KEY = "recovery_app_custom_values_v1";
    const CUSTOM_REASON_DICT_KEY = "recovery_app_custom_reasons_v1";
    const CUSTOM_SENSATION_DICT_KEY = "recovery_app_custom_sensations_v1";
    const QUICK_PRESET_KEY = "recovery_app_quick_presets_v1";
    const LAST_BACKUP_KEY = "recovery_last_backup_at_v1";
    const OLD_ACTIVE_KEY = "minwoo_recovery_active_v1";

    const STATES = ["초록불", "노란불", "빨간불"];
    const BASE_EMOTIONS = [];
    const BASE_VALUES = [];
    let EMOTIONS = [];
    let VALUES = [];
    const BASE_REASONS = [];
    const BASE_SENSATIONS = [];
    let REASONS = [];
    let SENSATIONS = [];
    let QUICK_PRESETS = [];

    let selectedState = "";
    let selectedEmotions = [];
    let selectedValues = [];
    let customEmotions = [];
    let customValues = [];
    let editingEmotion = "";
    let editingValue = "";
    let editingReason = "";
    let editingSensation = "";
    let editingPreset = "";
    let selectedReason = "";
    let selectedSensation = "";
    let customReasons = [];
    let customSensations = [];
    let activeSession = null;
    let pendingEnd = null;
    let timerInterval = null;
    let deferredInstallPrompt = null;
    let wakeLockSentinel = null;
    let focusOverlayEnabled = true;
    let timelineScale = Number(localStorage.getItem("minwoo_timeline_scale_v1")) || 10;
    let selectedDateKey = localStorage.getItem("recovery_selected_date_v1") || getTodayKey();
    let selectedMonthKey = localStorage.getItem("recovery_selected_month_v1") || getTodayKey().slice(0, 7);

    const $ = (id) => document.getElementById(id);

    function nowIso() {
      return new Date().toISOString();
    }

    function formatDateTime(isoOrMs) {
      const date = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).format(date);
    }

    function formatTimeOnly(isoOrMs) {
      const date = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
      return new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit", minute: "2-digit"
      }).format(date);
    }

    function formatDuration(sec) {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function formatDurationShort(sec) {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return `${h}시간 ${m}분`;
      if (m > 0) return `${m}분 ${s}초`;
      return `${s}초`;
    }

    function getTodayKey(date = new Date()) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    function parseTodayKey(iso) {
      return getTodayKey(new Date(iso));
    }

    function dateKeyToDate(dateKey) {
      return new Date(`${dateKey}T00:00:00`);
    }

    function isSelectedToday() {
      return selectedDateKey === getTodayKey();
    }

    function getSelectedDayLabel() {
      return isSelectedToday() ? "오늘" : "선택한 날짜";
    }

    function getSelectedDayShortLabel() {
      return isSelectedToday() ? "오늘" : "이날";
    }

    function formatDateKeyHuman(dateKey) {
      const date = dateKeyToDate(dateKey);
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long"
      }).format(date);
    }

    function setSelectedDate(dateKey, silent = false) {
      if (!dateKey) return;
      selectedDateKey = dateKey;
      localStorage.setItem("recovery_selected_date_v1", selectedDateKey);
      selectedMonthKey = selectedDateKey.slice(0, 7);
      localStorage.setItem("recovery_selected_month_v1", selectedMonthKey);
      updateDateControls();
      updateMonthControls();
      renderAll();
      if (!silent) showToast(`${formatDateKeyHuman(selectedDateKey)} 기록을 보고 있습니다`);
    }

    function shiftSelectedDate(days) {
      const date = dateKeyToDate(selectedDateKey);
      date.setDate(date.getDate() + days);
      setSelectedDate(getTodayKey(date));
    }

    function updateDateControls() {
      document.querySelectorAll(".selected-date-input").forEach((input) => {
        input.value = selectedDateKey;
      });
      document.querySelectorAll(".selected-date-title").forEach((el) => {
        el.textContent = formatDateKeyHuman(selectedDateKey);
      });

      const dayLabel = getSelectedDayLabel();
      const shortLabel = getSelectedDayShortLabel();

      if ($("dashboardTitle")) $("dashboardTitle").textContent = `${dayLabel}의 회복 대시보드`;
      if ($("selectedRecordListTitle")) $("selectedRecordListTitle").textContent = `${dayLabel} 기록 목록`;
      if ($("trophyKicker")) $("trophyKicker").textContent = `${dayLabel}의 회복 트로피`;
      if ($("trophySummaryTitle")) $("trophySummaryTitle").textContent = `${dayLabel}의 회복 요약`;
      if ($("trophyCenterTitle")) $("trophyCenterTitle").textContent = `${dayLabel}의 중심 행동`;
      if ($("timeBucketTitle")) $("timeBucketTitle").textContent = `${dayLabel}의 시간대 요약`;
      if ($("valueMapTitle")) $("valueMapTitle").textContent = `${shortLabel} 행동으로 살아난 가치`;
      if ($("dailyReflectionLabel")) $("dailyReflectionLabel").textContent = `${dayLabel}의 마무리 소감`;
    }


    function monthKeyToDate(monthKey) {
      return new Date(`${monthKey}-01T00:00:00`);
    }

    function getMonthKey(date = new Date()) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }

    function formatMonthKeyHuman(monthKey) {
      const date = monthKeyToDate(monthKey);
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long"
      }).format(date);
    }

    function setSelectedMonth(monthKey, silent = false) {
      if (!monthKey) return;
      selectedMonthKey = monthKey;
      localStorage.setItem("recovery_selected_month_v1", selectedMonthKey);
      updateMonthControls();
      renderAll();
      if (!silent) showToast(`${formatMonthKeyHuman(selectedMonthKey)} 달력을 보고 있습니다`);
    }

    function shiftSelectedMonth(delta) {
      const date = monthKeyToDate(selectedMonthKey);
      date.setMonth(date.getMonth() + delta);
      setSelectedMonth(getMonthKey(date));
    }

    function goThisMonth() {
      setSelectedMonth(getMonthKey(new Date()));
    }

    function syncMonthToSelectedDate() {
      selectedMonthKey = selectedDateKey.slice(0, 7);
      localStorage.setItem("recovery_selected_month_v1", selectedMonthKey);
      updateMonthControls();
    }

    function updateMonthControls() {
      if ($("selectedMonthTitle")) $("selectedMonthTitle").textContent = formatMonthKeyHuman(selectedMonthKey);
    }

    function getMonthRecords() {
      return loadRecords()
        .filter((r) => parseTodayKey(r.startAt).startsWith(selectedMonthKey))
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    }

    function summarizeRecords(records) {
      const totalSec = records.reduce((sum, r) => sum + (r.durationSec || 0), 0);
      const values = [...new Set(records.flatMap((r) => r.values || []))];
      return { totalSec, values, count: records.length };
    }


    function minutesSinceMidnight(iso) {
      const d = new Date(iso);
      return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    }

    function migrateOldStorageIfNeeded() {
      if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, localStorage.getItem(OLD_STORAGE_KEY));
      }
      if (!localStorage.getItem(ACTIVE_KEY) && localStorage.getItem(OLD_ACTIVE_KEY)) {
        localStorage.setItem(ACTIVE_KEY, localStorage.getItem(OLD_ACTIVE_KEY));
      }
    }

    function safeParseArray(key) {
      try { const parsed = JSON.parse(localStorage.getItem(key)); return Array.isArray(parsed) ? parsed : []; }
      catch { return []; }
    }
    function uniqueArray(arr) { return [...new Set(arr.map((v) => normalizeTagText(String(v))).filter(Boolean))]; }
    function loadDictionaries() {
      const storedEmotions = safeParseArray(CUSTOM_EMOTION_DICT_KEY);
      const storedValues = safeParseArray(CUSTOM_VALUE_DICT_KEY);
      const storedReasons = safeParseArray(CUSTOM_REASON_DICT_KEY);
      const storedSensations = safeParseArray(CUSTOM_SENSATION_DICT_KEY);

      EMOTIONS = uniqueArray(storedEmotions);
      VALUES = uniqueArray(storedValues);
      REASONS = uniqueArray(storedReasons);
      SENSATIONS = uniqueArray(storedSensations);
    }
    function saveCustomEmotionDictionary() {
      localStorage.setItem(CUSTOM_EMOTION_DICT_KEY, JSON.stringify(uniqueArray(EMOTIONS)));
    }
    function saveCustomValueDictionary() {
      localStorage.setItem(CUSTOM_VALUE_DICT_KEY, JSON.stringify(uniqueArray(VALUES)));
    }

    function saveCustomReasonDictionary() {
      saveArrayToStorage(CUSTOM_REASON_DICT_KEY, REASONS);
    }

    function saveCustomSensationDictionary() {
      saveArrayToStorage(CUSTOM_SENSATION_DICT_KEY, SENSATIONS);
    }


    function loadQuickPresets() {
      QUICK_PRESETS = uniqueArray(safeParseArray(QUICK_PRESET_KEY));
    }

    function saveQuickPresets() {
      localStorage.setItem(QUICK_PRESET_KEY, JSON.stringify(uniqueArray(QUICK_PRESETS || [])));
    }

    function renderQuickPresetButtons() {
      const wrap = $("quickPresetChips");
      if (!wrap) return;
      wrap.innerHTML = "";

      const presets = uniqueArray(QUICK_PRESETS || []);
      if (presets.length === 0) {
        wrap.innerHTML = `<div class="empty inline-empty">프리셋 없음</div>`;
        return;
      }

      presets.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.textContent = item;
        btn.dataset.value = item;
        btn.addEventListener("click", () => {
          const actionInput = $("actionText");
          if (actionInput) {
            actionInput.value = item;
            actionInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
          validateStartForm();
          showToast(`${item} 입력됨`);
        });
        wrap.appendChild(btn);
      });
    }

    function renderPresetDictionaryChips() {
      const wrap = $("presetDictionaryChips");
      if (!wrap) return;
      wrap.innerHTML = "";

      const presets = uniqueArray(QUICK_PRESETS || []);
      if (presets.length === 0) {
        wrap.innerHTML = `<div class="empty">아직 빠른 시작 프리셋이 없습니다.</div>`;
        return;
      }

      presets.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip selected";
        btn.classList.toggle("editing", editingPreset === item);
        btn.textContent = item;
        btn.title = "누르면 입력칸에 불러옵니다";
        btn.addEventListener("click", () => {
          editingPreset = item;
          const input = $("managePresetInput");
          if (input) {
            input.value = item;
            input.focus();
          }
          renderPresetDictionaryChips();
        });
        wrap.appendChild(btn);
      });
    }

    function savePresetItem(event) {
      if (event && event.preventDefault) event.preventDefault();

      const input = $("managePresetInput");
      if (!input) {
        showToast("프리셋 입력칸을 찾지 못했습니다");
        return false;
      }

      const value = normalizeTagText(input.value || "");
      if (!value) {
        showToast("프리셋 이름을 입력해주세요");
        input.focus();
        return false;
      }

      const current = uniqueArray(safeParseArray(QUICK_PRESET_KEY));
      let next = current.slice();

      if (editingPreset && editingPreset !== value) {
        next = next.map((item) => item === editingPreset ? value : item);
      } else if (!next.includes(value)) {
        next.push(value);
      }

      QUICK_PRESETS = uniqueArray(next);
      saveQuickPresets();

      editingPreset = "";
      input.value = "";

      renderQuickPresetButtons();
      renderPresetDictionaryChips();
      showToast("빠른 시작 프리셋이 저장되었습니다");
      return false;
    }

    function deleteSelectedPresetItem(event) {
      if (event && event.preventDefault) event.preventDefault();

      if (!editingPreset) {
        showToast("삭제할 프리셋을 먼저 선택해주세요");
        return false;
      }

      const current = uniqueArray(safeParseArray(QUICK_PRESET_KEY));
      QUICK_PRESETS = current.filter((item) => item !== editingPreset);
      saveQuickPresets();

      editingPreset = "";
      const input = $("managePresetInput");
      if (input) input.value = "";

      renderQuickPresetButtons();
      renderPresetDictionaryChips();
      showToast("프리셋이 삭제되었습니다");
      return false;
    }

    function getLastBackupAt() {
      return localStorage.getItem(LAST_BACKUP_KEY) || "";
    }

    function setLastBackupAt(iso = nowIso()) {
      localStorage.setItem(LAST_BACKUP_KEY, iso);
      renderLastBackupAt();
    }

    function renderLastBackupAt() {
      const el = $("lastBackupAt");
      if (!el) return;
      const iso = getLastBackupAt();
      el.textContent = iso ? `마지막 백업: ${formatDateTime(iso)}` : "최근 백업 없음";
    }


    function loadRecords() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
      catch { return []; }
    }

    function saveRecords(records) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function saveActive(session) {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    }


    function isValidActiveSession(session) {
      return Boolean(
        session &&
        session.startAt &&
        session.startMs &&
        session.actionText &&
        Array.isArray(session.values)
      );
    }

    function loadActive() {
      try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); }
      catch { return null; }
    }

    function clearActive() {
      localStorage.removeItem(ACTIVE_KEY);
    }

    function showToast(message) {
      const toast = $("toast");
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 1800);
    }

    function makeChips(containerId, items, onChange, chipClass = "") {
      const container = $(containerId);
      container.innerHTML = "";
      items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `chip ${chipClass}`;
        button.textContent = item;
        button.dataset.value = item;
        button.addEventListener("click", () => onChange(item));
        container.appendChild(button);
      });
    }

    function updateChipSelection(containerId, selected) {
      const container = $(containerId);
      [...container.children].forEach((child) => {
        const value = child.dataset.value;
        const isSelected = Array.isArray(selected) ? selected.includes(value) : selected === value;
        child.classList.toggle("selected", isSelected);
      });
    }

    function updateSingleChipSelection(containerId, selectedValue) {
      const container = $(containerId);
      if (!container) return;
      [...container.children].forEach((child) => {
        const value = child.dataset.value;
        const isSelected = Boolean(selectedValue && value === selectedValue);
        child.classList.toggle("selected", isSelected);
        child.classList.toggle("single-selected", isSelected);
      });
    }

    function saveArrayToStorage(key, arr) {
      localStorage.setItem(key, JSON.stringify(uniqueArray(arr || [])));
    }

    function normalizeTagText(text) {
      return text.trim().replace(/\s+/g, " ");
    }

    function addUniqueTag(targetArrayName, value) {
      const tag = normalizeTagText(value);
      if (!tag) return false;

      if (targetArrayName === "emotion") {
        if (!selectedEmotions.includes(tag)) selectedEmotions.push(tag);
        if (!EMOTIONS.includes(tag)) {
          EMOTIONS.push(tag);
          saveCustomEmotionDictionary();
        }
        if (!customEmotions.includes(tag)) customEmotions.push(tag);
        renderEmotionChips();
        renderCustomEmotionChips();
        renderDictionaries();
        updateChipSelection("emotionChips", selectedEmotions);
        return true;
      }

      if (targetArrayName === "value") {
        if (!selectedValues.includes(tag)) selectedValues.push(tag);
        if (!VALUES.includes(tag)) {
          VALUES.push(tag);
          saveCustomValueDictionary();
        }
        if (!customValues.includes(tag)) customValues.push(tag);
        renderValueChips();
        renderCustomValueChips();
        renderDictionaries();
        updateChipSelection("valueChips", selectedValues);
        validateStartForm();
        return true;
      }

      if (targetArrayName === "reason") {
        selectedReason = tag;
        if (!REASONS.includes(tag)) {
          REASONS.push(tag);
          saveCustomReasonDictionary();
        }
        if (!customReasons.includes(tag)) customReasons.push(tag);
        renderReasonChips();
        renderCustomReasonChips();
        renderDictionaries();
        updateChipSelection("reasonChips", selectedReason);
        return true;
      }

      if (targetArrayName === "sensation") {
        selectedSensation = tag;
        if (!SENSATIONS.includes(tag)) {
          SENSATIONS.push(tag);
          saveCustomSensationDictionary();
        }
        if (!customSensations.includes(tag)) customSensations.push(tag);
        renderSensationChips();
        renderCustomSensationChips();
        renderDictionaries();
        updateChipSelection("sensationChips", selectedSensation);
        return true;
      }

      return false;
    }

    function removeCustomEmotion(value) {
      selectedEmotions = selectedEmotions.filter((v) => v !== value);
      customEmotions = customEmotions.filter((v) => v !== value);
      renderCustomEmotionChips();
      updateChipSelection("emotionChips", selectedEmotions);
    }

    function removeCustomValue(value) {
      selectedValues = selectedValues.filter((v) => v !== value);
      customValues = customValues.filter((v) => v !== value);
      renderCustomValueChips();
      updateChipSelection("valueChips", selectedValues);
      validateStartForm();
    }

    function renderCustomEmotionChips() {
      const container = $("customEmotionChips");
      if (!container) return;
      container.innerHTML = "";
      customEmotions.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip selected";
        button.textContent = item;
        button.dataset.value = item;
        button.title = "누르면 제거됩니다";
        button.addEventListener("click", () => removeCustomEmotion(item));
        container.appendChild(button);
      });
    }

    function renderCustomValueChips() {
      const container = $("customValueChips");
      if (!container) return;
      container.innerHTML = "";
      customValues.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip selected";
        button.textContent = item;
        button.dataset.value = item;
        button.title = "누르면 제거됩니다";
        button.addEventListener("click", () => removeCustomValue(item));
        container.appendChild(button);
      });
    }

    function addCustomEmotionFromInput() {
      const input = $("customEmotionInput");
      if (!input) return;
      const ok = addUniqueTag("emotion", input.value);
      if (ok) {
        input.value = "";
        showToast("직접 감정이 추가되었습니다");
      }
    }

    function addCustomValueFromInput() {
      const input = $("customValueInput");
      if (!input) return;
      const ok = addUniqueTag("value", input.value);
      if (ok) {
        input.value = "";
        showToast("직접 가치가 추가되었습니다");
      }
    }

    function addCustomReasonFromInput() {
      const input = $("customReasonInput");
      if (!input) return;
      const tag = normalizeTagText(input.value);
      if (!tag) return;

      selectedReason = tag;
      if (!REASONS.includes(tag)) {
        REASONS.push(tag);
        saveCustomReasonDictionary();
      }

      input.value = "";
      renderReasonChips();
      renderDictionaries();
      updateSingleChipSelection("reasonChips", selectedReason);
      showToast("멈춤/끝냄 이유가 추가되었습니다");
    }

    function addCustomSensationFromInput() {
      const input = $("customSensationInput");
      if (!input) return;
      const tag = normalizeTagText(input.value);
      if (!tag) return;

      selectedSensation = tag;
      if (!SENSATIONS.includes(tag)) {
        SENSATIONS.push(tag);
        saveCustomSensationDictionary();
      }

      input.value = "";
      renderSensationChips();
      renderDictionaries();
      updateSingleChipSelection("sensationChips", selectedSensation);
      showToast("행동 후 감각이 추가되었습니다");
    }

    function renderReasonChips() {
      const container = $("reasonChips");
      if (!container) return;
      container.innerHTML = "";

      if (!REASONS || REASONS.length === 0) {
        container.innerHTML = `<div class="empty inline-empty">선택지 없음</div>`;
        return;
      }

      REASONS.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip";
        button.textContent = item;
        button.dataset.value = item;
        button.addEventListener("click", () => {
          selectedReason = selectedReason === item ? "" : item;
          updateSingleChipSelection("reasonChips", selectedReason);
        });
        container.appendChild(button);
      });

      updateSingleChipSelection("reasonChips", selectedReason);
    }

    function renderSensationChips() {
      const container = $("sensationChips");
      if (!container) return;
      container.innerHTML = "";

      if (!SENSATIONS || SENSATIONS.length === 0) {
        container.innerHTML = `<div class="empty inline-empty">선택지 없음</div>`;
        return;
      }

      SENSATIONS.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip";
        button.textContent = item;
        button.dataset.value = item;
        button.addEventListener("click", () => {
          selectedSensation = selectedSensation === item ? "" : item;
          updateSingleChipSelection("sensationChips", selectedSensation);
        });
        container.appendChild(button);
      });

      updateSingleChipSelection("sensationChips", selectedSensation);
    }

    function renderCustomReasonChips() {
      const container = $("customReasonChips");
      if (container) container.innerHTML = "";
    }

    function renderCustomSensationChips() {
      const container = $("customSensationChips");
      if (container) container.innerHTML = "";
    }

    function removeDictionaryReason(value) {
      REASONS = REASONS.filter((v) => v !== value);
      if (selectedReason === value) selectedReason = "";
      saveCustomReasonDictionary();
      renderReasonChips();
      renderDictionaries();
      showToast("이유 사전에서 삭제되었습니다");
    }

    function removeDictionarySensation(value) {
      SENSATIONS = SENSATIONS.filter((v) => v !== value);
      if (selectedSensation === value) selectedSensation = "";
      saveCustomSensationDictionary();
      renderSensationChips();
      renderDictionaries();
      showToast("감각 사전에서 삭제되었습니다");
    }


    function renderEmotionChips() {
      const container = $("emotionChips");
      if (!container) return;
      container.innerHTML = "";
      if (EMOTIONS.length === 0) {
        container.innerHTML = `<div class="empty inline-empty">아직 감정 선택지가 없습니다. 선택지 없음</div>`;
        return;
      }
      makeChips("emotionChips", EMOTIONS, (value) => {
        selectedEmotions = toggleArray(selectedEmotions, value);
        updateChipSelection("emotionChips", selectedEmotions);
      });
      updateChipSelection("emotionChips", selectedEmotions);
    }
    function renderValueChips() {
      const container = $("valueChips");
      if (!container) return;
      container.innerHTML = "";
      if (VALUES.length === 0) {
        container.innerHTML = `<div class="empty inline-empty">아직 가치 선택지가 없습니다. 선택지 없음</div>`;
        return;
      }
      makeChips("valueChips", VALUES, (value) => {
        selectedValues = toggleArray(selectedValues, value);
        updateChipSelection("valueChips", selectedValues);
        validateStartForm();
      });
      updateChipSelection("valueChips", selectedValues);
    }
    function removeDictionaryEmotion(value) {
      EMOTIONS = EMOTIONS.filter((v) => v !== value);
      selectedEmotions = selectedEmotions.filter((v) => v !== value);
      customEmotions = customEmotions.filter((v) => v !== value);
      saveCustomEmotionDictionary();
      renderEmotionChips(); renderCustomEmotionChips(); renderDictionaries();
      showToast("감정 사전에서 삭제되었습니다");
    }
    function removeDictionaryValue(value) {
      VALUES = VALUES.filter((v) => v !== value);
      selectedValues = selectedValues.filter((v) => v !== value);
      customValues = customValues.filter((v) => v !== value);
      saveCustomValueDictionary();
      renderValueChips(); renderCustomValueChips(); renderDictionaries(); validateStartForm();
      showToast("가치 사전에서 삭제되었습니다");
    }
    function renderDictionaries() {
      renderEditableDictionaryChips("emotionDictionaryChips", EMOTIONS, "emotion", "아직 내 감정 사전에 추가된 감정이 없습니다.");
      renderEditableDictionaryChips("valueDictionaryChips", VALUES, "value", "아직 내 가치 사전에 추가된 가치가 없습니다.");
      renderEditableDictionaryChips("reasonDictionaryChips", REASONS, "reason", "아직 내 멈춤/끝냄 이유 사전에 추가된 이유가 없습니다.");
      renderEditableDictionaryChips("sensationDictionaryChips", SENSATIONS, "sensation", "아직 내 행동 후 감각 사전에 추가된 감각이 없습니다.");
    }

    function renderEditableDictionaryChips(containerId, items, type, emptyText) {
      const wrap = $(containerId);
      if (!wrap) return;
      wrap.innerHTML = "";

      if (!items || items.length === 0) {
        wrap.innerHTML = `<div class="empty">${emptyText}</div>`;
        return;
      }

      const getEditingValue = () => {
        if (type === "emotion") return editingEmotion;
        if (type === "value") return editingValue;
        if (type === "reason") return editingReason;
        if (type === "sensation") return editingSensation;
        return "";
      };

      const setEditingValue = (item) => {
        if (type === "emotion") {
          editingEmotion = item;
          $("manageEmotionInput").value = item;
        } else if (type === "value") {
          editingValue = item;
          $("manageValueInput").value = item;
        } else if (type === "reason") {
          editingReason = item;
          $("manageReasonInput").value = item;
        } else if (type === "sensation") {
          editingSensation = item;
          $("manageSensationInput").value = item;
        }
      };

      items.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip selected";
        btn.classList.toggle("editing", getEditingValue() === item);
        btn.textContent = item;
        btn.title = "누르면 입력칸에 불러옵니다";

        btn.addEventListener("click", () => {
          setEditingValue(item);
          renderDictionaries();
        });

        wrap.appendChild(btn);
      });
    }

    function renderDictionaryChips(containerId, items, removeFn, emptyText) {
      const wrap = $(containerId);
      if (!wrap) return;
      wrap.innerHTML = "";
      if (!items || items.length === 0) {
        wrap.innerHTML = `<div class="empty">${emptyText}</div>`;
        return;
      }
      items.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip selected";
        btn.textContent = item;
        btn.title = "누르면 사전에서 삭제됩니다";
        btn.addEventListener("click", () => removeFn(item));
        wrap.appendChild(btn);
      });
    }

    function saveEmotionDictionaryItem() {
      const input = $("manageEmotionInput");
      if (!input) return;
      const value = normalizeTagText(input.value);
      if (!value) return;

      if (editingEmotion && editingEmotion !== value) {
        EMOTIONS = EMOTIONS.map((item) => item === editingEmotion ? value : item);
        selectedEmotions = selectedEmotions.map((item) => item === editingEmotion ? value : item);
      } else if (!EMOTIONS.includes(value)) {
        EMOTIONS.push(value);
      }

      EMOTIONS = uniqueArray(EMOTIONS);
      saveCustomEmotionDictionary();
      editingEmotion = "";
      input.value = "";
      renderEmotionChips();
      renderDictionaries();
      updateChipSelection("emotionChips", selectedEmotions);
      showToast("감정 사전이 저장되었습니다");
    }

    function saveValueDictionaryItem() {
      const input = $("manageValueInput");
      if (!input) return;
      const value = normalizeTagText(input.value);
      if (!value) return;

      if (editingValue && editingValue !== value) {
        VALUES = VALUES.map((item) => item === editingValue ? value : item);
        selectedValues = selectedValues.map((item) => item === editingValue ? value : item);
      } else if (!VALUES.includes(value)) {
        VALUES.push(value);
      }

      VALUES = uniqueArray(VALUES);
      saveCustomValueDictionary();
      editingValue = "";
      input.value = "";
      renderValueChips();
      renderDictionaries();
      updateChipSelection("valueChips", selectedValues);
      validateStartForm();
      showToast("가치 사전이 저장되었습니다");
    }

    function deleteSelectedEmotionDictionaryItem() {
      if (!editingEmotion) {
        showToast("삭제할 감정을 먼저 선택해주세요");
        return;
      }
      removeDictionaryEmotion(editingEmotion);
      editingEmotion = "";
      if ($("manageEmotionInput")) $("manageEmotionInput").value = "";
      renderDictionaries();
    }

    function deleteSelectedValueDictionaryItem() {
      if (!editingValue) {
        showToast("삭제할 가치를 먼저 선택해주세요");
        return;
      }
      removeDictionaryValue(editingValue);
      editingValue = "";
      if ($("manageValueInput")) $("manageValueInput").value = "";
      renderDictionaries();
    }


    function saveReasonDictionaryItem() {
      const input = $("manageReasonInput");
      if (!input) return;
      const value = normalizeTagText(input.value);
      if (!value) return;

      if (editingReason && editingReason !== value) {
        REASONS = REASONS.map((item) => item === editingReason ? value : item);
        if (selectedReason === editingReason) selectedReason = value;
      } else if (!REASONS.includes(value)) {
        REASONS.push(value);
      }

      REASONS = uniqueArray(REASONS);
      saveCustomReasonDictionary();
      editingReason = "";
      input.value = "";
      renderReasonChips();
      renderDictionaries();
      updateSingleChipSelection("reasonChips", selectedReason);
      showToast("이유 사전이 저장되었습니다");
    }

    function saveSensationDictionaryItem() {
      const input = $("manageSensationInput");
      if (!input) return;
      const value = normalizeTagText(input.value);
      if (!value) return;

      if (editingSensation && editingSensation !== value) {
        SENSATIONS = SENSATIONS.map((item) => item === editingSensation ? value : item);
        if (selectedSensation === editingSensation) selectedSensation = value;
      } else if (!SENSATIONS.includes(value)) {
        SENSATIONS.push(value);
      }

      SENSATIONS = uniqueArray(SENSATIONS);
      saveCustomSensationDictionary();
      editingSensation = "";
      input.value = "";
      renderSensationChips();
      renderDictionaries();
      updateSingleChipSelection("sensationChips", selectedSensation);
      showToast("감각 사전이 저장되었습니다");
    }

    function deleteSelectedReasonDictionaryItem() {
      if (!editingReason) {
        showToast("삭제할 이유를 먼저 선택해주세요");
        return;
      }
      removeDictionaryReason(editingReason);
      editingReason = "";
      if ($("manageReasonInput")) $("manageReasonInput").value = "";
      renderDictionaries();
    }

    function deleteSelectedSensationDictionaryItem() {
      if (!editingSensation) {
        showToast("삭제할 감각을 먼저 선택해주세요");
        return;
      }
      removeDictionarySensation(editingSensation);
      editingSensation = "";
      if ($("manageSensationInput")) $("manageSensationInput").value = "";
      renderDictionaries();
    }


    function toggleArray(arr, value) {
      return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    }

    function validateStartForm() {
      const actionInput = $("actionText");
      const startBtn = $("startBtn");
      if (!actionInput || !startBtn) return;

      const action = actionInput.value.trim();
      const ok = Boolean(selectedState && action && selectedValues.length > 0);

      // 실제 disabled는 걸지 않습니다.
      // iPad/PWA 환경에서 disabled 상태가 꼬이면 시작 버튼 자체가 막힐 수 있어,
      // 클릭은 항상 받되 startSession 내부에서 필요한 항목을 안내합니다.
      startBtn.disabled = false;
      startBtn.classList.toggle("soft-disabled", !ok);
      startBtn.setAttribute("aria-disabled", ok ? "false" : "true");
    }

    function stateBadgeClass(state) {
      if (state === "초록불") return "green";
      if (state === "노란불") return "yellow";
      if (state === "빨간불") return "red";
      return "";
    }

    function startSession(event) {
      if (event && event.preventDefault) event.preventDefault();

      if (pendingEnd) {
        showToast("먼저 현재 기록을 저장하거나 취소해주세요");
        switchTab("start");
        return false;
      }

      if (activeSession && isValidActiveSession(activeSession)) {
        showToast("이미 기록이 시작되어 있어요. 현재 기록으로 돌아왔습니다.");
        switchTab("start");
        showActiveView();
        updateFocusLockUi();
        return false;
      }

      const actionInput = $("actionText");
      const action = actionInput ? actionInput.value.trim() : "";

      if (!selectedState) {
        showToast("지금 상태를 선택해주세요");
        return false;
      }

      if (!action) {
        showToast("작은 행동을 입력해주세요");
        if (actionInput) actionInput.focus();
        return false;
      }

      if (!selectedValues || selectedValues.length === 0) {
        showToast("연결된 가치를 선택해주세요");
        return false;
      }

      activeSession = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        createdAt: nowIso(),
        startAt: nowIso(),
        startMs: Date.now(),
        stateBefore: selectedState,
        emotionsBefore: selectedEmotions.slice(),
        actionText: action,
        values: selectedValues.slice()
      };

      saveActive(activeSession);
      focusOverlayEnabled = true;
      showActiveView();
      switchTab("start");
      updateFocusLockUi();
      updateFocusOverlay();
      requestWakeLock();
      showToast("기록이 시작되었습니다");
      return false;
    }


    async function requestWakeLock() {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLockSentinel = await navigator.wakeLock.request("screen");
        wakeLockSentinel.addEventListener("release", () => {
          wakeLockSentinel = null;
        });
      } catch {
        wakeLockSentinel = null;
      }
    }

    async function releaseWakeLock() {
      if (!wakeLockSentinel) return;
      try {
        await wakeLockSentinel.release();
      } catch {
        // ignore
      } finally {
        wakeLockSentinel = null;
      }
    }

    function shouldShowFocusOverlay() {
      return focusOverlayEnabled && Boolean(activeSession && isValidActiveSession(activeSession) && !pendingEnd);
    }

    function updateFocusOverlay() {
      const overlay = $("focusOverlay");
      if (!overlay) return;

      const show = shouldShowFocusOverlay();
      overlay.classList.toggle("hidden", !show);
      document.body.classList.toggle("focus-overlay-open", show);

      if (!show) return;

      const elapsed = Math.floor((Date.now() - Number(activeSession.startMs || Date.now())) / 1000);
      const values = Array.isArray(activeSession.values) ? activeSession.values.join(", ") : "";
      const emotions = Array.isArray(activeSession.emotionsBefore) ? activeSession.emotionsBefore.join(", ") : "";

      $("focusOverlayAction").textContent = activeSession.actionText || "진행 중인 행동";
      $("focusOverlayTimer").textContent = formatDuration(elapsed);
      $("focusOverlayMeta").innerHTML = `
        시작: ${formatDateTime(activeSession.startAt)}<br />
        상태: ${escapeHtml(activeSession.stateBefore || "기록 중")}
        ${emotions ? ` · 감정: ${escapeHtml(emotions)}` : ""}
        ${values ? ` · 가치: ${escapeHtml(values)}` : ""}
      `;
    }

    function hideFocusOverlayTemporarily() {
      focusOverlayEnabled = false;
      updateFocusOverlay();
      switchTab("settings");
      showToast("백업 탭을 열었습니다");
    }

    function restoreFocusOverlay() {
      focusOverlayEnabled = true;
      updateFocusOverlay();
    }


    function showIdleView() {
      $("idleView").classList.remove("hidden");
      $("activeView").classList.add("hidden");
      $("endView").classList.add("hidden");
      if (timerInterval) clearInterval(timerInterval);
    }

    function showActiveView() {
      $("idleView").classList.add("hidden");
      $("activeView").classList.remove("hidden");
      $("endView").classList.add("hidden");

      $("activeAction").textContent = activeSession.actionText || "진행 중인 행동";
      const activeValues = Array.isArray(activeSession.values) ? activeSession.values.join(", ") : "";
      $("activeMeta").innerHTML = `
        시작: ${formatDateTime(activeSession.startAt)}<br />
        상태: ${activeSession.stateBefore || "기록 중"} · 가치: ${activeValues || "이름 붙이는 중"}
      `;

      updateTimer();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(updateTimer, 1000);
      updateFocusOverlay();
    }

    function updateTimer() {
      if (!activeSession) return;
      const elapsed = Math.floor((Date.now() - Number(activeSession.startMs || Date.now())) / 1000);
      if ($("timer")) $("timer").textContent = formatDuration(elapsed);
      updateFocusOverlay();
    }

    function endSession(type) {
      if (!activeSession) return;

      const endMs = Date.now();
      const endAt = nowIso();
      const durationSec = Math.max(0, Math.floor((endMs - activeSession.startMs) / 1000));

      pendingEnd = { ...activeSession, endType: type, endAt, endMs, durationSec };

      selectedReason = "";
      selectedSensation = "";
      customReasons = [];
      customSensations = [];

      $("endTitle").textContent = type === "완료" ? "완료로 기록하기" : "여기까지 기록하기";
      $("endSummary").innerHTML = `
        시작: ${formatDateTime(pendingEnd.startAt)}<br />
        끝: ${formatDateTime(pendingEnd.endAt)}<br />
        지속 시간: ${formatDurationShort(pendingEnd.durationSec)}
      `;

      renderReasonChips();
      renderSensationChips();
      renderCustomReasonChips();
      renderCustomSensationChips();
      switchTab("start");
      updateFocusLockUi();
      $("idleView").classList.add("hidden");
      $("activeView").classList.add("hidden");
      $("endView").classList.remove("hidden");

      focusOverlayEnabled = false;
      updateFocusOverlay();
      releaseWakeLock();

      if (timerInterval) clearInterval(timerInterval);
    }

    function savePendingRecord(afterSave = "today") {
      if (!pendingEnd) return;

      const startMinute = minutesSinceMidnight(pendingEnd.startAt);
      const endMinute = minutesSinceMidnight(pendingEnd.endAt);

      const record = {
        ...pendingEnd,
        dateKey: parseTodayKey(pendingEnd.startAt),
        startMinute,
        endMinute,
        stopReason: selectedReason || "",
        sensationAfter: selectedSensation || "",
        trophySentence: ""
      };

      const records = loadRecords();
      records.unshift(record);
      saveRecords(records);

      selectedDateKey = record.dateKey || parseTodayKey(record.startAt);
      selectedMonthKey = selectedDateKey.slice(0, 7);
      localStorage.setItem("recovery_selected_date_v1", selectedDateKey);
      localStorage.setItem("recovery_selected_month_v1", selectedMonthKey);

      activeSession = null;
      pendingEnd = null;
      clearActive();

      resetStartFormSoft();
      focusOverlayEnabled = true;
      showIdleView();
      updateDateControls();
      renderAll();
      updateFocusLockUi();
      updateFocusOverlay();
      releaseWakeLock();

      if (afterSave === "start") {
        showToast("저장했습니다. 다음 행동을 준비해볼 수 있습니다");
        switchTab("start");
      } else {
        showToast("회복 기록이 저장되었습니다");
        switchTab("today");
      }
    }

    function resetStartFormSoft() {
      $("actionText").value = "";
      selectedEmotions = [];
      selectedValues = [];
      customEmotions = [];
      customValues = [];
      if ($("customEmotionInput")) $("customEmotionInput").value = "";
      if ($("customValueInput")) $("customValueInput").value = "";
      renderCustomEmotionChips();
      renderCustomValueChips();
      updateChipSelection("emotionChips", selectedEmotions);
      updateChipSelection("valueChips", selectedValues);
      validateStartForm();
    }

    function cancelEnd() {
      const ok = confirm("이 기록 마무리를 취소하고 다시 진행 화면으로 돌아갈까요?");
      if (!ok) return;

      pendingEnd = null;
      selectedReason = "";
      selectedSensation = "";
      focusOverlayEnabled = true;
      showActiveView();
      updateFocusLockUi();
      updateFocusOverlay();
      requestWakeLock();
    }

    function getTodayRecords() {
      return loadRecords()
        .filter((r) => parseTodayKey(r.startAt) === selectedDateKey)
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    }

    function renderTodayDashboard() {
      const todayRecords = getTodayRecords();
      const todaySec = todayRecords.reduce((sum, r) => sum + (r.durationSec || 0), 0);
      const values = [...new Set(todayRecords.flatMap((r) => r.values || []))];

      $("todayCount").textContent = todayRecords.length;
      $("todayTime").textContent = formatDurationShort(todaySec);
      $("todayReturn").textContent = Math.max(0, todayRecords.length - 1);
      $("todayValuesCount").textContent = values.length;

      const dayLabel = getSelectedDayShortLabel();

      if (todayRecords.length === 0) {
        $("todaySentence").textContent = `${dayLabel}의 작은 행동 기록이 아직 없습니다. 첫 30초도 충분히 기록이 됩니다.`;
      } else if (todayRecords.length === 1) {
        $("todaySentence").textContent = `${dayLabel} 나는 1번 삶의 방향으로 돌아왔다.`;
      } else {
        $("todaySentence").textContent = `${dayLabel} 나는 ${todayRecords.length}번 삶의 방향으로 돌아왔다. 끊김보다 중요한 것은 다시 시작한 흔적이다.`;
      }

      renderDaybar(todayRecords);
      renderVerticalTimeline(todayRecords);
      renderTodayList(todayRecords);
    }

    function hashStringToIndex(text, modulo) {
      let hash = 0;
      const source = String(text || "");
      for (let i = 0; i < source.length; i += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) % modulo;
    }

    function getRecordPrimaryValue(record) {
      const values = Array.isArray(record && record.values) ? record.values.filter(Boolean) : [];
      return values[0] || "기타";
    }

    function valueColor(recordOrValue) {
      const value = typeof recordOrValue === "string" ? recordOrValue : getRecordPrimaryValue(recordOrValue);

      const map = {
        "공부": "#2563eb",
        "몸 돌봄": "#16a34a",
        "회복": "#0f766e",
        "휴식": "#7c3aed",
        "자립": "#9333ea",
        "연결": "#db2777",
        "공공성": "#0891b2",
        "창작": "#ea580c",
        "함께 회복": "#0284c7",
        "감각에너지": "#65a30d",
        "자기존중": "#ca8a04",
        "운동": "#dc2626",
        "가사": "#475569",
        "명상": "#4f46e5",
        "식사": "#15803d"
      };

      if (map[value]) return map[value];

      const palette = [
        "#2563eb", "#16a34a", "#7c3aed", "#db2777", "#ea580c",
        "#0891b2", "#65a30d", "#ca8a04", "#4f46e5", "#dc2626",
        "#0f766e", "#9333ea", "#475569"
      ];

      return palette[hashStringToIndex(value, palette.length)];
    }

    function getValueLegend(records) {
      const map = new Map();
      records.forEach((record) => {
        const value = getRecordPrimaryValue(record);
        if (!map.has(value)) map.set(value, valueColor(value));
      });
      return [...map.entries()].map(([value, color]) => ({ value, color }));
    }

    function renderValueLegend(records, containerId) {
      const wrap = $(containerId);
      if (!wrap) return;

      const legend = getValueLegend(records);
      wrap.innerHTML = "";

      if (legend.length === 0) {
        wrap.classList.add("hidden");
        return;
      }

      wrap.classList.remove("hidden");
      legend.forEach(({ value, color }) => {
        const item = document.createElement("span");
        item.className = "value-legend-item";
        item.innerHTML = `<span class="value-legend-dot" style="background:${color}"></span>${escapeHtml(value)}`;
        wrap.appendChild(item);
      });
    }


    function renderDaybar(records) {
      const bar = $("daybar");
      if (!bar) return;
      bar.innerHTML = "";

      if (isSelectedToday()) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        const nowLine = document.createElement("div");
        nowLine.className = "now-line";
        nowLine.style.left = `${Math.min(100, Math.max(0, nowMin / 1440 * 100))}%`;
        bar.appendChild(nowLine);
      }

      records.forEach((record) => {
        const start = minutesSinceMidnight(record.startAt);
        const durationMin = Math.max((record.durationSec || 0) / 60, 0.5);
        const seg = document.createElement("div");
        seg.className = "bar-segment";
        seg.title = `${record.actionText || "작은 행동"} · ${getRecordPrimaryValue(record)} · ${formatDurationShort(record.durationSec || 0)}`;
        seg.style.left = `${Math.max(0, start / 1440 * 100)}%`;
        seg.style.width = `${Math.max(0.4, durationMin / 1440 * 100)}%`;
        seg.style.background = valueColor(record);
        bar.appendChild(seg);
      });

      renderValueLegend(records, "todayValueLegend");
    }

    function renderVerticalTimeline(records) {
      renderValueLegend(records, "timelineValueLegend");
      const timeline = $("verticalTimeline");
      const scroll = $("timelineScroll");
      if (!timeline || !scroll) return;

      const scale = timelineScale; // px per minute
      const totalHeight = 1440 * scale;
      timeline.style.height = `${totalHeight}px`;
      timeline.style.setProperty("--minor-step", `${Math.max(1, 5 * scale - 1)}px`);
      timeline.style.setProperty("--minor-step-line", `${Math.max(1, 5 * scale)}px`);
      timeline.innerHTML = "";

      for (let h = 0; h <= 24; h++) {
        const topPx = h * 60 * scale;
        const line = document.createElement("div");
        line.className = "hour-line";
        line.style.top = `${topPx}px`;
        timeline.appendChild(line);

        if (h < 24) {
          const label = document.createElement("div");
          label.className = "hour-label";
          label.style.top = `${topPx}px`;
          label.textContent = `${String(h).padStart(2, "0")}:00`;
          timeline.appendChild(label);
        }

        if (h < 24) {
          const half = document.createElement("div");
          half.className = "half-hour-line";
          half.style.top = `${(h * 60 + 30) * scale}px`;
          timeline.appendChild(half);
        }
      }

      if (isSelectedToday()) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        const nowMarker = document.createElement("div");
        nowMarker.className = "now-marker";
        nowMarker.style.top = `${nowMin * scale}px`;
        timeline.appendChild(nowMarker);
      }

      records.forEach((record) => {
        const start = minutesSinceMidnight(record.startAt);
        const durationMin = Math.max(record.durationSec / 60, 1 / scale); // visible but not exaggerated
        const topPx = start * scale;
        const heightPx = durationMin * scale;

        const block = document.createElement("div");
        block.className = "timeline-block";
        block.style.top = `${topPx}px`;
        block.style.height = `${heightPx}px`;
        block.style.borderColor = valueColor(record);
        block.style.borderLeftWidth = "5px";
        block.style.background = `${hexToRgba(valueColor(record), 0.10)}`;
        block.style.color = valueColor(record);

        const exactTime = `${formatTimeOnly(record.startAt)}–${formatTimeOnly(record.endAt)}`;
        const primaryValue = getRecordPrimaryValue(record);
        const values = (record.values || []).map(escapeHtml).join(", ") || "가치 없음";

        block.innerHTML = `
          <div class="timeline-block-label">
            ${exactTime} · ${escapeHtml(record.actionText)}
            <span class="timeline-block-sub">${formatDurationShort(record.durationSec)} · ${values}</span>
          </div>
        `;
        timeline.appendChild(block);
      });
    }

    function setTimelineScale(scale) {
      timelineScale = Number(scale);
      localStorage.setItem("minwoo_timeline_scale_v1", String(timelineScale));
      document.querySelectorAll(".scale-btn").forEach((btn) => {
        btn.classList.toggle("active", Number(btn.dataset.scale) === timelineScale);
      });
      renderTodayDashboard();
      showToast(`타임라인 배율: 1분 = ${timelineScale}px`);
    }

    function scrollTimelineToMinute(minute) {
      const scroll = $("timelineScroll");
      if (!scroll) return;
      const y = Math.max(0, minute * timelineScale - scroll.clientHeight * 0.28);
      scroll.scrollTo({ top: y, behavior: "smooth" });
    }

    function jumpToNow() {
      if (!isSelectedToday()) {
        setSelectedDate(getTodayKey(), true);
      }
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      scrollTimelineToMinute(nowMin);
    }

    function jumpToFirstRecord() {
      const records = getTodayRecords();
      if (records.length === 0) {
        jumpToNow();
        showToast("오늘 기록이 없어 현재 시간으로 이동합니다");
        return;
      }
      scrollTimelineToMinute(minutesSinceMidnight(records[0].startAt));
    }

    function hexToRgba(hex, alpha) {
      const clean = hex.replace("#", "");
      const bigint = parseInt(clean, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function renderTodayList(records) {
      const list = $("todayList");
      list.innerHTML = "";
      if (records.length === 0) {
        list.innerHTML = `<div class="empty">오늘 기록이 아직 없습니다. 작은 행동 하나를 시작해보세요.</div>`;
        return;
      }

      records.forEach((record) => {
        const div = document.createElement("div");
        div.className = "today-list-item";
        div.innerHTML = `
          <div class="record-title">${escapeHtml(record.actionText)}</div>
          <div class="meta">
            ${formatTimeOnly(record.startAt)}–${formatTimeOnly(record.endAt)}
            · ${formatDurationShort(record.durationSec)}
            · ${(record.values || []).map(escapeHtml).join(", ") || "가치 없음"}
          </div>
          <div>
            <span class="badge ${stateBadgeClass(record.stateBefore)}">${record.stateBefore}</span>
            <span class="badge ${record.endType === "잠듦/놓침" ? "end-type-missed" : ""}">${record.endType}</span>
            <span class="badge">${escapeHtml(record.sensationAfter || "감각 기록 없음")}</span>
          </div>
        `;
        list.appendChild(div);
      });
    }


    function getValueCounts(records) {
      const counts = {};
      records.forEach((record) => {
        (record.values || []).forEach((value) => {
          counts[value] = (counts[value] || 0) + 1;
        });
      });
      return counts;
    }

    function getReflectionKey() {
      return `${REFLECTION_KEY}_${selectedDateKey}`;
    }

    function saveDailyReflection() {
      const text = $("dailyReflection").value.trim();
      localStorage.setItem(getReflectionKey(), text);
      showToast("하루 마무리 문장이 저장되었습니다");
      renderTrophyDashboard();
    }

    function getLongestRecord(records) {
      if (!records.length) return null;
      return [...records].sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0))[0];
    }

    function renderTrophyDashboard() {
      const records = getTodayRecords();
      const totalSec = records.reduce((sum, r) => sum + (r.durationSec || 0), 0);
      const valueCounts = getValueCounts(records);
      const values = Object.keys(valueCounts);
      const longest = getLongestRecord(records);
      const reflection = localStorage.getItem(getReflectionKey()) || "";
      const dayLabel = getSelectedDayShortLabel();

      if ($("dailyReflection")) $("dailyReflection").value = reflection;

      $("trophySessionCount").textContent = records.length;
      $("trophyTotalTime").textContent = formatDurationShort(totalSec);
      $("trophyValueCount").textContent = values.length;

      if (records.length === 0) {
        $("trophyTitle").textContent = `${dayLabel}의 작은 행동 기록이 아직 없습니다.`;
        $("trophySubtitle").textContent = `첫 기록 하나가 생기면 이곳에 ${dayLabel}의 회복 트로피가 만들어집니다.`;
        $("trophyDetail").textContent = `${dayLabel}의 기록이 아직 없습니다.`;
        $("trophyValueMap").innerHTML = `<div class="empty">${dayLabel} 접촉한 가치가 아직 없습니다.</div>`;
        renderTrophyHighlights([]);
        renderTimeBuckets([]);
        renderReflectionDisplay(reflection);
        return;
      }

      const mostValue = values.sort((a, b) => valueCounts[b] - valueCounts[a])[0];
      const title = records.length === 1
        ? `${dayLabel} 나는 1번 삶의 방향으로 돌아왔다.`
        : `${dayLabel} 나는 ${records.length}번 삶의 방향으로 돌아왔다.`;

      $("trophyTitle").textContent = title;

      const subtitleLines = [
        `${formatDurationShort(totalSec)}의 시간이 사라지지 않고 회복 기록으로 남았습니다.`,
        values.length ? `오늘 행동으로 접촉한 가치는 ${values.join(", ")}입니다.` : "",
        reflection ? `${dayLabel}의 마무리 문장: ${reflection}` : `${dayLabel}을 평가하지 않고, 남은 흔적을 회수하는 시간입니다.`
      ].filter(Boolean);

      $("trophySubtitle").textContent = subtitleLines.join("\n");

      const detailLines = [
        `총 ${records.length}개의 회복 세션이 남았습니다.`,
        `총 시간은 ${formatDurationShort(totalSec)}입니다.`,
        longest ? `가장 오래 남은 행동은 '${longest.actionText}' (${formatDurationShort(longest.durationSec)})입니다.` : "",
        mostValue ? `${dayLabel} 가장 자주 살아난 가치는 '${mostValue}'입니다.` : "",
        `다시 시작한 횟수는 ${Math.max(0, records.length - 1)}회로 기록됩니다.`
      ].filter(Boolean);

      $("trophyDetail").textContent = detailLines.join("\n");

      renderTrophyValueMap(valueCounts);
      renderTrophyHighlights(records);
      renderTimeBuckets(records);
      renderReflectionDisplay(reflection);
    }


    function getSmallestRecord(records) {
      if (!records.length) return null;
      return [...records].sort((a, b) => (a.durationSec || 0) - (b.durationSec || 0))[0];
    }
    function renderTrophyHighlights(records) {
      const longest = getLongestRecord(records);
      const smallest = getSmallestRecord(records);
      if (!$("longestActionTitle")) return;
      if (!longest) {
        $("longestActionTitle").textContent = "아직 기록이 없습니다.";
        $("longestActionDesc").textContent = "기록이 생기면 오늘 가장 오래 머문 행동이 표시됩니다.";
        $("smallestActionTitle").textContent = "아직 기록이 없습니다.";
        $("smallestActionDesc").textContent = "짧은 행동도 정확히 그만큼 존중받습니다.";
        return;
      }
      $("longestActionTitle").textContent = `${longest.actionText} · ${formatDurationShort(longest.durationSec)}`;
      $("longestActionDesc").textContent = `${(longest.values || []).join(", ") || "이름 붙이는 중"} 가치가 가장 오래 몸을 통과한 기록입니다.`;
      $("smallestActionTitle").textContent = `${smallest.actionText} · ${formatDurationShort(smallest.durationSec)}`;
      $("smallestActionDesc").textContent = `작아 보여도 사라지지 않은 정확한 회복 기록입니다.`;
    }
    function timeBucketName(date) {
      const h = date.getHours();
      if (h < 6) return "새벽";
      if (h < 12) return "오전";
      if (h < 18) return "오후";
      return "저녁";
    }
    function renderTimeBuckets(records) {
      const wrap = $("timeBucketGrid");
      if (!wrap) return;
      const buckets = { "새벽": { count: 0, sec: 0 }, "오전": { count: 0, sec: 0 }, "오후": { count: 0, sec: 0 }, "저녁": { count: 0, sec: 0 } };
      records.forEach((r) => {
        const name = timeBucketName(new Date(r.startAt));
        buckets[name].count += 1;
        buckets[name].sec += r.durationSec || 0;
      });
      wrap.innerHTML = "";
      Object.entries(buckets).forEach(([name, data]) => {
        const div = document.createElement("div");
        div.className = "time-bucket";
        div.innerHTML = `<div class="time-bucket-name">${name}</div><div class="time-bucket-count">${data.count}회</div><div class="time-bucket-sub">${formatDurationShort(data.sec)}</div>`;
        wrap.appendChild(div);
      });
    }
    function renderReflectionDisplay(reflection) {
      const display = $("reflectionDisplay");
      if (!display) return;
      display.textContent = reflection ? `오늘 내가 직접 남긴 문장:\n“${reflection}”` : "아직 저장된 마무리 문장이 없습니다.";
    }

    function renderTrophyValueMap(valueCounts) {
      const wrap = $("trophyValueMap");
      const entries = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);

      if (entries.length === 0) {
        wrap.innerHTML = `<div class="empty">오늘 접촉한 가치가 아직 없습니다.</div>`;
        return;
      }

      const max = Math.max(...entries.map(([, count]) => count));
      wrap.innerHTML = "";

      entries.forEach(([value, count]) => {
        const row = document.createElement("div");
        row.className = "value-row";
        row.innerHTML = `
          <div class="value-name">${escapeHtml(value)}</div>
          <div class="value-bar-bg">
            <div class="value-bar-fill" style="width: ${Math.max(8, count / max * 100)}%; background: ${valueColor({ values: [value] })};"></div>
          </div>
          <div class="value-count">${count}회</div>
        `;
        wrap.appendChild(row);
      });
    }


    function renderCalendarDashboard() {
      updateMonthControls();

      const monthRecords = getMonthRecords();
      const recordsByDate = {};
      monthRecords.forEach((record) => {
        const key = parseTodayKey(record.startAt);
        if (!recordsByDate[key]) recordsByDate[key] = [];
        recordsByDate[key].push(record);
      });

      renderMonthCalendar(recordsByDate);
    }

    function renderMonthCalendar(recordsByDate) {
      const grid = $("monthCalendarGrid");
      if (!grid) return;
      grid.innerHTML = "";

      const first = monthKeyToDate(selectedMonthKey);
      const year = first.getFullYear();
      const month = first.getMonth();
      const firstDay = first.getDay();
      const lastDate = new Date(year, month + 1, 0).getDate();
      const todayKey = getTodayKey();

      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty-day";
        grid.appendChild(empty);
      }

      for (let day = 1; day <= lastDate; day++) {
        const dateKey = `${selectedMonthKey}-${String(day).padStart(2, "0")}`;
        const records = recordsByDate[dateKey] || [];
        const { totalSec, values, count } = summarizeRecords(records);

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "calendar-day";
        if (records.length > 0) cell.classList.add("has-records");
        if (dateKey === selectedDateKey) cell.classList.add("selected-day");
        if (dateKey === todayKey) cell.classList.add("today-day");

        cell.innerHTML = `
          <div class="day-top">
            <span class="day-number">${day}</span>
          </div>
          ${records.length > 0 ? `<div class="record-dot-count">${count}</div>` : ""}
        `;

        cell.addEventListener("click", () => {
          setSelectedDate(dateKey, true);
          switchTab("today");
          showToast(`${formatDateKeyHuman(dateKey)} 대시보드로 이동했습니다`);
        });

        grid.appendChild(cell);
      }
    }


    function getLongRecordBadge(record) {
      const durationSec = Number(record && record.durationSec ? record.durationSec : 0);
      if (durationSec >= 6 * 60 * 60) {
        return `<span class="badge long-record-badge likely-missed-end">종료 놓침 가능성</span>`;
      }
      if (durationSec >= 2 * 60 * 60) {
        return `<span class="badge long-record-badge check-needed">확인 필요</span>`;
      }
      return "";
    }



    function markRecordAsMissedEnd(id) {
      const records = loadRecords();
      const record = records.find((item) => item.id === id);
      if (!record) {
        showToast("표시할 기록을 찾지 못했습니다");
        return;
      }

      if (record.endType === "잠듦/놓침") {
        showToast("이미 잠듦/놓침으로 표시된 기록입니다");
        return;
      }

      const ok = confirm("이 기록을 ‘잠듦/놓침’으로 표시할까요?");
      if (!ok) return;

      record.endType = "잠듦/놓침";
      saveRecords(records);
      renderAll();
      showToast("잠듦/놓침으로 표시했습니다");
    }



    function padTimePart(n) {
      return String(n).padStart(2, "0");
    }

    function formatRecordEndTimeForPrompt(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return `${padTimePart(d.getHours())}:${padTimePart(d.getMinutes())}`;
    }

    function parseEndTimeForRecord(input, startIso) {
      const text = String(input || "").trim();
      if (!text) return null;

      const start = new Date(startIso);
      if (Number.isNaN(start.getTime())) return null;

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

      const normalized = text.replace(" ", "T");
      const parsed = new Date(normalized);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    }

    function updateRecordEndTime(id) {
      const records = loadRecords();
      const record = records.find((item) => item.id === id);
      if (!record) {
        showToast("수정할 기록을 찾지 못했습니다");
        return;
      }

      const current = formatRecordEndTimeForPrompt(record.endAt || record.startAt);
      const input = prompt(
        "새 종료 시간을 입력해주세요.\n예: 14:30 또는 2026-05-17 14:30",
        current
      );

      if (input === null) return;

      const newEnd = parseEndTimeForRecord(input, record.startAt);
      if (!newEnd) {
        showToast("시간 형식을 확인해주세요");
        return;
      }

      const start = new Date(record.startAt);
      if (Number.isNaN(start.getTime())) {
        showToast("시작 시간이 올바르지 않습니다");
        return;
      }

      if (newEnd < start) {
        showToast("종료 시간은 시작 시간보다 뒤여야 합니다");
        return;
      }

      record.endAt = newEnd.toISOString();
      record.endMs = newEnd.getTime();
      record.durationSec = Math.max(0, Math.floor((newEnd.getTime() - start.getTime()) / 1000));
      record.correctionType = "end_time_adjusted";
      record.correctedAt = nowIso();

      saveRecords(records);
      renderAll();
      showToast("종료 시간을 수정했습니다");
    }


    function renderRecords() {
      const records = loadRecords();
      const list = $("recordsList");
      list.innerHTML = "";

      if (records.length === 0) {
        list.innerHTML = `<div class="empty">아직 기록이 없습니다. 오늘 나를 살린 작은 행동 하나부터 시작해보세요.</div>`;
        return;
      }

      records.forEach((record) => {
        const div = document.createElement("div");
        div.className = "record";
        const stateClass = stateBadgeClass(record.stateBefore);
        const missedActionButton = record.endType === "잠듦/놓침"
          ? ""
          : `<button class="btn secondary mark-missed-end">잠듦/놓침 표시</button>`;
        const endTimeAdjustedBadge = record.correctionType === "end_time_adjusted"
          ? `<span class="badge end-time-adjusted">종료 시간 정정됨</span>`
          : "";
        div.innerHTML = `
          <div class="record-title">${escapeHtml(record.actionText)}</div>
          <div>
            <span class="badge ${stateClass}">${record.stateBefore}</span>
            <span class="badge ${record.endType === "잠듦/놓침" ? "end-type-missed" : ""}">${record.endType}</span>
            <span class="badge">${formatDurationShort(record.durationSec)}</span>
            ${getLongRecordBadge(record)}
            ${endTimeAdjustedBadge}
          </div>
          <div class="meta">
            시작: ${formatDateTime(record.startAt)}<br/>
            끝: ${formatDateTime(record.endAt)}<br/>
            감정: ${(record.emotionsBefore || []).map(escapeHtml).join(", ") || "기록 없음"}<br/>
            가치: ${(record.values || []).map(escapeHtml).join(", ") || "기록 없음"}<br/>
            이유: ${escapeHtml(record.stopReason || "기록 없음")} · 감각: ${escapeHtml(record.sensationAfter || "기록 없음")}
          </div>
<div class="row">
<button class="btn secondary edit-end-time-safe">종료 시간 수정</button>
          ${missedActionButton}
          <button class="btn danger delete-record">삭제</button>
          </div>
        `;
        const editEndTimeBtn = div.querySelector(".edit-end-time-safe");
        if (editEndTimeBtn) {
          editEndTimeBtn.addEventListener("click", () => updateRecordEndTime(record.id));
        }

        const markMissedBtn = div.querySelector(".mark-missed-end");
        if (markMissedBtn) {
          markMissedBtn.addEventListener("click", () => markRecordAsMissedEnd(record.id));
        }
        div.querySelector(".delete-record").addEventListener("click", () => deleteRecord(record.id));
        list.appendChild(div);
      });
    }

    function deleteRecord(id) {
      if (!confirm("이 기록을 삭제할까요?")) return;
      const records = loadRecords().filter((r) => r.id !== id);
      saveRecords(records);
      renderAll();
      showToast("기록이 삭제되었습니다");
    }

    function escapeHtml(str) {
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function isFocusLocked() {
      if (pendingEnd) return true;
      if (!activeSession) return false;
      if (!isValidActiveSession(activeSession)) return false;
      return true;
    }

    function getFocusLockMessage() {
      if (pendingEnd) return "먼저 지금 행동을 저장하거나 취소해주세요. 백업 탭은 사용할 수 있습니다.";
      if (activeSession) return "먼저 지금 행동을 ‘여기까지’ 또는 ‘완료’로 기록해주세요. 백업 탭은 사용할 수 있습니다.";
      return "";
    }

    function updateFocusLockUi() {
      if (activeSession && !isValidActiveSession(activeSession)) {
        clearActive();
        activeSession = null;
      }

      const locked = isFocusLocked();
      const banner = $("focusLockBanner");
      if (banner) banner.classList.toggle("show", locked);

      document.querySelectorAll(".tab").forEach((tab) => {
        const shouldLock = locked && !["start", "settings"].includes(tab.dataset.tab);
        tab.classList.toggle("locked", shouldLock);
        tab.setAttribute("aria-disabled", shouldLock ? "true" : "false");
      });
    }

    function switchTab(tab) {
      const allowedWhileLocked = tab === "start" || tab === "settings";
      if (isFocusLocked() && !allowedWhileLocked) {
        showToast(getFocusLockMessage());
        updateFocusLockUi();
        updateFocusOverlay();
        return;
      }

      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

      $("startTab").classList.toggle("hidden", tab !== "start");
      $("todayTab").classList.toggle("hidden", tab !== "today");
      $("trophyTab").classList.toggle("hidden", tab !== "trophy");
      $("calendarTab").classList.toggle("hidden", tab !== "calendar");
      $("recordsTab").classList.toggle("hidden", tab !== "records");
      $("settingsTab").classList.toggle("hidden", tab !== "settings");

      if (tab === "start" && activeSession && !pendingEnd) {
        restoreFocusOverlay();
      }

      updateFocusLockUi();
      updateFocusOverlay();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function forceUnlockFocusLock(event) {
      if (event && event.preventDefault) event.preventDefault();

      const ok = confirm("진행 중인 기록 잠금을 해제할까요? 현재 진행 중이던 기록은 저장되지 않습니다.");
      if (!ok) return false;

      pendingEnd = null;
      activeSession = null;
      clearActive();

      selectedReason = "";
      selectedSensation = "";

      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      focusOverlayEnabled = true;
      showIdleView();
      updateFocusLockUi();
      updateFocusOverlay();
      releaseWakeLock();
      switchTab("start");
      showToast("기록 잠금을 해제했습니다");
      return false;
    }

    function isStaleActiveSession(session) {
      if (!session || !session.startMs) return false;
      const ageMs = Date.now() - Number(session.startMs);
      return Number.isFinite(ageMs) && ageMs > 12 * 60 * 60 * 1000;
    }
    function exportJson() {
      const records = loadRecords();
      const payload = { app: "작은 행동 회복 기록", version: 2, exportedAt: nowIso(), records };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recovery-records-${getTodayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastBackupAt();
      showToast("JSON 백업 파일을 만들었습니다");
    }


    function csvEscape(value) {
      const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
      const normalized = text.replace(/\r?\n/g, " ").trim();
      if (/[",\n]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
      return normalized;
    }

    function getCsvDateParts(iso) {
      if (!iso) return { date: "", weekday: "", time: "" };
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return { date: "", weekday: "", time: "" };
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const weekday = weekdays[d.getDay()];
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
      return { date, weekday, time };
    }

    function recordsToCsv(records) {
      const headers = [
        "id",
        "date",
        "weekday",
        "startAt",
        "endAt",
        "startTime",
        "endTime",
        "durationSec",
        "durationText",
        "stateBefore",
        "emotionsBefore",
        "actionText",
        "values",
        "primaryValue",
        "endType",
        "reasonEnded",
        "sensationAfter",
        "createdAt"
      ];

      const rows = records
        .slice()
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
        .map((record) => {
          const start = getCsvDateParts(record.startAt);
          const end = getCsvDateParts(record.endAt);
          const values = Array.isArray(record.values) ? record.values : [];
          const emotions = Array.isArray(record.emotionsBefore) ? record.emotionsBefore : [];
          return [
            record.id || "",
            start.date,
            start.weekday,
            record.startAt || "",
            record.endAt || "",
            start.time,
            end.time,
            record.durationSec || 0,
            formatDurationShort(record.durationSec || 0),
            record.stateBefore || "",
            emotions,
            record.actionText || "",
            values,
            values[0] || "",
            record.endType || "",
            record.reasonEnded || "",
            record.sensationAfter || "",
            record.createdAt || ""
          ].map(csvEscape).join(",");
        });

      return "\ufeff" + [headers.map(csvEscape).join(","), ...rows].join("\n");
    }

    function exportCsv() {
      const records = loadRecords();
      const csv = recordsToCsv(records);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recovery-records-${getTodayKey()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastBackupAt();
      showToast("CSV 파일을 만들었습니다");
    }


    function importJsonFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const incoming = Array.isArray(parsed) ? parsed : parsed.records;
          if (!Array.isArray(incoming)) throw new Error("Invalid format");

          const current = loadRecords();
          const mergedMap = new Map();
          [...incoming, ...current].forEach((r) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
          const merged = [...mergedMap.values()].sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
          saveRecords(merged);
          renderAll();
          showToast("JSON 기록을 불러왔습니다");
        } catch {
          alert("불러오기 실패: 올바른 JSON 백업 파일인지 확인해주세요.");
        }
      };
      reader.readAsText(file);
    }

    function clearAllRecords() {
      if (!confirm("전체 기록을 삭제합니다. 먼저 백업했나요?")) return;
      if (!confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
      localStorage.removeItem(STORAGE_KEY);
      renderAll();
      showToast("전체 기록이 삭제되었습니다");
    }

    function renderAll() {
      renderDictionaries();
      renderQuickPresetButtons();
      renderPresetDictionaryChips();
      renderLastBackupAt();
      renderCalendarDashboard();
      renderTodayDashboard();
      renderTrophyDashboard();
      renderRecords();
      updatePwaStatus();
    }


    function setupStartButtonFallbackListener() {
      document.addEventListener("click", (event) => {
        if (event.defaultPrevented) return;

        const target = event.target && event.target.closest ? event.target.closest("#startBtn") : null;
        if (!target) return;

        event.preventDefault();
        startSession(event);
      });
    }

    function setupTabFallbackListeners() {
      document.addEventListener("click", (event) => {
        const tab = event.target && event.target.closest ? event.target.closest(".tab") : null;
        if (!tab || !tab.dataset || !tab.dataset.tab) return;
        event.preventDefault();
        switchTab(tab.dataset.tab);
      });
    }

    function setupPresetManagerFallbackListeners() {
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!target) return;

        if (target.closest && target.closest("#savePresetBtn")) {
          event.preventDefault();
          savePresetItem(event);
        }

        if (target.closest && target.closest("#deletePresetBtn")) {
          event.preventDefault();
          deleteSelectedPresetItem(event);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        if (event.target && event.target.id === "managePresetInput") {
          event.preventDefault();
          savePresetItem(event);
        }
      });
    }

    function setupPwa() {
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("./service-worker.js")
            .then(() => updatePwaStatus())
            .catch(() => updatePwaStatus("서비스 워커 등록에 실패했습니다. 로컬 파일에서는 정상일 수 있습니다."));
        });
      }

      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        $("installBtn").disabled = false;
        $("installBox").classList.remove("hidden");
        $("installBox").innerHTML = `설치 가능 상태입니다. <button class="btn secondary" id="installInlineBtn">앱 설치하기</button>`;
        $("installInlineBtn").addEventListener("click", promptInstall);
        updatePwaStatus("설치 가능 상태입니다.");
      });

      window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        $("installBtn").disabled = true;
        showToast("앱이 설치되었습니다");
        updatePwaStatus("앱이 설치되었습니다.");
      });

      $("installBtn").addEventListener("click", promptInstall);
    }

    async function promptInstall() {
      if (!deferredInstallPrompt) {
        showToast("현재 브라우저에서는 설치 버튼이 아직 준비되지 않았습니다");
        return;
      }
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("installBtn").disabled = true;
      updatePwaStatus();
    }

    function updatePwaStatus(extraMessage) {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
      const sw = "serviceWorker" in navigator ? "지원됨" : "미지원";
      const secure = window.isSecureContext ? "HTTPS/보안 컨텍스트" : "비보안 컨텍스트";
      let msg = `서비스 워커: ${sw} · 실행 환경: ${secure}`;
      if (standalone) msg += " · 현재 설치 앱처럼 실행 중";
      if (extraMessage) msg += ` · ${extraMessage}`;
      if ($("pwaStatus")) $("pwaStatus").textContent = msg;
    }

    function init() {
      migrateOldStorageIfNeeded();
      loadDictionaries();
      loadQuickPresets();

      makeChips("stateChips", STATES, (value) => {
        selectedState = value;
        updateChipSelection("stateChips", selectedState);
        validateStartForm();
      }, "state-chip");

      renderEmotionChips();
      renderValueChips();

      renderReasonChips();

      renderSensationChips();
      $("actionText").addEventListener("input", validateStartForm);
      $("saveEmotionDictBtn").addEventListener("click", saveEmotionDictionaryItem);
      $("deleteEmotionDictBtn").addEventListener("click", deleteSelectedEmotionDictionaryItem);
      $("saveValueDictBtn").addEventListener("click", saveValueDictionaryItem);
      $("deleteValueDictBtn").addEventListener("click", deleteSelectedValueDictionaryItem);
      $("saveReasonDictBtn").addEventListener("click", saveReasonDictionaryItem);
      $("deleteReasonDictBtn").addEventListener("click", deleteSelectedReasonDictionaryItem);
      $("saveSensationDictBtn").addEventListener("click", saveSensationDictionaryItem);
      $("deleteSensationDictBtn").addEventListener("click", deleteSelectedSensationDictionaryItem);
      $("manageReasonInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveReasonDictionaryItem();
        }
      });
      $("manageSensationInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveSensationDictionaryItem();
        }
      });
      $("manageEmotionInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveEmotionDictionaryItem();
        }
      });
      $("manageValueInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveValueDictionaryItem();
        }
      });
      $("pauseBtn").addEventListener("click", () => endSession("여기까지"));
      $("completeBtn").addEventListener("click", () => endSession("완료"));
      $("missedEndBtn").addEventListener("click", () => endSession("잠듦/놓침"));
      $("focusPauseBtn").addEventListener("click", () => endSession("여기까지"));
      $("focusCompleteBtn").addEventListener("click", () => endSession("완료"));
      $("focusBackupBtn").addEventListener("click", hideFocusOverlayTemporarily);
      $("focusUnlockBtn").addEventListener("click", forceUnlockFocusLock);
      $("saveRecordBtn").addEventListener("click", () => savePendingRecord("today"));
      $("saveAndPrepareNextBtn").addEventListener("click", () => savePendingRecord("start"));
      $("cancelEndBtn").addEventListener("click", cancelEnd);

      $("exportBtn").addEventListener("click", exportJson);
      $("exportCsvBtn").addEventListener("click", exportCsv);
      $("importBtn").addEventListener("click", () => $("importFile").click());
      $("importFile").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) importJsonFile(file);
        e.target.value = "";
      });
      $("clearBtn").addEventListener("click", clearAllRecords);

      document.querySelectorAll(".date-prev").forEach((btn) => btn.addEventListener("click", () => shiftSelectedDate(-1)));
      document.querySelectorAll(".date-next").forEach((btn) => btn.addEventListener("click", () => shiftSelectedDate(1)));
      document.querySelectorAll(".date-today").forEach((btn) => btn.addEventListener("click", () => setSelectedDate(getTodayKey())));
      document.querySelectorAll(".selected-date-input").forEach((input) => {
        input.addEventListener("change", (event) => setSelectedDate(event.target.value));
      });
      document.querySelectorAll(".month-prev").forEach((btn) => btn.addEventListener("click", () => shiftSelectedMonth(-1)));
      document.querySelectorAll(".month-next").forEach((btn) => btn.addEventListener("click", () => shiftSelectedMonth(1)));
      document.querySelectorAll(".month-today").forEach((btn) => btn.addEventListener("click", goThisMonth));
      $("goSelectedDateBtn").addEventListener("click", () => {
        syncMonthToSelectedDate();
        switchTab("today");
      });

      document.querySelectorAll(".scale-btn").forEach((btn) => {
        btn.addEventListener("click", () => setTimelineScale(btn.dataset.scale));
        btn.classList.toggle("active", Number(btn.dataset.scale) === timelineScale);
      });
      $("jumpNowBtn").addEventListener("click", jumpToNow);
      $("jumpFirstRecordBtn").addEventListener("click", jumpToFirstRecord);
activeSession = loadActive();
      if (activeSession && (!isValidActiveSession(activeSession) || isStaleActiveSession(activeSession))) {
        clearActive();
        activeSession = null;
      }

      if (activeSession) {
        focusOverlayEnabled = true;
        showActiveView();
        switchTab("start");
        requestWakeLock();
      } else {
        showIdleView();
      }
      updateFocusLockUi();
      updateFocusOverlay();

      renderCustomEmotionChips();
      renderCustomValueChips();
      updateDateControls();
      updateMonthControls();
      validateStartForm();
      setupStartButtonFallbackListener();
      setupTabFallbackListeners();
      setupPresetManagerFallbackListeners();
      setupPwa();
      renderAll();
    }


    window.startSession = startSession;
    window.forceUnlockFocusLock = forceUnlockFocusLock;

    window.savePresetItem = savePresetItem;
    window.deleteSelectedPresetItem = deleteSelectedPresetItem;


    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && shouldShowFocusOverlay()) {
        requestWakeLock();
        updateFocusOverlay();
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (!isFocusLocked()) return;
      event.preventDefault();
      event.returnValue = "";
    });

    init();
