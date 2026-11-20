/* uChoose web app: the same app as the Android version, built for any phone's browser.
 * Restaurant data comes from OpenStreetMap through Nominatim (free, no key). */
"use strict";

// ---------------------------------------------------------------------------
// Categories and matching rules (kept in step with the Android app)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "fast_food", title: "Fast Food", subtitle: "Quick & casual", noun: "fast food spots", resultLabel: "TONIGHT YOU DINE AT" },
  { id: "sit_down", title: "Sit Down", subtitle: "Relaxed dining", noun: "sit-down restaurants", resultLabel: "TONIGHT YOU DINE AT" },
  { id: "fine_dining", title: "Fine Dining", subtitle: "An elegant evening", noun: "fine dining restaurants", resultLabel: "TONIGHT YOU DINE AT" },
  { id: "coffee", title: "Coffee & Cafés", subtitle: "A quiet cup", noun: "coffee shops", resultLabel: "YOUR COFFEE AWAITS AT" },
  { id: "dessert", title: "Dessert", subtitle: "Something sweet", noun: "dessert spots", resultLabel: "TREAT YOURSELF AT" },
];

const RADIUS_OPTIONS = [1, 3, 5, 10, 15, 25];

const FINE_CUISINES = new Set(["steak_house", "steakhouse", "french", "fine_dining", "seafood", "oyster", "wine_bar"]);
const FINE_NAME_WORDS = words([
  "steakhouse", "steak house", "chophouse", "chop house", "prime", "bistro", "brasserie", "trattoria",
  "osteria", "ristorante", "grille", "oyster", "oysters", "wine", "chateau", "supper club",
]);
const FINE_SEARCHES = ["steakhouse", "seafood", "bistro"];
const CHAIN_SIT_DOWN = [
  "applebee", "chili's", "olive garden", "denny", "ihop", "cracker barrel", "red robin", "tgi friday",
  "buffalo wild", "texas roadhouse", "outback", "red lobster", "longhorn", "ruby tuesday", "waffle house",
  "bob evans", "perkins", "golden corral", "o'charley", "friendly's", "hooters",
];

const DESSERT_SEARCHES = ["[amenity=ice_cream]", "[shop=bakery]", "[shop=pastry]", "[shop=confectionery]", "donuts", "ice cream"];
const DESSERT_CUISINES = new Set([
  "dessert", "ice_cream", "frozen_yogurt", "donut", "doughnut", "cupcake", "crepe", "crepes", "waffle", "cake",
  "pastry", "gelato", "chocolate", "bubble_tea", "milkshake", "shaved_ice", "churros",
]);
const DESSERT_NAME_WORDS = words([
  "donut", "donuts", "doughnut", "doughnuts", "ice cream", "creamery", "gelato", "frozen yogurt", "froyo",
  "yogurt", "custard", "cupcake", "cupcakes", "bakery", "sweets", "dessert", "desserts", "crepe", "crepes",
  "churro", "churros", "krispy kreme", "dunkin", "baskin", "dairy queen", "cold stone", "rita's",
  "insomnia cookies", "crumbl", "duck donuts", "menchie", "sweet frog", "nothing bundt",
]);

