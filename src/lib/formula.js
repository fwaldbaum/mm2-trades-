'use strict';

/**
 * Evaluador de expresiones aritmeticas seguro (sin eval / Function).
 *
 * Se usa para la formula de ganancias, que es configurable desde
 * administracion. Por defecto:  (views / 1000) * rate * multiplier
 *
 * Soporta: numeros, variables, + - * / % ^, parentesis, unario -,
 * y las funciones min, max, round, floor, ceil.
 */

const FUNCTIONS = {
  min: Math.min, max: Math.max,
  round: Math.round, floor: Math.floor, ceil: Math.ceil,
  abs: Math.abs
};

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9._]/.test(input[j])) j += 1;
      const raw = input.slice(i, j).replace(/_/g, '');
      const num = Number(raw);
      if (!Number.isFinite(num)) throw new Error(`Numero invalido: ${raw}`);
      tokens.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
      tokens.push({ t: 'name', v: input.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/%^(),'.includes(ch)) { tokens.push({ t: ch }); i += 1; continue; }
    throw new Error(`Caracter no permitido en la formula: "${ch}"`);
  }
  return tokens;
}

function parse(tokens, vars) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t) => {
    const tok = tokens[pos];
    if (!tok || tok.t !== t) throw new Error(`Se esperaba "${t}" en la formula.`);
    pos += 1;
    return tok;
  };

  function parseExpression(minPrec = 0) {
    let left = parseUnary();
    const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
    while (peek() && PREC[peek().t] !== undefined && PREC[peek().t] >= minPrec) {
      const op = peek().t;
      pos += 1;
      const nextMin = op === '^' ? PREC[op] : PREC[op] + 1; // ^ asociativo a derecha
      const right = parseExpression(nextMin);
      switch (op) {
        case '+': left += right; break;
        case '-': left -= right; break;
        case '*': left *= right; break;
        case '/':
          if (right === 0) throw new Error('Division por cero en la formula.');
          left /= right; break;
        case '%':
          if (right === 0) throw new Error('Modulo por cero en la formula.');
          left %= right; break;
        case '^': left = left ** right; break;
        default: throw new Error(`Operador desconocido: ${op}`);
      }
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().t === '-') { pos += 1; return -parseUnary(); }
    if (peek() && peek().t === '+') { pos += 1; return parseUnary(); }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Formula incompleta.');
    if (tok.t === 'num') { pos += 1; return tok.v; }
    if (tok.t === '(') {
      pos += 1;
      const value = parseExpression(0);
      eat(')');
      return value;
    }
    if (tok.t === 'name') {
      pos += 1;
      const name = tok.v;
      if (peek() && peek().t === '(') {
        pos += 1;
        const args = [];
        if (peek() && peek().t !== ')') {
          args.push(parseExpression(0));
          while (peek() && peek().t === ',') { pos += 1; args.push(parseExpression(0)); }
        }
        eat(')');
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Funcion no permitida: ${name}`);
        return fn(...args);
      }
      if (!(name in vars)) throw new Error(`Variable desconocida en la formula: ${name}`);
      const value = Number(vars[name]);
      if (!Number.isFinite(value)) throw new Error(`Variable no numerica: ${name}`);
      return value;
    }
    throw new Error(`Token inesperado en la formula: ${tok.t}`);
  }

  const result = parseExpression(0);
  if (pos !== tokens.length) throw new Error('Sobran caracteres al final de la formula.');
  return result;
}

/** Evalua la expresion con las variables dadas. Devuelve un numero finito. */
function evaluate(expression, vars = {}) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('La formula esta vacia.');
  }
  if (expression.length > 300) throw new Error('La formula es demasiado larga.');
  const value = parse(tokenize(expression), vars);
  if (!Number.isFinite(value)) throw new Error('La formula no produjo un numero valido.');
  return value;
}

/** Comprueba que una formula es valida antes de guardarla. */
function validateExpression(expression) {
  evaluate(expression, { views: 1000, rate: 100, multiplier: 1, bonus: 0 });
  return true;
}

module.exports = { evaluate, validateExpression, FUNCTIONS };
