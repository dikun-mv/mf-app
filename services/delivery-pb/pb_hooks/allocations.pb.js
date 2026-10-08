// The two rules on `allocations` (.docs/phase-3.md §4). Handlers run in isolated scopes, so each one
// `require`s what it uses inside itself (ADR 033 f). Both kinds of hook also run for every item of a batch.

// editedAt (D18): set by the server on create and on a change of `amount`, whatever the client sent.
// Any other update, a move (new breakdownItemId) or a D9 re-point, keeps the stored value.
onRecordCreateRequest((e) => {
  e.record.set('editedAt', new Date().toISOString());
  e.next();
}, 'allocations');

onRecordUpdateRequest((e) => {
  const original = e.record.original();
  const amountChanged = e.record.getFloat('amount') !== original.getFloat('amount');
  e.record.set('editedAt', amountChanged ? new Date().toISOString() : original.getString('editedAt'));
  e.next();
}, 'allocations');

// The load rows (D8): after the write, inside its transaction through `e.app`, refresh the pair's row.
// An update that moved the record to another employee or month refreshes the old pair too. These hooks
// also run for migration saves (ADR 033 d); the seed skips them and writes each row once.
onRecordCreate((e) => {
  e.next();
  const { refreshLoad } = require(`${__hooks}/lib/refresh.js`);
  refreshLoad(e.app, e.record.getString('employeeId'), e.record.getString('month'));
}, 'allocations');

onRecordUpdate((e) => {
  // Read the old pair before the write; refresh after it, so the reads see the new state.
  const before = e.record.original();
  const old = { employeeId: before.getString('employeeId'), month: before.getString('month') };
  e.next();
  const { refreshLoad } = require(`${__hooks}/lib/refresh.js`);
  const { employeeId, month } = { employeeId: e.record.getString('employeeId'), month: e.record.getString('month') };
  refreshLoad(e.app, employeeId, month);
  if (old.employeeId !== employeeId || old.month !== month) refreshLoad(e.app, old.employeeId, old.month);
}, 'allocations');

onRecordDelete((e) => {
  e.next();
  const { refreshLoad } = require(`${__hooks}/lib/refresh.js`);
  refreshLoad(e.app, e.record.getString('employeeId'), e.record.getString('month'));
}, 'allocations');