function words(list) {
  return list.map((w) => new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b"));
}

function cuisinesOf(r) {
  return (r.cuisine || "").toLowerCase().split(/[;,]/).map((c) => c.trim()).filter(Boolean);
}

function isDessert(r) {
  if (r.kind === "dessert") return true;
  const name = r.name.toLowerCase();
  if (DESSERT_NAME_WORDS.some((re) => re.test(name))) return true;
  if (r.kind === "restaurant") return false;
  return cuisinesOf(r).some((c) => DESSERT_CUISINES.has(c));
}

function matches(categoryId, r) {
  if (categoryId === "fast_food") return r.kind === "fast_food";
  if (categoryId === "coffee") return r.kind === "cafe";
  if (categoryId === "dessert") return isDessert(r);
  if (r.kind !== "restaurant") return false;
  const name = r.name.toLowerCase();
  const isChain = CHAIN_SIT_DOWN.some((c) => name.includes(c));
  const looksFine = !isChain && (cuisinesOf(r).some((c) => FINE_CUISINES.has(c)) || FINE_NAME_WORDS.some((re) => re.test(name)));
  return categoryId === "fine_dining" ? looksFine : !looksFine;
}

// ---------------------------------------------------------------------------
// Saved settings (on this device only)
// ---------------------------------------------------------------------------

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("uchoose." + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("uchoose." + key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

let radiusMiles = store.get("radius", 5);
if (!RADIUS_OPTIONS.includes(radiusMiles)) radiusMiles = 5;

/** "McDonald's", "McDonalds" and "Mcdonald’s" all become "mcdonalds". */
function nameKey(name) {
  return name.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

const Hidden = {
  list: store.get("hidden", []),
  ids() { return new Set(this.list.map((p) => p.id)); },
  keysOf(r) { return [nameKey(r.name), r.brand ? nameKey(r.brand) : ""].filter(Boolean); },
  isHidden(r, ids = this.ids()) { return this.keysOf(r).some((k) => ids.has(k)); },
  hide(r) {
    if (this.isHidden(r)) return;
    const label = r.brand || r.name; // prefer the chain brand so every branch is covered
    this.list.push({ id: nameKey(label), name: label });
    this.list.sort((a, b) => a.name.localeCompare(b.name));
    store.set("hidden", this.list);
  },
  restore(id) { this.list = this.list.filter((p) => p.id !== id); store.set("hidden", this.list); },
  restoreAll() { this.list = []; store.set("hidden", this.list); },
};

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

let lastFix = null;

function getLocation() {
  if (lastFix && Date.now() - lastFix.time < 30 * 60 * 1000) return Promise.resolve(lastFix);
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error("unsupported"), { code: 0 }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastFix = { lat: pos.coords.latitude, lon: pos.coords.longitude, time: Date.now() };
        resolve(lastFix);
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function locationAlreadyAllowed() {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "granted";
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Restaurant data (Nominatim)
// ---------------------------------------------------------------------------

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// Nominatim asks for at most one request per second, so requests wait their turn.
let queueTail = Promise.resolve();
let lastRequestAt = 0;
function rateLimited(fn) {
  const run = queueTail.then(async () => {
    const wait = 1100 - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try { return await fn(); } finally { lastRequestAt = Date.now(); }
  });
  queueTail = run.catch(() => {});
  return run;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const KIND_BY_TYPE = {
  restaurant: "restaurant", fast_food: "fast_food", cafe: "cafe",
  ice_cream: "dessert", bakery: "dessert", pastry: "dessert", confectionery: "dessert",
};

function parsePlaces(json, here) {
  const out = [], ids = [];
  for (const el of json) {
    if (el.place_id) ids.push(el.place_id);
    const kind = KIND_BY_TYPE[el.type];
    if (!kind || !el.name) continue;
    const lat = parseFloat(el.lat), lon = parseFloat(el.lon);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const a = el.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.suburb || "";
    const extra = el.extratags || {};
    out.push({
      name: el.name.trim(), lat, lon, kind,
      cuisine: extra.cuisine || null,
      brand: extra.brand || null,
      address: [street, city].filter(Boolean).join(", ") || null,
      distance: distanceMeters(here.lat, here.lon, lat, lon),
    });
  }
  return { places: out, ids };
}

async function search(q, here, radius, pages) {
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos(here.lat * Math.PI / 180));
  const viewbox = [here.lon - dLon, here.lat + dLat, here.lon + dLon, here.lat - dLat].join(",");
  const results = [], seen = [];
  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams({
      q, viewbox, bounded: "1", limit: "40", format: "jsonv2", addressdetails: "1", extratags: "1",
      "accept-language": "en",
    });
    if (seen.length) params.set("exclude_place_ids", seen.join(","));
    const json = await rateLimited(async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(NOMINATIM + "?" + params, { signal: ctrl.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } finally { clearTimeout(timer); }
    });
    const { places, ids } = parsePlaces(json, here);
    results.push(...places);
    seen.push(...ids);
    if (ids.length < 40) break;
  }
  return results;
}

// Results are reused for 30 minutes if you haven't moved more than ~800 m.
const cache = new Map();
function cached(key, here, load) {
  const c = cache.get(key);
  if (c && Date.now() - c.time < 30 * 60 * 1000 && distanceMeters(here.lat, here.lon, c.lat, c.lon) < 800) {
    return c.promise.then((list) => list.map((p) => ({ ...p, distance: distanceMeters(here.lat, here.lon, p.lat, p.lon) })));
  }
  const promise = load();
  cache.set(key, { lat: here.lat, lon: here.lon, time: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

const pagesFor = (radius) => (radius > 8100 ? 2 : 1);
const quiet = (p) => p.catch(() => []);

const base = (here, r) => cached("base-" + r, here, async () => [
  ...(await search("[amenity=fast_food]", here, r, pagesFor(r))),
  ...(await search("[amenity=restaurant]", here, r, pagesFor(r))),
]);
const cafes = (here, r) => cached("cafe-" + r, here, () => search("[amenity=cafe]", here, r, pagesFor(r)));
const desserts = (here, r) => cached("dessert-" + r, here, async () => {
  const all = [];
  for (const q of DESSERT_SEARCHES) all.push(...(await quiet(search(q, here, r, 1))));
  return all;
});
const fineExtras = (here, r) => cached("fine-" + r, here, async () => {
  const all = [];
  for (const q of FINE_SEARCHES) all.push(...(await quiet(search(q, here, r, 1))));
  return all;
});

async function findPlaces(categoryId, here, radius) {
  let pool;
  if (categoryId === "coffee") pool = await cafes(here, radius);
  else if (categoryId === "dessert") pool = [...(await desserts(here, radius)), ...(await quiet(cafes(here, radius))), ...(await quiet(base(here, radius)))];
  else if (categoryId === "fine_dining") pool = [...(await base(here, radius)), ...(await fineExtras(here, radius))];
  else pool = await base(here, radius);

  const hidden = Hidden.ids();
  const seen = new Set();
  return pool
    .filter((p) => p.distance <= radius && matches(categoryId, p) && !Hidden.isHidden(p, hidden))
    .sort((a, b) => a.distance - b.distance)
    .filter((p) => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 12)
    .sort(() => Math.random() - 0.5);
}

const radiusMeters = () => Math.round(radiusMiles * 1609.344);

async function prefetch() {
  if (!(await locationAlreadyAllowed())) return;
  try {
    const here = await getLocation();
    const r = radiusMeters();
    await quiet(base(here, r));
    await quiet(cafes(here, r));
  } catch { /* ignore; the wheel screen will show errors */ }
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const screens = ["home", "wheel", "result", "hidden"];
let current = { screen: "home" };
let wheelItems = [];
let loadToken = 0;

function show(state, push = true) {
  current = state;
  for (const s of screens) $(s).hidden = s !== state.screen;
  if (push) history.pushState({ screen: state.screen, category: state.category }, "");
  if (state.screen === "home") renderHome();
  if (state.screen === "wheel") loadWheel(state.category);
  if (state.screen === "result") renderResult();
  if (state.screen === "hidden") renderHidden();
}

window.addEventListener("popstate", (e) => {
  const s = e.state || { screen: "home" };
  if (s.screen === "result" && !current.place) return show({ screen: "home" }, false);
  if (s.screen === "wheel") return show({ screen: "wheel", category: s.category }, false);
  show({ ...current, screen: s.screen }, false);
});

// ----- home -----

function renderHome() {
  const nav = $("categories");
  if (!nav.childElementCount) {
    for (const c of CATEGORIES) {
      const b = document.createElement("button");
      b.className = "card";
      b.innerHTML = `<span class="card-title"></span><span class="card-sub"></span>`;
      b.querySelector(".card-title").textContent = c.title;
      b.querySelector(".card-sub").textContent = c.subtitle;
      b.addEventListener("click", () => show({ screen: "wheel", category: c.id }));
      nav.appendChild(b);
    }
  }
  const opts = $("radius-options");
  opts.innerHTML = "";
  for (const m of RADIUS_OPTIONS) {
    const b = document.createElement("button");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(m === radiusMiles));
    b.textContent = m + " mi";
    b.addEventListener("click", () => {
      radiusMiles = m;
      store.set("radius", m);
      renderHome();
      prefetch();
    });
    opts.appendChild(b);
  }
  const link = $("hidden-link");
  link.hidden = Hidden.list.length === 0;
  link.textContent = `Hidden places (${Hidden.list.length})`;
}

$("hidden-link").addEventListener("click", () => show({ screen: "hidden" }));

// ----- wheel -----

function setWheelState(which) {
  $("wheel-loading").hidden = which !== "loading";
  $("wheel-error").hidden = which !== "error";
  $("wheel-ready").hidden = which !== "ready";
}

async function loadWheel(categoryId) {
  const cat = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  $("wheel-category").textContent = cat.title;
  setWheelState("loading");
  $("wheel-status").textContent = "Finding your location…";
  const token = ++loadToken;

  let here;
  try {
    here = await getLocation();
  } catch (err) {
    if (token !== loadToken) return;
    const denied = err && err.code === 1;
    $("location-help").hidden = !denied;
    return showWheelError(denied
      ? "Location access is off for this site. See the steps on the home screen, then try again."
      : "Couldn't get your location. Make sure Location Services are on and try again.");
  }
  if (token !== loadToken) return;
  $("location-help").hidden = true;
  $("wheel-status").textContent = "Searching for places…";

  try {
    const items = await Promise.race([
      findPlaces(cat.id, here, radiusMeters()),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 30000)),
    ]);
    if (token !== loadToken) return;
    if (items.length < 2) {
      return showWheelError(`No ${cat.noun} found within ${radiusMiles} ${radiusMiles === 1 ? "mile" : "miles"}. Try a larger distance on the home screen.`);
    }
    wheelItems = items;
    $("wheel-count").textContent = `${items.length} places within ${radiusMiles} mi`;
    setWheelState("ready");
    sizeCanvas();
    drawWheel();
  } catch {
    if (token !== loadToken) return;
    showWheelError("Couldn't reach the restaurant service. Check your connection and try again.");
  }
}

function showWheelError(msg) {
  $("wheel-error-text").textContent = msg;
  setWheelState("error");
}

$("retry").addEventListener("click", () => loadWheel(current.category));

// ----- wheel drawing -----

const canvas = $("wheel-canvas");
const ctx = canvas.getContext("2d");
const SERIF = getComputedStyle(document.documentElement).getPropertyValue("--serif").trim() || "Georgia, serif";
let rotation = 0; // degrees; segment i starts at -90 + i*sweep before rotation
let spinning = false;

function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
}

function ellipsize(text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid).trimEnd() + "…").width <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + "…";
}

/** One line if it fits, else two lines at the best word break, else cut off with "…". */
function fitLabel(name, available, size, twoLineSize) {
  ctx.font = `${size}px ${SERIF}`;
  if (ctx.measureText(name).width <= available) return { lines: [name], size };
  const parts = name.split(/\s+/);
  if (parts.length < 2) return { lines: [ellipsize(name, available)], size };
  ctx.font = `${twoLineSize}px ${SERIF}`;
  let best = null, bestW = Infinity;
  for (let k = 1; k < parts.length; k++) {
    const a = parts.slice(0, k).join(" "), b = parts.slice(k).join(" ");
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (w < bestW) { bestW = w; best = [a, b]; }
  }
  return { lines: best.map((l) => ellipsize(l, available)), size: twoLineSize };
}

function drawWheel() {
  const n = wheelItems.length;
  if (!n) return;
  const W = canvas.width, H = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  const radius = Math.min(W, H) / 2 - 2 * dpr;
  const sweep = (2 * Math.PI) / n;
  const rot = (rotation * Math.PI) / 180;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);

  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + i * sweep;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, start + sweep);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#202020" : "#2a2a2a";
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(200, 169, 106, 0.45)";
  ctx.lineWidth = 1.2 * dpr;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * sweep;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.stroke();
  }

  // names, right-aligned against the rim, between the SPIN button and the edge
  const size = (n > 8 ? 12 : 14) * dpr * 1.1;
  const twoLineSize = size * (n > 8 ? 0.9 : 0.95);
  const innerGap = Math.max(radius * 0.27, 50 * dpr);
  const outerEdge = radius - 10 * dpr;
  const available = outerEdge - innerGap;
  ctx.fillStyle = "#f2ede4";
  ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const mid = -Math.PI / 2 + (i + 0.5) * sweep;
    const fit = fitLabel(wheelItems[i].name, available, size, twoLineSize);
    ctx.save();
    ctx.rotate(mid);
    ctx.font = `${fit.size}px ${SERIF}`;
    const lh = fit.size * 1.08;
    const first = -(lh * (fit.lines.length - 1)) / 2;
    fit.lines.forEach((line, li) => {
      ctx.fillText(line, outerEdge - ctx.measureText(line).width, first + li * lh);
    });
    ctx.restore();
  }
  ctx.restore();

  // gold rim
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = "#c8a96a";
  ctx.lineWidth = 3 * dpr;
  ctx.stroke();
}

