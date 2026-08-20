import json
from pathlib import Path

path = Path('data/class-reference.json')
data = json.loads(path.read_text())
profiles = {
    'Artífice': ({'categories':['simples']}, {'categories':['Leve','Média']}, True),
    'Bárbaro': ({'categories':['simples','marcial']}, {'categories':['Leve','Média']}, True),
    'Bardo': ({'categories':['simples'],'names':['Besta de mão','Espada longa','Rapieira','Espada curta']}, {'categories':['Leve']}, False),
    'Clérigo': ({'categories':['simples']}, {'categories':['Leve','Média']}, True),
    'Druida': ({'names':['Clava','Adaga','Dardo','Azagaia','Maça','Bordão','Foice','Lança','Funda','Cimitarra']}, {'categories':['Leve','Média']}, True),
    'Feiticeiro': ({'names':['Adaga','Dardo','Funda','Bordão','Besta leve']}, {'categories':[]}, False),
    'Guerreiro': ({'categories':['simples','marcial']}, {'categories':['Leve','Média','Pesada']}, True),
    'Ladino': ({'categories':['simples'],'names':['Besta de mão','Espada longa','Rapieira','Espada curta']}, {'categories':['Leve']}, False),
    'Mago': ({'names':['Adaga','Dardo','Funda','Bordão','Besta leve']}, {'categories':[]}, False),
    'Monge': ({'categories':['simples'],'names':['Espada curta']}, {'categories':[]}, False),
    'Paladino': ({'categories':['simples','marcial']}, {'categories':['Leve','Média','Pesada']}, True),
    'Patrulheiro': ({'categories':['simples','marcial']}, {'categories':['Leve','Média']}, True),
    'Bruxo': ({'categories':['simples']}, {'categories':['Leve']}, False),
}
for cls in data.get('classes', []):
    if cls['name'] in profiles:
        weapons, armor, shield = profiles[cls['name']]
        cls['proficiencies'] = {'weapons': weapons, 'armor': armor, 'shield': shield, 'tools': cls.get('proficiencies', {}).get('tools', []) if isinstance(cls.get('proficiencies'), dict) else []}
data['proficiencySchemaVersion'] = '2014.1'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('proficiencias de equipamento adicionadas:', len(profiles))
