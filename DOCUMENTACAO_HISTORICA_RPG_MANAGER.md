# RPG Manager — Documentação histórica e panorama técnico

**Projeto:** RPG Manager  
**Repositório:** [`thiagoingadigital-lgtm/new-rpg-manager`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager)  
**Branch analisada:** `feat/atlas-character-layout`  
**Commit mais recente analisado:** [`5644076`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/5644076713a6e0e2bb2ec1e81b966cb4bae789a0)  
**Período coberto:** 18 a 20 de agosto de 2026  
**Quantidade de commits analisados:** 35

## 1. Objetivo desta documentação

Este documento apresenta um panorama histórico e técnico do RPG Manager. O levantamento foi feito diretamente sobre o histórico Git da branch analisada, relacionando cada commit com os arquivos modificados e com a funcionalidade correspondente. A documentação também descreve o estado atual da aplicação, sua arquitetura, os catálogos de regras D&D 5e 2014 já integrados, as rotas principais e os pontos que ainda exigem evolução.

> **Critério histórico:** cada versão é identificada pelo hash curto, data, mensagem do commit e arquivos registrados pelo Git. A descrição funcional sintetiza o propósito observável da alteração; ela não substitui a leitura do diff original.

## 2. Resumo executivo da evolução

O projeto começou como uma aplicação web de gerenciamento de personagens com SQLite, uma home temática, uma página de lore, regras de paladino e uma primeira camada de dados D&D 5e. Em seguida, passou por uma reconstrução visual completa, transformando o `index.html` na home principal e distribuindo o produto em módulos de personagens, grimório, mapas, biblioteca, rolagem e diário.

A evolução mais importante ocorreu em três frentes. A primeira foi a **consolidação do sistema visual**, que passou de uma interface escura com âmbar/roxo para uma linguagem editorial de alto contraste, com identidade de pôster japonês retrô e paleta baseada em índigo, cobre/vermelho e papel. A segunda foi a **migração para uma arquitetura full-stack**, com Express, SQLite via `sql.js`, sessões HTTP, autenticação, persistência de mapas, biblioteca, rolagens, diário, histórico de personagens e recursos de campanha. A terceira foi a **automatização progressiva das regras de criação de personagens**, incorporando classes, subclasses, raças, sub-raças, backgrounds, proficiências, salvaguardas, atributos derivados, feitiços e equipamentos.

| Marco | Resultado acumulado |
|---|---|
| Fundação | Express, SQLite, personagens, templates, regras e referência inicial de paladino |
| Reconstrução visual | Home como entrada, módulos navegáveis e identidade editorial unificada |
| Mapas e biblioteca | Mapas com imagem de fundo, zoom, pan, marcadores persistentes e vínculos com registros |
| Grimório | Catálogo SRD, filtros por classe/nível, favoritos e preparação por ficha |
| Full-stack | Usuários, sessões, campanhas, mapas, biblioteca, rolagens, diário e histórico |
| D&D 5e 2014 | 13 classes, 118 subclasses, 35 raças, 44 sub-raças, 13 backgrounds e 96 itens catalogados |
| Estado atual | Criação guiada de ficha e inventário com cálculos derivados automáticos em expansão |

## 3. Arquitetura atual

A aplicação utiliza um frontend tradicional baseado em HTML5, CSS3 e JavaScript vanilla. O backend é executado em Node.js com Express. A persistência usa SQLite por meio do `sql.js`, uma implementação em JavaScript/WASM que evita dependências nativas de compilação. Os dados de referência de D&D são mantidos em arquivos JSON versionados no repositório e são expostos ao frontend por endpoints Express.

| Camada | Componentes principais | Responsabilidade |
|---|---|---|
| Interface | `public/*.html`, `public/app.js`, `public/style.css` | Telas, wizard de criação, inventário, grimório, mapas, biblioteca, diário e rolagem |
| API | `server.js`, `feature_api.js` | Rotas REST, autenticação, personagens, itens, recursos, features e integrações avançadas |
| Persistência | `db.js` | Inicialização SQLite/WASM, migrações incrementais e acesso às tabelas |
| Referências D&D | `data/*.json` | Classes, subclasses, raças, backgrounds, itens e feitiços |
| Scripts de importação | `scripts/*.py`, `scripts/*.mjs` | Geração e importação de catálogos estruturados |
| Sessão | Cookie HTTP-only `rpg_session`, tabela `sessions` | Validação de login, expiração e associação do usuário |

