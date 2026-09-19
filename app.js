const HABITS_KEY = "daymark.habits.v2";
const LEGACY_HABITS_KEY = "daymark.habits.v1";
const RECORDS_KEY = "daymark.records.v2";
const LEGACY_RECORDS_KEY = "daymark.records.v1";
const LEARNING_MIGRATION_KEY = "daymark.migration.learning.v1";

const PUBLIC_SITE_URL = "https://z137965-blip.github.io/habit-tracker/";
const LIVE_API_URL = "https://api.github.com/repos/z137965-blip/habit-tracker/contents/data.json?ref=main";
const LIVE_NOTIFY_TOPIC = "habit-z137965-8f3c9a7d2e";
const LOCAL_SERVER_ORIGIN = "http://127.0.0.1:4177";

const starterHabits = [
  { id: "starter-water", name: "喝水", icon: "water", target: 8, unit: "杯" },
  { id: "starter-move", name: "运动 20 分钟", icon: "exercise", target: 20, unit: "分钟" },
  { id: "starter-read", name: "读书", icon: "book", target: 20, unit: "页" },
  { id: "starter-sleep", name: "早睡", icon: "sleep", target: 1, unit: "次" },
  { id: "starter-study", name: "学习", icon: "study", target: 60, unit: "分钟" }
];

const iconAliases = {
  "✨": "spark", "💧": "water", "🏃": "exercise", "📖": "book",
  "🧘": "meditate", "🌙": "sleep", "🥗": "food", "🎓": "study", "🎯": "spark"
};

const elements = {
  dateLabel: document.getElementById("dateLabel"),
  summaryCard: document.getElementById("summaryCard"),
  doneCount: document.getElementById("doneCount"),
  totalCount: document.getElementById("totalCount"),
  encouragement: document.getElementById("encouragement"),
  progressTrack: document.getElementById("progressTrack"),
  progressFill: document.getElementById("progressFill"),
  progressRing: document.getElementById("progressRing"),
  ringProgress: document.getElementById("ringProgress"),
  percentLabel: document.getElementById("percentLabel"),
  habitList: document.getElementById("habitList"),
  emptyState: document.getElementById("emptyState"),
  emptyAddButton: document.getElementById("emptyAddButton"),
  remainingLabel: document.getElementById("remainingLabel"),
  openAddDialog: document.getElementById("openAddDialog"),
  habitDialog: document.getElementById("habitDialog"),
  habitForm: document.getElementById("habitForm"),
  habitName: document.getElementById("habitName"),
  habitTarget: document.getElementById("habitTarget"),
  habitUnit: document.getElementById("habitUnit"),
  suggestionRow: document.getElementById("suggestionRow"),
  iconPicker: document.getElementById("iconPicker"),
  formError: document.getElementById("formError"),
  closeDialog: document.getElementById("closeDialog"),
  cancelDialog: document.getElementById("cancelDialog"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toastMessage"),
  undoButton: document.getElementById("undoButton"),
  celebration: document.getElementById("celebration"),
  detailsTrigger: document.getElementById("detailsTrigger"),
  detailsPanel: document.getElementById("detailsPanel"),
  closeDetails: document.getElementById("closeDetails"),
  historyTabs: document.getElementById("historyTabs"),
  historyTabs: document.getElementById("historyTabs"),
  historySummary: document.getElementById("historySummary"),
  historyContent: document.getElementById("historyContent"),
  historyLegend: document.getElementById("historyLegend"),
  historyDateView: document.getElementById("historyDateView"),
  historyDate: document.getElementById("historyDate"),
  previousDay: document.getElementById("previousDay"),
  nextDay: document.getElementById("nextDay"),
  historyDaySummary: document.getElementById("historyDaySummary"),
  historyDayList: document.getElementById("historyDayList"),
  shareDetailsButton: document.getElementById("shareDetailsButton"),
  shareDialog: document.getElementById("shareDialog"),
  shareLink: document.getElementById("shareLink"),
  closeShareDialog: document.getElementById("closeShareDialog"),
  cancelShareDialog: document.getElementById("cancelShareDialog"),
  copyShareLink: document.getElementById("copyShareLink"),
  shareBanner: document.getElementById("shareBanner"),
  shareBannerMeta: document.getElementById("shareBannerMeta"),
  exitShareView: document.getElementById("exitShareView"),
  syncStatus: document.getElementById("syncStatus")
};

const legacySharedSnapshot = parseSharedSnapshot();
const isLocalSyncServer = window.location.origin === LOCAL_SERVER_ORIGIN;
const isRemoteLiveView = /\.github\.io$/i.test(window.location.hostname);
const isSharedView = Boolean(legacySharedSnapshot) || isRemoteLiveView;
const sharedSnapshot = legacySharedSnapshot || (isRemoteLiveView ? { mode: "view", shareId: "live", viewDate: getDateKey(new Date()) } : null);
const isReadOnlyShare = isSharedView;
const canEdit = !isReadOnlyShare;
const activeShareId = null;
let habits = isRemoteLiveView ? [] : (legacySharedSnapshot ? legacySharedSnapshot.habits : loadHabits());
let records = isRemoteLiveView ? {} : (legacySharedSnapshot ? legacySharedSnapshot.records : loadRecords());
let currentDateKey = sharedSnapshot ? sharedSnapshot.viewDate : getDateKey(new Date());
let selectedIcon = "spark";
let selectedHistoryRange = "history";
let selectedHistoryDateKey = currentDateKey;
let toastTimer = null;
let undoAction = null;
let detailsCloseTimer = null;
let hasRenderedSummary = false;
let wasAllComplete = false;
let hasOpenedDetails = false;
let liveDataUpdatedAt = "";
let serverSyncTimer = null;
let serverSyncInFlight = false;

if (canEdit) {
  saveHabits();
  saveRecords();
}

function pad(number) { return String(number).padStart(2, "0"); }
function getDateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function getDateFromKey(key) { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day); }
function addDays(date, amount) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn("无法读取本地数据：", error);
    return fallback;
  }
}

