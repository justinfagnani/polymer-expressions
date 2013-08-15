// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function (global) {
  'use strict';

  // SideTable is a weak map where possible. If WeakMap is not available the
  // association is stored as an expando property.
  var SideTable;
  // TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
  if (typeof WeakMap !== 'undefined' && navigator.userAgent.indexOf('Firefox/') < 0) {
    SideTable = WeakMap;
  } else {
    (function() {
      var defineProperty = Object.defineProperty;
      var hasOwnProperty = Object.hasOwnProperty;
      var counter = new Date().getTime() % 1e9;

      SideTable = function() {
        this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
      };

      SideTable.prototype = {
        set: function(key, value) {
          defineProperty(key, this.name, {value: value, writable: true});
        },
        get: function(key) {
          return hasOwnProperty.call(key, this.name) ? key[this.name] : undefined;
        },
        delete: function(key) {
          this.set(key, undefined);
        }
      }
    })();
  }

  var identStart = '[\$_a-zA-Z]';
  var identPart = '[\$_a-zA-Z0-9]';
  var ident = identStart + '+' + identPart + '*';
  var capturedIdent = '(' + ident + ')';
  var elementIndex = '(?:[0-9]|[1-9]+[0-9]+)';
  var identOrElementIndex = '(?:' + ident + '|' + elementIndex + ')';
  var path = '(?:' +
                identOrElementIndex +
              ')(?:\\.' +
                identOrElementIndex +
              ')*';

  var pathPattern = new RegExp('^' + path + '$');
  var repeatPattern = new RegExp('^' + capturedIdent + '\\s* in (.*)$');
  var bindPattern = new RegExp('^(.*) as \\s*' + capturedIdent + '$');

  var templateScopeTable = new SideTable;

  function getNamedScopeBinding(model, pathString, name, node) {
    if (node.nodeType !== Node.ELEMENT_NODE || node.tagName !== 'TEMPLATE' ||
       (name !== 'bind' && name !== 'repeat')) {
      return;
    }

    var ident, expressionText;
    var match = pathString.match(repeatPattern);
    if (match) {
      ident = match[1];
      expressionText = match[2];
    } else {
      match = pathString.match(bindPattern);
      if (match) {
        ident = match[2];
        expressionText = match[1];
      }
    }
    if (!match)
      return;

    var binding;
    expressionText = expressionText.trim();
    if (expressionText.match(pathPattern)) {
      binding = new CompoundBinding(function(values) {
        return values.path;
      });
      binding.bind('path', model, expressionText);
    } else {
      try {
        binding = getExpressionBinding(model, expressionText);
      } catch (ex) {
        console.error('Invalid expression syntax: ' + expressionText, ex);
      }
    }

    if (!binding)
      return;

    templateScopeTable.set(node, ident);
    return binding;
  }

  function getExpressionBinding(model, expressionText) {
    try {
      // TODO(rafaelw): Cache expressions.
      var delegate = new ASTDelegate();
      esprima.parse(expressionText, delegate);

      if (!delegate.expression && !delegate.labeledStatements.length)
        return;

      // TODO(rafaelw): This is a bit of hack. We'd like to support syntax for
      // binding to class like class="{{ foo: bar; baz: bat }}", so we're
      // abusing ECMAScript labelled statements for this use. The main downside
      // is that ECMAScript indentifiers are more limited than CSS classnames.
      var resolveFn = delegate.labeledStatements.length ?
          newLabeledResolve(delegate.labeledStatements) :
          resolveFn = delegate.expression;

      var paths = [];
      for (var prop in delegate.deps) {
        paths.push(prop);
      }

      if (!paths.length)
        return { value: resolveFn({}) }; // only literals in expression.

      var binding = new CompoundBinding(resolveFn);
      for (var i = 0; i < paths.length; i++) {
        binding.bind(paths[i], model, paths[i]);
      }

      return binding;
    } catch (ex) {
      console.error('Invalid expression syntax: ' + expressionText, ex);
    }
  }

  function newLabeledResolve(labeledStatements) {
    return function(values) {
      var labels = [];
      for (var i = 0; i < labeledStatements.length; i++) {
        if (labeledStatements[i].expression(values))
          labels.push(labeledStatements[i].label);
      }

      return labels.join(' ');
    }
  }

  function IdentPath(deps, name, last) {
    this.deps = deps;
    this.name = name;
    this.last = last;
  }

  IdentPath.prototype = {
    getPath: function() {
      if (!this.last)
        return this.name;

      return this.last.getPath() + '.' + this.name;
    },

    valueFn: function() {
      var path = this.getPath();
      this.deps[path] = true;
      return function(values) {
        return values[path];
      };
    }
  };

  function Filter(name, args) {
    this.name = name;
    this.args = args;
  }

  function ASTDelegate() {
    this.expression = null;
    this.filters = [];
    this.labeledStatements = [];
    this.deps = {};
    this.currentPath = undefined;
  }

  function notImplemented() { throw Error('Not Implemented'); }

  var unaryOperators = {
    '+': function(v) { return +v; },
    '-': function(v) { return -v; },
    '!': function(v) { return !v; }
  };

  var binaryOperators = {
    '+': function(l, r) { return l+r; },
    '-': function(l, r) { return l-r; },
    '*': function(l, r) { return l*r; },
    '/': function(l, r) { return l/r; },
    '%': function(l, r) { return l%r; },
    '<': function(l, r) { return l<r; },
    '>': function(l, r) { return l>r; },
    '<=': function(l, r) { return l<=r; },
    '>=': function(l, r) { return l>=r; },
    '==': function(l, r) { return l==r; },
    '!=': function(l, r) { return l!=r; },
    '===': function(l, r) { return l===r; },
    '!==': function(l, r) { return l!==r; },
    '&&': function(l, r) { return l&&r; },
    '||': function(l, r) { return l||r; },
  };

  function getFn(arg) {
    return arg instanceof IdentPath ? arg.valueFn() : arg;
  }

  ASTDelegate.prototype = {

    createLabeledStatement: function(label, expression) {
      this.labeledStatements.push({
        label: label,
        expression: expression instanceof IdentPath ? expression.valueFn() : expression
      });
      return expression;
    },

    createUnaryExpression: function(op, argument) {
      if (!unaryOperators[op])
        throw Error('Disallowed operator: ' + op);

      argument = getFn(argument);

      return function(values) {
        return unaryOperators[op](argument(values));
      };
    },

    createBinaryExpression: function(op, left, right) {
      if (!binaryOperators[op])
        throw Error('Disallowed operator: ' + op);

      left = getFn(left);
      right = getFn(right);

      return function(values) {
        return binaryOperators[op](left(values), right(values));
      };
    },

    createConditionalExpression: function(test, consequent, alternate) {
      test = getFn(test);
      consequent = getFn(consequent);
      alternate = getFn(alternate);

      return function(values) {
        return test(values) ? consequent(values) : alternate(values);
      }
    },

    createIdentifier: function(name) {
      var ident = new IdentPath(this.deps, name);
      ident.type = 'Identifier';
      return ident;
    },

    createMemberExpression: function(accessor, object, property) {
      if (accessor === '[') {
        object = getFn(object);
        property = getFn(property);
        return function(values) {
          return object(values)[property(values)];
        };
      }
      return new IdentPath(this.deps, property.name, object);
    },

    createLiteral: function(token) {
      return function() { return token.value; };
    },

    createArrayExpression: function(elements) {
      for (var i = 0; i < elements.length; i++)
        elements[i] = getFn(elements[i]);

      return function(values) {
        var arr = []
        for (var i = 0; i < elements.length; i++)
          arr.push(elements[i](values));
        return arr;
      }
    },

    createProperty: function(kind, key, value) {
      return {
        key: key instanceof IdentPath ? key.getPath() : key(),
        value: value
      };
    },

    createObjectExpression: function(properties) {
      for (var i = 0; i < properties.length; i++)
        properties[i].value = getFn(properties[i].value);

      return function(values) {
        var obj = {};
        for (var i = 0; i < properties.length; i++)
          obj[properties[i].key] = properties[i].value(values);
        return obj;
      }
    },

    createFilter: function(name, args) {
      var argValues = args.map(function(f) {
        return f();
      });
      this.filters.push(new Filter(name, argValues));
    },

    createTopLevel: function(expression) {
      this.expression = getFn(expression);
    },

    createThisExpression: notImplemented
  }

  function PolymerExpressions() {}

  PolymerExpressions.prototype = {
    getBinding: function(model, pathString, name, node) {
      pathString = pathString.trim();
      if (!pathString || pathString.match(pathPattern))
        return; // bail out early if pathString is simple path.

      return getNamedScopeBinding(model, pathString, name, node) ||
             getExpressionBinding(model, pathString, name, node);
    },

    getInstanceModel: function(template, model) {
      var scopeName = templateScopeTable.get(template);
      if (!scopeName)
        return model;

      var parentScope = template.templateInstance ?
          template.templateInstance.model :
          template.model;

      var scope = Object.create(parentScope);
      scope[scopeName] = model;
      return scope;
    }
  };

  global.PolymerExpressions = PolymerExpressions;

})(this);