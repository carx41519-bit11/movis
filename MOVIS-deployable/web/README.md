# MOVIS web inventory monitor

The web app now includes Photo scan and Edit quantity for operators/administrators. A submitted still photo is analyzed once; selected edited quantities can optionally be added to stock or discarded. PHOTO-WORKFLOW.md documents the revised behavior; this supersedes the earlier read-only description below.

The web dashboard uses the existing MOVIS server and database. No separate website server, Node installation, or frontend build is required. It supports optional photo additions and manual quantity edits; return inspection remains in Android.

## Open your dashboard

Start the Python server as described in the main README. On that computer, visit:

```text
http://localhost:8080
```

On another computer or phone on the same Wi-Fi, use:

```text
http://YOUR_SERVER_LOCAL_IP:8080
```

Sign in with the account initialized on that database. Existing administrator, operator, and viewer accounts can all monitor inventory. Browser sessions are kept in memory and require sign-in again after a reload. The session token is not stored in browser storage; only the chosen low-stock threshold is saved on that browser.

When starting on another machine from the supplied source, keep the `web` folder beside `backend`. The server serves the dashboard at `/`; API endpoints retain their original paths for Android compatibility.

## Features

- Overview: total available units, distinct stocked products, low-stock item/location pairs, and returns waiting for inspection.
- Location summary: bar chart derived directly from the current stock records, including zero-stock locations.
- Stock watch: low/out-of-stock products using a user-selected quantity threshold. The threshold is a monitoring preference, not an item-specific replenishment policy.
- Inventory: search by product/SKU, filter by location, and filter low, empty, or available stock.
- Returns: quantities, destination locations, reasons, status, responsible users, and recorded dates.
- Stock activity: verified adjustments and restocked returns with signed changes, resulting balances, users, and dates.
- CSV: download complete inventory, returns, movements, or adjustment reports. Downloads include all report rows, independent of the active visual filters.
- Refresh: manual refresh plus polling every 15 seconds while the tab is visible; refresh immediately when returning to the tab.
- Connection failure: retain the last successful records and explicitly warn that they may be stale.
- Responsive layout: desktop dashboard and phone layout, both with sign-out controls.

The dashboard only shows stored records; it does not fabricate stock history or trends. Empty reports display useful empty states. A demo-mode banner explains that scanner detections are synthetic. All operational data API requests still require an authenticated MOVIS session even though the sign-in page and static assets are publicly accessible on the local server.

## Local preview supplied during development

A separate temporary demo server was started for this chat at `http://127.0.0.1:8080`. Its demonstration account is username `demo`, password `movis-demo-2026`. It contains fictional labeled inventory and returns, including a test restock. This is not the operational database, and the temporary preview may stop when the app session ends. These credentials do not apply to your newly initialized database.

For repeatable setup, use the normal database initializer, choose your own credentials, and optionally pass `--seed-demo`. Do not expose this development HTTP server to the public internet. An online deployment should use HTTPS and a production server, as described in the main design notes.

## Verification

19 Python tests passed, including authenticated API checks and dashboard static-asset/path restrictions. Browser checks passed for login/logout, totals, product search, stock filters, returns, empty history, CSV downloads, connection failure/recovery, and a shared-backend restock reflected in the dashboard. The mobile view was checked at 390-pixel width without page overflow. Desktop and mobile screenshots were visually reviewed. `../web-dashboard.png` shows the fictional preview data.
