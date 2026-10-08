// Delivery's collections (T3.6, .docs/phase-3.md §4). API rules: '' is public, null is locked (superusers only).
//
// - `projects` is read-only through the API: no project is created, changed or deleted.
// - `breakdown_items` and `allocations` are open for writes. The tree and allocation rules (depth, leaves,
//   month within the project span) run in the Delivery app; the server keeps shapes, relations and one
//   allocation per (breakdownItemId, employeeId, month). No cascade on any relation: a change set deletes
//   children first, and PocketBase refuses to delete a record a required relation still points at.
// - `employee_month_loads` is written only by the allocation hook (D8): public to read and subscribe to.
//
// Record ids are the entity ids (`wbs-001`, `alloc-<uuid>`), so each collection widens its `id` field
// after its first save (ADR 033 a): a new Collection has no `id` field until it is saved.
const ID_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
const ID_MAX = 64;
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const MONTH_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])$';
const DATE_TIME_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$';
const EMPLOYEE_ID_PATTERN = '^emp-[a-z0-9-]+$';

const widenId = (app, name) => {
  const collection = app.findCollectionByNameOrId(name);
  const id = collection.fields.getByName('id');
  id.pattern = ID_PATTERN;
  id.min = 1;
  id.max = ID_MAX;
  app.save(collection);
};

const relation = (name, collection, required) => ({
  type: 'relation',
  name,
  collectionId: collection.id,
  required,
  maxSelect: 1,
  cascadeDelete: false,
});

migrate(
  (app) => {
    const projects = new Collection({
      type: 'base',
      name: 'projects',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'text', name: 'name', required: true },
        { type: 'text', name: 'startDate', required: true, pattern: DATE_PATTERN },
        { type: 'text', name: 'endDate', required: true, pattern: DATE_PATTERN },
      ],
    });
    app.save(projects);
    widenId(app, 'projects');

    const breakdownItems = new Collection({
      type: 'base',
      name: 'breakdown_items',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [relation('projectId', projects, true), { type: 'text', name: 'name', required: true }],
      indexes: ['CREATE INDEX idx_breakdown_items_project ON breakdown_items (projectId)'],
    });
    app.save(breakdownItems);
    widenId(app, 'breakdown_items');
    // A relation to itself needs the collection saved first (ADR 033 g). Optional: a root has "".
    const saved = app.findCollectionByNameOrId('breakdown_items');
    saved.fields.add(new RelationField(relation('parentId', saved, false)));
    app.save(saved);

    const allocations = new Collection({
      type: 'base',
      name: 'allocations',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        relation('breakdownItemId', breakdownItems, true),
        // Another instance's id (People's), so not a relation.
        { type: 'text', name: 'employeeId', required: true, pattern: EMPLOYEE_ID_PATTERN },
        { type: 'text', name: 'month', required: true, pattern: MONTH_PATTERN },
        // Not `required`: PocketBase treats 0 as blank on a required number, and 0 is a valid amount.
        { type: 'number', name: 'amount', min: 0 },
        // Set by the allocations hook on every create and effort edit, never by the client.
        { type: 'text', name: 'editedAt', pattern: DATE_TIME_PATTERN },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_allocations_cell ON allocations (breakdownItemId, employeeId, month)',
        'CREATE INDEX idx_allocations_employee_month ON allocations (employeeId, month)',
      ],
    });
    app.save(allocations);
    widenId(app, 'allocations');

    // Nobody writes a row through the API: the create, update and delete rules stay locked, and the
    // allocation hook saves through its own `app`, which skips API rules.
    const loads = new Collection({
      type: 'base',
      name: 'employee_month_loads',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'text', name: 'employeeId' },
        { type: 'text', name: 'month' },
        { type: 'number', name: 'allocatedPersonMonths' },
        { type: 'bool', name: 'overCapacity' },
        // The causing allocation's id, empty when the person-month is not over capacity.
        { type: 'text', name: 'causingAllocationId' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_employee_month_loads_pair ON employee_month_loads (employeeId, month)'],
    });
    app.save(loads);
    // The row id is `<employeeId>-<month>` (`emp-001-2026-03`), so the hook finds a row by id.
    widenId(app, 'employee_month_loads');
  },
  (app) => {
    // Referencing collections first.
    for (const name of ['employee_month_loads', 'allocations', 'breakdown_items', 'projects']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
