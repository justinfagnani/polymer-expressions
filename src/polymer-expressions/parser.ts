'use strict';

import { AstFactory, AstNode } from './ast_factory';
import * as ast from './ast_factory';

const GROUPERS = '()[]{}';
const OPERATORS = '+-*/!&%<=>?^|';
const TWO_CHAR_OPS = ['==', '!=', '<=', '>=', '||', '&&'];
const THREE_CHAR_OPS = ['===', '!=='];
const KEYWORDS = ['this'];
const UNARY_OPERATORS = ['+', '-', '!'];
const BINARY_OPERATORS = ['+', '-', '*', '/', '%', '^', '==',
    '!=', '>', '<', '>=', '<=', '||', '&&', '&', '===', '!==', '|'];

export const PRECEDENCE: {[token: string]: number} = {
  '!':  0,
  ':':  0,
  ',':  0,
  ')':  0,
  ']':  0,
  '}':  0,
  '?':  1,
  '||': 2,
  '&&': 3,
  '|':  4,
  '^':  5,
  '&':  6,

  // equality
  '!=': 7,
  '==': 7,
  '!==': 7,
  '===': 7,

  // relational
  '>=': 8,
  '>':  8,
  '<=': 8,
  '<':  8,

  // additive
  '+':  9,
  '-':  9,

  // multiplicative
  '%':  10,
  '/':  10,
  '*':  10,

  // postfix
  '(':  11,
  '[':  11,
  '.':  11,
  '{': 11, //not sure this is correct
};

export const POSTFIX_PRECEDENCE = 11;
export const STRING = 1;
export const IDENTIFIER = 2;
export const DOT = 3;
export const COMMA = 4;
export const COLON = 5;
export const INTEGER = 6;
export const DECIMAL = 7;
export const OPERATOR = 8;
export const GROUPER = 9;
export const KEYWORD = 10;

export interface Token {
  kind: number;
  value: string;
  precedence: number;
}

export function token(kind: number, value: any, precedence?: number): Token {
  return {
    kind: kind,
    value: value,
    precedence: precedence || 0,
  };
}

function isWhitespace(next: string): boolean {
  return /^\s$/.test(next);
}

// TODO(justinfagnani): allow code points > 127
function isIdentOrKeywordStart(next: string): boolean {
  return /^[a-zA-Z_$]$/.test(next);
}

// TODO(justinfagnani): allow code points > 127
function isIdentifier(next: string): boolean {
  return /^[a-zA-Z0-9_$]$/.test(next);
}

function isKeyword(str: string): boolean {
  return KEYWORDS.indexOf(str) !== -1;
}

function isQuote(next: string): boolean {
  return /^[\"\']$/.test(next);
}

function isNumber(next: string): boolean {
  return /^[0-9]$/.test(next);
}

function isOperator(next: string): boolean {
  return OPERATORS.indexOf(next) !== -1;
}

function isGrouper(next: string): boolean {
  return GROUPERS.indexOf(next) !== -1;
}

function escapeString(str: string): string {
  return str.replace(/\\(.)/g, (match, group) => {
    switch (group) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      default: return group;
    }
  });
}

export class Tokenizer {

  input: string;
  index: number = -1;
  tokenStart: number = 0;
  next: string = null;

  constructor(input: string) {
    this.input = input;
  }

  advance(resetTokenStart?: boolean) {
    if (this.index < this.input.length) {
      this.index++;
      this.next = this.input[this.index];
      if (resetTokenStart) {
        this.tokenStart = this.index;
      }
    } else {
      this.next = null;
    }
  }

  getValue(lookahead?: number): string {
    let v = this.input.substring(this.tokenStart, this.index + (lookahead || 0));
    if (!lookahead) this.clearValue();
    return v;
  }

  clearValue() {
    this.tokenStart = this.index;
  }

  nextToken(): Token {
    if (this.index === -1) this.advance();
    while (isWhitespace(this.next)) {
      this.advance(true);
    }
    if (isQuote(this.next)) return this.tokenizeString();
    if (isIdentOrKeywordStart(this.next)) return this.tokenizeIdentOrKeyword();
    if (isNumber(this.next)) return this.tokenizeNumber();
    if (this.next === '.') return this.tokenizeDot();
    if (this.next === ',') return this.tokenizeComma();
    if (this.next === ':') return this.tokenizeColon();
    if (isOperator(this.next)) return this.tokenizeOperator();
    if (isGrouper(this.next)) return this.tokenizeGrouper();
    // no match, should be end of input
    this.advance();
    // console.assert(!this.next);
    return null;
  }

  tokenizeString(): Token {
    const us = 'unterminated string';
    let quoteChar = this.next;
    this.advance(true);
    while (this.next !== quoteChar) {
      if (!this.next) throw new Error(us);
      if (this.next === '\\') {
        this.advance();
        if (!this.next) throw new Error(us);
      }
      this.advance();
    }
    let t = token(STRING, escapeString(this.getValue()));
    this.advance();
    return t;
  }

