// ============================================================================
// LOGIC ĐIỀU KHIỂN CHÍNH - HOÀN THIỆN ĐẦY ĐỦ 6 ĐỀ XUẤT
// (Lớp học tinh gọn, Ẩn/Hiện điểm, Point Line đối chiếu, FX, Chia Nhóm & Ranking)
// TÍCH HỢP FIREBASE AUTHENTICATION (GOOGLE + EMAIL) & FIRESTORE CLOUD DATABASE
// ============================================================================

// Cấu hình Firebase Web App của dự án ClassJoy
const firebaseConfig = {
  apiKey: "AIzaSyDmx7CWhrmp2KEXnnohze69ourhkvgOLoM",
  authDomain: "classjoy-1a767.firebaseapp.com",
  projectId: "classjoy-1a767",
  storageBucket: "classjoy-1a767.firebasestorage.app",
  messagingSenderId: "826900433367",
  appId: "1:826900433367:web:4a34bca83f404ce6f36392",
  measurementId: "G-L7MFCGL2D9"
};

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let currentFirebaseUser = null;
let isDemoMode = false;
let currentAuthMode = "login"; // 'login' | 'register'
let studentPortalLiveUnsub = null;
let studentPortalLiveClassId = null;

try {
  if (typeof firebase !== "undefined") {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    firestoreDb = firebase.firestore();
  }
} catch (e) {
  console.warn("Firebase Init:", e);
}

function getStorageKey(user = currentFirebaseUser) {
  if (user && user.uid) {
    return `CLASSJOY_TEACHER_${user.uid}`;
  }
  return "CLASSJOY_DEMO_STATE";
}

let appState = loadState();
if (typeof appState.isPointsHidden === "undefined") {
  appState.isPointsHidden = false;
}
if (!appState.pointLineMilestones || appState.pointLineMilestones.length === 0) {
  appState.pointLineMilestones = JSON.parse(JSON.stringify(DEFAULT_DATA.pointLineMilestones));
}

let currentClassId = appState.classes[0]?.id || "class-10a1";
let currentGroupFilter = "ALL";
let currentMainTab = "classroom";
let activeStudentModalId = null;
let isSidebarCollapsed = true; // Mặc định toàn màn hình lưới học sinh ngay khi đăng nhập
let isPointLineCollapsed = false;
let revealedStudentIds = new Set(); // Cho phép hiển thị điểm riêng của từng học sinh khi đang bật chế độ Ẩn điểm chung

// Biến phục vụ Quản lý Nhóm & Ranking
let activeGroupModalName = null;
let currentRankingPeriod = "week"; // 'week' | 'month' | 'all'

// Biến phục vụ Random Học sinh & Random Thẻ
let lastPickedStudentId = null;
let currentRandomCardMode = "power";
let lastDrawnCardTemplate = null;
let currentRandomSelectionMode = "criteria"; // 'criteria' | 'custom'
let customSelectedStudentIds = new Set();

// Biến phục vụ Đồng hồ đếm ngược 10 phút phát biểu
let speechTimerSeconds = 600;
let speechTimerInterval = null;

// Biến phục vụ Atmosphere FX
let fxTimeoutId = null;
let audioCtx = null;

// ----------------------------------------------------------------------------
// 1. KHỞI TẠO & LƯU TRỮ DỮ LIỆU
// ----------------------------------------------------------------------------
function resolveFrameUrl(path) {
  if (!path) return "1.jpg";
  const clean = String(path).replace(/^Card\//i, "");
  return clean || "1.jpg";
}

function extractClassShortCode(className) {
  const raw = (className || "").trim();
  // Tìm mã lớp phổ biến như 10A1, 11B2, 12C, 6A, 9B1...
  const match = raw.match(/\b(\d{1,2}[A-Za-z]+\d*)\b/);
  if (match) return match[1].toUpperCase();
  // Bỏ dấu tiếng Việt và lấy ký tự chữ/số viết tắt
  const noAccent = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/^Lop\s+/i, "");
  const words = noAccent.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 1 && words[0].length <= 6) {
    return words[0].toUpperCase();
  }
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  return (initials || "LOP").slice(0, 6);
}

function generateNextStudentCode(cls, offset = 0) {
  const prefix = extractClassShortCode(cls?.name || "LOP");
  let maxNum = 0;
  if (cls && Array.isArray(cls.students)) {
    cls.students.forEach((s) => {
      const m = (s.code || "").match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }
  const nextNum = maxNum + 1 + offset;
  return `${prefix}-${String(nextNum).padStart(2, "0")}`;
}

const STUDENT_PW_STORAGE_KEY = "CLASSJOY_STUDENT_PASSWORDS";

function getSavedStudentPasswordsMap() {
  try {
    const raw = localStorage.getItem(STUDENT_PW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStudentPasswordToStore(student, newPassword) {
  if (!student) return;
  const map = getSavedStudentPasswordsMap();
  const codeKey = (student.code || "").trim().toUpperCase();
  const userKey = (student.username || student.code || "").trim().toLowerCase();
  if (codeKey) map[codeKey] = String(newPassword);
  if (userKey) map[userKey] = String(newPassword);
  if (student.id) map[student.id] = String(newPassword);
  try {
    localStorage.setItem(STUDENT_PW_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Không thể lưu mật khẩu học sinh vào bộ nhớ:", e);
  }

  // Đồng bộ mật khẩu mới vào tất cả các bản lưu trạng thái cục bộ (Demo & Giáo viên)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === "CLASSJOY_DEMO_STATE" || (k && k.startsWith("CLASSJOY_TEACHER_"))) {
        const rawState = localStorage.getItem(k);
        if (!rawState) continue;
        const parsed = JSON.parse(rawState);
        let changed = false;
        if (Array.isArray(parsed.classes)) {
          parsed.classes.forEach((c) => {
            if (Array.isArray(c.students)) {
              c.students.forEach((s) => {
                const sCode = (s.code || "").trim().toUpperCase();
                const sUser = (s.username || s.code || "").trim().toLowerCase();
                if ((codeKey && sCode === codeKey) || (userKey && sUser === userKey) || (student.id && s.id === student.id)) {
                  s.password = String(newPassword);
                  changed = true;
                }
              });
            }
          });
        }
        if (changed) {
          localStorage.setItem(k, JSON.stringify(parsed));
        }
      }
    }
  } catch (e) {
    console.warn("Không thể đồng bộ mật khẩu sang các trạng thái lưu trữ:", e);
  }
}

function applySavedStudentPasswords(state) {
  if (!state || !Array.isArray(state.classes)) return;
  const map = getSavedStudentPasswordsMap();
  state.classes.forEach((cls) => {
    if (Array.isArray(cls.students)) {
      cls.students.forEach((st) => {
        const codeKey = (st.code || "").trim().toUpperCase();
        const userKey = (st.username || st.code || "").trim().toLowerCase();
        const savedPw = map[st.id] || map[codeKey] || map[userKey];
        if (savedPw) {
          st.password = String(savedPw);
        }
      });
    }
  });
}

function getCardCategories(type) {
  if (typeof CARD_CATEGORIES !== "undefined" && CARD_CATEGORIES[type]) {
    return CARD_CATEGORIES[type];
  }
  if (type === "power") {
    return ["Nhóm Trợ giúp học tập", "Nhóm Chiến lược", "Nhóm Tương tác"];
  }
  return ["Nhóm Hỗ trợ giáo viên", "Nhóm Phát triển Bản thân", "Nhóm Kỹ năng"];
}

function normalizeCardCategory(rawCat, type, fallbackIdx = 0) {
  const categories = getCardCategories(type);
  const clean = String(rawCat || "").trim();
  if (!clean) {
    return categories[fallbackIdx % categories.length];
  }
  const lower = clean.toLowerCase();
  // Khớp theo số thứ tự 1, 2, 3
  if (lower === "1" || lower === "nhóm 1") return categories[0];
  if (lower === "2" || lower === "nhóm 2") return categories[1];
  if (lower === "3" || lower === "nhóm 3") return categories[2];

  // Khớp chính xác hoặc không phân biệt hoa thường
  for (const cat of categories) {
    const catLower = cat.toLowerCase();
    const shortCatLower = catLower.replace(/^nhóm\s+/i, "").trim();
    if (lower === catLower || lower === shortCatLower || lower.includes(shortCatLower) || shortCatLower.includes(lower)) {
      return cat;
    }
  }

  // Khớp theo từ khóa không dấu
  const noAccent = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (type === "power") {
    if (noAccent.includes("tro giup") || noAccent.includes("hoc tap")) return categories[0];
    if (noAccent.includes("chien luoc")) return categories[1];
    if (noAccent.includes("tuong tac")) return categories[2];
  } else {
    if (noAccent.includes("ho tro") || noAccent.includes("giao vien")) return categories[0];
    if (noAccent.includes("phat trien") || noAccent.includes("ban than")) return categories[1];
    if (noAccent.includes("ky nang")) return categories[2];
  }

  return categories[fallbackIdx % categories.length];
}

function sanitizeCardFrames(state) {
  if (!state) return;
  if (Array.isArray(state.powerCards)) {
    state.powerCards.forEach((c, idx) => {
      if (c.cardFrame) c.cardFrame = resolveFrameUrl(c.cardFrame);
      c.category = normalizeCardCategory(c.category, "power", idx);
    });
  }
  if (Array.isArray(state.penaltyCards)) {
    state.penaltyCards.forEach((c, idx) => {
      if (c.cardFrame) c.cardFrame = resolveFrameUrl(c.cardFrame);
      c.category = normalizeCardCategory(c.category, "penalty", idx);
    });
  }
  if (Array.isArray(state.classes)) {
    state.classes.forEach((cls) => {
      const prefix = extractClassShortCode(cls.name);
      if (Array.isArray(cls.students)) {
        cls.students.forEach((st, idx) => {
          // Chuẩn hóa mã HS cũ (HS01 -> 10A1-01) và tự động tạo tài khoản + mật khẩu mặc định 123456
          if (!st.code || /^HS\d+$/i.test(st.code)) {
            const numMatch = (st.code || "").match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0], 10) : idx + 1;
            st.code = `${prefix}-${String(num).padStart(2, "0")}`;
          }
          st.username = (st.username || st.code).toLowerCase();
          if (!st.password) {
            st.password = "123456";
          }
          if (Array.isArray(st.ownedCards)) {
            st.ownedCards.forEach((c) => {
              if (c.cardFrame) c.cardFrame = resolveFrameUrl(c.cardFrame);
            });
          }
        });
      }
    });
  }
  applySavedStudentPasswords(state);
}

function ensureUniqueClassIds(state, user) {
  if (!state || !user || !user.uid) return;
  const prefix = `cls_${user.uid.slice(0, 6)}_`;
  if (Array.isArray(state.classes)) {
    state.classes.forEach((cls, idx) => {
      if (!cls.id || cls.id === "class-10a1" || cls.id === "class-11b2" || cls.id === "class-my-1" || !cls.id.startsWith("cls_")) {
        cls.id = `${prefix}${idx + 1}_${Date.now()}`;
      }
    });
  }
}

function loadState(user = currentFirebaseUser) {
  const key = getStorageKey(user);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.pointLineMilestones) {
        parsed.pointLineMilestones = DEFAULT_DATA.pointLineMilestones;
      }
      // Đảm bảo tài khoản Demo hoặc tài khoản mới có đầy đủ bộ thẻ mẫu mặc định mới nhất (12 Power Cards & 8 Challenge Cards)
      if (key === "CLASSJOY_DEMO_STATE") {
        parsed.powerCards = JSON.parse(JSON.stringify(DEFAULT_DATA.powerCards));
        parsed.penaltyCards = JSON.parse(JSON.stringify(DEFAULT_DATA.penaltyCards));
      } else {
        if (!Array.isArray(parsed.powerCards) || parsed.powerCards.length < DEFAULT_DATA.powerCards.length) {
          parsed.powerCards = JSON.parse(JSON.stringify(DEFAULT_DATA.powerCards));
        }
        if (!Array.isArray(parsed.penaltyCards) || parsed.penaltyCards.length < DEFAULT_DATA.penaltyCards.length) {
          parsed.penaltyCards = JSON.parse(JSON.stringify(DEFAULT_DATA.penaltyCards));
        }
      }
      sanitizeCardFrames(parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("Không thể đọc LocalStorage, dùng dữ liệu mặc định:", err);
  }
  const defaultState = JSON.parse(JSON.stringify(DEFAULT_DATA));
  sanitizeCardFrames(defaultState);
  return defaultState;
}

function saveState() {
  if (!appState) return;
  const key = getStorageKey(currentFirebaseUser);
  try {
    localStorage.setItem(key, JSON.stringify(appState));
  } catch (err) {
    console.warn("Không thể lưu vào LocalStorage:", err);
  }
  updateNavCardCounts();

  // Đồng bộ thời gian thực lên Firebase Cloud Firestore nếu đang đăng nhập online
  if (firestoreDb && currentFirebaseUser && !isDemoMode) {
    firestoreDb.collection("teachers").doc(currentFirebaseUser.uid).set({
      appState,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch((err) => console.warn("Lỗi lưu dữ liệu giáo viên lên Firestore:", err));

    const currentClass = getCurrentClass();
    if (currentClass) {
      firestoreDb.collection("shared_classes").doc(currentClass.id).set({
        classId: currentClass.id,
        teacherUid: currentFirebaseUser.uid,
        className: currentClass.name,
        students: currentClass.students || [],
        powerCards: appState.powerCards || [],
        penaltyCards: appState.penaltyCards || [],
        pointLineMilestones: appState.pointLineMilestones || [],
        isPointsHidden: Boolean(appState.isPointsHidden),
        teacherName: currentFirebaseUser.displayName || currentFirebaseUser.email || "Giáo viên",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch((err) => console.warn("Lỗi đồng bộ shared_classes:", err));
    }
  }
}

function resetDemoData() {
  if (!confirm("Bạn có chắc muốn khôi phục toàn bộ dữ liệu mẫu ban đầu không?")) return;
  appState = JSON.parse(JSON.stringify(DEFAULT_DATA));
  appState.isPointsHidden = false;
  currentClassId = appState.classes[0].id;
  currentGroupFilter = "ALL";
  isSidebarCollapsed = true;
  saveState();
  renderAll();
  showToast("🔄 Đã khôi phục dữ liệu mẫu ban đầu!", "indigo");
}

function getCurrentClass() {
  const cls = appState.classes.find((c) => c.id === currentClassId) || appState.classes[0];
  if (cls && !cls.groupsList) {
    const existingGroups = [...new Set(cls.students.map((s) => s.group).filter(Boolean))];
    cls.groupsList = existingGroups.length > 0 ? existingGroups : ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];
  }
  return cls;
}

function findStudentById(studentId) {
  for (const cls of appState.classes) {
    const st = cls.students.find((s) => s.id === studentId);
    if (st) return { student: st, classObj: cls };
  }
  return null;
}

function findStudentByCode(code) {
  const normalized = (code || "").trim().toUpperCase();
  if (!normalized) return null;
  for (const cls of appState.classes) {
    const st = cls.students.find(
      (s) =>
        (s.code || "").toUpperCase() === normalized ||
        (s.username || "").toUpperCase() === normalized
    );
    if (st) return { student: st, classObj: cls };
  }
  // Hỗ trợ tìm kiếm tương thích nếu nhập HS01, HS02...
  const hsMatch = normalized.match(/^HS0*(\d+)$/);
  if (hsMatch && appState.classes.length > 0) {
    const suffix = `-${String(parseInt(hsMatch[1], 10)).padStart(2, "0")}`;
    for (const cls of appState.classes) {
      const st = cls.students.find((s) => (s.code || "").toUpperCase().endsWith(suffix));
      if (st) return { student: st, classObj: cls };
    }
  }
  return null;
}

function findCardTemplate(cardId, type) {
  if (type === "power") {
    return appState.powerCards.find((c) => c.id === cardId);
  }
  if (type === "penalty") {
    return appState.penaltyCards.find((c) => c.id === cardId);
  }
  return (
    appState.powerCards.find((c) => c.id === cardId) ||
    appState.penaltyCards.find((c) => c.id === cardId)
  );
}

function nowTimeString() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

// ----------------------------------------------------------------------------
// 2. WEB AUDIO API SYNTHESIZER
// ----------------------------------------------------------------------------
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playClapSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 7; i++) {
    const clapTime = now + i * 0.18 + (Math.random() * 0.04);
    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.28));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100 + Math.random() * 400;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, clapTime);
    gain.gain.exponentialRampToValueAtTime(0.01, clapTime + 0.08);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(clapTime);
  }
}

function playFanfareSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + idx * 0.12;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.4);
  });
}

function playRainSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * 1.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 850;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.5);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
}

function playSunSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const chimeNotes = [659.25, 830.61, 987.77, 1318.5];
  chimeNotes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + idx * 0.15;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.25, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.8);
  });
}

// ----------------------------------------------------------------------------
// 3. BỘ HIỆU ỨNG TƯƠNG TÁC LỚP HỌC (ATMOSPHERE FX)
// ----------------------------------------------------------------------------
function clearAllFX() {
  const overlay = document.getElementById("fx-overlay");
  if (!overlay) return;
  if (fxTimeoutId) clearTimeout(fxTimeoutId);
  overlay.innerHTML = "";
  overlay.classList.add("hidden");
}

