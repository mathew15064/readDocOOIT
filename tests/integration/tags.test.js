// tests/integration/tags.test.js
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const app = require('../../src/app.js');
const db = require('../../src/db/index.js');

describe('Tags API Integration Tests', () => {
  let doc1Id, doc2Id, doc3Id;

  beforeAll(() => {
    db.exec(`
      INSERT OR REPLACE INTO documents 
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
      VALUES 
      ('/tmp/tags_doc1.pdf', 'tags_doc1.pdf', 'pdf', 100, datetime('now'), 1, '20230101', '/tmp', 'pdf', 'tags_doc1', 1, datetime('now')),
      ('/tmp/tags_doc2.pdf', 'tags_doc2.pdf', 'pdf', 120, datetime('now'), 1, '20230101', '/tmp', 'pdf', 'tags_doc2', 1, datetime('now')),
      ('/tmp/tags_doc3.pdf', 'tags_doc3.pdf', 'pdf', 140, datetime('now'), 1, '20230101', '/tmp', 'pdf', 'tags_doc3', 1, datetime('now'))
    `);

    doc1Id = db.prepare("SELECT id FROM documents WHERE file_path = '/tmp/tags_doc1.pdf'").get().id;
    doc2Id = db.prepare("SELECT id FROM documents WHERE file_path = '/tmp/tags_doc2.pdf'").get().id;
    doc3Id = db.prepare("SELECT id FROM documents WHERE file_path = '/tmp/tags_doc3.pdf'").get().id;
  });

  beforeEach(() => {
    db.exec('DELETE FROM document_tags; DELETE FROM tags;');
  });

  it('runs CRUD lifecycle for tags', async () => {
    // 1. Create tag
    const createRes = await request(app)
      .post('/api/tags')
      .send({ name: 'Backend', color: '#10b981' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Backend');
    expect(createRes.body.color).toBe('#10b981');
    const tagId = createRes.body.id;

    // 2. Duplicate create returns 409
    const dupRes = await request(app)
      .post('/api/tags')
      .send({ name: 'backend' });
    expect(dupRes.status).toBe(409);

    // 3. List tags
    const listRes = await request(app).get('/api/tags');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].name).toBe('Backend');

    // 4. Update tag
    const patchRes = await request(app)
      .patch(`/api/tags/${tagId}`)
      .send({ name: 'Core Backend', color: '#3b82f6' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.name).toBe('Core Backend');
    expect(patchRes.body.color).toBe('#3b82f6');

    // 5. Delete tag
    const delRes = await request(app).delete(`/api/tags/${tagId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);

    const emptyList = await request(app).get('/api/tags');
    expect(emptyList.body.length).toBe(0);
  });

  it('manages document tags via PUT /api/documents/:id/tags', async () => {
    const t1 = (await request(app).post('/api/tags').send({ name: 'Feature' })).body;
    const t2 = (await request(app).post('/api/tags').send({ name: 'Bug' })).body;

    // PUT tags [t1.id, t2.id]
    const putRes = await request(app)
      .put(`/api/documents/${doc1Id}/tags`)
      .send({ tagIds: [t1.id, t2.id] });
    expect(putRes.status).toBe(200);
    expect(putRes.body.length).toBe(2);
    expect(putRes.body.map(t => t.name)).toContain('Feature');
    expect(putRes.body.map(t => t.name)).toContain('Bug');

    // GET /api/documents/:id/tags
    const getRes = await request(app).get(`/api/documents/${doc1Id}/tags`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(2);

    // Replace with [t2.id]
    const putRes2 = await request(app)
      .put(`/api/documents/${doc1Id}/tags`)
      .send({ tagIds: [t2.id] });
    expect(putRes2.status).toBe(200);
    expect(putRes2.body.length).toBe(1);
    expect(putRes2.body[0].name).toBe('Bug');
  });

  it('adds and removes single tag via POST/DELETE /api/documents/:id/tags/:tagId', async () => {
    const t1 = (await request(app).post('/api/tags').send({ name: 'Design' })).body;

    const addRes = await request(app).post(`/api/documents/${doc1Id}/tags/${t1.id}`);
    expect(addRes.status).toBe(201);
    expect(addRes.body.added).toBe(true);

    const getRes = await request(app).get(`/api/documents/${doc1Id}/tags`);
    expect(getRes.body.length).toBe(1);

    const delRes = await request(app).delete(`/api/documents/${doc1Id}/tags/${t1.id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.removed).toBe(true);

    const getResAfter = await request(app).get(`/api/documents/${doc1Id}/tags`);
    expect(getResAfter.body.length).toBe(0);
  });

  it('filters GET /api/documents?tagIds=1,2 and includes tags on documents', async () => {
    const t1 = (await request(app).post('/api/tags').send({ name: 'TagA', color: '#ff0000' })).body;
    const t2 = (await request(app).post('/api/tags').send({ name: 'TagB', color: '#00ff00' })).body;
    const t3 = (await request(app).post('/api/tags').send({ name: 'TagC', color: '#0000ff' })).body;

    // doc1 gets TagA, doc2 gets TagB, doc3 gets TagC
    await request(app).post(`/api/documents/${doc1Id}/tags/${t1.id}`);
    await request(app).post(`/api/documents/${doc2Id}/tags/${t2.id}`);
    await request(app).post(`/api/documents/${doc3Id}/tags/${t3.id}`);

    // Query documents with tagIds=t1.id,t2.id
    const res = await request(app).get(`/api/documents?tagIds=${t1.id},${t2.id}`);
    expect(res.status).toBe(200);
    const returnedDocIds = res.body.documents.map(d => d.id);
    expect(returnedDocIds).toContain(doc1Id);
    expect(returnedDocIds).toContain(doc2Id);
    expect(returnedDocIds).not.toContain(doc3Id);

    // Verify doc1 has tags array
    const doc1 = res.body.documents.find(d => d.id === doc1Id);
    expect(doc1.tags).toBeDefined();
    expect(doc1.tags.length).toBe(1);
    expect(doc1.tags[0].name).toBe('TagA');
    expect(doc1.tags[0].color).toBe('#ff0000');
  });
});