  tokenizeIdentOrKeyword(): Token {
    while (isIdentifier(this.next)) {
      this.advance();
    }
    let value = this.getValue();
    let kind = isKeyword(value) ? KEYWORD : IDENTIFIER;
    return token(kind, value);
  }

  tokenizeNumber(): Token {
    while (isNumber(this.next)) {
      this.advance();
    }
    if (this.next === '.') return this.tokenizeDot();
    return token(INTEGER, this.getValue());
  }

  tokenizeDot(): Token {
    this.advance();
    if (isNumber(this.next)) return this.tokenizeFraction();
    this.clearValue();
    return token(DOT, '.', POSTFIX_PRECEDENCE);
  }

  tokenizeComma(): Token {
    this.advance(true);
    return token(COMMA, ',');
  }

  tokenizeColon(): Token {
    this.advance(true);
    return token(COLON, ':');
  }

  tokenizeFraction(): Token {
    while (isNumber(this.next)) {
      this.advance();
    }
    return token(DECIMAL, this.getValue());
  }

  tokenizeOperator(): Token {
    this.advance();
    let op = this.getValue(2);

    if (THREE_CHAR_OPS.indexOf(op) !== -1) {
      this.advance();
      this.advance();
    } else {
      op = this.getValue(1);
      if (TWO_CHAR_OPS.indexOf(op) !== -1) {
        this.advance();
      }
    }
    op = this.getValue();
    return token(OPERATOR, op, PRECEDENCE[op]);
  }

  tokenizeGrouper(): Token {
    let value = this.next;
    let t = token(GROUPER, value, PRECEDENCE[value]);
    this.advance(true);
    return t;
  }
}

export function parse(expr: string, astFactory: AstFactory): AstNode {
  return new Parser(expr, astFactory).parse();
}

export class Parser {

  tokenizer: Tokenizer;
  ast: AstFactory;
  token: Token;
  kind: number;
  value: any;

  constructor(input: string, astFactory: AstFactory) {
    this.tokenizer = new Tokenizer(input);
    this.ast = astFactory;
    this.token = null;
    this.kind = null;
    this.value = null;
  }

  parse(): AstNode {
    this.advance();
    return this.parseExpression();
  }

  advance(kind?: number, value?: string) {
    if (!this.matches(kind, value)) {
      throw new Error(`Expected kind ${kind} (${value}), was ${this.token}`);
    }
    let t = this.tokenizer.nextToken();
    this.token = t;
    this.kind = t && t.kind;
    this.value = t && t.value;
  }

  matches(kind: number, value?: string): boolean {
    return !(kind && (this.kind !== kind) || value && (this.value !== value));
  }

  parseExpression(): AstNode {
    if (!this.token) return this.ast.empty();
    let expr = this.parseUnary();
    return (!expr) ? null : this.parsePrecedence(expr, 0);
  }

  // parsePrecedence and parseBinary implement the precedence climbing
  // algorithm as described in:
  // http://en.wikipedia.org/wiki/Operator-precedence_parser#Precedence_climbing_method
  parsePrecedence(left: AstNode, precedence: number): AstNode {
    // console.assert(left != null);
    while (this.token) {
      if (this.matches(GROUPER, '(')) {
        let args = this.parseArguments();
        left = this.ast.invoke(left, null, args);
      } else if (this.matches(GROUPER, '[')) {
        let indexExpr = this.parseIndex();
        left = this.ast.index(left, indexExpr);
      } else if (this.matches(DOT)) {
        this.advance();
        let right = this.parseUnary();
        left = this.makeInvokeOrGetter(left, right);
      } else if (this.matches(KEYWORD)) {
        break;
      } else if (this.matches(OPERATOR)
          && this.token.precedence >= precedence) {
        left = this.value === '?'
            ? this.parseTernary(left)
            : this.parseBinary(left);
      } else {
        break;
      }
    }
    return left;
  }

  makeInvokeOrGetter(left: AstNode, right: AstNode): AstNode {
    if (right.type === 'ID') {
      return this.ast.getter(left, (<ast.IdAstNode>right).value);
    } else if (right.type === 'Invoke' &&
        (<ast.InvokeAstNode>right).receiver.type === 'ID') {
      let invoke = <ast.InvokeAstNode>right;
      let method = <ast.IdAstNode>invoke.receiver;
      return this.ast.invoke(left, method.value, invoke.arguments);
    } else {
      throw new Error(`expected identifier: ${right}`);
    }
  }

  parseBinary(left: AstNode): AstNode {
    let op = this.token;
    if (BINARY_OPERATORS.indexOf(op.value) === -1) {
      throw new Error(`unknown operator: ${op.value}`);
    }
    this.advance();
    let right = this.parseUnary();
    while ((this.kind === OPERATOR
            || this.kind === DOT
            || this.kind === GROUPER)
        && this.token.precedence > op.precedence) {
      right = this.parsePrecedence(right, this.token.precedence);
    }
    return this.ast.binary(left, op.value, right);
  }

