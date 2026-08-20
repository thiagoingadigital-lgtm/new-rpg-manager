import json
from pathlib import Path

class_data = {
    'Artífice': {'savingThrows': ['constituicao', 'inteligencia'], 'skillChoices': ['arcanismo', 'historia', 'investigacao', 'medicina', 'natureza', 'prestidigitacao'], 'skillChoiceCount': 2},
    'Bárbaro': {'savingThrows': ['forca', 'constituicao'], 'skillChoices': ['adestrarAnimais', 'atletismo', 'intimidacao', 'natureza', 'percepcao', 'sobrevivencia'], 'skillChoiceCount': 2},
    'Bardo': {'savingThrows': ['destreza', 'carisma'], 'skillChoices': ['acrobacia', 'adestrarAnimais', 'atuacao', 'enganacao', 'furtividade', 'intimidacao', 'intuicao', 'percepcao', 'persuasao', 'prestidigitacao'], 'skillChoiceCount': 3},
    'Clérigo': {'savingThrows': ['sabedoria', 'carisma'], 'skillChoices': ['historia', 'intuicao', 'medicina', 'persuasao', 'religiao'], 'skillChoiceCount': 2},
    'Druida': {'savingThrows': ['inteligencia', 'sabedoria'], 'skillChoices': ['adestrarAnimais', 'arcanismo', 'intuicao', 'medicina', 'natureza', 'percepcao', 'religiao', 'sobrevivencia'], 'skillChoiceCount': 2},
    'Guerreiro': {'savingThrows': ['forca', 'constituicao'], 'skillChoices': ['acrobacia', 'adestrarAnimais', 'atletismo', 'historia', 'intimidacao', 'intuicao', 'percepcao', 'sobrevivencia'], 'skillChoiceCount': 2},
    'Monge': {'savingThrows': ['forca', 'destreza'], 'skillChoices': ['acrobacia', 'atletismo', 'historia', 'intuicao', 'religiao', 'furtividade'], 'skillChoiceCount': 2},
    'Paladino': {'savingThrows': ['sabedoria', 'carisma'], 'skillChoices': ['atletismo', 'intimidacao', 'intuicao', 'medicina', 'persuasao', 'religiao'], 'skillChoiceCount': 2},
    'Patrulheiro': {'savingThrows': ['forca', 'destreza'], 'skillChoices': ['adestrarAnimais', 'atletismo', 'furtividade', 'intuiticao', 'investigacao', 'natureza', 'percepcao', 'sobrevivencia'], 'skillChoiceCount': 3},
    'Ladino': {'savingThrows': ['destreza', 'inteligencia'], 'skillChoices': ['acrobacia', 'atletismo', 'atuacao', 'enganacao', 'furtividade', 'intimidacao', 'intuicao', 'investigacao', 'percepcao', 'prestidigitacao'], 'skillChoiceCount': 4},
    'Feiticeiro': {'savingThrows': ['constituicao', 'carisma'], 'skillChoices': ['arcanismo', 'enganacao', 'intuicao', 'intimidacao', 'persuasao', 'religiao'], 'skillChoiceCount': 2},
    'Bruxo': {'savingThrows': ['sabedoria', 'carisma'], 'skillChoices': ['arcanismo', 'historia', 'intimidacao', 'investigacao', 'natureza', 'religiao'], 'skillChoiceCount': 2},
    'Mago': {'savingThrows': ['inteligencia', 'sabedoria'], 'skillChoices': ['arcanismo', 'historia', 'intuicao', 'investigacao', 'medicina', 'religiao'], 'skillChoiceCount': 2},
}
# Corrige o nome interno da perícia Intuição do Patrulheiro.
class_data['Patrulheiro']['skillChoices'] = ['adestrarAnimais', 'atletismo', 'furtividade', 'intuicao', 'investigacao', 'natureza', 'percepcao', 'sobrevivencia']

race_path = Path('data/race-reference.json')
race = json.loads(race_path.read_text())
for item in race['races']:
    item.setdefault('proficiencyChoices', [])
    item.setdefault('proficiencies', [])
    if item['name'] == 'Anão': item['proficiencies'] += ['machado-de-batalha', 'machadinha', 'martelo-leve', 'martelo-de-guerra']
    if item['name'] == 'Elfo': item['proficiencies'] += ['percepcao']
    if item['name'] == 'Meio-elfo': item['proficiencyChoices'] = ['acrobacia', 'adestrarAnimais', 'arcanismo', 'atletismo', 'atuacao', 'enganacao', 'furtividade', 'historia', 'intimidacao', 'intuicao', 'investigacao', 'medicina', 'natureza', 'percepcao', 'persuasao', 'prestidigitacao', 'religiao', 'sobrevivencia']; item['proficiencyChoiceCount'] = 2
    if item['name'] == 'Meio-orc': item['proficiencies'] += ['intimidacao']
    if item['name'] == 'Goliath': item['proficiencies'] += ['atletismo']
    if item['name'] == 'Kenku': item['proficiencyChoices'] = ['acrobacia', 'enganacao', 'furtividade', 'prestidigitacao']; item['proficiencyChoiceCount'] = 2
    if item['name'] == 'Humano':
        for sr in item.get('subraces', []):
            if sr['name'] == 'Humano variante':
                sr['proficiencyChoices'] = ['acrobacia', 'adestrarAnimais', 'arcanismo', 'atletismo', 'atuacao', 'enganacao', 'furtividade', 'historia', 'intimidacao', 'intuicao', 'investigacao', 'medicina', 'natureza', 'percepcao', 'persuasao', 'prestidigitacao', 'religiao', 'sobrevivencia']
                sr['proficiencyChoiceCount'] = 1
    if item['name'] == 'Gnomo':
        for sr in item.get('subraces', []):
            if sr['name'] == 'Gnomo das rochas': sr['proficiencies'] = ['ferramentas-de-artifice']
    if item['name'] == 'Halfling':
        for sr in item.get('subraces', []):
            if sr['name'] == 'Pés-leves': sr['proficiencies'] = ['furtividade']
    for sr in item.get('subraces', []): sr.setdefault('proficiencies', []); sr.setdefault('proficiencyChoices', [])
race['proficiencySchemaVersion'] = '2014.1'
race_path.write_text(json.dumps(race, ensure_ascii=False, indent=2) + '\n')

class_path = Path('data/class-reference.json')
classes = json.loads(class_path.read_text())
for item in classes['classes']:
    item.update(class_data.get(item['name'], {'savingThrows': [], 'skillChoices': [], 'skillChoiceCount': 0}))
classes['proficiencySchemaVersion'] = '2014.1'
class_path.write_text(json.dumps(classes, ensure_ascii=False, indent=2) + '\n')
print('classes atualizadas:', len(classes['classes']))
print('raças atualizadas:', len(race['races']))
