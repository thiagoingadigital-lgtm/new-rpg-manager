import json
from pathlib import Path


def feat(name, description, category='trait'):
    return {'name': name, 'description': description, 'category': category}


def race(slug, name, source, ability, size, speed, languages, traits, subraces=None, availability='core'):
    return {
        'slug': slug,
        'name': name,
        'edition': '2014',
        'source': source,
        'availability': availability,
        'abilityBonuses': ability,
        'size': size,
        'speed': speed,
        'languages': languages,
        'traits': traits,
        'subraces': subraces or [],
    }


def sub(slug, name, ability=None, traits=None, source=None, availability='core'):
    return {
        'slug': slug,
        'name': name,
        'source': source,
        'availability': availability,
        'abilityBonuses': ability or {},
        'traits': traits or [],
    }

races = [
    race('anao', 'Anão', 'Livro do Jogador', {'constituicao': 2}, 'Médio', {'walk': 25}, ['Comum', 'Anão'], [
        feat('Resiliência Anã', 'Vantagem em salvamentos contra veneno e resistência a dano de veneno.', 'resistance'),
        feat('Treinamento de Combate Anão', 'Proficiência com machado de batalha, machadinha, martelo leve e martelo de guerra.', 'proficiency'),
        feat('Proficiência em Ferramentas', 'Proficiência com uma ferramenta de artesão.', 'proficiency'),
        feat('Conhecimento de Pedras', 'Bônus de histórico em testes relacionados à alvenaria e trabalhos em pedra.', 'skill'),
    ], [
        sub('anao-da-colina', 'Anão da Colina', {'sabedoria': 1}, [feat('Resiliência Anã', 'Você ganha 1 ponto de vida adicional por nível.', 'hit-points')]),
        sub('anao-da-montanha', 'Anão da Montanha', {'forca': 2}, [feat('Treinamento de Armadura Anã', 'Proficiência com armaduras leves e médias.', 'proficiency')]),
        sub('duergar', 'Duergar', {'forca': 1}, [feat('Visão no Escuro Superior', 'Visão no escuro de 120 pés e sensibilidade à luz solar conforme a fonte.', 'sense')], 'Sword Coast Adventurer’s Guide', 'supplement'),
    ]),
    race('elfo', 'Elfo', 'Livro do Jogador', {'destreza': 2}, 'Médio', {'walk': 30}, ['Comum', 'Élfico'], [
        feat('Visão no Escuro', 'Visão no escuro de 60 pés.', 'sense'),
        feat('Sentidos Aguçados', 'Proficiência em Percepção.', 'proficiency'),
        feat('Ancestralidade Feérica', 'Vantagem contra a condição enfeitiçado e não pode ser magicamente adormecido.', 'condition'),
        feat('Transe', 'Não precisa dormir; medita por quatro horas.', 'rest'),
    ], [
        sub('alto-elfo', 'Alto elfo', {'inteligencia': 1}, [feat('Treinamento Élfico', 'Proficiência com armas élficas e um truque de mago.', 'proficiency')]),
        sub('elfo-da-floresta', 'Elfo da floresta', {'sabedoria': 1}, [feat('Pés Ligeiros', 'Deslocamento de 35 pés.', 'movement')]),
        sub('drow', 'Drow', {'carisma': 1}, [feat('Visão no Escuro Superior', 'Visão no escuro de 120 pés.', 'sense'), feat('Magia Drow', 'Luzes Dançantes e progressão de magias drow.', 'spell')]),
        sub('eladrin', 'Eladrin', {'carisma': 1}, [feat('Passo Feérico', 'Teleporte por Passo Nebuloso com efeito sazonal.', 'movement')], 'Mordenkainen’s Tome of Foes', 'supplement'),
        sub('shadar-kai', 'Shadar-kai', {'constituicao': 1}, [feat('Resistência Necrótica', 'Resistência a dano necrótico e teleporte.', 'resistance')], 'Mordenkainen’s Tome of Foes', 'supplement'),
        sub('elfo-do-mar', 'Elfo do mar', {'constituicao': 1}, [feat('Anfíbio', 'Natação de 30 pés e respiração aquática.', 'movement')], 'Mordenkainen’s Tome of Foes', 'supplement'),
        sub('elfo-astral', 'Elfo astral', {}, [feat('Transe Astral', 'Truque, teleporte e proficiência diária conforme a fonte.', 'trait')], 'Astral Adventurer’s Guide', 'supplement'),
    ]),
    race('halfling', 'Halfling', 'Livro do Jogador', {'destreza': 2}, 'Pequeno', {'walk': 25}, ['Comum', 'Halfling'], [
        feat('Sortudo', 'Quando tirar 1 em ataque, teste ou salvamento, pode rerrolar o dado.', 'reroll'),
        feat('Bravura', 'Vantagem contra a condição amedrontado.', 'condition'),
        feat('Agilidade Halfling', 'Pode atravessar o espaço de criaturas maiores.', 'movement'),
    ], [
        sub('pes-leves', 'Pés-leves', {'carisma': 1}, [feat('Furtividade Natural', 'Pode se esconder atrás de uma criatura pelo menos uma categoria maior.', 'skill')]),
        sub('robusto', 'Robusto', {'constituicao': 1}, [feat('Resiliência Robusta', 'Vantagem e resistência contra veneno.', 'resistance')]),
        sub('fantasma', 'Fantasma', {'sabedoria': 1}, [feat('Telepatia Limitada', 'Comunicação telepática de curto alcance.', 'trait')], 'The Wild Beyond the Witchlight', 'supplement'),
        sub('lotusden', 'Lotusden', {'sabedoria': 1}, [feat('Magia Natural', 'Druidcraft e magias de natureza por nível.', 'spell')], 'Explorer’s Guide to Wildemount', 'supplement'),
    ]),
    race('humano', 'Humano', 'Livro do Jogador', {}, 'Médio', {'walk': 30}, ['Comum'], [
        feat('Aumento de Atributos', '+1 em cada um dos seis atributos.', 'ability'),
        feat('Idioma Adicional', 'Um idioma adicional.', 'language'),
    ], [
        sub('humano-padrao', 'Humano padrão', {'forca': 1, 'destreza': 1, 'constituicao': 1, 'inteligencia': 1, 'sabedoria': 1, 'carisma': 1}, []),
        sub('humano-variante', 'Humano variante', {}, [feat('Aumento Flexível', '+1 em dois atributos.', 'ability'), feat('Perícia', 'Uma proficiência em perícia.', 'proficiency'), feat('Talento', 'Um talento no 1º nível quando autorizado pela campanha.', 'feat')]),
    ]),
    race('draconato', 'Draconato', 'Livro do Jogador', {'forca': 2, 'carisma': 1}, 'Médio', {'walk': 30}, ['Comum', 'Dracônico'], [
        feat('Ancestralidade Dracônica', 'Escolha uma ancestralidade para definir dano e área do sopro.', 'breath'),
        feat('Resistência Elemental', 'Resistência ao tipo de dano da ancestralidade.', 'resistance'),
        feat('Sopro', 'Sopro baseado em salvamento de Constituição, com dano que progride com o nível.', 'breath'),
    ], [
        sub('draconblood', 'Draconblood', {'inteligencia': 2, 'carisma': 1}, [feat('Visão no Escuro', 'Visão no escuro e bônus social ocasional.', 'sense')], 'Explorer’s Guide to Wildemount', 'supplement'),
        sub('ravenita', 'Ravenita', {'forca': 2, 'constituicao': 1}, [feat('Vingança Dracônica', 'Reação ofensiva após sofrer dano.', 'reaction')], 'Explorer’s Guide to Wildemount', 'supplement'),
    ]),
    race('gnomo', 'Gnomo', 'Livro do Jogador', {'inteligencia': 2}, 'Pequeno', {'walk': 25}, ['Comum', 'Gnômico'], [
        feat('Visão no Escuro', 'Visão no escuro de 60 pés.', 'sense'),
        feat('Astúcia Gnômica', 'Vantagem em salvamentos de Inteligência, Sabedoria e Carisma contra magia.', 'saving-throw'),
    ], [
        sub('gnomo-da-floresta', 'Gnomo da floresta', {'destreza': 1}, [feat('Ilusionista Natural', 'Comunicação limitada com animais pequenos.', 'trait')]),
        sub('gnomo-das-rochas', 'Gnomo das rochas', {'constituicao': 1}, [feat('Artífice Gnômico', 'Expertise em História sobre objetos mágicos.', 'skill')]),
        sub('gnomo-profundo', 'Gnomo profundo/Svirfneblin', {'destreza': 1}, [feat('Visão no Escuro Superior', 'Visão no escuro de 120 pés.', 'sense')], 'Mordenkainen’s Tome of Foes', 'supplement'),
    ]),
    race('meio-elfo', 'Meio-elfo', 'Livro do Jogador', {'carisma': 2}, 'Médio', {'walk': 30}, ['Comum', 'Élfico'], [
        feat('Visão no Escuro', 'Visão no escuro de 60 pés.', 'sense'),
        feat('Ancestralidade Feérica', 'Vantagem contra enfeitiçamento e imunidade a sono mágico.', 'condition'),
        feat('Versatilidade em Perícias', 'Duas proficiências adicionais em perícias.', 'proficiency'),
    ], [
        sub('meio-elfo-base', 'Base', {'destreza': 1, 'constituicao': 1}, []),
        sub('marca-da-deteccao', 'Marca da Detecção', {'sabedoria': 2}, [feat('Magia de Detecção', 'Bônus em Investigação/Intuição e magias de detecção.', 'spell')], 'Wayfinder’s Guide to Eberron', 'scenario'),
        sub('marca-da-tempestade', 'Marca da Tempestade', {'carisma': 2, 'destreza': 1}, [feat('Magia de Vento', 'Bônus em Acrobacia/navegação e magias de vento.', 'spell')], 'Wayfinder’s Guide to Eberron', 'scenario'),
    ]),
    race('meio-orc', 'Meio-orc', 'Livro do Jogador', {'forca': 2, 'constituicao': 1}, 'Médio', {'walk': 30}, ['Comum', 'Orc'], [
        feat('Visão no Escuro', 'Visão no escuro de 60 pés.', 'sense'),
        feat('Proficiência em Intimidação', 'Proficiência em Intimidação.', 'proficiency'),
        feat('Resistência Implacável', 'Evita cair a 0 PV uma vez por descanso longo.', 'survival'),
        feat('Ataques Selvagens', 'Adiciona um dado de dano em um crítico corpo a corpo.', 'critical'),
    ], [sub('marca-da-procura', 'Marca da Procura', {'sabedoria': 2, 'constituicao': 1}, [feat('Magia de Rastreamento', 'Bônus em Percepção/Sobrevivência e magias de rastreamento.', 'spell')], 'Wayfinder’s Guide to Eberron', 'scenario')]),
    race('tiefling', 'Tiefling', 'Livro do Jogador', {'carisma': 2}, 'Médio', {'walk': 30}, ['Comum', 'Infernal'], [
        feat('Visão no Escuro', 'Visão no escuro de 60 pés.', 'sense'),
        feat('Resistência Infernal', 'Resistência a dano de fogo.', 'resistance'),
        feat('Linhagem Infernal', 'Truque e magias de linhagem por nível.', 'spell'),
    ], [
        sub('asmodeus', 'Asmodeus', {'inteligencia': 1}, [feat('Linhagem de Asmodeus', 'Thaumaturgy, Hellish Rebuke e Darkness.', 'spell')]),
        sub('dispater', 'Dispater', {'destreza': 1}, [feat('Linhagem de Dispater', 'Thaumaturgy, Disguise Self e Detect Thoughts.', 'spell')]),
        sub('feral', 'Feral', {'destreza': 2, 'inteligencia': 1}, [feat('Linhagem Feral', 'Ajuste de atributos sem o Carisma +2 e magias de linhagem.', 'ability')]),
        sub('fierna', 'Fierna', {'sabedoria': 1}, [feat('Linhagem de Fierna', 'Friends, Charm Person e Suggestion.', 'spell')]),
        sub('glasya', 'Glasya', {'destreza': 1}, [feat('Linhagem de Glasya', 'Minor Illusion, Disguise Self e Invisibility.', 'spell')]),
        sub('levistus', 'Levistus', {'constituicao': 1}, [feat('Linhagem de Levistus', 'Ray of Frost, Armor of Agathys e Darkness.', 'spell')]),
        sub('zariel', 'Zariel', {'forca': 1}, [feat('Linhagem de Zariel', 'Thaumaturgy, Searing Smite e Branding Smite.', 'spell')]),
        sub('winged', 'Winged', {'inteligencia': 1}, [feat('Asas', 'Voo de 30 pés sem armadura pesada.', 'movement')], 'Sword Coast Adventurer’s Guide', 'supplement'),
    ]),
]

