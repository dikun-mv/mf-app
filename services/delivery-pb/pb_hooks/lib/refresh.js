// Refreshes one (employeeId, month) row of `employee_month_loads` from the pair's allocations (D8).
// The only file that touches the database: the rule itself is load.js. Called by the model hooks in
// allocations.pb.js with their `e.app`, so the reads and the write are inside the allocation write's
// transaction and roll back with it. The row id is `<employeeId>-<month>`.
const { loadOf } = require(`${__hooks}/lib/load.js`);

const COLLECTION = 'employee_month_loads';

function refreshLoad(app, employeeId, month) {
  const allocations = app.findRecordsByFilter(
    'allocations',
    'employeeId = {:employeeId} && month = {:month}',
    '',
    0,
    0,
    { employeeId, month },
  );
  const load = loadOf(
    allocations.map((a) => ({ id: a.id, amount: a.getFloat('amount'), editedAt: a.getString('editedAt') })),
  );

  const id = `${employeeId}-${month}`;
  let row = null;
  try {
    row = app.findRecordById(COLLECTION, id);
  } catch (_notFound) {
    // No row yet: created below if there is effort.
  }

  if (load === null) {
    if (row !== null) app.delete(row);
    return;
  }
  if (row === null) {
    row = new Record(app.findCollectionByNameOrId(COLLECTION));
    row.id = id;
    row.set('employeeId', employeeId);
    row.set('month', month);
  }
  // A no-op write (a move inside one pair) would still send a realtime event.
  const unchanged =
    row.getFloat('allocatedPersonMonths') === load.allocatedPersonMonths &&
    row.getBool('overCapacity') === load.overCapacity &&
    row.getString('causingAllocationId') === load.causingAllocationId;
  if (!row.isNew() && unchanged) return;
  row.set('allocatedPersonMonths', load.allocatedPersonMonths);
  row.set('overCapacity', load.overCapacity);
  row.set('causingAllocationId', load.causingAllocationId);
  app.save(row);
}

module.exports = { refreshLoad };