### 3.1. Tabelas persistidas

O esquema atual inclui tabelas para classes, features, bônus de proficiência, slots de magia, feitiços, personagens, features e feitiços de personagens, usuários, sessões, campanhas, membros de campanha, mapas, marcadores, registros da biblioteca, vínculos, histórico da biblioteca, rolagens, diário, histórico de personagens, condições, ataques, múltiplas classes, favoritos de feitiços e feitiços preparados.

As colunas adicionadas progressivamente ao personagem incluem `subclass`, `campaignId`, `ownerId`, `creationData` e `subrace`. Os objetos complexos — atributos, proficiências, recursos, itens, uso de slots e dados de criação — continuam serializados em campos JSON na tabela de personagens, enquanto recursos avançados possuem tabelas próprias.

### 3.2. Rotas de referência e módulos

O backend possui rotas legadas de personagens, itens, recursos, features e feitiços, além de endpoints avançados sob `/api/v2`. Entre os endpoints de referência estão `/api/class-reference`, `/api/race-reference`, `/api/background-reference` e `/api/item-reference`. A aplicação também expõe consultas para bônus de proficiência, classes, feitiços e dados derivados utilizados pelo frontend.

## 4. Catálogos de regras D&D 5e 2014

### 4.1. Classes e subclasses

O catálogo atual possui 13 classes estruturadas em `data/class-reference.json`. Cada classe pode carregar dado de vida, atributo principal, função, descrição, progressão e features por nível. O fluxo de criação seleciona a classe antes de disponibilizar as opções de subclasse e respeita o nível mínimo definido no catálogo.

O histórico registra a inclusão de 118 subclasses. A subclasse **Lorde Dragão** foi integrada como opção normal da classe Paladino, sem uma tela ou categoria independente. A seleção é condicionada ao nível de desbloqueio da classe e fica armazenada no registro do personagem.

### 4.2. Raças e sub-raças

O arquivo `data/race-reference.json` contém 35 raças e 44 sub-raças/variantes. A seleção da raça carrega automaticamente aumentos de atributos, traços, sentidos, deslocamento, idiomas, proficiências e escolhas raciais quando disponíveis.

O sistema calcula os atributos efetivos separando os valores-base persistidos dos bônus raciais. Isso permite que o usuário continue editando os valores originais sem incorporar permanentemente o modificador racial ao valor-base.

### 4.3. Backgrounds

O arquivo `data/background-reference.json` contém 13 backgrounds e variantes estruturadas. O wizard deixou de utilizar um campo textual livre e passou a exigir a seleção de um background válido. O painel de revisão apresenta perícias automáticas, ferramentas, idiomas, equipamento inicial, característica narrativa e variante escolhida.

As perícias do background são combinadas com as proficiências de classe e raça. O equipamento inicial é transformado em itens do inventário, preservando uma referência ao background e à variante em `creationData`.

### 4.4. Itens e inventário

O arquivo `data/item-reference.json` contém 96 itens derivados do mapeamento enviado para D&D 5e 2014. A composição atual é de 36 armas, 12 armaduras, um escudo e itens de aventura, munições e cura.

As armas registram categoria simples ou marcial, uso corpo a corpo ou à distância, dado de dano, tipo de dano, peso, custo e propriedades como acuidade, leve, pesada, munição, recarga, alcance, arremesso, duas mãos, versátil e especial. As armaduras registram categoria, CA base, limite de Destreza, Força mínima, desvantagem em Furtividade, peso e custo. O escudo registra bônus de CA.

O inventário possui um campo pesquisável ligado ao catálogo. Ao selecionar um item catalogado, os detalhes mecânicos são preenchidos automaticamente. Quando o item é equipado, a ficha recalcula CA e exibe dados derivados de ataque, dano e alcance para armas.