window.addEventListener("resize", () => { if (!$("wheel-ready").hidden) { sizeCanvas(); drawWheel(); } });

// cubic-bezier(0.15, 0.85, 0.25, 1): fast start, long graceful slowdown
function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const x = (t) => ((ax * t + bx) * t + cx) * t;
  const y = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (target) => {
    let t = target;
    for (let i = 0; i < 8; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (x(t) - target) / d;
      t = Math.min(1, Math.max(0, t));
    }
    return y(t);
  };
}
const ease = bezier(0.15, 0.85, 0.25, 1);

$("spin").addEventListener("click", () => {
  if (spinning || wheelItems.length < 2) return;
  spinning = true;
  $("spin").disabled = true;
  const n = wheelItems.length, sweep = 360 / n;
  const pick = Math.floor(Math.random() * n);
  const jitter = (Math.random() - 0.5) * sweep * 0.6;
  const landing = (((-(pick + 0.5) * sweep + jitter) % 360) + 360) % 360;
  const from = rotation;
  const to = from - (from % 360) + 360 * 6 + landing;
  const duration = 4200, t0 = performance.now();

  function frame(now) {
    const p = Math.min(1, (now - t0) / duration);
    rotation = from + (to - from) * ease(p);
    drawWheel();
    if (p < 1) return requestAnimationFrame(frame);
    setTimeout(() => {
      spinning = false;
      $("spin").disabled = false;
      show({ screen: "result", category: current.category, place: wheelItems[pick] });
    }, 600);
  }
  requestAnimationFrame(frame);
});

