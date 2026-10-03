# Current photo and manual stock workflow

This revision follows the user's clarification and supersedes the initial scanner-as-total-reconciliation design. YOLO analyzes one submitted photograph after the user chooses Analyze photo. There is no live-video inference. Dashboard polling refreshes stored records only.

## Android and web

1. Choose the destination location and take/select a photo of NEW incoming goods.
2. Choose Analyze photo. YOLO mode uses configured trained weights; demo mode displays explicitly synthetic results.
3. Review the boxes, select the item rows to include, and edit quantities. Exclude incorrect detections or select another registered item to correct identification.
4. Enter a reason or receipt reference.
5. Choose Add selected items to inventory and confirm, or Discard — do not add.

Adding increases stock: existing 10 + approved photo quantity 3 = total 13. Detection and discarding never change stock. Discarded scans remain in scan history without a stock transaction. All selected items commit together. The same scan record cannot be added twice; retries return the prior result.

Add only incoming goods that are not already recorded. Different photos of the same goods could still double-count stock; the system cannot identify physical duplicates across photographs. Items must be registered in the catalog and chosen stock location first. Unmapped classes cannot automatically create catalog entries. Actual catalog classes and warehouse-trained weights are still required for real recognition.

## Manual edits

Android Inventory and web Inventory now offer Edit quantity. Enter a corrected TOTAL available quantity and a reason, then save. This sets an absolute quantity, unlike additive photo entry. Administrators/operators can edit; viewers cannot. The server rejects edits if another action changed stock after the form opened. Refresh and reopen the form before retrying a stale edit.

Both actions save previous/new quantities, difference, reason, user, and timestamp. Web movements label Photo addition and Manual edit. Return inspection/restocking remains separate.

## API and migration

- `POST /scan-additions`: `{scan_id, items: [{item_id, quantity}], reason, confirmed: true, request_key}`. Positive quantities, atomic additions to current stock, unique scan commits, idempotent retries.
- `POST /manual-adjustments`: `{item_id, location_id, quantity, expected_version, reason, confirmed: true, request_key}`. Nonnegative absolute total, version check, and audit history.
- `/scans` continues to process only an uploaded image and never changes inventory.
- Legacy `/adjustments` full-count reconciliation remains for compatibility; it is no longer the scanner UI's default action.

Restart the updated backend to create the new `scan_commits` table automatically, including in existing databases. Refresh the browser to see Photo scan. Rebuild Android from the updated source for its revised screens.

## Verification

24 backend tests passed, including editable additive quantities, duplicate prevention, atomic rollback, concurrent additions, manual retries, and stale manual writes. Android Java source compilation passed. Browser checks passed for still-photo analysis, editable/excluded quantities, discard without stock writes, selective addition, manual editing, and mobile width. The test used synthetic demo detections. Real YOLO accuracy, Android APK packaging, and device testing remain pending.