function triggerApplauseFX() {
  clearAllFX();
  playClapSound();
  const overlay = document.getElementById("fx-overlay");
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="clap-container animate-pop flex flex-col items-center">
      <div class="flex items-center gap-6">
        <span class="clap-hand-left">👏</span>
        <span class="clap-sparkle">✨</span>
        <span class="clap-hand-right">👏</span>
      </div>
      <div class="mt-4 px-6 py-2 rounded-2xl bg-amber-400 border-2 border-slate-900 font-black text-xl text-slate-950 shadow-[0_4px_0_#1e293b] tracking-wider uppercase">
        👏 Một Tràng Pháo Tay Cho Cả Lớp! 👏
      </div>
    </div>
  `;
  fxTimeoutId = setTimeout(clearAllFX, 3500);
  showToast("👏 Cả lớp cùng vỗ tay khen ngợi nào!", "amber");
}

function triggerFireworksFX() {
  clearAllFX();
  playFanfareSound();
  const overlay = document.getElementById("fx-overlay");
  overlay.classList.remove("hidden");

  const colors = ["#fbbf24", "#38bdf8", "#34d399", "#fb7185", "#f43f5e", "#a855f7"];
  let confettiHtml = "";
  for (let i = 0; i < 65; i++) {
    const left = Math.random() * 100;
    const size = Math.random() * 12 + 8;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const delay = Math.random() * 0.8;
    const dur = Math.random() * 1.5 + 2;
    confettiHtml += `
      <div class="confetti-particle" style="left: ${left}%; width: ${size}px; height: ${size}px; background-color: ${color}; animation-delay: ${delay}s; animation-duration: ${dur}s;"></div>
    `;
  }

  overlay.innerHTML = `
    ${confettiHtml}
    <div class="animate-pop z-20 text-center px-8 py-5 rounded-3xl bg-white border-3 border-slate-900 shadow-[0_10px_0_#1e293b]">
      <div class="text-6xl mb-2 animate-bounce">🎆</div>
      <div class="text-3xl font-black text-slate-900 tracking-tight">XUẤT SẮC! CONGRATULATIONS!</div>
      <div class="text-xs font-black text-emerald-600 mt-1 uppercase tracking-wider">🌟 Cả lớp cùng chúc mừng thành tích này 🌟</div>
    </div>
  `;
  fxTimeoutId = setTimeout(clearAllFX, 4000);
  showToast("🎆 Pháo hoa chúc mừng bùng nổ khắp màn hình!", "emerald");
}

function triggerRainFX() {
  clearAllFX();
  playRainSound();
  const overlay = document.getElementById("fx-overlay");
  overlay.classList.remove("hidden");

  let raindropsHtml = "";
  for (let i = 0; i < 45; i++) {
    const left = Math.random() * 100;
    const height = Math.random() * 25 + 20;
    const delay = Math.random() * 0.7;
    const dur = Math.random() * 0.3 + 0.55;
    raindropsHtml += `
      <div class="rain-drop" style="left: ${left}%; height: ${height}px; animation-delay: ${delay}s; animation-duration: ${dur}s;"></div>
    `;
  }

  overlay.innerHTML = `
    <div class="rain-backdrop"></div>
    ${raindropsHtml}
    <div class="animate-pop z-20 text-center px-6 py-3 rounded-2xl bg-slate-900 text-white border-2 border-sky-400 shadow-[0_6px_0_#0284c7]">
      <div class="text-3xl mb-1">🌧️ ⚡</div>
      <div class="text-base font-black tracking-wide">Trời Đang Mưa Rơi...</div>
      <div class="text-xs font-bold text-sky-200 mt-0.5">Cả lớp mình giữ trật tự và tập trung nghe giảng nhé!</div>
    </div>
  `;
  fxTimeoutId = setTimeout(clearAllFX, 4500);
  showToast("🌧️ Mưa rơi nhẹ: Cả lớp giữ trật tự nghe cô giảng nhé!", "blue");
}

function triggerSunFX() {
  clearAllFX();
  playSunSound();
  const overlay = document.getElementById("fx-overlay");
  overlay.classList.remove("hidden");

  overlay.innerHTML = `
    <div class="sun-backdrop"></div>
    <div class="animate-pop z-20 text-center px-7 py-4 rounded-3xl bg-amber-300 text-slate-950 border-3 border-slate-900 shadow-[0_8px_0_#1e293b]">
      <div class="text-6xl mb-1 sun-badge-center">☀️</div>
      <div class="text-2xl font-black tracking-tight">Nắng Ấm Bừng Sáng!</div>
      <div class="text-xs font-black text-amber-950 mt-1 uppercase">Cùng nạp 100% năng lượng học tập vui vẻ nào!</div>
    </div>
  `;
  fxTimeoutId = setTimeout(clearAllFX, 4000);
  showToast("☀️ Nắng ấm rạng rỡ: Năng lượng học tập tràn đầy!", "amber");
}

// ----------------------------------------------------------------------------
// 4. TRỤC SỐ ĐỐI CHIẾU MỐC ĐIỂM POINT LINE (MATHEMATICAL NUMBER LINE AXIS)
// ----------------------------------------------------------------------------
function buildNumberLineHtml(milestones, studentScore = null, studentAvatar = "") {
  const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
  const maxThreshold = Math.max(...sorted.map((m) => m.threshold), 20);

  function shortLabel(title) {
    if (!title) return "Power Card";
    if (title.toLowerCase().includes("kitkat")) return "Thẻ + Quà";
    if (title.toLowerCase().includes("vip")) return "Card VIP";
    if (title.toLowerCase().includes("miễn")) return "Miễn KT tuần";
    if (title.toLowerCase().includes("đại bàng")) return "Đại Bàng Lớp";
    if (title.toLowerCase().includes("power card")) return "Power Card";
    if (title.length <= 13) return title;
    return title.slice(0, 12) + "…";
  }

  // Mốc gốc 0 trên trục số
  let ticksHtml = `
    <div class="number-line-tick-group" style="left: 0%;" title="Mốc bắt đầu: 0 điểm">
      <div class="number-line-dot origin-dot"></div>
      <div class="number-line-val-top">0</div>
    </div>
  `;

  sorted.forEach((m, idx) => {
    // Phân bố phần trăm từ 6% đến 94%
    const leftPct = Math.min(94, Math.max(6, (m.threshold / maxThreshold) * 94));
    const isAchieved = studentScore !== null && studentScore >= m.threshold;
    const dotClass = isAchieved ? "achieved-dot" : "";

    // KỸ THUẬT SO LE: Mốc chẵn (idx 0, 2, 4...) cắm cờ ở TRÊN, Mốc lẻ (idx 1, 3, 5...) cắm cờ ở DƯỚI
    const isTop = idx % 2 === 0;
    const flagClass = isTop ? "number-line-flag-top" : "number-line-flag-bottom";
    const valClass = isTop ? "number-line-val-top" : "number-line-val-bottom";
    const flagBg = isAchieved ? "!bg-emerald-100 !border-emerald-700 text-emerald-950" : "";

    ticksHtml += `
      <div class="number-line-tick-group" style="left: ${leftPct}%;" onclick="showMilestoneDetail('${m.id}')"
        title="Mốc ${m.threshold} điểm: ${m.rewardTitle}">
        
        <!-- Lá cờ phần thưởng so le trên / dưới -->
        <div class="${flagClass} ${flagBg}">
          <span>${isAchieved ? "✅" : m.icon || "⚡"}</span>
          <span>${shortLabel(m.rewardTitle)}</span>
        </div>

        <!-- Chấm tròn trên trục số -->
        <div class="number-line-dot ${dotClass}"></div>

        <!-- Con số mốc điểm (10, 20, 30...) nằm ở phía đối diện của cờ -->
        <div class="${valClass}">${m.threshold}</div>
      </div>
    `;
  });

  // Dành cho Cổng Học Sinh: Thanh màu tiến độ & Ghim vị trí hiện tại của học sinh trên trục số
  let progressFillHtml = "";
  let studentPinHtml = "";
  if (studentScore !== null) {
    const fillPct = Math.min(94, Math.max(0, (studentScore / maxThreshold) * 94));
    progressFillHtml = `<div class="number-line-progress-fill" style="width: ${fillPct}%;"></div>`;
    studentPinHtml = `
      <div class="student-axis-marker" style="left: ${fillPct}%;">
        <div class="student-axis-bubble">
          <span>${studentAvatar || "🎒"}</span>
          <span>Em: ${studentScore}đ</span>
        </div>
        <div class="student-axis-pin"></div>
      </div>
    `;
  }

  return `
    <div class="number-line-container">
      <div class="number-line-axis">
        ${progressFillHtml}
        ${studentPinHtml}
        ${ticksHtml}
      </div>
    </div>
  `;
}

function renderClassroomPointLineTrack() {
  const container = document.getElementById("classroom-point-line-track");
  if (!container) return;
  container.innerHTML = buildNumberLineHtml(appState.pointLineMilestones, null);
}

function showMilestoneDetail(mId) {
  const m = appState.pointLineMilestones.find((x) => x.id === mId);
  if (!m) return;
  const cls = getCurrentClass();
  const achievers = cls ? cls.students.filter((s) => s.points >= m.threshold) : [];

  showToast(
    `📏 Mốc ${m.threshold}đ trên trục số: "${m.rewardTitle}" (${achievers.length}/${cls.students.length} bạn đã đạt)`,
    "indigo"
  );
}

function openMilestoneSettingsModal() {
  renderMilestoneSettingsList();
  document.getElementById("milestone-settings-modal").classList.remove("hidden");
}

function renderMilestoneSettingsList() {
  const container = document.getElementById("milestone-list-container");
  if (!container) return;

  const milestones = [...appState.pointLineMilestones].sort((a, b) => a.threshold - b.threshold);
  container.innerHTML = milestones
    .map(
      (m) => `
      <div class="p-3 rounded-2xl border-2 border-slate-900 bg-white flex items-center justify-between gap-3 shadow-[0_2px_0_#1e293b]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-300 border-2 border-slate-900 text-slate-900 flex items-center justify-center font-black text-sm">
            ${m.icon || "⚡"}
          </div>
          <div>
            <div class="text-sm font-black text-slate-900">Mốc đối chiếu: ${m.threshold} điểm</div>
            <div class="text-xs font-bold text-slate-500">${m.rewardTitle}</div>
          </div>
        </div>
        <button onclick="deleteMilestone('${m.id}')"
          class="pop-btn pop-btn-coral w-8 h-8 rounded-xl text-xs font-black" title="Xóa mốc này">
          ✕
        </button>
      </div>
    `
    )
    .join("");
}

function handleAddNewMilestone(e) {
  e.preventDefault();
  const thresholdInput = document.getElementById("new-milestone-threshold");
  const iconInput = document.getElementById("new-milestone-icon");
  const rewardInput = document.getElementById("new-milestone-reward");

  const threshold = parseInt(thresholdInput.value, 10);
  const icon = iconInput.value.trim() || "⚡";
  const rewardTitle = rewardInput.value.trim() || "Rút 1 Thẻ Power Card";

  if (isNaN(threshold) || threshold <= 0) return;

  if (appState.pointLineMilestones.some((m) => m.threshold === threshold)) {
    showToast(`⚠️ Mốc ${threshold} điểm đã có trong bảng đối chiếu!`, "rose");
    return;
  }

  appState.pointLineMilestones.push({
    id: "ms-" + threshold,
    threshold,
    icon,
    rewardTitle
  });

  thresholdInput.value = "";
  saveState();
  renderMilestoneSettingsList();
  renderClassroomPointLineTrack();
  showToast(`📋 Đã thêm mốc ${threshold} điểm vào bảng đối chiếu!`, "emerald");
}

function deleteMilestone(mId) {
  if (appState.pointLineMilestones.length <= 1) {
    showToast("⚠️ Phải giữ lại ít nhất 1 mốc đối chiếu!", "rose");
    return;
  }
  appState.pointLineMilestones = appState.pointLineMilestones.filter((m) => m.id !== mId);
  saveState();
  renderMilestoneSettingsList();
  renderClassroomPointLineTrack();
  showToast("🗑️ Đã xóa mốc điểm.", "slate");
}

function restoreDefaultMilestones() {
  appState.pointLineMilestones = JSON.parse(JSON.stringify(DEFAULT_DATA.pointLineMilestones));
  saveState();
  renderMilestoneSettingsList();
  renderClassroomPointLineTrack();
  showToast("🔄 Đã khôi phục các mốc tròn chục (10, 20, 30...) mặc định!", "indigo");
}

// ----------------------------------------------------------------------------
// 5. ĐĂNG NHẬP GIÁO VIÊN & ĐIỀU HƯỚNG 6 TAB CHÍNH (FIREBASE AUTH & DEMO FALLBACK)
// ----------------------------------------------------------------------------
function setAuthMode(mode) {
  currentAuthMode = mode;
  const tabLogin = document.getElementById("auth-tab-login");
  const tabRegister = document.getElementById("auth-tab-register");
  const nameField = document.getElementById("auth-name-field");
  const submitBtn = document.getElementById("auth-submit-btn");

  if (mode === "register") {
    if (tabRegister) tabRegister.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition bg-white text-slate-900 border border-slate-900 shadow-xs";
    if (tabLogin) tabLogin.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    if (nameField) nameField.classList.remove("hidden");
    if (submitBtn) submitBtn.innerHTML = "<span>✨ Tạo Tài Khoản & Bắt Đầu</span>";
  } else {
    if (tabLogin) tabLogin.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition bg-white text-slate-900 border border-slate-900 shadow-xs";
    if (tabRegister) tabRegister.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    if (nameField) nameField.classList.add("hidden");
    if (submitBtn) submitBtn.innerHTML = "<span>🚀 Đăng Nhập Vào Lớp Học</span>";
  }
}

async function loginWithGoogle() {
  if (!firebaseAuth) {
    showToast("⚡ Đang mở chế độ Dùng thử (Demo)!", "amber");
    enterDemoMode();
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebaseAuth.signInWithPopup(provider);
    showToast(`👋 Xin chào ${result.user.displayName || result.user.email}!`, "emerald");
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    const errBox = document.getElementById("login-error");
    if (errBox) {
      errBox.textContent = "Lỗi đăng nhập Google: " + (error.message || error);
      errBox.classList.remove("hidden");
    }
  }
}

async function handleTeacherAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  const name = document.getElementById("auth-name")?.value.trim() || "Giáo viên";
  const errBox = document.getElementById("login-error");
  if (errBox) errBox.classList.add("hidden");

  if (!firebaseAuth) {
    enterDemoMode();
    return;
  }

  try {
    if (currentAuthMode === "register") {
      const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      if (cred.user && name) {
        await cred.user.updateProfile({ displayName: name });
      }
      showToast("🎉 Tạo tài khoản thành công!", "emerald");
    } else {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      showToast("🚀 Đăng nhập thành công!", "emerald");
    }
  } catch (err) {
    console.error("Auth error:", err);
    if (errBox) {
      let msg = err.message || "Đã xảy ra lỗi!";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        msg = "Email hoặc mật khẩu không chính xác!";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "Email này đã được đăng ký. Vui lòng chuyển sang tab 'Đăng nhập'!";
      } else if (err.code === "auth/weak-password") {
        msg = "Mật khẩu tối thiểu 6 ký tự!";
      }
      errBox.textContent = msg;
      errBox.classList.remove("hidden");
    }
  }
}

async function logoutTeacher() {
  if (studentPortalLiveUnsub) {
    studentPortalLiveUnsub();
    studentPortalLiveUnsub = null;
    studentPortalLiveClassId = null;
  }
  if (firebaseAuth && firebaseAuth.currentUser) {
    try {
      await firebaseAuth.signOut();
    } catch (e) {
      console.warn("SignOut:", e);
    }
  }
  currentFirebaseUser = null;
  isDemoMode = false;

  // Nạp lại trạng thái từ bộ nhớ lưu trữ (giữ nguyên mật khẩu học sinh đã đổi)
  appState = loadState(null);
  sanitizeCardFrames(appState);
  currentClassId = appState.classes[0]?.id || "class-10a1";
  activeStudentModalId = null;
  revealedStudentIds.clear();

  document.getElementById("main-app").classList.add("hidden");
  document.getElementById("landing-screen").classList.remove("hidden");
  showToast("🚪 Đã đăng xuất an toàn.", "slate");
}

function enterDemoMode() {
  isDemoMode = true;
  currentFirebaseUser = null;
  appState = loadState(null);
  appState.powerCards = JSON.parse(JSON.stringify(DEFAULT_DATA.powerCards));
  appState.penaltyCards = JSON.parse(JSON.stringify(DEFAULT_DATA.penaltyCards));
  sanitizeCardFrames(appState);
  saveState();
  currentClassId = appState.classes[0]?.id || "class-10a1";
  const tAcc = appState.teacherAccount || DEFAULT_DATA.teacherAccount;
  const subText = [tAcc.school, tAcc.subject].filter(Boolean).join(" • ") || "Demo ClassJoy";
  updateTeacherInfoUI(tAcc.name || "Cô Nguyễn Minh Anh", subText, null);
  isSidebarCollapsed = true;
  updateSidebarExpansionUI();
  enterMainApp("teacher");
  showToast("👋 Đã vào chế độ Tài khoản Demo (Có sẵn học sinh & thẻ mẫu)!", "emerald");
}

function updateTeacherInfoUI(name, email, photoUrl) {
  const infoBar = document.getElementById("teacher-info-bar");
  const cloudBadge = document.getElementById("cloud-badge");
  if (infoBar) {
    infoBar.textContent = `${name || "Giáo viên"} • ${email || "ClassJoy Online"}`;
  }
  if (cloudBadge) {
    if (isDemoMode) {
      cloudBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300";
      cloudBadge.textContent = "⚡ Chế độ Demo (Offline)";
    } else {
      cloudBadge.className = "text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300";
      cloudBadge.textContent = "☁️ Firebase Đã Kết Nối";
    }
  }
}

function refreshTeacherHeaderFromState() {
  if (currentAppRole === "student") return;
  if (!appState.teacherAccount) {
    appState.teacherAccount = JSON.parse(JSON.stringify(DEFAULT_DATA.teacherAccount));
  }
  const tAcc = appState.teacherAccount;
  const displayName = tAcc.name || currentFirebaseUser?.displayName || "Giáo viên";
  const subParts = [tAcc.school, tAcc.subject].filter(Boolean);
  const subInfo = subParts.length > 0 ? subParts.join(" • ") : (currentFirebaseUser?.email || "ClassJoy");
  updateTeacherInfoUI(displayName, subInfo, currentFirebaseUser?.photoURL || null);
}

function openEditTeacherModal() {
  if (!appState.teacherAccount) {
    appState.teacherAccount = JSON.parse(JSON.stringify(DEFAULT_DATA.teacherAccount));
  }
  const tAcc = appState.teacherAccount;
  const nameEl = document.getElementById("edit-teacher-name");
  const schoolEl = document.getElementById("edit-teacher-school");
  const subjectEl = document.getElementById("edit-teacher-subject");
  if (nameEl) nameEl.value = tAcc.name || currentFirebaseUser?.displayName || "Giáo viên";
  if (schoolEl) schoolEl.value = tAcc.school || "";
  if (subjectEl) subjectEl.value = tAcc.subject || "";
  document.getElementById("edit-teacher-modal")?.classList.remove("hidden");
}

async function handleSaveTeacherProfile(e) {
  e.preventDefault();
  const name = document.getElementById("edit-teacher-name")?.value.trim() || "Giáo viên";
  const school = document.getElementById("edit-teacher-school")?.value.trim() || "";
  const subject = document.getElementById("edit-teacher-subject")?.value.trim() || "";

  if (!appState.teacherAccount) {
    appState.teacherAccount = {};
  }
  appState.teacherAccount.name = name;
  appState.teacherAccount.school = school;
  appState.teacherAccount.subject = subject;

  if (currentFirebaseUser && currentFirebaseUser.updateProfile) {
    try {
      await currentFirebaseUser.updateProfile({ displayName: name });
    } catch (err) {
      console.warn("Không thể cập nhật Firebase displayName:", err);
    }
  }

  saveState();
  refreshTeacherHeaderFromState();
  closeModal("edit-teacher-modal");
  showToast("👩‍🏫 Đã cập nhật thông tin hồ sơ giáo viên!", "emerald");
}

async function loadTeacherDataFromFirestore(user) {
  if (!firestoreDb || !user) return;
  try {
    const docRef = firestoreDb.collection("teachers").doc(user.uid);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.appState) {
      appState = snap.data().appState;
      ensureUniqueClassIds(appState, user);
      sanitizeCardFrames(appState);
    } else {
      // Khởi tạo lớp học mới tinh (trống học sinh) cho tài khoản giáo viên mới
      const uniqueClassId = `cls_${user.uid.slice(0, 6)}_1_${Date.now()}`;
      const newInitialState = JSON.parse(JSON.stringify(DEFAULT_DATA));
      newInitialState.classes = [
        {
          id: uniqueClassId,
          name: "Lớp học của tôi",
          grade: "Khối 10",
          room: "Phòng học",
          groupsList: ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"],
          students: []
        }
      ];
      newInitialState.speechQueue = [];
      newInitialState.teacherAccount.name = user.displayName || user.email?.split("@")[0] || "Giáo viên";
      newInitialState.teacherAccount.school = "Lớp học ClassJoy";
      ensureUniqueClassIds(newInitialState, user);
      sanitizeCardFrames(newInitialState);
      appState = newInitialState;
      await docRef.set({
        appState,
        teacherEmail: user.email,
        teacherName: user.displayName || "Giáo viên",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    currentClassId = appState.classes[0]?.id;
    refreshTeacherHeaderFromState();
    saveState();
    renderAll();
  } catch (err) {
    console.error("Lỗi tải Firestore:", err);
    // Nếu lỗi mạng, thử đọc cache riêng của giáo viên này từ localStorage
    appState = loadState(user);
    currentClassId = appState.classes[0]?.id;
    renderAll();
    showToast("⚠️ Đang dùng dữ liệu lưu tạm trên thiết bị.", "amber");
  }
}

function deleteCurrentClass() {
  const cls = getCurrentClass();
  if (!cls) return;
  if (appState.classes.length <= 1) {
    showToast("⚠️ Bạn phải giữ lại ít nhất 1 lớp học!", "rose");
    return;
  }
  if (!confirm(`Bạn có chắc chắn muốn xóa lớp "${cls.name}" cùng toàn bộ dữ liệu học sinh trong lớp này không? Thao tác này không thể hoàn tác!`)) {
    return;
  }

  const deletedId = cls.id;
  appState.classes = appState.classes.filter((c) => c.id !== deletedId);
  currentClassId = appState.classes[0].id;
  currentGroupFilter = "ALL";
  revealedStudentIds.clear();

  // Xóa khỏi shared_classes trên Firestore nếu có
  if (firestoreDb && currentFirebaseUser && !isDemoMode) {
    firestoreDb.collection("shared_classes").doc(deletedId).delete().catch((e) => console.warn("Lỗi xóa shared_class:", e));
  }

  saveState();
  renderAll();
  showToast(`🗑️ Đã xóa lớp "${cls.name}" thành công!`, "slate");
}

function deleteStudent(studentId, event) {
  if (event) event.stopPropagation();
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;

  if (!confirm(`Bạn có chắc muốn xóa học sinh "${student.name}" (Mã: ${student.code}) khỏi ${classObj.name} không?`)) {
    return;
  }

  classObj.students = classObj.students.filter((s) => s.id !== studentId);
  if (appState.speechQueue) {
    appState.speechQueue = appState.speechQueue.filter((q) => q.studentId !== studentId);
  }
  revealedStudentIds.delete(studentId);

  saveState();
  if (activeStudentModalId === studentId) {
    closeModal("student-detail-modal");
  }
  renderAll();
  showToast(`🗑️ Đã xóa học sinh "${student.name}"!`, "slate");
}

function clearClassStudents() {
  const cls = getCurrentClass();
  if (!cls) return;
  if (!confirm(`Bạn có chắc muốn xóa toàn bộ học sinh trong ${cls.name} để bắt đầu tạo danh sách học sinh thật không?`)) return;
  cls.students = [];
  appState.speechQueue = [];
  revealedStudentIds.clear();
  saveState();
  renderAll();
  showToast(`🧹 Đã dọn sạch học sinh mẫu của ${cls.name}!`, "emerald");
}

document.addEventListener("DOMContentLoaded", () => {
  // Lắng nghe trạng thái đăng nhập Firebase
  if (firebaseAuth) {
    firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        currentFirebaseUser = user;
        isDemoMode = false;
        updateTeacherInfoUI(user.displayName, user.email, user.photoURL);
        await loadTeacherDataFromFirestore(user);
        enterMainApp("teacher");
      }
    });
  }

  const landingStudentForm = document.getElementById("landing-student-form");
  if (landingStudentForm) {
    landingStudentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = document.getElementById("landing-student-code").value.trim();
      const password = document.getElementById("landing-student-password")?.value.trim() || "123456";
      if (code) {
        quickStudentLookup(code, password);
      }
    });
  }

  document.addEventListener("click", () => closeAllDropdownMenus());
  document.addEventListener("fullscreenchange", () => updateBrowserFullscreenUI());
  renderAll();
});

function toggleDropdownMenu(menuId, event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const wasHidden = menu.classList.contains("hidden");
  closeAllDropdownMenus();
  if (wasHidden) menu.classList.remove("hidden");
}

function closeAllDropdownMenus() {
  ["class-manage-menu", "fx-dropdown-menu"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

function toggleBrowserFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function updateBrowserFullscreenUI() {
  const btn = document.getElementById("fullscreen-browser-btn");
  if (!btn) return;
  if (document.fullscreenElement) {
    btn.innerHTML = "🗗 Thoát Toàn MH";
    btn.className = "pop-btn pop-btn-yellow px-3 py-1.5 rounded-xl text-xs font-black";
  } else {
    btn.innerHTML = "⛶ Phóng to TV";
    btn.className = "pop-btn pop-btn-white px-3 py-1.5 rounded-xl text-xs font-black";
  }
}

function togglePointLineCollapse() {
  isPointLineCollapsed = !isPointLineCollapsed;
  const track = document.getElementById("classroom-point-line-track");
  const btn = document.getElementById("toggle-pointline-btn");
  if (!track || !btn) return;
  if (isPointLineCollapsed) {
    track.classList.add("hidden");
    btn.textContent = "Mở rộng ▼";
  } else {
    track.classList.remove("hidden");
    btn.textContent = "Thu gọn ▲";
  }
}

let currentAppRole = "teacher"; // 'teacher' | 'student'

function enterMainApp(mode, studentCode = "", studentPassword = "123456") {
  document.getElementById("landing-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");

  const roleBadge = document.getElementById("role-badge");
  const navTabs = document.getElementById("teacher-nav-tabs");
  const editTeacherBtn = document.getElementById("edit-teacher-profile-btn");
  if (mode === "student") {
    currentAppRole = "student";
    if (navTabs) navTabs.classList.add("hidden");
    if (editTeacherBtn) editTeacherBtn.classList.add("hidden");
    roleBadge.textContent = "🎒 Học sinh (Chế độ xem thông tin)";
    roleBadge.className =
      "text-[11px] font-black px-3 py-1 rounded-full bg-amber-200 text-amber-950 border border-slate-900";
    switchMainTab("student-portal");
    if (studentCode) {
      const codeInput = document.getElementById("portal-code-input");
      const pwInput = document.getElementById("portal-password-input");
      if (codeInput) codeInput.value = studentCode.toLowerCase();
      if (pwInput) pwInput.value = studentPassword;
      renderStudentPortalProfile(studentCode, studentPassword, false);
    }
  } else {
    currentAppRole = "teacher";
    if (navTabs) navTabs.classList.remove("hidden");
    if (editTeacherBtn) editTeacherBtn.classList.remove("hidden");
    roleBadge.textContent = "Giáo viên";
    roleBadge.className =
      "text-[11px] font-black px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300";
    refreshTeacherHeaderFromState();
    isSidebarCollapsed = true;
    updateSidebarExpansionUI();
    switchMainTab("classroom");
  }
}

function fillAndLoginDemoStudent(code) {
  const codeInput = document.getElementById("landing-student-code");
  const pwInput = document.getElementById("landing-student-password");
  if (codeInput) codeInput.value = code;
  const enteredPw = pwInput?.value.trim() || "123456";
  quickStudentLookup(code, enteredPw);
}

async function quickStudentLookup(code, password = "123456") {
  const errBox = document.getElementById("student-login-error");
  if (errBox) errBox.classList.add("hidden");

  applySavedStudentPasswords(appState);
  let found = findStudentByCode(code);

  // Nếu chưa tìm thấy trong bộ nhớ cục bộ, thử tìm trên Firestore shared_classes
  if (!found && firestoreDb) {
    try {
      const snap = await firestoreDb.collection("shared_classes").get();
      snap.forEach((doc) => {
        const data = doc.data();
        if (data && Array.isArray(data.students)) {
          const normalized = (code || "").trim().toUpperCase();
          const matchSt = data.students.find(
            (s) =>
              (s.code || "").toUpperCase() === normalized ||
              (s.username || "").toUpperCase() === normalized
          );
          if (matchSt) {
            const clsObj = {
              id: data.classId || doc.id,
              name: data.className || "Lớp học",
              groupsList: ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"],
              students: data.students
            };
            const existingIdx = appState.classes.findIndex((c) => c.id === clsObj.id);
            if (existingIdx >= 0) {
              appState.classes[existingIdx] = clsObj;
            } else {
              appState.classes.push(clsObj);
            }
            if (data.powerCards) appState.powerCards = data.powerCards;
            if (data.penaltyCards) appState.penaltyCards = data.penaltyCards;
            if (data.pointLineMilestones) appState.pointLineMilestones = data.pointLineMilestones;
            sanitizeCardFrames(appState);
            found = findStudentByCode(code);
          }
        }
      });
    } catch (e) {
      console.warn("Lỗi tìm học sinh trên Cloud:", e);
    }
  }

  // Nếu vẫn chưa thấy, nạp bộ dữ liệu mẫu DEFAULT_DATA để kiểm tra tài khoản demo
  if (!found) {
    const tempDefault = JSON.parse(JSON.stringify(DEFAULT_DATA));
    sanitizeCardFrames(tempDefault);
    const normalized = (code || "").trim().toUpperCase();
    for (const c of tempDefault.classes) {
      const st = c.students.find(
        (s) =>
          (s.code || "").toUpperCase() === normalized ||
          (s.username || "").toUpperCase() === normalized
      );
      if (st) {
        appState = tempDefault;
        found = { student: st, classObj: c };
        break;
      }
    }
  }

  if (!found) {
    if (errBox) {
      errBox.textContent = `❌ Không tìm thấy tài khoản học sinh "${code}"!`;
      errBox.classList.remove("hidden");
    }
    showToast(`❌ Không tìm thấy tài khoản học sinh "${code}"!`, "rose");
    return;
  }

  applySavedStudentPasswords(appState);
  const expectedPw = String(found.student.password || "123456");
  if (String(password) !== expectedPw) {
    if (errBox) {
      errBox.textContent = "❌ Mật khẩu không chính xác! Vui lòng nhập mật khẩu mới đã đổi.";
      errBox.classList.remove("hidden");
    }
    showToast("❌ Mật khẩu học sinh không chính xác!", "rose");
    return;
  }

  updateTeacherInfoUI(found.student.name, `TK: ${(found.student.username || found.student.code).toLowerCase()}`, null);
  enterMainApp("student", found.student.code, expectedPw);
}

function switchMainTab(tabName) {
  currentMainTab = tabName;
  const tabs = ["classroom", "groups", "ranking", "power-cards", "penalty-cards", "student-portal"];
  tabs.forEach((t) => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (!section || !btn) return;
    if (t === tabName) {
      section.classList.remove("hidden");
      btn.className =
        "tab-nav-btn px-3.5 py-2 rounded-xl text-xs font-black transition bg-white text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]";
    } else {
      section.classList.add("hidden");
      btn.className =
        "tab-nav-btn px-3.5 py-2 rounded-xl text-xs font-black transition text-slate-600 hover:text-slate-900";
    }
  });

  if (tabName === "classroom") renderClassroom();
  if (tabName === "groups") renderGroupsTab();
  if (tabName === "ranking") renderRankingTab();
  if (tabName === "power-cards") renderCardDecks();
  if (tabName === "penalty-cards") renderCardDecks();
  if (tabName === "student-portal") renderPortalQuickCodes();
}

function updateNavCardCounts() {
  const pwrEl = document.getElementById("nav-power-count");
  const penEl = document.getElementById("nav-penalty-count");
  if (pwrEl) pwrEl.textContent = appState.powerCards.length;
  if (penEl) penEl.textContent = appState.penaltyCards.length;
}

function renderAll() {
  updateNavCardCounts();
  updatePrivacyButtonUI();
  updateSidebarExpansionUI();
  renderClassSelector();
  renderClassroom();
  renderGroupsTab();
  renderRankingTab();
  renderCardDecks();
  renderPortalQuickCodes();
}

// ----------------------------------------------------------------------------
// 6. TÍNH NĂNG ẨN / HIỆN ĐIỂM & THU GỌN TIỆN ÍCH
// ----------------------------------------------------------------------------
function togglePointsPrivacy() {
  appState.isPointsHidden = !appState.isPointsHidden;
  revealedStudentIds.clear();
  saveState();
  updatePrivacyButtonUI();
  renderClassroom();
  renderGroupsTab();
  if (activeStudentModalId) {
    renderStudentDetailModalContent(activeStudentModalId);
  }
  showToast(
    appState.isPointsHidden
      ? "🙈 Đã bật Chế độ Ẩn Điểm khi chiếu TV (Tránh học sinh so sánh)!"
      : "👁️ Đã hiện lại điểm số học sinh trên màn hình!",
    appState.isPointsHidden ? "amber" : "indigo"
  );
}

function toggleSingleStudentPointReveal(studentId, event) {
  if (event) event.stopPropagation();
  if (!appState.isPointsHidden) return;

  if (revealedStudentIds.has(studentId)) {
    revealedStudentIds.delete(studentId);
  } else {
    revealedStudentIds.add(studentId);
  }

  renderClassroom();
  if (activeStudentModalId === studentId) {
    renderStudentDetailModalContent(studentId);
  }
}

function updatePrivacyButtonUI() {
  const btn = document.getElementById("toggle-privacy-btn");
  const label = document.getElementById("privacy-btn-label");
  if (!btn || !label) return;

  if (appState.isPointsHidden) {
    btn.className =
      "pop-btn pop-btn-yellow px-3 py-2 rounded-xl text-xs font-black transition";
    label.innerHTML = "🙈 Điểm đang Ẩn";
  } else {
    btn.className =
      "pop-btn pop-btn-white px-3 py-2 rounded-xl text-xs font-black transition";
    label.innerHTML = "👁️ Hiện điểm";
  }
}

function toggleSidebarExpansion() {
  isSidebarCollapsed = !isSidebarCollapsed;
  updateSidebarExpansionUI();
}

function updateSidebarExpansionUI() {
  const mainCol = document.getElementById("classroom-main-col");
  const sideCol = document.getElementById("classroom-sidebar-col");
  const btn = document.getElementById("toggle-sidebar-btn");
  const btnLabel = document.getElementById("sidebar-btn-label");
  const grid = document.getElementById("students-grid");

  if (!mainCol || !sideCol || !btnLabel || !grid) return;

  if (isSidebarCollapsed) {
    mainCol.className = "lg:col-span-12 space-y-4 transition-all duration-300";
    sideCol.classList.add("hidden");
    grid.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4";
    btnLabel.innerHTML = "📋 Tiện ích 10p";
    if (btn) btn.className = "pop-btn pop-btn-white px-3 py-2 rounded-xl text-xs font-black transition";
  } else {
    mainCol.className = "lg:col-span-8 space-y-4 transition-all duration-300";
    sideCol.classList.remove("hidden");
    grid.className = "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4";
    btnLabel.innerHTML = "📺 Thu gọn Tiện ích";
    if (btn) btn.className = "pop-btn pop-btn-yellow px-3 py-2 rounded-xl text-xs font-black transition";
  }
}

// ----------------------------------------------------------------------------
// 7. RENDER MÀN HÌNH LỚP HỌC TINH GỌN
// ----------------------------------------------------------------------------
function renderClassSelector() {
  const select = document.getElementById("class-selector");
  if (!select) return;
  select.innerHTML = appState.classes
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === currentClassId ? "selected" : ""}>
          ${c.name} (${c.students.length} HS)
        </option>`
    )
    .join("");
}

