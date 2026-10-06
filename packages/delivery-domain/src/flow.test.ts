import { describe, expect, it } from '@rstest/core';
import { CostFlowNetwork, UNBOUNDED } from './flow';

const free = { primary: 0, secondary: 0 };

describe('CostFlowNetwork', () => {
  it('takes the cheaper of two routes', () => {
    const network = new CostFlowNetwork();
    const [s, a, b, t] = [network.addNode(), network.addNode(), network.addNode(), network.addNode()];
    network.addEdge(t, s, 0, UNBOUNDED, free);
    network.addEdge(s, a, 1, 1, free); // one unit must leave the source
    const viaA = network.addEdge(a, t, 0, 1, { primary: 0, secondary: 5 });
    const viaB = network.addEdge(a, b, 0, 1, { primary: 0, secondary: 1 });
    network.addEdge(b, t, 0, 1, { primary: 0, secondary: 1 });
    network.solve();
    expect(viaA.flow).toBe(0);
    expect(viaB.flow).toBe(1);
  });

  it('compares the primary cost before the secondary', () => {
    const network = new CostFlowNetwork();
    const [s, a, t] = [network.addNode(), network.addNode(), network.addNode()];
    network.addEdge(t, s, 0, UNBOUNDED, free);
    network.addEdge(s, a, 1, 1, free);
    const cheapSecondary = network.addEdge(a, t, 0, 1, { primary: 1, secondary: -1000 });
    const cheapPrimary = network.addEdge(a, t, 0, 1, { primary: 0, secondary: 1000 });
    network.solve();
    expect(cheapPrimary.flow).toBe(1);
    expect(cheapSecondary.flow).toBe(0);
  });

  it('takes an edge that earns money even when nothing forces it', () => {
    const network = new CostFlowNetwork();
    const [s, t] = [network.addNode(), network.addNode()];
    network.addEdge(t, s, 0, UNBOUNDED, free);
    const earning = network.addEdge(s, t, 0, 3, { primary: -1, secondary: 0 });
    network.solve();
    expect(earning.flow).toBe(3);
  });

  it('respects lower bounds', () => {
    const network = new CostFlowNetwork();
    const [s, t] = [network.addNode(), network.addNode()];
    network.addEdge(t, s, 0, UNBOUNDED, free);
    const costly = network.addEdge(s, t, 2, 5, { primary: 1, secondary: 0 });
    network.solve();
    expect(costly.flow).toBe(2);
  });

  it('throws when no flow can satisfy the bounds', () => {
    const network = new CostFlowNetwork();
    const [s, t] = [network.addNode(), network.addNode()];
    network.addEdge(t, s, 0, UNBOUNDED, free);
    network.addEdge(s, t, 1, 1, free);
    network.addEdge(t, s, 0, 0, free);
    // Nothing can carry the unit the first edge requires back to the source.
    const stuck = new CostFlowNetwork();
    const [x, y] = [stuck.addNode(), stuck.addNode()];
    stuck.addEdge(x, y, 1, 1, free);
    expect(() => {
      stuck.solve();
    }).toThrow('no feasible rounding exists');
    expect(network.addNode()).toBeDefined();
  });

  it('refuses empty bounds and a second solve', () => {
    const network = new CostFlowNetwork();
    const [s, t] = [network.addNode(), network.addNode()];
    expect(() => network.addEdge(s, t, 2, 1, free)).toThrow(RangeError);
    network.solve();
    expect(() => {
      network.solve();
    }).toThrow();
  });
});
