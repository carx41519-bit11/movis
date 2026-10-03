"use strict";
const $ = (id) => document.getElementById(id);
let token = "",
  role = "",
  timer = null,
  loading = false,
  generation = 0;
let state = {
  inventory: { items: [], locations: [], stock: [] },
  returns: [],
  movements: [],
  adjustments: [],
};
const names = {
  security: ["ACCOUNT SECURITY", "Protect your workspace"],
  scan: ["PHOTO SCAN", "Add inventory from a photo"],
  overview: ["OVERVIEW", "Inventory at a glance"],
  inventory: ["INVENTORY", "Inventory register"],
  returns: ["RETURNS", "Return monitoring"],
  activity: ["STOCK ACTIVITY", "Every stock movement"],
};
const format = new Intl.NumberFormat();
let threshold = 5;
try {
  const saved = Number(localStorage.getItem("movis-low-threshold"));
  if (
    localStorage.getItem("movis-low-threshold") !== null &&
    Number.isInteger(saved) &&
    saved >= 0 &&
    saved <= 1000000
  )
    threshold = saved;
} catch {}
$("threshold").value = threshold;
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function clear(id) {
  $(id).replaceChildren();
  return $(id);
}
function empty(target, title, detail) {
  const box = element("div", undefined, "empty");
  box.append(element("strong", title), element("span", detail));
  target.append(box);
}
function date(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
function badge(text, kind) {
  return element("span", text, "badge " + kind);
}
function product(name, sub) {
  const el = element("div", undefined, "product-cell");
  el.append(element("strong", name), element("small", sub));
  return el;
}
function table(target, headers, rows, emptyTitle, emptyDetail) {
  target.replaceChildren();
  if (!rows.length) return empty(target, emptyTitle, emptyDetail);
  const t = element("table");
  const head = element("thead"),
    hr = element("tr");
  for (const title of headers) {
    const th = element("th", title);
    th.scope = "col";
    hr.append(th);
  }
  head.append(hr);
  const body = element("tbody");
  for (const row of rows) {
    const tr = element("tr");
    for (const value of row) {
      const td = element("td");
      if (value instanceof Node) td.append(value);
      else td.textContent = value;
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(head, body);
  target.append(t);
}
async function api(path, body) {
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), path === '/scans' ? 120000 : 90000);
  const uncertainWrite =
    body !== undefined && path !== "/login"
      ? " The change may have been saved. Refresh inventory before submitting again."
      : "";
  try {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 401 && path !== "/login") signOut(false);
    const raw = await response.text();
    const context = " (" + path + ", HTTP " + response.status + ").";
    if (!raw.trim())
      throw new Error(
        "The server returned an empty response" +
          context +
          " Check that you opened the website through the MOVIS Python server." +
          uncertainWrite,
      );
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        "The server returned an incomplete or invalid response" +
          context +
          " Check the MOVIS server window for errors." +
          uncertainWrite,
      );
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error(
        "The server returned an unexpected response" + context + uncertainWrite,
      );
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "Could not complete the request" + context,
      );
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "The server took too long to respond. Check the connection and refresh." +
          uncertainWrite,
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the MOVIS server. Check the server address and connection." +
          uncertainWrite,
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function connection(connected) {
  $("connection-dot").className = "dot " + (connected ? "connected" : "stale");
  $("connection-text").textContent = connected
    ? "Server connected"
    : "Connection interrupted";
}
async function refresh() {
  if (loading || !token) return;
  loading = true;
  $("refresh").disabled = true;
  const run = generation;
  try {
    const [inventory, returns, movements, adjustments] = await Promise.all([
      api("/inventory"),
      api("/reports/returns"),
      api("/reports/movements"),
      api("/reports/adjustments"),
    ]);
    if (run !== generation || !token) return;
    state = {
      inventory,
      returns: returns.rows,
      movements: movements.rows,
      adjustments: adjustments.rows,
    };
    render();
    connection(true);
    $("last-updated").textContent =
      "Updated " +
      new Date().toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    $("app-error").hidden = true;
  } catch (error) {
    if (run !== generation || !token) return;
    connection(false);
    $("app-error").textContent =
      error.message + " Displayed records may be out of date.";
    $("app-error").hidden = false;
  } finally {
    if (run === generation) {
      loading = false;
      $("refresh").disabled = false;
    }
  }
}
function status(quantity) {
  return quantity === 0
    ? ["Out of stock", "out"]
    : quantity <= threshold
      ? ["Low stock", "low"]
      : ["Available", "healthy"];
}
function render() {
  const inv = state.inventory,
    stock = inv.stock;
  const pending = state.returns.filter(
    (r) => r.status === "pending inspection",
  );
  $("total-units").textContent = format.format(
    stock.reduce((sum, r) => sum + r.quantity, 0),
  );
  $("total-items").textContent = format.format(
    new Set(stock.filter((r) => r.quantity > 0).map((r) => r.item_id)).size,
  );
  $("catalog-meta").textContent = inv.items.length + " products in the catalog";
  $("low-count").textContent = stock.filter(
    (r) => r.quantity <= threshold,
  ).length;
  $("pending-count").textContent = pending.length;
  $("pending-meta").textContent =
    format.format(pending.reduce((sum, r) => sum + r.quantity, 0)) +
    " returned units awaiting inspection";
  $("demo-banner").hidden = inv.mode !== "demo";
  updateScanLocations();
  const current = $("location-filter").value;
  clear("location-filter").append(new Option("All locations", ""));
  for (const loc of inv.locations)
    $("location-filter").append(new Option(loc.name, String(loc.id)));
  if (inv.locations.some((l) => String(l.id) === current))
    $("location-filter").value = current;
  const totals = inv.locations.map((l) => ({
    ...l,
    quantity: stock
      .filter((s) => s.location_id === l.id)
      .reduce((a, s) => a + s.quantity, 0),
  }));
  const max = Math.max(1, ...totals.map((l) => l.quantity));
  const bars = clear("location-bars");
  if (!totals.length)
    empty(
      bars,
      "No locations yet",
      "Add warehouse locations through the Android administrator screen.",
    );
  for (const loc of totals) {
    const row = element("div", undefined, "bar-row");
    const meta = element("div", undefined, "bar-meta");
    meta.append(
      element("span", loc.name),
      element("strong", format.format(loc.quantity)),
    );
    const track = element("div", undefined, "bar-track"),
      fill = element("div", undefined, "bar-fill");
    fill.style.width = (loc.quantity / max) * 100 + "%";
    track.append(fill);
    row.append(meta, track);
    bars.append(row);
  }
  const watch = clear("stock-watch"),
    low = stock
      .filter((s) => s.quantity <= threshold)
      .sort((a, b) => a.quantity - b.quantity);
  if (!low.length)
    empty(
      watch,
      stock.length ? "Stock is above your threshold" : "No inventory yet",
      stock.length
        ? "No item locations currently need attention."
        : "Register stock through the Android app.",
    );
  for (const item of low.slice(0, 5)) {
    const row = element("div", undefined, "watch-row");
    row.append(
      product(item.name, item.location),
      badge(item.quantity + " units", item.quantity === 0 ? "out" : "low"),
    );
    watch.append(row);
  }
  if (low.length > 5)
    watch.append(
      element(
        "p",
        low.length - 5 + " more item locations in Inventory",
        "muted",
      ),
    );
  renderInventory();
  renderReturns();
  renderMovements("recent-table", state.movements.slice(0, 5));
  renderMovements("activity-table", state.movements);
  renderAdjustments();
}
function renderInventory() {
  const term = $("search").value.trim().toLowerCase(),
    loc = $("location-filter").value,
    filter = $("stock-filter").value;
  const rows = state.inventory.stock.filter(
    (s) =>
      (!term || (s.name + " " + s.sku).toLowerCase().includes(term)) &&
      (!loc || String(s.location_id) === loc) &&
      (filter === "all" ||
        (filter === "low" && s.quantity <= threshold) ||
        (filter === "out" && s.quantity === 0) ||
        (filter === "healthy" && s.quantity > threshold)),
  );
  $("inventory-count").textContent =
    rows.length + " of " + state.inventory.stock.length + " item locations";
  const writable = role === "admin" || role === "operator";
  const headers = [
    "Product / SKU",
    "Location",
    "Available units",
    "Stock status",
  ];
  if (writable) headers.push("");
  table(
    $("inventory-table"),
    headers,
    rows.map((s) => {
      const row = [
        product(s.name, s.sku),
        s.location,
        element("span", format.format(s.quantity), "number"),
        badge(...status(s.quantity)),
      ];
      if (writable) {
        const edit = element("button", "Edit quantity", "text-button");
        edit.addEventListener("click", () => openEdit(s));
        row.push(edit);
      }
      return row;
    }),
    "No matching inventory",
    state.inventory.stock.length
      ? "Try another search or filter."
      : "Create items and stock locations using the Android app.",
  );
}

