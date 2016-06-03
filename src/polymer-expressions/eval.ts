'use strict';

import * as ast from './ast_factory';

const _BINARY_OPERATORS = {
  '+':   (a: any, b: any) => a + b,
  '-':   (a: any, b: any) => a - b,
  '*':   (a: any, b: any) => a * b,
  '/':   (a: any, b: any) => a / b,
  '%':   (a: any, b: any) => a % b,
  // tslint:disable-next-line:triple-equals
  '==':  (a: any, b: any) => a == b,
  // tslint:disable-next-line:triple-equals
  '!=':  (a: any, b: any) => a != b,
  '===': (a: any, b: any) => a === b,
  '!==': (a: any, b: any) => a !== b,
  '>':   (a: any, b: any) => a > b,
  '>=':  (a: any, b: any) => a >= b,
  '<':   (a: any, b: any) => a < b,
  '<=':  (a: any, b: any) => a <= b,
  '||':  (a: any, b: any) => a || b,
  '&&':  (a: any, b: any) => a && b,
  '|':   (a: any, f: any) => f(a),
};

const _UNARY_OPERATORS = {
  '+': (a: any) => a,
  '-': (a: any) => -a,
  '!': (a: any) => !a,
};

export const createScope = (parent: {[name: string]: any}) => {
  let scope = Object.create(parent);
  scope['this'] = scope['this'] || parent;
  return scope;
};

export interface EvalAstNode extends ast.AstNode {
  evaluate(scope: any): any;
  getIds(idents?: string[]): string[];
}

export class EvalAstFactory implements ast.AstFactory {

  empty(): EvalAstNode & ast.AstNode {
    // TODO(justinfagnani): return null instead?
    return {
      type: 'Empty',
      evaluate(scope) { return scope; },
      getIds(idents) { return idents; },
    };

  }

  // TODO(justinfagnani): just use a JS literal?
  literal(v: string | number | boolean): EvalAstNode & ast.LiteralAstNode {
    return {
      type: 'Literal',
      value: v,
      evaluate(scope) { return this.value; },
      getIds(idents) { return idents; },
    };
  }

  id(v: string): EvalAstNode & ast.IdAstNode {
    return {
      type: 'ID',
      value: v,
      evaluate(scope) {
        // TODO(justinfagnani): this prevernts access to properties named 'this'
        if (this.value === 'this') return scope;
        return scope[this.value];
      },
      getIds(idents) {
        idents.push(this.value);
        return idents;
      },
    };
  }

  unary(op: string, expr: EvalAstNode): EvalAstNode & ast.UnaryAstNode {
    let f = _UNARY_OPERATORS[op];
    return {
      type: 'Unary',
      operator: op,
      child: expr,
      evaluate(scope) {
        return f(this.child.evaluate(scope));
      },
      getIds(idents) { return this.child.getIds(idents); },
    };
  }

  binary(l: EvalAstNode, op: string, r: EvalAstNode): EvalAstNode & ast.BinaryAstNode {
    let f = _BINARY_OPERATORS[op];
    return {
      type: 'Binary',
      operator: op,
      left: l,
      right: r,
      evaluate(scope) {
        return f(this.left.evaluate(scope), this.right.evaluate(scope));
      },
      getIds(idents) {
        this.left.getIds(idents);
        this.right.getIds(idents);
        return idents;
      },
    };
  }

  getter(g: EvalAstNode, n: string): EvalAstNode & ast.GetterAstNode {
    return {
      type: 'Getter',
      receiver: g,
      name: n,
      evaluate(scope) {
        return this.receiver.evaluate(scope)[this.name];
      },
      getIds(idents) {
        this.receiver.getIds(idents);
        return idents;
      },
    };
  }

  invoke(receiver: EvalAstNode, method: string, args: EvalAstNode[]): EvalAstNode & ast.InvokeAstNode {
    if (method != null && typeof method !== 'string') {
      throw new Error('method not a string');
    }
    return {
      type: 'Invoke',
      receiver: receiver,
      method: method,
      arguments: args,
      evaluate(scope) {
        let receiver = this.receiver.evaluate(scope);
        // TODO(justinfagnani): this might be wrong in cases where we're
        // invoking a top-level function rather than a method. If method is
        // defined on a nested scope, then we should probably set _this to null.
        let _this = this.method ? receiver : scope['this'] || scope;
        let f = this.method ? receiver[method] : receiver;
        let argValues: any[] = this.arguments.map((a: EvalAstNode) => a.evaluate(scope));
        return f.apply(_this, argValues);
      },
      getIds(idents) {
        this.receiver.getIds(idents);
        this.arguments.forEach((a: EvalAstNode) => a.getIds(idents));
        return idents;
      },
    };
  }

  paren(e: EvalAstNode): EvalAstNode {
    return e;
  }

  index(e: EvalAstNode, a: EvalAstNode): EvalAstNode & ast.IndexAstNode {
    return {
      type: 'Index',
      receiver: e,
      argument: a,
      evaluate(scope) {
        return this.receiver.evaluate(scope)[this.argument.evaluate(scope)];
      },
      getIds(idents) {
        this.receiver.getIds(idents);
        return idents;
      },
    };
  }

  ternary(c: EvalAstNode, t: EvalAstNode, f: EvalAstNode): EvalAstNode & ast.TernaryAstNode {
    return {
      type: 'Ternary',
      condition: c,
      trueExpr: t,
      falseExpr: f,
      evaluate: function(scope) {
        let c = this.condition.evaluate(scope);
        if (c) {
          return this.trueExpr.evaluate(scope);
        } else {
          return this.falseExpr.evaluate(scope);
        }
      },
      getIds(idents) {
        this.condition.getIds(idents);
        this.trueExpr.getIds(idents);
        this.falseExpr.getIds(idents);
        return idents;
      },
    };
  }

  map(entries: {[key: string]: EvalAstNode}): EvalAstNode & ast.MapAstNode {
    return {
      type: 'Map',
      entries: entries,
      evaluate: function(scope) {
        let map = {};
        for (let key in entries) {
          map[key] = this.entries[key].evaluate(scope);
        }
        return map;
      },
      getIds(idents) {
        for (let key in entries) {
          this.entries[key].getIds(idents);
        }
        return idents;
      },
    };
  }

  // TODO(justinfagnani): if the list is deeply literal
  list(l: EvalAstNode[]): EvalAstNode & ast.ListAstNode {
    return {
      type: 'List',
      items: l,
      evaluate(scope) {
        return this.items.map((a: EvalAstNode) => a.evaluate(scope));
      },
      getIds(idents) {
        this.items.forEach((i: EvalAstNode) => i.getIds(idents));
        return idents;
      },
    };
  }

}
