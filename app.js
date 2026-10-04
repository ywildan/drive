/* ============================================================
   Dashboard Drive — backend Google Drive API (nyata) + demo
   ------------------------------------------------------------
   MODE NYATA: tiap akun login via Google Identity Services
   (OAuth 2.0, scope drive). Satu Google Cloud project cukup
   untuk banyak akun — token disimpan per akun di memori
   browser, request langsung ke www.googleapis.com.
   MODE DEMO : data contoh di memori (tanpa Client ID).
   ============================================================ */

"use strict";

/* ---------------- Konstanta ---------------- */
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const GB = 1024 ** 3, MB = 1024 ** 2;
const PALETTE = ["#4f46e5", "#0d9488", "#db2777", "#ea580c", "#7c3aed", "#0284c7"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

/* ---------------- Data contoh (mode demo) ---------------- */
const DEMO_ACCOUNTS = [
  { email: "wildan.utama@gmail.com", name: "Akun Utama", color: PALETTE[0], quotaTotal: 15 * GB },
  { email: "wildan.cadangan@gmail.com", name: "Akun Cadangan", color: PALETTE[1], quotaTotal: 15 * GB },
];
const now = Date.now(), H = 3600e3, D = 24 * H;
const DEMO_FILES = [
  { id: "f-kuliah", name: "Kuliah", kind: "folder", account: 0, parentId: "root", modified: now - 2 * D, starred: false, trashed: false },
  { id: "f-ta", name: "Proposal TA.pdf", kind: "file", ext: "pdf", size: 2.4 * MB, account: 0, parentId: "f-kuliah", modified: now - 5 * H, starred: true, trashed: false },
  { id: "f-dataset", name: "Dataset penelitian.csv", kind: "file", ext: "csv", size: 184 * MB, account: 0, parentId: "f-kuliah", modified: now - 3 * D, starred: false, trashed: false },
  { id: "f-jadwal", name: "Jadwal semester 8.xlsx", kind: "file", ext: "xlsx", size: 96 * 1024, account: 0, parentId: "f-kuliah", modified: now - 9 * D, starred: false, trashed: false },
  { id: "f-foto", name: "Foto", kind: "folder", account: 0, parentId: "root", modified: now - 12 * D, starred: false, trashed: false },
  { id: "f-bali", name: "Liburan Bali", kind: "folder", account: 0, parentId: "f-foto", modified: now - 30 * D, starred: false, trashed: false },
  { id: "f-pantai", name: "pantai-kuta.jpg", kind: "file", ext: "jpg", size: 4.1 * MB, account: 0, parentId: "f-bali", modified: now - 30 * D, starred: true, trashed: false },
  { id: "f-karsa", name: "Karsa", kind: "folder", account: 0, parentId: "root", modified: now - 1 * D, starred: false, trashed: false },
  { id: "f-pitch", name: "pitch-deck-karsa.pdf", kind: "file", ext: "pdf", size: 8.7 * MB, account: 0, parentId: "f-karsa", modified: now - 1 * D, starred: true, trashed: false },
  { id: "f-cv", name: "CV Wildan 2026.pdf", kind: "file", ext: "pdf", size: 312 * 1024, account: 0, parentId: "root", modified: now - 6 * D, starred: false, trashed: false },
  { id: "f-lama", name: "draft-lama.docx", kind: "file", ext: "docx", size: 44 * 1024, account: 0, parentId: "root", modified: now - 60 * D, starred: false, trashed: true },
  { id: "f-backup", name: "Backup HP", kind: "folder", account: 1, parentId: "root", modified: now - 4 * D, starred: false, trashed: false },
  { id: "f-chat", name: "backup-chat-2026.zip", kind: "file", ext: "zip", size: 1.2 * GB, account: 1, parentId: "f-backup", modified: now - 4 * D, starred: false, trashed: false },
  { id: "f-film", name: "Film", kind: "folder", account: 1, parentId: "root", modified: now - 15 * D, starred: false, trashed: false },
  { id: "f-dok", name: "dokumenter-pendaki.mp4", kind: "file", ext: "mp4", size: 2.8 * GB, account: 1, parentId: "f-film", modified: now - 15 * D, starred: false, trashed: false },
  { id: "f-arsip", name: "arsip-2024.zip", kind: "file", ext: "zip", size: 940 * MB, account: 1, parentId: "root", modified: now - 90 * D, starred: false, trashed: false },
  { id: "f-musik", name: "playlist-kerja.mp3", kind: "file", ext: "mp3", size: 9.4 * MB, account: 1, parentId: "root", modified: now - 7 * D, starred: true, trashed: false },
];
const EXT_MIME = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", svg: "image/svg+xml", mp4: "video/mp4", mp3: "audio/mpeg", zip: "application/zip", csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

/* ---------------- State ---------------- */
const state = {
  demoMode: false,
  sessions: new Map(),   // email -> { token, account:{email,name,photo,color,quota}, invalid }
  files: [],             // ternormalisasi: {id,name,isFolder,mimeType,size,modified,starred,trashed,parentId,accountEmail,webViewLink}
  nav: "drive", folderId: "root", view: "grid",
  search: "", accountFilter: "all", sort: "name-asc",
  selectedId: null,
  activity: [],
  syncing: false,      // kunci anti-tumpuk saat sinkronisasi berjalan
  loadingFiles: false, // daftar file sedang dimuat → tampilkan indikator loading
};
const $ = (s) => document.querySelector(s);
const clientId = () => localStorage.getItem("dd_client_id") || "";

/* ---------------- Helpers ---------------- */
function formatBytes(b) {
  if (b == null || isNaN(b)) return "—";
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const v = b / 1024 ** i;
  return (v >= 100 ? Math.round(v) : v.toFixed(1)) + " " + u[i];
}
function timeAgo(t) {
  const d = Date.now() - t;
  if (d < H) return Math.max(1, Math.round(d / 60e3)) + " mnt lalu";
  if (d < D) return Math.round(d / H) + " jam lalu";
  if (d < 30 * D) return Math.round(d / D) + " hari lalu";
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function iconFor(f) {
  if (f.isFolder)
    return { bg: "#eef0ff", c: "#4f46e5", svg: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>' };
  const m = (f.mimeType || "").toLowerCase(), n = f.name.toLowerCase();
  let key = "other";
  if (m.includes("pdf")) key = "pdf";
  else if (/word|document/.test(m) || /\.docx?$/.test(n)) key = "doc";
  else if (/spreadsheet|excel|csv/.test(m) || /\.xlsx?$/.test(n) || /\.csv$/.test(n)) key = "xls";
  else if (/presentation|powerpoint/.test(m) || /\.pptx?$/.test(n)) key = "ppt";
  else if (m.startsWith("image/")) key = "img";
  else if (m.startsWith("video/")) key = "vid";
  else if (m.startsWith("audio/")) key = "aud";
  else if (/zip|rar|7z|compressed|tar/.test(m) || /\.zip$/.test(n)) key = "zip";
  else if (m.startsWith("text/") || /\.(txt|md|json|js|ts|py|html|css)$/.test(n)) key = "txt";
  const map = {
    pdf: ["#fee2e2", "#dc2626"], doc: ["#dbeafe", "#2563eb"], xls: ["#dcfce7", "#16a34a"],
    ppt: ["#ffe4e6", "#e11d48"], img: ["#fef3c7", "#d97706"], vid: ["#f3e8ff", "#9333ea"],
    aud: ["#e0f2fe", "#0284c7"], zip: ["#ffedd5", "#ea580c"], txt: ["#f1f5f9", "#64748b"],
    other: ["#eef1f6", "#5b6072"],
  };
  const [bg, c] = map[key];
  return { bg, c, svg: '<path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/>' };
}
function fileIcon(f, size = 22) {
  const ic = iconFor(f);
  return `<span class="file-icon" style="background:${ic.bg};color:${ic.c}">
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${f.isFolder ? ic.c : "none"}" stroke="${f.isFolder ? "none" : "currentColor"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</svg>
  </span>`;
}
function sessionOf(email) { return state.sessions.get(email); }
function accountColor(email) {
  const s = sessionOf(email);
  return s ? s.account.color : "#5b6072";
}
function accountName(email) {
  if (state.demoMode) { const a = DEMO_ACCOUNTS.find((x) => x.email === email); return a ? a.name : email; }
  const s = sessionOf(email);
  return s ? s.account.name : email;
}
function quotaOf(email) {
  if (state.demoMode) {
    const a = DEMO_ACCOUNTS.find((x) => x.email === email);
    const used = state.files.filter((f) => f.accountEmail === email && !f.isFolder && !f.trashed).reduce((s, f) => s + f.size, 0);
    return { used, total: a.quotaTotal };
  }
  const s = sessionOf(email);
  const q = s?.account.quota || {};
  return { used: Number(q.usage || 0), total: Number(q.limit || 0) };
}
function logActivity(text) {
  state.activity.unshift({ text, t: Date.now() });
  state.activity = state.activity.slice(0, 12);
  renderActivity();
}

/* ============================================================
   AUTH — alur OAuth2 redirect (tanpa popup, tanpa library)
   Token + sesi disimpan di sessionStorage: tahan reload dalam
   satu tab, hilang saat tab ditutup. Tidak ada popup yang bisa
   diblokir browser.
   ============================================================ */
const REDIRECT_URI = () => location.origin + "/";

function persistSessions() {
  try {
    sessionStorage.setItem("dd_sessions", JSON.stringify(
      [...state.sessions.values()].map((s) => ({ token: s.token, account: s.account }))
    ));
  } catch (e) {}
}
function restoreSessions() {
  try {
    const arr = JSON.parse(sessionStorage.getItem("dd_sessions") || "[]");
    arr.forEach((s, i) => {
      const email = s && s.account && s.account.email;
      if (email && !state.sessions.has(email)) {
        state.sessions.set(email, {
          token: s.token, invalid: false,
          account: { ...s.account, color: s.account.color || PALETTE[i % PALETTE.length] },
        });
      }
    });
  } catch (e) {}
}
function connectAccount() {
  if (state.demoMode) { toast("Kamu di mode demo — muat ulang untuk hubungkan akun asli."); return; }
  if (!clientId()) { showSetup(); return; }
  persistSessions();
  const st = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem("dd_oauth_state", st); } catch (e) {}
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: REDIRECT_URI(),
    response_type: "token",
    scope: DRIVE_SCOPE,
    prompt: "select_account",
    state: st,
    include_granted_scopes: "true",
  });
  // Redirect penuh ke Google — kembali ke halaman ini dengan token
  location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}
