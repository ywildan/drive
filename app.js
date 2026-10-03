/* ============================================================
   Dashboard Drive — Mode Demo
   Seluruh data di bawah ini adalah DATA CONTOH di memori.

   BACKEND SEAM: untuk versi produksi, ganti sumber data
   (DEMO_ACCOUNTS & DEMO_FILES) dengan pemanggilan Google
   Drive API v3 via OAuth 2.0:
     - login tiap akun  -> Google Identity Services (GIS)
     - list file        -> drive.files.list (per akun)
     - upload          -> drive.files.create (multipart/resumable)
     - hapus           -> drive.files.delete / .update(trashed)
   Satu Google Cloud project cukup untuk banyak akun; tiap akun
   menyimpan refresh_token-nya masing-masing.
   ============================================================ */

"use strict";

/* ---------------- Data contoh ---------------- */
const GB = 1024 ** 3, MB = 1024 ** 2, KB = 1024;

const DEMO_ACCOUNTS = [
  { id: "a1", name: "Akun Utama",   email: "wildan.utama@gmail.com",   color: "#4f46e5", quotaTotal: 15 * GB },
  { id: "a2", name: "Akun Cadangan", email: "wildan.cadangan@gmail.com", color: "#0d9488", quotaTotal: 15 * GB },
];

const now = Date.now(), H = 3600e3, D = 24 * H;
const DEMO_FILES = [
  // --- Akun 1 ---
  { id: "f-kuliah", name: "Kuliah", kind: "folder", accountId: "a1", parentId: "root", modified: now - 2 * D, starred: false, trashed: false },
  { id: "f-ta", name: "Proposal TA.pdf", kind: "file", ext: "pdf", size: 2.4 * MB, accountId: "a1", parentId: "f-kuliah", modified: now - 5 * H, starred: true, trashed: false },
  { id: "f-dataset", name: "Dataset penelitian.csv", kind: "file", ext: "csv", size: 184 * MB, accountId: "a1", parentId: "f-kuliah", modified: now - 3 * D, starred: false, trashed: false },
  { id: "f-jadwal", name: "Jadwal semester 8.xlsx", kind: "file", ext: "xlsx", size: 96 * KB, accountId: "a1", parentId: "f-kuliah", modified: now - 9 * D, starred: false, trashed: false },
  { id: "f-foto", name: "Foto", kind: "folder", accountId: "a1", parentId: "root", modified: now - 12 * D, starred: false, trashed: false },
  { id: "f-bali", name: "Liburan Bali", kind: "folder", accountId: "a1", parentId: "f-foto", modified: now - 30 * D, starred: false, trashed: false },
  { id: "f-pantai", name: "pantai-kuta.jpg", kind: "file", ext: "jpg", size: 4.1 * MB, accountId: "a1", parentId: "f-bali", modified: now - 30 * D, starred: true, trashed: false },
  { id: "f-sunset", name: "sunset-uluwatu.jpg", kind: "file", ext: "jpg", size: 3.8 * MB, accountId: "a1", parentId: "f-bali", modified: now - 30 * D, starred: false, trashed: false },
  { id: "f-karsa", name: "Karsa", kind: "folder", accountId: "a1", parentId: "root", modified: now - 1 * D, starred: false, trashed: false },
  { id: "f-pitch", name: "pitch-deck-karsa.pdf", kind: "file", ext: "pdf", size: 8.7 * MB, accountId: "a1", parentId: "f-karsa", modified: now - 1 * D, starred: true, trashed: false },
  { id: "f-logo", name: "logo-kb.svg", kind: "file", ext: "svg", size: 12 * KB, accountId: "a1", parentId: "f-karsa", modified: now - 2 * D, starred: false, trashed: false },
  { id: "f-cv", name: "CV Wildan 2026.pdf", kind: "file", ext: "pdf", size: 312 * KB, accountId: "a1", parentId: "root", modified: now - 6 * D, starred: false, trashed: false },
  { id: "f-keuangan", name: "Catatan keuangan.xlsx", kind: "file", ext: "xlsx", size: 58 * KB, accountId: "a1", parentId: "root", modified: now - 8 * H, starred: false, trashed: false },
  { id: "f-lama", name: "draft-lama.docx", kind: "file", ext: "docx", size: 44 * KB, accountId: "a1", parentId: "root", modified: now - 60 * D, starred: false, trashed: true },

  // --- Akun 2 ---
  { id: "f-backup", name: "Backup HP", kind: "folder", accountId: "a2", parentId: "root", modified: now - 4 * D, starred: false, trashed: false },
  { id: "f-chat", name: "backup-chat-2026.zip", kind: "file", ext: "zip", size: 1.2 * GB, accountId: "a2", parentId: "f-backup", modified: now - 4 * D, starred: false, trashed: false },
  { id: "f-wisuda", name: "foto-wisuda.jpg", kind: "file", ext: "jpg", size: 5.2 * MB, accountId: "a2", parentId: "f-backup", modified: now - 20 * D, starred: false, trashed: false },
  { id: "f-film", name: "Film", kind: "folder", accountId: "a2", parentId: "root", modified: now - 15 * D, starred: false, trashed: false },
  { id: "f-dok", name: "dokumenter-pendaki.mp4", kind: "file", ext: "mp4", size: 2.8 * GB, accountId: "a2", parentId: "f-film", modified: now - 15 * D, starred: false, trashed: false },
  { id: "f-arsip", name: "arsip-2024.zip", kind: "file", ext: "zip", size: 940 * MB, accountId: "a2", parentId: "root", modified: now - 90 * D, starred: false, trashed: false },
  { id: "f-musik", name: "playlist-kerja.mp3", kind: "file", ext: "mp3", size: 9.4 * MB, accountId: "a2", parentId: "root", modified: now - 7 * D, starred: true, trashed: false },
];

