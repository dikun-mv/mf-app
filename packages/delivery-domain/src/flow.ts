// A minimum-cost circulation with lower bounds, for `roundGrid` (D19, T1.9). The graphs are a few
// thousand arcs, so the plain algorithm is enough: start from the cheapest choice on every edge,
// then repair the flow imbalance with successive shortest paths.
//
// Costs are pairs compared lexicographically, `primary` first. That lets `roundGrid` say "first keep
// every total nearest, then keep every cell nearest" without a weight that could overflow a double.

export interface Cost {
  readonly primary: number;
  readonly secondary: number;
}

/** Larger than any flow the networks here carry. */
export const UNBOUNDED = 1e9;

class FlowNode {
  readonly arcs: Arc[] = [];
  /** Flow in minus flow out of what is placed so far. Zero when the node is balanced. */
  excess = 0;
  primary = Infinity;
  secondary = Infinity;
  via: Arc | null = null;
  queued = false;
  visits = 0;
}

class Arc {
  /** The opposite residual arc. Points at itself until `link` pairs them. */
  rev: Arc = this;

  constructor(
    readonly to: FlowNode,
    public capacity: number,
    readonly primary: number,
    readonly secondary: number,
  ) {}
}

export type { FlowNode };

export class FlowEdge {
  constructor(
    private readonly arc: Arc,
    private readonly lower: number,
  ) {}

  /** The flow on this edge once the network is solved. */
  get flow(): number {
    return this.arc.rev.capacity + this.lower;
  }
}

/** Adds a residual arc and its opposite, which runs at the negated cost. Returns the forward arc. */
function link(from: FlowNode, to: FlowNode, capacity: number, reverseCapacity: number, cost: Cost): Arc {
  const forward = new Arc(to, capacity, cost.primary, cost.secondary);
  const backward = new Arc(from, reverseCapacity, -cost.primary, -cost.secondary);
  forward.rev = backward;
  backward.rev = forward;
  from.arcs.push(forward);
  to.arcs.push(backward);
  return forward;
}

const isNegative = ({ primary, secondary }: Cost): boolean => primary < 0 || (primary === 0 && secondary < 0);

export class CostFlowNetwork {
  private readonly nodes: FlowNode[] = [];
  private solved = false;

  addNode(): FlowNode {
    const node = new FlowNode();
    this.nodes.push(node);
    return node;
  }

  /**
   * Adds an edge that must carry between `lower` and `upper` units, at `cost` per unit. It starts at
   * `upper` when a unit earns money, otherwise at `lower`, so every residual arc begins non-negative.
   */
  addEdge(from: FlowNode, to: FlowNode, lower: number, upper: number, cost: Cost): FlowEdge {
    if (lower > upper) throw new RangeError(`Edge bounds ${String(lower)}..${String(upper)} are empty`);
    const initial = isNegative(cost) ? upper : lower;
    const forward = link(from, to, upper - initial, initial - lower, cost);
    from.excess -= initial;
    to.excess += initial;
    return new FlowEdge(forward, lower);
  }

  /** Repairs the imbalance at minimum cost. Throws if no feasible flow exists. */
  solve(): void {
    if (this.solved) throw new Error('A network is solved once');
    this.solved = true;

    const supply = this.addNode();
    const demand = this.addNode();
    let remaining = 0;
    for (const node of this.nodes) {
      if (node === supply || node === demand) continue;
      if (node.excess > 0) {
        this.join(supply, node, node.excess);
        remaining += node.excess;
      } else if (node.excess < 0) {
        this.join(node, demand, -node.excess);
      }
    }

    while (remaining > 0) {
      const path = this.shortestPath(supply, demand);
      if (path === null) throw new Error('roundGrid: no feasible rounding exists');
      remaining -= this.augment(path);
    }
  }

  private join(from: FlowNode, to: FlowNode, capacity: number): void {
    link(from, to, capacity, 0, { primary: 0, secondary: 0 });
  }

  /**
   * Queue-based Bellman-Ford from `source`. Residual costs can be negative after an augmentation,
   * never cyclically. Returns the arcs of a cheapest path to `sink`, or null if there is none.
   */
  private shortestPath(source: FlowNode, sink: FlowNode): Arc[] | null {
    for (const node of this.nodes) {
      node.primary = Infinity;
      node.secondary = Infinity;
      node.via = null;
      node.queued = false;
      node.visits = 0;
    }
    source.primary = 0;
    source.secondary = 0;
    const queue: FlowNode[] = [source];
    source.queued = true;

    // Iterating an array sees what is pushed while it runs, so this is a FIFO queue.
    for (const node of queue) {
      node.queued = false;
      node.visits += 1;
      /* istanbul ignore next -- every residual cost starts non-negative, so no cycle can be negative */
      if (node.visits > this.nodes.length) throw new Error('roundGrid: negative cost cycle');
      for (const arc of node.arcs) {
        if (arc.capacity <= 0) continue;
        const primary = node.primary + arc.primary;
        const secondary = node.secondary + arc.secondary;
        const target = arc.to;
        if (primary < target.primary || (primary === target.primary && secondary < target.secondary)) {
          target.primary = primary;
          target.secondary = secondary;
          target.via = arc;
          if (!target.queued) {
            target.queued = true;
            queue.push(target);
          }
        }
      }
    }

    // Walk back along the arcs that reached each node; the source has none.
    const path: Arc[] = [];
    for (let arc = sink.via; arc !== null; arc = arc.rev.to.via) path.push(arc);
    return path.length > 0 ? path : null;
  }

  private augment(path: readonly Arc[]): number {
    const bottleneck = Math.min(...path.map((arc) => arc.capacity));
    for (const arc of path) {
      arc.capacity -= bottleneck;
      arc.rev.capacity += bottleneck;
    }
    return bottleneck;
  }
}
