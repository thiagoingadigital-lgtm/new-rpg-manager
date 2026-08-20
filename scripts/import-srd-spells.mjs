import fs from 'node:fs/promises';

const indexUrl = 'https://www.dnd5eapi.co/api/2014/spells';
const response = await fetch(indexUrl);
if (!response.ok) throw new Error(`Falha ao consultar índice SRD: ${response.status}`);
const index = await response.json();
const spells = [];
for (const entry of index.results) {
  const detailResponse = await fetch(`https://www.dnd5eapi.co/api/2014/spells/${entry.index}`);
  if (!detailResponse.ok) continue;
  const spell = await detailResponse.json();
  spells.push({
    name: spell.name,
    school: spell.school?.name || '',
    level: Number(spell.level || 0),
    castingTime: spell.casting_time || '',
    range: spell.range || '',
    components: (spell.components || []).join(', '),
    duration: spell.duration || '',
    ritual: Boolean(spell.ritual),
    concentration: Boolean(spell.concentration),
    classes: (spell.classes || []).map((cls) => cls.name).filter(Boolean),
    desc: Array.isArray(spell.desc) ? spell.desc.join('\n\n') : ''
  });
}
spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'));
await fs.writeFile('/home/ubuntu/new-rpg-manager/data/srd-spells.json', `${JSON.stringify({ source: indexUrl, count: spells.length, spells }, null, 2)}\n`);
console.log(`Importados ${spells.length} feitiços SRD.`);
