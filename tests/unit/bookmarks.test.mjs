// tests/unit/bookmarks.test.mjs
import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const db = require('../../src/db/index.js');
const bookmarksService = require('../../src/modules/bookmarks/bookmarks.service.js');

describe('bookmarks.service unit tests', () => {
  let doc1Id, doc2Id;

  beforeAll(() => {
    // Insert test documents into DB
    db.exec(`
      INSERT OR REPLACE INTO documents 
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
      VALUES 
      ('/tmp/doc1.txt', 'doc1.txt', 'txt', 10, datetime('now'), 1, '20230101', '/tmp', 'txt', 'doc1', 1, datetime('now')),
      ('/tmp/doc2.txt', 'doc2.txt', 'txt', 20, datetime('now'), 1, '20230101', '/tmp', 'txt', 'doc2', 1, datetime('now'))
    `);

    doc1Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/doc1.txt').id;
    doc2Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/doc2.txt').id;
  });

  beforeEach(() => {
    db.exec('DELETE FROM bookmark_items; DELETE FROM bookmark_groups;');
  });

  test('createGroup rejects empty name and duplicate name', async () => {
    await expect(bookmarksService.createGroup({ name: '' })).rejects.toThrow('INVALID_GROUP_NAME');
    await expect(bookmarksService.createGroup({ name: '   ' })).rejects.toThrow('INVALID_GROUP_NAME');

    await bookmarksService.createGroup({ name: 'Group A' });
    await expect(bookmarksService.createGroup({ name: 'Group A' })).rejects.toThrow('GROUP_NAME_EXISTS');
  });

  test('createGroup accepts default color when not provided', async () => {
    const group = await bookmarksService.createGroup({ name: 'Default Color Group' });
    expect(group.color).toBe('#6366f1');
  });

  test('addItemToGroup rejects document that does not exist', async () => {
    const group = await bookmarksService.createGroup({ name: 'My Group' });
    await expect(bookmarksService.addItemToGroup(group.id, 999999)).rejects.toThrow('DOC_NOT_FOUND');
  });

  test('addItemToGroup rejects duplicate (group_id, document_id)', async () => {
    const group = await bookmarksService.createGroup({ name: 'Unique Items Group' });
    await bookmarksService.addItemToGroup(group.id, doc1Id);
    await expect(bookmarksService.addItemToGroup(group.id, doc1Id)).rejects.toThrow('ALREADY_EXISTS');
  });

  test('deleteGroup cascades and removes all bookmark_items', async () => {
    const group = await bookmarksService.createGroup({ name: 'Cascade Group' });
    await bookmarksService.addItemToGroup(group.id, doc1Id);
    await bookmarksService.addItemToGroup(group.id, doc2Id);

    const itemsBefore = await bookmarksService.listGroupItems(group.id);
    expect(itemsBefore.length).toBe(2);

    const delRes = await bookmarksService.deleteGroup(group.id);
    expect(delRes.deleted).toBe(true);

    const itemsAfter = await bookmarksService.listGroupItems(group.id);
    expect(itemsAfter.length).toBe(0);
  });

  test('listGroups returns the correct item_count', async () => {
    const group1 = await bookmarksService.createGroup({ name: 'G1' });
    const group2 = await bookmarksService.createGroup({ name: 'G2' });

    await bookmarksService.addItemToGroup(group1.id, doc1Id);
    await bookmarksService.addItemToGroup(group1.id, doc2Id);

    const groups = await bookmarksService.listGroups();
    const g1 = groups.find((g) => g.id === group1.id);
    const g2 = groups.find((g) => g.id === group2.id);

    expect(g1.item_count).toBe(2);
    expect(g2.item_count).toBe(0);
  });

  test('getDocumentGroups returns the correct group_id list for a document', async () => {
    const group1 = await bookmarksService.createGroup({ name: 'G1' });
    const group2 = await bookmarksService.createGroup({ name: 'G2' });

    await bookmarksService.addItemToGroup(group1.id, doc1Id);
    await bookmarksService.addItemToGroup(group2.id, doc1Id);

    const groupIds = await bookmarksService.getDocumentGroups(doc1Id);
    expect(groupIds).toContain(group1.id);
    expect(groupIds).toContain(group2.id);
    expect(groupIds.length).toBe(2);
  });

  describe('outdated bookmark detection & updateItemToLatest', () => {
    let v450Id, v451Id, orphanId;

    beforeAll(() => {
      db.exec(`
        INSERT OR REPLACE INTO documents 
        (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
        VALUES 
        ('/tmp/Design_Doc_V450.xlsx', 'Design_Doc_V450.xlsx', 'xlsx', 100, datetime('now'), 450, '2026-09-01', '/docs', 'xlsx', 'design_doc', 0, datetime('now')),
        ('/tmp/Design_Doc_V451.xlsx', 'Design_Doc_V451.xlsx', 'xlsx', 120, datetime('now'), 451, '2026-09-15', '/docs', 'xlsx', 'design_doc', 1, datetime('now')),
        ('/tmp/Orphan_V100.xlsx', 'Orphan_V100.xlsx', 'xlsx', 80, datetime('now'), 100, '2025-01-01', '/docs', 'xlsx', 'orphan_doc', 0, datetime('now'))
      `);

      v450Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/Design_Doc_V450.xlsx').id;
      v451Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/Design_Doc_V451.xlsx').id;
      orphanId = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/Orphan_V100.xlsx').id;
    });

    test('listGroupItems returns is_outdated: false when document is latest', async () => {
      const group = await bookmarksService.createGroup({ name: 'Latest Group' });
      await bookmarksService.addItemToGroup(group.id, v451Id);

      const items = await bookmarksService.listGroupItems(group.id);
      expect(items.length).toBe(1);
      expect(items[0].is_outdated).toBe(false);
      expect(items[0].latest_sibling).toBeNull();
    });

    test('listGroupItems returns is_outdated: true + latest_sibling populated when newer version exists', async () => {
      const group = await bookmarksService.createGroup({ name: 'Outdated Group' });
      await bookmarksService.addItemToGroup(group.id, v450Id);

      const items = await bookmarksService.listGroupItems(group.id);
      expect(items.length).toBe(1);
      expect(items[0].is_outdated).toBe(true);
      expect(items[0].latest_sibling).not.toBeNull();
      expect(items[0].latest_sibling.id).toBe(v451Id);
      expect(items[0].latest_sibling.version_num).toBe(451);
      expect(items[0].latest_sibling.version_date).toBe('2026-09-15');
    });

    test('listGroupItems returns latest_sibling: null when no sibling exists (orphan file)', async () => {
      const group = await bookmarksService.createGroup({ name: 'Orphan Group' });
      await bookmarksService.addItemToGroup(group.id, orphanId);

      const items = await bookmarksService.listGroupItems(group.id);
      expect(items.length).toBe(1);
      expect(items[0].is_outdated).toBe(true);
      expect(items[0].latest_sibling).toBeNull();
    });

    test('updateItemToLatest updates document_id correctly and preserves note', async () => {
      const group = await bookmarksService.createGroup({ name: 'Update Group' });
      const { item_id } = await bookmarksService.addItemToGroup(group.id, v450Id, 'Important doc note');

      const updated = await bookmarksService.updateItemToLatest(item_id);
      expect(updated.item_id).toBe(item_id);
      expect(updated.document.id).toBe(v451Id);
      expect(updated.note).toBe('Important doc note');
      expect(updated.is_outdated).toBe(false);

      // Verify in DB
      const items = await bookmarksService.listGroupItems(group.id);
      expect(items[0].document.id).toBe(v451Id);
      expect(items[0].is_outdated).toBe(false);
    });

    test('updateItemToLatest throws NO_LATEST_SIBLING when no sibling exists', async () => {
      const group = await bookmarksService.createGroup({ name: 'No Sibling Group' });
      const { item_id } = await bookmarksService.addItemToGroup(group.id, orphanId);

      await expect(bookmarksService.updateItemToLatest(item_id)).rejects.toThrow('NO_LATEST_SIBLING');
    });

    test('updateItemToLatest throws ALREADY_IN_GROUP and deletes current item when latest version is already in group', async () => {
      const group = await bookmarksService.createGroup({ name: 'Conflict Group' });
      // Add latest version (v451) to group
      const latestItem = await bookmarksService.addItemToGroup(group.id, v451Id);
      // Add outdated version (v450) to group
      const outdatedItem = await bookmarksService.addItemToGroup(group.id, v450Id);

      let caughtErr = null;
      try {
        await bookmarksService.updateItemToLatest(outdatedItem.item_id);
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).not.toBeNull();
      expect(caughtErr.message).toBe('ALREADY_IN_GROUP');
      expect(caughtErr.existingItemId).toBe(latestItem.item_id);

      // Verify that the outdated item was deleted to avoid duplicate
      const items = await bookmarksService.listGroupItems(group.id);
      expect(items.length).toBe(1);
      expect(items[0].item_id).toBe(latestItem.item_id);
    });

    test('countOutdated counts outdated items across all groups', async () => {
      const g1 = await bookmarksService.createGroup({ name: 'Count G1' });
      const g2 = await bookmarksService.createGroup({ name: 'Count G2' });

      await bookmarksService.addItemToGroup(g1.id, v450Id); // outdated
      await bookmarksService.addItemToGroup(g1.id, v451Id); // latest
      await bookmarksService.addItemToGroup(g2.id, orphanId); // outdated

      const { count } = await bookmarksService.countOutdated();
      expect(count).toBe(2);
    });
  });
});