function hasLocalValue(key) {
  try { return localStorage.getItem(key) !== null; } catch (error) { return false; }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("无法保存本地数据：", error);
    showToast("当前浏览器无法保存数据");
  }
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseSharedSnapshot() {
  try {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const encoded = params.get("share");
    if (!encoded) return null;
    const payload = JSON.parse(decodeBase64Url(encoded));
    if (!payload || payload.version !== 1 || !Array.isArray(payload.habits)) return null;

    const sharedHabits = payload.habits
      .filter((habit) => habit && habit.id && habit.name)
      .map(normalizeHabit);
    const allowedIds = new Set(sharedHabits.map((habit) => habit.id));
    const sharedRecords = {};

    if (payload.records && typeof payload.records === "object") {
      Object.entries(payload.records).forEach(([dateKey, dayRecord]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !dayRecord || typeof dayRecord !== "object") return;
        const nextDay = {};
        sharedHabits.forEach((habit) => {
          if (!allowedIds.has(habit.id)) return;
          const value = clamp(Math.round(Number(dayRecord[habit.id]) || 0), 0, habit.target);
          if (value > 0) nextDay[habit.id] = value;
        });
        if (Object.keys(nextDay).length > 0) sharedRecords[dateKey] = nextDay;
      });
    }

    const requestedViewDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.viewDate || "") ? payload.viewDate : getDateKey(new Date());
    const mode = payload.mode === "edit" ? "edit" : "view";
    const shareId = String(payload.shareId || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
    return {
      habits: sharedHabits,
      records: sharedRecords,
      viewDate: requestedViewDate,
      exportedAt: payload.exportedAt || "",
      mode,
      shareId: shareId || makeId()
    };
  } catch (error) {
    console.warn("分享链接无法解析：", error);
    return null;
  }
}
function inferHabitDefaults(habit) {
  const name = String(habit.name || "");
  if (name.includes("水")) return { target: 8, unit: "杯", icon: "water" };
  if (/运动|跑步|健身|步/.test(name)) return { target: 20, unit: "分钟", icon: "exercise" };
  if (/读|书|阅读/.test(name)) return { target: 20, unit: "页", icon: "book" };
  if (/睡|休息/.test(name)) return { target: 1, unit: "次", icon: "sleep" };
  if (/学习|课程|英语|背词|复习/.test(name)) return { target: 60, unit: "分钟", icon: "study" };
  if (/冥想|呼吸/.test(name)) return { target: 10, unit: "分钟", icon: "meditate" };
  if (/餐|饮食|蔬菜/.test(name)) return { target: 1, unit: "次", icon: "food" };
  return { target: 1, unit: "次", icon: "spark" };
}

function normalizeHabit(habit) {
  const defaults = inferHabitDefaults(habit);
  const rawIcon = iconAliases[habit.icon] || habit.icon || defaults.icon;
  const icon = ["spark", "water", "exercise", "book", "meditate", "sleep", "food", "study"].includes(rawIcon) ? rawIcon : defaults.icon;
  const targetValue = Number(habit.target);
  const target = Number.isFinite(targetValue) && targetValue > 0 ? clamp(Math.round(targetValue), 1, 999) : defaults.target;
  return {
    id: habit.id || makeId(),
    name: String(habit.name || "新习惯").slice(0, 18),
    icon,
    target,
    unit: String(habit.unit || defaults.unit).slice(0, 4),
    createdAt: habit.createdAt || new Date().toISOString()
  };
}

function getHabitsStorageKey() {
  return activeShareId ? `daymark.shared.${activeShareId}.habits` : HABITS_KEY;
}

function getRecordsStorageKey() {
  return activeShareId ? `daymark.shared.${activeShareId}.records` : RECORDS_KEY;
}
function loadHabits() {
  let stored = readJson(getHabitsStorageKey(), null);
  if (activeShareId && !Array.isArray(stored)) stored = sharedSnapshot.habits;
  if (!activeShareId && !Array.isArray(stored)) stored = readJson(LEGACY_HABITS_KEY, null);

  if (!Array.isArray(stored)) return starterHabits.map(normalizeHabit);

  const normalized = stored.filter((habit) => habit && habit.id && habit.name).map(normalizeHabit);
  if (!activeShareId && !hasLocalValue(LEARNING_MIGRATION_KEY)) {
    const hasStudyHabit = normalized.some((habit) => /学习|课程|英语|背词/.test(habit.name) || habit.icon === "study");
    if (!hasStudyHabit) {
      normalized.push(normalizeHabit({ id: "starter-study", name: "学习", icon: "study", target: 60, unit: "分钟", createdAt: new Date().toISOString() }));
    }
    writeJson(LEARNING_MIGRATION_KEY, true);
  }
  return normalized;
}

