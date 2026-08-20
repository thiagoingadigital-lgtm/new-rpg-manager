# Integração de itens D&D 5e 2014

- [x] Extrair e revisar o mapeamento do PDF
- [x] Documentar campos mecânicos de armas, armaduras, escudos e demais itens
- [x] Modelar catálogo e endpoint de referência
- [x] Integrar seleção e equipamento ao inventário
- [x] Automatizar proficiências, bônus de ataque, dano e CA
- [ ] Validar persistência, regras e responsividade
- [ ] Preparar checkpoint e commit

## Documentação histórica

- [x] Inventariar todos os commits e branches relevantes
- [x] Comparar arquivos e funcionalidades por commit
- [x] Redigir o panorama histórico e o estado atual
- [x] Revisar e entregar a documentação consolidada

## Implementação das melhorias prioritárias

- [x] Auditar e definir o contrato do motor central de regras
- [x] Modelar proficiências explícitas de armas, armaduras, escudos e ferramentas
- [x] Centralizar CA, ataques, dano, deslocamento, condições e efeitos
- [x] Evoluir inventário, mãos, munição, recarga, duas armas e itens mágicos
- [x] Conectar multiclassing à ficha e aos cálculos
- [x] Aprimorar wizard, point buy e equipamento inicial
- [x] Completar grimório, preparação e filtros mecânicos
- [x] Implementar campanhas ativas, papéis e permissões reais
- [x] Criar testes automatizados de regras
- [x] Limpar legado e consolidar camadas arquiteturais
- [x] Validar fluxos completos e preparar entrega

## Proteção das rotas legadas de personagens

- [x] Auditar sessão, ownership e rotas atuais
- [x] Criar `auth.js` com `requireUser` e `attachUser`
- [x] Proteger listagem, Hall, ficha e sub-rotas de personagem
- [x] Implementar `POST /api/characters/:id/claim`
- [x] Tratar 401/403 no `public/app.js`
- [x] Criar testes de integração para anônimo, ownership e claim legado
- [x] Confirmar que `/api/v2/*` não sofreu alterações
- [x] Rodar todos os testes existentes

## Login em todas as telas

- [x] Auditar páginas HTML, navegação e cabeçalhos existentes
- [x] Criar script compartilhado de estado de autenticação
- [x] Integrar CTA de login, usuário e logout nas telas
- [x] Validar redirecionamento contextual e responsividade

## Auditoria de contraste e legibilidade

- [x] Auditar cores de texto, fundos, badges e itens
- [x] Corrigir combinações de contraste insuficiente
- [x] Validar estados hover, foco, selecionado e desabilitado
- [x] Verificar responsividade e ausência de regressões

## Limpeza confirmada do banco

- [x] Inventariar personagens, mapas, marcadores e tabelas dependentes
- [x] Criar backup local do banco antes da operação
- [x] Remover registros em transação preservando usuários, campanhas e catálogos
- [x] Validar contagens e integridade após a limpeza
