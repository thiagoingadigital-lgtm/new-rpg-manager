const db = require('./db');
// Testar a cadeia de REPLACE contra "Punição Divina (Divine Smite)"
const pairs = [
  ['á','a'],['é','e'],['í','i'],['ó','o'],['ú','u'],['â','a'],['ê','e'],['ô','o'],['ã','a'],['õ','o'],['ç','c'],
  ['Á','A'],['É','E'],['Í','I'],['Ó','O'],['Ú','U'],['Â','A'],['Ê','E'],['Ô','O'],['Ã','A'],['Õ','O'],['Ç','C'],
];
let expr = '?';
for (const [f, t] of pairs) expr = `REPLACE(${expr},'${f}','${t}')`;
const full = `LOWER(${expr})`;
const r = db.prepare(`SELECT ${full} AS n`).get('Punição Divina (Divine Smite)');
console.log('Resultado:', JSON.stringify(r.n));
// Testar com placeholder
const q = db.prepare(`SELECT ${full} AS n`).get('Punição Divina (Divine Smite)');
console.log('Igual a punicao divina:', q.n === 'punicao divina (divine smite)');