function loadRecords() {
  let raw = readJson(getRecordsStorageKey(), null);
  if (activeShareId && (!raw || typeof raw !== "object" || Array.isArray(raw))) raw = sharedSnapshot.records;
  if (!activeShareId && (!raw || typeof raw !== "object" || Array.isArray(raw))) raw = readJson(LEGACY_RECORDS_KEY, {});

  const normalized = {};
  Object.entries(raw).forEach(([dateKey, dayRecord]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const nextDay = {};
    if (Array.isArray(dayRecord)) {
      habits.forEach((habit) => { if (dayRecord.includes(habit.id)) nextDay[habit.id] = habit.target; });
    } else if (dayRecord && typeof dayRecord === "object") {
      habits.forEach((habit) => {
        const value = clamp(Math.round(Number(dayRecord[habit.id]) || 0), 0, habit.target);
        if (value > 0) nextDay[habit.id] = value;
      });
    }
    if (Object.keys(nextDay).length > 0) normalized[dateKey] = nextDay;
  });
  return normalized;
}

function saveHabits() { if (!canEdit) return; writeJson(HABITS_KEY, habits); queueServerSync(); }
function saveRecords() { if (!canEdit) return; writeJson(RECORDS_KEY, records); queueServerSync(); }
function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLivePayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    viewDate: currentDateKey,
    habits,
    records
  };
}

function queueServerSync() {
  if (!isLocalSyncServer || !canEdit) return;
  window.clearTimeout(serverSyncTimer);
  serverSyncTimer = window.setTimeout(syncToLocalServer, 700);
}

async function syncToLocalServer() {
  if (!isLocalSyncServer || !canEdit || serverSyncInFlight) return;
  serverSyncInFlight = true;
  try {
    const response = await fetch(`${LOCAL_SERVER_ORIGIN}/api/data`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getLivePayload())
    });
    if (!response.ok) throw new Error(`Local sync failed: ${response.status}`);
  } catch (error) {
    console.warn("本地同步服务暂时不可用：", error);
  } finally {
    serverSyncInFlight = false;
  }
}

async function initializeLocalServerData() {
  if (!isLocalSyncServer) return;
  try {
    const response = await fetch(`${LOCAL_SERVER_ORIGIN}/api/data`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Local data failed: ${response.status}`);
    const payload = await response.json();
    const hasData = Array.isArray(payload.habits) && payload.habits.length > 0;
    if (!hasData) {
      await syncToLocalServer();
      return;
    }
    applyLivePayload(payload);
  } catch (error) {
    console.warn("无法读取本地同步数据：", error);
  }
}

function normalizeLivePayload(payload) {
  const nextHabits = Array.isArray(payload?.habits)
    ? payload.habits.filter((habit) => habit && habit.id && habit.name).map(normalizeHabit)
    : [];
  const nextRecords = {};
  if (payload?.records && typeof payload.records === "object") {
    Object.entries(payload.records).forEach(([dateKey, dayRecord]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !dayRecord || typeof dayRecord !== "object") return;
      const nextDay = {};
      nextHabits.forEach((habit) => {
        const value = clamp(Math.round(Number(dayRecord[habit.id]) || 0), 0, habit.target);
        if (value > 0) nextDay[habit.id] = value;
      });
      if (Object.keys(nextDay).length > 0) nextRecords[dateKey] = nextDay;
    });
  }
  return { habits: nextHabits, records: nextRecords, viewDate: payload?.viewDate || getDateKey(new Date()), updatedAt: payload?.updatedAt || "" };
}

function applyLivePayload(payload) {
  const normalized = normalizeLivePayload(payload);
  habits = normalized.habits;
  records = normalized.records;
  currentDateKey = normalized.viewDate;
  selectedHistoryDateKey = currentDateKey;
  liveDataUpdatedAt = normalized.updatedAt;
  render();
}

async function loadRemoteLiveData() {
  if (!isRemoteLiveView) return;
  try {
    const response = await fetch(`${LIVE_DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Remote data failed: ${response.status}`);
    const payload = await response.json();
    if (payload.updatedAt && payload.updatedAt === liveDataUpdatedAt) return;
    applyLivePayload(payload);
    elements.shareBannerMeta.textContent = `只读视图 · 已于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date())} 更新`;
  } catch (error) {
    console.warn("共享数据暂时无法读取：", error);
    if (elements.shareBannerMeta) elements.shareBannerMeta.textContent = "只读视图 · 暂时无法连接，正在自动重试";
  }
}
function startRemoteLiveUpdates() {
  if (!isRemoteLiveView) return;
  loadRemoteLiveData();
  if ("EventSource" in window) {
    const events = new EventSource(`https://ntfy.sh/${LIVE_NOTIFY_TOPIC}/sse`);
    events.addEventListener("message", () => loadRemoteLiveData());
  }
  window.setInterval(() => {
    if (!document.hidden) loadRemoteLiveData();
  }, 300000);
}
function getHabitValue(habit) {
  const dayRecord = records[currentDateKey];
  if (!dayRecord || typeof dayRecord !== "object") return 0;
  return clamp(Math.round(Number(dayRecord[habit.id]) || 0), 0, habit.target);
}