/* Dipanggil saat halaman dimuat: tangani kembalinya dari Google */
function handleAuthReturn() {
  if (!location.hash || location.hash.length < 2) return false;
  const h = new URLSearchParams(location.hash.substring(1));
  const err = h.get("error"), token = h.get("access_token"), st = h.get("state");
  if (!err && !token) return false;
  history.replaceState(null, "", location.pathname + location.search);
  if (err) {
    try { sessionStorage.removeItem("dd_oauth_state"); } catch (e) {}
    toast("Login Google gagal: " + err.replace(/_/g, " "));
    return true;
  }
  let okState = false;
  try {
    okState = !!st && st === sessionStorage.getItem("dd_oauth_state");
    sessionStorage.removeItem("dd_oauth_state");
  } catch (e) {}
  if (!okState) { toast("Sesi login tidak valid — coba hubungkan lagi."); return true; }
  completeConnect(token);
  return true;
}
async function completeConnect(token) {
  try {
    const about = await driveFetch({ token }, "/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota");
    const email = about.user.emailAddress;
    if (state.sessions.has(email)) {
      const s = state.sessions.get(email);
      s.token = token; s.invalid = false;
      toast("Token " + email + " diperbarui.");
    } else {
      state.sessions.set(email, {
        token, invalid: false,
        account: {
          email, name: about.user.displayName || email, photo: about.user.photoLink || "",
          quota: about.storageQuota || {}, color: PALETTE[state.sessions.size % PALETTE.length],
        },
      });
      logActivity("Menghubungkan " + email);
      toast("Terhubung sebagai " + email + ". Mengambil daftar file…");
    }
    persistSessions();
    state.loadingFiles = true;
    if (!state.files.length) renderFiles();
    try { await syncSession(state.sessions.get(email)); }
    finally { state.loadingFiles = false; }
    persistSessions();
    render();
  } catch (e) {
    toast("Gagal menghubungkan: " + e.message);
  }
}
/* Refresh token senyap via iframe tersembunyi (tanpa popup) */
function silentRefresh(session) {
  return new Promise((resolve) => {
    const st = Math.random().toString(36).slice(2);
    const p = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: REDIRECT_URI(),
      response_type: "token",
      scope: DRIVE_SCOPE,
      prompt: "none",
      state: st,
      include_granted_scopes: "true",
    });
    if (session.account && session.account.email) p.set("login_hint", session.account.email);
    const ifr = document.createElement("iframe");
    ifr.style.display = "none";
    let settled = false;
    const done = (ok) => {
      if (settled) return; settled = true;
      clearTimeout(to); ifr.remove(); resolve(ok);
    };
    const to = setTimeout(() => done(false), 20000);
    ifr.onload = () => {
      try {
        const u = new URL(ifr.contentWindow.location.href);
        if (u.origin !== location.origin) return; // masih di halaman Google
        const h = new URLSearchParams(u.hash.substring(1));
        if (h.get("state") === st && h.get("access_token")) {
          session.token = h.get("access_token");
          session.invalid = false;
          persistSessions();
          done(true);
        } else done(false);
      } catch (e) { /* halaman Google (cross-origin) — tunggu redirect kembali */ }
    };
    ifr.onerror = () => done(false);
    ifr.src = "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
    document.body.appendChild(ifr);
  });
}
async function refreshSession(session) {
  try {
    if (await silentRefresh(session)) return true;
  } catch (e) {}
  const email = (session.account && session.account.email) || "akun ini";
  session.invalid = true;
  persistSessions();
  renderAccounts();
  toast("Sesi " + email + " berakhir — klik Hubungkan untuk login ulang.");
  return false;
}

