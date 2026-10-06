const FUNCTIONS = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  clamp: (value, low, high) => Math.min(Math.max(value, low), high)
};

export function registerFunction(name, fn) {
  if ( typeof fn !== "function" ) throw new TypeError(`Expression function "${name}" must be a function`);
  FUNCTIONS[name] = fn;
}

const TOKEN_PATTERN = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_.]*)|(<=|>=|==|!=|&&|\|\||[-+*/%()<>,?:!]))/y;

function tokenize(source) {
  const tokens = [];
  TOKEN_PATTERN.lastIndex = 0;
  let index = 0;
  while ( index < source.length ) {
    if ( /^\s*$/.test(source.slice(index)) ) break;
    TOKEN_PATTERN.lastIndex = index;
    const match = TOKEN_PATTERN.exec(source);
    if ( !match ) throw new SyntaxError(`Unexpected character at ${index} in expression "${source}"`);
    if ( match[1] !== undefined ) tokens.push({type: "num", value: Number(match[1])});
    else if ( match[2] !== undefined ) tokens.push({type: "id", value: match[2]});
    else tokens.push({type: "op", value: match[3]});
    index = TOKEN_PATTERN.lastIndex;
  }
  return tokens;
}

const BINARY_PRECEDENCE = {
  "||": 1, "&&": 2,
  "==": 3, "!=": 3,
  "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5,
  "*": 6, "/": 6, "%": 6
};

function parse(source) {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const isOp = value => peek()?.type === "op" && peek().value === value;
  const expect = value => {
    if ( !isOp(value) ) throw new SyntaxError(`Expected "${value}" in expression "${source}"`);
    position++;
  };

  function parseTernary() {
    const test = parseBinary(1);
    if ( !isOp("?") ) return test;
    next();
    const yes = parseTernary();
    expect(":");
    const no = parseTernary();
    return {t: "cond", test, yes, no};
  }

  function parseBinary(minPrecedence) {
    let left = parseUnary();
    for ( ;; ) {
      const token = peek();
      const precedence = token?.type === "op" ? BINARY_PRECEDENCE[token.value] : undefined;
      if ( (precedence === undefined) || (precedence < minPrecedence) ) return left;
      next();
      const right = parseBinary(precedence + 1);
      left = {t: "bin", op: token.value, left, right};
    }
  }

  function parseUnary() {
    if ( isOp("-") ) { next(); return {t: "neg", arg: parseUnary()}; }
    if ( isOp("+") ) { next(); return parseUnary(); }
    if ( isOp("!") ) { next(); return {t: "not", arg: parseUnary()}; }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = next();
    if ( !token ) throw new SyntaxError(`Unexpected end of expression "${source}"`);
    if ( token.type === "num" ) return {t: "num", value: token.value};
    if ( token.type === "id" ) {
      if ( !isOp("(") ) return {t: "var", name: token.value};
      next();
      const args = [];
      if ( !isOp(")") ) {
        do args.push(parseTernary()); while ( isOp(",") && next() );
      }
      expect(")");
      return {t: "call", name: token.value, args};
    }
    if ( token.value === "(" ) {
      const inner = parseTernary();
      expect(")");
      return inner;
    }
    throw new SyntaxError(`Unexpected token "${token.value}" in expression "${source}"`);
  }

  const ast = parseTernary();
  if ( position < tokens.length ) {
    throw new SyntaxError(`Unexpected token "${tokens[position].value}" in expression "${source}"`);
  }
  return ast;
}

function lookup(scope, name, source) {
  let value = scope;
  for ( const part of name.split(".") ) {
    if ( (value === null) || (value === undefined) ) break;
    value = value[part];
  }
  if ( value === true ) return 1;
  if ( (value === false) || (value === null) ) return 0;
  if ( typeof value !== "number" ) {
    throw new ReferenceError(`Unknown or non numeric variable "${name}" in expression "${source}"`);
  }
  return value;
}

function evaluateNode(node, scope, source) {
  switch ( node.t ) {
    case "num": return node.value;
    case "var": return lookup(scope, node.name, source);
    case "neg": return -evaluateNode(node.arg, scope, source);
    case "not": return evaluateNode(node.arg, scope, source) ? 0 : 1;
    case "cond":
      return evaluateNode(node.test, scope, source)
        ? evaluateNode(node.yes, scope, source)
        : evaluateNode(node.no, scope, source);
    case "call": {
      const fn = FUNCTIONS[node.name];
      if ( !fn ) throw new ReferenceError(`Unknown function "${node.name}" in expression "${source}"`);
      return fn(...node.args.map(arg => evaluateNode(arg, scope, source)));
    }
    case "bin": {
      if ( node.op === "&&" ) {
        return (evaluateNode(node.left, scope, source) && evaluateNode(node.right, scope, source)) ? 1 : 0;
      }
      if ( node.op === "||" ) {
        return (evaluateNode(node.left, scope, source) || evaluateNode(node.right, scope, source)) ? 1 : 0;
      }
      const a = evaluateNode(node.left, scope, source);
      const b = evaluateNode(node.right, scope, source);
      switch ( node.op ) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
        case "==": return a === b ? 1 : 0;
        case "!=": return a !== b ? 1 : 0;
      }
    }
  }
  throw new Error(`Malformed expression "${source}"`);
}

const CACHE = new Map();

export function compile(source) {
  if ( typeof source === "number" ) return () => source;
  if ( typeof source !== "string" ) throw new TypeError("An expression must be a string or a number");
  let compiled = CACHE.get(source);
  if ( !compiled ) {
    const ast = parse(source);
    compiled = (scope = {}) => evaluateNode(ast, scope, source);
    CACHE.set(source, compiled);
  }
  return compiled;
}

export function evaluate(source, scope = {}) {
  return compile(source)(scope);
}

export function variables(source) {
  if ( typeof source === "number" ) return [];
  const names = new Set();
  const walk = node => {
    if ( !node || (typeof node !== "object") ) return;
    if ( node.t === "var" ) names.add(node.name);
    for ( const value of Object.values(node) ) {
      if ( Array.isArray(value) ) value.forEach(walk);
      else if ( typeof value === "object" ) walk(value);
    }
  };
  walk(parse(source));
  return Array.from(names);
}
