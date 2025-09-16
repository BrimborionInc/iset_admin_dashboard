#!/usr/bin/env node
/**
 * Export development tasks as SQL upsert statements for persistence.
 * Usage: node scripts/exportDevTasksMigration.js > dev_tasks.sql
 *
 * Assumed table schema (adjust as needed):
 *   dev_tasks(
 *     id text primary key,
 *     category text not null,
 *     label text not null,
 *     status text not null,
 *     notes text null,
 *     next_steps jsonb null,
 *     doc_link text null,
 *     updated_at timestamptz default now()
 *   )
 */
import { devTasks } from '../src/devTasksData.js';

function escape(str) {
  return str.replace(/'/g, "''");
}

const statements = devTasks.map(t => {
  const nextSteps = t.nextSteps ? `'${escape(JSON.stringify(t.nextSteps))}'::jsonb` : 'NULL';
  return `INSERT INTO dev_tasks (id, category, label, status, notes, next_steps, doc_link)\n` +
    `VALUES ('${escape(t.id)}','${escape(t.category)}','${escape(t.label)}','${escape(t.status)}',${t.notes ? `'${escape(t.notes)}'` : 'NULL'},${nextSteps},${t.link ? `'${escape(t.link)}'` : 'NULL'})\n` +
    `ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, label=EXCLUDED.label, status=EXCLUDED.status, notes=EXCLUDED.notes, next_steps=EXCLUDED.next_steps, doc_link=EXCLUDED.doc_link, updated_at=now();`;
});

console.log('-- Dev Tasks Upsert Migration');
console.log(statements.join('\n\n'));