  parseUnary(): AstNode {
    if (this.matches(OPERATOR)) {
      let value = this.value;
      this.advance();
      // handle unary + and - on numbers as part of the literal, not as a
      // unary operator
      if (value === '+' || value === '-') {
        if (this.matches(INTEGER)) {
          return this.parseInteger(value);
        } else if (this.matches(DECIMAL)) {
          return this.parseDecimal(value);
        }
      }
      if (UNARY_OPERATORS.indexOf(value) === -1) throw new Error(`unexpected token: ${value}`);
      let expr = this.parsePrecedence(this.parsePrimary(), POSTFIX_PRECEDENCE);
      return this.ast.unary(value, expr);
    }
    return this.parsePrimary();
  }

  parseTernary(condition: AstNode): AstNode {
    this.advance(OPERATOR, '?');
    let trueExpr = this.parseExpression();
    this.advance(COLON);
    let falseExpr = this.parseExpression();
    return this.ast.ternary(condition, trueExpr, falseExpr);
  }

  parsePrimary(): AstNode {
    switch (this.kind) {
      case KEYWORD:
        let keyword = this.value;
        if (keyword === 'this') {
          this.advance();
          // TODO(justin): return keyword node
          return this.ast.id(keyword);
        } else if (KEYWORDS.indexOf(keyword) !== -1) {
          throw new Error(`unexpected keyword: ${keyword}`);
        }
        throw new Error(`unrecognized keyword: ${keyword}`);
      case IDENTIFIER:
        return this.parseInvokeOrIdentifier();
      case STRING:
        return this.parseString();
      case INTEGER:
        return this.parseInteger();
      case DECIMAL:
        return this.parseDecimal();
      case GROUPER:
        if (this.value === '(') {
          return this.parseParen();
        } else if (this.value === '{') {
          return this.parseMap();
        } else if (this.value === '[') {
          return this.parseList();
        }
        return null;
      case COLON:
        throw new Error('unexpected token ":"');
      default:
        return null;
    }
  }

  parseList(): ast.ListAstNode {
    let items: AstNode[] = [];
    do {
      this.advance();
      if (this.matches(GROUPER, ']')) break;
      items.push(this.parseExpression());
    } while (this.matches(COMMA));
    this.advance(GROUPER, ']');
    return this.ast.list(items);
  }

  parseMap(): ast.MapAstNode {
    let entries: {[key: string]: AstNode} = {};
    do {
      this.advance();
      if (this.matches(GROUPER, '}')) break;
      let key = this.value;
      this.advance(STRING);
      this.advance(COLON);
      entries[key] = this.parseExpression();
    } while (this.matches(COMMA));
    this.advance(GROUPER, '}');
    return this.ast.map(entries);
  }

  parseInvokeOrIdentifier(): AstNode {
    let value = this.value;
    if (value === 'true') {
      this.advance();
      return this.ast.literal(true);
    }
    if (value === 'false') {
      this.advance();
      return this.ast.literal(false);
    }
    if (value === 'null') {
      this.advance();
      return this.ast.literal(null);
    }
    let identifier = this.parseIdentifier();
    let args = this.parseArguments();
    return (!args) ? identifier : this.ast.invoke(identifier, null, args);
  }

  parseIdentifier(): ast.IdAstNode {
    if (!this.matches(IDENTIFIER)) {
      throw new Error(`expected identifier: ${this.value}`);
    }
    let value = this.value;
    this.advance();
    return this.ast.id(value);
  }

  parseArguments(): AstNode[] {
    if (this.matches(GROUPER, '(')) {
      let args: AstNode[] = [];
      do {
        this.advance();
        if (this.matches(GROUPER, ')')) {
          break;
        }
        let expr = this.parseExpression();
        args.push(expr);
      } while (this.matches(COMMA));
      this.advance(GROUPER, ')');
      return args;
    }
    return null;
  }

  parseIndex(): AstNode {
    if (this.matches(GROUPER, '[')) {
      this.advance();
      let expr = this.parseExpression();
      this.advance(GROUPER, ']');
      return expr;
    }
    return null;
  }

  parseParen(): AstNode {
    this.advance();
    let expr = this.parseExpression();
    this.advance(GROUPER, ')');
    return this.ast.paren(expr);
  }

  parseString(): ast.LiteralAstNode {
    let value = this.ast.literal(this.value);
    this.advance();
    return value;
  }

  parseInteger(prefix?: string): ast.LiteralAstNode {
    prefix = prefix || '';
    let value = this.ast.literal(parseInt(`${prefix}${this.value}`, 10));
    this.advance();
    return value;
  }

  parseDecimal(prefix?: string): ast.LiteralAstNode {
    prefix = prefix || '';
    let value = this.ast.literal(parseFloat(`${prefix}${this.value}`));
    this.advance();
    return value;
  }

}
