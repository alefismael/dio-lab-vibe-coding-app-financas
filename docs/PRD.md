# PRD — Clareia: suas finanças em uma conversa

Crie e implemente um aplicativo web responsivo de organização de finanças pessoais chamado **Clareia**. Quero um MVP funcional, em português do Brasil, que uma pessoa possa abrir, testar e entender sem instruções externas. Construa as telas, os fluxos, a persistência dos dados e o agente de IA. Não entregue apenas uma apresentação visual ou um plano.

## Contexto e problema

Muitas pessoas desistem de controlar o dinheiro porque precisam preencher formulários, escolher categorias e interpretar gráficos complexos. O Clareia deve tornar esse processo mais simples: a pessoa conta o que aconteceu em linguagem natural, acompanha seus gastos e recebe orientações claras para atingir uma meta.

## Público-alvo

Pessoas iniciantes em organização financeira, especialmente quem quer acompanhar receitas e despesas do mês sem usar planilhas.

## Proposta de valor

“Entenda para onde seu dinheiro vai e descubra o próximo passo, uma conversa de cada vez.”

## Funcionalidades do MVP

1. **Registro por conversa:** o usuário escreve frases como “Gastei R$ 42,50 no almoço ontem” ou “Recebi R$ 3.200 de salário hoje”. O agente identifica tipo, valor, descrição, categoria e data. Antes de salvar, mostra os dados interpretados para o usuário confirmar ou corrigir.
2. **Transações:** permitir criar, consultar, editar e excluir receitas e despesas. Oferecer filtros por mês, tipo e categoria. Atualizar os totais e gráficos após cada alteração.
3. **Classificação inteligente:** sugerir uma categoria para cada transação. Se houver dúvida, pedir confirmação. O usuário sempre pode trocar a categoria.
4. **Orçamentos mensais:** permitir definir um limite por categoria e mostrar quanto já foi usado, quanto resta e quando o limite foi ultrapassado.
5. **Metas financeiras:** permitir criar uma meta com nome, valor desejado e prazo; registrar contribuições e acompanhar o progresso.
6. **Agente financeiro:** responder perguntas como “Onde gastei mais este mês?” e “Quanto preciso guardar por mês para minha meta?”. Usar somente os dados disponíveis daquele usuário, mostrar as contas de forma simples e oferecer sugestões práticas, sem prometer resultados.
7. **Painel:** mostrar saldo do período, receitas, despesas, gastos por categoria, evolução mensal, orçamentos e metas. Usar gráficos legíveis também no celular.

## Telas e fluxo

- **Página inicial:** explicar o produto e oferecer os botões “Experimentar demonstração” e “Criar conta”.
- **Demonstração:** abrir um conjunto de dados fictícios claramente identificado como exemplo. Permitir testar os principais fluxos sem exigir cadastro e sem misturar os dados de demonstração com contas reais.
- **Entrar e criar conta:** autenticação por e-mail.
- **Painel:** resumo financeiro e acesso direto ao chat.
- **Conversar:** histórico da conversa, sugestões de perguntas e confirmação de transações interpretadas.
- **Transações:** lista, busca, filtros e ações de edição.
- **Orçamentos e metas:** criação, acompanhamento e edição.
- **Configurações:** informações da conta e explicação simples sobre privacidade e uso da IA.

## Dados e segurança

Use o backend do Lovable Cloud para autenticação e persistência dos dados das contas. Cada usuário deve acessar somente suas próprias transações, metas e orçamentos. Configure as políticas de acesso necessárias. Use o conector de IA do Lovable por meio do backend, sem expor credenciais no navegador. Não peça conexão bancária nem dados financeiros reais para experimentar a demonstração.

## Comportamento do agente

Fale de forma acolhedora, direta e sem julgamento. Não invente transações nem números. Quando faltar informação, diga o que falta. Antes de criar ou alterar dados, apresente um resumo e peça confirmação. Distinga fatos calculados dos dados do usuário de sugestões gerais. Inclua um aviso breve de que as orientações são educativas e não substituem aconselhamento financeiro profissional.

## Direção visual

Crie uma identidade própria, moderna e confiável: fundo claro, verde profundo como cor principal, detalhes em menta e coral para destaques, boa hierarquia tipográfica e bastante espaço entre elementos. Evite aparência de painel bancário genérico. Priorize acessibilidade: contraste adequado, rótulos nos campos, navegação por teclado, mensagens de erro claras e gráficos acompanhados de valores em texto.

## Critérios de aceite

- A demonstração abre com dados fictícios coerentes e permite navegar pelo painel, transações, orçamentos, metas e chat.
- O cadastro, o login e o logout funcionam.
- Uma transação registrada pelo chat só é salva após confirmação e aparece imediatamente no painel.
- Editar ou excluir uma transação atualiza os totais.
- Os orçamentos e as metas persistem para o usuário autenticado.
- O agente responde a perguntas sobre os dados do usuário sem acessar dados de outras contas.
- As principais telas funcionam em celular e computador.
- Não há botões decorativos, links quebrados ou dados fixos apresentados como se fossem do usuário.

Implemente o aplicativo agora. Ao terminar, teste os fluxos principais no navegador, corrija os erros encontrados e me entregue um resumo curto do que foi implementado, do que foi testado e de qualquer limitação real.