> **Regra de cálculo implementada:** armas de acuidade escolhem o maior modificador entre Força e Destreza; armas à distância ou com munição utilizam Destreza; as demais armas corpo a corpo utilizam Força. O bônus de proficiência é adicionado somente quando a classe é considerada proficiente pelo modelo atual.

## 5. Panorama histórico por commit

### 5.1. Fundação e primeira identidade — 18 de agosto de 2026

| # | Commit | Implementação histórica |
|---:|---|---|
| 1 | [`680cff9`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/680cff99adc5b0c069fc3d0c7473fb5a9c8f242c) | Criação da base inicial com Express, SQLite, dados de personagens, templates, home, lore, regras, referência de paladino, classes D&D iniciais, slots de magia e feitiços de paladino. |
| 2 | [`f0718c6`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/f0718c6960adf8b6014a5c8eb0c94b989da837d8) | Migração do driver `better-sqlite3` para `sql.js`, usando SQLite puro em JavaScript/WASM e eliminando a compilação nativa. |
| 3 | [`94747eb`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/94747eb631d731122042909f517d66905af8c862) | Adição do campo `inHall` e da migração correspondente para suportar o Hall dos Heróis. |
| 4 | [`2e6a5d7`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/2e6a5d70a356861254527f6900eef317ecae64f1) | Redesign escuro com âmbar/roxo, home com Hall dos Heróis destacável, lore redesenhada e controle de inclusão no Hall. |

### 5.2. Reconstrução visual e modularização — 19 de agosto de 2026

| # | Commit | Implementação histórica |
|---:|---|---|
| 5 | [`7326175`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/73261753edc46897fbdbf4c7370df0c8a26044f0) | Criação de novo layout editorial para a home e a área de personagens. |
| 6 | [`594eed4`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/594eed4ecf825ea225c81a63ab6b25655fa7781e) | Unificação do layout e definição da home como entrada principal do produto. |
| 7 | [`91500fc`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/91500fcd5110ec6dd6ee87a77ba522e8eff6b390) | Transformação do `index` em home, criação do grimório filtrável, criação da página de personagens e remoção da página de lore. |
| 8 | [`eb964d0`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/eb964d0166e15817258d96e9e1277763be2314bf) | Correção da persistência das proficiências de perícias e salvaguardas. |
| 9 | [`4c4c8ae`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/4c4c8ae8e87a72d51d8006002fe9eed12c8ef0f3) | Fundação modular para campanha, incluindo biblioteca, mapas, rolagem e uma primeira estrutura de sessão. |
| 10 | [`7a23e70`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/7a23e70c57c65a3ded7d7ade30da7f189ef465b3) | Conexão da navegação entre os módulos do produto. |
| 11 | [`5fd9c80`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/5fd9c80746ad0b68cf40b715cd9c444dbfc0dc3f) | Reconstrução de telas antigas com o novo sistema visual, incluindo personagens, regras e referência histórica do Lorde Dragão. |
| 12 | [`1574159`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/1574159cbc8b09993749efbdbc654e51524de511) | Reescrita do frontend da ficha de personagens. |
| 13 | [`d65ad5d`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/d65ad5d38516acdc8a645274600a761f9536bbd3) | Reescrita e atualização dos documentos de referência do frontend. |
| 14 | [`b9f2a04`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/b9f2a048d9f538ae3dacd630eca32db2518dc3a7) | Integração inicial do Lorde Dragão como subclasse do Paladino e atualização das telas associadas. |
| 15 | [`ace82c1`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/ace82c1dffe4caf93eeb0aadd20af01b77b0a199) | Atualização de mapas, biblioteca e identidade nominal do RPG Manager; remoção das páginas independentes de Lorde Dragão e sessão. |

### 5.3. Mapas, marcadores e biblioteca