function handleClassChange(classId) {
  currentClassId = classId;
  currentGroupFilter = "ALL";
  renderClassroom();
  renderGroupsTab();
  renderRankingTab();
}

function renderClassroom() {
  const cls = getCurrentClass();
  if (!cls) return;

  renderClassroomPointLineTrack();

  let totalPoints = 0;
  let activePowerCards = 0;
  let activeChallengeCards = 0;
  let usedCardsCount = 0;

  cls.students.forEach((st) => {
    totalPoints += st.points;
    st.ownedCards.forEach((c) => {
      if (c.status === "used") {
        usedCardsCount++;
      } else if (c.type === "power") {
        activePowerCards++;
      } else if (c.type === "penalty") {
        activeChallengeCards++;
      }
    });
  });

  const statsBar = document.getElementById("class-stats-bar");
  if (statsBar) {
    statsBar.innerHTML = `
      <span class="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-300 text-xs font-black text-slate-700">👥 ${cls.students.length} HS</span>
      <span class="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-700">⭐ ${appState.isPointsHidden ? "Đang ẩn" : `+${totalPoints}đ`}</span>
      <span class="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-xs font-black text-amber-800">⚡ ${activePowerCards} Power</span>
      <span class="px-2.5 py-1 rounded-xl bg-violet-50 border border-violet-200 text-xs font-black text-violet-800">🎯 ${activeChallengeCards} Challenge</span>
    `;
  }

  // 2. Render các nút lọc theo Nhóm
  const allGroups = [...new Set([...(cls.groupsList || []), ...cls.students.map((s) => s.group)])];
  const groups = ["ALL", ...allGroups];
  const groupBtns = document.getElementById("group-filter-buttons");
  if (groupBtns) {
    groupBtns.innerHTML = groups
      .map((g) => {
        const active = g === currentGroupFilter;
        const label = g === "ALL" ? `Tất cả (${cls.students.length})` : g;
        return `<button onclick="setGroupFilter('${g}')"
          class="px-3 py-1 rounded-xl text-xs font-black transition ${
            active
              ? "bg-slate-900 text-white border-2 border-slate-900 shadow-[0_2px_0_#020617]"
              : "bg-slate-100 text-slate-700 border-2 border-transparent hover:border-slate-300"
          }">${label}</button>`;
      })
      .join("");
  }

  // 3. Render Lưới học sinh TINH GỌN
  const searchQuery = (document.getElementById("student-search-input")?.value || "")
    .trim()
    .toLowerCase();

  const filteredStudents = cls.students.filter((st) => {
    const matchGroup = currentGroupFilter === "ALL" || st.group === currentGroupFilter;
    const matchQuery =
      !searchQuery ||
      st.name.toLowerCase().includes(searchQuery) ||
      st.code.toLowerCase().includes(searchQuery);
    return matchGroup && matchQuery;
  });

  const grid = document.getElementById("students-grid");
  if (grid) {
    if (filteredStudents.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-3xl p-10 text-center border-2 border-dashed border-slate-300">
          <div class="text-4xl mb-2">🔍</div>
          <div class="font-black text-slate-700 text-base">Không tìm thấy học sinh phù hợp</div>
          <p class="text-xs font-bold text-slate-400 mt-1">Thử chọn nhóm khác hoặc xóa từ khóa tìm kiếm</p>
        </div>
      `;
    } else {
      grid.innerHTML = filteredStudents
        .map((st) => {
          const unusedPower = st.ownedCards.filter(
            (c) => c.type === "power" && c.status === "unused"
          );
          const unusedChallenge = st.ownedCards.filter(
            (c) => c.type === "penalty" && c.status === "unused"
          );
          const usedCards = st.ownedCards.filter((c) => c.status === "used");

          const isIndividuallyRevealed = revealedStudentIds.has(st.id);
          let pointBadgeHtml = "";
          if (appState.isPointsHidden && !isIndividuallyRevealed) {
            pointBadgeHtml = `
              <button type="button" onclick="toggleSingleStudentPointReveal('${st.id}', event)"
                class="privacy-badge px-2.5 py-0.5 rounded-xl font-black text-xs shrink-0 hover:bg-amber-200 transition"
                title="Điểm đang ẩn • Bấm vào đây để chỉ xem điểm của riêng bạn ${st.name}">
                👁️ ?
              </button>
            `;
          } else {
            const pointBg =
              st.points >= 20
                ? "bg-emerald-400 text-slate-950"
                : st.points >= 10
                ? "bg-amber-300 text-slate-950"
                : "bg-slate-100 text-slate-800";
            pointBadgeHtml = `
              <div onclick="${appState.isPointsHidden ? `toggleSingleStudentPointReveal('${st.id}', event)` : ''}"
                class="point-badge-pop px-2.5 py-0.5 rounded-xl text-xs shrink-0 ${pointBg} ${appState.isPointsHidden ? 'cursor-pointer ring-2 ring-indigo-500' : ''}"
                title="${appState.isPointsHidden ? 'Đang hiện điểm riêng của bạn này (Bấm để ẩn lại)' : 'Điểm tích lũy'}">
                ${st.points > 0 ? `+${st.points}` : st.points}đ ${appState.isPointsHidden ? '🙈' : ''}
              </div>
            `;
          }

          const hasCards = unusedPower.length > 0 || unusedChallenge.length > 0 || usedCards.length > 0;
          let miniBadgesHtml = "";
          if (hasCards) {
            miniBadgesHtml = `
              <div class="flex items-center gap-1.5 justify-center mt-1">
                ${
                  unusedPower.length > 0
                    ? `<span class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black" title="${unusedPower.length} Power Card chưa dùng">⚡${unusedPower.length}</span>`
                    : ""
                }
                ${
                  unusedChallenge.length > 0
                    ? `<span class="px-1.5 py-0.5 rounded-md bg-violet-100 border border-violet-300 text-violet-900 text-[10px] font-black" title="${unusedChallenge.length} Challenge Card đang nhận">🎯${unusedChallenge.length}</span>`
                    : ""
                }
                ${
                  usedCards.length > 0
                    ? `<span class="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-500 text-[10px] font-bold" title="${usedCards.length} Thẻ đã hoàn thành/khóa">🔒${usedCards.length}</span>`
                    : ""
                }
              </div>
            `;
          } else {
            miniBadgesHtml = `<div class="h-4"></div>`;
          }

          return `
            <div id="student-card-${st.id}" onclick="openStudentDetailModal('${st.id}')"
              class="student-card cursor-pointer p-3 sm:p-4 flex flex-col justify-between items-center text-center select-none"
              title="Nhấp vào để Cộng/Trừ điểm hoặc xem chi tiết">
              
              <div class="w-full flex items-center justify-between gap-1 mb-2">
                <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
                  ${st.code}
                </span>
                <div class="flex items-center gap-1.5">
                  ${pointBadgeHtml}
                  <button onclick="deleteStudent('${st.id}', event)" title="Xóa học sinh này khỏi lớp"
                    class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-rose-100 border border-slate-300 hover:border-rose-400 text-slate-400 hover:text-rose-600 font-black text-xs flex items-center justify-center transition">
                    ✕
                  </button>
                </div>
              </div>

              <div class="avatar-sticker w-16 h-16 sm:w-18 sm:h-18 rounded-2xl ${st.avatarBg} border-2 border-slate-900 flex items-center justify-center text-4xl shadow-sm my-1">
                ${st.avatar}
              </div>

              <div class="w-full mt-1">
                <h4 class="font-black text-slate-900 text-sm sm:text-base leading-snug truncate" title="${st.name}">${st.name}</h4>
                <div class="text-[11px] font-bold text-slate-400 mt-0.5">${st.group}</div>
                ${miniBadgesHtml}
              </div>

              <div class="w-full flex items-center justify-center gap-2 mt-2 pt-2 border-t-2 border-slate-100" onclick="event.stopPropagation()">
                <button onclick="quickAdjustPoint('${st.id}', -1, 'Nhắc nhở trên lớp')" title="Trừ 1 điểm nhanh"
                  class="pop-btn pop-btn-coral w-8 h-8 rounded-xl text-xs font-black">
                  -1
                </button>
                <button onclick="quickAdjustPoint('${st.id}', 1, 'Cộng điểm nhanh trên lớp')" title="Cộng 1 điểm nhanh"
                  class="pop-btn pop-btn-green w-8 h-8 rounded-xl text-xs font-black">
                  +1
                </button>
                <button onclick="openStudentDetailModal('${st.id}')" title="Mở bảng điều khiển chi tiết"
                  class="pop-btn pop-btn-white px-2 h-8 rounded-xl text-[11px] font-black">
                  🃏 Thẻ
                </button>
              </div>

            </div>
          `;
        })
        .join("");
    }
  }

  const speechSelect = document.getElementById("speech-student-select");
  if (speechSelect) {
    speechSelect.innerHTML =
      `<option value="">-- Chọn học sinh phát biểu --</option>` +
      cls.students
        .map((s) => `<option value="${s.id}">${s.avatar} ${s.name} (${s.code})</option>`)
        .join("");
  }

  renderTeacherClassNote();
  renderSpeechQueue();
  renderClassActivityFeed();
}

// ----------------------------------------------------------------------------
// 7B. GHI CHÚ CỦA GIÁO VIÊN CHO TỪNG LỚP HỌC
// ----------------------------------------------------------------------------
let noteStatusTimeout = null;

function renderTeacherClassNote() {
  const cls = getCurrentClass();
  const textarea = document.getElementById("teacher-class-note-input");
  const subtitle = document.getElementById("class-note-subtitle");
  if (!cls || !textarea) return;

  textarea.value = cls.teacherNote || "";
  if (subtitle) {
    subtitle.textContent = `Sổ tay riêng: ${cls.name}`;
  }
}

function handleClassNoteInput(value) {
  const cls = getCurrentClass();
  if (!cls) return;
  cls.teacherNote = value;
  saveState();

  const statusEl = document.getElementById("class-note-status");
  if (statusEl) {
    statusEl.textContent = "💾 Đã lưu ghi chú";
    statusEl.className = "text-[10px] font-black text-amber-900 bg-amber-200 border border-amber-400 px-2 py-0.5 rounded-full transition";
    if (noteStatusTimeout) clearTimeout(noteStatusTimeout);
    noteStatusTimeout = setTimeout(() => {
      statusEl.textContent = "● Tự động lưu";
      statusEl.className = "text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full transition";
    }, 1500);
  }
}

function clearCurrentClassNote() {
  const cls = getCurrentClass();
  if (!cls || !cls.teacherNote) return;
  if (!confirm(`Bạn có chắc muốn xóa trắng ghi chú của ${cls.name}?`)) return;
  cls.teacherNote = "";
  saveState();
  renderTeacherClassNote();
  showToast("🗑️ Đã xóa ghi chú lớp học.", "slate");
}

function setGroupFilter(group) {
  currentGroupFilter = group;
  renderClassroom();
}

// ----------------------------------------------------------------------------
// 8. MỤC 4: QUẢN LÝ NHÓM, CHIA NHÓM NGẪU NHIÊN & PHÂN PHỐI THƯỞNG/THỬ THÁCH
// ----------------------------------------------------------------------------
function renderGroupsTab() {
  const cls = getCurrentClass();
  const grid = document.getElementById("groups-management-grid");
  if (!cls || !grid) return;

  const allGroups = [...new Set([...(cls.groupsList || []), ...cls.students.map((s) => s.group)])];
  cls.groupsList = allGroups;

  const groupColors = [
    "bg-amber-100 border-amber-300",
    "bg-sky-100 border-sky-300",
    "bg-emerald-100 border-emerald-300",
    "bg-violet-100 border-violet-300",
    "bg-rose-100 border-rose-300",
    "bg-orange-100 border-orange-300"
  ];

  grid.innerHTML = allGroups
    .map((groupName, gIdx) => {
      const members = cls.students.filter((s) => s.group === groupName);
      const totalGroupPoints = members.reduce((sum, s) => sum + s.points, 0);
      const headerStyle = groupColors[gIdx % groupColors.length];

      const membersHtml =
        members.length === 0
          ? `<div class="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
              Chưa có học sinh nào trong nhóm này. Hãy chuyển học sinh vào đây!
            </div>`
          : members
              .map(
                (st) => `
                <div class="p-3 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-between gap-2 hover:bg-amber-50/50 transition">
                  <div class="flex items-center gap-2.5 min-w-0 cursor-pointer" onclick="openStudentDetailModal('${st.id}')">
                    <span class="w-10 h-10 rounded-xl ${st.avatarBg} border-2 border-slate-900 flex items-center justify-center text-xl shrink-0">
                      ${st.avatar}
                    </span>
                    <div class="min-w-0">
                      <div class="font-black text-sm text-slate-900 truncate">${st.name}</div>
                      <div class="text-[11px] font-bold text-slate-500">
                        Mã: ${st.code} • <span class="text-emerald-600 font-black">${appState.isPointsHidden ? "⭐ ?" : `+${st.points}đ`}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Dropdown chuyển nhóm & nút xóa cho giáo viên -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <select onchange="moveStudentToGroup('${st.id}', this.value)"
                      title="Đổi nhóm cho học sinh này"
                      class="px-2.5 py-1.5 rounded-xl bg-white border-2 border-slate-300 hover:border-slate-900 text-xs font-black text-slate-700 outline-none cursor-pointer">
                      ${allGroups
                        .map(
                          (gOpt) =>
                            `<option value="${gOpt}" ${gOpt === st.group ? "selected" : ""}>Chuyển: ${gOpt}</option>`
                        )
                        .join("")}
                    </select>
                    <button onclick="deleteStudent('${st.id}')" title="Xóa học sinh này khỏi lớp"
                      class="w-7 h-7 rounded-xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 text-rose-700 font-black text-xs flex items-center justify-center transition">
                      🗑️
                    </button>
                  </div>
                </div>
              `
              )
              .join("");

      return `
        <div class="bg-white rounded-3xl border-2 border-slate-900 shadow-[0_6px_0_#1e293b] overflow-hidden flex flex-col justify-between">
          <div>
            <!-- Header của Nhóm -->
            <div class="${headerStyle} p-5 border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-white border-2 border-slate-900 flex items-center justify-center text-2xl font-black shadow-[0_3px_0_#1e293b]">
                  🛡️
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-xl font-black text-slate-900">${groupName}</h3>
                    <button onclick="renameGroupPrompt('${groupName}')" title="Đổi tên nhóm"
                      class="text-xs font-bold text-slate-500 hover:text-slate-900">✏️</button>
                  </div>
                  <p class="text-xs font-bold text-slate-700">${members.length} thành viên • Tổng điểm nhóm: <strong>${appState.isPointsHidden ? "⭐ ?" : `${totalGroupPoints}đ`}</strong></p>
                </div>
              </div>

              <!-- Cụm nút thưởng nhanh & Quay thẻ cho cả nhóm -->
              <div class="flex flex-wrap items-center gap-1.5">
                <button onclick="quickGroupPoints('${groupName}', 1)"
                  class="pop-btn pop-btn-green px-2.5 py-1.5 rounded-xl text-xs font-black" title="Cộng +1đ cho mọi thành viên trong nhóm">
                  +1đ Nhóm
                </button>
                <button onclick="quickGroupPoints('${groupName}', 2)"
                  class="pop-btn pop-btn-green px-2.5 py-1.5 rounded-xl text-xs font-black" title="Cộng +2đ cho mọi thành viên trong nhóm">
                  +2đ Nhóm
                </button>
                <button onclick="quickGroupPoints('${groupName}', -1)"
                  class="pop-btn pop-btn-coral px-2.5 py-1.5 rounded-xl text-xs font-black" title="Trừ 1đ nhắc nhở cả nhóm">
                  -1đ
                </button>
                <button onclick="openRandomCardModal('power', 'group', '${groupName}')"
                  class="pop-btn pop-btn-blue px-2.5 py-1.5 rounded-xl text-xs font-black" title="Quay Power Card ngẫu nhiên và phát cho toàn bộ thành viên trong ${groupName}">
                  🎡 Quay Power
                </button>
                <button onclick="openRandomCardModal('penalty', 'group', '${groupName}')"
                  class="pop-btn pop-btn-violet px-2.5 py-1.5 rounded-xl text-xs font-black" title="Quay Challenge Card ngẫu nhiên và giao cho toàn bộ thành viên trong ${groupName}">
                  🎯 Quay Challenge
                </button>
              </div>
            </div>

            <!-- Danh sách học sinh trong nhóm -->
            <div class="p-5 space-y-2.5 max-h-96 overflow-y-auto">
              ${membersHtml}
            </div>
          </div>

          <!-- Footer: Nút quay thẻ nhóm & Mở bảng phân phối chi tiết cho cả nhóm -->
          <div class="px-5 py-3.5 bg-slate-50 border-t-2 border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <button onclick="openRandomCardModal('power', 'group', '${groupName}')"
              class="pop-btn pop-btn-blue py-2.5 px-3 rounded-xl text-xs font-black" title="Mở vòng quay thẻ 3D cho cả ${groupName}">
              🎰 Quay Thẻ Nhóm
            </button>
            <button onclick="openGroupRewardModal('${groupName}')"
              class="pop-btn pop-btn-yellow flex-1 py-2.5 px-4 rounded-xl text-xs font-black">
              🎁 Chọn Phát Thẻ / Điểm Cho Cả ${groupName}
            </button>
            ${
              members.length === 0 && allGroups.length > 1
                ? `<button onclick="deleteEmptyGroup('${groupName}')"
                    class="pop-btn pop-btn-coral py-2.5 px-3 rounded-xl text-xs font-black" title="Xóa nhóm trống">
                    🗑️
                  </button>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function randomizeClassGroups() {
  const cls = getCurrentClass();
  if (!cls || cls.students.length === 0) return;

  const countSelect = document.getElementById("random-group-count-select");
  const numGroups = parseInt(countSelect?.value || "4", 10);

  // Tạo danh sách tên nhóm mới
  const newGroupsList = [];
  for (let i = 1; i <= numGroups; i++) {
    newGroupsList.push(`Nhóm ${i}`);
  }
  cls.groupsList = newGroupsList;

  // Trộn ngẫu nhiên danh sách học sinh (Fisher-Yates Shuffle)
  const shuffled = [...cls.students];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Phân bổ đều vào các nhóm
  shuffled.forEach((st, idx) => {
    st.group = newGroupsList[idx % numGroups];
  });

  currentGroupFilter = "ALL";
  saveState();
  renderAll();
  playFanfareSound();
  showToast(`🎲 Đã chia ngẫu nhiên ${cls.students.length} học sinh vào ${numGroups} nhóm!`, "amber");
}

function moveStudentToGroup(studentId, newGroupName) {
  const found = findStudentById(studentId);
  if (!found) return;
  found.student.group = newGroupName;
  saveState();
  renderGroupsTab();
  renderClassroom();
  renderRankingTab();
  showToast(`👥 Đã chuyển ${found.student.name} sang ${newGroupName}!`, "indigo");
}

function handleCreateNewGroup() {
  const cls = getCurrentClass();
  if (!cls) return;
  const nextIdx = (cls.groupsList?.length || 0) + 1;
  const name = prompt("Nhập tên nhóm mới:", `Nhóm ${nextIdx}`);
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  if (!cls.groupsList.includes(cleanName)) {
    cls.groupsList.push(cleanName);
  }
  saveState();
  renderGroupsTab();
  renderClassroom();
  showToast(`➕ Đã tạo thêm "${cleanName}"!`, "emerald");
}

function renameGroupPrompt(oldName) {
  const cls = getCurrentClass();
  if (!cls) return;
  const newName = prompt(`Đổi tên "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const clean = newName.trim();

  cls.groupsList = (cls.groupsList || []).map((g) => (g === oldName ? clean : g));
  cls.students.forEach((s) => {
    if (s.group === oldName) s.group = clean;
  });

  saveState();
  renderAll();
  showToast(`✏️ Đã đổi tên thành "${clean}"!`, "indigo");
}

function deleteEmptyGroup(groupName) {
  const cls = getCurrentClass();
  if (!cls) return;
  cls.groupsList = (cls.groupsList || []).filter((g) => g !== groupName);
  saveState();
  renderGroupsTab();
  renderClassroom();
  showToast(`🗑️ Đã xóa ${groupName}.`, "slate");
}

function quickGroupPoints(groupName, delta) {
  const cls = getCurrentClass();
  if (!cls) return;
  const members = cls.students.filter((s) => s.group === groupName);
  if (members.length === 0) {
    showToast(`⚠️ ${groupName} chưa có thành viên nào!`, "rose");
    return;
  }

  members.forEach((st) => {
    st.points = Math.max(0, st.points + delta);
    st.history.unshift({
      time: nowTimeString(),
      daysAgo: 0,
      text: `${delta > 0 ? `+${delta}đ` : `${delta}đ`}: Thưởng/nhắc nhở tập thể ${groupName}`,
      delta
    });
  });

  saveState();
  renderAll();
  if (delta > 0) playClapSound();
  showToast(
    `👥 ${groupName}: Đã phân phối ${delta > 0 ? `+${delta}đ` : `${delta}đ`} cho cả ${members.length} thành viên!`,
    delta > 0 ? "emerald" : "rose"
  );
}

function openGroupRewardModal(groupName) {
  const cls = getCurrentClass();
  if (!cls) return;
  activeGroupModalName = groupName;
  const members = cls.students.filter((s) => s.group === groupName);

  document.getElementById("group-modal-title").textContent = `Phân phối cho ${groupName}`;
  document.getElementById("group-modal-subtitle").textContent =
    members.length > 0
      ? `Danh sách ${members.length} thành viên nhận: ${members.map((m) => m.name).join(", ")}`
      : `Nhóm này hiện chưa có thành viên nào.`;

  const pwrSelect = document.getElementById("group-grant-power-select");
  if (pwrSelect) {
    pwrSelect.innerHTML = appState.powerCards
      .map((c) => `<option value="${c.id}">${c.icon} ${c.title}</option>`)
      .join("");
  }

  const penSelect = document.getElementById("group-grant-penalty-select");
  if (penSelect) {
    penSelect.innerHTML = appState.penaltyCards
      .map((c) => `<option value="${c.id}">${c.icon} ${c.title}</option>`)
      .join("");
  }

  document.getElementById("group-reward-modal").classList.remove("hidden");
}

function distributeGroupPoints(delta, reason) {
  if (!activeGroupModalName) return;
  const cls = getCurrentClass();
  const members = cls.students.filter((s) => s.group === activeGroupModalName);
  if (members.length === 0) {
    showToast("⚠️ Nhóm chưa có thành viên nào!", "rose");
    return;
  }

  members.forEach((st) => {
    st.points = Math.max(0, st.points + delta);
    st.history.unshift({
      time: nowTimeString(),
      daysAgo: 0,
      text: `${delta > 0 ? `+${delta}đ` : `${delta}đ`}: ${reason} (${activeGroupModalName})`,
      delta
    });
  });

  saveState();
  renderAll();
  closeModal("group-reward-modal");
  if (delta > 0) playFanfareSound();
  showToast(
    `🎉 Đã phân phối ${delta > 0 ? `+${delta}đ` : `${delta}đ`} đến toàn bộ ${members.length} bạn trong ${activeGroupModalName}!`,
    delta > 0 ? "emerald" : "rose"
  );
}

function distributeGroupCard(type) {
  if (!activeGroupModalName) return;
  const cls = getCurrentClass();
  const members = cls.students.filter((s) => s.group === activeGroupModalName);
  if (members.length === 0) {
    showToast("⚠️ Nhóm chưa có thành viên nào!", "rose");
    return;
  }

  const selectId =
    type === "power" ? "group-grant-power-select" : "group-grant-penalty-select";
  const cardId = document.getElementById(selectId)?.value;
  const tpl = findCardTemplate(cardId, type);
  if (!tpl) return;

  members.forEach((st) => {
    if (type === "penalty" && tpl.id === "pen-2") {
      st.points = Math.max(0, st.points - 3);
    }
    st.ownedCards.unshift({
      instanceId: "inst-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      cardId: tpl.id,
      type,
      status: "unused",
      acquiredAt: nowTimeString(),
      usedAt: null,
      note: `Phân phối theo ${activeGroupModalName}`
    });
    st.history.unshift({
      time: nowTimeString(),
      daysAgo: 0,
      text: `Nhận thẻ nhóm (${activeGroupModalName}): ${tpl.title}`,
      delta: 0
    });
  });

  saveState();
  renderAll();
  closeModal("group-reward-modal");
  playFanfareSound();
  showToast(
    `${tpl.icon} Đã phát thẻ "${tpl.title}" cho tất cả ${members.length} thành viên của ${activeGroupModalName}!`,
    type === "power" ? "indigo" : "amber"
  );
}

// ----------------------------------------------------------------------------
// 9. MỤC 2: THỐNG KÊ & BẢNG XẾP HẠNG TUẦN / THÁNG (RANKING)
// ----------------------------------------------------------------------------
function setRankingPeriod(period) {
  currentRankingPeriod = period;
  const periods = ["week", "month", "all"];
  periods.forEach((p) => {
    const btn = document.getElementById(`rank-filter-${p}`);
    if (!btn) return;
    if (p === period) {
      btn.className =
        "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition bg-amber-400 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]";
    } else {
      btn.className =
        "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition text-slate-600 hover:text-slate-900";
    }
  });
  renderRankingTab();
}

function calculateStudentGrowth(student) {
  let weekGain = 0;
  let monthGain = 0;

  // Thuật toán: Chênh lệch điểm thực tế = Điểm hiện tại − Điểm đầu tuần / đầu tháng
  // Cộng dồn cả điểm cộng (+delta) và điểm trừ (-delta) phát sinh trong kỳ
  (student.history || []).forEach((h) => {
    const delta = Number(h.delta) || 0;
    if (delta !== 0) {
      const days = typeof h.daysAgo === "number" ? h.daysAgo : 0;
      if (days <= 7) weekGain += delta;
      if (days <= 30) monthGain += delta;
    }
  });

  const startOfWeekPoints = student.points - weekGain;
  const startOfMonthPoints = student.points - monthGain;

  return {
    weekGain,
    monthGain,
    startOfWeekPoints,
    startOfMonthPoints,
    totalPoints: student.points
  };
}

function formatSignedScore(val) {
  return val >= 0 ? `+${val}đ` : `${val}đ`;
}

function renderRankingTab() {
  const cls = getCurrentClass();
  if (!cls) return;

  const podiumContainer = document.getElementById("ranking-podium-container");
  const listContainer = document.getElementById("ranking-students-list");
  const groupsRankContainer = document.getElementById("ranking-groups-list");
  const titleEl = document.getElementById("ranking-table-title");

  if (!podiumContainer || !listContainer || !groupsRankContainer) return;

  if (titleEl) {
    titleEl.textContent =
      currentRankingPeriod === "week"
        ? "📊 Bảng Xếp Hạng Tăng Trưởng Điểm Tuần Này (Điểm hiện tại − Đầu tuần)"
        : currentRankingPeriod === "month"
        ? "📊 Bảng Xếp Hạng Tăng Trưởng Điểm Tháng Này (Điểm hiện tại − Đầu tháng)"
        : "📊 Bảng Xếp Hạng Tổng Điểm Tích Lũy";
  }

  // Tính chỉ số tăng trưởng cho từng học sinh
  const enriched = cls.students.map((st) => {
    const growth = calculateStudentGrowth(st);
    const activeScore =
      currentRankingPeriod === "week"
        ? growth.weekGain
        : currentRankingPeriod === "month"
        ? growth.monthGain
        : growth.totalPoints;
    return {
      ...st,
      weekGain: growth.weekGain,
      monthGain: growth.monthGain,
      activeScore
    };
  });

  // Sắp xếp giảm dần theo điểm tăng trưởng kỳ đang chọn
  enriched.sort((a, b) => b.activeScore - a.activeScore || b.points - a.points);

  const maxScore = Math.max(...enriched.map((s) => Math.max(0, s.activeScore)), 1);

  // 1. Render Bục Vinh Danh Top 3
  const top3 = enriched.slice(0, 3);
  const medals = ["🥇 HẠNG NHẤT", "🥈 HẠNG NHÌ", "🥉 HẠNG BA"];
  const podiumBgs = [
    "bg-amber-300 border-slate-900",
    "bg-sky-200 border-slate-900",
    "bg-orange-200 border-slate-900"
  ];

  podiumContainer.innerHTML = top3
    .map(
      (st, idx) => `
      <div onclick="openStudentDetailModal('${st.id}')"
        class="cursor-pointer rounded-3xl p-5 border-2 ${podiumBgs[idx]} shadow-[0_6px_0_#1e293b] flex items-center justify-between gap-4 hover:-translate-y-1 transition">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="avatar-sticker w-16 h-16 rounded-2xl bg-white border-2 border-slate-900 flex items-center justify-center text-4xl shrink-0">
            ${st.avatar}
          </div>
          <div class="min-w-0">
            <span class="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase">
              ${medals[idx]}
            </span>
            <h4 class="font-black text-slate-900 text-base truncate mt-1">${st.name}</h4>
            <p class="text-xs font-bold text-slate-700">${st.code} • ${st.group}</p>
          </div>
        </div>
        <div class="text-right bg-white px-3.5 py-2 rounded-2xl border-2 border-slate-900 shadow-[0_2px_0_#1e293b] shrink-0">
          <div class="text-[10px] font-black uppercase text-slate-400">
            ${currentRankingPeriod === "week" ? "Tăng tuần" : currentRankingPeriod === "month" ? "Tăng tháng" : "Tổng điểm"}
          </div>
          <div class="text-xl font-black ${st.activeScore < 0 ? "text-rose-600" : "text-emerald-600"}">
            ${currentRankingPeriod === "all" ? `${st.activeScore}đ` : formatSignedScore(st.activeScore)}
          </div>
        </div>
      </div>
    `
    )
    .join("");

  // 2. Render Danh sách xếp hạng toàn lớp
  listContainer.innerHTML = enriched
    .map((st, idx) => {
      const barWidth = Math.max(6, Math.round((Math.max(0, st.activeScore) / maxScore) * 100));
      const rankBadgeBg =
        idx === 0
          ? "bg-amber-400 text-slate-950"
          : idx === 1
          ? "bg-sky-300 text-slate-950"
          : idx === 2
          ? "bg-orange-300 text-slate-950"
          : "bg-slate-100 text-slate-700";

      return `
        <div onclick="openStudentDetailModal('${st.id}')"
          class="cursor-pointer p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border-2 border-slate-200 hover:border-slate-900 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          <div class="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <span class="w-8 h-8 rounded-xl ${rankBadgeBg} border-2 border-slate-900 font-black text-xs flex items-center justify-center shrink-0">
              #${idx + 1}
            </span>
            <span class="w-11 h-11 rounded-xl ${st.avatarBg} border-2 border-slate-900 flex items-center justify-center text-2xl shrink-0">
              ${st.avatar}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-black text-sm text-slate-900 truncate">${st.name}</span>
                <span class="text-[10px] font-black px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-600">${st.group}</span>
              </div>
              <!-- Thanh biểu đồ tăng trưởng -->
              <div class="w-full sm:w-48 h-2.5 bg-slate-200 rounded-full overflow-hidden mt-1.5 border border-slate-300">
                <div class="h-full ${st.activeScore < 0 ? "bg-rose-400" : "bg-emerald-400"}" style="width: ${barWidth}%;"></div>
              </div>
            </div>
          </div>

          <!-- Các cột chỉ số Tuần / Tháng (Đã bỏ Tổng tích lũy để bảng trực diện, gọn gàng) -->
          <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
            <div class="px-3.5 py-1 rounded-xl bg-white border border-slate-200 text-center min-w-[70px]">
              <div class="text-[10px] font-bold text-slate-400">Tuần này</div>
              <div class="text-xs font-black ${st.weekGain < 0 ? "text-rose-600" : "text-emerald-600"}">${formatSignedScore(st.weekGain)}</div>
            </div>
            <div class="px-3.5 py-1 rounded-xl bg-white border border-slate-200 text-center min-w-[70px]">
              <div class="text-[10px] font-bold text-slate-400">Tháng này</div>
              <div class="text-xs font-black ${st.monthGain < 0 ? "text-rose-600" : "text-indigo-600"}">${formatSignedScore(st.monthGain)}</div>
            </div>
          </div>

        </div>
      `;
    })
    .join("");

  // 3. Render Xếp hạng theo Nhóm
  const allGroups = [...new Set([...(cls.groupsList || []), ...cls.students.map((s) => s.group)])];
  const groupStats = allGroups.map((gName) => {
    const members = enriched.filter((s) => s.group === gName);
    const groupPeriodGain = members.reduce((sum, m) => sum + m.activeScore, 0);
    const groupTotal = members.reduce((sum, m) => sum + m.points, 0);
    return {
      groupName: gName,
      memberCount: members.length,
      groupPeriodGain,
      groupTotal
    };
  });

  groupStats.sort((a, b) => b.groupPeriodGain - a.groupPeriodGain);

  groupsRankContainer.innerHTML = groupStats
    .map(
      (g, i) => `
      <div class="p-4 rounded-2xl bg-slate-50 border-2 border-slate-900 shadow-[0_3px_0_#1e293b] flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-xl ${
            i === 0 ? "bg-amber-400" : "bg-white"
          } border-2 border-slate-900 font-black text-xs flex items-center justify-center">
            #${i + 1}
          </span>
          <div>
            <h4 class="font-black text-sm text-slate-900">${g.groupName}</h4>
            <p class="text-[11px] font-bold text-slate-500">${g.memberCount} thành viên • Tổng: ${g.groupTotal}đ</p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[10px] font-black uppercase text-slate-400">
            ${currentRankingPeriod === "week" ? "Tăng tuần" : currentRankingPeriod === "month" ? "Tăng tháng" : "Tổng điểm"}
          </div>
          <div class="text-base font-black ${g.groupPeriodGain < 0 ? "text-rose-600" : "text-emerald-600"}">
            ${currentRankingPeriod === "all" ? `${g.groupPeriodGain}đ` : formatSignedScore(g.groupPeriodGain)}
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

// ----------------------------------------------------------------------------
// 10. CỘNG / TRỪ ĐIỂM CÁ NHÂN & ĐỐI CHIẾU MỐC POINT LINE
// ----------------------------------------------------------------------------
function quickAdjustPoint(studentId, delta, reason) {
  const found = findStudentById(studentId);
  if (!found) return;
  const { student } = found;

  const oldPoints = student.points;
  const newPoints = Math.max(0, student.points + delta);
  student.points = newPoints;

  student.history.unshift({
    time: nowTimeString(),
    daysAgo: 0, // Ghi nhận điểm tăng ngay trong hôm nay (Tuần này & Tháng này)
    text: `${delta > 0 ? `+${delta}đ` : `${delta}đ`}: ${reason}`,
    delta
  });

  saveState();
  renderClassroom();
  renderGroupsTab();
  renderRankingTab();

  if (activeStudentModalId === studentId) {
    renderStudentDetailModalContent(studentId);
  }

  if (delta > 0) {
    const milestones = [...appState.pointLineMilestones].sort((a, b) => a.threshold - b.threshold);
    for (const m of milestones) {
      if (oldPoints < m.threshold && newPoints >= m.threshold) {
        showToast(`🎉 ${student.name} đã chạm mốc ${m.threshold}đ: Đủ điều kiện nhận "${m.rewardTitle}"!`, "amber");
        break;
      }
    }
  }

  showToast(
    `${student.avatar} ${student.name}: ${delta > 0 ? `+${delta}` : delta} điểm (${reason})`,
    delta > 0 ? "emerald" : "rose"
  );
}

function rewardWholeClass(delta) {
  const cls = getCurrentClass();
  if (!cls) return;
  cls.students.forEach((st) => {
    st.points = Math.max(0, st.points + delta);
    st.history.unshift({
      time: nowTimeString(),
      daysAgo: 0,
      text: `+${delta}đ: Thưởng tập thể cả lớp`,
      delta
    });
  });
  saveState();
  renderAll();
  playFanfareSound();
  showToast(`👏 Đã cộng +${delta} điểm thưởng cho toàn bộ ${cls.name}!`, "emerald");
}

function openStudentDetailModal(studentId) {
  activeStudentModalId = studentId;
  renderStudentDetailModalContent(studentId);
  document.getElementById("student-detail-modal").classList.remove("hidden");
}

function renderStudentDetailModalContent(studentId) {
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;

  const unusedCards = student.ownedCards.filter((c) => c.status === "unused");
  const usedCards = student.ownedCards.filter((c) => c.status === "used");
  const growth = calculateStudentGrowth(student);
  const isGlobalHidden = Boolean(appState.isPointsHidden);
  const isStudentRevealed = revealedStudentIds.has(student.id);
  const isEffectiveHidden = isGlobalHidden && !isStudentRevealed;

  const studentUsername = (student.username || student.code || "").toLowerCase();

  const container = document.getElementById("student-modal-content");
  container.innerHTML = `
    <!-- Nút đóng cố định ở góc trên bên phải của bảng thông tin học sinh -->
    <button type="button" onclick="closeModal('student-detail-modal')"
      class="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full border-2 border-slate-800 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-400 text-slate-800 font-black text-lg flex items-center justify-center shadow-sm transition z-20"
      title="Đóng bảng thông tin học sinh">
      ✕
    </button>

    <!-- Header hồ sơ học sinh (Kèm quản lý Thông tin, Tài khoản & Mật khẩu cho Giáo viên) -->
    <div class="flex flex-wrap items-center justify-between gap-4 pb-5 pr-12 border-b-2 border-slate-200">
      <div class="flex items-center gap-4">
        <div onclick="openEditStudentModal('${student.id}')" class="avatar-sticker w-16 h-16 rounded-3xl ${student.avatarBg} border-2 border-slate-800 flex items-center justify-center text-4xl shadow-[0_3px_0_#1e293b] cursor-pointer"
          title="Bấm để đổi Avatar hoặc sửa thông tin học sinh">
          ${student.avatar}
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-lg bg-amber-300 text-slate-900 font-black text-xs border border-slate-800">Mã HS: ${student.code}</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs border border-indigo-300">👤 TK: ${studentUsername}</span>
            <span class="text-xs font-bold text-slate-500">${classObj.name} • ${student.group}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2.5 mt-1">
            <h3 class="text-2xl font-black text-slate-900">${student.name}</h3>
            <button type="button" onclick="openEditStudentModal('${student.id}')"
              class="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 border border-slate-800 text-xs font-black text-slate-900 shadow-[0_1px_0_#1e293b] transition flex items-center gap-1"
              title="Chỉnh sửa tên, mã HS, nhóm, điểm số hoặc Avatar">
              <span>✏️ Sửa thông tin</span>
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            <span class="text-xs font-bold ${isEffectiveHidden ? "text-slate-400" : "text-emerald-700"}">
              ${isEffectiveHidden ? "🙈 Điểm đang ẩn trên màn hình chiếu" : `Tăng tuần: +${growth.weekGain}đ • Tăng tháng: +${growth.monthGain}đ`}
            </span>
            <span class="text-slate-300">|</span>
            <button type="button" onclick="teacherChangeStudentPassword('${student.id}')"
              class="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 border border-slate-400 hover:border-slate-800 text-[11px] font-black text-slate-700 transition"
              title="Giáo viên đặt mật khẩu mới cho học sinh này">
              🔑 Đổi MK
            </button>
            <button type="button" onclick="teacherResetStudentPassword('${student.id}')"
              class="px-2 py-0.5 rounded-lg bg-white hover:bg-emerald-100 border border-slate-400 hover:border-slate-800 text-[11px] font-black text-emerald-800 transition"
              title="Khôi phục mật khẩu của học sinh về mặc định 123456">
              🔄 Reset 123456
            </button>
            <button type="button" onclick="deleteStudent('${student.id}')"
              class="px-2 py-0.5 rounded-lg bg-white hover:bg-rose-100 border border-rose-300 text-[11px] font-black text-rose-600 transition"
              title="Xóa học sinh này khỏi lớp">
              🗑️ Xóa HS
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-right ${isEffectiveHidden ? "bg-slate-100 border-2 border-dashed border-slate-400" : "bg-amber-100 border-2 border-slate-800 shadow-[0_3px_0_#1e293b]"} px-4 py-2 rounded-2xl flex items-center gap-3">
          <div>
            <div class="text-[10px] font-black uppercase ${isEffectiveHidden ? "text-slate-500" : "text-amber-900"}">Điểm của ${student.name.split(' ').pop()}</div>
            <div class="text-2xl font-black ${isEffectiveHidden ? "text-slate-500" : "text-slate-900"}">${isEffectiveHidden ? "⭐ Đang ẩn" : `${student.points} điểm`}</div>
          </div>
          ${
            isGlobalHidden
              ? `<button type="button" onclick="toggleSingleStudentPointReveal('${student.id}', event)"
                  class="pop-btn ${isStudentRevealed ? 'pop-btn-yellow' : 'pop-btn-white'} px-2.5 py-1.5 rounded-xl text-xs font-black"
                  title="${isStudentRevealed ? 'Ẩn lại điểm của bạn này' : 'Chỉ hiện điểm của riêng bạn này'}">
                  ${isStudentRevealed ? '🙈 Ẩn lại' : '👁️ Xem điểm'}
                </button>`
              : ""
          }
        </div>
      </div>
    </div>

    <!-- Khung Cộng / Trừ điểm theo tiêu chí -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      <div class="bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl p-4">
        <h4 class="text-xs font-black uppercase tracking-wider text-emerald-900 mb-2.5">🌟 Cộng điểm tích cực</h4>
        <div class="flex flex-wrap gap-2">
          ${appState.pointBehaviors.positive
            .map(
              (b) => `
              <button onclick="quickAdjustPoint('${student.id}', ${b.points}, '${b.title}')"
                class="px-3 py-2 rounded-xl bg-white hover:bg-emerald-500 hover:text-white text-slate-800 border-2 border-emerald-300 text-xs font-black shadow-sm transition flex items-center gap-1.5">
                <span>${b.icon}</span>
                <span>${b.title}</span>
                <span class="font-black text-emerald-600 group-hover:text-white">+${b.points}</span>
              </button>
            `
            )
            .join("")}
        </div>
      </div>

      <div class="bg-rose-50/70 border-2 border-rose-300 rounded-3xl p-4">
        <h4 class="text-xs font-black uppercase tracking-wider text-rose-900 mb-2.5">⚠️ Nhắc nhở rèn luyện</h4>
        <div class="flex flex-wrap gap-2">
          ${appState.pointBehaviors.negative
            .map(
              (b) => `
              <button onclick="quickAdjustPoint('${student.id}', ${b.points}, '${b.title}')"
                class="px-3 py-2 rounded-xl bg-white hover:bg-rose-500 hover:text-white text-slate-800 border-2 border-rose-300 text-xs font-black shadow-sm transition flex items-center gap-1.5">
                <span>${b.icon}</span>
                <span>${b.title}</span>
                <span class="font-black text-rose-600">${b.points}</span>
              </button>
            `
            )
            .join("")}
        </div>
      </div>
    </div>

    <!-- Cấp thẻ nhanh: Power Card hoặc Challenge Card (Thiết kế 2 thẻ tách biệt, rộng rãi, không chồng chéo) -->
    <div class="bg-amber-50/80 border-2 border-slate-900 rounded-3xl p-5 mb-6 shadow-[0_4px_0_#1e293b]">
      <div class="mb-3.5">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
          <span>🎁</span> Trao Thẻ Đặc Quyền (Power Card) hoặc Gửi Thử Thách (Challenge Card) Cho ${student.name}
        </h4>
        <p class="text-[11px] font-bold text-slate-600">Chọn thẻ bên dưới để trao thưởng hoặc giao thử thách rèn luyện</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Khối 1: Trao Power Card -->
        <div class="bg-white rounded-2xl p-4 border-2 border-slate-900 shadow-[0_3px_0_#1e293b] flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
              <span>⚡</span> Trao Power Card
            </span>
            <span class="text-[11px] font-bold text-slate-500">Thưởng khi đạt mốc Point Line</span>
          </div>

          <div class="w-full">
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Chọn thẻ muốn trao:</label>
            <select id="modal-grant-power-select" class="w-full px-3 py-2.5 rounded-xl bg-amber-50/60 border-2 border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-slate-900">
              ${appState.powerCards
                .map(
                  (c) =>
                    `<option value="${c.id}">${c.icon} ${c.title}</option>`
                )
                .join("")}
            </select>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button onclick="grantCardToStudent('${student.id}', 'power')"
              class="pop-btn pop-btn-yellow px-4 py-2 rounded-xl text-xs font-black">
              🎁 Trao Thẻ Power Card
            </button>
          </div>
        </div>

        <!-- Khối 2: Gửi Challenge Card -->
        <div class="bg-white rounded-2xl p-4 border-2 border-slate-900 shadow-[0_3px_0_#1e293b] flex flex-col justify-between gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black text-violet-950 uppercase flex items-center gap-1.5">
              <span>🎯</span> Gửi Challenge Card
            </span>
            <span class="text-[11px] font-bold text-slate-500">Thử thách vui vẻ</span>
          </div>

          <div class="w-full">
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Chọn thử thách giao cho em:</label>
            <select id="modal-grant-penalty-select" class="w-full px-3 py-2.5 rounded-xl bg-violet-50/60 border-2 border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-slate-900">
              ${appState.penaltyCards
                .map((c) => `<option value="${c.id}">${c.icon} ${c.title}</option>`)
                .join("")}
            </select>
          </div>

          <div class="flex items-center justify-end pt-2 border-t border-slate-100">
            <button onclick="grantCardToStudent('${student.id}', 'penalty', false)"
              class="pop-btn pop-btn-violet px-4 py-2 rounded-xl text-xs font-black">
              🎯 Gửi Thử Thách
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- DANH SÁCH THẺ ĐANG SỞ HỮU (HIỂN THỊ PHÔI THẺ ĐỒ HỌA TỪ FOLDER CARD/) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-black text-slate-900 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500 border border-slate-900"></span>
            Thẻ Đang Có - CHƯA DÙNG (${unusedCards.length})
          </h4>
          <span class="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg">Sẵn sàng sử dụng</span>
        </div>

        <div class="space-y-4">
          ${
            unusedCards.length === 0
              ? `<div class="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                  Hiện không có thẻ nào chưa dùng.
                </div>`
              : unusedCards
                  .map((inst) => {
                    const tpl = findCardTemplate(inst.cardId, inst.type);
                    if (!tpl) return "";
                    const isPower = inst.type === "power";
                    return `
                      <div class="p-4 rounded-3xl border-2 ${
                        isPower
                          ? "bg-amber-50/80 border-amber-300"
                          : "bg-violet-50/80 border-violet-300"
                      } flex flex-col sm:flex-row items-center gap-4 shadow-sm">
                        <div class="shrink-0 flex justify-center">
                          ${renderVisualArtCard(tpl, "unused", { maxWidth: "155px", type: inst.type })}
                        </div>
                        <div class="flex-1 flex flex-col justify-between h-full w-full gap-2 text-left">
                          <div>
                            <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              isPower
                                ? "bg-amber-300 text-slate-900 border border-slate-900"
                                : "bg-violet-300 text-slate-900 border border-slate-900"
                            }">${isPower ? "⚡ POWER CARD • CHƯA DÙNG" : "🎯 CHALLENGE CARD • THỬ THÁCH"}</span>
                            <h5 class="font-black text-slate-900 text-base mt-1">${tpl.title}</h5>
                            <p class="text-xs font-bold text-slate-600 mt-0.5 leading-relaxed">${tpl.description}</p>
                          </div>
                          <div class="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                            <span class="text-[11px] font-bold text-slate-500">Cấp lúc: ${inst.acquiredAt}</span>
                            <button onclick="markCardAsUsed('${student.id}', '${inst.instanceId}')"
                              class="pop-btn ${
                                isPower ? "pop-btn-blue" : "pop-btn-green"
                              } px-3.5 py-1.5 rounded-xl text-xs font-black">
                              ${isPower ? "✅ Xác nhận Dùng Thẻ (Khóa)" : "✅ Đã xong thử thách (Khóa)"}
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
          }
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-black text-slate-900 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-slate-400 border border-slate-900"></span>
            Thẻ ĐÃ DÙNG / ĐÃ HOÀN THÀNH (${usedCards.length})
          </h4>
          <span class="text-[11px] font-black text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-lg">Đã khóa vĩnh viễn</span>
        </div>

        <div class="space-y-4">
          ${
            usedCards.length === 0
              ? `<div class="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                  Chưa có thẻ nào đã qua sử dụng.
                </div>`
              : usedCards
                  .map((inst) => {
                    const tpl = findCardTemplate(inst.cardId, inst.type);
                    if (!tpl) return "";
                    return `
                      <div class="relative p-4 rounded-3xl border-2 border-slate-300 bg-slate-100 flex flex-col sm:flex-row items-center gap-4 shadow-sm opacity-80">
                        <div class="shrink-0 flex justify-center">
                          ${renderVisualArtCard(tpl, "used", { maxWidth: "145px", type: inst.type })}
                        </div>
                        <div class="flex-1 flex flex-col justify-between h-full w-full gap-2 text-left">
                          <div>
                            <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-slate-300 text-slate-700">
                              🔒 ĐÃ SỬ DỤNG / HOÀN THÀNH
                            </span>
                            <h5 class="font-black text-slate-700 line-through text-base mt-1">${tpl.title}</h5>
                            <p class="text-xs font-bold text-slate-500 mt-0.5 leading-relaxed">${tpl.description}</p>
                          </div>
                          <div class="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                            <span>Cấp lúc: ${inst.acquiredAt}</span>
                            <span class="text-slate-800 font-black">Đã khóa: ${inst.usedAt || "Xong"}</span>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
          }
        </div>
      </div>
    </div>
  `;
}

function grantCardToStudent(studentId, type) {
  const found = findStudentById(studentId);
  if (!found) return;
  const { student } = found;

  const selectId =
    type === "power" ? "modal-grant-power-select" : "modal-grant-penalty-select";
  const cardId = document.getElementById(selectId)?.value;
  const tpl = findCardTemplate(cardId, type);
  if (!tpl) return;

  if (type === "penalty" && tpl.id === "pen-2") {
    student.points = Math.max(0, student.points - 3);
  }

  student.ownedCards.unshift({
    instanceId: "inst-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    cardId: tpl.id,
    type,
    status: "unused",
    acquiredAt: nowTimeString(),
    usedAt: null,
    note: type === "power" ? "Thưởng đạt mốc Point Line / Giáo viên trao" : "Giáo viên giao trên lớp"
  });

  student.history.unshift({
    time: nowTimeString(),
    daysAgo: 0,
    text: `${type === "power" ? "Nhận Power Card" : "Nhận Challenge Card"}: ${tpl.title}`,
    delta: 0
  });

  saveState();
  renderAll();
  renderStudentDetailModalContent(studentId);
  showToast(
    `${tpl.icon} Đã cấp thẻ "${tpl.title}" cho ${student.name}!`,
    type === "power" ? "indigo" : "amber"
  );
}

function markCardAsUsed(studentId, instanceId) {
  const found = findStudentById(studentId);
  if (!found) return;
  const { student } = found;

  const cardInst = student.ownedCards.find((c) => c.instanceId === instanceId);
  if (!cardInst) return;

  if (cardInst.status === "used") {
    showToast("🔒 Thẻ này đã được sử dụng hoặc hoàn thành trước đó!", "rose");
    return;
  }

  const tpl = findCardTemplate(cardInst.cardId, cardInst.type);
  const cardTitle = tpl ? tpl.title : "Thẻ bài";

  cardInst.status = "used";
  cardInst.usedAt = nowTimeString();

  student.history.unshift({
    time: cardInst.usedAt,
    daysAgo: 0,
    text: `Đã sử dụng & khóa thẻ: ${cardTitle}`,
    delta: 0
  });

  saveState();
  renderAll();
  if (activeStudentModalId === studentId) {
    renderStudentDetailModalContent(studentId);
  }
  showToast(`🔒 Đã xác nhận hoàn thành thẻ "${cardTitle}"! Thẻ đã bị khóa vĩnh viễn.`, "indigo");
}

// ----------------------------------------------------------------------------
// 11. HÀNG ĐỢI HỌC SINH PHÁT BIỂU TRONG 10 PHÚT TỚI
// ----------------------------------------------------------------------------
function renderSpeechQueue() {
  const container = document.getElementById("speech-queue-list");
  if (!container) return;

  if (!appState.speechQueue || appState.speechQueue.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
        Chưa có học sinh nào trong danh sách phát biểu 10 phút tới.
      </div>
    `;
    return;
  }

  container.innerHTML = appState.speechQueue
    .map(
      (item, idx) => `
      <div class="p-2.5 rounded-2xl border-2 ${
        item.done
          ? "bg-emerald-50 border-emerald-300 opacity-80"
          : "bg-white border-slate-900 shadow-[0_2px_0_#1e293b]"
      } flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-5 h-5 rounded-md bg-amber-300 border border-slate-900 text-slate-900 font-black text-[11px] flex items-center justify-center shrink-0">
            ${idx + 1}
          </span>
          <span class="text-lg shrink-0">${item.studentAvatar || "🙋"}</span>
          <div class="min-w-0">
            <div class="font-black text-xs text-slate-900 truncate ${
              item.done ? "line-through text-emerald-800" : ""
            }">${item.studentName}</div>
            <div class="text-[11px] font-bold text-slate-500 truncate">${
              item.topic || "Đăng ký phát biểu"
            }</div>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          ${
            !item.done
              ? `<button onclick="completeSpeechItem('${item.id}')" title="Hoàn thành phát biểu và cộng +2 điểm"
                  class="pop-btn pop-btn-green px-2 py-0.5 rounded-lg font-black text-[10px]">
                  +2đ
                </button>`
              : `<span class="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">Xong</span>`
          }
          <button onclick="removeSpeechItem('${item.id}')" title="Xóa khỏi danh sách"
            class="w-6 h-6 rounded-md border border-slate-300 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 font-black text-xs">
            ✕
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

function handleAddSpeechQueue(e) {
  e.preventDefault();
  const studentId = document.getElementById("speech-student-select").value;
  const topicInput = document.getElementById("speech-topic-input");
  const topic = topicInput.value.trim() || "Phát biểu xây dựng bài trong 10p tới";

  const found = findStudentById(studentId);
  if (!found) return;
  const { student } = found;

  appState.speechQueue.push({
    id: "sq-" + Date.now(),
    studentId: student.id,
    studentName: student.name,
    studentAvatar: student.avatar,
    topic,
    addedAt: nowTimeString().split(" ")[1],
    done: false
  });

  topicInput.value = "";
  saveState();
  renderSpeechQueue();
  showToast(`⏱️ Đã thêm ${student.name} vào DS phát biểu 10p tới!`, "indigo");
}

function pickRandomToSpeechQueue() {
  const cls = getCurrentClass();
  if (!cls || cls.students.length === 0) return;
  const randomSt = cls.students[Math.floor(Math.random() * cls.students.length)];

  appState.speechQueue.push({
    id: "sq-" + Date.now(),
    studentId: randomSt.id,
    studentName: randomSt.name,
    studentAvatar: randomSt.avatar,
    topic: "Được gọi ngẫu nhiên phát biểu trong 10p tới",
    addedAt: nowTimeString().split(" ")[1],
    done: false
  });

  saveState();
  renderSpeechQueue();
  showToast(`🎲 Đã chọn ngẫu nhiên ${randomSt.name} vào DS phát biểu 10p!`, "amber");
}

function completeSpeechItem(queueId) {
  const item = appState.speechQueue.find((i) => i.id === queueId);
  if (!item || item.done) return;
  item.done = true;

  const found = findStudentById(item.studentId);
  if (found) {
    found.student.speechCount = (found.student.speechCount || 0) + 1;
    quickAdjustPoint(item.studentId, 2, `Phát biểu: ${item.topic}`);
  } else {
    saveState();
    renderSpeechQueue();
  }
}

function removeSpeechItem(queueId) {
  appState.speechQueue = appState.speechQueue.filter((i) => i.id !== queueId);
  saveState();
  renderSpeechQueue();
}

function toggleSpeechTimer() {
  const btn = document.getElementById("timer-toggle-btn");
  if (speechTimerInterval) {
    clearInterval(speechTimerInterval);
    speechTimerInterval = null;
    if (btn) btn.textContent = "▶️ Tiếp tục đếm";
  } else {
    if (btn) btn.textContent = "⏸️ Tạm dừng";
    speechTimerInterval = setInterval(() => {
      if (speechTimerSeconds > 0) {
        speechTimerSeconds--;
        updateSpeechTimerDisplay();
      } else {
        clearInterval(speechTimerInterval);
        speechTimerInterval = null;
        if (btn) btn.textContent = "▶️ Bắt đầu 10p";
        showToast("⏰ Đã hết khung 10 phút phát biểu!", "amber");
      }
    }, 1000);
  }
}

function resetSpeechTimer() {
  if (speechTimerInterval) {
    clearInterval(speechTimerInterval);
    speechTimerInterval = null;
  }
  speechTimerSeconds = 600;
  updateSpeechTimerDisplay();
  const btn = document.getElementById("timer-toggle-btn");
  if (btn) btn.textContent = "▶️ Bắt đầu 10p";
}

function updateSpeechTimerDisplay() {
  const el = document.getElementById("speech-timer-display");
  if (!el) return;
  const m = String(Math.floor(speechTimerSeconds / 60)).padStart(2, "0");
  const s = String(speechTimerSeconds % 60).padStart(2, "0");
  el.textContent = `${m}:${s}`;
}

function renderClassActivityFeed() {
  const cls = getCurrentClass();
  const feedEl = document.getElementById("class-activity-feed");
  if (!cls || !feedEl) return;

  const allEvents = [];
  cls.students.forEach((st) => {
    (st.history || []).forEach((h) => {
      allEvents.push({
        studentName: st.name,
        studentAvatar: st.avatar,
        time: h.time,
        text: h.text,
        delta: h.delta
      });
    });
  });

  if (allEvents.length === 0) {
    feedEl.innerHTML = `<div class="text-slate-400 font-bold italic">Chưa có hoạt động nào.</div>`;
    return;
  }

  feedEl.innerHTML = allEvents
    .slice(0, 8)
    .map(
      (ev) => `
      <div class="p-2 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-base">${ev.studentAvatar}</span>
          <div class="min-w-0">
            <div class="font-black text-xs text-slate-900 truncate">${ev.studentName}</div>
            <div class="text-[10px] font-bold text-slate-500 truncate">${ev.text}</div>
          </div>
        </div>
        <span class="text-[9px] font-bold text-slate-400 shrink-0">${ev.time}</span>
      </div>
    `
    )
    .join("");
}

// ----------------------------------------------------------------------------
// 12. VÒNG QUAY RANDOM HỌC SINH (CÓ CHỌN TÙY Ý) & RANDOM THẺ BÀI
// ----------------------------------------------------------------------------
function openRandomStudentModal() {
  const cls = getCurrentClass();
  const groupSelect = document.getElementById("random-filter-group");
  if (groupSelect && cls) {
    const allGroups = [...new Set([...(cls.groupsList || []), ...cls.students.map((s) => s.group).filter(Boolean)])];
    groupSelect.innerHTML = `<option value="ALL">Tất cả các nhóm (${cls.students.length} HS)</option>` +
      allGroups.map((g) => {
        const count = cls.students.filter((s) => s.group === g).length;
        return `<option value="${g}">${g} (${count} HS)</option>`;
      }).join("");
  }

  const criteriaSelect = document.getElementById("random-filter-criteria");
  if (criteriaSelect) criteriaSelect.value = "ALL";

  // Khởi tạo danh sách tích chọn tùy ý (mặc định tích chọn hết nếu lần đầu mở hoặc lớp đổi)
  if (cls) {
    const validIds = cls.students.filter((s) => customSelectedStudentIds.has(s.id));
    if (validIds.length === 0) {
      cls.students.forEach((s) => customSelectedStudentIds.add(s.id));
    }
  }

  renderCustomRandomStudentsList();
  setRandomSelectionMode(currentRandomSelectionMode || "criteria");

  document.getElementById("random-student-modal").classList.remove("hidden");
  document.getElementById("random-student-actions").classList.add("hidden");
  document.getElementById("random-student-avatar").textContent = "🎲";
  document.getElementById("random-student-name").textContent = "Sẵn sàng quay!";
  document.getElementById("random-student-code").textContent =
    "Bấm nút bên dưới để chọn ngẫu nhiên theo đối tượng";

  updateRandomEligiblePool();
}

function setRandomSelectionMode(mode) {
  currentRandomSelectionMode = mode;
  const btnCriteria = document.getElementById("random-mode-criteria-btn");
  const btnCustom = document.getElementById("random-mode-custom-btn");
  const panelCriteria = document.getElementById("random-criteria-panel");
  const panelCustom = document.getElementById("random-custom-panel");

  if (mode === "custom") {
    if (btnCustom) {
      btnCustom.className = "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition bg-amber-300 text-slate-900 border border-slate-900 shadow-xs";
    }
    if (btnCriteria) {
      btnCriteria.className = "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    }
    if (panelCriteria) panelCriteria.classList.add("hidden");
    if (panelCustom) panelCustom.classList.remove("hidden");
    renderCustomRandomStudentsList();
  } else {
    if (btnCriteria) {
      btnCriteria.className = "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition bg-white text-slate-900 border border-slate-900 shadow-xs";
    }
    if (btnCustom) {
      btnCustom.className = "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    }
    if (panelCriteria) panelCriteria.classList.remove("hidden");
    if (panelCustom) panelCustom.classList.add("hidden");
  }
  updateRandomEligiblePool();
}

function renderCustomRandomStudentsList() {
  const cls = getCurrentClass();
  const container = document.getElementById("random-custom-students-list");
  if (!cls || !container) return;

  container.innerHTML = cls.students
    .map((st) => {
      const checked = customSelectedStudentIds.has(st.id);
      return `
        <label class="flex items-center gap-2 p-1.5 rounded-lg border ${checked ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-70'} cursor-pointer hover:border-slate-900 transition select-none">
          <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleCustomRandomStudent('${st.id}', this.checked)"
            class="rounded border-slate-300 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer shrink-0" />
          <span class="text-sm shrink-0">${st.avatar}</span>
          <span class="text-xs font-black text-slate-800 truncate">${st.name}</span>
          <span class="text-[10px] font-bold text-slate-400 ml-auto shrink-0">${st.code}</span>
        </label>
      `;
    })
    .join("");
}

function toggleCustomRandomStudent(studentId, isChecked) {
  if (isChecked) {
    customSelectedStudentIds.add(studentId);
  } else {
    customSelectedStudentIds.delete(studentId);
  }
  renderCustomRandomStudentsList();
  updateRandomEligiblePool();
}

function toggleAllCustomRandomStudents(selectAll) {
  const cls = getCurrentClass();
  if (!cls) return;
  if (selectAll) {
    cls.students.forEach((s) => customSelectedStudentIds.add(s.id));
  } else {
    cls.students.forEach((s) => customSelectedStudentIds.delete(s.id));
  }
  renderCustomRandomStudentsList();
  updateRandomEligiblePool();
}

function getEligibleStudentsForRandom() {
  const cls = getCurrentClass();
  if (!cls || cls.students.length === 0) return [];

  const excludeLast = document.getElementById("random-filter-exclude-last")?.checked ?? true;
  let pool = [];

  if (currentRandomSelectionMode === "custom") {
    pool = cls.students.filter((st) => customSelectedStudentIds.has(st.id));
  } else {
    const groupFilter = document.getElementById("random-filter-group")?.value || "ALL";
    const criteriaFilter = document.getElementById("random-filter-criteria")?.value || "ALL";

    // 1. Lọc theo nhóm
    pool = cls.students.filter((st) => {
      return groupFilter === "ALL" || st.group === groupFilter;
    });

    // 2. Lọc theo tiêu chí phát biểu / điểm
    if (criteriaFilter === "NO_SPEECH") {
      pool = pool.filter((st) => Number(st.speechCount || 0) === 0);
    } else if (criteriaFilter === "LOW_SPEECH") {
      const totalSpeech = cls.students.reduce((sum, s) => sum + (Number(s.speechCount) || 0), 0);
      const avgSpeech = cls.students.length > 0 ? totalSpeech / cls.students.length : 0;
      pool = pool.filter((st) => (Number(st.speechCount) || 0) <= Math.ceil(avgSpeech));
    } else if (criteriaFilter === "LOW_POINTS") {
      pool = pool.filter((st) => Number(st.points || 0) < 15);
    } else if (criteriaFilter === "HIGH_POINTS") {
      pool = pool.filter((st) => Number(st.points || 0) >= 20);
    } else if (criteriaFilter === "HAS_CHALLENGE") {
      pool = pool.filter((st) => (st.ownedCards || []).some((c) => c.type === "penalty" && c.status === "unused"));
    } else if (criteriaFilter === "HAS_POWER") {
      pool = pool.filter((st) => (st.ownedCards || []).some((c) => c.type === "power" && c.status === "unused"));
    }
  }

  // 3. Loại trừ bạn vừa được gọi ở lượt trước nếu danh sách còn bạn khác
  if (excludeLast && lastPickedStudentId && pool.length > 1) {
    const withoutLast = pool.filter((st) => st.id !== lastPickedStudentId);
    if (withoutLast.length > 0) {
      pool = withoutLast;
    }
  }

  return pool;
}

function updateRandomEligiblePool() {
  const eligible = getEligibleStudentsForRandom();
  const countBadge = document.getElementById("random-eligible-count");
  const spinBtn = document.getElementById("btn-spin-student");

  if (countBadge) {
    if (eligible.length === 0) {
      countBadge.className = "text-[11px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-300";
      countBadge.textContent = "⚠️ Không có học sinh phù hợp";
    } else {
      countBadge.className = "text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200";
      countBadge.textContent = `Đang có ${eligible.length} bạn phù hợp`;
    }
  }

  if (spinBtn && !spinBtn.disabled) {
    if (eligible.length === 0) {
      spinBtn.classList.add("opacity-60");
    } else {
      spinBtn.classList.remove("opacity-60");
    }
  }
}

function spinRandomStudent() {
  const cls = getCurrentClass();
  if (!cls || cls.students.length === 0) return;

  const eligibleStudents = getEligibleStudentsForRandom();
  if (!eligibleStudents || eligibleStudents.length === 0) {
    showToast("⚠️ Không có học sinh nào phù hợp với bộ lọc đã chọn! Hãy chọn tiêu chí rộng hơn.", "rose");
    return;
  }

  const avatarEl = document.getElementById("random-student-avatar");
  const nameEl = document.getElementById("random-student-name");
  const codeEl = document.getElementById("random-student-code");
  const actionsEl = document.getElementById("random-student-actions");
  const btn = document.getElementById("btn-spin-student");

  actionsEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "⏳ Đang quay trong " + eligibleStudents.length + " bạn...";

  let ticks = 0;
  const maxTicks = 18;
  const interval = setInterval(() => {
    const candidate = eligibleStudents[Math.floor(Math.random() * eligibleStudents.length)];
    avatarEl.textContent = candidate.avatar;
    nameEl.textContent = candidate.name;
    codeEl.textContent = `Mã: ${candidate.code} • ${candidate.group}`;
    ticks++;

    if (ticks >= maxTicks) {
      clearInterval(interval);
      lastPickedStudentId = candidate.id;
      btn.disabled = false;
      btn.textContent = "🎰 QUAY LẠI HỌC SINH KHÁC";
      actionsEl.classList.remove("hidden");
      playClapSound();
      updateRandomEligiblePool();
      showToast(`🎉 Chúc mừng ${candidate.name} (${candidate.code}) đã được chọn!`, "amber");
    }
  }, 85);
}

function addPickedStudentToSpeechQueue() {
  if (!lastPickedStudentId) return;
  const found = findStudentById(lastPickedStudentId);
  if (!found) return;
  const { student } = found;

  appState.speechQueue.push({
    id: "sq-" + Date.now(),
    studentId: student.id,
    studentName: student.name,
    studentAvatar: student.avatar,
    topic: "Được vòng quay Random gọi phát biểu",
    addedAt: nowTimeString().split(" ")[1],
    done: false
  });
  saveState();
  renderSpeechQueue();
  closeModal("random-student-modal");
  showToast(`⏱️ Đã thêm ${student.name} vào DS phát biểu 10 phút tới!`, "indigo");
}

function rewardPickedStudent(pts, reason) {
  if (!lastPickedStudentId) return;
  quickAdjustPoint(lastPickedStudentId, pts, reason);
  closeModal("random-student-modal");
}

function openPickedStudentDetail() {
  if (!lastPickedStudentId) return;
  closeModal("random-student-modal");
  openStudentDetailModal(lastPickedStudentId);
}

let currentRandomCardTargetType = "student"; // 'student' | 'group'

function openGroupSpinFromModal(mode) {
  const groupName = activeGroupModalName;
  closeModal("group-reward-modal");
  openRandomCardModal(mode, "group", groupName || "");
}

function setRandomCardTargetType(targetType) {
  currentRandomCardTargetType = targetType === "group" ? "group" : "student";
  const btnStudent = document.getElementById("random-card-target-student-btn");
  const btnGroup = document.getElementById("random-card-target-group-btn");
  const wrapStudent = document.getElementById("random-card-student-picker-wrap");
  const wrapGroup = document.getElementById("random-card-group-picker-wrap");
  const assignBtn = document.getElementById("btn-assign-drawn-card");

  if (currentRandomCardTargetType === "group") {
    if (btnGroup) {
      btnGroup.className = "py-1 px-3 rounded-lg text-xs font-black transition bg-emerald-400 text-slate-950 border border-slate-900 shadow-xs";
    }
    if (btnStudent) {
      btnStudent.className = "py-1 px-3 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    }
    if (wrapStudent) wrapStudent.classList.add("hidden");
    if (wrapGroup) wrapGroup.classList.remove("hidden");
    if (assignBtn) assignBtn.textContent = "✅ Phát Thẻ Này Cho Cả Nhóm";
  } else {
    if (btnStudent) {
      btnStudent.className = "py-1 px-3 rounded-lg text-xs font-black transition bg-white text-slate-900 border border-slate-900 shadow-xs";
    }
    if (btnGroup) {
      btnGroup.className = "py-1 px-3 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    }
    if (wrapStudent) wrapStudent.classList.remove("hidden");
    if (wrapGroup) wrapGroup.classList.add("hidden");
    if (assignBtn) assignBtn.textContent = "✅ Cấp Thẻ Này Cho Học Sinh";
  }
}

function openRandomCardModal(mode = "power", targetType = "student", preselectedGroup = "") {
  const cls = getCurrentClass();
  const select = document.getElementById("random-card-student-select");
  if (cls && select) {
    // Luôn chỉ hiển thị tên và mã học sinh, không hiển thị điểm số ở vòng quay bốc thẻ
    select.innerHTML = cls.students
      .map((s) => `<option value="${s.id}">${s.avatar} ${s.name} (${s.code})</option>`)
      .join("");
  }

  const groupSelect = document.getElementById("random-card-group-select");
  if (cls && groupSelect) {
    const allGroups = [...new Set([...(cls.groupsList || []), ...cls.students.map((s) => s.group).filter(Boolean)])];
    groupSelect.innerHTML = allGroups
      .map((g) => {
        const count = cls.students.filter((s) => s.group === g).length;
        return `<option value="${g}" ${g === preselectedGroup ? "selected" : ""}>🛡️ ${g} (${count} thành viên)</option>`;
      })
      .join("");
    if (preselectedGroup && allGroups.includes(preselectedGroup)) {
      groupSelect.value = preselectedGroup;
    }
  }

  setRandomCardTargetType(targetType);
  setRandomCardMode(mode);
  document.getElementById("random-card-modal").classList.remove("hidden");
}


// ============================================================================
// HÀM RENDER THẺ BÀI ĐỒ HỌA TỪ FOLDER CARD/ (1.jpg -> 24.jpg)
// ============================================================================
function getCategoryBadgeStyle(category, isPower) {
  const cat = String(category || "").toLowerCase();
  if (isPower) {
    if (cat.includes("trợ giúp")) return "bg-sky-100 text-sky-900 border-sky-300";
    if (cat.includes("chiến lược")) return "bg-amber-100 text-amber-900 border-amber-300";
    return "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300";
  }
  if (cat.includes("hỗ trợ")) return "bg-emerald-100 text-emerald-900 border-emerald-300";
  if (cat.includes("phát triển")) return "bg-orange-100 text-orange-900 border-orange-300";
  return "bg-violet-100 text-violet-900 border-violet-300";
}

function renderVisualArtCard(card, state = "unused", options = {}) {
  if (!card) return "";
  const isUsed = state === "used";
  const cleanFrame = resolveFrameUrl(card.cardFrame || "1.jpg");
  const isPower = card.type === "power" || (card.id && card.id.startsWith("pc")) || options.type === "power";
  const cardTypeKey = isPower ? "power" : "penalty";
  const categoryLabel = card.category || normalizeCardCategory("", cardTypeKey, 0);
  const shortCatLabel = categoryLabel.replace(/^Nhóm\s+/i, "");
  const maxWidth = options.maxWidth || "230px";
  const showStamp = isUsed;
  const isCompact = parseInt(maxWidth, 10) < 180;
  
  return `
    <div class="custom-art-card ${isUsed ? 'opacity-70 grayscale-[0.25]' : ''}" 
         style="background-image: url('${cleanFrame}'), url('Card/${cleanFrame}'); max-width: ${maxWidth};">
      
      <!-- Top header bar: Mã code & Nhãn phân loại nhóm thẻ -->
      <div class="flex items-center justify-between gap-1 z-10 w-full">
        <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-900 shadow-sm ${isPower ? 'bg-amber-300 text-slate-950' : 'bg-violet-300 text-slate-950'}">
          ${card.code || (isPower ? 'PWR' : 'CHL')}
        </span>
        <span class="text-[8px] font-black px-2 py-0.5 rounded-full border border-slate-900 bg-white/95 text-slate-900 truncate max-w-[125px]" title="${categoryLabel}">
          ${shortCatLabel}
        </span>
      </div>

      <!-- Vùng lòng thẻ trắng: Chữ nằm gọn bên trong khung màu trắng của ảnh Card/*.jpg -->
      <div class="art-card-inner-parchment">
        <div class="${isCompact ? 'text-xl mb-0.5' : 'text-2xl sm:text-3xl mb-1'} filter drop-shadow-sm leading-none shrink-0">${card.icon || (isPower ? '⚡' : '🎯')}</div>
        <h4 class="font-black text-slate-900 ${isCompact ? 'text-[10px]' : 'text-[11px] sm:text-xs'} leading-tight text-center mb-1 px-0.5 break-words w-full shrink-0">${card.title || 'Tên Thẻ'}</h4>
        <div class="w-6 h-0.5 bg-slate-300 rounded-full mb-1 shrink-0"></div>
        <p class="${isCompact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'} font-bold text-slate-700 leading-snug text-center overflow-y-auto max-h-full scrollbar-thin px-0.5 break-words w-full">
          ${card.description || 'Nội dung thẻ do giáo viên soạn...'}
        </p>
      </div>

      <!-- Bottom footer bar -->
      <div class="flex items-center justify-between gap-1 z-10 w-full pt-1 mt-auto">
        <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${isUsed ? 'bg-slate-700 text-slate-200' : (isPower ? 'bg-amber-400 text-slate-900' : 'bg-violet-400 text-slate-900')} border border-slate-900">
          ${isUsed ? '🔒 ĐÃ DÙNG' : (isPower ? '⚡ POWER CARD' : '🎯 CHALLENGE')}
        </span>
        <span class="text-[8px] sm:text-[9px] font-black text-slate-800 bg-white/85 px-1.5 py-0.5 rounded border border-slate-700">ClassJoy</span>
      </div>

      ${showStamp ? '<div class="used-stamp" style="font-size: 13px; padding: 3px 10px;">ĐÃ SỬ DÙNG</div>' : ''}
    </div>
  `;
}

let currentRandomCardCategory = "ALL";

function populateRandomCardCategorySelect(mode) {
  const select = document.getElementById("random-card-category-select");
  const countBadge = document.getElementById("random-card-pool-count");
  const deck = mode === "power" ? (appState.powerCards || []) : (appState.penaltyCards || []);
  const categories = getCardCategories(mode);

  if (select) {
    const optionsHtml = [
      `<option value="ALL">🌟 Tất cả các nhóm thẻ (${deck.length} thẻ)</option>`,
      ...categories.map((cat) => {
        const count = deck.filter((c) => normalizeCardCategory(c.category, mode) === cat).length;
        return `<option value="${cat}">📂 ${cat} (${count} thẻ)</option>`;
      })
    ].join("");
    select.innerHTML = optionsHtml;
    if (currentRandomCardCategory !== "ALL" && !categories.includes(currentRandomCardCategory)) {
      currentRandomCardCategory = "ALL";
    }
    select.value = currentRandomCardCategory;
  }

  updateRandomCardPoolCount(mode);
}

function handleRandomCardCategoryChange(val) {
  currentRandomCardCategory = val || "ALL";
  lastDrawnCardTemplate = null;
  const flipper = document.getElementById("random-card-flipper");
  if (flipper) flipper.classList.remove("is-flipped");
  const assignBtn = document.getElementById("btn-assign-drawn-card");
  if (assignBtn) assignBtn.classList.add("hidden");
  updateRandomCardPoolCount(currentRandomCardMode);
}

function getEligibleCardsForRandom(mode = currentRandomCardMode) {
  const deck = mode === "power" ? (appState.powerCards || []) : (appState.penaltyCards || []);
  if (!currentRandomCardCategory || currentRandomCardCategory === "ALL") {
    return deck;
  }
  return deck.filter((c) => normalizeCardCategory(c.category, mode) === currentRandomCardCategory);
}

function updateRandomCardPoolCount(mode = currentRandomCardMode) {
  const countBadge = document.getElementById("random-card-pool-count");
  const spinBtn = document.getElementById("btn-spin-card");
  const pool = getEligibleCardsForRandom(mode);
  if (countBadge) {
    if (pool.length === 0) {
      countBadge.className = "text-[11px] font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-lg border border-rose-300";
      countBadge.textContent = "⚠️ 0 thẻ trong nhóm này";
    } else {
      countBadge.className = "text-[11px] font-black text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200";
      countBadge.textContent = `Đang có ${pool.length} thẻ phù hợp`;
    }
  }
  if (spinBtn && !isSpinningRandomCard) {
    if (pool.length === 0) {
      spinBtn.classList.add("opacity-60");
    } else {
      spinBtn.classList.remove("opacity-60");
    }
  }
}

function setRandomCardMode(mode) {
  currentRandomCardMode = mode;
  currentRandomCardCategory = "ALL";
  lastDrawnCardTemplate = null;
  const assignBtn = document.getElementById("btn-assign-drawn-card");
  if (assignBtn) assignBtn.classList.add("hidden");

  const spinBtn = document.getElementById("btn-spin-card");
  if (spinBtn) {
    spinBtn.disabled = false;
    spinBtn.classList.remove("opacity-60");
    spinBtn.innerHTML = "🎰 QUAY THẺ NGẪU NHIÊN";
  }

  const btnPower = document.getElementById("switch-draw-power");
  const btnPenalty = document.getElementById("switch-draw-penalty");
  const badge = document.getElementById("random-card-badge");
  const flipper = document.getElementById("random-card-flipper");
  if (flipper) flipper.classList.remove("is-flipped");

  if (mode === "power") {
    if (btnPower) {
      btnPower.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition bg-amber-400 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]";
    }
    if (btnPenalty) {
      btnPenalty.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition text-slate-600";
    }
    if (badge) badge.textContent = "⚡ Vòng Quay Bốc Thẻ Power Card";
  } else {
    if (btnPenalty) {
      btnPenalty.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition bg-violet-400 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]";
    }
    if (btnPower) {
      btnPower.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition text-slate-600";
    }
    if (badge) badge.textContent = "🎯 Vòng Quay Bốc Challenge Card";
  }

  populateRandomCardCategorySelect(mode);
}

let isSpinningRandomCard = false;

function spinRandomCard() {
  if (isSpinningRandomCard) return;

  const deck = getEligibleCardsForRandom(currentRandomCardMode);
  if (!deck || deck.length === 0) {
    showToast("⚠️ Nhóm thẻ này hiện chưa có thẻ nào! Vui lòng chọn nhóm khác hoặc thêm thẻ.", "rose");
    return;
  }

  isSpinningRandomCard = true;
  const flipper = document.getElementById("random-card-flipper");
  const frontContent = document.getElementById("random-card-front-content");
  const assignBtn = document.getElementById("btn-assign-drawn-card");
  const spinBtn = document.getElementById("btn-spin-card");

  if (assignBtn) assignBtn.classList.add("hidden");
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.classList.add("opacity-60");
    spinBtn.innerHTML = "⏳ ĐANG TRÁO & LẬT THẺ...";
  }

  const wasAlreadyFlipped = flipper && flipper.classList.contains("is-flipped");

  // 1. Úp thẻ lại nếu trước đó đang ngửa
  if (flipper) flipper.classList.remove("is-flipped");

  const backCard = flipper?.querySelector(".card-flip-back");
  if (backCard) backCard.classList.add("animate-pulse");

  // Đợi thẻ úp lại xong mới đổi nội dung mặt trước rồi lật ngửa lên
  const flipWaitMs = wasAlreadyFlipped ? 550 : 350;

  setTimeout(() => {
    try {
      // Chọn thẻ ngẫu nhiên trong nhóm đã lọc
      let candidate = deck[Math.floor(Math.random() * deck.length)];
      if (deck.length > 1 && lastDrawnCardTemplate && candidate.id === lastDrawnCardTemplate.id && Math.random() < 0.7) {
        const others = deck.filter((c) => c.id !== lastDrawnCardTemplate.id);
        candidate = others[Math.floor(Math.random() * others.length)];
      }
      lastDrawnCardTemplate = candidate;

      if (frontContent) {
        frontContent.innerHTML = renderVisualArtCard(candidate, "unused", { maxWidth: "235px", type: currentRandomCardMode });
      }

      if (backCard) backCard.classList.remove("animate-pulse");
      if (flipper) {
        void flipper.offsetWidth; // Force reflow để trình duyệt nhận animation lật tiếp theo
        flipper.classList.add("is-flipped");
      }

      if (typeof playFanfareSound === "function") playFanfareSound();
      // Đã bỏ hiệu ứng pháo hoa toàn màn hình để không che thẻ bài vừa bốc
    } catch (err) {
      console.error("Lỗi khi quay thẻ:", err);
    } finally {
      setTimeout(() => {
        isSpinningRandomCard = false;
        if (assignBtn) assignBtn.classList.remove("hidden");
        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.classList.remove("opacity-60");
          spinBtn.innerHTML = "🔄 QUAY LẠI THẺ KHÁC";
        }
      }, 650);
    }
  }, flipWaitMs);
}

function confirmAssignDrawnCard() {
  if (!lastDrawnCardTemplate) return;

  // Trường hợp 1: Quay thẻ cho CẢ NHÓM và phân phối đồng loạt đến từng thành viên
  if (currentRandomCardTargetType === "group") {
    const cls = getCurrentClass();
    const groupName = document.getElementById("random-card-group-select")?.value;
    if (!cls || !groupName) return;

    const members = cls.students.filter((s) => s.group === groupName);
    if (members.length === 0) {
      showToast(`⚠️ ${groupName} hiện chưa có thành viên nào để nhận thẻ!`, "rose");
      return;
    }

    members.forEach((st) => {
      if (currentRandomCardMode === "penalty" && lastDrawnCardTemplate.id === "pen-2") {
        st.points = Math.max(0, st.points - 3);
      }
      st.ownedCards.unshift({
        instanceId: "inst-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        cardId: lastDrawnCardTemplate.id,
        type: currentRandomCardMode,
        status: "unused",
        acquiredAt: nowTimeString(),
        usedAt: null,
        note: `Quay thẻ nhóm (${groupName})`
      });
      st.history.unshift({
        time: nowTimeString(),
        daysAgo: 0,
        text: `Quay trúng thẻ nhóm (${groupName}) - ${
          currentRandomCardMode === "power" ? "Power Card" : "Challenge Card"
        }: ${lastDrawnCardTemplate.title}`,
        delta: 0
      });
    });

    saveState();
    renderAll();
    closeModal("random-card-modal");
    showToast(
      `🎉 Đã phân phối thẻ "${lastDrawnCardTemplate.title}" cho toàn bộ ${members.length} bạn thuộc ${groupName}!`,
      currentRandomCardMode === "power" ? "indigo" : "amber"
    );
    return;
  }

  // Trường hợp 2: Quay thẻ cho CÁ NHÂN học sinh
  const studentId = document.getElementById("random-card-student-select")?.value;
  const found = findStudentById(studentId);
  if (!found) return;
  const { student } = found;

  student.ownedCards.unshift({
    instanceId: "inst-" + Date.now(),
    cardId: lastDrawnCardTemplate.id,
    type: currentRandomCardMode,
    status: "unused",
    acquiredAt: nowTimeString(),
    usedAt: null,
    note: "Bốc ngẫu nhiên từ Vòng quay 3D"
  });

  if (currentRandomCardMode === "penalty" && lastDrawnCardTemplate.id === "pen-2") {
    student.points = Math.max(0, student.points - 3);
  }

  student.history.unshift({
    time: nowTimeString(),
    daysAgo: 0,
    text: `Quay trúng ${
      currentRandomCardMode === "power" ? "Power Card" : "Challenge Card"
    }: ${lastDrawnCardTemplate.title}`,
    delta: 0
  });

  saveState();
  renderAll();
  closeModal("random-card-modal");
  showToast(
    `🎉 Đã cấp thẻ "${lastDrawnCardTemplate.title}" cho ${student.name}!`,
    currentRandomCardMode === "power" ? "indigo" : "amber"
  );
}

// ----------------------------------------------------------------------------
// 13. KHO THẺ POWER CARD & CHALLENGE CARD
// ----------------------------------------------------------------------------
let currentPowerDeckCategoryFilter = "ALL";
let currentPenaltyDeckCategoryFilter = "ALL";

function setDeckCategoryFilter(type, category) {
  if (type === "power") {
    currentPowerDeckCategoryFilter = category;
  } else {
    currentPenaltyDeckCategoryFilter = category;
  }
  renderCardDecks();
}

function renderDeckCategoryFilterButtons(type) {
  const isPower = type === "power";
  const container = document.getElementById(isPower ? "power-deck-category-filters" : "penalty-deck-category-filters");
  if (!container) return;

  const deck = isPower ? (appState.powerCards || []) : (appState.penaltyCards || []);
  const categories = getCardCategories(type);
  const activeFilter = isPower ? currentPowerDeckCategoryFilter : currentPenaltyDeckCategoryFilter;
  const allItems = ["ALL", ...categories];

  container.innerHTML = allItems
    .map((cat) => {
      const isActive = cat === activeFilter;
      const count = cat === "ALL"
        ? deck.length
        : deck.filter((c) => normalizeCardCategory(c.category, type) === cat).length;
      const label = cat === "ALL" ? `Tất cả (${count})` : `${cat} (${count})`;
      return `<button type="button" onclick="setDeckCategoryFilter('${type}', '${cat}')"
        class="px-3 py-1.5 rounded-xl text-xs font-black transition ${
          isActive
            ? (isPower ? "bg-amber-400 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]" : "bg-violet-400 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]")
            : "bg-slate-100 text-slate-700 border-2 border-transparent hover:border-slate-300"
        }">${label}</button>`;
    })
    .join("");
}

function renderCardDecks() {
  renderDeckCategoryFilterButtons("power");
  renderDeckCategoryFilterButtons("penalty");

  const powerGrid = document.getElementById("power-cards-deck-grid");
  if (powerGrid) {
    const filteredPower = (appState.powerCards || []).filter(
      (c) => currentPowerDeckCategoryFilter === "ALL" || normalizeCardCategory(c.category, "power") === currentPowerDeckCategoryFilter
    );
    powerGrid.innerHTML = filteredPower.length > 0
      ? filteredPower.map((card) => renderSingleDeckCardHtml(card, "power")).join("")
      : `<div class="col-span-full bg-white rounded-3xl p-8 text-center border-2 border-dashed border-slate-300 text-xs font-bold text-slate-400">Chưa có thẻ Power Card nào thuộc phân loại "${currentPowerDeckCategoryFilter}".</div>`;
  }

  const penaltyGrid = document.getElementById("penalty-cards-deck-grid");
  if (penaltyGrid) {
    const filteredPenalty = (appState.penaltyCards || []).filter(
      (c) => currentPenaltyDeckCategoryFilter === "ALL" || normalizeCardCategory(c.category, "penalty") === currentPenaltyDeckCategoryFilter
    );
    penaltyGrid.innerHTML = filteredPenalty.length > 0
      ? filteredPenalty.map((card) => renderSingleDeckCardHtml(card, "penalty")).join("")
      : `<div class="col-span-full bg-white rounded-3xl p-8 text-center border-2 border-dashed border-slate-300 text-xs font-bold text-slate-400">Chưa có thẻ Challenge Card nào thuộc phân loại "${currentPenaltyDeckCategoryFilter}".</div>`;
  }
}

function renderSingleDeckCardHtml(card, type) {
  const isPower = type === "power";
  const categoryLabel = normalizeCardCategory(card.category, type);
  const badgeStyle = getCategoryBadgeStyle(categoryLabel, isPower);
  const visualCard = renderVisualArtCard(card, "unused", { maxWidth: "230px", type });

  return `
    <div class="game-card-pop flex flex-col justify-between items-center p-5 bg-white">
      <div class="w-full flex items-center justify-between gap-2 mb-1">
        <span class="px-2.5 py-0.5 rounded-full border text-[11px] font-black ${badgeStyle}">
          📂 ${categoryLabel}
        </span>
        <span class="text-[11px] font-black text-slate-400">${card.code}</span>
      </div>
      <div class="w-full flex justify-center py-2">
        ${visualCard}
      </div>

      <div class="w-full mt-3 pt-3 border-t-2 border-slate-200 flex items-center justify-between gap-2">
        <button onclick="openEditCardModal('${card.id}', '${type}')"
          class="pop-btn pop-btn-yellow flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5">
          <span>✏️</span> Soạn Chữ & Đổi Phôi
        </button>
        <button onclick="deleteCardTemplate('${card.id}', '${type}')"
          class="pop-btn pop-btn-coral py-2 px-3 rounded-xl text-xs font-black" title="Xóa thẻ này">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function populateCardEditorCategorySelect(type, selectedCategory = "") {
  const select = document.getElementById("edit-card-category");
  if (!select) return;
  const categories = getCardCategories(type);
  const normalized = normalizeCardCategory(selectedCategory, type, 0);
  select.innerHTML = categories
    .map((cat) => `<option value="${cat}" ${cat === normalized ? "selected" : ""}>${cat}</option>`)
    .join("");
  select.value = normalized;
}

function populateCardFramePicker() {
  const container = document.getElementById("card-frame-picker");
  if (!container) return;
  const currentFrame = resolveFrameUrl(document.getElementById("edit-card-frame")?.value || "1.jpg");
  const rawFrames = typeof AVAILABLE_CARD_FRAMES !== "undefined" && AVAILABLE_CARD_FRAMES.length > 0
    ? AVAILABLE_CARD_FRAMES
    : Array.from({ length: 24 }, (_, i) => `${i + 1}.jpg`);
  const frames = rawFrames.map((f) => resolveFrameUrl(f));
  
  container.innerHTML = frames
    .map((frameFile, idx) => {
      const isSelected = frameFile === currentFrame;
      return `
        <button type="button" 
          onclick="selectCardFrame('${frameFile}')" 
          class="frame-thumbnail-btn ${isSelected ? 'is-selected' : ''}" 
          style="background-image: url('${frameFile}'), url('Card/${frameFile}');" 
          title="Phôi thẻ ${idx + 1}">
          <span class="sr-only">Mẫu ${idx + 1}</span>
        </button>
      `;
    })
    .join("");
}

function selectCardFrame(frameUrl) {
  const clean = resolveFrameUrl(frameUrl);
  const input = document.getElementById("edit-card-frame");
  if (input) input.value = clean;

  const buttons = document.querySelectorAll(".frame-thumbnail-btn");
  buttons.forEach((btn) => {
    if (btn.style.backgroundImage && btn.style.backgroundImage.includes(clean)) {
      btn.classList.add("is-selected");
    } else {
      btn.classList.remove("is-selected");
    }
  });

  updateCardEditorPreview();
}

function populateCardIconPicker() {
  const container = document.getElementById("card-icon-picker");
  if (!container) return;
  const currentIcon = (document.getElementById("edit-card-icon")?.value || "⚡").trim();
  const icons = typeof CARD_ICON_POOL !== "undefined" && CARD_ICON_POOL.length > 0
    ? CARD_ICON_POOL
    : ["⚡", "🤝", "🎯", "⭐", "📈", "🎁", "✨", "🎨", "🎧", "💌", "🏆", "📚", "🧹", "📝", "💡", "🎤", "💬", "🧘", "🛡️", "👑", "🍫", "🏖️", "🎭", "🌈"];

  container.innerHTML = icons
    .map((ic) => {
      const isSelected = ic === currentIcon;
      return `
        <button type="button" onclick="selectCardIcon('${ic}')"
          class="w-8 h-8 rounded-lg border ${isSelected ? 'bg-amber-300 border-slate-900 scale-110 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-600 hover:bg-amber-50'} flex items-center justify-center text-base transition cursor-pointer"
          title="Chọn biểu tượng ${ic}">
          ${ic}
        </button>
      `;
    })
    .join("");
}

function selectCardIcon(iconChar) {
  const input = document.getElementById("edit-card-icon");
  if (input) input.value = iconChar;
  populateCardIconPicker();
  updateCardEditorPreview();
}

function updateCardEditorPreview() {
  const previewContainer = document.getElementById("card-editor-live-preview");
  if (!previewContainer) return;

  const type = document.getElementById("edit-card-type")?.value || "power";
  const isPower = type === "power";
  const name = document.getElementById("edit-card-name")?.value.trim() || (isPower ? "Tên Thẻ Power Card" : "Tên Challenge Card");
  const icon = document.getElementById("edit-card-icon")?.value.trim() || (isPower ? "⚡" : "🎯");
  const code = document.getElementById("edit-card-code")?.value.trim().toUpperCase() || (isPower ? "PWR-01" : "CHL-01");
  const category = document.getElementById("edit-card-category")?.value || normalizeCardCategory("", type, 0);
  const desc = document.getElementById("edit-card-desc")?.value.trim() || "Nội dung quyền năng hoặc thử thách của thẻ do giáo viên soạn thảo sẽ hiển thị ngay tại đây...";
  const frame = resolveFrameUrl(document.getElementById("edit-card-frame")?.value || (isPower ? "1.jpg" : "4.jpg"));

  const previewCard = {
    id: "preview",
    type,
    code,
    category,
    title: name,
    icon,
    description: desc,
    cardFrame: frame
  };

  previewContainer.innerHTML = renderVisualArtCard(previewCard, "unused", { maxWidth: "230px", type });
}

function openCreateCardModal(type) {
  const isPower = type === "power";
  document.getElementById("edit-card-type").value = type;
  document.getElementById("edit-card-id").value = "";
  document.getElementById("card-editor-title").textContent =
    isPower ? "🎨 Thêm Thẻ Power Card Mới" : "🎨 Thêm Thẻ Challenge Card Mới";
  document.getElementById("edit-card-name").value = "";
  document.getElementById("edit-card-icon").value = isPower ? "⚡" : "🎯";
  document.getElementById("edit-card-code").value =
    isPower
      ? `PWR-${String(appState.powerCards.length + 1).padStart(2, "0")}`
      : `CHL-${String(appState.penaltyCards.length + 1).padStart(2, "0")}`;
  document.getElementById("edit-card-desc").value = "";
  populateCardEditorCategorySelect(type, "");

  // Chọn sẵn ngẫu nhiên 1 trong 24 phôi thẻ khi mở tạo thẻ mới
  const rawFrames = typeof AVAILABLE_CARD_FRAMES !== "undefined" && AVAILABLE_CARD_FRAMES.length > 0
    ? AVAILABLE_CARD_FRAMES
    : ["1.jpg"];
  const randomFrame = resolveFrameUrl(rawFrames[Math.floor(Math.random() * rawFrames.length)]);
  document.getElementById("edit-card-frame").value = randomFrame;

  populateCardFramePicker();
  populateCardIconPicker();
  updateCardEditorPreview();
  document.getElementById("card-editor-modal").classList.remove("hidden");
}

function openEditCardModal(cardId, type) {
  const card = findCardTemplate(cardId, type);
  if (!card) return;
  const isPower = type === "power";

  document.getElementById("edit-card-type").value = type;
  document.getElementById("edit-card-id").value = card.id;
  document.getElementById("card-editor-title").textContent = `🎨 Soạn & Đổi Phôi Thẻ (${card.code})`;
  document.getElementById("edit-card-name").value = card.title;
  document.getElementById("edit-card-icon").value = card.icon;
  document.getElementById("edit-card-code").value = card.code;
  document.getElementById("edit-card-desc").value = card.description;
  populateCardEditorCategorySelect(type, card.category);
  const rawFrame = card.cardFrame || (isPower ? "1.jpg" : "4.jpg");
  document.getElementById("edit-card-frame").value = resolveFrameUrl(rawFrame);

  populateCardFramePicker();
  populateCardIconPicker();
  updateCardEditorPreview();
  document.getElementById("card-editor-modal").classList.remove("hidden");
}

function handleSaveCardTemplate(e) {
  e.preventDefault();
  const type = document.getElementById("edit-card-type").value;
  const id = document.getElementById("edit-card-id").value;
  const title = document.getElementById("edit-card-name").value.trim();
  const icon = document.getElementById("edit-card-icon").value.trim() || "🃏";
  const code = document.getElementById("edit-card-code").value.trim().toUpperCase();
  const category = normalizeCardCategory(document.getElementById("edit-card-category")?.value, type, 0);
  const description = document.getElementById("edit-card-desc").value.trim();
  const cardFrame = resolveFrameUrl(document.getElementById("edit-card-frame").value.trim() || "1.jpg");

  const targetDeck = type === "power" ? appState.powerCards : appState.penaltyCards;

  if (id) {
    const existing = targetDeck.find((c) => c.id === id);
    if (existing) {
      existing.title = title;
      existing.icon = icon;
      existing.code = code;
      existing.category = category;
      existing.description = description;
      existing.cardFrame = cardFrame;
    }
  } else {
    targetDeck.push({
      id: (type === "power" ? "pc-" : "pen-") + Date.now(),
      code,
      category,
      title,
      icon,
      description,
      cardFrame
    });
  }

  saveState();
  renderCardDecks();
  closeModal("card-editor-modal");
  showToast(`💾 Đã lưu thẻ "${title}" (${category}) thành công!`, "emerald");
}

function deleteCardTemplate(cardId, type) {
  if (!confirm("Bạn có chắc muốn xóa mẫu thẻ này khỏi bộ thẻ không?")) return;
  if (type === "power") {
    appState.powerCards = appState.powerCards.filter((c) => c.id !== cardId);
  } else {
    appState.penaltyCards = appState.penaltyCards.filter((c) => c.id !== cardId);
  }
  saveState();
  renderCardDecks();
  showToast("🗑️ Đã xóa thẻ khỏi bộ thẻ.", "slate");
}


// ----------------------------------------------------------------------------
// 14. CỔNG TRA CỨU HỌC SINH (XEM TIẾN TRÌNH ĐẠT ĐẾN ĐÂU & TÚI THẺ)
// ----------------------------------------------------------------------------
function renderPortalQuickCodes() {
  const container = document.getElementById("portal-quick-codes");
  const wrapper = document.getElementById("portal-quick-codes-wrapper");
  if (!container) return;

  // Chỉ hiện danh sách chọn nhanh nếu Giáo viên đang ở chế độ Giáo viên
  if ((!currentFirebaseUser && !isDemoMode) || currentAppRole === "student") {
    if (wrapper) wrapper.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const allStudents = [];
  appState.classes.forEach((c) => {
    c.students.forEach((s) => allStudents.push({ ...s, className: c.name }));
  });

  if (allStudents.length === 0) {
    if (wrapper) wrapper.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  if (wrapper) wrapper.classList.remove("hidden");
  container.innerHTML = allStudents
    .map(
      (s) => `
      <button type="button" onclick="selectQuickPortalCode('${s.code}')"
        class="px-3 py-1.5 rounded-xl bg-white border-2 border-slate-900 shadow-[0_2px_0_#1e293b] hover:bg-amber-100 text-xs font-black text-slate-800 transition">
        ${s.avatar} ${(s.username || s.code).toLowerCase()} - ${s.name}
      </button>
    `
    )
    .join("");
}

function selectQuickPortalCode(code) {
  const found = findStudentByCode(code);
  const codeInput = document.getElementById("portal-code-input");
  const pwInput = document.getElementById("portal-password-input");
  if (codeInput) codeInput.value = found ? (found.student.username || found.student.code).toLowerCase() : code;
  if (pwInput && found) pwInput.value = found.student.password || "123456";
  renderStudentPortalProfile(code, found ? (found.student.password || "123456") : "123456", true);
}

function handleStudentPortalSearch(e) {
  e.preventDefault();
  const code = document.getElementById("portal-code-input").value.trim();
  const password = document.getElementById("portal-password-input")?.value.trim() || "123456";
  renderStudentPortalProfile(code, password, false);
}

function renderStudentPortalProfile(code, password = "123456", skipPasswordCheck = false) {
  const resultBox = document.getElementById("student-portal-result");
  if (!resultBox) return;

  applySavedStudentPasswords(appState);
  const found = findStudentByCode(code);
  if (!found) {
    resultBox.innerHTML = `
      <div class="bg-white rounded-3xl p-8 text-center border-2 border-rose-400 shadow-[0_4px_0_#f43f5e]">
        <div class="text-4xl mb-2">❌</div>
        <h3 class="text-lg font-black text-slate-900">Không tìm thấy Tài khoản / Mã HS "${code}"</h3>
        <p class="text-xs font-bold text-slate-500 mt-1">Vui lòng kiểm tra lại tài khoản theo quy luật [MãLớp]-[STT] (ví dụ: 10a1-01, 10a1-02...)</p>
      </div>
    `;
    return;
  }

  const { student, classObj } = found;
  const expectedPw = String(student.password || "123456");
  if (!skipPasswordCheck && String(password) !== expectedPw) {
    resultBox.innerHTML = `
      <div class="bg-white rounded-3xl p-8 text-center border-2 border-rose-400 shadow-[0_4px_0_#f43f5e]">
        <div class="text-4xl mb-2">🔐</div>
        <h3 class="text-lg font-black text-slate-900">Mật khẩu không chính xác!</h3>
        <p class="text-xs font-bold text-slate-500 mt-1">Vui lòng nhập đúng mật khẩu mới đã đổi. Nếu em quên mật khẩu, hãy nhờ thầy/cô bấm nút Reset mật khẩu nhé!</p>
      </div>
    `;
    showToast("❌ Sai mật khẩu tài khoản học sinh!", "rose");
    return;
  }

  // Lắng nghe đồng bộ thời gian thực từ Firestore (Real-time Cloud Sync cho điện thoại học sinh)
  if (firestoreDb && classObj && (!studentPortalLiveUnsub || studentPortalLiveClassId !== classObj.id)) {
    if (studentPortalLiveUnsub) studentPortalLiveUnsub();
    studentPortalLiveClassId = classObj.id;
    studentPortalLiveUnsub = firestoreDb.collection("shared_classes").doc(classObj.id).onSnapshot((doc) => {
      if (doc.exists) {
        const cloudData = doc.data();
        if (cloudData && cloudData.students) {
          classObj.students = cloudData.students;
          if (cloudData.powerCards) appState.powerCards = cloudData.powerCards;
          if (cloudData.penaltyCards) appState.penaltyCards = cloudData.penaltyCards;
          if (cloudData.pointLineMilestones) appState.pointLineMilestones = cloudData.pointLineMilestones;
          if (typeof cloudData.isPointsHidden !== "undefined") appState.isPointsHidden = cloudData.isPointsHidden;
          sanitizeCardFrames(appState);
          const updatedFound = findStudentByCode(code);
          if (updatedFound) {
            renderStudentPortalProfileHtml(updatedFound.student, updatedFound.classObj);
          }
        }
      }
    }, (err) => console.warn("Lỗi Firestore Snapshot học sinh:", err));
  }

  renderStudentPortalProfileHtml(student, classObj);
}

function renderStudentPortalProfileHtml(student, classObj) {
  const resultBox = document.getElementById("student-portal-result");
  if (!resultBox) return;

  const unusedPowerCards = student.ownedCards.filter((c) => c.type === "power" && c.status === "unused");
  const unusedChallengeCards = student.ownedCards.filter((c) => c.type === "penalty" && c.status === "unused");
  const usedCards = student.ownedCards.filter((c) => c.status === "used");
  const growth = calculateStudentGrowth(student);
  const studentUsername = (student.username || student.code || "").toLowerCase();

  const milestones = [...appState.pointLineMilestones].sort((a, b) => a.threshold - b.threshold);
  let nextMilestone = milestones.find((m) => m.threshold > student.points) || milestones[milestones.length - 1];
  let pointsNeeded = Math.max(0, nextMilestone.threshold - student.points);
  const studentNumberLineHtml = buildNumberLineHtml(milestones, student.points, student.avatar);

  resultBox.innerHTML = `
    <!-- Thẻ thông tin cá nhân Học sinh (Chế độ chỉ đọc + Nút đổi mật khẩu cá nhân) -->
    <div class="bg-amber-400 rounded-3xl p-6 sm:p-8 text-slate-900 border-2 border-slate-900 shadow-[0_8px_0_#1e293b] flex flex-col sm:flex-row items-center justify-between gap-6">
      <div class="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
        <div class="avatar-sticker w-24 h-24 rounded-3xl bg-white border-2 border-slate-900 flex items-center justify-center text-6xl shadow-[0_4px_0_#1e293b]">
          ${student.avatar}
        </div>
        <div>
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
            <span class="px-3 py-1 rounded-full bg-slate-900 text-white font-black text-xs">👤 TK: ${studentUsername}</span>
            <span class="px-3 py-1 rounded-full bg-white border-2 border-slate-900 text-slate-900 font-black text-xs shadow-[0_2px_0_#1e293b]">MÃ HS: ${student.code}</span>
            <span class="px-3 py-1 rounded-full bg-emerald-100 border-2 border-slate-900 text-emerald-950 font-black text-xs">${classObj.name} • ${student.group}</span>
          </div>
          <h3 class="text-2xl sm:text-3xl font-black">${student.name}</h3>
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1.5">
            <span class="text-xs font-bold text-slate-800">
              Tăng tuần này: <strong>+${growth.weekGain}đ</strong> • Tăng tháng này: <strong>+${growth.monthGain}đ</strong>
            </span>
            <button type="button" onclick="openStudentChangePasswordModal('${student.id}')"
              class="pop-btn pop-btn-white px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1">
              🔐 Đổi mật khẩu
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white text-slate-900 border-2 border-slate-900 rounded-3xl px-7 py-5 text-center shadow-[0_5px_0_#1e293b] min-w-[190px]">
        <div class="text-xs font-black uppercase tracking-wider text-slate-400">Điểm Thưởng Của Em</div>
        <div class="text-4xl font-black text-emerald-600 mt-1">+${student.points}</div>
        <div class="text-[11px] font-black text-indigo-700 mt-1">⚡ ${unusedPowerCards.length} thẻ Power • 🎯 ${unusedChallengeCards.length} Challenge</div>
      </div>
    </div>

    <!-- KHU VỰC TRỤC SỐ POINT LINE CÁ NHÂN: ĐÁNH DẤU VỊ TRÍ CỦA HỌC SINH TRÊN TRỤC SỐ -->
    <div class="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-900 shadow-[0_6px_0_#1e293b] space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span class="text-xs font-black uppercase tracking-wider bg-amber-300 text-slate-900 border border-slate-900 px-3 py-0.5 rounded-full shadow-[0_2px_0_#1e293b]">
            📏 TRỤC SỐ POINT LINE CỦA EM
          </span>
          <h4 class="text-xl font-black text-slate-900 mt-1.5">Vị Trí Của Em Trên Trục Điểm Thưởng</h4>
        </div>
        <div class="text-right">
          <span class="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl inline-block">
            ${
              pointsNeeded === 0
                ? "👑 Em đã vượt qua tất cả các mốc trên trục số!"
                : `🎯 Còn thiếu <strong>${pointsNeeded} điểm</strong> nữa để chạm mốc <strong>${nextMilestone.threshold}đ</strong> (${nextMilestone.rewardTitle})`
            }
          </span>
        </div>
      </div>

      <div class="number-line-wrapper pt-2">
        ${studentNumberLineHtml}
      </div>
    </div>

    <!-- KHU VỰC 1: CÁC THẺ ĐANG SỞ HỮU - CHƯA DÙNG (THIẾT KẾ ĐỒ HỌA CARD/ TỰ ĐỘNG LỒNG CHỮ) -->
    <div class="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-900 shadow-[0_6px_0_#1e293b]">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <span class="text-xs font-black uppercase tracking-wider bg-emerald-300 text-slate-900 border border-slate-900 px-3.5 py-1 rounded-full shadow-[0_2px_0_#1e293b]">
            ✅ THẺ ĐANG CÓ HIỆU LỰC (${unusedPowerCards.length + unusedChallengeCards.length})
          </span>
          <h4 class="text-xl font-black text-slate-900 mt-2">Power Cards & Challenge Cards Của Em</h4>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${
          (unusedPowerCards.length === 0 && unusedChallengeCards.length === 0)
            ? `<div class="col-span-full p-8 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center text-sm font-bold text-slate-400">
                Hiện tại em chưa có thẻ nào ở trạng thái chờ sử dụng. Hãy tích cực phát biểu để chạm các mốc Point Line và nhận Power Card nhé!
              </div>`
            : [...unusedPowerCards, ...unusedChallengeCards]
                .map((inst) => {
                  const tpl = findCardTemplate(inst.cardId, inst.type);
                  if (!tpl) return "";
                  const isPower = inst.type === "power";
                  return `
                    <div class="bg-slate-50 rounded-3xl p-5 border-2 border-slate-900 shadow-[0_4px_0_#1e293b] flex flex-col items-center justify-between gap-3">
                      <div class="w-full flex justify-center py-1">
                        ${renderVisualArtCard(tpl, "unused", { maxWidth: "215px", type: inst.type })}
                      </div>
                      <div class="w-full pt-3 border-t-2 border-slate-200 text-center space-y-1">
                        <div class="text-[11px] font-bold text-slate-500">Nhận lúc: <strong>${inst.acquiredAt}</strong></div>
                        <div class="text-xs font-black ${isPower ? "text-amber-800" : "text-violet-800"}">
                          ${isPower ? "👉 Báo cô giáo khi muốn dùng đặc quyền" : "👉 Báo cô giáo khi hoàn thành thử thách"}
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    </div>

    <!-- KHU VỰC 2: THẺ ĐÃ DÙNG / ĐÃ HOÀN THÀNH -->
    <div class="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-900 shadow-[0_6px_0_#1e293b]">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <span class="text-xs font-black uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-900 px-3.5 py-1 rounded-full shadow-[0_2px_0_#1e293b]">
            🔒 THẺ ĐÃ SỬ DỤNG / HOÀN THÀNH (${usedCards.length})
          </span>
          <h4 class="text-xl font-black text-slate-900 mt-2">Lịch Sử Thẻ Đã Dùng (Không Thể Dùng Lại)</h4>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${
          usedCards.length === 0
            ? `<div class="col-span-full p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                Chưa có thẻ nào đã qua sử dụng hoặc hoàn thành.
              </div>`
            : usedCards
                .map((inst) => {
                  const tpl = findCardTemplate(inst.cardId, inst.type);
                  if (!tpl) return "";
                  return `
                    <div class="bg-slate-100 rounded-3xl p-5 border-2 border-slate-300 shadow-sm flex flex-col items-center justify-between gap-3 opacity-80">
                      <div class="w-full flex justify-center py-1">
                        ${renderVisualArtCard(tpl, "used", { maxWidth: "205px", type: inst.type })}
                      </div>
                      <div class="w-full pt-3 border-t-2 border-slate-200 text-center space-y-1">
                        <div class="text-[11px] font-bold text-slate-500">Nhận: ${inst.acquiredAt}</div>
                        <div class="text-[11px] font-black text-slate-700">Đã khóa lúc: ${inst.usedAt || "Đã dùng"}</div>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${
          usedCards.length === 0
            ? `<div class="col-span-full p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                Chưa có thẻ nào đã qua sử dụng hoặc hoàn thành.
              </div>`
            : usedCards
                .map((inst) => {
                  const tpl = findCardTemplate(inst.cardId, inst.type);
                  if (!tpl) return "";
                  return `
                    <div class="relative rounded-3xl border-2 border-slate-300 bg-slate-100 p-5 card-used-state overflow-hidden">
                      <div class="used-stamp">ĐÃ DÙNG • HOÀN THÀNH</div>
                      <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-black uppercase bg-slate-300 text-slate-700">
                          🔒 ĐÃ SỬ DỤNG
                        </span>
                        <span class="text-xs font-black text-slate-400">${tpl.code}</span>
                      </div>
                      <div class="flex items-center gap-3 mb-2">
                        <div class="w-12 h-12 rounded-2xl bg-slate-200 border border-slate-300 flex items-center justify-center text-2xl shrink-0">
                          ${tpl.icon}
                        </div>
                        <div>
                          <h5 class="text-base font-black text-slate-700 line-through">${tpl.title}</h5>
                          <p class="text-xs font-bold text-slate-500">${tpl.description}</p>
                        </div>
                      </div>
                      <div class="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs font-black">
                        <span class="text-slate-500">Nhận: ${inst.acquiredAt}</span>
                        <span class="text-slate-700">Xong lúc: ${inst.usedAt}</span>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// 15. THÊM HỌC SINH MỚI & THÊM LỚP HỌC MỚI
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// 14B. QUẢN LÝ MẬT KHẨU HỌC SINH (HỌC SINH TỰ ĐỔI & GIÁO VIÊN ĐỔI / RESET)
// ----------------------------------------------------------------------------
function syncSingleClassToCloud(classObj) {
  if (firestoreDb && classObj) {
    firestoreDb.collection("shared_classes").doc(classObj.id).set({
      classId: classObj.id,
      className: classObj.name,
      students: classObj.students || [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch((e) => console.warn("Lỗi đồng bộ mật khẩu lên shared_classes:", e));
  }
}

function openStudentChangePasswordModal(studentId) {
  const found = findStudentById(studentId);
  if (!found) return;
  document.getElementById("change-pw-student-id").value = studentId;
  document.getElementById("student-old-password").value = "";
  document.getElementById("student-new-password").value = "";
  document.getElementById("student-confirm-password").value = "";
  const errEl = document.getElementById("change-pw-error");
  if (errEl) errEl.classList.add("hidden");
  document.getElementById("student-change-password-modal").classList.remove("hidden");
}

function handleStudentChangePassword(e) {
  e.preventDefault();
  const studentId = document.getElementById("change-pw-student-id").value;
  const oldPw = document.getElementById("student-old-password").value.trim();
  const newPw = document.getElementById("student-new-password").value.trim();
  const confirmPw = document.getElementById("student-confirm-password").value.trim();
  const errEl = document.getElementById("change-pw-error");
  if (errEl) errEl.classList.add("hidden");

  applySavedStudentPasswords(appState);
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;
  const currentPw = String(student.password || "123456");

  if (oldPw !== currentPw) {
    if (errEl) {
      errEl.textContent = "❌ Mật khẩu hiện tại không đúng!";
      errEl.classList.remove("hidden");
    }
    return;
  }
  if (newPw.length < 4) {
    if (errEl) {
      errEl.textContent = "⚠️ Mật khẩu mới phải có ít nhất 4 ký tự!";
      errEl.classList.remove("hidden");
    }
    return;
  }
  if (newPw !== confirmPw) {
    if (errEl) {
      errEl.textContent = "⚠️ Mật khẩu xác nhận không khớp!";
      errEl.classList.remove("hidden");
    }
    return;
  }

  student.password = newPw;
  saveStudentPasswordToStore(student, newPw);
  saveState();
  syncSingleClassToCloud(classObj);

  const pwInput = document.getElementById("portal-password-input");
  if (pwInput) pwInput.value = newPw;
  const landingPwInput = document.getElementById("landing-student-password");
  if (landingPwInput) landingPwInput.value = newPw;

  closeModal("student-change-password-modal");
  renderStudentPortalProfileHtml(student, classObj);
  showToast("🔐 Đã đổi mật khẩu thành công! Mật khẩu cũ đã vô hiệu hóa.", "emerald");
}

function teacherChangeStudentPassword(studentId) {
  applySavedStudentPasswords(appState);
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;
  const newPw = prompt(
    `Nhập mật khẩu mới cho học sinh ${student.name} (TK: ${(student.username || student.code).toLowerCase()}):`,
    ""
  );
  if (newPw === null) return;
  const cleanPw = newPw.trim();
  if (!cleanPw) {
    showToast("⚠️ Mật khẩu không được để trống!", "rose");
    return;
  }
  student.password = cleanPw;
  saveStudentPasswordToStore(student, cleanPw);
  saveState();
  syncSingleClassToCloud(classObj);
  if (activeStudentModalId === studentId) {
    renderStudentDetailModalContent(studentId);
  }
  showToast(`🔑 Đã cập nhật mật khẩu mới cho ${student.name}!`, "emerald");
}

function teacherResetStudentPassword(studentId) {
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;
  student.password = "123456";
  saveStudentPasswordToStore(student, "123456");
  saveState();
  syncSingleClassToCloud(classObj);
  if (activeStudentModalId === studentId) {
    renderStudentDetailModalContent(studentId);
  }
  showToast(`🔄 Đã đặt lại mật khẩu của ${student.name} về mặc định: 123456`, "indigo");
}

// ----------------------------------------------------------------------------
// 15. THÊM HỌC SINH MỚI & THÊM LỚP HỌC MỚI
// ----------------------------------------------------------------------------
function getStudentAvatarList() {
  if (typeof STUDENT_AVATAR_POOL !== "undefined" && STUDENT_AVATAR_POOL.length > 0) {
    return STUDENT_AVATAR_POOL;
  }
  return [
    "🦖", "🦄", "🦊", "🐼", "🦁", "🐰", "🦉", "🐯", "🐲", "🦋",
    "🦅", "🐱", "🐬", "🐨", "🐶", "🐧", "🦒", "🦔", "🐝", "🐙",
    "🐢", "🦩", "🦚", "🦭", "🦘", "🐹", "🦦", "🐿️", "🐳", "🦌",
    "🚀", "🌟", "🎨", "⚽", "🎸", "👑", "🧙‍♂️", "🦸‍♀️", "🤖", "🌈"
  ];
}

function renderAvatarPickerGrid(gridId, inputId, previewId, selectedAvatar) {
  const grid = document.getElementById(gridId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const avatars = getStudentAvatarList();
  const current = selectedAvatar || avatars[0];
  if (input) input.value = current;
  if (preview) preview.textContent = current;
  if (!grid) return;

  grid.innerHTML = avatars
    .map((av) => {
      const isSelected = av === current;
      return `
        <button type="button" onclick="renderAvatarPickerGrid('${gridId}', '${inputId}', '${previewId}', '${av}')"
          class="w-9 h-9 rounded-xl border ${isSelected ? 'bg-amber-300 border-slate-900 scale-105 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-500 hover:bg-amber-50'} flex items-center justify-center text-xl transition cursor-pointer"
          title="Chọn Avatar ${av}">
          ${av}
        </button>
      `;
    })
    .join("");
}

function updateNewStudentAccountPreview() {
  const codeVal = (document.getElementById("new-student-code")?.value || "").trim();
  const previewEl = document.getElementById("new-student-username-preview");
  if (previewEl) {
    previewEl.textContent = (codeVal || "10a1-01").toLowerCase();
  }
}

function openAddStudentModal() {
  document.getElementById("new-student-name").value = "";
  const cls = getCurrentClass();
  const autoCode = generateNextStudentCode(cls, 0);
  document.getElementById("new-student-code").value = autoCode;
  const pwInput = document.getElementById("new-student-password");
  if (pwInput) pwInput.value = "123456";
  updateNewStudentAccountPreview();

  const groupSelect = document.getElementById("new-student-group");
  if (groupSelect && cls) {
    const allGroups = cls.groupsList || ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];
    groupSelect.innerHTML = allGroups
      .map((g) => `<option value="${g}">${g}</option>`)
      .join("");
  }

  const avatars = getStudentAvatarList();
  const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
  renderAvatarPickerGrid("new-student-avatar-grid", "new-student-avatar", "new-student-selected-avatar-preview", randomAvatar);

  document.getElementById("add-student-modal").classList.remove("hidden");
}

function handleCreateStudent(e) {
  e.preventDefault();
  const cls = getCurrentClass();
  if (!cls) return;

  const name = document.getElementById("new-student-name").value.trim();
  const code = document.getElementById("new-student-code").value.trim().toUpperCase();
  const password = (document.getElementById("new-student-password")?.value || "123456").trim() || "123456";
  const username = code.toLowerCase();
  const group = document.getElementById("new-student-group").value;
  const avatar = document.getElementById("new-student-avatar").value || "🦖";
  const bgPool = ["bg-amber-100", "bg-emerald-100", "bg-sky-100", "bg-rose-100", "bg-violet-100", "bg-fuchsia-100", "bg-orange-100", "bg-teal-100"];
  const avatarBg = bgPool[cls.students.length % bgPool.length];

  const newSt = {
    id: "st-" + Date.now(),
    code,
    username,
    password,
    name,
    group,
    avatar,
    avatarBg,
    points: 10,
    speechCount: 0,
    ownedCards: [],
    history: [{ time: nowTimeString(), daysAgo: 0, text: "Khởi tạo học sinh mới (+10đ)", delta: 10 }]
  };
  cls.students.push(newSt);
  saveStudentPasswordToStore(newSt, password);

  saveState();
  renderAll();
  closeModal("add-student-modal");
  showToast(`🎉 Đã thêm ${name} (TK: ${username})!`, "emerald");
}

function openEditStudentModal(studentId) {
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;

  document.getElementById("edit-student-id").value = student.id;
  document.getElementById("edit-student-name").value = student.name || "";
  document.getElementById("edit-student-code").value = student.code || "";
  document.getElementById("edit-student-points").value = Number(student.points || 0);

  const groupSelect = document.getElementById("edit-student-group");
  if (groupSelect) {
    const allGroups = [...new Set([...(classObj.groupsList || ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"]), student.group].filter(Boolean))];
    groupSelect.innerHTML = allGroups
      .map((g) => `<option value="${g}" ${g === student.group ? "selected" : ""}>${g}</option>`)
      .join("");
  }

  renderAvatarPickerGrid("edit-student-avatar-grid", "edit-student-avatar", "edit-student-selected-avatar-preview", student.avatar || "🦖");
  document.getElementById("edit-student-modal")?.classList.remove("hidden");
}

function handleSaveEditedStudent(e) {
  e.preventDefault();
  const studentId = document.getElementById("edit-student-id")?.value;
  const found = findStudentById(studentId);
  if (!found) return;
  const { student, classObj } = found;

  const newName = document.getElementById("edit-student-name")?.value.trim();
  const newCode = document.getElementById("edit-student-code")?.value.trim().toUpperCase();
  const newGroup = document.getElementById("edit-student-group")?.value;
  const newPoints = parseInt(document.getElementById("edit-student-points")?.value, 10);
  const newAvatar = document.getElementById("edit-student-avatar")?.value || student.avatar;

  if (newName) student.name = newName;
  if (newCode) {
    student.code = newCode;
    student.username = newCode.toLowerCase();
  }
  if (newGroup) student.group = newGroup;
  if (!isNaN(newPoints) && newPoints !== student.points) {
    const diff = newPoints - student.points;
    student.points = Math.max(0, newPoints);
    student.history.unshift({
      time: nowTimeString(),
      daysAgo: 0,
      text: `${diff >= 0 ? `+${diff}đ` : `${diff}đ`}: Giáo viên cập nhật điểm trực tiếp`,
      delta: diff
    });
  }
  student.avatar = newAvatar;

  // Đồng bộ tên trong speechQueue nếu có
  if (Array.isArray(appState.speechQueue)) {
    appState.speechQueue.forEach((q) => {
      if (q.studentId === student.id) {
        q.studentName = student.name;
        q.studentAvatar = student.avatar;
      }
    });
  }

  saveStudentPasswordToStore(student, student.password || "123456");
  saveState();
  syncSingleClassToCloud(classObj);
  renderAll();
  if (activeStudentModalId === student.id) {
    renderStudentDetailModalContent(student.id);
  }
  closeModal("edit-student-modal");
  showToast(`✅ Đã lưu thông tin mới của ${student.name}!`, "emerald");
}

function openAddClassModal() {
  document.getElementById("new-class-name").value = "";
  document.getElementById("new-class-room").value = "";
  document.getElementById("add-class-modal").classList.remove("hidden");
}

function handleCreateClass(e) {
  e.preventDefault();
  const name = document.getElementById("new-class-name").value.trim();
  const room = document.getElementById("new-class-room").value.trim() || "Phòng học chính";
  const userPrefix = currentFirebaseUser ? `cls_${currentFirebaseUser.uid.slice(0, 6)}_` : "cls_demo_";

  const newCls = {
    id: `${userPrefix}${Date.now()}`,
    name,
    grade: "Khối Mới",
    room,
    groupsList: ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"],
    students: []
  };

  appState.classes.push(newCls);
  currentClassId = newCls.id;
  saveState();
  renderAll();
  closeModal("add-class-modal");
  showToast(`🏫 Đã tạo lớp "${name}" thành công!`, "indigo");
}

// ----------------------------------------------------------------------------
// 15B. NHẬP DANH SÁCH HỌC SINH HÀNG LOẠT (HỖ TRỢ FILE EXCEL .XLSX, .XLS, .CSV)
// ----------------------------------------------------------------------------
function openBulkImportStudentsModal() {
  const input = document.getElementById("bulk-students-input");
  if (input) input.value = "";
  previewBulkStudents();
  document.getElementById("bulk-import-students-modal").classList.remove("hidden");
}

function clearBulkStudentInput() {
  const input = document.getElementById("bulk-students-input");
  if (input) input.value = "";
  previewBulkStudents();
}

function fillSampleStudentsImport() {
  const cls = getCurrentClass();
  const c1 = generateNextStudentCode(cls, 0);
  const c2 = generateNextStudentCode(cls, 1);
  const c3 = generateNextStudentCode(cls, 2);
  const c4 = generateNextStudentCode(cls, 3);
  const sample = [
    `Nguyễn Hoàng Nam | ${c1} | Nhóm 1 | 10 | 123456`,
    `Trần Bảo An | ${c2} | Nhóm 2 | 10 | 123456`,
    `Lê Thu Thảo | ${c3} | Nhóm 3 | 10 | 123456`,
    `Phạm Minh Đức | ${c4} | Nhóm 4 | 10 | 123456`,
    "Vũ Quỳnh Chi",
    "Hoàng Gia Huy"
  ].join("\n");

  const input = document.getElementById("bulk-students-input");
  if (input) {
    input.value = sample;
    previewBulkStudents();
  }
}

function downloadStudentExcelTemplate() {
  const cls = getCurrentClass();
  const prefix = extractClassShortCode(cls?.name || "10A1");
  const rows = [
    ["Họ và tên", "Mã học sinh (Để trống tự sinh)", "Nhóm / Tổ", "Điểm ban đầu", "Mật khẩu (Mặc định 123456)"],
    ["Nguyễn Hoàng Nam", `${prefix}-01`, "Nhóm 1", 10, "123456"],
    ["Trần Bảo An", `${prefix}-02`, "Nhóm 2", 10, "123456"],
    ["Lê Thu Thảo", "", "Nhóm 3", 10, "123456"],
    ["Phạm Minh Đức", "", "Nhóm 4", 10, "123456"]
  ];
  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 26 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocSinh");
    XLSX.writeFile(wb, `Mau_Danh_Sach_Hoc_Sinh_${prefix}.xlsx`);
    showToast("📥 Đã tải xuống file Excel mẫu danh sách học sinh!", "emerald");
  } else {
    showToast("⚠️ Thư viện Excel đang tải, vui lòng thử lại sau giây lát!", "amber");
  }
}

function isGroupValue(val, existingGroups = []) {
  if (!val) return false;
  const clean = String(val).trim();
  if (!clean) return false;
  // Khớp "Nhóm 1", "nhóm 2", "Nhom 1", "Tổ 1", "To 2", "Group 1", "Đội 1", "Team 1", "Tổ A", "Nhóm B"...
  if (/^(nhóm|nhom|tổ|to|group|team|đội|doi)\b/i.test(clean)) return true;
  if (Array.isArray(existingGroups) && existingGroups.some((g) => g && g.trim().toLowerCase() === clean.toLowerCase())) {
    return true;
  }
  return false;
}

function handleStudentFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if ((ext === "xlsx" || ext === "xls" || ext === "csv") && typeof XLSX !== "undefined") {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

        if (!rows || rows.length === 0) {
          showToast("⚠️ File Excel không có dữ liệu!", "rose");
          return;
        }

        // 1. Phân tích dòng tiêu đề (nếu có) để nhận diện chính xác các cột
        let headerRowIdx = -1;
        let colName = -1;
        let colCode = -1;
        let colGroup = -1;
        let colPoints = -1;
        let colPass = -1;

        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const val = String(row[c] ?? "").trim().toLowerCase();
            if (!val) continue;
            if (colName === -1 && /^(họ\s*và\s*tên|họ\s*tên|tên\s*học\s*sinh|tên|name|full\s*name)$/i.test(val)) {
              colName = c;
              headerRowIdx = r;
            } else if (colCode === -1 && /^(mã\s*học\s*sinh|mã\s*hs|mã|code|tài\s*khoản|username)/i.test(val)) {
              colCode = c;
              headerRowIdx = r;
            } else if (colGroup === -1 && /^(nhóm|nhóm\s*\/\s*tổ|tổ|group|team|đội)/i.test(val)) {
              colGroup = c;
              headerRowIdx = r;
            } else if (colPoints === -1 && /^(điểm|điểm\s*ban\s*đầu|điểm\s*thưởng|points|score)/i.test(val)) {
              colPoints = c;
              headerRowIdx = r;
            } else if (colPass === -1 && /^(mật\s*khẩu|mk|password|pass)/i.test(val)) {
              colPass = c;
              headerRowIdx = r;
            }
          }
          if (colName !== -1) break;
        }

        const lines = [];
        const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          let name = "";
          let code = "";
          let group = "";
          let pts = "";
          let pw = "";

          if (colName !== -1) {
            // Nhận diện theo cột header đã tìm thấy
            name = String(row[colName] ?? "").trim();
            code = colCode !== -1 ? String(row[colCode] ?? "").trim() : "";
            group = colGroup !== -1 ? String(row[colGroup] ?? "").trim() : "";
            pts = colPoints !== -1 ? String(row[colPoints] ?? "").trim() : "";
            pw = colPass !== -1 ? String(row[colPass] ?? "").trim() : "";
          } else {
            // Không có header rõ ràng: tự động nhận diện theo vị trí cột
            const col0 = String(row[0] ?? "").trim();
            const col1 = String(row[1] ?? "").trim();
            const col2 = String(row[2] ?? "").trim();
            const col3 = String(row[3] ?? "").trim();
            const col4 = String(row[4] ?? "").trim();
            const col5 = String(row[5] ?? "").trim();

            if (!col0 && !col1) continue;

            // Nếu cột 0 là STT (1, 2, 3...) và cột 1 là Họ tên
            if (/^\d+$/.test(col0) && col1 && !/^\d+$/.test(col1)) {
              name = col1;
              code = col2;
              group = col3;
              pts = col4;
              pw = col5;
            } else {
              name = col0;
              code = col1;
              group = col2;
              pts = col3;
              pw = col4;
            }

            // Kiểm tra thông minh: nếu ô code thực chất là tên Nhóm (ví dụ "Nhóm 1", "Nhóm 2", "Tổ 1"...)
            if (isGroupValue(code)) {
              if (!group) group = code;
              code = "";
            }
          }

          if (!name) continue;
          // Bỏ qua nếu là dòng tiêu đề lặp lại
          if (/^(họ\s*và\s*tên|họ\s*tên|tên\s*học\s*sinh|name|stt)$/i.test(name)) continue;

          // Nếu code là placeholder text như "Để trống", "(để trống tự sinh)", "Tự sinh" -> coi như rỗng
          if (/^(để\s*trống|tự\s*sinh|auto|none|trống|-|_)$/i.test(code)) {
            code = "";
          }

          // Giữ nguyên đúng vị trí 5 cột, nếu mã để trống thì để trống giữa 2 dấu gạch đứng để không bị đẩy sang nhóm!
          lines.push(`${name} | ${code} | ${group} | ${pts || 10} | ${pw || "123456"}`);
        }

        const input = document.getElementById("bulk-students-input");
        if (input) {
          input.value = lines.join("\n");
          previewBulkStudents();
        }
        showToast(`📊 Đã đọc ${lines.length} học sinh từ file Excel "${file.name}"!`, "emerald");
      } catch (err) {
        console.error("Excel read error:", err);
        showToast("❌ Không thể đọc file Excel này. Vui lòng kiểm tra định dạng!", "rose");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result || "";
    const input = document.getElementById("bulk-students-input");
    if (input) {
      input.value = text;
      previewBulkStudents();
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
}

function parseStudentImportText(text) {
  const cls = getCurrentClass();
  if (!cls) return [];

  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const existingGroups = (cls.groupsList && cls.groupsList.length > 0)
    ? cls.groupsList
    : ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"];

  const classPrefix = extractClassShortCode(cls?.name || "10A1");

  // Thu thập các mã code đã tồn tại để tránh trùng lặp
  const usedCodes = new Set();
  if (Array.isArray(cls.students)) {
    cls.students.forEach((s) => {
      if (s.code) usedCodes.add(s.code.toUpperCase());
    });
  }

  // Thu thập các mã code được người dùng chỉ định rõ ràng trong danh sách import
  lines.forEach((line) => {
    let parts = [];
    if (line.includes("|")) parts = line.split("|").map((p) => p.trim());
    else if (line.includes("\t")) parts = line.split("\t").map((p) => p.trim());
    else if (line.includes(",")) parts = line.split(",").map((p) => p.trim());
    else parts = [line];

    const rawCode = (parts[1] || "").trim();
    if (rawCode && !isGroupValue(rawCode, existingGroups) && !/^(để\s*trống|tự\s*sinh|auto|none|trống|-|_)$/i.test(rawCode)) {
      usedCodes.add(rawCode.toUpperCase());
    }
  });

  function getNextAvailableCode() {
    let num = 1;
    while (true) {
      const candidate = `${classPrefix}-${String(num).padStart(2, "0")}`;
      if (!usedCodes.has(candidate.toUpperCase())) {
        usedCodes.add(candidate.toUpperCase());
        return candidate;
      }
      num++;
    }
  }

  const avatarPool = getStudentAvatarList();
  const bgPool = [
    "bg-amber-100", "bg-emerald-100", "bg-sky-100", "bg-rose-100",
    "bg-violet-100", "bg-fuchsia-100", "bg-orange-100", "bg-teal-100"
  ];

  const parsed = [];

  lines.forEach((line, idx) => {
    let parts = [];
    if (line.includes("|")) {
      parts = line.split("|").map((p) => p.trim());
    } else if (line.includes("\t")) {
      parts = line.split("\t").map((p) => p.trim());
    } else if (line.includes(",")) {
      parts = line.split(",").map((p) => p.trim());
    } else {
      parts = [line];
    }

    const name = parts[0] || "";
    if (!name || /^(họ\s*và\s*tên|họ\s*tên|tên\s*học\s*sinh|name|stt)$/i.test(name)) return;

    let code = (parts[1] || "").trim();
    let group = (parts[2] || "").trim();
    let ptsRaw = parts[3];
    let pwRaw = parts[4];

    // Phát hiện nếu cột 1 thực chất là Tên Nhóm (do để trống mã học sinh hoặc file thiếu cột mã)
    if (isGroupValue(code, existingGroups)) {
      if (!group) group = code;
      // Dịch các cột sau lại đúng vị trí
      if (typeof ptsRaw === "undefined" && parts[2]) ptsRaw = parts[2];
      if (typeof pwRaw === "undefined" && parts[3]) pwRaw = parts[3];
      code = "";
    } else if (/^(để\s*trống|tự\s*sinh|auto|none|trống|-|_)$/i.test(code)) {
      code = "";
    }

    // Nếu mã học sinh để trống -> tự động sinh mã theo quy luật [MãLớp]-[STT] (VD: 10A1-01, 10A1-02...)
    if (!code) {
      code = getNextAvailableCode();
    } else {
      code = code.toUpperCase();
      usedCodes.add(code);
    }
    const username = code.toLowerCase();

    // Nếu không có nhóm, tự động phân bổ vòng tròn vào các nhóm của lớp
    if (!group) {
      group = existingGroups[idx % existingGroups.length];
    }

    let points = parseInt(ptsRaw, 10);
    if (isNaN(points)) points = 10;

    const password = (pwRaw || "123456").trim() || "123456";
    const avatar = avatarPool[idx % avatarPool.length];
    const avatarBg = bgPool[idx % bgPool.length];

    parsed.push({
      name,
      code,
      username,
      password,
      group,
      points,
      avatar,
      avatarBg
    });
  });

  return parsed;
}

function previewBulkStudents() {
  const text = document.getElementById("bulk-students-input")?.value || "";
  const parsed = parseStudentImportText(text);

  const badge = document.getElementById("bulk-students-count-badge");
  const list = document.getElementById("bulk-students-preview-list");

  if (badge) {
    badge.textContent = `${parsed.length} học sinh hợp lệ`;
    badge.className = parsed.length > 0
      ? "px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs"
      : "px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-bold text-xs";
  }

  if (list) {
    if (parsed.length === 0) {
      list.innerHTML = `<div class="text-slate-400 text-center py-4 font-bold italic">Chưa có học sinh nào. Hãy tải file Excel (.xlsx) lên hoặc bấm "📋 Dán mẫu thử".</div>`;
      return;
    }

    list.innerHTML = parsed
      .map(
        (st, idx) => `
        <div class="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0">
              ${idx + 1}
            </span>
            <span class="w-8 h-8 rounded-lg ${st.avatarBg} border border-slate-900 flex items-center justify-center text-lg shrink-0">
              ${st.avatar}
            </span>
            <div class="min-w-0">
              <div class="font-black text-xs text-slate-900 truncate">${st.name}</div>
              <div class="text-[11px] font-bold text-slate-500">
                👤 TK: <strong class="text-indigo-700">${st.username}</strong> • ${st.group}
              </div>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 font-black text-xs shrink-0">
            +${st.points}đ
          </span>
        </div>
      `
      )
      .join("");
  }
}

function confirmBulkImportStudents() {
  const text = document.getElementById("bulk-students-input")?.value || "";
  const parsed = parseStudentImportText(text);

  if (parsed.length === 0) {
    showToast("⚠️ Danh sách rỗng hoặc không có học sinh hợp lệ!", "rose");
    return;
  }

  const cls = getCurrentClass();
  if (!cls) return;

  parsed.forEach((st) => {
    if (st.group && !cls.groupsList.includes(st.group)) {
      cls.groupsList.push(st.group);
    }

    cls.students.push({
      id: "st-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      code: st.code,
      username: st.username,
      password: st.password || "123456",
      name: st.name,
      group: st.group,
      avatar: st.avatar,
      avatarBg: st.avatarBg,
      points: st.points,
      speechCount: 0,
      ownedCards: [],
      history: [
        { time: nowTimeString(), daysAgo: 0, text: `Tạo tài khoản & nhập danh sách (+${st.points}đ)`, delta: st.points }
      ]
    });
  });

  saveState();
  renderAll();
  closeModal("bulk-import-students-modal");
  playFanfareSound();
  showToast(`🎉 Đã thêm ${parsed.length} học sinh & tạo tài khoản (MK mặc định: 123456) vào ${cls.name}!`, "emerald");
}

// ----------------------------------------------------------------------------
// 15C. NHẬP THẺ BÀI HÀNG LOẠT (HỖ TRỢ FILE EXCEL .XLSX, .XLS, .CSV)
// ----------------------------------------------------------------------------
let currentBulkCardType = "power";

function openBulkImportCardsModal(type = "power") {
  setBulkCardImportType(type);
  const input = document.getElementById("bulk-cards-input");
  if (input) input.value = "";
  previewBulkCards();
  document.getElementById("bulk-import-cards-modal").classList.remove("hidden");
}

function setBulkCardImportType(type) {
  currentBulkCardType = type;

  const btnPower = document.getElementById("bulk-card-type-power");
  const btnPenalty = document.getElementById("bulk-card-type-penalty");
  const badge = document.getElementById("bulk-cards-modal-badge");
  const title = document.getElementById("bulk-cards-modal-title");
  const submitBtn = document.getElementById("btn-confirm-bulk-cards");
  const hintEl = document.getElementById("bulk-cards-category-hint");

  if (type === "power") {
    if (btnPower) {
      btnPower.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition bg-amber-400 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]";
    }
    if (btnPenalty) {
      btnPenalty.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition text-slate-600";
    }
    if (badge) badge.textContent = "⚡ Nhập Thẻ Power Card Hàng Loạt";
    if (title) title.textContent = "Nhập thẻ Power Card hàng loạt";
    if (submitBtn) {
      submitBtn.className = "pop-btn pop-btn-yellow px-6 py-2.5 rounded-xl text-xs font-black";
      submitBtn.textContent = "⚡ Sinh & Lưu Vào Kho Power Card";
    }
    if (hintEl) {
      hintEl.innerHTML = `• <strong>3 nhóm Power Card</strong>: <code class="bg-white px-1.5 py-0.5 rounded border border-indigo-200">Nhóm Trợ giúp học tập</code>, <code class="bg-white px-1.5 py-0.5 rounded border border-indigo-200">Nhóm Chiến lược</code>, <code class="bg-white px-1.5 py-0.5 rounded border border-indigo-200">Nhóm Tương tác</code>`;
    }
  } else {
    if (btnPenalty) {
      btnPenalty.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition bg-violet-400 text-slate-900 border-2 border-slate-900 shadow-[0_2px_0_#1e293b]";
    }
    if (btnPower) {
      btnPower.className =
        "flex-1 py-2 rounded-xl text-xs font-black transition text-slate-600";
    }
    if (badge) badge.textContent = "🎯 Nhập Thẻ Challenge Card Hàng Loạt";
    if (title) title.textContent = "Nhập thẻ Challenge Card hàng loạt";
    if (submitBtn) {
      submitBtn.className = "pop-btn pop-btn-violet px-6 py-2.5 rounded-xl text-xs font-black";
      submitBtn.textContent = "🎯 Sinh & Lưu Vào Kho Challenge Card";
    }
    if (hintEl) {
      hintEl.innerHTML = `• <strong>3 nhóm Challenge Card</strong>: <code class="bg-white px-1.5 py-0.5 rounded border border-indigo-200">Nhóm Hỗ trợ giáo viên</code>, <code class="bg-white px-1.5 py-0.5 rounded border border-indigo-200">Nhóm Phát triển Bản thân</code>, <code class="bg-white px-1.5 py-0.5 rounded border border-indigo-200">Nhóm Kỹ năng</code>`;
    }
  }

  previewBulkCards();
}

function clearBulkCardInput() {
  const input = document.getElementById("bulk-cards-input");
  if (input) input.value = "";
  previewBulkCards();
}

function fillSampleCardsImport() {
  let sample = "";
  if (currentBulkCardType === "power") {
    sample = [
      "Đổi câu hỏi miệng | Được quyền yêu cầu đổi câu hỏi kiểm tra miệng khác 1 lần duy nhất | Nhóm Trợ giúp học tập",
      "Chọn chỗ ngồi 1 tuần | Được tự chọn chỗ ngồi yêu thích trong lớp suốt cả tuần học | Nhóm Chiến lược",
      "Trợ giúp đồng đội | Được gọi 1 bạn trong bàn trợ giúp câu trả lời khi đang đứng phát biểu | Nhóm Tương tác",
      "Tia chớp cứu nguy | Được miễn 1 lần trừ điểm bài tập về nhà khi có lý do chính đáng | Nhóm Trợ giúp học tập",
      "Ngôi sao may mắn | Tự động nhân đôi điểm cộng phát biểu trong tiết học này | Nhóm Chiến lược"
    ].join("\n");
  } else {
    sample = [
      "Vệ sinh bảng phấn | Cùng tổ trưởng lau sạch bảng và xếp lại phấn ngay ngắn cuối giờ | Nhóm Hỗ trợ giáo viên",
      "Khởi động thể lực | Thực hiện 10 lần vươn vai nhảy tại chỗ để tái tạo năng lượng | Nhóm Phát triển Bản thân",
      "Thuyết trình 1 phút | Kể lại 1 kiến thức thú vị em vừa học được cho cả lớp nghe | Nhóm Kỹ năng",
      "Thử thách Toán vui | Giải nhanh 1 câu đố logic toán học trong 1 phút tại bục giảng | Nhóm Kỹ năng",
      "Hát hoặc Đọc thơ | Hát 1 bài hát hoặc đọc 4 câu thơ tặng cả lớp vào 3 phút cuối giờ | Nhóm Phát triển Bản thân"
    ].join("\n");
  }

  const input = document.getElementById("bulk-cards-input");
  if (input) {
    input.value = sample;
    previewBulkCards();
  }
}

function downloadCardExcelTemplate() {
  const isPower = currentBulkCardType === "power";
  const rows = isPower
    ? [
        ["Tên thẻ", "Nội dung quyền năng / Đặc quyền", "Phân loại nhóm thẻ (Nhóm Trợ giúp học tập / Nhóm Chiến lược / Nhóm Tương tác)", "Mã thẻ (Trống = Tự sinh)", "Phôi ảnh (1-24, Trống = Ngẫu nhiên)"],
        ["Đổi câu hỏi miệng", "Được yêu cầu đổi câu hỏi kiểm tra miệng khác 1 lần duy nhất", "Nhóm Trợ giúp học tập", "PWR-04", "5"],
        ["Chọn chỗ ngồi 1 tuần", "Được tự chọn chỗ ngồi yêu thích trong lớp suốt cả tuần học", "Nhóm Chiến lược", "PWR-05", "12"],
        ["Trợ giúp đồng đội", "Được gọi 1 bạn trong bàn trợ giúp câu trả lời khi đang đứng phát biểu", "Nhóm Tương tác", "", ""]
      ]
    : [
        ["Tên thẻ", "Nội dung thử thách / Câu hỏi", "Phân loại nhóm thẻ (Nhóm Hỗ trợ giáo viên / Nhóm Phát triển Bản thân / Nhóm Kỹ năng)", "Mã thẻ (Trống = Tự sinh)", "Phôi ảnh (1-24, Trống = Ngẫu nhiên)"],
        ["Vệ sinh bảng phấn", "Cùng tổ trưởng lau sạch bảng và xếp lại phấn ngay ngắn cuối giờ", "Nhóm Hỗ trợ giáo viên", "CHL-04", "8"],
        ["Khởi động thể lực", "Thực hiện 10 lần vươn vai nhảy tại chỗ để tái tạo năng lượng", "Nhóm Phát triển Bản thân", "CHL-05", "15"],
        ["Thuyết trình 1 phút", "Kể lại 1 kiến thức thú vị em vừa học được cho cả lớp nghe", "Nhóm Kỹ năng", "", ""]
      ];

  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 52 }, { wch: 36 }, { wch: 22 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachThe");
    XLSX.writeFile(wb, isPower ? "Mau_The_PowerCard_ClassJoy.xlsx" : "Mau_The_ChallengeCard_ClassJoy.xlsx");
    showToast("📥 Đã tải xuống file Excel mẫu danh sách thẻ bài (kèm cột Phân loại)!", "emerald");
  } else {
    showToast("⚠️ Thư viện Excel đang tải, vui lòng thử lại sau giây lát!", "amber");
  }
}

function handleCardFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if ((ext === "xlsx" || ext === "xls" || ext === "csv") && typeof XLSX !== "undefined") {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

        if (!rows || rows.length === 0) {
          showToast("⚠️ File Excel không có dữ liệu!", "rose");
          return;
        }

        // Nhận diện dòng tiêu đề cột thông minh
        let headerRowIdx = -1;
        let colTitle = -1;
        let colDesc = -1;
        let colCat = -1;
        let colCode = -1;
        let colFrame = -1;

        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const val = String(row[c] ?? "").trim().toLowerCase();
            if (!val) continue;
            if (colTitle === -1 && /^(tên\s*thẻ|tiêu\s*đề|tên|title|card\s*name)$/i.test(val)) {
              colTitle = c;
              headerRowIdx = r;
            } else if (colDesc === -1 && /^(nội\s*dung|mô\s*tả|quyền\s*năng|thử\s*thách|description)/i.test(val)) {
              colDesc = c;
              headerRowIdx = r;
            } else if (colCat === -1 && /^(phân\s*loại|nhóm\s*thẻ|loại\s*thẻ|nhóm|category|type)/i.test(val)) {
              colCat = c;
              headerRowIdx = r;
            } else if (colCode === -1 && /^(mã\s*thẻ|mã|code)/i.test(val)) {
              colCode = c;
              headerRowIdx = r;
            } else if (colFrame === -1 && /^(phôi\s*ảnh|phôi|ảnh|frame)/i.test(val)) {
              colFrame = c;
              headerRowIdx = r;
            }
          }
          if (colTitle !== -1) break;
        }

        const lines = [];
        const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          let title = "";
          let desc = "";
          let cat = "";
          let code = "";
          let frame = "";

          if (colTitle !== -1) {
            title = String(row[colTitle] ?? "").trim();
            desc = colDesc !== -1 ? String(row[colDesc] ?? "").trim() : title;
            cat = colCat !== -1 ? String(row[colCat] ?? "").trim() : "";
            code = colCode !== -1 ? String(row[colCode] ?? "").trim() : "";
            frame = colFrame !== -1 ? String(row[colFrame] ?? "").trim() : "";
          } else {
            const col0 = String(row[0] ?? "").trim();
            const col1 = String(row[1] ?? "").trim();
            const col2 = String(row[2] ?? "").trim();
            const col3 = String(row[3] ?? "").trim();
            const col4 = String(row[4] ?? "").trim();
            if (!col0 && !col1) continue;
            if (r === 0 && /^(tên\s*thẻ|tiêu\s*đề|stt|title|card\s*name)/i.test(col0)) continue;

            title = col0;
            desc = col1 || col0;
            // Nếu cột 2 có dạng mã thẻ PWR-xx / CHL-xx (file mẫu 4 cột cũ) thì tự nhận diện
            if (/^(PWR|CHL|PC|PEN)-?\d+$/i.test(col2)) {
              cat = "";
              code = col2;
              frame = col3;
            } else {
              cat = col2;
              code = col3;
              frame = col4;
            }
          }

          if (!title || /^(tên\s*thẻ|tiêu\s*đề|stt)$/i.test(title)) continue;
          lines.push(`${title} | ${desc} | ${cat} | ${code} | ${frame}`);
        }

        const input = document.getElementById("bulk-cards-input");
        if (input) {
          input.value = lines.join("\n");
          previewBulkCards();
        }
        showToast(`📊 Đã đọc ${lines.length} thẻ từ file Excel "${file.name}"!`, "emerald");
      } catch (err) {
        console.error("Excel card read error:", err);
        showToast("❌ Không thể đọc file Excel này. Vui lòng kiểm tra định dạng!", "rose");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result || "";
    const input = document.getElementById("bulk-cards-input");
    if (input) {
      input.value = text;
      previewBulkCards();
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
}

function parseCardImportText(text, type) {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const isPower = type === "power";
  const frames = (typeof AVAILABLE_CARD_FRAMES !== "undefined" && AVAILABLE_CARD_FRAMES.length > 0)
    ? AVAILABLE_CARD_FRAMES.map((f) => resolveFrameUrl(f))
    : Array.from({ length: 24 }, (_, i) => `${i + 1}.jpg`);

  const powerIcons = ["⚡", "🛡️", "🏖️", "🍫", "🌟", "👑", "🚀", "💡", "💎", "🎯", "🍀", "🔥"];
  const penaltyIcons = ["🎭", "🎯", "🧹", "⏰", "🙋", "🎤", "🧘", "🎲", "🧩", "⚽", "🎨", "🧗"];

  const currentDeck = isPower ? appState.powerCards : appState.penaltyCards;
  let nextCodeIndex = currentDeck.length + 1;

  const parsed = [];

  lines.forEach((line, idx) => {
    let parts = [];
    if (line.includes("|")) {
      parts = line.split("|").map((p) => p.trim());
    } else if (line.includes("\t")) {
      parts = line.split("\t").map((p) => p.trim());
    } else if (line.includes(",")) {
      parts = line.split(",").map((p) => p.trim());
    } else {
      parts = [line];
    }

    let title = "";
    let desc = "";
    let rawCategory = "";
    let customCode = "";
    let customFrameRaw = "";

    if (parts.length === 1) {
      desc = parts[0];
      title = desc.length > 25 ? desc.slice(0, 24) + "…" : desc;
    } else {
      title = parts[0];
      desc = parts[1] || parts[0];
      const p2 = (parts[2] || "").trim();
      const p3 = (parts[3] || "").trim();
      const p4 = (parts[4] || "").trim();

      // Tương thích cả định dạng 5 cột mới (Tên | Nội dung | Phân loại | Mã thẻ | Phôi) lẫn 4 cột cũ
      if (/^(PWR|CHL|PC|PEN)-?\d+$/i.test(p2) && !p4) {
        rawCategory = "";
        customCode = p2.toUpperCase();
        customFrameRaw = p3;
      } else {
        rawCategory = p2;
        customCode = p3.toUpperCase();
        customFrameRaw = p4;
      }
    }

    if (!title || /^(tên\s*thẻ|tiêu\s*đề)$/i.test(title)) return;

    const category = normalizeCardCategory(rawCategory, type, idx);

    let chosenFrame = frames[Math.floor(Math.random() * frames.length)];
    if (customFrameRaw) {
      const frameNum = parseInt(customFrameRaw.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(frameNum) && frameNum >= 1 && frameNum <= 24) {
        chosenFrame = `${frameNum}.jpg`;
      }
    }

    const randomIcon = isPower
      ? powerIcons[idx % powerIcons.length]
      : penaltyIcons[idx % penaltyIcons.length];

    const code = customCode || (isPower
      ? `PWR-${String(nextCodeIndex++).padStart(2, "0")}`
      : `CHL-${String(nextCodeIndex++).padStart(2, "0")}`);

    parsed.push({
      type,
      title,
      description: desc,
      category,
      code,
      cardFrame: chosenFrame,
      icon: randomIcon
    });
  });

  return parsed;
}

function previewBulkCards() {
  const text = document.getElementById("bulk-cards-input")?.value || "";
  const parsed = parseCardImportText(text, currentBulkCardType);

  const badge = document.getElementById("bulk-cards-count-badge");
  const list = document.getElementById("bulk-cards-preview-list");
  const isPower = currentBulkCardType === "power";

  if (badge) {
    badge.textContent = `${parsed.length} thẻ hợp lệ`;
    badge.className = parsed.length > 0
      ? `px-2.5 py-0.5 rounded-lg ${isPower ? "bg-amber-100 text-amber-950 border-amber-300" : "bg-violet-100 text-violet-950 border-violet-300"} border font-black text-xs`
      : "px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-bold text-xs";
  }

  if (list) {
    if (parsed.length === 0) {
      list.innerHTML = `<div class="text-slate-400 text-center py-4 font-bold italic">Chưa có thẻ nào. Hãy tải file Excel lên hoặc bấm "📋 Dán mẫu thẻ".</div>`;
      return;
    }

    list.innerHTML = parsed
      .map(
        (c, idx) => {
          const catBadgeStyle = getCategoryBadgeStyle(c.category, isPower);
          return `
        <div class="p-2.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center shrink-0">
              ${idx + 1}
            </span>
            <div class="w-10 h-14 rounded-xl border border-slate-900 bg-cover bg-center shrink-0 relative overflow-hidden" style="background-image: url('${c.cardFrame}');">
              <span class="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[8px] font-black text-center truncate">
                ${c.cardFrame.replace('Card/', '')}
              </span>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="px-2 py-0.5 rounded-md ${isPower ? "bg-amber-300 text-slate-950" : "bg-violet-300 text-slate-950"} border border-slate-900 text-[10px] font-black uppercase">
                  ${c.code}
                </span>
                <span class="px-2 py-0.5 rounded-full border text-[10px] font-black ${catBadgeStyle}">
                  📂 ${c.category}
                </span>
                <span class="font-black text-xs text-slate-900 truncate">${c.icon} ${c.title}</span>
              </div>
              <div class="text-[11px] font-bold text-slate-600 truncate mt-0.5">${c.description}</div>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 font-black text-[11px] shrink-0">
            Phôi ${c.cardFrame.replace('Card/', '')}
          </span>
        </div>
      `;
        }
      )
      .join("");
  }
}

function confirmBulkImportCards() {
  const text = document.getElementById("bulk-cards-input")?.value || "";
  const parsed = parseCardImportText(text, currentBulkCardType);

  if (parsed.length === 0) {
    showToast("⚠️ Chưa có thẻ nào hợp lệ để tạo!", "rose");
    return;
  }

  const isPower = currentBulkCardType === "power";
  const targetDeck = isPower ? appState.powerCards : appState.penaltyCards;

  parsed.forEach((c) => {
    targetDeck.push({
      id: (isPower ? "pc-" : "pen-") + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      code: c.code,
      category: c.category,
      title: c.title,
      icon: c.icon,
      description: c.description,
      cardFrame: c.cardFrame,
      pdfUrl: "",
      pdfPage: 1
    });
  });

  saveState();
  renderCardDecks();
  updateNavCardCounts();
  closeModal("bulk-import-cards-modal");
  playFanfareSound();
  showToast(
    `🎉 Đã sinh và thêm thành công ${parsed.length} thẻ ${isPower ? "Power Card" : "Challenge Card"} mới!`,
    isPower ? "indigo" : "amber"
  );
}

// ----------------------------------------------------------------------------
// 16. TIỆN ÍCH ĐÓNG MODAL & HIỂN THỊ THÔNG BÁO TOAST
// ----------------------------------------------------------------------------
function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("hidden");
  if (modalId === "student-detail-modal") {
    activeStudentModalId = null;
  }
}

function showToast(message, color = "indigo") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const colorMap = {
    indigo: "bg-slate-900 text-white border-2 border-slate-900 shadow-[0_4px_0_#1e293b]",
    emerald: "bg-emerald-400 text-slate-950 border-2 border-slate-900 shadow-[0_4px_0_#1e293b]",
    rose: "bg-rose-400 text-slate-950 border-2 border-slate-900 shadow-[0_4px_0_#1e293b]",
    amber: "bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_4px_0_#1e293b]",
    slate: "bg-slate-800 text-white border-2 border-slate-900 shadow-[0_4px_0_#1e293b]",
    blue: "bg-sky-300 text-slate-950 border-2 border-slate-900 shadow-[0_4px_0_#1e293b]"
  };

  const toast = document.createElement("div");
  toast.className = `px-4 py-3 rounded-2xl text-xs font-black flex items-center gap-2 animate-pop ${
    colorMap[color] || colorMap.indigo
  }`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}