function renderReturns() {
  const status = $("return-filter").value,
    rows = state.returns.filter((r) => !status || r.status === status);
  const kinds = {
    "pending inspection": "pending",
    accepted: "accepted",
    damaged: "damaged",
    "returned to available stock": "restocked",
  };
  table(
    $("returns-table"),
    [
      "Return",
      "Product",
      "Quantity",
      "Location",
      "Status",
      "Reason",
      "Recorded by",
      "Date",
    ],
    rows.map((r) => [
      "#" + r.id,
      r.name,
      format.format(r.quantity),
      r.location,
      badge(r.status, kinds[r.status]),
      element("span", r.reason, "reason"),
      r.username,
      date(r.created_at),
    ]),
    "No return records",
    status
      ? "No returns have this status."
      : "Returned goods recorded in Android will appear here.",
  );
}
function renderMovements(id, rows) {
  table(
    $(id),
    [
      "Product",
      "Location",
      "Change",
      "Balance",
      "Source",
      "Recorded by",
      "Date",
    ],
    rows.map((r) => [
      r.name,
      r.location,
      element(
        "span",
        (r.difference > 0 ? "+" : "") + r.difference,
        "number " +
          (r.difference > 0 ? "positive" : r.difference < 0 ? "negative" : ""),
      ),
      format.format(r.resulting_quantity),
      r.source_type === "return"
        ? "Restocked return #" + r.source_id
        : r.source_type === "photo addition"
          ? "Photo addition #" + r.source_id
          : r.source_type === "manual adjustment"
            ? "Manual edit #" + r.source_id
            : "Adjustment #" + r.source_id,
      r.username,
      date(r.created_at),
    ]),
    "No stock movements yet",
    "Confirmed adjustments and restocked returns will appear here.",
  );
}
function renderAdjustments() {
  const items = new Map(state.inventory.items.map((i) => [i.id, i.name])),
    locations = new Map(state.inventory.locations.map((l) => [l.id, l.name]));
  table(
    $("adjustment-table"),
    [
      "Adjustment",
      "Product",
      "Location",
      "Previous",
      "Verified",
      "Difference",
      "Reason",
      "Verified by",
      "Date",
    ],
    state.adjustments.map((a) => [
      "#" + a.id,
      items.get(a.item_id) || "Item #" + a.item_id,
      locations.get(a.location_id) || "Location #" + a.location_id,
      a.previous_quantity,
      a.verified_quantity,
      (a.difference > 0 ? "+" : "") + a.difference,
      element("span", a.reason, "reason"),
      a.username,
      date(a.created_at),
    ]),
    "No verified adjustments",
    "Counts verified and confirmed in Android will appear here.",
  );
}
function page(key) {
  if (!names[key]) return;
  for (const name of Object.keys(names))
    $(name + "-page").hidden = name !== key;
  document.querySelectorAll(".nav").forEach((b) => {
    const active = b.dataset.page === key;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("page-label").textContent = names[key][0];
  $("page-title").textContent = names[key][1];
}
async function signOut(revoke = true) {
  const old = token;
  try { sessionStorage.removeItem('movis-session'); } catch {}
  try { sessionStorage.removeItem('movis-last-active'); } catch {}
  $('security-form').reset();
  token = "";
  role = "";
  resetPhoto();
  if ($("edit-dialog").open) $("edit-dialog").close();
  generation++;
  loading = false;
  clearInterval(timer);
  timer = null;
  $("app").hidden = true;
  $("login-view").hidden = false;
  $("password").value = "";
  $("login-error").textContent = "";
  state = {
    inventory: { items: [], locations: [], stock: [] },
    returns: [],
    movements: [],
    adjustments: [],
  };
  if (revoke && old)
    try {
      await fetch("/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + old,
        },
        body: "{}",
      });
    } catch {}
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("login-button").disabled = true;
  $("login-error").textContent = "";
  try {
    const result = await api("/login", {
      username: $("username").value.trim(),
      password: $("password").value,
    });
    token = result.token;
    try { sessionStorage.setItem('movis-session', token); } catch {}
    await showSession(result);
  } catch (error) {
    $("login-error").textContent = error.message;
  } finally {
    $("login-button").disabled = false;
  }
});
async function showSession(result) {
    touchSession();
    role = result.role;
    document.querySelectorAll('[data-page="scan"]').forEach(button => {
      button.hidden = role === "viewer";
    });
    generation++;
    $("password").value = "";
    $("account-name").textContent = result.username;
    $("account-role").textContent = result.role;
    $("avatar").textContent = result.username.slice(0, 1).toUpperCase();
    $("login-view").hidden = true;
    $("app").hidden = false;
    page("overview");
    await refresh();
    clearInterval(timer);
    if (token) timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 15000);
}
document
  .querySelectorAll("[data-page]")
  .forEach((button) =>
    button.addEventListener("click", () => page(button.dataset.page)),
  );