// ----- press and hold a slice to hide it -----

let pressTimer = null, pressStart = null;
const wrap = $("wheel-wrap");

function segmentAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist < 46 || dist > rect.width / 2) return -1; // on the SPIN button or outside
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const sweep = 360 / wheelItems.length;
  const unrotated = (((angle - rotation + 90) % 360) + 360) % 360;
  return Math.min(wheelItems.length - 1, Math.floor(unrotated / sweep));
}

wrap.addEventListener("pointerdown", (e) => {
  if (spinning || e.target !== canvas) return;
  pressStart = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    const i = segmentAt(pressStart.x, pressStart.y);
    if (i >= 0) {
      if (navigator.vibrate) navigator.vibrate(10);
      askToHide(wheelItems[i], () => loadWheel(current.category));
    }
  }, 550);
});
const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
wrap.addEventListener("pointerup", cancelPress);
wrap.addEventListener("pointercancel", cancelPress);
wrap.addEventListener("pointerleave", cancelPress);
wrap.addEventListener("pointermove", (e) => {
  if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 12) cancelPress();
});
wrap.addEventListener("contextmenu", (e) => e.preventDefault());

// ----- hide dialog -----

let dialogConfirm = null;
function askToHide(place, after) {
  $("dialog-text").textContent =
    `${place.name} won't appear on your wheel anymore, at any location. You can bring it back from Hidden places on the home screen.`;
  dialogConfirm = () => { Hidden.hide(place); after(); };
  $("dialog").hidden = false;
}
function closeDialog() { $("dialog").hidden = true; dialogConfirm = null; }
$("dialog-cancel").addEventListener("click", closeDialog);
$("dialog").addEventListener("click", (e) => { if (e.target === $("dialog")) closeDialog(); });
$("dialog-confirm").addEventListener("click", () => { const f = dialogConfirm; closeDialog(); if (f) f(); });

