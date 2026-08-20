import json
from pathlib import Path

path = Path('/home/ubuntu/new-rpg-manager/data/class-reference.json')
data = json.loads(path.read_text())
levels = {
    'artifice': 3,
    'barbaro': 3,
    'bardo': 3,
    'clerigo': 1,
    'druida': 2,
    'guerreiro': 3,
    'monge': 3,
    'paladino': 3,
    'patrulheiro': 3,
    'ladino': 3,
    'feiticeiro': 1,
    'bruxo': 1,
    'mago': 2,
}
for item in data['classes']:
    item['subclassLevel'] = levels.get(item['slug'], 3)
data['version'] = '2014.3'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print({'version': data['version'], 'subclass_levels': {c['slug']: c['subclassLevel'] for c in data['classes']}})