function setHabitValue(habitId, value) {
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return 0;
  const nextValue = clamp(Math.round(Number(value) || 0), 0, habit.target);
  const dayRecord = records[currentDateKey] && typeof records[currentDateKey] === "object" ? { ...records[currentDateKey] } : {};
  if (nextValue > 0) {
    dayRecord[habitId] = nextValue;
    records[currentDateKey] = dayRecord;
  } else {
    delete dayRecord[habitId];
    if (Object.keys(dayRecord).length > 0) records[currentDateKey] = dayRecord;
    else delete records[currentDateKey];
  }
  saveRecords();
  return nextValue;
}

function getCompletedIds() {
  return new Set(habits.filter((habit) => getHabitValue(habit) >= habit.target).map((habit) => habit.id));
}

function getStreak(habitId) {
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return 0;
  const cursor = getDateFromKey(currentDateKey);
  const todayRecord = records[currentDateKey] || {};
  if ((Number(todayRecord[habitId]) || 0) < habit.target) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (streak < 3660) {
    const dayRecord = records[getDateKey(cursor)] || {};
    if ((Number(dayRecord[habitId]) || 0) < habit.target) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getEncouragement(done, total) {
  if (total === 0) return "从一件小事开始。";
  if (done === 0) return "先完成最容易的一项吧。";
  if (done === total) return "今天全部完成，做得漂亮。";
  if (done === 1) return "已经迈出第一步了。";
  if (done / total >= 0.5) return "已经过半，保持这个节奏。";
  return "一点点积累，也算向前。";
}

function renderIcon(icon) {
  const icons = {
    water: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2S6.5 9.1 6.5 13.9a5.5 5.5 0 0 0 11 0C17.5 9.1 12 3.2 12 3.2Z"></path><path d="M10 14.5c.4 1 1.2 1.6 2.3 1.8"></path></svg>',
    exercise: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="15.8" cy="5.5" r="2"></circle><path d="M12.7 9.2l3.2 1.2 3.2-1.6M12.7 9.2l-2.2 4.3-3.7 1.7M12.7 9.2l3.1 4.3 3.8 5.1M14.2 13.2l-2.4 6.5"></path></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c2.8-.8 5.4-.2 8 1.6v12c-2.6-1.8-5.2-2.4-8-1.6v-12ZM20 5.5c-2.8-.8-5.4-.2-8 1.6v12c2.6-1.8 5.2-2.4 8-1.6v-12Z"></path></svg>',
    sleep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.8 15.2A8 8 0 0 1 8.8 5.2a8.2 8.2 0 1 0 10 10Z"></path><path d="M16.4 5.2l.5 1.2 1.3.5-1.3.5-.5 1.2-.5-1.2-1.3-.5 1.3-.5.5-1.2Z"></path></svg>',
    study: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.8 12 4l9 4.8-9 4.8-9-4.8Z"></path><path d="M7 11v4.2c2.7 2.2 7.3 2.2 10 0V11M21 9v5"></path></svg>',
    meditate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.2" r="2"></circle><path d="M12 8v5M7 10.8l5 2.2 5-2.2M5 17.8c2.2 1.3 4.5 1.9 7 1.9s4.8-.6 7-1.9M8.8 13.2 6.2 17M15.2 13.2l2.6 3.8"></path></svg>',
    food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13.5c0-4.8 4-8.5 9.5-8.5H20c0 5.5-4.3 9-10 9H5v-.5Z"></path><path d="M4 20h16M7 17.5c1.6 1.5 4.1 2.3 7.5 2.3"></path></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.4 5.2L20 10.5l-5.6 2.3L12 18l-2.4-5.2L4 10.5l5.6-2.3L12 3Z"></path></svg>'
  };
  return icons[icon] || `<span class="habit-icon-emoji">${escapeHtml(icon || "✨")}</span>`;
}

function getMetaText(habit, value) {
  const streak = getStreak(habit.id);
  if (value >= habit.target) return streak > 1 ? `连续 ${streak} 天 · 今天已完成` : "今天已完成 · 明天继续";
  if (value > 0) return streak > 0 ? `连续 ${streak} 天 · 今天继续` : `还差 ${habit.target - value} ${habit.unit}`;
  return streak > 0 ? `连续 ${streak} 天 · 今天继续` : "从今天开始";
}

function buildHabitMarkup(habit, completedIds) {
  const value = getHabitValue(habit);
  const isComplete = completedIds.has(habit.id);
  const percent = Math.round((value / habit.target) * 100);
  const actionLabel = isComplete ? `重置“${habit.name}”的完成量` : `将“${habit.name}”标记为完成`;
  const progressLabel = `更新“${habit.name}”完成量，当前 ${value} / ${habit.target} ${habit.unit}`;

  return `
    <article class="habit-item${isComplete ? " is-complete" : ""}${isReadOnlyShare ? " is-readonly" : ""}" data-id="${escapeHtml(habit.id)}">
      <button class="check-button" type="button" data-action="toggle" data-id="${escapeHtml(habit.id)}" aria-pressed="${isComplete}" aria-label="${escapeHtml(actionLabel)}"${isReadOnlyShare ? " disabled" : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.3 4.3L19 7.5"></path></svg>
      </button>
      <div class="habit-identity">
        <div class="habit-icon" aria-hidden="true">${renderIcon(habit.icon)}</div>
        <div class="habit-copy">
          <div class="habit-title-line">
            <h3 class="habit-name">${escapeHtml(habit.name)}</h3>
            <span class="habit-amount">${value} / ${habit.target} ${escapeHtml(habit.unit)}</span>
          </div>
          <p class="habit-meta">${escapeHtml(getMetaText(habit, value))}</p>
          <div class="habit-progress-wrap">
            <span class="habit-progress-track" aria-hidden="true"><span class="habit-progress-fill" style="width: ${percent}%"></span></span>
            <input class="habit-progress-input" type="range" min="0" max="${habit.target}" step="1" value="${value}" data-action="progress" data-id="${escapeHtml(habit.id)}" aria-label="${escapeHtml(progressLabel)}" aria-valuetext="${value} / ${habit.target} ${escapeHtml(habit.unit)}"${isReadOnlyShare ? " disabled" : ""}>
          </div>
        </div>
      </div>
      <button class="delete-button" type="button" data-action="delete" data-id="${escapeHtml(habit.id)}" aria-label="删除“${escapeHtml(habit.name)}”"${isReadOnlyShare ? " hidden" : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
    </article>
  `;
}

function updateDateLabel() {
  elements.dateLabel.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

function updateSummary(options = {}) {
  const { allowCelebration = false } = options;
  const completedIds = getCompletedIds();
  const total = habits.length;
  const done = habits.filter((habit) => completedIds.has(habit.id)).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const circumference = 2 * Math.PI * 50;
  const allComplete = total > 0 && done === total;

  elements.doneCount.textContent = String(done);
  elements.totalCount.textContent = String(total);
  elements.percentLabel.textContent = `${percent}%`;
  elements.encouragement.textContent = getEncouragement(done, total);
  elements.progressFill.style.width = `${percent}%`;
  elements.ringProgress.style.strokeDashoffset = String(circumference * (1 - percent / 100));
  elements.progressTrack.setAttribute("aria-valuenow", String(percent));

  if (total === 0) elements.remainingLabel.textContent = "还没有习惯";
  else if (allComplete) elements.remainingLabel.textContent = "今日全部完成";
  else elements.remainingLabel.textContent = `还有 ${total - done} 项`;

  elements.summaryCard.classList.toggle("is-all-done", allComplete);
  if (hasRenderedSummary && allowCelebration && allComplete && !wasAllComplete) triggerCelebration();
  hasRenderedSummary = true;
  wasAllComplete = allComplete;
}

function renderShareBanner() {
  if (!isSharedView) {
    elements.shareBanner.hidden = true;
    elements.syncStatus.textContent = isLocalSyncServer
      ? "本机操作 · 自动同步至 GitHub Pages"
      : "本地浏览器数据";
    return;
  }
  elements.syncStatus.textContent = "只读视图 · 自动接收本机更新";
  elements.shareBanner.hidden = false;
  elements.exitShareView.hidden = isRemoteLiveView;
  if (isRemoteLiveView) {
    elements.shareBanner.querySelector("strong").textContent = "正在查看实时数据";
    elements.shareBannerMeta.textContent = "只读视图 · 每 5 秒自动同步本机最新数据";
  } else {
    elements.shareBanner.querySelector("strong").textContent = "正在查看分享数据";
    elements.shareBannerMeta.textContent = "只读预览，不能增加、修改或删除内容";
  }
}

function render(options = {}) {
  const completedIds = getCompletedIds();
  elements.habitList.innerHTML = habits.map((habit) => buildHabitMarkup(habit, completedIds)).join("");
  elements.habitList.hidden = habits.length === 0;
  elements.emptyState.hidden = habits.length > 0;
  elements.openAddDialog.hidden = isReadOnlyShare;
  elements.emptyAddButton.hidden = isReadOnlyShare;
  elements.shareDetailsButton.hidden = isSharedView || !isLocalSyncServer;
  renderShareBanner();
  updateDateLabel();
  updateSummary(options);
  if (!elements.detailsPanel.hidden) renderHistory();
}

function toggleHabit(habitId) {
  if (!canEdit) return;
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return;
  const currentValue = getHabitValue(habit);
  const nextValue = currentValue >= habit.target ? 0 : habit.target;
  setHabitValue(habitId, nextValue);
  render({ allowCelebration: nextValue === habit.target });
}

function deleteHabit(habitId) {
  if (!canEdit) return;
  const index = habits.findIndex((habit) => habit.id === habitId);
  if (index === -1) return;
  const removedHabit = habits[index];
  const savedValues = Object.entries(records)
    .map(([dateKey, dayRecord]) => [dateKey, Number(dayRecord[habitId]) || 0])
    .filter(([, value]) => value > 0);

  habits.splice(index, 1);
  Object.keys(records).forEach((dateKey) => {
    if (!records[dateKey] || typeof records[dateKey] !== "object") return;
    delete records[dateKey][habitId];
    if (Object.keys(records[dateKey]).length === 0) delete records[dateKey];
  });

  saveHabits();
  saveRecords();
  render();
  showToast(`已删除“${removedHabit.name}”`, () => {
    habits.splice(Math.min(index, habits.length), 0, removedHabit);
    savedValues.forEach(([dateKey, value]) => {
      records[dateKey] = { ...(records[dateKey] || {}), [habitId]: value };
    });
    saveHabits();
    saveRecords();
    render();
    showToast("习惯已恢复");
  });
}

function updateProgressRow(item, habit, value) {
  const percent = Math.round((value / habit.target) * 100);
  const isComplete = value >= habit.target;
  const checkButton = item.querySelector(".check-button");
  const progressInput = item.querySelector(".habit-progress-input");
  item.classList.toggle("is-complete", isComplete);
  item.querySelector(".habit-progress-fill").style.width = `${percent}%`;
  item.querySelector(".habit-amount").textContent = `${value} / ${habit.target} ${habit.unit}`;
  item.querySelector(".habit-meta").textContent = getMetaText(habit, value);
  checkButton.setAttribute("aria-pressed", String(isComplete));
  checkButton.setAttribute("aria-label", isComplete ? `重置“${habit.name}”的完成量` : `将“${habit.name}”标记为完成`);
  if (progressInput) progressInput.setAttribute("aria-valuetext", `${value} / ${habit.target} ${habit.unit}`);
}

function triggerCelebration() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elements.celebration.replaceChildren();
  const colors = ["#8f7bff", "#58bfd0", "#c8bfff", "#ffffff"];
  for (let index = 0; index < 18; index += 1) {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 18 + Math.random() * 0.25;
    const distance = 95 + Math.random() * 115;
    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance + 35}px`);
    particle.style.setProperty("--r", `${Math.round(Math.random() * 420 - 210)}deg`);
    particle.style.background = colors[index % colors.length];
    particle.style.animationDelay = `${Math.random() * 80}ms`;
    elements.celebration.append(particle);
  }
  elements.celebration.classList.remove("is-active");
  void elements.celebration.offsetWidth;
  elements.celebration.classList.add("is-active");
  window.setTimeout(() => elements.celebration.classList.remove("is-active"), 1100);
}

function showToast(message, onUndo = null) {
  window.clearTimeout(toastTimer);
  undoAction = onUndo;
  elements.toastMessage.textContent = message;
  elements.undoButton.hidden = !onUndo;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    undoAction = null;
  }, onUndo ? 6500 : 2600);
}

function openDialog() {
  if (!canEdit) return;
  elements.habitForm.reset();
  elements.habitTarget.value = "1";
  elements.habitUnit.value = "次";
  elements.formError.textContent = "";
  selectIcon("spark");
  elements.habitDialog.showModal();
  window.setTimeout(() => elements.habitName.focus(), 50);
}

function closeDialog() {
  if (elements.habitDialog.open) elements.habitDialog.close();
}

function selectIcon(icon) {
  selectedIcon = icon;
  elements.iconPicker.querySelectorAll("button").forEach((button) => {
    const isSelected = button.dataset.icon === icon;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function addHabit(event) {
  if (!canEdit) return;
  event.preventDefault();
  const name = elements.habitName.value.trim().replace(/\s+/g, " ");
  const target = clamp(Math.round(Number(elements.habitTarget.value) || 0), 0, 999);
  const unit = elements.habitUnit.value || "次";

  if (!name) {
    elements.formError.textContent = "先写下一个想坚持的习惯。";
    elements.habitName.focus();
    return;
  }
  if (target < 1) {
    elements.formError.textContent = "每日目标至少是 1。";
    elements.habitTarget.focus();
    return;
  }
  const duplicate = habits.some((habit) => habit.name.toLocaleLowerCase("zh-CN") === name.toLocaleLowerCase("zh-CN"));
  if (duplicate) {
    elements.formError.textContent = "这个习惯已经在清单里了。";
    elements.habitName.focus();
    return;
  }

  const habit = { id: makeId(), name, icon: selectedIcon, target, unit, createdAt: new Date().toISOString() };
  habits.push(habit);
  saveHabits();
  closeDialog();
  render();
  showToast(`已添加“${name}”`);
  window.setTimeout(() => {
    const newButton = elements.habitList.querySelector(`[data-action="toggle"][data-id="${habit.id}"]`);
    if (newButton) newButton.focus();
  }, 60);
}

function makeShareLink(mode) {
  const shareId = activeShareId || makeId();
  const payload = {
    version: 1,
    mode: mode === "edit" ? "edit" : "view",
    shareId,
    exportedAt: new Date().toISOString(),
    viewDate: currentDateKey,
    habits,
    records
  };
  const baseUrl = window.location.href.split("#")[0];
  return `${baseUrl}#share=${encodeBase64Url(JSON.stringify(payload))}`;
}

function getSelectedShareMode() {
  const selected = elements.shareDialog.querySelector('input[name="shareMode"]:checked');
  return selected ? selected.value : "edit";
}

function refreshShareLink() {
  const mode = getSelectedShareMode();
  elements.shareLink.value = makeShareLink(mode);
  elements.shareDialog.querySelector("#shareHelp").textContent = mode === "edit"
    ? "可操作链接会载入一份独立数据副本，在此浏览器中的修改会继续保存在本地。"
    : "只读链接只展示当前快照，打开后不能新增、修改或删除任何数据。";
}

function openShareDialog() {
  const preferredMode = isSharedView ? sharedSnapshot.mode : "edit";
  elements.shareDialog.querySelectorAll('input[name="shareMode"]').forEach((input) => {
    input.checked = input.value === preferredMode;
  });
  refreshShareLink();
  elements.shareDialog.showModal();
  window.setTimeout(() => elements.shareLink.select(), 60);
}

function closeShareDialog() {
  if (elements.shareDialog.open) elements.shareDialog.close();
}

async function copyShareLinkToClipboard() {
  const link = elements.shareLink.value;
  try {
    await navigator.clipboard.writeText(link);
  } catch (error) {
    elements.shareLink.focus();
    elements.shareLink.select();
    document.execCommand("copy");
  }
  showToast("分享链接已复制");
}

function exitSharedView() {
  window.location.href = window.location.href.split("#")[0];
}
function getPeriods(range) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (range === "week") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      return {
        label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date),
        subLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        start: getDateKey(date),
        end: getDateKey(date)
      };
    });
  }

  if (range === "month") {
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const periods = [];
    for (let startDay = 1, index = 1; startDay <= lastDay; startDay += 7, index += 1) {
      const endDay = Math.min(startDay + 6, lastDay);
      periods.push({
        label: `第${index}周`,
        subLabel: `${startDay}-${endDay}日`,
        start: getDateKey(new Date(year, month, startDay)),
        end: getDateKey(new Date(year, month, endDay))
      });
    }
    return periods;
  }

  const year = today.getFullYear();
  return Array.from({ length: 12 }, (_, month) => ({
    label: `${month + 1}月`,
    subLabel: "",
    start: getDateKey(new Date(year, month, 1)),
    end: getDateKey(new Date(year, month + 1, 0))
  }));
}