supplemental = [
    race('aarakocra', 'Aarakocra', 'Elemental Evil Player’s Companion', {'destreza': 2, 'sabedoria': 1}, 'Médio', {'walk': 25, 'fly': 50}, ['Comum', 'Auran'], [feat('Voo', 'Voo de 50 pés.', 'movement')], availability='supplement'),
    race('aasimar', 'Aasimar', 'Volo’s Guide to Monsters', {'carisma': 2}, 'Médio', {'walk': 30}, ['Comum', 'Celestial'], [feat('Visão no Escuro', 'Visão no escuro de 60 pés.', 'sense'), feat('Resistência Celestial', 'Resistência a dano necrótico e radiante.', 'resistance')], [sub('protetor', 'Protetor', {'sabedoria': 1}, [feat('Alma Radiante', 'Transformação com asas e dano radiante.', 'transformation')]), sub('flagelador', 'Flagelador', {'constituicao': 1}, [feat('Consumo Radiante', 'Aura radiante que também causa dano ao próprio personagem.', 'transformation')]), sub('caido', 'Caído', {'forca': 1}, [feat('Alma Necrótica', 'Transformação que amedronta e causa dano necrótico.', 'transformation')])], availability='supplement'),
    race('firbolg', 'Firbolg', 'Volo’s Guide to Monsters', {'sabedoria': 2, 'forca': 1}, 'Médio', {'walk': 30}, ['Comum', 'Élfico', 'Gigante'], [feat('Passo Oculto', 'Invisibilidade por curto período.', 'movement'), feat('Magia Firbolg', 'Detect Magic e Disguise Self.', 'spell'), feat('Constituição Poderosa', 'Capacidade de carga ampliada.', 'carry')], availability='supplement'),
    race('genasi', 'Genasi', 'Elemental Evil Player’s Companion', {'constituicao': 2}, 'Médio', {'walk': 30}, ['Comum', 'Primordial'], [], [sub('ar', 'Ar', {'destreza': 1}, [feat('Levitação', 'Prende a respiração indefinidamente e conjura Levitate.', 'spell')]), sub('terra', 'Terra', {'forca': 1}, [feat('Passo Terrestre', 'Ignora terreno difícil natural e conjura Pass without Trace.', 'movement')]), sub('fogo', 'Fogo', {'inteligencia': 1}, [feat('Resistência ao Fogo', 'Visão no escuro, resistência a fogo e Produce Flame.', 'resistance')]), sub('agua', 'Água', {'sabedoria': 1}, [feat('Anfíbio', 'Resistência a ácido, natação e respiração aquática.', 'movement')])], availability='supplement'),
    race('goliath', 'Goliath', 'Volo’s Guide to Monsters', {'forca': 2, 'constituicao': 1}, 'Médio', {'walk': 30}, ['Comum', 'Gigante'], [feat('Atletismo', 'Proficiência em Atletismo.', 'proficiency'), feat('Resistência de Pedra', 'Reduz dano uma vez por descanso curto ou longo.', 'reaction'), feat('Adaptação à Altitude', 'Adaptação a altitude e frio.', 'trait')], availability='supplement'),
    race('goblin', 'Goblin', 'Volo’s Guide to Monsters', {'destreza': 2, 'constituicao': 1}, 'Pequeno', {'walk': 30}, ['Comum', 'Goblin'], [feat('Visão no Escuro', 'Visão no escuro.', 'sense'), feat('Nimble Escape', 'Esquivar ou Esconder como ação bônus.', 'action'), feat('Fúria do Pequeno', 'Dano adicional contra criatura maior uma vez por descanso.', 'damage')], availability='supplement'),
    race('hobgoblin', 'Hobgoblin', 'Volo’s Guide to Monsters', {'constituicao': 2, 'inteligencia': 1}, 'Médio', {'walk': 30}, ['Comum', 'Goblin'], [feat('Saving Face', 'Adiciona bônus baseado nos aliados próximos a um teste falho uma vez por descanso longo.', 'reaction')], availability='supplement'),
    race('bugbear', 'Bugbear', 'Volo’s Guide to Monsters', {'forca': 2, 'destreza': 1}, 'Médio', {'walk': 30}, ['Comum', 'Goblin'], [feat('Ataque Surpresa', 'Dano adicional no primeiro ataque contra criatura surpreendida.', 'damage'), feat('Alcance Ampliado', 'Alcance ampliado e capacidade de carga ampliada.', 'combat')], availability='supplement'),
    race('kenku', 'Kenku', 'Volo’s Guide to Monsters', {'destreza': 2, 'sabedoria': 1}, 'Médio', {'walk': 30}, ['Comum', 'Auran'], [feat('Mimetismo', 'Imita sons e vozes.', 'trait'), feat('Proficiências Kenku', 'Duas proficiências entre Acrobacia, Enganação, Furtividade e Prestidigitação.', 'proficiency')], availability='supplement'),
    race('kobold', 'Kobold', 'Volo’s Guide to Monsters', {'destreza': 2, 'forca': -2}, 'Pequeno', {'walk': 30}, ['Comum', 'Dracônico'], [feat('Táticas de Matilha', 'Vantagem quando um aliado está próximo do alvo.', 'combat'), feat('Sensibilidade à Luz Solar', 'Desvantagem sob luz solar direta.', 'condition')], availability='supplement'),
    race('orc', 'Orc', 'Volo’s Guide to Monsters', {'forca': 2, 'constituicao': 1}, 'Médio', {'walk': 30}, ['Comum', 'Orc'], [feat('Agressivo', 'Move-se como ação bônus em direção a um inimigo.', 'action'), feat('Carga Ampliada', 'Capacidade de carga ampliada.', 'carry')], availability='supplement'),
    race('warforged', 'Warforged', 'Eberron: Rising from the Last War', {'constituicao': 2}, 'Médio', {'walk': 30}, ['Comum'], [feat('Resiliência do Constructo', 'Resistência a veneno, imunidade a doença e não precisa comer, beber, respirar ou dormir.', 'immunity'), feat('Proteção Integrada', 'Bônus de CA conforme a configuração.', 'armor'), feat('Versatilidade', 'Uma perícia e uma ferramenta.', 'proficiency')], availability='scenario'),
    race('changeling', 'Changeling', 'Eberron: Rising from the Last War', {'carisma': 2}, 'Médio', {'walk': 30}, ['Comum'], [feat('Mudança de Aparência', 'Altera aparência e voz.', 'trait'), feat('Versatilidade em Perícias', 'Duas proficiências entre Enganação, Intuição, Intimidação e Persuasão.', 'proficiency')], availability='scenario'),
    race('kalashtar', 'Kalashtar', 'Eberron: Rising from the Last War', {'sabedoria': 2, 'carisma': 1}, 'Médio', {'walk': 30}, ['Comum', 'Quori'], [feat('Resistência Psíquica', 'Resistência psíquica e proteção contra efeitos de sonho.', 'resistance'), feat('Telepatia', 'Comunicação telepática.', 'trait')], availability='scenario'),
    race('shifter', 'Shifter', 'Eberron: Rising from the Last War', {}, 'Médio', {'walk': 30}, ['Comum'], [feat('Mudança Bestial', 'Transformação concede benefícios temporários conforme a variante.', 'transformation')], [sub('beasthide', 'Beasthide', {'constituicao': 2, 'forca': 1}, [feat('Pele Bestial', 'PV temporários adicionais e +1 CA durante a transformação.', 'armor')], availability='scenario'), sub('longtooth', 'Longtooth', {'forca': 2, 'destreza': 1}, [feat('Mordida Bestial', 'Mordida durante a transformação.', 'attack')], availability='scenario'), sub('swiftstride', 'Swiftstride', {'destreza': 2, 'carisma': 1}, [feat('Passo Rápido', 'Velocidade adicional e reação de deslocamento.', 'movement')], availability='scenario'), sub('wildhunt', 'Wildhunt', {'sabedoria': 2, 'destreza': 1}, [feat('Caçador Selvagem', 'Vantagem em testes de Sabedoria e nega vantagem de inimigos próximos.', 'combat')], availability='scenario')], availability='scenario'),
    race('centauro', 'Centauro', 'Guildmasters’ Guide to Ravnica', {'forca': 2, 'sabedoria': 1}, 'Médio', {'walk': 40}, ['Comum', 'Silvestre'], [feat('Cascos', 'Ataque de cascos e capacidade de carga ampliada.', 'attack'), feat('Carga', 'Benefícios após investir.', 'combat')], availability='scenario'),
    race('loxodon', 'Loxodon', 'Guildmasters’ Guide to Ravnica', {'constituicao': 2, 'sabedoria': 1}, 'Médio', {'walk': 30}, ['Comum', 'Loxodon'], [feat('Armadura Natural', 'CA natural 12 + Destreza.', 'armor'), feat('Tromba', 'Tarefas simples com a tromba.', 'trait')], availability='scenario'),
    race('minotauro', 'Minotauro', 'Guildmasters’ Guide to Ravnica', {'forca': 2, 'constituicao': 1}, 'Médio', {'walk': 30}, ['Comum', 'Minotauro'], [feat('Chifres', 'Ataque de chifres, investida e empurrão.', 'attack')], availability='scenario'),
    race('simic-hybrid', 'Simic Hybrid', 'Guildmasters’ Guide to Ravnica', {'constituicao': 2}, 'Médio', {'walk': 30}, ['Comum', 'Élfico ou Vedalken'], [feat('Adaptação Animal', 'Duas adaptações animais, uma no 1º e outra no 5º nível.', 'adaptation')], availability='scenario'),
    race('vedalken', 'Vedalken', 'Guildmasters’ Guide to Ravnica', {'inteligencia': 2, 'sabedoria': 1}, 'Médio', {'walk': 30}, ['Comum', 'Vedalken'], [feat('Precisão Vedalken', 'Perícia e ferramenta com bônus 1d4.', 'proficiency'), feat('Resistência Vedalken', 'Vantagem em salvamentos de Inteligência, Sabedoria e Carisma.', 'saving-throw')], availability='scenario'),
    race('leonino', 'Leonino', 'Mythic Odysseys of Theros', {'constituicao': 2, 'forca': 1}, 'Médio', {'walk': 35}, ['Comum'], [feat('Rugido Intimidador', 'Rugido que amedronta criaturas próximas.', 'action'), feat('Garras', 'Ataque natural de garras.', 'attack')], availability='scenario'),
    race('satyr', 'Satyr', 'Mythic Odysseys of Theros', {'carisma': 2, 'destreza': 1}, 'Médio', {'walk': 35}, ['Comum', 'Silvestre'], [feat('Resistência Mágica', 'Vantagem contra magia.', 'saving-throw'), feat('Saltador', 'Salto ampliado.', 'movement')], availability='scenario'),
    race('fairy', 'Fairy', 'The Wild Beyond the Witchlight', {}, 'Pequeno', {'walk': 30, 'fly': 30}, ['Comum', 'Silvestre'], [feat('Voo Feérico', 'Voo de 30 pés sem armadura média ou pesada.', 'movement'), feat('Magia Feérica', 'Druidcraft, Faerie Fire e Enlarge/Reduce.', 'spell')], availability='supplement'),
    race('harengon', 'Harengon', 'The Wild Beyond the Witchlight', {}, 'Pequeno ou Médio', {'walk': 30}, ['Comum', 'Silvestre'], [feat('Pés de Coelho', 'Bônus de proficiência na iniciativa e salto bônus.', 'initiative'), feat('Salvamento Sortudo', 'Reação para melhorar salvamento de Destreza.', 'reroll')], availability='supplement'),
    race('owlin', 'Owlin', 'Strixhaven: A Curriculum of Chaos', {}, 'Pequeno ou Médio', {'walk': 30, 'fly': 30}, ['Comum', 'Auran'], [feat('Voo Silencioso', 'Voo e proficiência em Furtividade.', 'movement'), feat('Visão no Escuro Superior', 'Visão no escuro de 120 pés.', 'sense')], availability='scenario'),
    race('tortle', 'Tortle', 'The Tortle Package', {'forca': 2, 'sabedoria': 1}, 'Médio', {'walk': 30}, ['Comum', 'Aquan'], [feat('Armadura Natural', 'CA natural 17.', 'armor'), feat('Casco', 'Defesa especial que altera ações.', 'armor'), feat('Garras', 'Ataque natural.', 'attack')], availability='supplement'),
]

output = {'schemaVersion': 'races-2014.1', 'edition': '2014', 'sourceDocument': 'Mapeamento de raças e características — D&D 5e (2014)', 'abilityScoreRule': 'fixed_2014', 'customizationRule': {'enabled': True, 'source': 'Tasha’s Cauldron of Everything', 'description': '+2 em um atributo e +1 em outro, ou +1 em três atributos, somente quando autorizado pela campanha.'}, 'races': races + supplemental}
Path('data/race-reference.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'geradas {len(output["races"])} raças e {sum(len(r["subraces"]) for r in output["races"])} sub-raças/variantes')
