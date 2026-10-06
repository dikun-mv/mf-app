import { RateRecordId } from '@baseline/people-contract';

// New rate records get `rate-<uuid>` ids made by the client, so an optimistic change can refer to a
// record before the server confirms it. Seed ids stay as they are.

const randomUuid = (): string => crypto.randomUUID();

export const newRateRecordId = (uuid: () => string = randomUuid): RateRecordId => RateRecordId.parse(`rate-${uuid()}`);