function keysInRange(startKey, endKey) {
  const keys = [];
  const cursor = getDateFromKey(startKey);
  const end = getDateFromKey(endKey);
  while (cursor <= end) {
    keys.push(getDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function getPeriodRatio(habit, period) {
  const keys = keysInRange(period.start, period.end);
  if (keys.length === 0) return 0;
  const score = keys.reduce((sum, dateKey) => {
    const value = clamp(Number(records[dateKey]?.[habit.id]) || 0, 0, habit.target);
    return sum + value / habit.target;
  }, 0);
  return score / keys.length;
}

function getHeatLevel(ratio) {
  if (ratio <= 0) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

function renderHistoryDate() {
  const date = getDateFromKey(selectedHistoryDateKey);
  const todayKey = getDateKey(new Date());
  const dayRecord = records[selectedHistoryDateKey] || {};
  const total = habits.length;
  const completed = habits.filter((habit) => (Number(dayRecord[habit.id]) || 0) >= habit.target).length;
  const averageRatio = total === 0
    ? 0
    : habits.reduce((sum, habit) => sum + clamp((Number(dayRecord[habit.id]) || 0) / habit.target, 0, 1), 0) / total;

  elements.historyDate.value = selectedHistoryDateKey;
  elements.historyDate.max = todayKey;
  elements.nextDay.disabled = selectedHistoryDateKey >= todayKey;
  elements.historyDaySummary.innerHTML = `
    <div>
      <p>${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date)}</p>
      <strong>${completed}<span> / ${total} 项完成</span></strong>
    </div>
    <b>${Math.round(averageRatio * 100)}%</b>
  `;

  if (habits.length === 0) {
    elements.historyDayList.innerHTML = '<p class="history-empty">还没有可查询的习惯。</p>';
    return;
  }

  elements.historyDayList.innerHTML = habits.map((habit) => {
    const value = clamp(Number(dayRecord[habit.id]) || 0, 0, habit.target);
    const percent = Math.round((value / habit.target) * 100);
    return `
      <article class="history-day-item">
        <span class="history-habit-icon" aria-hidden="true">${renderIcon(habit.icon)}</span>
        <div>
          <div class="history-day-item-head">
            <strong>${escapeHtml(habit.name)}</strong>
            <span>${value} / ${habit.target} ${escapeHtml(habit.unit)}</span>
          </div>
          <div class="history-day-progress"><i style="width: ${percent}%"></i></div>
        </div>
        <b>${percent}%</b>
      </article>
    `;
  }).join("");
}
function renderHistory() {
  const historyMode = selectedHistoryRange === "history";
  elements.historyDateView.hidden = !historyMode;
  elements.historySummary.hidden = historyMode;
  elements.historyContent.hidden = historyMode;
  elements.historyLegend.hidden = historyMode;

  if (historyMode) {
    renderHistoryDate();
    return;
  }

  const periods = getPeriods(selectedHistoryRange);
  const averages = [];

  if (habits.length === 0) {
    elements.historySummary.innerHTML = "<strong>暂无记录</strong><span>添加习惯后，这里会自动记录每日完成量</span>";
    elements.historyContent.innerHTML = '<p class="history-empty">还没有可统计的习惯。</p>';
    return;
  }

  const bodyRows = habits.map((habit) => {
    const cells = periods.map((period) => {
      const ratio = getPeriodRatio(habit, period);
      averages.push(ratio);
      const percent = Math.round(ratio * 100);
      const level = getHeatLevel(ratio);
      const title = `${period.label}${period.subLabel ? ` ${period.subLabel}` : ""}：${percent}%`;
      return `<td><span class="history-cell level-${level}" title="${title}" aria-label="${title}">${percent}</span></td>`;
    }).join("");

    return `
      <tr>
        <th scope="row">
          <span class="history-habit-icon" aria-hidden="true">${renderIcon(habit.icon)}</span>
          <span>${escapeHtml(habit.name)}</span>
        </th>
        ${cells}
      </tr>
    `;
  }).join("");

  const average = averages.length === 0 ? 0 : averages.reduce((sum, value) => sum + value, 0) / averages.length;
  const rangeCopy = { week: "近 7 天平均完成率", month: "本月平均完成率", year: "本年平均完成率" }[selectedHistoryRange];
  elements.historySummary.innerHTML = `<strong>${Math.round(average * 100)}%</strong><span>${rangeCopy}</span>`;
  elements.historyContent.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th scope="col">习惯</th>
          ${periods.map((period) => `<th scope="col"><span>${period.label}</span>${period.subLabel ? `<small>${period.subLabel}</small>` : ""}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

function openDetails() {
  window.clearTimeout(detailsCloseTimer);
  elements.detailsPanel.hidden = false;
  elements.detailsTrigger.setAttribute("aria-expanded", "true");
  renderHistory();
  window.requestAnimationFrame(() => elements.detailsPanel.classList.add("is-open"));
}

function closeDetails() {
  elements.detailsTrigger.setAttribute("aria-expanded", "false");
  elements.detailsPanel.classList.remove("is-open");
  detailsCloseTimer = window.setTimeout(() => { elements.detailsPanel.hidden = true; }, 240);
}

elements.habitList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  if (action === "toggle") toggleHabit(id);
  if (action === "delete") deleteHabit(id);
});

elements.habitList.addEventListener("input", (event) => {
  const input = event.target.closest('.habit-progress-input[data-action="progress"]');
  if (!input) return;
  const habit = habits.find((item) => item.id === input.dataset.id);
  if (!habit) return;
  const value = setHabitValue(habit.id, input.value);
  const item = input.closest(".habit-item");
  if (item) updateProgressRow(item, habit, value);
  updateSummary({ allowCelebration: true });
  if (!elements.detailsPanel.hidden) renderHistory();
});

elements.openAddDialog.addEventListener("click", openDialog);
elements.emptyAddButton.addEventListener("click", openDialog);
elements.closeDialog.addEventListener("click", closeDialog);
elements.cancelDialog.addEventListener("click", closeDialog);
elements.habitForm.addEventListener("submit", addHabit);

elements.detailsTrigger.addEventListener("click", () => {
  if (elements.detailsPanel.hidden || !elements.detailsPanel.classList.contains("is-open")) openDetails();
  else closeDetails();
});
elements.closeDetails.addEventListener("click", closeDetails);

elements.historyTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-range]");
  if (!button) return;
  selectedHistoryRange = button.dataset.range;
  elements.historyTabs.querySelectorAll("button").forEach((tab) => {
    const isActive = tab === button;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  renderHistory();
});

elements.previousDay.addEventListener("click", () => {
  const next = addDays(getDateFromKey(selectedHistoryDateKey), -1);
  selectedHistoryDateKey = getDateKey(next);
  renderHistoryDate();
});

elements.nextDay.addEventListener("click", () => {
  const todayKey = getDateKey(new Date());
  const next = addDays(getDateFromKey(selectedHistoryDateKey), 1);
  selectedHistoryDateKey = getDateKey(next) > todayKey ? todayKey : getDateKey(next);
  renderHistoryDate();
});

elements.historyDate.addEventListener("change", () => {
  if (!elements.historyDate.value) return;
  const todayKey = getDateKey(new Date());
  selectedHistoryDateKey = elements.historyDate.value > todayKey ? todayKey : elements.historyDate.value;
  renderHistoryDate();
});

elements.shareDetailsButton.addEventListener("click", openShareDialog);
elements.closeShareDialog.addEventListener("click", closeShareDialog);
elements.cancelShareDialog.addEventListener("click", closeShareDialog);
elements.copyShareLink.addEventListener("click", copyShareLinkToClipboard);
elements.shareDialog.addEventListener("change", (event) => {
  if (event.target.matches('input[name="shareMode"]')) refreshShareLink();
});
elements.shareDialog.addEventListener("click", (event) => {
  if (event.target === elements.shareDialog) closeShareDialog();
});
elements.exitShareView.addEventListener("click", exitSharedView);
elements.undoButton.addEventListener("click", () => {
  window.clearTimeout(toastTimer);
  elements.toast.classList.remove("is-visible");
  if (typeof undoAction === "function") undoAction();
  undoAction = null;
});

elements.suggestionRow.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-name]");
  if (!button) return;
  elements.habitName.value = button.dataset.name;
  elements.habitTarget.value = button.dataset.target || "1";
  elements.habitUnit.value = button.dataset.unit || "次";
  selectIcon(button.dataset.icon || "spark");
  elements.formError.textContent = "";
  elements.habitName.focus();
});

elements.iconPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-icon]");
  if (!button) return;
  selectIcon(button.dataset.icon);
});

elements.habitDialog.addEventListener("click", (event) => {
  if (event.target !== elements.habitDialog) return;
  const bounds = elements.habitDialog.getBoundingClientRect();
  const clickedInside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (!clickedInside) closeDialog();
});

elements.habitName.addEventListener("input", () => { elements.formError.textContent = ""; });
elements.habitTarget.addEventListener("input", () => { elements.formError.textContent = ""; });

document.addEventListener("click", (event) => {
  if (elements.detailsPanel.hidden) return;
  if (elements.detailsPanel.contains(event.target) || elements.detailsTrigger.contains(event.target)) return;
  closeDetails();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.detailsPanel.hidden) closeDetails();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const nextDateKey = getDateKey(new Date());
  if (nextDateKey !== currentDateKey) {
    currentDateKey = nextDateKey;
    render();
  }
});

window.setInterval(() => {
  const nextDateKey = getDateKey(new Date());
  if (nextDateKey !== currentDateKey) {
    currentDateKey = nextDateKey;
    render();
  }
}, 60000);

render();





















if (isLocalSyncServer) initializeLocalServerData();
if (isRemoteLiveView) startRemoteLiveUpdates();




