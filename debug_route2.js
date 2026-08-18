// Reproduz a rota exatamente, testando as duas metades
const db = require('./db');
const stripAccents = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const pairs = [
  ['á','a'],['é','e'],['í','i'],['ó','o'],['ú','u'],['â','a'],['ê','e'],['ô','o'],['ã','a'],['õ','o'],['ç','c'],
  ['Á','A'],['É','E'],['Í','I'],['Ó','O'],['Ú','U'],['Â','A'],['Ê','E'],['Ô','O'],['Ã','A'],['Õ','O'],['Ç','C'],
];
const makeUnacc = (value) => {
  let expr = value;
  for (const [from, to] of pairs) expr = `REPLACE(${expr},'${from}','${to}')`;
  return `(LOWER(${expr}) LIKE ?)`;
};
const term = stripAccents('punicao divina');
const base = 'SELECT cf.name FROM class_features cf JOIN classes c ON c.id = cf.classId WHERE ';
const p = `%${term}%`;

// teste 1: apenas c.name
const s1 = db.prepare(base + makeUnacc('c.name'));
console.log('1) c.name only:', s1.all(p));

// teste 2: apenas cf.description
const s2 = db.prepare(base + makeUnacc('cf.description'));
console.log('2) desc only:', s2.all(p).map(r => r.name));

// teste 3: OR
const s3 = db.prepare(base + makeUnacc('c.name') + ' OR ' + makeUnacc('cf.description'));
console.log('3) OR:', s3.all(p, p).map(r => r.name));

// teste 4: mesma coisa, sem o LIKE — verificar se o LIKE com espaço no bind funciona
const s4 = db.prepare(base + makeUnacc('c.name'));
console.log('4) bind %punicao%:', s4.all('%punicao%').map(r => r.name));
