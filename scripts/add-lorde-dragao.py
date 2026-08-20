import json
from pathlib import Path

path = Path('/home/ubuntu/new-rpg-manager/data/class-reference.json')
data = json.loads(path.read_text())
paladin = next(item for item in data['classes'] if item['slug'] == 'paladino')
subclasses = paladin.setdefault('subclasses', [])
if not any(item.get('slug') == 'lorde-dragao' for item in subclasses):
    subclasses.append({
        'slug': 'lorde-dragao',
        'name': 'Lorde Dragão',
        'edition': '2014',
        'status': 'custom',
        'source': 'RPG Manager'
    })
data['version'] = '2014.2'
data['customOptions'] = ['Lorde Dragão']
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print({'version': data['version'], 'paladin_subclasses': len(subclasses), 'total_subclasses': sum(len(c.get('subclasses', [])) for c in data['classes'])})