| # | Commit | Implementação histórica |
|---:|---|---|
| 16 | [`2655a7b`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/2655a7b72a855b2e5ed22730d4a80a4be51b785e) | Criação do editor de mapas com imagem de fundo, marcadores e persistência de posições. |
| 17 | [`7b1cfac`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/7b1cfacd0d20fd03bfc7d39208572b239c7fd77e) | Remoção do card de sessão da home. |
| 18 | [`085b762`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/085b7628313f01549f6ce23ad4a170dd95ac3aee) | Aprimoramento do editor de mapas e da biblioteca. |
| 19 | [`f8c7cf6`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/f8c7cf64764ea5cecbe28536c62367c97fa5f638) | Remoção de registros pré-criados da biblioteca e correções no zoom do mapa. |
| 20 | [`a94dd2b`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/a94dd2bd7a5bc327dda1a1bebaefeaf9635e5ae4) | Integração de imagens de NPC aos marcadores e uso da miniatura vinculada no mapa. |
| 21 | [`9c84d74`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/9c84d7464601433b2584e50814be3017228ccac9) | Simplificação da seleção dos marcadores. |
| 22 | [`583b444`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/583b444a18864f2edcc495d0ee0d66b4a4fc31df) | Melhorias na experiência da tela de mapas. |
| 23 | [`5efab2a`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/5efab2a217239f69c7dba96535d22cd3d68b7321) | Revisão da interação de movimentação e pan do mapa. |

### 5.4. Grimório, classes e expansão full-stack

| # | Commit | Implementação histórica |
|---:|---|---|
| 24 | [`00c5363`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/00c5363bacd6d05c835c3e0df4c7f5498f718642) | Correções de carregamento da ficha e do grimório por classe. |
| 25 | [`8dd01c5`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/8dd01c56c862c659d70e62f9771962368bec62b5) | Expansão das classes e do grimório por classe, com importação de 319 feitiços SRD estruturados. |
| 26 | [`6accc70`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/6accc70977ee45a982dee9905b1ef27d208b80d6) | Melhoria do contraste da ficha. |
| 27 | [`80aeebc`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/80aeebc72366ca4da4c108d69c023990d5cf01b7) | Início da expansão full-stack: banco ampliado, API de features, migração de dados antigos, login, diário, módulos persistentes e suporte a recursos avançados. |
| 28 | [`57bc306`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/57bc306847d9531c1a5879170e33a67fdd585eb8) | Alinhamento da identidade visual do grimório com o restante do sistema. |

### 5.5. Regras de criação de personagem e inventário

| # | Commit | Implementação histórica |
|---:|---|---|
| 29 | [`058815c`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/058815cee1dd554b66cd9550e8a72157395a7bef) | Catálogo estruturado de classes e features D&D 5e 2014, incluindo carregamento automático de recursos e progressão. |
| 30 | [`49ca843`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/49ca8436ec6df5686e9e59320a793f09710d5170) | Inclusão do Lorde Dragão na lista de subclasses do Paladino. |
| 31 | [`c182ba1`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/c182ba1758e94fb538ddeb9ad3e866193189c80c) | Criação do wizard guiado de ficha em seis etapas: campanha, conceito, origem, classe, atributos e revisão; inclusão de níveis de desbloqueio de subclasse. |
| 32 | [`025633a`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/025633a4d651b4387d59bd25eb1e8a2557d1dcbc) | Integração de raças, sub-raças e modificadores automáticos D&D 5e 2014. |
| 33 | [`f3a33b4`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/f3a33b41c7e882073c32c30962cdd8daf693e5e3) | Guia de proficiências por classe e raça, com salvaguardas definidas pela classe e escolhas limitadas de perícias. |
| 34 | [`a5d1155`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/a5d1155f88efcbf6b43684f1d75a8066bc964786) | Integração de 13 backgrounds, variantes, perícias automáticas, característica narrativa, equipamentos iniciais e persistência da referência de origem. |
| 35 | [`5644076`](https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/5644076713a6e0e2bb2ec1e81b966cb4bae789a0) | Integração do catálogo de 96 itens, seleção pesquisável, cálculo automático de CA, bônus de ataque, dano, alcance, proficiência e regras básicas de armadura. |

## 6. Funcionalidades atuais por tela

### Home

A home funciona como ponto de entrada do produto e distribui os módulos principais. A navegação histórica removeu a página independente de lore e o card de sessão, reorganizando a experiência em torno de personagens, grimório, mapas, biblioteca, rolagem e diário.

