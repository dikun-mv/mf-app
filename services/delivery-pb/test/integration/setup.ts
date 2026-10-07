import { DELIVERY_BASE_PATH } from '@baseline/delivery-contract';
import { EventSource } from 'eventsource';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { z } from 'zod';

// Shared by Delivery's integration tests (T3.9). They run against the compose stack through the gateway
// (`docker compose up -d --build --wait && infra/scripts/reset.sh && pnpm test:integration`).

// Node has no global EventSource, and the SDK's realtime needs one before the first subscribe (ADR 033 i).
Object.assign(globalThis, { EventSource });

/** The gateway, as the browser's page origin is in the apps. */
export const GATEWAY = 'http://localhost:8080';

/** A client for Delivery's PocketBase through the gateway, which cuts the base path. */
export function createClient(): PocketBase {
  const pb = new PocketBase(`${GATEWAY}${DELIVERY_BASE_PATH}`);
  pb.autoCancellation(false); // parallel calls in a test
  return pb;
}

/** PocketBase's error body (ADR 033 h): `data` has one `{ code }` per failing field. */
const ErrorBody = z.object({ status: z.number(), data: z.record(z.string(), z.object({ code: z.string() })) });

/** A failed batch names each failing operation by index, with that operation's own error body under `response`. */
const BatchErrorBody = z.object({
  status: z.number(),
  data: z.object({ requests: z.record(z.string(), z.object({ response: ErrorBody })) }),
});

/** How a request was refused: its HTTP status and the error code of each failing field. */
export interface Refusal {
  readonly status: number;
  readonly fieldCodes: Record<string, string>;
}

const refusalFrom = ({ status, data }: z.infer<typeof ErrorBody>): Refusal => ({
  status,
  fieldCodes: Object.fromEntries(Object.entries(data).map(([field, { code }]) => [field, code])),
});

/** Runs a request and returns the error it was refused with, or fails the test if it went through. */
async function errorOf(request: Promise<unknown>): Promise<ClientResponseError> {
  try {
    await request;
  } catch (error) {
    if (error instanceof ClientResponseError) return error;
    throw error;
  }
  throw new Error('the request was expected to be refused, but it succeeded');
}

/** Runs a request that must be refused and returns how. */
export async function refusalOf(request: Promise<unknown>): Promise<Refusal> {
  return refusalFrom(ErrorBody.parse((await errorOf(request)).response));
}

/** Runs a batch that must fail and returns how each failing operation was refused, by its index. */
export async function batchRefusalOf(
  batch: Promise<unknown>,
): Promise<{ status: number; operations: Record<string, Refusal> }> {
  const { status, data } = BatchErrorBody.parse((await errorOf(batch)).response);
  return {
    status,
    operations: Object.fromEntries(
      Object.entries(data.requests).map(([index, { response }]) => [index, refusalFrom(response)]),
    ),
  };
}

/** Waits until `read` returns something, polling; fails after `timeoutMs`. */
export async function eventually<T>(read: () => T | undefined, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`nothing arrived within ${String(timeoutMs)} ms`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** A project of the seed. Scratch breakdown items hang under it. */
export const SEED_PROJECT = 'prj-1';

/**
 * What a test writes, so it can remove it again and leave the seed as it found it: allocations go first,
 * then breakdown items, the children before their parents (the relations are required, ADR 033 g).
 * Tests use months far from the seed's (2026-2027), so a scratch (employee, month) pair has no seed effort.
 */
export class Scratch {
  readonly allocations: string[] = [];
  readonly items: string[] = [];

  constructor(private readonly pb: PocketBase) {}

  /** Creates a breakdown item, by default a root of the seed project. */
  async item(parentId = ''): Promise<string> {
    const id = `wbs-${crypto.randomUUID()}`;
    this.items.push(id);
    await this.pb.collection('breakdown_items').create({ id, projectId: SEED_PROJECT, parentId, name: 'scratch' });
    return id;
  }

  /** The id of an allocation to be created in a batch, removed by `clean`. */
  allocationId(): string {
    const id = `alloc-${crypto.randomUUID()}`;
    this.allocations.push(id);
    return id;
  }

  /** Creates an allocation; `editedAt` is stamped by the server. */
  async allocation(fields: { breakdownItemId: string; employeeId: string; month: string; amount: number }) {
    const id = this.allocationId();
    return this.pb.collection('allocations').create({ id, ...fields });
  }

  async clean(): Promise<void> {
    for (const id of this.allocations.splice(0))
      await this.pb
        .collection('allocations')
        .delete(id)
        .catch(() => undefined);
    for (const id of this.items.splice(0).reverse()) {
      await this.pb
        .collection('breakdown_items')
        .delete(id)
        .catch(() => undefined);
    }
  }
}

/** Two writes in one millisecond would tie on `editedAt`: wait a little between writes that must be ordered. */
export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));
