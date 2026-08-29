# FASE 3B — roteiro de teste manual

Pré-requisito: migration `20260828000004_evidence_enrichment.sql` aplicada ao
banco. Use um creator de teste (nunca Marcus, Rafael ou qualquer creator Rare
Way real — §83).

1. Faça login na equipe e abra **Creators**.
2. Abra um creator que tenha ao menos um perfil de Instagram cadastrado.
3. Confirme que o modal abriu (não é drawer) e a **ScoreBar** está fixa no topo.
4. Clique na aba **Métricas** (ordem: Resumo · Inteligência · Cadastro · Redes ·
   **Métricas** · Respostas · Histórico).
5. No card do Instagram, confira handle e "cadastro: N seguidores".
6. Clique em **Adicionar métricas** — deve abrir um `Dialog` dentro do modal,
   sem trocar de página.
7. Preencha **Seguidores (observados)** com um valor diferente do cadastro
   (ex.: cadastro 40.000 → informe 31.000).
8. Cole no campo de views, um número por linha: `7.100`, `9.480`, `5.230`,
   `12.900`, `6.740`.
9. Confira a preview ao vivo: "Amostra: 5 conteúdos · Mediana: 7.100 · Média:
   8.290" (a mediana/média são recalculadas no servidor ao salvar).
10. Digite `Posts no período` = `12` e `Período (dias)` = `30`.
11. (Opcional) abra **Campos avançados** e informe alcance / likes / comentários.
12. Deixe **Origem** = "Registro manual" e a data padrão (hoje). Clique
    **Salvar métricas**.
13. Toast "Métricas registradas." e o card agora mostra o snapshot mais recente.
14. Confira os derivados: seguidores observados, mediana de views (7.100),
    **view rate** (= mediana ÷ seguidores observados), posts/semana (2,8).
15. Confira "Observado hoje" + "Registro manual" e a nota **Valor observado
    difere do valor informado no cadastro.** (por causa do passo 7).
16. Confira a **tabela de histórico** abaixo (Data, Seguidores, Mediana views,
    View rate, Posts/sem, Origem) — mais recente primeiro, sem gráficos.
17. Adicione um segundo snapshot com data anterior e menos seguidores para ver
    o cálculo de **crescimento** (absoluto e %) aparecer no card.
18. Clique em **Editar** no card, mude a amostra de views e salve — a
    mediana/média recalculam; um evento `metric_snapshot_updated` entra na
    timeline (aba Histórico: "Métricas do Instagram atualizadas").
19. Vá para a aba **Inteligência**. Se o creator já tem análise, confira as
    seções **Evidências** (✓/— por tipo de dado, com "Métricas observadas
    (snapshot)" agora ✓) e **Dados que ainda faltam** (performance /
    consistência / comunidade / crescimento explicados como "dados
    insuficientes", sem nota inventada).
20. Volte ao topo: a **ScoreBar** deve mostrar o selo **"Novas evidências"**
    (snapshot mais novo que a análise atual) e o botão **Reanalisar**.
21. Clique **Reanalisar**. Ao concluir: nova entrada em Inteligência →
    Histórico; a análise nova usa as métricas (payload
    `objective_metrics.social`), o score **não** muda de forma dirigida pelas
    métricas (performance etc. seguem `null`), a análise antiga continua
    intacta com `prompt_version = creator-analysis-v1`, e o selo "Novas
    evidências" some.

Verificação rápida em `/app/ai`: a seção **Evidence Layer** mostra Snapshots,
Creators com snapshot e Perfis com 2+ snapshots atualizados.
