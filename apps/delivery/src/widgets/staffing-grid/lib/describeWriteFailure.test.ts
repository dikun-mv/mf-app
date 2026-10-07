import { describe, expect, it } from '@rstest/core';
import { RepositoryError } from '../../../shared/api';
import { describeWriteFailure } from './describeWriteFailure';

describe('describeWriteFailure', () => {
  it('says the change was undone, and why, when the service did not respond', () => {
    expect(describeWriteFailure(new RepositoryError('unavailable', 'delivery'))).toEqual({
      tone: 'error',
      text: "Your change wasn't saved: the Delivery service didn't respond. It has been undone. Try again when the connection is back.",
    });
  });

  it('does not suggest waiting for the connection when the service answered', () => {
    const { text } = describeWriteFailure(new RepositoryError('server', 'delivery'));
    expect(text).toBe("Your change wasn't saved: the Delivery service reported an error. It has been undone.");
  });

  it("reports a clash with another user's change as information, not as a failure", () => {
    expect(describeWriteFailure(new RepositoryError('conflict', 'delivery'))).toEqual({
      tone: 'info',
      text: 'This data was changed elsewhere and has been reloaded. Check it and try again.',
    });
  });

  it('never shows a code for an error it does not know', () => {
    expect(describeWriteFailure(new Error('boom')).text).toBe(
      "Your change wasn't saved: something went wrong. It has been undone.",
    );
  });
});
