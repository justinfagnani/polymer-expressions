define("polymer-expressions/ast_factory", ["require", "exports"], function (require, exports) {
    'use strict';
    var AstFactory = (function () {
        function AstFactory() {
        }
        AstFactory.prototype.empty = function () {
            // TODO(justinfagnani): return null instead?
            return {
                type: 'Empty',
            };
        };
        // TODO(justinfagnani): just use a JS literal?
        AstFactory.prototype.literal = function (v) {
            return {
                type: 'Literal',
                value: v,
            };
        };
        AstFactory.prototype.id = function (v) {
            return {
                type: 'ID',
                value: v,
            };
        };
        AstFactory.prototype.unary = function (op, expr) {
            return {
                type: 'Unary',
                operator: op,
                child: expr,
            };
        };
        AstFactory.prototype.binary = function (l, op, r) {
            return {
                type: 'Binary',
                operator: op,
                left: l,
                right: r,
            };
        };
        AstFactory.prototype.getter = function (receiver, name) {
            return {
                type: 'Getter',
                receiver: receiver,
                name: name,
            };
        };
        AstFactory.prototype.invoke = function (receiver, method, args) {
            if (args == null) {
                throw new Error('args');
            }
            return {
                type: 'Invoke',
                receiver: receiver,
                method: method,
                arguments: args,
            };
        };
        AstFactory.prototype.paren = function (e) {
            return e;
            // return {
            //   type: 'Paren',
            //   child: e,
            // };
        };
        AstFactory.prototype.index = function (e, a) {
            return {
                type: 'Index',
                receiver: e,
                argument: a,
            };
        };
        AstFactory.prototype.ternary = function (c, t, f) {
            return {
                type: 'Ternary',
                condition: c,
                trueExpr: t,
                falseExpr: f,
            };
        };
        AstFactory.prototype.map = function (entries) {
            return {
                type: 'Map',
                entries: entries,
            };
        };
        AstFactory.prototype.list = function (l) {
            return {
                type: 'List',
                items: l,
            };
        };
        return AstFactory;
    }());
    exports.AstFactory = AstFactory;
});
define("polymer-expressions/eval", ["require", "exports"], function (require, exports) {
    'use strict';
    var _BINARY_OPERATORS = {
        '+': function (a, b) { return a + b; },
        '-': function (a, b) { return a - b; },
        '*': function (a, b) { return a * b; },
        '/': function (a, b) { return a / b; },
        '%': function (a, b) { return a % b; },
        // tslint:disable-next-line:triple-equals
        '==': function (a, b) { return a == b; },
        // tslint:disable-next-line:triple-equals
        '!=': function (a, b) { return a != b; },
        '===': function (a, b) { return a === b; },
        '!==': function (a, b) { return a !== b; },
        '>': function (a, b) { return a > b; },
        '>=': function (a, b) { return a >= b; },
        '<': function (a, b) { return a < b; },
        '<=': function (a, b) { return a <= b; },
        '||': function (a, b) { return a || b; },
        '&&': function (a, b) { return a && b; },
        '|': function (a, f) { return f(a); },
    };
    var _UNARY_OPERATORS = {
        '+': function (a) { return a; },
        '-': function (a) { return -a; },
        '!': function (a) { return !a; },
    };
    exports.createScope = function (parent) {
        var scope = Object.create(parent);
        scope['this'] = scope['this'] || parent;
        return scope;
    };
    var EvalAstFactory = (function () {
        function EvalAstFactory() {
        }
        EvalAstFactory.prototype.empty = function () {
            // TODO(justinfagnani): return null instead?
            return {
                type: 'Empty',
                evaluate: function (scope) { return scope; },
                getIds: function (idents) { return idents; },
            };
        };
        // TODO(justinfagnani): just use a JS literal?
        EvalAstFactory.prototype.literal = function (v) {
            return {
                type: 'Literal',
                value: v,
                evaluate: function (scope) { return this.value; },
                getIds: function (idents) { return idents; },
            };
        };
        EvalAstFactory.prototype.id = function (v) {
            return {
                type: 'ID',
                value: v,
                evaluate: function (scope) {
                    // TODO(justinfagnani): this prevernts access to properties named 'this'
                    if (this.value === 'this')
                        return scope;
                    return scope[this.value];
                },
                getIds: function (idents) {
                    idents.push(this.value);
                    return idents;
                },
            };
        };
        EvalAstFactory.prototype.unary = function (op, expr) {
            var f = _UNARY_OPERATORS[op];
            return {
                type: 'Unary',
                operator: op,
                child: expr,
                evaluate: function (scope) {
                    return f(this.child.evaluate(scope));
                },
                getIds: function (idents) { return this.child.getIds(idents); },
            };
        };
        EvalAstFactory.prototype.binary = function (l, op, r) {
            var f = _BINARY_OPERATORS[op];
            return {
                type: 'Binary',
                operator: op,
                left: l,
                right: r,
                evaluate: function (scope) {
                    return f(this.left.evaluate(scope), this.right.evaluate(scope));
                },
                getIds: function (idents) {
                    this.left.getIds(idents);
                    this.right.getIds(idents);
                    return idents;
                },
            };
        };
        EvalAstFactory.prototype.getter = function (g, n) {
            return {
                type: 'Getter',
                receiver: g,
                name: n,
                evaluate: function (scope) {
                    return this.receiver.evaluate(scope)[this.name];
                },
                getIds: function (idents) {
                    this.receiver.getIds(idents);
                    return idents;
                },
            };
        };
        EvalAstFactory.prototype.invoke = function (receiver, method, args) {
            if (method != null && typeof method !== 'string') {
                throw new Error('method not a string');
            }
            return {
                type: 'Invoke',
                receiver: receiver,
                method: method,
                arguments: args,
                evaluate: function (scope) {
                    var receiver = this.receiver.evaluate(scope);
                    // TODO(justinfagnani): this might be wrong in cases where we're
                    // invoking a top-level function rather than a method. If method is
                    // defined on a nested scope, then we should probably set _this to null.
                    var _this = this.method ? receiver : scope['this'] || scope;
                    var f = this.method ? receiver[method] : receiver;
                    var argValues = this.arguments.map(function (a) { return a.evaluate(scope); });
                    return f.apply(_this, argValues);
                },
                getIds: function (idents) {
                    this.receiver.getIds(idents);
                    this.arguments.forEach(function (a) { return a.getIds(idents); });
                    return idents;
                },
            };
        };
        EvalAstFactory.prototype.paren = function (e) {
            return e;
        };
        EvalAstFactory.prototype.index = function (e, a) {
            return {
                type: 'Index',
                receiver: e,
                argument: a,
                evaluate: function (scope) {
                    return this.receiver.evaluate(scope)[this.argument.evaluate(scope)];
                },
                getIds: function (idents) {
                    this.receiver.getIds(idents);
                    return idents;
                },
            };
        };
        EvalAstFactory.prototype.ternary = function (c, t, f) {
            return {
                type: 'Ternary',
                condition: c,
                trueExpr: t,
                falseExpr: f,
                evaluate: function (scope) {
                    var c = this.condition.evaluate(scope);
                    if (c) {
                        return this.trueExpr.evaluate(scope);
                    }
                    else {
                        return this.falseExpr.evaluate(scope);
                    }
                },
                getIds: function (idents) {
                    this.condition.getIds(idents);
                    this.trueExpr.getIds(idents);
                    this.falseExpr.getIds(idents);
                    return idents;
                },
            };
        };
        EvalAstFactory.prototype.map = function (entries) {
            return {
                type: 'Map',
                entries: entries,
                evaluate: function (scope) {
                    var map = {};
                    for (var key in entries) {
                        map[key] = this.entries[key].evaluate(scope);
                    }
                    return map;
                },
                getIds: function (idents) {
                    for (var key in entries) {
                        this.entries[key].getIds(idents);
                    }
                    return idents;
                },
            };
        };
        // TODO(justinfagnani): if the list is deeply literal
        EvalAstFactory.prototype.list = function (l) {
            return {
                type: 'List',
                items: l,
                evaluate: function (scope) {
                    return this.items.map(function (a) { return a.evaluate(scope); });
                },
                getIds: function (idents) {
                    this.items.forEach(function (i) { return i.getIds(idents); });
                    return idents;
                },
            };
        };
        return EvalAstFactory;
    }());
    exports.EvalAstFactory = EvalAstFactory;
});
define("polymer-expressions/parser", ["require", "exports"], function (require, exports) {
    'use strict';
    var GROUPERS = '()[]{}';
    var OPERATORS = '+-*/!&%<=>?^|';
    var TWO_CHAR_OPS = ['==', '!=', '<=', '>=', '||', '&&'];
    var THREE_CHAR_OPS = ['===', '!=='];
    var KEYWORDS = ['this'];
    var UNARY_OPERATORS = ['+', '-', '!'];
    var BINARY_OPERATORS = ['+', '-', '*', '/', '%', '^', '==',
        '!=', '>', '<', '>=', '<=', '||', '&&', '&', '===', '!==', '|'];
    exports.PRECEDENCE = {
        '!': 0,
        ':': 0,
        ',': 0,
        ')': 0,
        ']': 0,
        '}': 0,
        '?': 1,
        '||': 2,
        '&&': 3,
        '|': 4,
        '^': 5,
        '&': 6,
        // equality
        '!=': 7,
        '==': 7,
        '!==': 7,
        '===': 7,
        // relational
        '>=': 8,
        '>': 8,
        '<=': 8,
        '<': 8,
        // additive
        '+': 9,
        '-': 9,
        // multiplicative
        '%': 10,
        '/': 10,
        '*': 10,
        // postfix
        '(': 11,
        '[': 11,
        '.': 11,
        '{': 11,
    };
    exports.POSTFIX_PRECEDENCE = 11;
    exports.STRING = 1;
    exports.IDENTIFIER = 2;
    exports.DOT = 3;
    exports.COMMA = 4;
    exports.COLON = 5;
    exports.INTEGER = 6;
    exports.DECIMAL = 7;
    exports.OPERATOR = 8;
    exports.GROUPER = 9;
    exports.KEYWORD = 10;
    function token(kind, value, precedence) {
        return {
            kind: kind,
            value: value,
            precedence: precedence || 0,
        };
    }
    exports.token = token;
    function isWhitespace(next) {
        return /^\s$/.test(next);
    }
    // TODO(justinfagnani): allow code points > 127
    function isIdentOrKeywordStart(next) {
        return /^[a-zA-Z_$]$/.test(next);
    }
    // TODO(justinfagnani): allow code points > 127
    function isIdentifier(next) {
        return /^[a-zA-Z0-9_$]$/.test(next);
    }
    function isKeyword(str) {
        return KEYWORDS.indexOf(str) !== -1;
    }
    function isQuote(next) {
        return /^[\"\']$/.test(next);
    }
    function isNumber(next) {
        return /^[0-9]$/.test(next);
    }
    function isOperator(next) {
        return OPERATORS.indexOf(next) !== -1;
    }
    function isGrouper(next) {
        return GROUPERS.indexOf(next) !== -1;
    }
    function escapeString(str) {
        return str.replace(/\\(.)/g, function (match, group) {
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
    var Tokenizer = (function () {
        function Tokenizer(input) {
            this.index = -1;
            this.tokenStart = 0;
            this.next = null;
            this.input = input;
        }
        Tokenizer.prototype.advance = function (resetTokenStart) {
            if (this.index < this.input.length) {
                this.index++;
                this.next = this.input[this.index];
                if (resetTokenStart) {
                    this.tokenStart = this.index;
                }
            }
            else {
                this.next = null;
            }
        };
        Tokenizer.prototype.getValue = function (lookahead) {
            var v = this.input.substring(this.tokenStart, this.index + (lookahead || 0));
            if (!lookahead)
                this.clearValue();
            return v;
        };
        Tokenizer.prototype.clearValue = function () {
            this.tokenStart = this.index;
        };
        Tokenizer.prototype.nextToken = function () {
            if (this.index === -1)
                this.advance();
            while (isWhitespace(this.next)) {
                this.advance(true);
            }
            if (isQuote(this.next))
                return this.tokenizeString();
            if (isIdentOrKeywordStart(this.next))
                return this.tokenizeIdentOrKeyword();
            if (isNumber(this.next))
                return this.tokenizeNumber();
            if (this.next === '.')
                return this.tokenizeDot();
            if (this.next === ',')
                return this.tokenizeComma();
            if (this.next === ':')
                return this.tokenizeColon();
            if (isOperator(this.next))
                return this.tokenizeOperator();
            if (isGrouper(this.next))
                return this.tokenizeGrouper();
            // no match, should be end of input
            this.advance();
            // console.assert(!this.next);
            return null;
        };
        Tokenizer.prototype.tokenizeString = function () {
            var us = 'unterminated string';
            var quoteChar = this.next;
            this.advance(true);
            while (this.next !== quoteChar) {
                if (!this.next)
                    throw new Error(us);
                if (this.next === '\\') {
                    this.advance();
                    if (!this.next)
                        throw new Error(us);
                }
                this.advance();
            }
            var t = token(exports.STRING, escapeString(this.getValue()));
            this.advance();
            return t;
        };
        Tokenizer.prototype.tokenizeIdentOrKeyword = function () {
            while (isIdentifier(this.next)) {
                this.advance();
            }
            var value = this.getValue();
            var kind = isKeyword(value) ? exports.KEYWORD : exports.IDENTIFIER;
            return token(kind, value);
        };
        Tokenizer.prototype.tokenizeNumber = function () {
            while (isNumber(this.next)) {
                this.advance();
            }
            if (this.next === '.')
                return this.tokenizeDot();
            return token(exports.INTEGER, this.getValue());
        };
        Tokenizer.prototype.tokenizeDot = function () {
            this.advance();
            if (isNumber(this.next))
                return this.tokenizeFraction();
            this.clearValue();
            return token(exports.DOT, '.', exports.POSTFIX_PRECEDENCE);
        };
        Tokenizer.prototype.tokenizeComma = function () {
            this.advance(true);
            return token(exports.COMMA, ',');
        };
        Tokenizer.prototype.tokenizeColon = function () {
            this.advance(true);
            return token(exports.COLON, ':');
        };
        Tokenizer.prototype.tokenizeFraction = function () {
            while (isNumber(this.next)) {
                this.advance();
            }
            return token(exports.DECIMAL, this.getValue());
        };
        Tokenizer.prototype.tokenizeOperator = function () {
            this.advance();
            var op = this.getValue(2);
            if (THREE_CHAR_OPS.indexOf(op) !== -1) {
                this.advance();
                this.advance();
            }
            else {
                op = this.getValue(1);
                if (TWO_CHAR_OPS.indexOf(op) !== -1) {
                    this.advance();
                }
            }
            op = this.getValue();
            return token(exports.OPERATOR, op, exports.PRECEDENCE[op]);
        };
        Tokenizer.prototype.tokenizeGrouper = function () {
            var value = this.next;
            var t = token(exports.GROUPER, value, exports.PRECEDENCE[value]);
            this.advance(true);
            return t;
        };
        return Tokenizer;
    }());
    exports.Tokenizer = Tokenizer;
    function parse(expr, astFactory) {
        return new Parser(expr, astFactory).parse();
    }
    exports.parse = parse;
    var Parser = (function () {
        function Parser(input, astFactory) {
            this.tokenizer = new Tokenizer(input);
            this.ast = astFactory;
            this.token = null;
            this.kind = null;
            this.value = null;
        }
        Parser.prototype.parse = function () {
            this.advance();
            return this.parseExpression();
        };
        Parser.prototype.advance = function (kind, value) {
            if (!this.matches(kind, value)) {
                throw new Error("Expected kind " + kind + " (" + value + "), was " + this.token);
            }
            var t = this.tokenizer.nextToken();
            this.token = t;
            this.kind = t && t.kind;
            this.value = t && t.value;
        };
        Parser.prototype.matches = function (kind, value) {
            return !(kind && (this.kind !== kind) || value && (this.value !== value));
        };
        Parser.prototype.parseExpression = function () {
            if (!this.token)
                return this.ast.empty();
            var expr = this.parseUnary();
            return (!expr) ? null : this.parsePrecedence(expr, 0);
        };
        // parsePrecedence and parseBinary implement the precedence climbing
        // algorithm as described in:
        // http://en.wikipedia.org/wiki/Operator-precedence_parser#Precedence_climbing_method
        Parser.prototype.parsePrecedence = function (left, precedence) {
            // console.assert(left != null);
            while (this.token) {
                if (this.matches(exports.GROUPER, '(')) {
                    var args = this.parseArguments();
                    left = this.ast.invoke(left, null, args);
                }
                else if (this.matches(exports.GROUPER, '[')) {
                    var indexExpr = this.parseIndex();
                    left = this.ast.index(left, indexExpr);
                }
                else if (this.matches(exports.DOT)) {
                    this.advance();
                    var right = this.parseUnary();
                    left = this.makeInvokeOrGetter(left, right);
                }
                else if (this.matches(exports.KEYWORD)) {
                    break;
                }
                else if (this.matches(exports.OPERATOR)
                    && this.token.precedence >= precedence) {
                    left = this.value === '?'
                        ? this.parseTernary(left)
                        : this.parseBinary(left);
                }
                else {
                    break;
                }
            }
            return left;
        };
        Parser.prototype.makeInvokeOrGetter = function (left, right) {
            if (right.type === 'ID') {
                return this.ast.getter(left, right.value);
            }
            else if (right.type === 'Invoke' &&
                right.receiver.type === 'ID') {
                var invoke = right;
                var method = invoke.receiver;
                return this.ast.invoke(left, method.value, invoke.arguments);
            }
            else {
                throw new Error("expected identifier: " + right);
            }
        };
        Parser.prototype.parseBinary = function (left) {
            var op = this.token;
            if (BINARY_OPERATORS.indexOf(op.value) === -1) {
                throw new Error("unknown operator: " + op.value);
            }
            this.advance();
            var right = this.parseUnary();
            while ((this.kind === exports.OPERATOR
                || this.kind === exports.DOT
                || this.kind === exports.GROUPER)
                && this.token.precedence > op.precedence) {
                right = this.parsePrecedence(right, this.token.precedence);
            }
            return this.ast.binary(left, op.value, right);
        };
        Parser.prototype.parseUnary = function () {
            if (this.matches(exports.OPERATOR)) {
                var value = this.value;
                this.advance();
                // handle unary + and - on numbers as part of the literal, not as a
                // unary operator
                if (value === '+' || value === '-') {
                    if (this.matches(exports.INTEGER)) {
                        return this.parseInteger(value);
                    }
                    else if (this.matches(exports.DECIMAL)) {
                        return this.parseDecimal(value);
                    }
                }
                if (UNARY_OPERATORS.indexOf(value) === -1)
                    throw new Error("unexpected token: " + value);
                var expr = this.parsePrecedence(this.parsePrimary(), exports.POSTFIX_PRECEDENCE);
                return this.ast.unary(value, expr);
            }
            return this.parsePrimary();
        };
        Parser.prototype.parseTernary = function (condition) {
            this.advance(exports.OPERATOR, '?');
            var trueExpr = this.parseExpression();
            this.advance(exports.COLON);
            var falseExpr = this.parseExpression();
            return this.ast.ternary(condition, trueExpr, falseExpr);
        };
        Parser.prototype.parsePrimary = function () {
            switch (this.kind) {
                case exports.KEYWORD:
                    var keyword = this.value;
                    if (keyword === 'this') {
                        this.advance();
                        // TODO(justin): return keyword node
                        return this.ast.id(keyword);
                    }
                    else if (KEYWORDS.indexOf(keyword) !== -1) {
                        throw new Error("unexpected keyword: " + keyword);
                    }
                    throw new Error("unrecognized keyword: " + keyword);
                case exports.IDENTIFIER:
                    return this.parseInvokeOrIdentifier();
                case exports.STRING:
                    return this.parseString();
                case exports.INTEGER:
                    return this.parseInteger();
                case exports.DECIMAL:
                    return this.parseDecimal();
                case exports.GROUPER:
                    if (this.value === '(') {
                        return this.parseParen();
                    }
                    else if (this.value === '{') {
                        return this.parseMap();
                    }
                    else if (this.value === '[') {
                        return this.parseList();
                    }
                    return null;
                case exports.COLON:
                    throw new Error('unexpected token ":"');
                default:
                    return null;
            }
        };
        Parser.prototype.parseList = function () {
            var items = [];
            do {
                this.advance();
                if (this.matches(exports.GROUPER, ']'))
                    break;
                items.push(this.parseExpression());
            } while (this.matches(exports.COMMA));
            this.advance(exports.GROUPER, ']');
            return this.ast.list(items);
        };
        Parser.prototype.parseMap = function () {
            var entries = {};
            do {
                this.advance();
                if (this.matches(exports.GROUPER, '}'))
                    break;
                var key = this.value;
                this.advance(exports.STRING);
                this.advance(exports.COLON);
                entries[key] = this.parseExpression();
            } while (this.matches(exports.COMMA));
            this.advance(exports.GROUPER, '}');
            return this.ast.map(entries);
        };
        Parser.prototype.parseInvokeOrIdentifier = function () {
            var value = this.value;
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
            var identifier = this.parseIdentifier();
            var args = this.parseArguments();
            return (!args) ? identifier : this.ast.invoke(identifier, null, args);
        };
        Parser.prototype.parseIdentifier = function () {
            if (!this.matches(exports.IDENTIFIER)) {
                throw new Error("expected identifier: " + this.value);
            }
            var value = this.value;
            this.advance();
            return this.ast.id(value);
        };
        Parser.prototype.parseArguments = function () {
            if (this.matches(exports.GROUPER, '(')) {
                var args = [];
                do {
                    this.advance();
                    if (this.matches(exports.GROUPER, ')')) {
                        break;
                    }
                    var expr = this.parseExpression();
                    args.push(expr);
                } while (this.matches(exports.COMMA));
                this.advance(exports.GROUPER, ')');
                return args;
            }
            return null;
        };
        Parser.prototype.parseIndex = function () {
            if (this.matches(exports.GROUPER, '[')) {
                this.advance();
                var expr = this.parseExpression();
                this.advance(exports.GROUPER, ']');
                return expr;
            }
            return null;
        };
        Parser.prototype.parseParen = function () {
            this.advance();
            var expr = this.parseExpression();
            this.advance(exports.GROUPER, ')');
            return this.ast.paren(expr);
        };
        Parser.prototype.parseString = function () {
            var value = this.ast.literal(this.value);
            this.advance();
            return value;
        };
        Parser.prototype.parseInteger = function (prefix) {
            prefix = prefix || '';
            var value = this.ast.literal(parseInt("" + prefix + this.value, 10));
            this.advance();
            return value;
        };
        Parser.prototype.parseDecimal = function (prefix) {
            prefix = prefix || '';
            var value = this.ast.literal(parseFloat("" + prefix + this.value));
            this.advance();
            return value;
        };
        return Parser;
    }());
    exports.Parser = Parser;
});