$("refresh").addEventListener("click", refresh);
$("logout").addEventListener("click", () => signOut());
for (const id of ["search", "location-filter", "stock-filter"])
  $(id).addEventListener(id === "search" ? "input" : "change", renderInventory);
$("return-filter").addEventListener("change", renderReturns);
$("threshold").addEventListener("input", () => {
  const value = Number($("threshold").value);
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1000000 ||
    $("threshold").value === ""
  )
    return;
  threshold = value;
  try {
    localStorage.setItem("movis-low-threshold", String(value));
  } catch {}
  render();
});
for (const kind of ["inventory", "returns", "movements", "adjustments"])
  $("export-" + kind).addEventListener("click", async () => {
    const button = $("export-" + kind);
    button.disabled = true;
    try {
      const response = await fetch("/reports/" + kind + "?format=csv", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401) signOut(false);
        throw new Error("Could not export report. Sign in again or refresh.");
      }
      const url = URL.createObjectURL(await response.blob()),
        link = element("a");
      link.href = url;
      link.download =
        "movis-" + kind + "-" + new Date().toISOString().slice(0, 10) + ".csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      $("app-error").hidden = false;
      $("app-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
$("logout-mobile").addEventListener("click", () => signOut());
let editing = null,
  editKey = null,
  photoImage = null,
  photoData = "",
  photoScan = null,
  photoKey = null,
  photoBusy = false;
function openEdit(stock) {
  editing = { ...stock };
  editKey = crypto.randomUUID();
  $("edit-description").textContent =
    stock.name +
    " · " +
    stock.location +
    " · Currently " +
    stock.quantity +
    " units";
  $("edit-quantity").value = stock.quantity;
  $("edit-reason").value = "";
  $("edit-error").textContent = "";
  $("edit-dialog").showModal();
}
$("edit-cancel").addEventListener("click", () => $("edit-dialog").close());
$("edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editing) return;
  const quantity = Number($("edit-quantity").value),
    reason = $("edit-reason").value.trim();
  if (!Number.isSafeInteger(quantity) || quantity < 0 || !reason) return;
  const payload = {
    item_id: editing.item_id,
    location_id: editing.location_id,
    quantity,
    expected_version: editing.version,
    reason,
    confirmed: true,
    request_key: editKey,
  };
  $("edit-save").disabled = true;
  try {
    await api("/manual-adjustments", payload);
    $("edit-dialog").close();
    await refresh();
  } catch (error) {
    $("edit-error").textContent = error.message;
  } finally {
    $("edit-save").disabled = false;
  }
});
function updateScanLocations() {
  const selected = $("scan-location").value;
  clear("scan-location");
  for (const loc of state.inventory.locations)
    $("scan-location").append(new Option(loc.name, String(loc.id)));
  if (state.inventory.locations.some((l) => String(l.id) === selected))
    $("scan-location").value = selected;
}
function resetPhoto() {
  photoImage = null;
  photoData = "";
  photoScan = null;
  photoKey = null;
  $("scan-photo").value = "";
  $("scan-canvas").hidden = true;
  $("scan-review").hidden = true;
  $("analyze-photo").disabled = true;
  $("scan-message").textContent = "";
  $("scan-error").textContent = "";
}
function drawPhoto(detections = []) {
  if (!photoImage) return;
  const canvas = $("scan-canvas");
  canvas.width = photoImage.width;
  canvas.height = photoImage.height;
  const context = canvas.getContext("2d");
  context.drawImage(photoImage, 0, 0);
  context.strokeStyle = "#00b69c";
  context.fillStyle = "#00b69c";
  context.lineWidth = Math.max(2, canvas.width / 400);
  context.font = Math.max(14, canvas.width / 65) + "px system-ui";
  for (const d of detections) {
    const [x, y, r, b] = d.box;
    context.strokeRect(
      x * canvas.width,
      y * canvas.height,
      (r - x) * canvas.width,
      (b - y) * canvas.height,
    );
    context.fillText(
      d.name + " " + Math.round(d.confidence * 100) + "%",
      x * canvas.width,
      Math.max(20, y * canvas.height - 6),
    );
  }
  canvas.hidden = false;
}
$("scan-photo").addEventListener("change", async () => {
  if (photoBusy) return;
  const file = $("scan-photo").files[0];
  photoScan = null;
  photoKey = null;
  $("scan-review").hidden = true;
  $("scan-error").textContent = "";
  if (!file) return resetPhoto();
  if (file.size > 20 * 1024 * 1024) {
    resetPhoto();
    $("scan-message").textContent = "Choose a photo smaller than 20 MB.";
    return;
  }
  photoBusy = true;
  $("analyze-photo").disabled = true;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    photoData = canvas.toDataURL("image/jpeg", 0.85);
    photoImage = new Image();
    photoImage.src = photoData;
    await photoImage.decode();
    drawPhoto();
    $("scan-message").textContent =
      "Photo ready. Choose Analyze photo to recognize items.";
    $("analyze-photo").disabled = false;
  } catch {
    resetPhoto();
    $("scan-message").textContent =
      "This photo could not be opened. Try a JPEG or PNG image.";
  } finally {
    photoBusy = false;
    URL.revokeObjectURL(url);
  }
});
$("scan-location").addEventListener("change", () => {
  photoScan = null;
  photoKey = null;
  $("scan-review").hidden = true;
  $("scan-message").textContent = photoData
    ? "Destination changed. Analyze the photo again."
    : "";
});
$("analyze-photo").addEventListener("click", async () => {
  if (photoBusy || !photoData) return;
  const location = Number($("scan-location").value);
  if (!location) {
    $("scan-message").textContent =
      "Create a location using the Android administrator screen first.";
    return;
  }
  photoBusy = true;
  $("analyze-photo").disabled = true;
  $("scan-photo").disabled = true;
  $("scan-location").disabled = true;
  $("scan-review").hidden = true;
  $("scan-message").textContent = "Analyzing this photo…";
  try {
    const scan = await api("/scans", {
      location_id: location,
      image: photoData.split(",")[1],
    });
    photoScan = scan;
    photoKey = crypto.randomUUID();
    drawPhoto(scan.detections);
    const counts = new Map();
    for (const d of scan.detections)
      if (d.item_id) counts.set(d.item_id, (counts.get(d.item_id) || 0) + 1);
    const lines = clear("scan-lines");
    const items = new Map(state.inventory.items.map((i) => [i.id, i]));
    for (const row of scan.snapshot) {
      const item = items.get(row.item_id),
        line = element("div", undefined, "scan-line"),
        select = document.createElement("input");
      select.type = "checkbox";
      select.dataset.item = String(row.item_id);
      select.checked = (counts.get(row.item_id) || 0) > 0;
      const label = element("label");
      label.append(
        select,
        document.createTextNode(item ? item.name : "Item #" + row.item_id),
      );
      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.min = "1";
      quantity.step = "1";
      quantity.value = String(counts.get(row.item_id) || 0);
      quantity.dataset.quantity = String(row.item_id);
      quantity.setAttribute(
        "aria-label",
        "Quantity to add for " + (item ? item.name : "item"),
      );
      line.append(label, element("span", "Quantity to add"), quantity);
      lines.append(line);
    }
    const unknown = scan.detections
      .filter((d) => !d.item_id)
      .map((d) => d.name);
    $("scan-message").textContent =
      scan.warning +
      (unknown.length
        ? " Unmapped classes: " +
          [...new Set(unknown)].join(", ") +
          ". Register these before adding."
        : "");
    $("scan-reason").value = "";
    $("scan-error").textContent = "";
    $("scan-review").hidden = false;
  } catch (error) {
    $("scan-message").textContent = error.message;
  } finally {
    photoBusy = false;
    $("analyze-photo").disabled = false;
    $("scan-photo").disabled = false;
    $("scan-location").disabled = false;
  }
});
$("discard-photo").addEventListener("click", () => {
  if (!photoBusy) resetPhoto();
});
$("scan-review").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (photoBusy || !photoScan) return;
  const items = [];
  for (const check of $("scan-lines").querySelectorAll(
    "input[type=checkbox]:checked",
  )) {
    const quantity = Number(
      $("scan-lines").querySelector(
        '[data-quantity="' + check.dataset.item + '"]',
      ).value,
    );
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      $("scan-error").textContent =
        "Selected quantities must be positive whole numbers.";
      return;
    }
    items.push({ item_id: Number(check.dataset.item), quantity });
  }
  if (!items.length) {
    $("scan-error").textContent =
      "Select an item to add, or discard this photo.";
    return;
  }
  const reason = $("scan-reason").value.trim();
  if (!reason) return;
  const total = items.reduce((sum, i) => sum + i.quantity, 0);
  if (
    !confirm(
      "Add " +
        total +
        " NEW units to inventory? Existing stock will increase by these quantities.",
    )
  )
    return;
  photoBusy = true;
  $("add-photo").disabled = true;
  $("discard-photo").disabled = true;
  try {
    await api("/scan-additions", {
      scan_id: photoScan.id,
      items,
      reason,
      confirmed: true,
      request_key: photoKey,
    });
    resetPhoto();
    $("scan-message").textContent = total + " units added to inventory.";
    await refresh();
  } catch (error) {
    $("scan-error").textContent = error.message;
  } finally {
    photoBusy = false;
    $("add-photo").disabled = false;
    $("discard-photo").disabled = false;
  }
});

