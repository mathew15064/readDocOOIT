# Module: Bookmark Groups

## Purpose
Manage categorized document bookmarks using groups/categories with color coding and custom notes.

## Schema
- `bookmark_groups`: `id`, `name`, `description`, `color`, `sort_order`, `created_at`, `updated_at`
- `bookmark_items`: `id`, `group_id`, `document_id`, `note`, `created_at` (UNIQUE constraint on `(group_id, document_id)`)

## Public API (`bookmarks.service.js`)
- `listGroups()`: Returns groups with `item_count`
- `createGroup({ name, description, color })`: Validates name & color hex
- `updateGroup(id, { name, description, color, sort_order })`: Updates group properties
- `deleteGroup(id)`: Cascades deletion to child items
- `listGroupItems(groupId)`: Returns files in group joined with `documents`
- `addItemToGroup(groupId, documentId, note)`: Adds doc to group (checks duplicates)
- `removeItem(itemId)`: Removes file from group
- `updateItemNote(itemId, note)`: Updates note
- `getDocumentGroups(documentId)`: Returns list of group IDs for document

## Endpoints
- `GET /api/bookmark-groups`: List all groups
- `POST /api/bookmark-groups`: Create a new group (409 on duplicate name)
- `PATCH /api/bookmark-groups/:id`: Update group metadata
- `DELETE /api/bookmark-groups/:id`: Delete group and cascade items
- `GET /api/bookmark-groups/:id/items`: List items in a group
- `POST /api/bookmark-groups/:id/items`: Add file to group (409 if already present)
- `DELETE /api/bookmark-items/:id`: Remove file from group
- `PATCH /api/bookmark-items/:id`: Update note
- `GET /api/documents/:docId/bookmark-groups`: Get groups associated with document

## UI Flow
- Accordion sidebar with expand/collapse, color dots, file count, and `⋯` manage menu.
- Responsive layout: `< 1024px` renders as an overlay drawer with backdrop blur; `1024px-1280px` is `w-72`; `≥ 1280px` is `w-96`.
- 📌 icon on each document table row indicating group status (color + count).
- "Add to Bookmark" modal allowing existing group selection or inline group creation.
- **Bookmark Group Full View Modal (Task 5.4)**:
  - Triggered by clicking the bookmark group name in the sidebar (chevron toggles accordion).
  - Shows full-screen modal with all items in the group:
    - Search input: in-group search across document name and item note.
    - Sort dropdown: Name (A-Z), Version Date (newest), Added (newest).
    - Filter dropdown: All / Outdated only / Has note.
    - Selection & Bulk actions: select-all checkbox, individual checkboxes, "Remove Selected", and "Update All to Latest".
    - Inline editable note: clicking note cell edits text, blurs to save via `PATCH /api/bookmark-items/:id`.
    - Right-click on any row triggers the context menu.
- **Bookmark Item Context Menu (Task 5.3)**:
  - Right-clicking any bookmark item opens the context menu:
    - Open, Reveal in folder, Preview in browser, Version history, Copy file path.
    - If outdated: "Update to Latest" action.
    - "Remove from Group" (danger styling).
- **Collapsible Bookmark Filter**:
  - `[🔍 Filter]` button in the sidebar header with active filter counter badge (e.g. `Filter (2)`).
  - Search text (case-insensitive across file names and notes), group dropdown, "Show only outdated" toggle, "Show only with notes" toggle, and "Clear" action.
  - Groups with 0 matching items are hidden unless the group name itself matches.
- **Version History Integration**:
  - Clicking any bookmark item name opens the Version History Modal with `?currentId=<item's document_id>`, highlighting the bookmarked version with `[CURRENT ← bookmarked]`.
- Native HTML5 `<input type="color">` for color selection.
- All modals protect against backdrop click dismissal per ADR-009 / ADR-020.

## Outdated Bookmark Detection

### Logic
When documents are re-scanned and newer versions are added, previous versions have `is_latest = 0`.
When listing items for a bookmark group (`listGroupItems(groupId)`):
1. Subquery matches `documents d2` with same `base_name` + `module_path` where `is_latest = 1` as `latest_sibling_id`.
2. For each item where `d.is_latest === 0` and `latest_sibling_id` exists (and != `d.id`), fetches the latest sibling record (`id, file_name, file_path, version_num, version_date`).
3. Returned item structure:
   - `is_outdated`: `true` if `document.is_latest === 0`, else `false`.
   - `latest_sibling`: object with latest version details, or `null` if not outdated or orphan file.

`updateItemToLatest(itemId)`:
1. Loads current item and document details (`base_name`, `module_path`).
2. Finds latest sibling (`is_latest = 1`, same `base_name`, same `module_path`).
3. Throws `NO_LATEST_SIBLING` if no sibling found.
4. Checks `UNIQUE(group_id, new_document_id)`. If target document is already in the group, deletes the current item and throws `ALREADY_IN_GROUP` with `existingItemId` (avoids duplicate).
5. Updates `bookmark_items.document_id` to `latestSibling.id` preserving the existing note.

`countOutdated()`:
Returns `{ count: number }` representing the total count of outdated bookmark items across all groups.

### Endpoints
- `GET /api/bookmark-items/outdated-count`: Returns `{ count: number }`
- `POST /api/bookmark-items/:id/update-to-latest`: Updates bookmark item to latest sibling document.
  - `404`: Item not found or `NO_LATEST_SIBLING`.
  - `409`: `ALREADY_IN_GROUP` with `existingItemId`.

### UI
- **Sidebar Header**: Displays `⚠️ {count} outdated bookmark(s)` (clickable filter) and a toggle button `[Show only outdated]`.
- **Bookmark Items**: Outdated items show ⚠️ icon, `[Outdated]` badge (`bg-orange-500/20 text-orange-400`), and a sub-row:
  ```
  Newer: V451_20260915 (2026-09-15)
  [Open Latest]  [Update]
  ```
  - `[Open Latest]`: Opens latest document via `POST /api/documents/:id/open` without modifying bookmark.
  - `[Update]`: Calls `POST /api/bookmark-items/:id/update-to-latest` and refreshes the group.
- **Documents List**: Any document row with `doc.is_latest === 0` displays a ⚠️ icon with tooltip `"Newer version available"`.