// ----- result -----

const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;

function renderResult() {
  const p = current.place;
  if (!p) return show({ screen: "home" }, false);
  const cat = CATEGORIES.find((c) => c.id === current.category) || CATEGORIES[0];
  $("result-label").textContent = cat.resultLabel;
  $("result-name").textContent = p.name;
  $("result-cuisine").textContent = p.cuisine
    ? p.cuisine.split(";").map((c) => c.trim().replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase())).join(" · ")
    : "";
  $("result-address").textContent = p.address || "";
  $("result-distance").textContent = `${(p.distance / 1609.344).toFixed(1)} miles away`;
  $("directions").href = isApple
    ? `https://maps.apple.com/?daddr=${p.lat},${p.lon}&q=${encodeURIComponent(p.name)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
}

// ----- hidden list -----

function renderHidden() {
  const ul = $("hidden-list");
  ul.innerHTML = "";
  for (const p of Hidden.list) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = p.name;
    const btn = document.createElement("button");
    btn.textContent = "RESTORE";
    btn.addEventListener("click", () => { Hidden.restore(p.id); renderHidden(); });
    li.append(name, btn);
    ul.appendChild(li);
  }
  const empty = Hidden.list.length === 0;
  $("hidden-empty").hidden = !empty;
  $("restore-all").hidden = empty;
}
$("restore-all").addEventListener("click", () => { Hidden.restoreAll(); renderHidden(); });

// ----- shared buttons -----

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "home") show({ screen: "home" });
  if (action === "spin-again") show({ screen: "wheel", category: current.category });
  if (action === "hide-result") {
    Hidden.hide(current.place);
    show({ screen: "wheel", category: current.category });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

history.replaceState({ screen: "home" }, "");
show({ screen: "home" }, false);
prefetch();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
