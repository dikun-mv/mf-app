// Seed (T3.5): the 60 employees and 150 rate records of /pb/seed/data.json (a copy of docs/data.json
// in the image), with their ids as record ids. The other sections of the file belong to delivery-pb.
// The file is JSON with the collections' field names, so each entry is saved as it is. There are no
// hooks in people-pb to run (ADR 033 d).
const SEED_FILE = '/pb/seed/data.json';

const insert = (app, collection, entry) => {
  const record = new Record(collection);
  for (const [field, value] of Object.entries(entry)) record.set(field, value);
  app.save(record);
};

migrate(
  (app) => {
    const data = JSON.parse(toString($os.readFile(SEED_FILE)));
    const employees = app.findCollectionByNameOrId('employees');
    const rateRecords = app.findCollectionByNameOrId('rate_records');
    // Employees first: a rate record's employeeId is a relation to one.
    for (const employee of data.employees) insert(app, employees, employee);
    for (const rate of data.rateRecords) insert(app, rateRecords, rate);
  },
  (app) => {
    // Records only: 002's down migration drops the collections.
    app.truncateCollection(app.findCollectionByNameOrId('rate_records'));
    app.truncateCollection(app.findCollectionByNameOrId('employees'));
  },
);
