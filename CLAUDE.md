# BLOP Match — regras do projeto

- A especificação completa está em `SPEC.md`. Lê-a antes de cada fase e segue-a; se algo estiver ambíguo, pergunta antes de inventar.
- Trabalha uma fase de cada vez (secção 10 do SPEC). No fim de cada fase: corre `npm run build` e os testes, verifica os critérios de aceitação e faz commit com a mensagem `fase N: <resumo>`.
- Fala comigo em português. Código, nomes de variáveis e textos da interface em inglês; textos em português só no `pt.ts`, nos e-mails PT e no `/admin`.
- Manter simples: sem bibliotecas desnecessárias, sem over-engineering. O prazo é domingo.
- Toda a interface é mobile-first. Toda a string visível ao participante passa pelo i18n (EN e PT).
- Nunca expor ao participante o `type` nem o `score` dos matches, nem o e-mail da outra pessoa.
- A service role key só existe no servidor. Nunca a uses em componentes de cliente.
- Lógica de matching e de estatística em funções puras com testes Vitest (`lib/matching.ts`, `lib/stats.ts`).
- Quando precisares que eu faça algo fora do código (criar conta, configurar o Google OAuth, colar uma chave no `.env.local`), pára e dá-me passos curtos e numerados.
