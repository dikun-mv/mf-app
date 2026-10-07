import { DELIVERY_BASE_PATH } from '@baseline/delivery-contract';
import { PEOPLE_BASE_PATH } from '@baseline/people-contract';
import PocketBase from 'pocketbase';

// One SDK client per PocketBase instance an app reads (D6). An adapter for the other team's instance uses
// only that team's contract: here `delivery-contract`, for `employee_month_loads` and nothing else.

function client(origin: string, basePath: string): PocketBase {
  const pb = new PocketBase(`${origin}${basePath}`);
  // TanStack Query already deduplicates reads, and two parallel full-list reads must not cancel each other.
  pb.autoCancellation(false);
  return pb;
}

/** `people-pb` (`employees`, `rate_records`), served by the gateway under `/api/people`. */
export const createPeopleClient = (origin: string): PocketBase => client(origin, PEOPLE_BASE_PATH);

/** `delivery-pb` (`employee_month_loads`), served by the gateway under `/api/delivery`. */
export const createDeliveryClient = (origin: string): PocketBase => client(origin, DELIVERY_BASE_PATH);