/* ============================================================
   DRIVE API
   ============================================================ */
async function driveFetch(session, path, options = {}, retried = false) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res;
  try {
    res = await fetch("https://www.googleapis.com" + path, {
      ...options, cache: "no-store", signal: ctrl.signal,
      headers: { Authorization: "Bearer " + session.token, "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e && e.name === "AbortError" ? "Koneksi timeout (30 dtk)" : "Jaringan bermasalah: " + (e && e.message ? e.message : e));
  }
  clearTimeout(timer);
  if (res.status === 401 && !retried) {
    if (await refreshSession(session)) return driveFetch(session, path, options, true);
    throw new Error("Sesi berakhir");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || ("Drive API error " + res.status));
  return data;
}
function normFile(d, email, realRootId) {
  const pid = (d.parents && d.parents[0]) || "root";
  return {
    id: d.id, name: d.name, isFolder: d.mimeType === FOLDER_MIME, mimeType: d.mimeType,
    size: Number(d.size || 0), modified: new Date(d.modifiedTime).getTime(),
    starred: !!d.starred, trashed: false,
    // API mengembalikan ID opaque untuk folder root — petakan ke "root"
    parentId: pid === realRootId ? "root" : pid,
    accountEmail: email, webViewLink: d.webViewLink || "",
  };
}
async function syncSession(session) {
  const email = session.account.email;
  const fields = "nextPageToken,files(id,name,mimeType,size,modifiedTime,starred,parents,webViewLink)";
  const listQuery = async (trashed) => {
    const docs = [];
    let pageToken = null;
    do {
      const q = encodeURIComponent(`trashed=${trashed}`);
      let url = `/drive/v3/files?q=${q}&fields=${encodeURIComponent(fields)}&pageSize=1000&orderBy=folder,name`;
      if (pageToken) url += "&pageToken=" + pageToken;
      const data = await driveFetch(session, url);
      (data.files || []).forEach((d) => docs.push({ d, trashed }));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return docs;
  };
  // Semua request per akun jalan paralel: id root, list normal, list sampah, kuota
  const [rootRes, lists, aboutRes] = await Promise.all([
    driveFetch(session, "/drive/v3/files/root?fields=id").catch(() => null),
    Promise.all([listQuery(false), listQuery(true)]),
    driveFetch(session, "/drive/v3/about?fields=storageQuota").catch(() => null),
  ]);
  const realRootId = (rootRes && rootRes.id) || "root";
  const out = lists.flat().map(({ d, trashed }) => {
    const f = normFile(d, email, realRootId);
    f.trashed = trashed;
    return f;
  });
  state.files = [...state.files.filter((f) => f.accountEmail !== email), ...out];
  if (aboutRes && aboutRes.storageQuota) session.account.quota = aboutRes.storageQuota;
}
async function syncAll() {
  if (state.syncing) { toast("Masih menyinkronkan — tunggu sebentar…"); return; }
  state.syncing = true;
  state.loadingFiles = true;
  // Spinner hanya saat daftar benar-benar kosong; kalau sudah ada data,
  // biarkan tampil selama refresh (seperti Google Drive)
  if (!state.files.length) renderFiles();
  try {
    // Semua akun disinkronkan paralel; tiap akun yang selesai langsung tampil
    await Promise.all([...state.sessions.values()].map(async (s) => {
      try { await syncSession(s); render(); }
      catch (e) { toast("Gagal sinkron " + s.account.email + ": " + e.message); }
    }));
  } finally {
    state.syncing = false;
    state.loadingFiles = false;
  }
  render();
}
/* Upload resumable (semua ukuran, dengan progress) */
function uploadResumable(session, file, parentId, onProgress) {
  const attempt = async (token) => {
    const init = await fetch(UPLOAD + "/files?uploadType=resumable", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name: file.name, parents: [parentId] }),
    });
    if (init.status === 401) {
      if (await refreshSession(session)) return attempt(session.token);
      throw new Error("Sesi berakhir");
    }
    if (!init.ok) throw new Error("Gagal memulai upload (" + init.status + ")");
    const loc = init.headers.get("Location");
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", loc);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300
        ? resolve(JSON.parse(xhr.responseText)) : reject(new Error("Upload gagal (" + xhr.status + ")"));
      xhr.onerror = () => reject(new Error("Upload gagal (jaringan)"));
      xhr.send(file);
    });
  };
  return attempt(session.token);
}
async function downloadBlob(session, file) {
  let path = `/drive/v3/files/${file.id}?alt=media`;
  if (file.mimeType.startsWith("application/vnd.google-apps.")) {
    const exp = {
      "application/vnd.google-apps.document": "application/pdf",
      "application/vnd.google-apps.spreadsheet": "application/pdf",
      "application/vnd.google-apps.presentation": "application/pdf",
      "application/vnd.google-apps.drawing": "image/png",
    }[file.mimeType];
    if (!exp) throw new Error("Dokumen Google tipe ini tidak bisa diunduh langsung — buka di Drive.");
    path = `/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exp)}`;
  }
  const res = await fetch("https://www.googleapis.com" + path, { headers: { Authorization: "Bearer " + session.token } });
  if (res.status === 401) {
    if (await refreshSession(session)) return downloadBlob(session, file);
    throw new Error("Sesi berakhir");
  }
  if (!res.ok) throw new Error("Unduh gagal (" + res.status + ")");
  return res.blob();
}

/* ============================================================
   MODE DEMO — data contoh + mutasi lokal
   ============================================================ */
function loadDemo() {
  state.demoMode = true;
  state.files = DEMO_FILES.map((f) => ({
    id: f.id, name: f.name, isFolder: f.kind === "folder",
    mimeType: f.kind === "folder" ? FOLDER_MIME : (EXT_MIME[(f.ext || "").toLowerCase()] || "application/octet-stream"),
    size: f.size || 0, modified: f.modified, starred: f.starred, trashed: f.trashed,
    parentId: f.parentId, accountEmail: DEMO_ACCOUNTS[f.account].email, webViewLink: "",
  }));
  state.activity = [
    { text: "Menghubungkan Akun Utama (demo)", t: now - 2 * D },
    { text: "Menghubungkan Akun Cadangan (demo)", t: now - 2 * D },
  ];
}

