// Seed (T3.6): the 4 projects, 90 breakdown items and 720 allocations of /pb/seed/data.json (a copy of
// docs/data.json in the image), with their ids as record ids, then the load rows. Every seed allocation
// gets the same `editedAt`, so the causer of a seed conflict is the higher id (D18).
//
// Model hooks fire for migration saves (ADR 033 d). The allocations are therefore saved without hooks,
// and each load row is written once, from `loadOf` over the whole pair, instead of 720 refreshes.
const SEED_FILE = '/pb/seed/data.json';
const SEEDED_AT = '2026-01-01T00:00:00.000Z';

const insert = (app, collection, entry) => {
  const record = new Record(collection);
  for (const [field, value] of Object.entries(entry)) record.set(field, value);
  app.save(record);
};

migrate(
  (app) => {
    const { loadOf } = require(`${__hooks}/lib/load.js`);
    const data = JSON.parse(toString($os.readFile(SEED_FILE)));
    const collection = (name) => app.findCollectionByNameOrId(name);

    for (const project of data.projects) insert(app, collection('projects'), project);
    // The file lists a parent before its children, as the parentId relation needs. A root has null,
    // which PocketBase stores as "".
    for (const item of data.breakdownItems) insert(app, collection('breakdown_items'), item);

    const quiet = app.unsafeWithoutHooks();
    const pairs = new Map();
    for (const allocation of data.allocations) {
      const seeded = { ...allocation, editedAt: SEEDED_AT };
      insert(quiet, collection('allocations'), seeded);
      const key = `${allocation.employeeId}-${allocation.month}`;
      pairs.set(key, [...(pairs.get(key) || []), seeded]);
    }

    for (const [id, allocations] of pairs) {
      const load = loadOf(allocations);
      if (load === null) continue;
      const { employeeId, month } = allocations[0];
      insert(app, collection('employee_month_loads'), { id, employeeId, month, ...load });
    }
  },
  (app) => {
    // Records only: 002's down migration drops the collections. Referencing collections first.
    for (const name of ['employee_month_loads', 'allocations', 'breakdown_items', 'projects']) {
      app.truncateCollection(app.findCollectionByNameOrId(name));
    }
  },
);