### Personagens

A tela de personagens possui lista lateral de fichas, seleção de personagem, edição de identidade, retrato, atributos, nível, classe, subclasse, raça, sub-raça, salvaguardas, perícias, features, recursos, feitiços, slots e inventário. Também existem exclusão com confirmação, autosave, exportação JSON e carregamento de estatísticas derivadas.

A criação é conduzida por um wizard de seis passos. As opções de classe, raça, sub-raça e background alimentam o estado da ficha antes do envio ao backend. A tela separa atributos-base e atributos efetivos, permitindo que modificadores raciais sejam recalculados de forma previsível.

### Grimório

O grimório possui catálogo de feitiços, busca, filtro por nível, filtro opcional, seleção por classe, favoritos e preparação por personagem. O backend mantém tabelas para favoritos e feitiços preparados. O catálogo atual contém 319 feitiços SRD importados.

### Mapas

A tela de mapas trabalha com uma imagem de fundo fornecida pelo usuário, marcadores persistentes, zoom, pan, seleção, movimentação e modo semicheio/Snap Assist. Os marcadores podem ser associados a NPCs ou fichas de jogador e exibem miniatura quando o registro vinculado possui imagem.

A evolução da interação passou por várias revisões. O comportamento consolidado prioriza movimentação simples dos marcadores, pan do mapa com arraste e suporte a zoom sem redimensionar indevidamente o marcador vetorial.

### Biblioteca

A biblioteca permite criar, editar e excluir registros, especialmente NPCs, adicionar imagens, escrever descrições e vincular registros aos marcadores de mapa. O backend prevê registros, tags, vínculos, histórico e permissões, embora a profundidade final da interface de permissões ainda dependa de validação adicional.

### Rolagem

A aplicação possui tela de rolagem e uma tabela persistida de rolagens no modelo full-stack. O histórico anterior utilizava armazenamento local; a expansão full-stack iniciou a migração para persistência associada ao usuário/campanha.

### Diário

O módulo de diário foi criado durante a expansão full-stack. A estrutura de banco prevê entradas persistentes, mas a interface ainda deve ser auditada para confirmar a cobertura de edição, histórico e associação por campanha.

### Login e autenticação

A aplicação possui tela de login, validação no backend, hashing de senhas com `scrypt` e sessões HTTP-only. O banco contém tabelas de usuários e sessões com expiração. O controle efetivo de acesso deve continuar sendo verificado em cada rota que manipula dados privados.

## 7. Cálculos automáticos atualmente implementados

| Cálculo | Fonte principal | Estado |
|---|---|---|
| Modificador de atributo | Atributo-base + bônus racial/sub-racial | Implementado |
| Bônus de proficiência | Nível do personagem | Implementado |
| Salvaguardas | Proficiências definidas pela classe | Implementado no fluxo principal |
| Perícias | Classe, raça/sub-raça e background | Implementado com escolhas limitadas |
| Percepção passiva | Sabedoria, proficiência em Percepção e bônus | Implementado |
| Iniciativa | Modificador de Destreza | Implementado |
| CA sem equipamento | 10 + modificador de Destreza | Implementado |
| CA com armadura | CA base + Destreza conforme categoria e limite | Implementado |
| CA com escudo | CA calculada + bônus do escudo | Implementado |
| Penalidade de Força | Aviso e registro de redução de deslocamento | Parcial; o deslocamento visual deve ser expandido |
| Ataque com arma | Atributo adequado + proficiência quando aplicável | Implementado no inventário |
| Dano com arma | Dado e tipo catalogados | Exibido automaticamente |
| Alcance | Propriedade de munição/arremesso | Exibido quando mapeado |
| Conjuração | CD, ataque mágico, slots e preparadas | Implementado para o núcleo atual |

## 8. Pontos de atenção e limitações conhecidas

A automação de itens foi construída sobre os dados disponíveis no mapeamento e sobre o modelo atual de classes. A validação de proficiência de armas e armaduras ainda utiliza regras simplificadas por categoria e classe; uma futura versão deve mover as proficiências de armas, armaduras e escudos para campos explícitos do catálogo de classes.

