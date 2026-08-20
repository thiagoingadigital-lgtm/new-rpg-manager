const assert = require('assert');
const rules = require('../public/rules-engine.js');
const classes = require('../data/class-reference.json').classes;
const races = require('../data/race-reference.json').races;
const backgrounds = require('../data/background-reference.json').backgrounds;
const items = require('../data/item-reference.json').items;

function character(overrides = {}) {
  return {
    name: 'Teste', class: 'Guerreiro', race: 'Humano', subrace: '', level: 5,
    attributes: { forca: 16, destreza: 14, constituicao: 12, inteligencia: 10, sabedoria: 10, carisma: 8 },
    skillProficiencies: {}, saveProficiencies: {}, items: [], creationData: {}, ...overrides,
  };
}
function item(name, equipped = true) {
  const catalog = items.find(x => x.name === name);
  return { id: name, name, type: catalog.type, equipped, details: { ...catalog.details } };
}
function derive(c) { return rules.derive(c, { classes, races, backgrounds, items }); }

const fighter = derive(character({ items: [item('Placas'), item('Escudo'), item('Espada longa')] }));
assert.strictEqual(fighter.proficiencyBonus, 3, 'bônus de proficiência no nível 5');
assert.strictEqual(fighter.armorClass, 20, 'CA de placas + escudo');
assert.strictEqual(fighter.armorProficient, true, 'guerreiro usa armadura pesada');
assert.strictEqual(fighter.attacks[0].bonus, 6, 'ataque de espada longa com proficiência');
assert.strictEqual(fighter.attacks[0].damage, '1d8 cortante', 'dano da espada longa');

const weak = derive(character({ attributes: { forca: 12, destreza: 14, constituicao: 12, inteligencia: 10, sabedoria: 10, carisma: 8 }, items: [item('Cota de malha')] }));
assert.strictEqual(weak.armorClass, 16, 'CA de cota de malha sem Destreza');
assert.strictEqual(weak.speed, 20, 'penalidade de deslocamento por Força insuficiente');
assert.strictEqual(weak.speedPenalty, 10, 'penalidade registrada');

const rogue = derive(character({ class: 'Ladino', attributes: { forca: 10, destreza: 18, constituicao: 10, inteligencia: 12, sabedoria: 10, carisma: 10 }, items: [item('Rapieira')] }));
assert.strictEqual(rogue.attacks[0].ability, 'destreza', 'acuidade escolhe Destreza maior');
assert.strictEqual(rogue.attacks[0].bonus, 7, 'rapieira com Destreza e proficiência');

const wizard = derive(character({ class: 'Mago', attributes: { forca: 10, destreza: 12, constituicao: 10, inteligencia: 16, sabedoria: 10, carisma: 10 }, items: [item('Espada grande')] }));
assert.strictEqual(wizard.attacks[0].proficient, false, 'mago não recebe proficiência em espada grande');
assert.strictEqual(wizard.attacks[0].bonus, 0, 'ataque sem bônus de proficiência');

const multiclass = derive(character({ class: 'Mago', level: 4, multiclasses: [{ className: 'Guerreiro', level: 1 }], items: [item('Espada grande')] }));
assert.strictEqual(multiclass.totalLevel, 5, 'nível total com multiclassing');
assert.strictEqual(multiclass.proficiencyBonus, 3, 'bônus de proficiência usa nível total');
assert.strictEqual(multiclass.attacks[0].proficient, true, 'proficiência da classe adicional é acumulada');

const background = derive(character({ creationData: { background: 'Soldado' } }));
assert.strictEqual(background.skillProficiencies.atletismo.proficient, true, 'background aplica Atletismo');
assert.strictEqual(background.skillProficiencies.intimidacao.proficient, true, 'background aplica Intimidação');

console.log('rules-engine: 7 cenários aprovados');
