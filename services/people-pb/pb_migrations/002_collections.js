// People's collections (T3.5, .docs/phase-3.md §4). All rules are fields, indexes and API rules; there are
// no hooks. API rules: '' is public, null is locked (superusers only).
//
// - `employees` is read-only through the API (D16): no employee is created, changed or deleted.
// - `rate_records` is open for writes. The rate-history rules (T1.13) run in the People app; the server
//   keeps the shapes and one record per (employeeId, validFrom). `hourlyCost > 0` is people-domain's
//   rule, so the field only keeps it off zero and below.
//
// Record ids are the entity ids (`emp-001`, `rate-<uuid>`), so each collection widens its `id` field
// after its first save (ADR 033 a): a new Collection has no `id` field until it is saved.
const ID_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
const ID_MAX = 64;
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
// Just above 0: the smallest step of a price in EUR.
const MIN_HOURLY_COST = 0.01;

const widenId = (app, name) => {
  const collection = app.findCollectionByNameOrId(name);
  const id = collection.fields.getByName('id');
  id.pattern = ID_PATTERN;
  id.min = 1;
  id.max = ID_MAX;
  app.save(collection);
};

migrate(
  (app) => {
    const employees = new Collection({
      type: 'base',
      name: 'employees',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'text', name: 'name', required: true },
        { type: 'text', name: 'role', required: true },
        // 20 to 40, whole hours. The exact set (40, 32, 20) is people-contract's WEEKLY_HOURS.
        { type: 'number', name: 'weeklyHours', required: true, onlyInt: true, min: 20, max: 40 },
      ],
    });
    app.save(employees);
    widenId(app, 'employees');

    const rateRecords = new Collection({
      type: 'base',
      name: 'rate_records',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        // No cascade: an employee can't be deleted anyway (D16), and a rate must never vanish silently.
        {
          type: 'relation',
          name: 'employeeId',
          collectionId: employees.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { type: 'text', name: 'validFrom', required: true, pattern: DATE_PATTERN },
        { type: 'number', name: 'hourlyCost', required: true, min: MIN_HOURLY_COST },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_rate_records_employee_valid_from ON rate_records (employeeId, validFrom)'],
    });
    app.save(rateRecords);
    widenId(app, 'rate_records');
  },
  (app) => {
    // Children first: rate_records points at employees.
    app.delete(app.findCollectionByNameOrId('rate_records'));
    app.delete(app.findCollectionByNameOrId('employees'));
  },
);
