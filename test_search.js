const db = require('better-sqlite3')('/tmp/q3.db');
db.exec('CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, slug TEXT, name TEXT)');
db.exec('CREATE TABLE IF NOT EXISTS class_features (id INTEGER PRIMARY KEY, classId INTEGER, name TEXT, level INTEGER, description TEXT)');
db.prepare("INSERT OR IGNORE INTO classes VALUES (1,'barbaro','Bárbaro')").run();
db.prepare("INSERT OR IGNORE INTO class_features VALUES (1,1,'Fúria',1,'teste descrição')").run();

// Gerar dinamicamente: cada REPLACE envolve o anterior, 23 pares no total
const pairs = [
  ['á','a'],['é','e'],['í','i'],['ó','o'],['ú','u'],['â','a'],['ê','e'],['ô','o'],['ã','a'],['õ','o'],['ç','c'],
  ['Á','A'],['É','E'],['Í','I'],['Ó','O'],['Ú','U'],['Â','A'],['Ê','E'],['Ô','O'],['Ã','A'],['Õ','O'],['Ç','C']
];
let expr = '?';
for (const [from, to] of pairs) expr = `REPLACE(${expr},'${from}','${to}')`;
const UNACC = `(LOWER(${expr}) LIKE ?)`;
const r = (UNACC.match(/REPLACE\(/g) || []).length;
console.log('REPLACEs:', r, '| parênteses abertos:', (UNACC.match(/\(/g)||[]).length, '| fechados:', (UNACC.match(/\)/g)||[]).length);
const sql = 'SELECT cf.name FROM class_features cf JOIN classes c ON c.id = cf.classId WHERE 1=1 AND ('+UNACC+' OR '+UNACC+') ORDER BY cf.name';
try {
  console.log(db.prepare(sql).all('furia','%furia%','Fúria','%furia%'));
} catch(e) {
  console.log('ERR:', e.message);
  // mostrar SQL final para debug
  console.log(sql);
}
