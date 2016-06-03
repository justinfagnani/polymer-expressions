'use strict';

export interface AstNode {
  type: string;
}

export interface EmptyAstNode extends AstNode {}

export interface LiteralAstNode extends AstNode {
  value: string | number | boolean;
}

export interface IdAstNode extends AstNode {
  value: string;
}

export interface UnaryAstNode extends AstNode {
  operator: string;
  child: AstNode;
}

export interface BinaryAstNode extends AstNode {
  operator: string;
  left: AstNode;
  right: AstNode;
}

export interface GetterAstNode extends AstNode {
  receiver: AstNode;
  name: string;
}

export interface InvokeAstNode extends AstNode {
  receiver: AstNode;
  method: string;
  arguments: AstNode[];
}

export interface ParenAstNode extends AstNode {
  child: AstNode;
}

export interface IndexAstNode extends AstNode {
  receiver: AstNode;
  argument: AstNode;
}

export interface TernaryAstNode extends AstNode {
  condition: AstNode;
  trueExpr: AstNode;
  falseExpr: AstNode;
}

export interface MapAstNode extends AstNode {
  entries: {[key: string]: AstNode};
}

export interface ListAstNode extends AstNode {
  items: AstNode[];
}

export class AstFactory {

  empty(): EmptyAstNode {
    // TODO(justinfagnani): return null instead?
    return {
      type: 'Empty',
    };
  }

  // TODO(justinfagnani): just use a JS literal?
  literal(v: string | number | boolean): LiteralAstNode {
    return {
      type: 'Literal',
      value: v,
    };
  }

  id(v: string): IdAstNode {
    return {
      type: 'ID',
      value: v,
    };
  }

  unary(op: string, expr: AstNode): UnaryAstNode {
    return {
      type: 'Unary',
      operator: op,
      child: expr,
    };
  }

  binary(l: AstNode, op: string, r: AstNode): BinaryAstNode {
    return {
      type: 'Binary',
      operator: op,
      left: l,
      right: r,
    };
  }

  getter(receiver: AstNode, name: string): GetterAstNode {
    return {
      type: 'Getter',
      receiver,
      name,
    };
  }

  invoke(receiver: AstNode, method: string, args: AstNode[]): InvokeAstNode {
    if (args == null) {
      throw new Error('args');
    }
    return {
      type: 'Invoke',
      receiver: receiver,
      method: method,
      arguments: args,
    };
  }

  paren(e: AstNode): AstNode {
    return e;
    // return {
    //   type: 'Paren',
    //   child: e,
    // };
  }

  index(e: AstNode, a: AstNode): IndexAstNode {
    return {
      type: 'Index',
      receiver: e,
      argument: a,
    };
  }

  ternary(c: AstNode, t: AstNode, f: AstNode): TernaryAstNode {
    return {
      type: 'Ternary',
      condition: c,
      trueExpr: t,
      falseExpr: f,
    };
  }

  map(entries: {[key: string]: AstNode}): MapAstNode {
    return {
      type: 'Map',
      entries: entries,
    };
  }

  list(l: AstNode[]): ListAstNode {
    return {
      type: 'List',
      items: l,
    };
  }
}
