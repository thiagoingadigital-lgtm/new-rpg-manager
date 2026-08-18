// Reproduz exatamente a rota /api/classes/features/search
const db = require('./db');
const stripAccents = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const q = 'punicao divina';
const pairs = [
  ['á','a'],['é','e'],['í','i'],['ó','o'],['ú','u'],['â','a'],['ê','e'],['ô','o'],['ã','a'],['õ','o'],['ç','c'],
  ['Á','A'],['É','E'],['Í','I'],['Ó','O'],['Ú','U'],['Â','A'],['Ê','E'],['Ô','O'],['Ã','A'],['Õ','O'],['Ç','C'],
];
const makeUnacc = (value) => {
  let expr = value;
  for (const [from, to] of pairs) expr = `REPLACE(${expr},'${from}','${to}')`;
  return `(LOWER(${expr}) LIKE ?)`;
};
const term = stripAccents(q);
let sql = `SELECT cf.name, cf.level, cf.description, c.name AS className, c.slug AS classSlug, c.icon
           FROM class_features cf JOIN classes c ON c.id = cf.classId WHERE 1=1`;
const params = [];
sql += ` AND (${makeUnacc('c.name')} OR ${makeUnacc('cf.description')})`;
params.push(`%${term}%`, `%${term}%`);
sql += ` ORDER BY c.name, cf.level, cf.name`;

console.log('SQL params:', params);
const st = db.prepare(sql);
const rows = st.all(...params);
console.log('Resultados:', rows.length);
rows.forEach(r => console.log(r.classSlug, r.level, r.name));
