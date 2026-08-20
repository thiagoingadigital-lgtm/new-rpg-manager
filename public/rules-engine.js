/*
 * RPG Manager — Motor central de regras D&D 5e 2014.
 * Este módulo concentra valores derivados para impedir divergências entre ficha,
 * inventário, grimório e rolagens. Mantém a aparência fora desta camada.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RPGRules = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ABILITIES = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
  const SKILL_ABILITIES = {
    acrobacia: 'destreza', arcanismo: 'inteligencia', atletismo: 'forca', atuacao: 'carisma',
    enganacao: 'carisma', furtividade: 'destreza', historia: 'inteligencia', intimidacao: 'carisma',
    intuicao: 'sabedoria', investigacao: 'inteligencia', lidarComAnimais: 'sabedoria', medicina: 'sabedoria',
    natureza: 'inteligencia', percepcao: 'sabedoria', persuasao: 'carisma', prestidigitacao: 'destreza',
    religiao: 'inteligencia', sobrevivencia: 'sabedoria',
  };
  const CLASS_PROFICIENCIES = {
    'Artífice': { weapons: { categories: ['simples'] }, armor: { categories: ['Leve', 'Média'] }, shield: true },
    'Bárbaro': { weapons: { categories: ['simples', 'marcial'] }, armor: { categories: ['Leve', 'Média'] }, shield: true },
    'Bardo': { weapons: { categories: ['simples'], names: ['Besta de mão', 'Espada longa', 'Rapieira', 'Espada curta'] }, armor: { categories: ['Leve'] }, shield: false },
    'Clérigo': { weapons: { categories: ['simples'] }, armor: { categories: ['Leve', 'Média'] }, shield: true },
    'Druida': { weapons: { names: ['Clava', 'Adaga', 'Dardo', 'Azagaia', 'Maça', 'Bordão', 'Foice', 'Lança', 'Funda', 'Cimitarra'] }, armor: { categories: ['Leve', 'Média'] }, shield: true },
    'Feiticeiro': { weapons: { names: ['Adaga', 'Dardo', 'Funda', 'Bordão', 'Besta leve'] }, armor: { categories: [] }, shield: false },
    'Guerreiro': { weapons: { categories: ['simples', 'marcial'] }, armor: { categories: ['Leve', 'Média', 'Pesada'] }, shield: true },
    'Ladino': { weapons: { categories: ['simples'], names: ['Besta de mão', 'Espada longa', 'Rapieira', 'Espada curta'] }, armor: { categories: ['Leve'] }, shield: false },
    'Mago': { weapons: { names: ['Adaga', 'Dardo', 'Funda', 'Bordão', 'Besta leve'] }, armor: { categories: [] }, shield: false },
    'Monge': { weapons: { categories: ['simples'], names: ['Espada curta'] }, armor: { categories: [] }, shield: false },
    'Paladino': { weapons: { categories: ['simples', 'marcial'] }, armor: { categories: ['Leve', 'Média', 'Pesada'] }, shield: true },
    'Patrulheiro': { weapons: { categories: ['simples', 'marcial'] }, armor: { categories: ['Leve', 'Média'] }, shield: true },
    'Bruxo': { weapons: { categories: ['simples'] }, armor: { categories: ['Leve'] }, shield: false },
  };

  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function abilityModifier(score) { return Math.floor((Number(score || 10) - 10) / 2); }
  function proficiencyBonus(level) { return 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4); }
  function mergeDeep(base, extra) { return Object.assign({}, base || {}, extra || {}); }
  function findByName(list, name) { return (list || []).find(item => item.name === name || item.slug === name); }
  function selectedRace(raceReference, character) {
    const race = findByName(raceReference, character.race);
    const subrace = findByName(race?.subraces, character.subrace);
    return { race, subrace, abilityBonuses: mergeDeep(race?.abilityBonuses, subrace?.abilityBonuses), traits: [...(race?.traits || []), ...(subrace?.traits || [])] };
  }
  function classData(classReference, character) { return findByName(classReference, character.class); }
  function classProficiencies(classReference, character) {
    const data = classData(classReference, character);
    const fallback = CLASS_PROFICIENCIES[character.class] || CLASS_PROFICIENCIES[Object.keys(CLASS_PROFICIENCIES).find(name => normalize(name) === normalize(character.class))] || { weapons: { categories: [] }, armor: { categories: [] }, shield: false };
    const own = data?.proficiencies || fallback;
    const all = [own, ...(character.multiclasses || []).map(item => classReference.find(cls => cls.name === item.className)?.proficiencies || CLASS_PROFICIENCIES[item.className]).filter(Boolean)];
    return {
      weapons: { categories: [...new Set(all.flatMap(item => item.weapons?.categories || []))], names: [...new Set(all.flatMap(item => item.weapons?.names || []))] },
      armor: { categories: [...new Set(all.flatMap(item => item.armor?.categories || []))] },
      shield: all.some(item => item.shield), tools: [...new Set(all.flatMap(item => item.tools || []))],
    };
  }
  function itemData(itemReference, item) { return findByName(itemReference, item?.name) || item || {}; }
  function weaponIsProficient(character, catalog) {
    const prof = classProficiencies(character.classReference || [], character).weapons || {};
    return (prof.categories || []).includes(catalog.category) || (prof.names || []).some(name => normalize(name) === normalize(catalog.name));
  }
  function armorIsProficient(character, catalog) {
    const prof = classProficiencies(character.classReference || [], character).armor || {};
    return (prof.categories || []).includes(catalog.category);
  }
  function derive(character, refs = {}) {
    const race = selectedRace(refs.races || [], character);
    const attributes = mergeDeep(character.attributes, Object.fromEntries(Object.entries(race.abilityBonuses || {}).map(([key, value]) => [key, Number(character.attributes?.[key] || 10) + Number(value || 0)])));
    const totalLevel = Number(character.level || 1) + (character.multiclasses || []).reduce((sum, item) => sum + Number(item.level || 0), 0);
    const profBonus = proficiencyBonus(totalLevel);
    const profs = classProficiencies(refs.classes || [], { ...character, classReference: refs.classes || [] });
    const items = (character.items || []).map(item => ({ raw: item, catalog: itemData(refs.items || [], item), details: item.details || itemData(refs.items || [], item).details || {} })).filter(x => x.raw.equipped);
    const armor = items.find(x => x.raw.type === 'armadura');
    const shield = items.find(x => x.raw.type === 'escudo');
    const dexMod = abilityModifier(attributes.destreza);
    const armorDetails = armor?.details || {};
    const armorType = armorDetails.armorType;
    const armorProficient = !armor || armorIsProficient({ ...character, classReference: refs.classes || [] }, armor.catalog);
    let armorClass = 10 + dexMod;
    if (armor) {
      const base = Number(armorDetails.baseAC || 10);
      if (armorType === 'Leve') armorClass = base + dexMod;
      else if (armorType === 'Média') armorClass = base + Math.min(Number(armorDetails.dexCap || 2), dexMod);
      else if (armorType === 'Pesada') armorClass = base;
    }
    if (shield && (profs.shield !== false)) armorClass += Number(shield.details.acBonus || 2);
    const strengthMinimum = Number(armorDetails.strengthMin || 0);
    const speedBase = Number(race.race?.speed?.walk || 30);
    const speedPenalty = armor && strengthMinimum > Number(attributes.forca || 10) ? 10 : 0;
    const attacks = items.filter(x => x.raw.type === 'arma').map(x => {
      const props = normalize(x.details.properties || '');
      const ranged = x.catalog.rangeType === 'à-distância' || props.includes('municao') || props.includes('arremesso');
      const finesse = props.includes('acuidade');
      const ability = ranged ? 'destreza' : finesse && abilityModifier(attributes.destreza) > abilityModifier(attributes.forca) ? 'destreza' : 'forca';
      const proficient = weaponIsProficient({ ...character, classReference: refs.classes || [] }, x.catalog);
      return { name: x.raw.name, ability, proficient, bonus: abilityModifier(attributes[ability]) + (proficient ? profBonus : 0), damage: `${x.details.damage || x.catalog.damage || '1d4'} ${x.details.damageType || x.catalog.damageType || ''}`.trim(), properties: x.details.properties || '', range: (String(x.details.properties || '').match(/(?:munição|arremesso)\s+\d+\/\d+/i) || [])[0] || 'corpo a corpo' };
    });
    const skillProficiencies = { ...(character.skillProficiencies || {}) };
    const background = findByName(refs.backgrounds || [], character.creationData?.background || character.backgroundData?.name);
    [...(background?.skills || [])].forEach(key => { skillProficiencies[key] = { ...(skillProficiencies[key] || {}), proficient: true, source: 'background-2014' }; });
    return {
      attributes, modifiers: Object.fromEntries(ABILITIES.map(key => [key, abilityModifier(attributes[key])])),
      totalLevel, multiclasses: character.multiclasses || [], proficiencyBonus: profBonus, armorClass, armorProficient, shieldEquipped: Boolean(shield), speed: speedBase - speedPenalty,
      speedPenalty, strengthMinimum, stealthDisadvantage: Boolean(armorDetails.stealthDisadvantage), attacks, skillProficiencies,
      savingThrows: Object.fromEntries((classData(refs.classes || [], character)?.savingThrows || character.saveProficiencies && Object.keys(character.saveProficiencies).filter(k => character.saveProficiencies[k]) || []).map(key => [key, true])),
      race, class: classData(refs.classes || [], character), background,
    };
  }
  return { ABILITIES, SKILL_ABILITIES, CLASS_PROFICIENCIES, normalize, abilityModifier, proficiencyBonus, derive, classProficiencies, weaponIsProficient, armorIsProficient };
});