/* ---------------- Filtering & render ---------------- */
function visibleFiles() {
  let list = state.files.filter((f) => !f.trashed || state.nav === "trash");
  if (state.nav === "trash") list = list.filter((f) => f.trashed);
  else if (state.nav === "starred") list = list.filter((f) => f.starred && !f.trashed);
  else if (state.nav === "recent") list = list.filter((f) => !f.isFolder && !f.trashed);
  else if (!state.search) list = list.filter((f) => f.parentId === state.folderId && !f.trashed);

  if (state.accountFilter !== "all") list = list.filter((f) => f.accountEmail === state.accountFilter);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((f) => f.name.toLowerCase().includes(q));
  }
  const [key, dir] = state.sort.split("-");
  const mul = dir === "asc" ? 1 : -1;
  list.sort((a, b) => {
    if (a.isFolder !== b.isFolder && key === "name") return a.isFolder ? -1 : 1;
    let v = 0;
    if (key === "name") v = a.name.localeCompare(b.name, "id");
    else if (key === "modified") v = a.modified - b.modified;
    else if (key === "size") v = a.size - b.size;
    return v * mul;
  });
  if (state.nav === "recent") list.sort((a, b) => b.modified - a.modified);
  return list;
}
function folderPath(folderId) {
  const path = [];
  let cur = state.files.find((f) => f.id === folderId);
  while (cur) { path.unshift(cur); cur = state.files.find((f) => f.id === cur.parentId); }
  return path;
}
function render() {
  renderAccounts(); renderStorage(); renderNav(); renderBreadcrumb(); renderFiles(); renderDetail(); renderConnectCta();
  $("#modeBadge").hidden = !state.demoMode;
}
function renderConnectCta() {
  $("#connectCta").hidden = state.demoMode || state.sessions.size > 0;
}
function renderNav() {
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.nav === state.nav));
  const n = state.files.filter((f) => f.trashed).length;
  const badge = $("#trashCount");
  badge.textContent = n || "";
  badge.style.display = n ? "" : "none";
}
function accountEntries() {
  if (state.demoMode) return DEMO_ACCOUNTS.map((a) => ({ email: a.email, name: a.name, color: a.color, photo: "", invalid: false }));
  return [...state.sessions.values()].map((s) => ({ ...s.account, invalid: s.invalid }));
}
function renderAccounts() {
  $("#accountList").innerHTML = accountEntries().map((a) => {
    const q = quotaOf(a.email);
    const pct = q.total ? Math.min(100, (q.used / q.total) * 100) : 0;
    const initial = a.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const avatar = a.photo
      ? `<img class="avatar" src="${esc(a.photo)}" alt="" style="object-fit:cover" />`
      : `<div class="avatar" style="background:${a.color}">${esc(initial)}</div>`;
    return `<div class="account" style="${a.invalid ? "opacity:.55" : ""}">
      ${avatar}
      <div class="account-info">
        <div class="account-name">${esc(a.name)}${a.invalid ? " (sesi berakhir)" : ""}</div>
        <div class="account-email">${esc(a.email)}</div>
        <div class="quota"><div style="width:${pct.toFixed(1)}%;background:${a.color}"></div></div>
        <div class="quota-text">${formatBytes(q.used)} dari ${q.total ? formatBytes(q.total) : "—"}</div>
      </div>
    </div>`;
  }).join("") || `<div style="font-size:13px;color:var(--ink-faint);padding:6px 8px">Belum ada akun.</div>`;

  const sel = $("#accountFilter"), cur = sel.value;
  sel.innerHTML = `<option value="all">Semua akun</option>` +
    accountEntries().map((a) => `<option value="${esc(a.email)}">${esc(a.name)}</option>`).join("");
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : "all";
  state.accountFilter = sel.value;
}
function renderStorage() {
  const entries = accountEntries();
  const used = entries.reduce((s, a) => s + quotaOf(a.email).used, 0);
  const total = entries.reduce((s, a) => s + quotaOf(a.email).total, 0);
  $("#storageFill").style.width = total ? Math.min(100, (used / total) * 100).toFixed(1) + "%" : "0%";
  $("#storageText").textContent = entries.length
    ? `${formatBytes(used)} dari ${total ? formatBytes(total) : "—"} terpakai`
    : "Hubungkan akun untuk melihat kuota";
  $("#storageHint").textContent = entries.length
    ? `${entries.length} akun × ${state.demoMode ? "15 GB paket gratis (demo)" : "kuota Google masing-masing"}`
    : "";
}
function renderActivity() {
  $("#activityList").innerHTML = state.activity.map((a) =>
    `<div class="activity-item"><span class="activity-dot"></span><span>${esc(a.text)}<br><span class="activity-time">${timeAgo(a.t)}</span></span></div>`
  ).join("") || `<div style="font-size:12.5px;color:var(--ink-faint)">Belum ada aktivitas.</div>`;
}
function renderBreadcrumb() {
  const bc = $("#breadcrumb");
  if (state.nav === "starred") { bc.innerHTML = `<span class="crumb current">Berbintang</span>`; return; }
  if (state.nav === "recent") { bc.innerHTML = `<span class="crumb current">Terbaru</span>`; return; }
  if (state.nav === "trash") {
    bc.innerHTML = `<span class="crumb current">Sampah</span>
      <button class="link-btn" id="btnEmptyTrash" style="margin-left:auto">Kosongkan sampah</button>`;
    const b = $("#btnEmptyTrash");
    if (b) b.onclick = emptyTrash;
    return;
  }
  let html = `<button class="crumb ${state.folderId === "root" ? "current" : ""}" data-f="root">Drive Gabungan</button>`;
  folderPath(state.folderId).forEach((f, i, arr) => {
    html += `<span class="crumb-sep">/</span><button class="crumb ${i === arr.length - 1 ? "current" : ""}" data-f="${f.id}">${esc(f.name)}</button>`;
  });
  if (state.search) html += `<span class="crumb-sep">/</span><span class="crumb current">Hasil "${esc(state.search)}"</span>`;
  bc.innerHTML = html;
  bc.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => {
    state.folderId = b.dataset.f; state.search = ""; $("#searchInput").value = "";
    state.selectedId = null; render();
  });
}
function starBtn(f) {
  // NOTE: harus <span>, bukan <button> — button tidak boleh bersarang di dalam
  // <button class="file-card">; parser browser akan menutup kartu lebih awal
  // dan isi kartu tercecer sebagai item grid terpisah.
  return `<span class="star-btn ${f.starred ? "starred" : ""}" data-star="${f.id}" title="Bintang" role="button" tabindex="0" aria-label="Bintang">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z"/></svg>
  </span>`;
}
function accountPill(f) {
  return `<span class="account-pill"><span class="dot" style="background:${accountColor(f.accountEmail)}"></span>${esc(accountName(f.accountEmail))}</span>`;
}
function renderFiles() {
  const area = $("#fileArea");
  const list = visibleFiles();
  const folders = list.filter((f) => f.isFolder);
  const files = list.filter((f) => !f.isFolder);

  if (!list.length) {
    if (state.loadingFiles && !state.demoMode && state.sessions.size) {
      area.innerHTML = `<div class="empty">
        <svg class="spin" viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
        <p>Memuat file dari Google Drive…</p></div>`;
      return;
    }
    const msg = state.nav === "trash" ? "Sampah kosong."
      : state.search ? `Tidak ada hasil untuk "${esc(state.search)}".`
      : (!state.demoMode && !state.sessions.size) ? "Hubungkan akun Google dulu lewat tombol di sidebar."
      : "Folder ini kosong.";
    area.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2-2V7z"/></svg>
      <p>${msg}</p></div>`;
    return;
  }

  const card = (f) => `
    <button class="file-card ${state.selectedId === f.id ? "selected" : ""}" data-id="${f.id}">
      ${starBtn(f)}${fileIcon(f)}
      <div class="file-name">${esc(f.name)}</div>
      <div class="file-meta">${f.isFolder ? "Folder" : formatBytes(f.size)} · ${timeAgo(f.modified)}</div>
      ${accountPill(f)}
    </button>`;
  const row = (f) => `
    <button class="file-row ${state.selectedId === f.id ? "selected" : ""}" data-id="${f.id}">
      ${fileIcon(f, 20)}
      <span class="file-name">${esc(f.name)}</span>
      <span class="col hide-m">${accountPill(f)}</span>
      <span class="col hide-m">${timeAgo(f.modified)}</span>
      <span class="col hide-m">${f.isFolder ? "—" : formatBytes(f.size)}</span>
      ${starBtn(f)}
    </button>`;

  if (state.view === "grid") {
    let html = "";
    const showSections = folders.length && !state.search && state.nav === "drive";
    if (folders.length) html += `${showSections ? `<div class="section-title">Folder</div>` : ""}<div class="files-grid">${folders.map(card).join("")}</div>`;
    if (files.length) html += `${showSections ? `<div class="section-title">File</div>` : ""}<div class="files-grid">${files.map(card).join("")}</div>`;
    area.innerHTML = html;
  } else {
    area.innerHTML = `<div class="files-list">
      <div class="file-row col-head" style="cursor:default"><span></span><span>Nama</span><span class="hide-m">Akun</span><span class="hide-m">Diubah</span><span class="hide-m">Ukuran</span><span></span></div>
      ${list.map(row).join("")}</div>`;
  }
  area.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-star]")) return;
      openItem(el.dataset.id);
    });
  });
  area.querySelectorAll("[data-star]").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); toggleStar(b.dataset.star); });
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleStar(b.dataset.star); }
    });
  });
}
function renderDetail() {
  const panel = $("#detailPanel");
  const f = state.files.find((x) => x.id === state.selectedId);
  if (!f) { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); return; }
  panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
  const ic = iconFor(f);
  const others = accountEntries().filter((a) => a.email !== f.accountEmail);

  $("#detailBody").innerHTML = `
    <div class="detail-preview" style="background:${ic.bg}55">${fileIcon(f, 52)}</div>
    <div class="detail-name">${esc(f.name)}</div>
    <div class="detail-sub">${f.isFolder ? "Folder" : "File"} · ${accountPill(f)}</div>
    <div class="detail-rows">
      <div class="detail-row"><span class="k">Akun</span><span class="v">${esc(accountName(f.accountEmail))}</span></div>
      <div class="detail-row"><span class="k">Email</span><span class="v">${esc(f.accountEmail)}</span></div>
      ${!f.isFolder ? `<div class="detail-row"><span class="k">Ukuran</span><span class="v">${formatBytes(f.size)}</span></div>` : ""}
      <div class="detail-row"><span class="k">Diubah</span><span class="v">${timeAgo(f.modified)}</span></div>
      <div class="detail-row"><span class="k">Lokasi</span><span class="v">${esc(locationOf(f))}</span></div>
    </div>
    <div class="detail-actions">
      ${!f.isFolder ? `<button class="btn-secondary" data-act="download">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 4v12m0 0 4-4m-4 4-4-4"/><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1"/></svg>
        Unduh</button>` : ""}
      ${f.webViewLink ? `<button class="btn-secondary" data-act="open">Buka di Google Drive</button>` : ""}
      <button class="btn-secondary" data-act="star">${f.starred ? "Hapus bintang" : "Tandai bintang"}</button>
      <button class="btn-secondary" data-act="rename">Ganti nama</button>
      ${!f.trashed && others.length ? `<button class="btn-secondary" data-act="move">Pindah ke ${esc(others[0].name)}</button>` : ""}
      ${f.trashed
        ? `<button class="btn-secondary" data-act="restore">Pulihkan</button>
           <button class="btn-danger" data-act="destroy">Hapus permanen</button>`
        : `<button class="btn-danger" data-act="trash">Hapus</button>`}
    </div>`;
  $("#detailBody").querySelectorAll("[data-act]").forEach((b) =>
    b.onclick = () => doAction(b.dataset.act, f.id));
}
function locationOf(f) {
  if (f.parentId === "root") return "Drive Gabungan";
  return folderPath(f.parentId).map((x) => x.name).join(" / ") || "Drive Gabungan";
}

/* ---------------- Aksi file ---------------- */
function openItem(id) {
  const f = state.files.find((x) => x.id === id);
  if (!f) return;
  if (f.isFolder && !f.trashed && state.nav === "drive") { state.folderId = id; state.selectedId = null; }
  else state.selectedId = id;
  render();
}
async function toggleStar(id) {
  const f = state.files.find((x) => x.id === id);
  if (!f) return;
  const next = !f.starred;
  if (state.demoMode) { f.starred = next; }
  else {
    try { await driveFetch(sessionOf(f.accountEmail), `/drive/v3/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ starred: next }) }); f.starred = next; }
    catch (e) { toast("Gagal: " + e.message); return; }
  }
  logActivity(`${next ? "Menandai" : "Melepas bintang"} ${f.name}`);
  render();
}
async function doAction(act, id) {
  const f = state.files.find((x) => x.id === id);
  if (!f) return;
  const sess = sessionOf(f.accountEmail);

  if (act === "open") { window.open(f.webViewLink, "_blank", "noopener"); return; }
  if (act === "star") return toggleStar(id);

  if (act === "download") {
    if (state.demoMode) { toast("Mode demo: unduhan dinonaktifkan."); return; }
    toast("Mengunduh " + f.name + "…");
    try {
      const blob = await downloadBlob(sess, f);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      logActivity("Mengunduh " + f.name);
    } catch (e) { toast("Gagal mengunduh: " + e.message); }
    return;
  }
  if (act === "rename") {
    const name = prompt("Nama baru:", f.name);
    if (!name || !name.trim() || name.trim() === f.name) return;
    if (state.demoMode) { f.name = name.trim(); f.modified = Date.now(); }
    else {
      try { await driveFetch(sess, `/drive/v3/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) }); f.name = name.trim(); }
      catch (e) { toast("Gagal mengganti nama: " + e.message); return; }
    }
    logActivity("Mengganti nama menjadi " + f.name);
    render(); return;
  }
  if (act === "move") {
    const target = accountEntries().find((a) => a.email !== f.accountEmail);
    if (!target) return;
    if (state.demoMode) {
      const from = accountName(f.accountEmail);
      f.accountEmail = target.email; f.parentId = "root"; f.modified = Date.now();
      logActivity(`Memindahkan ${f.name} dari ${from} ke ${target.name}`);
      toast(`Dipindah ke ${target.name}.`);
      render(); return;
    }
    if (!confirm(`Pindah "${f.name}" ke ${target.name}?\nFile akan diunggah ulang ke akun tujuan lalu dihapus dari akun asal.`)) return;
    toast("Memindahkan " + f.name + "…");
    try {
      await moveToAccount(sess, f, sessionOf(target.email));
      logActivity(`Memindahkan ${f.name} ke ${target.name}`);
      await syncSession(sessionOf(target.email));
      render();
      toast("Berhasil dipindah ke " + target.name + ".");
    } catch (e) { toast("Gagal memindah: " + e.message); }
    return;
  }
  if (act === "trash") {
    if (state.demoMode) { f.trashed = true; }
    else {
      try { await driveFetch(sess, `/drive/v3/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) }); f.trashed = true; }
      catch (e) { toast("Gagal menghapus: " + e.message); return; }
    }
    state.selectedId = null;
    logActivity("Menghapus " + f.name);
    toast(`"${f.name}" dipindah ke Sampah.`, "Urungkan", async () => {
      if (state.demoMode) f.trashed = false;
      else { try { await driveFetch(sess, `/drive/v3/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ trashed: false }) }); f.trashed = false; } catch (e) { toast("Gagal memulihkan: " + e.message); return; } }
      logActivity("Mengurungkan hapus " + f.name);
      render();
    });
    render(); return;
  }
  if (act === "restore") {
    if (state.demoMode) f.trashed = false;
    else {
      try { await driveFetch(sess, `/drive/v3/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ trashed: false }) }); f.trashed = false; }
      catch (e) { toast("Gagal memulihkan: " + e.message); return; }
    }
    logActivity("Memulihkan " + f.name);
    render(); return;
  }
  if (act === "destroy") {
    if (!confirm(`Hapus permanen "${f.name}"? Tidak bisa dikembalikan.`)) return;
    if (state.demoMode) state.files = state.files.filter((x) => x.id !== id);
    else {
      try { await driveFetch(sess, `/drive/v3/files/${f.id}`, { method: "DELETE" }); state.files = state.files.filter((x) => x.id !== id); }
      catch (e) { toast("Gagal: " + e.message); return; }
    }
    state.selectedId = null;
    logActivity("Menghapus permanen " + f.name);
    render(); return;
  }
}
async function emptyTrash() {
  const items = state.files.filter((f) => f.trashed);
  if (!items.length || !confirm(`Hapus permanen ${items.length} item di Sampah?`)) return;
  if (state.demoMode) state.files = state.files.filter((f) => !f.trashed);
  else {
    for (const f of items) {
      try { await driveFetch(sessionOf(f.accountEmail), `/drive/v3/files/${f.id}`, { method: "DELETE" }); }
      catch (e) { toast("Gagal menghapus " + f.name + ": " + e.message); }
    }
    await syncAll(); return;
  }
  logActivity(`Mengosongkan Sampah (${items.length} item)`);
  render();
}
/* Pindah lintas akun: unduh dari asal → unggah ke tujuan → trash asal */
async function moveToAccount(srcSess, file, dstSess) {
  if (file.isFolder) {
    const created = await driveFetch(dstSess, "/drive/v3/files", {
      method: "POST", body: JSON.stringify({ name: file.name, mimeType: FOLDER_MIME, parents: ["root"] }),
    });
    const children = state.files.filter((f) => f.accountEmail === srcSess.account.email && f.parentId === file.id && !f.trashed);
    for (const child of children) {
      if (child.isFolder) await moveFolderInto(srcSess, child, dstSess, created.id);
      else await moveFileInto(srcSess, child, dstSess, created.id);
    }
    await driveFetch(srcSess, `/drive/v3/files/${file.id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
    state.files = state.files.filter((f) => !(f.accountEmail === srcSess.account.email && (f.id === file.id || isDescendant(f, file.id))));
    return;
  }
  await moveFileInto(srcSess, file, dstSess, "root");
}
async function moveFileInto(srcSess, file, dstSess, dstParentId) {
  const blob = await downloadBlob(srcSess, file);
  await uploadResumable(dstSess, new File([blob], file.name, { type: blob.type }), dstParentId);
  await driveFetch(srcSess, `/drive/v3/files/${file.id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
  state.files = state.files.filter((f) => f.id !== file.id);
}
async function moveFolderInto(srcSess, folder, dstSess, dstParentId) {
  const created = await driveFetch(dstSess, "/drive/v3/files", {
    method: "POST", body: JSON.stringify({ name: folder.name, mimeType: FOLDER_MIME, parents: [dstParentId] }),
  });
  const children = state.files.filter((f) => f.accountEmail === srcSess.account.email && f.parentId === folder.id && !f.trashed);
  for (const child of children) {
    if (child.isFolder) await moveFolderInto(srcSess, child, dstSess, created.id);
    else await moveFileInto(srcSess, child, dstSess, created.id);
  }
  await driveFetch(srcSess, `/drive/v3/files/${folder.id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
  state.files = state.files.filter((f) => f.id !== folder.id);
}
function isDescendant(f, folderId) {
  let cur = f;
  while (cur && cur.parentId !== "root") {
    if (cur.parentId === folderId) return true;
    cur = state.files.find((x) => x.id === cur.parentId);
  }
  return false;
}

/* ---------------- Upload ---------------- */
function targetOfUpload() {
  if (state.demoMode) {
    let acc = DEMO_ACCOUNTS[0], parentId = "root";
    const cur = state.files.find((f) => f.id === state.folderId);
    if (state.nav === "drive" && !state.search && cur) {
      acc = DEMO_ACCOUNTS.find((a) => a.email === cur.accountEmail) || acc;
      parentId = cur.id;
    } else if (state.accountFilter !== "all") {
      acc = DEMO_ACCOUNTS.find((a) => a.email === state.accountFilter) || acc;
    } else {
      acc = [...DEMO_ACCOUNTS].sort((a, b) =>
        (b.quotaTotal - quotaOf(b.email).used) - (a.quotaTotal - quotaOf(a.email).used))[0];
    }
    return { demo: true, account: acc, parentId };
  }
  let sess = null, parentId = "root";
  const cur = state.files.find((f) => f.id === state.folderId);
  if (state.nav === "drive" && !state.search && cur && sessionOf(cur.accountEmail)) {
    sess = sessionOf(cur.accountEmail); parentId = cur.id;
  } else if (state.accountFilter !== "all" && sessionOf(state.accountFilter)) {
    sess = sessionOf(state.accountFilter);
  } else {
    const list = [...state.sessions.values()].filter((s) => !s.invalid);
    sess = list.sort((a, b) =>
      (Number(b.account.quota.limit || 0) - Number(b.account.quota.usage || 0)) -
      (Number(a.account.quota.limit || 0) - Number(a.account.quota.usage || 0)))[0] || null;
  }
  return { demo: false, session: sess, parentId };
}
function uploadFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const t = targetOfUpload();
  if (!t.demo && !t.session) { toast("Hubungkan akun Google dulu."); return; }

  const dock = $("#uploadDock"), items = $("#uploadItems");
  dock.hidden = false;
  const targetName = t.demo ? t.account.name : t.session.account.name;
  $("#uploadTitle").textContent = `Mengunggah ${files.length} file ke ${targetName}…`;

  files.forEach((file) => {
    const id = "u" + Math.random().toString(36).slice(2, 9);
    const row = document.createElement("div");
    row.className = "upload-item"; row.id = id;
    row.innerHTML = `<div class="upload-name">${esc(file.name)}</div>
      <div class="upload-sub">ke ${esc(targetName)} · ${formatBytes(file.size)}</div>
      <div class="upload-bar"><div style="width:0%"></div></div>`;
    items.prepend(row);
    const bar = row.querySelector(".upload-bar > div");
    const done = (ok, sub) => {
      row.classList.toggle("done", ok);
      if (sub) row.querySelector(".upload-sub").textContent = sub;
      if (!items.querySelectorAll(".upload-item:not(.done)").length) {
        $("#uploadTitle").textContent = "Unggahan selesai";
        setTimeout(() => { dock.hidden = true; }, 2600);
      }
    };

    if (t.demo) {
      // Simulasi progress
      let p = 0;
      const timer = setInterval(() => {
        p = Math.min(100, p + 9 + Math.random() * 24);
        bar.style.width = p + "%";
        if (p >= 100) {
          clearInterval(timer);
          state.files.unshift({
            id: "f-" + Date.now().toString(36) + id, name: file.name, isFolder: false,
            mimeType: file.type || "application/octet-stream", size: file.size,
            modified: Date.now(), starred: false, trashed: false,
            parentId: t.parentId, accountEmail: t.account.email, webViewLink: "",
          });
          logActivity(`Mengunggah ${file.name} ke ${t.account.name} (demo)`);
          done(true, `Tersimpan di ${t.account.name} ✓ (demo)`);
          render();
        }
      }, 150);
      return;
    }

    uploadResumable(t.session, file, t.parentId, (p) => { bar.style.width = (p * 100).toFixed(0) + "%"; })
      .then((created) => {
        done(true, `Tersimpan di ${targetName} ✓`);
        logActivity(`Mengunggah ${file.name} ke ${targetName}`);
        // Langsung masukkan ke daftar — tanpa sync ulang seluruh akun
        state.files.unshift({
          id: created.id, name: created.name || file.name, isFolder: false,
          mimeType: created.mimeType || file.type || "application/octet-stream",
          size: file.size, modified: Date.now(), starred: false, trashed: false,
          parentId: t.parentId, accountEmail: t.session.account.email,
          webViewLink: created.webViewLink || "",
        });
        render();
      })
      .catch((e) => {
        done(false, "Gagal: " + e.message);
        toast("Upload " + file.name + " gagal: " + e.message);
      });
  });
}
async function createFolder() {
  const name = prompt("Nama folder baru:");
  if (!name || !name.trim()) return;
  const t = targetOfUpload();
  if (state.demoMode) {
    state.files.unshift({
      id: "f-" + Date.now().toString(36), name: name.trim(), isFolder: true, mimeType: FOLDER_MIME,
      size: 0, modified: Date.now(), starred: false, trashed: false,
      parentId: t.parentId, accountEmail: t.account.email, webViewLink: "",
    });
    logActivity(`Membuat folder ${name.trim()} di ${t.account.name} (demo)`);
    toast(`Folder dibuat di ${t.account.name}. (demo)`);
    render(); return;
  }
  if (!t.session) { toast("Hubungkan akun Google dulu."); return; }
  try {
    const created = await driveFetch(t.session, "/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), mimeType: FOLDER_MIME, parents: [t.parentId] }),
    });
    // Langsung masukkan ke daftar — tanpa sync ulang seluruh akun
    state.files.push({
      id: created.id, name: created.name || name.trim(),
      isFolder: true, mimeType: FOLDER_MIME, size: 0,
      modified: created.modifiedTime ? new Date(created.modifiedTime).getTime() : Date.now(),
      starred: false, trashed: false,
      parentId: t.parentId, accountEmail: t.session.account.email,
      webViewLink: created.webViewLink || "",
    });
    logActivity(`Membuat folder ${name.trim()} di ${t.session.account.name}`);
    toast(`Folder dibuat di ${t.session.account.name}.`);
    render();
  } catch (e) { toast("Gagal membuat folder: " + e.message); }
}

/* ---------------- Tema gelap/terang ---------------- */
const ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.2A8 8 0 1 1 10.8 4 6.6 6.6 0 0 0 20 13.2z"/></svg>';
const ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"/></svg>';
function syncThemeIcon() {
  const dark = document.documentElement.dataset.theme === "dark";
  const b = $("#btnTheme");
  if (!b) return;
  b.innerHTML = dark ? ICON_SUN : ICON_MOON;
  b.title = dark ? "Mode terang" : "Mode gelap";
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("dd_theme", next); } catch (e) {}
  syncThemeIcon();
}

/* ---------------- Toast ---------------- */
function toast(msg, actionLabel, actionFn) {
  const wrap = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>` + (actionLabel ? `<button>${esc(actionLabel)}</button>` : "");
  const dismiss = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
  if (actionLabel) el.querySelector("button").onclick = () => { actionFn(); dismiss(); };
  wrap.appendChild(el);
  setTimeout(dismiss, actionFn ? 6000 : 3800);
}

/* ---------------- Setup view ---------------- */
function showSetup() { $("#setupView").hidden = false; $("#app").hidden = true; }
function hideSetup() { $("#setupView").hidden = true; $("#app").hidden = false; }

/* ---------------- Events & init ---------------- */
/* Menu konteks klik-kanan ala Google Drive */
function hideCtxMenu() { $("#ctxMenu").hidden = true; }
function showCtxMenu(x, y, id) {
  const f = state.files.find((v) => v.id === id);
  if (!f) return;
  state.selectedId = id;
  const others = accountEntries().filter((a) => a.email !== f.accountEmail);
  const I = (p) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const items = [];
  if (f.trashed) {
    items.push({ label: "Pulihkan", act: "restore", icon: I('<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>') });
    items.push({ label: "Hapus permanen", act: "destroy", danger: true, icon: I('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h8l1-13"/>') });
  } else {
    if (f.isFolder) items.push({ label: "Buka", act: "__openitem", icon: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>') });
    else {
      if (f.webViewLink) items.push({ label: "Buka di Google Drive", act: "open", icon: I('<path d="M14 4h6v6M20 4 11 13M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>') });
      items.push({ label: "Unduh", act: "download", icon: I('<path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16"/>') });
    }
    items.push({ label: f.starred ? "Hapus bintang" : "Beri bintang", act: "star", icon: I('<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z"/>') });
    items.push({ label: "Ganti nama", act: "rename", icon: I('<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 3z"/>') });
    if (others.length) items.push({ label: "Pindah ke " + others[0].name, act: "move", icon: I('<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>') });
    items.push({ sep: true });
    items.push({ label: "Hapus", act: "trash", danger: true, icon: I('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h8l1-13"/>') });
  }
  const menu = $("#ctxMenu");
  menu.innerHTML = items.map((it, i) => it.sep ? `<div class="ctx-sep"></div>` :
    `<button class="ctx-item${it.danger ? " danger" : ""}" data-ctx="${i}">${it.icon}<span>${esc(it.label)}</span></button>`).join("");
  menu.style.left = x + "px"; menu.style.top = y + "px";
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
  menu.querySelectorAll("[data-ctx]").forEach((b) => b.addEventListener("click", () => {
    const it = items[+b.dataset.ctx];
    hideCtxMenu();
    if (it.act === "__openitem") openItem(id); else doAction(it.act, id);
  }));
  render();
}
function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((b) => b.onclick = () => {
    state.nav = b.dataset.nav; state.selectedId = null;
    if (state.nav === "drive") state.folderId = "root";
    document.body.classList.remove("nav-open");
    render();
  });
  $("#searchInput").addEventListener("input", (e) => { state.search = e.target.value.trim(); renderFiles(); renderBreadcrumb(); });
  $("#accountFilter").addEventListener("change", (e) => { state.accountFilter = e.target.value; renderFiles(); });
  $("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderFiles(); });
  $("#viewGrid").onclick = () => { state.view = "grid"; syncView(); renderFiles(); };
  $("#viewList").onclick = () => { state.view = "list"; syncView(); renderFiles(); };
  $("#btnTheme").onclick = toggleTheme;
  $("#btnUpload").onclick = () => $("#fileInput").click();
  $("#fileInput").addEventListener("change", (e) => { uploadFiles(e.target.files); e.target.value = ""; });
  // Klik kanan pada file/folder → menu konteks kustom (ganti menu bawaan browser)
  $("#fileArea").addEventListener("contextmenu", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return; // area kosong: biarkan menu browser
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, el.dataset.id);
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("#ctxMenu")) hideCtxMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideCtxMenu(); });
  window.addEventListener("resize", hideCtxMenu);
  window.addEventListener("scroll", hideCtxMenu, true);
  $("#btnHideUpload").onclick = () => $("#uploadDock").hidden = true;
  $("#btnNewFolder").onclick = createFolder;
  $("#btnRefresh").onclick = async () => {
    if (state.demoMode) { toast("Mode demo: tidak ada yang disinkronkan."); return; }
    toast("Menyinkronkan…");
    await syncAll();
    const n = state.files.filter((f) => !f.trashed).length;
    toast(`Sinkron selesai: ${n} file/folder termuat.`);
  };
  $("#btnCloseDetail").onclick = () => { state.selectedId = null; renderDetail(); renderFiles(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { state.selectedId = null; renderDetail(); renderFiles(); }
  });
  $("#btnConnect").onclick = connectAccount;
  $("#btnConnectCta").onclick = connectAccount;

  const settingsModal = $("#settingsModal");
  $("#btnSettings").onclick = () => {
    $("#settingsClientId").value = clientId();
    settingsModal.hidden = false;
  };
  $("#btnCloseSettings").onclick = () => settingsModal.hidden = true;
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.hidden = true;
  });
  $("#btnSaveSettings").onclick = () => {
    const v = $("#settingsClientId").value.trim();
    if (!v) { toast("Client ID tidak boleh kosong."); return; }
    localStorage.setItem("dd_client_id", v);
    state.sessions.clear();
    state.files = [];
    state.selectedId = null;
    try { sessionStorage.removeItem("dd_sessions"); } catch (e) {}
    settingsModal.hidden = true;
    toast("Client ID diperbarui. Hubungkan ulang akun-akunmu.");
    logActivity("Mengganti OAuth Client ID");
    render();
  };
  $("#btnDisconnectAll").onclick = () => {
    state.sessions.clear();
    state.files = [];
    state.selectedId = null;
    settingsModal.hidden = true;
    toast("Semua akun diputuskan.");
    render();
  };
  $("#btnMenu").onclick = () => document.body.classList.toggle("nav-open");
  $("#scrim").onclick = () => document.body.classList.remove("nav-open");

  $("#btnSaveClientId").onclick = () => {
    const v = $("#clientIdInput").value.trim();
    if (!v) { toast("Tempel Client ID dulu."); return; }
    if (!/\.apps\.googleusercontent\.com$/.test(v) && v.length < 20) {
      if (!confirm("Client ID ini terlihat tidak valid. Tetap simpan?")) return;
    }
    localStorage.setItem("dd_client_id", v);
    hideSetup();
    toast("Client ID tersimpan. Sekarang hubungkan akun Googlemu.");
    render();
  };
  $("#clientIdInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btnSaveClientId").click(); });
  $("#btnDemoMode").onclick = () => { loadDemo(); hideSetup(); render(); renderActivity(); };

  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; document.body.classList.add("dragging"); });
  window.addEventListener("dragleave", (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove("dragging"); } });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove("dragging");
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
}
function syncView() {
  $("#viewGrid").classList.toggle("active", state.view === "grid");
  $("#viewList").classList.toggle("active", state.view === "list");
}

(function init() {
  // Jika dijalankan di dalam iframe (silent-refresh), jangan inisialisasi
  // aplikasi penuh — cukup biarkan parent membaca URL-nya.
  if (window.self !== window.top) return;
  bindEvents();
  syncThemeIcon();
  restoreSessions();
  handleAuthReturn(); // tangani kembalinya dari login Google (jika ada)
  const existing = $("#clientIdInput");
  if (clientId() && existing) existing.value = clientId();
  if (!clientId()) { showSetup(); return; }  // belum ada Client ID → panduan setup
  hideSetup();
  render();
  renderActivity();
  if (state.sessions.size && !state.demoMode) {
    // Muat ulang daftar file untuk sesi yang tersimpan
    (async () => {
      toast("Memuat file dari Google Drive…");
      await syncAll();
    })();
  }
})();
