// tests/unit/tags.test.mjs
import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const db = require('../../src/db/index.js');
const tagsService = require('../../src/modules/tags/tags.service.js');

describe('tags.service unit tests', () => {
  let doc1Id, doc2Id;

  beforeAll(() => {
    db.exec(`
      INSERT OR REPLACE INTO documents 
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
      VALUES 
      ('/tmp/tag_doc1.txt', 'tag_doc1.txt', 'txt', 10, datetime('now'), 1, '20230101', '/tmp', 'txt', 'tag_doc1', 1, datetime('now')),
      ('/tmp/tag_doc2.txt', 'tag_doc2.txt', 'txt', 20, datetime('now'), 1, '20230101', '/tmp', 'txt', 'tag_doc2', 1, datetime('now'))
    `);

    doc1Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/tag_doc1.txt').id;
    doc2Id = db.prepare('SELECT id FROM documents WHERE file_path = ?').get('/tmp/tag_doc2.txt').id;
  });

  beforeEach(() => {
    db.exec('DELETE FROM document_tags; DELETE FROM tags;');
  });

  test('createTag creates tag and handles defaults and duplicates', () => {
    expect(() => tagsService.createTag({ name: '' })).toThrow('INVALID_TAG_NAME');
    expect(() => tagsService.createTag({ name: '   ' })).toThrow('INVALID_TAG_NAME');

    const tag1 = tagsService.createTag({ name: 'Urgent' });
    expect(tag1.id).toBeDefined();
    expect(tag1.name).toBe('Urgent');
    expect(tag1.color).toBe('#6366f1');

    expect(() => tagsService.createTag({ name: 'Urgent' })).toThrow('TAG_NAME_EXISTS');
    expect(() => tagsService.createTag({ name: 'urgent' })).toThrow('TAG_NAME_EXISTS');

    const tag2 = tagsService.createTag({ name: 'Review', color: '#10b981' });
    expect(tag2.name).toBe('Review');
    expect(tag2.color).toBe('#10b981');
  });

  test('updateTag renames and recolors tag', () => {
    const tag = tagsService.createTag({ name: 'Alpha', color: '#ff0000' });
    const updated = tagsService.updateTag(tag.id, { name: 'Beta', color: '#00ff00' });
    expect(updated.name).toBe('Beta');
    expect(updated.color).toBe('#00ff00');

    expect(() => tagsService.updateTag(999999, { name: 'None' })).toThrow('TAG_NOT_FOUND');
  });

  test('deleteTag cascades and removes relations from document_tags', () => {
    const tag = tagsService.createTag({ name: 'To Delete' });
    tagsService.addTagToDocument(doc1Id, tag.id);

    const docTagsBefore = tagsService.getDocumentTags(doc1Id);
    expect(docTagsBefore.length).toBe(1);

    tagsService.deleteTag(tag.id);

    const docTagsAfter = tagsService.getDocumentTags(doc1Id);
    expect(docTagsAfter.length).toBe(0);

    const remainingTags = tagsService.listTags();
    expect(remainingTags.find(t => t.id === tag.id)).toBeUndefined();
  });

  test('listTags returns doc_count correctly', () => {
    const tag1 = tagsService.createTag({ name: 'Tag One' });
    const tag2 = tagsService.createTag({ name: 'Tag Two' });

    tagsService.addTagToDocument(doc1Id, tag1.id);
    tagsService.addTagToDocument(doc2Id, tag1.id);
    tagsService.addTagToDocument(doc1Id, tag2.id);

    const tags = tagsService.listTags();
    const t1 = tags.find(t => t.id === tag1.id);
    const t2 = tags.find(t => t.id === tag2.id);

    expect(t1.doc_count).toBe(2);
    expect(t2.doc_count).toBe(1);
  });

  test('setDocumentTags replaces tags correctly and is transactional', () => {
    const tag1 = tagsService.createTag({ name: 'Tag A' });
    const tag2 = tagsService.createTag({ name: 'Tag B' });
    const tag3 = tagsService.createTag({ name: 'Tag C' });

    // Initial set [tag1, tag2]
    tagsService.setDocumentTags(doc1Id, [tag1.id, tag2.id]);
    let docTags = tagsService.getDocumentTags(doc1Id);
    expect(docTags.map(t => t.name)).toEqual(['Tag A', 'Tag B']);

    // Replace with [tag3]
    tagsService.setDocumentTags(doc1Id, [tag3.id]);
    docTags = tagsService.getDocumentTags(doc1Id);
    expect(docTags.map(t => t.name)).toEqual(['Tag C']);

    // Replace with [] (clear)
    tagsService.setDocumentTags(doc1Id, []);
    docTags = tagsService.getDocumentTags(doc1Id);
    expect(docTags.length).toBe(0);
  });

  test('addTagToDocument and removeTagFromDocument', () => {
    const tag = tagsService.createTag({ name: 'Single Tag' });

    tagsService.addTagToDocument(doc1Id, tag.id);
    expect(tagsService.getDocumentTags(doc1Id).length).toBe(1);

    tagsService.removeTagFromDocument(doc1Id, tag.id);
    expect(tagsService.getDocumentTags(doc1Id).length).toBe(0);
  });
});
