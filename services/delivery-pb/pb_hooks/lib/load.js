// The capacity rule for one (employeeId, month) pair (D8, D18): a plain-JS mirror of delivery-domain's
// `loadsOf` for one group. Plain CommonJS with no PocketBase globals, so the hooks `require` it inside
// a handler and Rstest imports it in Node, where a property test holds it equal to `loadsOf` (T3.9).
//
// Input: the pair's allocations as `{ id, amount, editedAt }`. Output: the fields of the pair's
// `employee_month_loads` row, or `null` when no allocation has `amount > 0` (the row then goes away).
// PocketBase has no null, so `causingAllocationId` is "" when the pair is not over capacity.

// A floating-point allowance only, as in delivery-domain's CAPACITY_EPSILON.
const CAPACITY_EPSILON = 1e-9;

const byId = (a, b) => (a.id < b.id ? -1 : 1);

function loadOf(contributions) {
  const contributors = contributions.filter((c) => c.amount > 0);
  if (contributors.length === 0) return null;

  // Summed in id order, so the total doesn't depend on the order the records were read in.
  const allocatedPersonMonths = [...contributors].sort(byId).reduce((sum, c) => sum + c.amount, 0);
  const overCapacity = allocatedPersonMonths > 1 + CAPACITY_EPSILON;

  // The causer is the latest edit, the highest id breaking a tie: one ordering for both keys.
  let causer = null;
  if (overCapacity) {
    for (const c of contributors) {
      if (causer === null || c.editedAt > causer.editedAt || (c.editedAt === causer.editedAt && c.id > causer.id)) {
        causer = c;
      }
    }
  }
  return { allocatedPersonMonths, overCapacity, causingAllocationId: causer === null ? '' : causer.id };
}

module.exports = { loadOf };
