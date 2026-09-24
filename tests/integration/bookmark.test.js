// tests/integration/bookmark.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const app = require('../../src/app.js');
const db = require('../../src/db/index.js');

describe('Bookmark Groups API Integration Tests', () => {
  let doc1Id, doc2Id, doc3Id;

  beforeAll(() => {
    db.exec(`
      INSERT OR REPLACE INTO documents 
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
      VALUES 
      ('/tmp/doc_test1.pdf', 'doc_test1.pdf', 'pdf', 100, datetime('now'), 1, '20230101', '/tmp', 'pdf', 'doc1', 1, datetime('now')),
      ('/tmp/doc_test2.pdf', 'doc_test2.pdf', 'pdf', 100, datetime('now'), 1, '20230101', '/tmp', 'pdf', 'doc2', 1, datetime('now')),
      ('/tmp/doc_test3.pdf', 'doc_test3.pdf', 'pdf', 100, datetime('now'), 1, '20230101', '/tmp', 'pdf', 'doc3', 1, datetime('now'))
    `);

    doc1Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/doc_test1.pdf').id;
    doc2Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/doc_test2.pdf').id;
    doc3Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/doc_test3.pdf').id;
  });

  it('runs full CRUD flow: create group -> add 3 items -> list -> remove 1 -> delete group', async () => {
    // 1. Create group
    const createRes = await request(app)
      .post('/api/bookmark-groups')
      .send({ name: 'Integration Group', color: '#10b981', description: 'Test group' });
    expect(createRes.status).toBe(201);
    const groupId = createRes.body.id;
    expect(createRes.body.name).toBe('Integration Group');
    expect(createRes.body.color).toBe('#10b981');

    // 2. Add 3 items
    const item1 = await request(app).post(`/api/bookmark-groups/${groupId}/items`).send({ documentId: doc1Id, note: 'Item 1 note' });
    expect(item1.status).toBe(201);
    const item1Id = item1.body.item_id;

    const item2 = await request(app).post(`/api/bookmark-groups/${groupId}/items`).send({ documentId: doc2Id });
    expect(item2.status).toBe(201);

    const item3 = await request(app).post(`/api/bookmark-groups/${groupId}/items`).send({ documentId: doc3Id });
    expect(item3.status).toBe(201);

    // 3. List items in group
    const listRes = await request(app).get(`/api/bookmark-groups/${groupId}/items`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(3);
    expect(listRes.body[0].document.file_name).toBe('doc_test1.pdf');

    // 4. Verify document bookmark groups endpoint
    const docGroupsRes = await request(app).get(`/api/documents/${doc1Id}/bookmark-groups`);
    expect(docGroupsRes.status).toBe(200);
    expect(docGroupsRes.body.some((g) => g.group_id === groupId)).toBe(true);

    // 5. Remove 1 item
    const remRes = await request(app).delete(`/api/bookmark-items/${item1Id}`);
    expect(remRes.status).toBe(200);
    expect(remRes.body.deleted).toBe(true);

    const afterRemList = await request(app).get(`/api/bookmark-groups/${groupId}/items`);
    expect(afterRemList.body.length).toBe(2);

    // 6. Delete group and verify cascade
    const delGroupRes = await request(app).delete(`/api/bookmark-groups/${groupId}`);
    expect(delGroupRes.status).toBe(200);
    expect(delGroupRes.body.deleted).toBe(true);

    const finalItemsRes = await request(app).get(`/api/bookmark-groups/${groupId}/items`);
    expect(finalItemsRes.body.length).toBe(0);
  });

  it('POST /api/bookmark-groups with duplicate name returns 409', async () => {
    const res1 = await request(app).post('/api/bookmark-groups').send({ name: 'Duplicate Group' });
    expect(res1.status).toBe(201);

    const res2 = await request(app).post('/api/bookmark-groups').send({ name: 'Duplicate Group' });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('Group name already exists');
  });

  it('POST /api/bookmark-groups/:id/items with existing doc returns 409', async () => {
    const groupRes = await request(app).post('/api/bookmark-groups').send({ name: 'Existing Doc Group' });
    const groupId = groupRes.body.id;

    const res1 = await request(app).post(`/api/bookmark-groups/${groupId}/items`).send({ documentId: doc1Id });
    expect(res1.status).toBe(201);

    const res2 = await request(app).post(`/api/bookmark-groups/${groupId}/items`).send({ documentId: doc1Id });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('Document already in this group');
  });

  describe('Outdated Bookmark Detection Integration', () => {
    let oldDocId, newDocId;

    beforeAll(() => {
      db.exec(`
        INSERT OR REPLACE INTO documents 
        (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
        VALUES 
        ('/tmp/Design_Doc_V450_20260901.xlsx', 'Design_Doc_V450_20260901.xlsx', 'xlsx', 100, datetime('now'), 450, '2026-09-01', '/modules/design', 'xlsx', 'design_doc', 0, datetime('now')),
        ('/tmp/Design_Doc_V451_20260915.xlsx', 'Design_Doc_V451_20260915.xlsx', 'xlsx', 120, datetime('now'), 451, '2026-09-15', '/modules/design', 'xlsx', 'design_doc', 1, datetime('now'))
      `);

      oldDocId = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/Design_Doc_V450_20260901.xlsx').id;
      newDocId = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/Design_Doc_V451_20260915.xlsx').id;
    });

    it('detects outdated bookmark, returns count, and updates item to latest', async () => {
      // 1. Create a group
      const grpRes = await request(app).post('/api/bookmark-groups').send({ name: 'Design Specs Group' });
      const groupId = grpRes.body.id;

      // 2. Bookmark V450 (which has is_latest = 0 while V451 has is_latest = 1)
      const itemRes = await request(app)
        .post(`/api/bookmark-groups/${groupId}/items`)
        .send({ documentId: oldDocId, note: 'Initial spec review' });
      expect(itemRes.status).toBe(201);
      const itemId = itemRes.body.item_id;

      // 3. Verify GET /api/bookmark-items/outdated-count
      const countRes = await request(app).get('/api/bookmark-items/outdated-count');
      expect(countRes.status).toBe(200);
      expect(countRes.body.count).toBeGreaterThanOrEqual(1);

      // 4. Verify listGroupItems returns is_outdated: true and latest_sibling
      const listRes = await request(app).get(`/api/bookmark-groups/${groupId}/items`);
      expect(listRes.status).toBe(200);
      const item = listRes.body.find((i) => i.item_id === itemId);
      expect(item).toBeDefined();
      expect(item.is_outdated).toBe(true);
      expect(item.latest_sibling).not.toBeNull();
      expect(item.latest_sibling.id).toBe(newDocId);
      expect(item.latest_sibling.version_num).toBe(451);
      expect(item.latest_sibling.version_date).toBe('2026-09-15');

      // 5. Call POST /api/bookmark-items/:id/update-to-latest
      const updateRes = await request(app).post(`/api/bookmark-items/${itemId}/update-to-latest`);
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.item_id).toBe(itemId);
      expect(updateRes.body.document.id).toBe(newDocId);
      expect(updateRes.body.note).toBe('Initial spec review');
      expect(updateRes.body.is_outdated).toBe(false);

      // 6. Verify item is now up to date in list
      const updatedListRes = await request(app).get(`/api/bookmark-groups/${groupId}/items`);
      const updatedItem = updatedListRes.body.find((i) => i.item_id === itemId);
      expect(updatedItem.document.id).toBe(newDocId);
      expect(updatedItem.is_outdated).toBe(false);
      expect(updatedItem.latest_sibling).toBeNull();
    });

    it('returns 404 if item does not exist or has no latest sibling', async () => {
      const nonExistent = await request(app).post('/api/bookmark-items/999999/update-to-latest');
      expect(nonExistent.status).toBe(404);

      // Orphan doc with is_latest = 0 and no latest sibling
      db.exec(`
        INSERT OR REPLACE INTO documents 
        (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
        VALUES 
        ('/tmp/Lonely_V1.xlsx', 'Lonely_V1.xlsx', 'xlsx', 50, datetime('now'), 1, '2020-01-01', '/isolated', 'xlsx', 'lonely', 0, datetime('now'))
      `);
      const lonelyDocId = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/Lonely_V1.xlsx').id;

      const grpRes = await request(app).post('/api/bookmark-groups').send({ name: 'Lonely Group' });
      const itemRes = await request(app).post(`/api/bookmark-groups/${grpRes.body.id}/items`).send({ documentId: lonelyDocId });

      const updateLonely = await request(app).post(`/api/bookmark-items/${itemRes.body.item_id}/update-to-latest`);
      expect(updateLonely.status).toBe(404);
      expect(updateLonely.body.error).toBe('NO_LATEST_SIBLING');
    });

    it('returns 409 if latest version is already in the same group', async () => {
      const grpRes = await request(app).post('/api/bookmark-groups').send({ name: 'Conflict Integration Group' });
      const gId = grpRes.body.id;

      // Add latest
      const itemLatest = await request(app).post(`/api/bookmark-groups/${gId}/items`).send({ documentId: newDocId });
      // Add outdated
      const itemOld = await request(app).post(`/api/bookmark-groups/${gId}/items`).send({ documentId: oldDocId });

      const updateConflict = await request(app).post(`/api/bookmark-items/${itemOld.body.item_id}/update-to-latest`);
      expect(updateConflict.status).toBe(409);
      expect(updateConflict.body.error).toBe('ALREADY_IN_GROUP');
      expect(updateConflict.body.existingItemId).toBe(itemLatest.body.item_id);
    });
  });
});