async function restoreSession() {
  try { token = sessionStorage.getItem('movis-session') || ''; } catch { return; }
  if (!token) return;
  try { lastActive = Number(sessionStorage.getItem('movis-last-active')) || Date.now(); } catch {}
  if (checkIdle()) return;
  $('login-button').disabled = true;
  try {
    const account = await api('/session');
    await showSession(account);
  } catch (error) {
    $('login-error').textContent = error.message;
  } finally {
    $('login-button').disabled = false;
  }
}

const IDLE_LIMIT = 15 * 60 * 1000;
let lastActive = Date.now();
function touchSession() {
  lastActive = Date.now();
  if (token) try { sessionStorage.setItem('movis-last-active', String(lastActive)); } catch {}
}
function checkIdle() {
  if (token && Date.now() - lastActive >= IDLE_LIMIT) {
    signOut();
    $('login-error').textContent = 'Signed out after 15 minutes of inactivity. Sign in to continue.';
    return true;
  }
  return false;
}
for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel'])
  document.addEventListener(event, () => { if (!checkIdle()) touchSession(); }, { passive: true });
document.addEventListener('pointermove', () => { if (!checkIdle() && Date.now()-lastActive>10000) touchSession(); }, { passive: true });
setInterval(checkIdle, 10000);
document.addEventListener('visibilitychange', checkIdle);
async function secureAccount(action) {
  const current = $('security-current').value, password = $('security-new').value;
  $('security-error').textContent = '';
  if (!current) { $('security-current').reportValidity(); return; }
  if (action === 'change_password' && (password.length < 12 || password.length > 128 || password !== $('security-confirm').value)) {
    $('security-error').textContent = 'Use 12–128 characters and make sure the new passwords match.'; return;
  }
  if (action === 'revoke_sessions' && !confirm('Sign out this browser and every device using your account?')) return;
  $('change-password').disabled = $('revoke-sessions').disabled = true;
  try {
    const result = await api('/account/security', { action, current_password: current, new_password: password });
    await signOut(false);
    $('login-error').textContent = result.message;
  } catch (error) { $('security-error').textContent = error.message; }
  finally { $('change-password').disabled = $('revoke-sessions').disabled = false; }
}
$('security-form').addEventListener('submit', event => { event.preventDefault(); secureAccount('change_password'); });
$('revoke-sessions').addEventListener('click', () => secureAccount('revoke_sessions'));
restoreSession();