/* ---------------- State ---------------- */
const state = {
  nav: "drive",            // drive | starred | recent | trash
  folderId: "root",
  view: "grid",
  search: "",
  accountFilter: "all",
  sort: "name-asc",
  selectedId: null,
  files: structuredClone(DEMO_FILES),
  activity: [
    { text: "Mengunggah pitch-deck-karsa.pdf ke Akun Utama", t: now - 1 * D },
    { text: "Menghubungkan Akun Cadangan", t: now - 2 * D },
    { text: "Mengunggah dokumenter-pendaki.mp4 ke Akun Cadangan", t: now - 15 * D },
  ],
};

const $ = (s) => document.querySelector(s);
const accountById = (id) => DEMO_ACCOUNTS.find((a) => a.id === id);

/* ---------------- Helpers ---------------- */
function formatBytes(b) {
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
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function iconFor(f) {
  if (f.kind === "folder")
    return { bg: "#eef0ff", c: "#4f46e5", svg: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>' };
  const map = {
    pdf: ["#fee2e2", "#dc2626"], doc: ["#dbeafe", "#2563eb"], docx: ["#dbeafe", "#2563eb"],
    xls: ["#dcfce7", "#16a34a"], xlsx: ["#dcfce7", "#16a34a"], csv: ["#dcfce7", "#16a34a"],
    jpg: ["#fef3c7", "#d97706"], jpeg: ["#fef3c7", "#d97706"], png: ["#fef3c7", "#d97706"], svg: ["#fef3c7", "#d97706"], gif: ["#fef3c7", "#d97706"],
    mp4: ["#f3e8ff", "#9333ea"], mkv: ["#f3e8ff", "#9333ea"], mov: ["#f3e8ff", "#9333ea"],
    mp3: ["#e0f2fe", "#0284c7"], wav: ["#e0f2fe", "#0284c7"],
    zip: ["#ffedd5", "#ea580c"], rar: ["#ffedd5", "#ea580c"], "7z": ["#ffedd5", "#ea580c"],
    ppt: ["#ffe4e6", "#e11d48"], pptx: ["#ffe4e6", "#e11d48"],
    txt: ["#f1f5f9", "#64748b"], md: ["#f1f5f9", "#64748b"],
  };
  const [bg, c] = map[(f.ext || "").toLowerCase()] || ["#eef1f6", "#5b6072"];
  return { bg, c, svg: '<path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/>' };
}
function fileIcon(f, size = 22) {
  const ic = iconFor(f);
  return `<span class="file-icon" style="background:${ic.bg};color:${ic.c}">
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${f.kind === "folder" ? ic.c : "none"}" stroke="${f.kind === "folder" ? "none" : "currentColor"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</svg>
  </span>`;
}
function quotaUsed(accountId) {
  return state.files.filter((f) => f.accountId === accountId && f.kind === "file" && !f.trashed)
    .reduce((s, f) => s + (f.size || 0), 0);
}
function targetAccount() {
  // Akun tujuan upload: yang difilter, atau yang ruang kosongnya paling lega
  if (state.accountFilter !== "all") return accountById(state.accountFilter);
  return [...DEMO_ACCOUNTS].sort((a, b) =>
    (b.quotaTotal - quotaUsed(b.id)) - (a.quotaTotal - quotaUsed(a.id)))[0];
}
function logActivity(text) {
  state.activity.unshift({ text, t: Date.now() });
  state.activity = state.activity.slice(0, 12);
  renderActivity();
}

/* ---------------- Filtering ---------------- */
function visibleFiles() {
  let list = state.files.filter((f) => !f.trashed || state.nav === "trash");
  if (state.nav === "trash") list = list.filter((f) => f.trashed);
  else if (state.nav === "starred") list = list.filter((f) => f.starred && !f.trashed);
  else if (state.nav === "recent") list = list.filter((f) => f.kind === "file" && !f.trashed);
  else if (!state.search) list = list.filter((f) => f.parentId === state.folderId && !f.trashed);

  if (state.accountFilter !== "all") list = list.filter((f) => f.accountId === state.accountFilter);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((f) => f.name.toLowerCase().includes(q));
  }
  const [key, dir] = state.sort.split("-");
  const mul = dir === "asc" ? 1 : -1;
  list.sort((a, b) => {
    if (a.kind !== b.kind && (key === "name")) return a.kind === "folder" ? -1 : 1;
    let v = 0;
    if (key === "name") v = a.name.localeCompare(b.name, "id");
    else if (key === "modified") v = a.modified - b.modified;
    else if (key === "size") v = (a.size || 0) - (b.size || 0);
    return v * mul;
  });
  if (state.nav === "recent") list.sort((a, b) => b.modified - a.modified);
  return list;
}
function folderPath(folderId) {
  const path = [];
  let cur = state.files.find((f) => f.id === folderId);
  while (cur) {
    path.unshift(cur);
    cur = state.files.find((f) => f.id === cur.parentId);
  }
  return path;
}

/* ---------------- Render ---------------- */
function render() {
  renderAccounts(); renderStorage(); renderNav(); renderBreadcrumb(); renderFiles(); renderDetail();
}
function renderNav() {
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.nav === state.nav));
  const n = state.files.filter((f) => f.trashed).length;
  $("#trashCount").textContent = n ? n : "";
  $("#trashCount").style.display = n ? "" : "none";
}
function renderAccounts() {
  $("#accountList").innerHTML = DEMO_ACCOUNTS.map((a) => {
    const used = quotaUsed(a.id), pct = Math.min(100, (used / a.quotaTotal) * 100);
    const initial = a.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return `<div class="account">
      <div class="avatar" style="background:${a.color}">${initial}</div>
      <div class="account-info">
        <div class="account-name">${esc(a.name)}</div>
        <div class="account-email">${esc(a.email)}</div>
        <div class="quota"><div style="width:${pct.toFixed(1)}%;background:${a.color}"></div></div>
        <div class="quota-text">${formatBytes(used)} dari ${formatBytes(a.quotaTotal)}</div>
      </div>
    </div>`;
  }).join("");
  const sel = $("#accountFilter");
  const cur = sel.value;
  sel.innerHTML = `<option value="all">Semua akun</option>` +
    DEMO_ACCOUNTS.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  sel.value = cur;
}
function renderStorage() {
  const total = DEMO_ACCOUNTS.reduce((s, a) => s + a.quotaTotal, 0);
  const used = DEMO_ACCOUNTS.reduce((s, a) => s + quotaUsed(a.id), 0);
  $("#storageFill").style.width = Math.min(100, (used / total) * 100).toFixed(1) + "%";
  $("#storageText").textContent = `${formatBytes(used)} dari ${formatBytes(total)} terpakai`;
}
function renderActivity() {
  $("#activityList").innerHTML = state.activity.map((a) =>
    `<div class="activity-item"><span class="activity-dot"></span><span>${esc(a.text)}<br><span class="activity-time">${timeAgo(a.t)}</span></span></div>`
  ).join("");
}
function renderBreadcrumb() {
  const bc = $("#breadcrumb");
  if (state.nav === "starred") { bc.innerHTML = `<span class="crumb current">Berbintang</span>`; return; }
  if (state.nav === "recent") { bc.innerHTML = `<span class="crumb current">Terbaru</span>`; return; }
  if (state.nav === "trash") {
    bc.innerHTML = `<span class="crumb current">Sampah</span>
      <button class="link-btn" id="btnEmptyTrash" style="margin-left:auto">Kosongkan sampah</button>`;
    $("#btnEmptyTrash").onclick = emptyTrash;
    return;
  }
  const titles = { drive: "Drive Gabungan" };
  let html = `<button class="crumb ${state.folderId === "root" ? "current" : ""}" data-f="root">${titles[state.nav]}</button>`;
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
  return `<button class="star-btn ${f.starred ? "starred" : ""}" data-star="${f.id}" title="Bintang" aria-label="Bintang">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z"/></svg>
  </button>`;
}
function accountPill(f) {
  const a = accountById(f.accountId);
  return `<span class="account-pill"><span class="dot" style="background:${a.color}"></span>${esc(a.name)}</span>`;
}
function renderFiles() {
  const area = $("#fileArea");
  const list = visibleFiles();
  const folders = list.filter((f) => f.kind === "folder");
  const files = list.filter((f) => f.kind === "file");

  if (!list.length) {
    area.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
      <p>${state.nav === "trash" ? "Sampah kosong." : state.search ? `Tidak ada hasil untuk "${esc(state.search)}".` : "Folder ini kosong."}</p>
    </div>`;
    return;
  }

  const card = (f) => `
    <button class="file-card ${state.selectedId === f.id ? "selected" : ""}" data-id="${f.id}">
      ${starBtn(f)}
      ${fileIcon(f)}
      <div class="file-name">${esc(f.name)}</div>
      <div class="file-meta">${f.kind === "folder" ? "Folder" : formatBytes(f.size)} · ${timeAgo(f.modified)}</div>
      ${accountPill(f)}
    </button>`;

  const row = (f) => {
    const a = accountById(f.accountId);
    return `
    <button class="file-row ${state.selectedId === f.id ? "selected" : ""}" data-id="${f.id}">
      ${fileIcon(f, 20)}
      <span class="file-name">${esc(f.name)}</span>
      <span class="col hide-m"><span class="account-pill"><span class="dot" style="background:${a.color}"></span>${esc(a.name)}</span></span>
      <span class="col hide-m">${timeAgo(f.modified)}</span>
      <span class="col hide-m">${f.kind === "folder" ? "—" : formatBytes(f.size)}</span>
      ${starBtn(f)}
    </button>`;
  };

  if (state.view === "grid") {
    let html = "";
    if (folders.length && !state.search && state.nav === "drive")
      html += `<div class="section-title">Folder</div><div class="files-grid">${folders.map(card).join("")}</div>`;
    else if (folders.length) html += `<div class="files-grid">${folders.map(card).join("")}</div>`;
    if (files.length)
      html += `${folders.length && !state.search && state.nav === "drive" ? `<div class="section-title">File</div>` : ""}<div class="files-grid">${files.map(card).join("")}</div>`;
    area.innerHTML = html;
  } else {
    area.innerHTML = `<div class="files-list">
      <div class="file-row col-head" style="cursor:default">
        <span></span><span>Nama</span><span class="hide-m">Akun</span><span class="hide-m">Diubah</span><span class="hide-m">Ukuran</span><span></span>
      </div>
      ${list.map(row).join("")}
    </div>`;
  }

  area.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-star]")) return;
      openItem(el.dataset.id);
    });
  });
  area.querySelectorAll("[data-star]").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); toggleStar(b.dataset.star); });
  });
}
function renderDetail() {
  const panel = $("#detailPanel");
  const f = state.files.find((x) => x.id === state.selectedId);
  if (!f) { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); return; }
  panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
  const a = accountById(f.accountId);
  const other = DEMO_ACCOUNTS.find((x) => x.id !== f.accountId);
  const ic = iconFor(f);

  $("#detailBody").innerHTML = `
    <div class="detail-preview" style="background:${ic.bg}33">${fileIcon(f, 52)}</div>
    <div class="detail-name">${esc(f.name)}</div>
    <div class="detail-sub">${f.kind === "folder" ? "Folder" : "File " + esc((f.ext || "").toUpperCase())} · ${accountPill(f)}</div>
    <div class="detail-rows">
      <div class="detail-row"><span class="k">Akun</span><span class="v">${esc(a.name)}</span></div>
      <div class="detail-row"><span class="k">Email</span><span class="v">${esc(a.email)}</span></div>
      ${f.kind === "file" ? `<div class="detail-row"><span class="k">Ukuran</span><span class="v">${formatBytes(f.size)}</span></div>` : ""}
      <div class="detail-row"><span class="k">Diubah</span><span class="v">${timeAgo(f.modified)}</span></div>
      <div class="detail-row"><span class="k">Lokasi</span><span class="v">${esc(locationOf(f))}</span></div>
    </div>
    <div class="detail-actions">
      ${f.kind === "file" ? `<button class="btn-secondary" data-act="download">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 4v12m0 0 4-4m-4 4-4-4"/><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1"/></svg>
        Unduh (demo)</button>` : ""}
      <button class="btn-secondary" data-act="star">${f.starred ? "Hapus bintang" : "Tandai bintang"}</button>
      <button class="btn-secondary" data-act="rename">Ganti nama</button>
      ${!f.trashed && other ? `<button class="btn-secondary" data-act="move">Pindah ke ${esc(other.name)}</button>` : ""}
      ${f.trashed ? `
        <button class="btn-secondary" data-act="restore">Pulihkan</button>
        <button class="btn-danger" data-act="destroy">Hapus permanen</button>` : `
        <button class="btn-danger" data-act="trash">Hapus</button>`}
    </div>`;

  $("#detailBody").querySelectorAll("[data-act]").forEach((b) =>
    b.onclick = () => doAction(b.dataset.act, f.id));
}
function locationOf(f) {
  if (f.parentId === "root") return "Drive Gabungan";
  const p = folderPath(f.parentId).map((x) => x.name).join(" / ");
  return p || "Drive Gabungan";
}

/* ---------------- Actions ---------------- */
function openItem(id) {
  const f = state.files.find((x) => x.id === id);
  if (!f) return;
  if (f.kind === "folder" && !f.trashed && state.nav === "drive") {
    state.folderId = id; state.selectedId = null;
  } else {
    state.selectedId = id;
  }
  render();
  if (window.innerWidth <= 1100 && state.selectedId) $("#detailPanel").scrollTop = 0;
}
function toggleStar(id) {
  const f = state.files.find((x) => x.id === id);
  f.starred = !f.starred;
  logActivity(`${f.starred ? "Menandai" : "Melepas bintang"} ${f.name}`);
  render();
}
function doAction(act, id) {
  const f = state.files.find((x) => x.id === id);
  if (!f) return;
  if (act === "download") { toast("Mode demo: unduhan dinonaktifkan."); return; }
  if (act === "star") { toggleStar(id); return; }
  if (act === "rename") {
    const name = prompt("Nama baru:", f.name);
    if (name && name.trim() && name.trim() !== f.name) {
      logActivity(`Mengganti nama ${f.name} menjadi ${name.trim()}`);
      f.name = name.trim(); f.modified = Date.now(); render();
    }
    return;
  }
  if (act === "move") {
    const other = DEMO_ACCOUNTS.find((x) => x.id !== f.accountId);
    const from = accountById(f.accountId);
    f.accountId = other.id; f.modified = Date.now();
    logActivity(`Memindahkan ${f.name} dari ${from.name} ke ${other.name}`);
    toast(`Dipindah ke ${other.name}. Kuota ${from.name} berkurang ${formatBytes(f.size || 0)}.`);
    render(); return;
  }
  if (act === "trash") {
    f.trashed = true; state.selectedId = null;
    logActivity(`Menghapus ${f.name}`);
    toast(`"${f.name}" dipindah ke Sampah.`, "Urungkan", () => {
      f.trashed = false; logActivity(`Mengurungkan hapus ${f.name}`); render();
    });
    render(); return;
  }
  if (act === "restore") {
    f.trashed = false; logActivity(`Memulihkan ${f.name}`); render(); return;
  }
  if (act === "destroy") {
    if (!confirm(`Hapus permanen "${f.name}"?`)) return;
    state.files = state.files.filter((x) => x.id !== id);
    state.selectedId = null;
    logActivity(`Menghapus permanen ${f.name}`);
    render(); return;
  }
}
function emptyTrash() {
  const n = state.files.filter((f) => f.trashed).length;
  if (!n || !confirm(`Hapus permanen ${n} item di Sampah?`)) return;
  state.files = state.files.filter((f) => !f.trashed);
  logActivity(`Mengosongkan Sampah (${n} item)`);
  render();
}

/* ---------------- Upload (simulasi) ---------------- */
function uploadFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const dock = $("#uploadDock"), items = $("#uploadItems");
  dock.hidden = false;
  $("#uploadTitle").textContent = `Mengunggah ${files.length} file…`;

  files.forEach((file) => {
    const target = targetAccount();
    const id = "u" + Math.random().toString(36).slice(2, 9);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const row = document.createElement("div");
    row.className = "upload-item"; row.id = id;
    row.innerHTML = `<div class="upload-name">${esc(file.name)}</div>
      <div class="upload-sub">ke ${esc(target.name)} · ${formatBytes(file.size)}</div>
      <div class="upload-bar"><div style="width:0%"></div></div>`;
    items.prepend(row);
    const bar = row.querySelector(".upload-bar > div");

    // Simulasi progress — versi produksi: XMLHttpRequest/Fetch ke
    // https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + 8 + Math.random() * 22);
      bar.style.width = p + "%";
      if (p >= 100) {
        clearInterval(timer);
        row.classList.add("done");
        row.querySelector(".upload-sub").textContent = `Tersimpan di ${target.name} ✓`;
        state.files.unshift({
          id: "f-" + Date.now().toString(36) + id,
          name: file.name, kind: "file", ext, size: file.size,
          accountId: target.id,
          parentId: state.nav === "drive" && !state.search ? state.folderId : "root",
          modified: Date.now(), starred: false, trashed: false,
        });
        logActivity(`Mengunggah ${file.name} ke ${target.name}`);
        render();
        const remaining = items.querySelectorAll(".upload-item:not(.done)").length;
        if (!remaining) {
          $("#uploadTitle").textContent = "Unggahan selesai";
          setTimeout(() => { if (!items.querySelectorAll(".upload-item:not(.done)").length) dock.hidden = true; }, 2500);
        }
      }
    }, 160);
  });
}

/* ---------------- Toast ---------------- */
function toast(msg, actionLabel, actionFn) {
  const wrap = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>` +
    (actionLabel ? `<button>${esc(actionLabel)}</button>` : "");
  if (actionLabel) el.querySelector("button").onclick = () => { actionFn(); dismiss(); };
  wrap.appendChild(el);
  const dismiss = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
  setTimeout(dismiss, actionFn ? 6000 : 3500);
}

/* ---------------- Events ---------------- */
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

  $("#btnUpload").onclick = () => $("#fileInput").click();
  $("#fileInput").addEventListener("change", (e) => { uploadFiles(e.target.files); e.target.value = ""; });
  $("#btnHideUpload").onclick = () => $("#uploadDock").hidden = true;

  $("#btnNewFolder").onclick = () => {
    const name = prompt("Nama folder baru:");
    if (!name || !name.trim()) return;
    const target = targetAccount();
    state.files.unshift({
      id: "f-" + Date.now().toString(36), name: name.trim(), kind: "folder",
      accountId: target.id, parentId: state.nav === "drive" ? state.folderId : "root",
      modified: Date.now(), starred: false, trashed: false,
    });
    logActivity(`Membuat folder ${name.trim()} di ${target.name}`);
    toast(`Folder dibuat di ${target.name}.`);
    render();
  };

  $("#btnCloseDetail").onclick = () => { state.selectedId = null; renderDetail(); renderFiles(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { state.selectedId = null; renderDetail(); renderFiles(); }
  });

  $("#btnConnect").onclick = () => $("#connectModal").hidden = false;
  $("#btnCloseModal").onclick = () => $("#connectModal").hidden = true;
  $("#connectModal").addEventListener("click", (e) => {
    if (e.target.id === "connectModal") $("#connectModal").hidden = true;
  });

  $("#btnMenu").onclick = () => document.body.classList.toggle("nav-open");
  $("#scrim").onclick = () => document.body.classList.remove("nav-open");

  // Drag & drop upload
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

/* ---------------- Init ---------------- */
bindEvents();
render();
renderActivity();
