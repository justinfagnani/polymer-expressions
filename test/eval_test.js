'use strict';

let assert = require('assert');
let parser = require('../lib/parser');
let evaluate = require('../lib/eval');

let Parser = parser.Parser;

let astFactory = new evaluate.EvalAstFactory();

function expectEval(s, expected, scope) {
  var expr = new Parser(s, astFactory).parse();
  var result = expr.evaluate(scope);
  assert.deepEqual(result, expected);
}

suite('eval', function() {

  test('should return the model for an empty expression', function() {
    expectEval('', 'model', 'model');
  });

  test('should handle the "this" keyword', function() {
    expectEval('this', 'model', 'model');
    expectEval('this.name', 'foo', {name: 'foo'});
    expectEval('this["a"]', 'x', {'a': 'x'});
  });

  test('should return a literal int', function() {
    expectEval('1', 1);
    expectEval('+1', 1);
    expectEval('-1', -1);
  });

  test('should return a literal double', function() {
    expectEval('1.2', 1.2);
    expectEval('+1.2', 1.2);
    expectEval('-1.2', -1.2);
  });

  test('should return a literal string', function() {
    expectEval('"hello"', "hello");
    expectEval("'hello'", "hello");
  });

  test('should return a literal boolean', function() {
    expectEval('true', true);
    expectEval('false', false);
  });

  test('should return a literal null', function() {
    expectEval('null', null);
  });

  test('should return a literal list', function() {
    expectEval('[1, 2, 3]', [1, 2, 3]);
  });

  test('should return a literal map', function() {
    expectEval('{"a": 1}', {'a': 1});
  });

  test('should access properties of a literal map', function() {
    expectEval('{"a": 1}.a', 1);
  });

  test('should evaluate unary operators', function() {
    expectEval('+a', 2, {'a': 2});
    expectEval('-a', -2, {'a': 2});
    expectEval('!a', false, {'a': true});
  });

  test('should evaluate binary operators', function() {
    expectEval('1 + 2', 3);
    expectEval('2 - 1', 1);
    expectEval('4 / 2', 2);
    expectEval('2 * 3', 6);
    expectEval('5 % 2', 1);
    expectEval('5 % -2', 1);
    expectEval('-5 % 2', -1);

    expectEval('1 == 1', true);
    expectEval('1 == 2', false);
    expectEval('1 == null', false);
    expectEval('1 != 1', false);
    expectEval('1 != 2', true);
    expectEval('1 != null', true);

    var x = {};
    var y = {};
    expectEval('x === y', true, {'x': x, 'y': x});
    expectEval('x !== y', false, {'x': x, 'y': x});
    expectEval('x === y', false, {'x': x, 'y': y});
    expectEval('x !== y', true, {'x': x, 'y': y});

    expectEval('1 > 1', false);
    expectEval('1 > 2', false);
    expectEval('2 > 1', true);
    expectEval('1 >= 1', true);
    expectEval('1 >= 2', false);
    expectEval('2 >= 1', true);
    expectEval('1 < 1', false);
    expectEval('1 < 2', true);
    expectEval('2 < 1', false);
    expectEval('1 <= 1', true);
    expectEval('1 <= 2', true);
    expectEval('2 <= 1', false);

    expectEval('true || true', true);
    expectEval('true || false', true);
    expectEval('false || true', true);
    expectEval('false || false', false);

    expectEval('true && true', true);
    expectEval('true && false', false);
    expectEval('false && true', false);
    expectEval('false && false', false);
  });

  test('should evaulate ternary operators', function() {
    expectEval('true ? 1 : 2', 1);
    expectEval('false ? 1 : 2', 2);
    expectEval('true ? true ? 1 : 2 : 3', 1);
    expectEval('true ? false ? 1 : 2 : 3', 2);
    expectEval('false ? true ? 1 : 2 : 3', 3);
    expectEval('false ? 1 : true ? 2 : 3', 2);
    expectEval('false ? 1 : false ? 2 : 3', 3);
    expectEval('null ? 1 : 2', 2);
  });

  test('should call functions in scope', function() {
    var foo = {
      x: function() { return 42; },
      y: function(i, j) { return i * j; },
      name: 'fred',
    };
    expectEval('x()', foo.x(), foo);
    expectEval('name', foo.name, foo);
    expectEval('y(5, 10)', 50, foo);
  });

  test('should call functions with `this` as scope', function() {
    var o = {
      foo: 'bar',
      checkThis() {
        return this.foo === 'bar';
      },
    };
    expectEval('checkThis()', true, o);
  });

  test('should call functions with `this` in nested scopes', function() {
    var o = {
      getThis() {
        return this;
      },
    };
    var scope = Object.create(o);
    scope['this'] = o;
    expectEval('getThis()', o, scope);
  });

  test('should call methods with `this` as receiver', function() {
    var scope = {
      foo: {
        getThis() {
          return this;
        },
      },
    };
    expectEval('foo.getThis()', scope.foo, scope);
  });

  test('should invoke chained methods', function() {
    var foo = {
      a: function() {
        return function() {
          return 1;
        };
      },
      x: function() { return 42; },
      name: 'fred',
    };
    expectEval('name.length', foo.name.length, foo);
    expectEval('x().toString()', foo.x().toString(), foo);
    expectEval('name.substring(2)', foo.name.substring(2), foo);
    expectEval('a()()', 1, foo);
  });


});