O cálculo de CA contempla armadura, limite de Destreza e escudo, mas ainda deve ser ampliado para cobrir estilos de combate, defesa sem armadura, itens mágicos, talentos, condições, efeitos temporários, cobertura, resistência e características raciais ou de classe que alterem CA.

O inventário armazena detalhes mecânicos em JSON dentro do personagem. Para um ambiente de produção colaborativo, seria preferível uma tabela de itens catalogados, uma tabela de itens possuídos e uma tabela de efeitos derivados, mantendo referências versionadas ao catálogo D&D.

O plano de múltiplas classes já possui estrutura de banco e endpoints avançados, mas a interface completa de multiclassing ainda precisa ser conectada ao fluxo de criação e ao cálculo de níveis, proficiências, slots e features combinadas.

O armazenamento de imagens foi iniciado com uploads locais e validação de extensão/tamanho. A migração para armazenamento de arquivos dedicado, validação MIME real, redimensionamento, remoção segura e associação por usuário/campanha ainda é uma etapa necessária.

A documentação histórica confirma que o projeto passou por uma página de sessão independente, mas essa estrutura foi removida do produto durante a reorganização. Os módulos atuais devem ser tratados como ferramentas separadas de personagens, mapas, biblioteca, grimório, rolagem e diário.

## 9. Próximas evoluções recomendadas

A próxima etapa técnica recomendada é consolidar um **motor de efeitos derivados**. Esse motor deve receber atributos, proficiências, equipamento, condições, efeitos raciais, características de classe, talentos e modificadores temporários, produzindo uma ficha derivada única. Dessa forma, CA, ataques, dano, deslocamento, resistências, testes e conjuração não dependerão de regras dispersas em funções da interface.

Em paralelo, o inventário deve ganhar uma camada de ações estruturadas: equipar uma armadura deve desequipar outra automaticamente; equipar um escudo deve considerar ocupação de mão; armas de duas mãos, recarga, munição, alcance, arremesso, versátil e especial devem participar do resolvedor de ataque; e a interface deve distinguir item catalogado, item homebrew e item mágico.

Também é recomendável concluir a interface de campanhas e permissões, migrar imagens para storage adequado, conectar multiclassing à ficha, revisar a responsividade mobile e criar testes automatizados para os cálculos mais sensíveis.

## 10. Referências internas

[1]: https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commits/feat/atlas-character-layout "Histórico da branch feat/atlas-character-layout"
[2]: https://github.com/thiagoingadigital-lgtm/new-rpg-manager/tree/feat/atlas-character-layout "Código atual da branch analisada"
[3]: https://github.com/thiagoingadigital-lgtm/new-rpg-manager/commit/5644076713a6e0e2bb2ec1e81b966cb4bae789a0 "Commit de integração dos itens D&D 5e 2014"

## Apêndice A — Arquivos centrais

| Arquivo | Função |
|---|---|
| `server.js` | Servidor Express, autenticação, personagens, itens, recursos e endpoints de referência |
| `feature_api.js` | API avançada de histórico, condições, ataques, classes, favoritos e feitiços preparados |
| `db.js` | Schema SQLite/WASM e migrações incrementais |
| `public/app.js` | Estado do frontend, wizard, cálculos derivados, inventário e renderização da ficha |
| `public/personagens.html` | Estrutura da ficha e do wizard de criação |
| `public/grimorio.html` | Interface do grimório e filtros de feitiços |
| `public/mapas.html` | Editor de mapas, zoom, pan e marcadores |
| `public/biblioteca.html` | Registros, NPCs, imagens e vínculos |
| `data/class-reference.json` | Classes, subclasses, features e progressões |
| `data/race-reference.json` | Raças, sub-raças, atributos e traços |
| `data/background-reference.json` | Backgrounds, variantes, perícias e equipamento inicial |
| `data/item-reference.json` | Armas, armaduras, escudo, munições e equipamentos catalogados |
| `data/srd-spells.json` | Catálogo importado de feitiços SRD |
| `scripts/` | Geradores e importadores dos catálogos de regras |
