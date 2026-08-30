/**
 * Initial knowledge-base content (Phase 7A).
 *
 * Data only — the seed runner is `scripts/seed-help-articles.mjs`. Every
 * article maps to a REAL feature and uses the REAL UI labels. No marketing,
 * no future features, no tenant names.
 *
 * `slug` is the idempotency key: re-seeding updates in place, never duplicates.
 * All seeded articles are published.
 */

export const HELP_ARTICLES = [
  // ---- Primeiros passos --------------------------------------------------
  {
    slug: "primeiros-passos-visao-geral",
    category: "Primeiros passos",
    title: "Visão geral do Creator Hub",
    summary: "O que você encontra em cada área do painel.",
    keywords: ["início", "painel", "navegação", "visão geral"],
    content:
      "O menu lateral tem as áreas principais:\n\n" +
      "- Visão Geral: resumo da operação e o checklist de primeiros passos.\n" +
      "- Creators: todas as pessoas que se inscreveram nos seus programas.\n" +
      "- Programas: cada programa tem um formulário público de inscrição.\n" +
      "- Envios: controle de envio de produtos para creators aprovadas.\n" +
      "- IA: análise de creators com o Creator Score.\n" +
      "- Novidades: o que mudou no produto.\n" +
      "- Configurações: aparência, equipe e plano.\n\n" +
      "Comece criando um programa e publicando o formulário.",
  },
  {
    slug: "primeiros-passos-checklist",
    category: "Primeiros passos",
    title: "O checklist de primeiros passos",
    summary: "Como o checklist da Visão Geral é calculado.",
    keywords: ["checklist", "onboarding", "começar"],
    content:
      "Na Visão Geral há um checklist de 5 itens, marcado automaticamente conforme o estado real da conta:\n\n" +
      "1. Definir a aparência (uma cor ou o logo em Configurações → Aparência).\n" +
      "2. Criar um programa.\n" +
      "3. Publicar o programa (status Ativo).\n" +
      "4. Convidar alguém da equipe.\n" +
      "5. Receber a primeira inscrição.\n\n" +
      "O checklist some sozinho quando os 5 itens estão concluídos. Você também pode ocultá-lo.",
  },

  // ---- Programas -------------------------------------------------------
  {
    slug: "como-criar-um-programa",
    category: "Programas",
    title: "Como criar um programa",
    summary: "Criar um programa e seu formulário público.",
    keywords: ["programa", "criar", "novo programa"],
    content:
      "1. No menu, abra Programas.\n" +
      "2. Clique em Novo programa.\n" +
      "3. Dê um nome ao programa e salve.\n\n" +
      "Cada programa nasce como rascunho e já tem um formulário. O próximo passo é montar o formulário e publicar o programa.",
  },
  {
    slug: "como-publicar-um-programa",
    category: "Programas",
    title: "Como publicar um programa",
    summary: "Deixar o formulário público no ar.",
    keywords: ["publicar", "ativo", "status do programa", "link público"],
    content:
      "Um programa só recebe inscrições quando está com status Ativo.\n\n" +
      "1. Abra o programa em Programas.\n" +
      "2. Na aba Geral, mude o status para Ativo e salve.\n" +
      "3. O formulário público fica disponível na URL do programa.\n\n" +
      "Enquanto o programa não estiver Ativo, quem abrir o link vê que as inscrições não estão abertas.",
  },
  {
    slug: "status-do-programa",
    category: "Programas",
    title: "O que significam os status do programa",
    summary: "Rascunho, Ativo, Pausado e Arquivado.",
    keywords: ["status", "rascunho", "ativo", "pausado", "arquivado"],
    content:
      "- Rascunho: em construção, formulário não recebe inscrições.\n" +
      "- Ativo: formulário público no ar.\n" +
      "- Pausado: formulário fora do ar temporariamente, sem perder nada.\n" +
      "- Arquivado: encerrado; os dados continuam no CRM.",
  },

  // ---- Formulários ---------------------------------------------------
  {
    slug: "como-montar-o-formulario",
    category: "Formulários",
    title: "Como montar o formulário de inscrição",
    summary: "Adicionar e ordenar os campos do formulário.",
    keywords: ["formulário", "campos", "perguntas", "inscrição"],
    content:
      "1. Abra o programa e vá na aba Formulário.\n" +
      "2. Adicione os campos que a creator deve preencher (nome, e-mail, redes, perguntas abertas).\n" +
      "3. Marque como obrigatórios os campos essenciais.\n" +
      "4. Salve. As mudanças valem para novas inscrições.\n\n" +
      "Campos de rede social (Instagram, TikTok) são reconhecidos automaticamente e ligados ao perfil da creator.",
  },
  {
    slug: "campos-de-rede-social-no-formulario",
    category: "Formulários",
    title: "Campos de Instagram e TikTok no formulário",
    summary: "Como os handles são tratados.",
    keywords: ["instagram", "tiktok", "handle", "arroba", "seguidores"],
    content:
      "Ao adicionar um campo de Instagram ou TikTok, o Creator Hub normaliza o handle (remove o @, deixa minúsculo) e monta a URL do perfil.\n\n" +
      "Se você também pedir a contagem de seguidores, ela entra como número declarado — usada como contexto na análise, nunca convertida em nota sozinha.",
  },
  {
    slug: "consentimento-no-formulario",
    category: "Formulários",
    title: "O campo de consentimento",
    summary: "Aceite de termos na inscrição.",
    keywords: ["consentimento", "lgpd", "termos", "privacidade"],
    content:
      "O formulário público inclui um aceite de consentimento antes do envio. Os links de Termos e Política de Privacidade aparecem no rodapé quando as URLs estão configuradas no ambiente.\n\n" +
      "A inscrição só é registrada com o consentimento marcado.",
  },

  // ---- Creators / CRM ---------------------------------------------
  {
    slug: "onde-vejo-as-inscricoes",
    category: "Creators",
    title: "Onde vejo as inscrições recebidas",
    summary: "A lista de creators e a busca.",
    keywords: ["inscrições", "lista", "buscar creators", "CRM"],
    content:
      "Abra Creators no menu. Cada linha é uma creator que se inscreveu. Use Buscar creators para filtrar por nome, e-mail ou handle.\n\n" +
      "Clique em uma creator para ver a ficha completa: respostas do formulário, redes, histórico, análise e endereço.",
  },
  {
    slug: "status-da-inscricao",
    category: "Creators",
    title: "O que significam os status da inscrição",
    summary: "Do recebimento ao cadastro completo.",
    keywords: ["status", "nova", "aprovada", "aguardando endereço", "arquivada"],
    content:
      "- Nova: acabou de chegar.\n" +
      "- Aguardando avaliação: em análise pela equipe.\n" +
      "- Informações solicitadas: você pediu mais dados.\n" +
      "- Aprovada: aprovada, pronta para pedir o endereço.\n" +
      "- Aguardando endereço: link seguro de endereço enviado.\n" +
      "- Cadastro completo: endereço recebido.\n" +
      "- Arquivada: fora do processo (os dados permanecem).",
  },
  {
    slug: "mudar-status-da-inscricao",
    category: "Creators",
    title: "Como mudar o status de uma inscrição",
    summary: "Usar Mudar status na ficha da creator.",
    keywords: ["mudar status", "mover", "kanban"],
    content:
      "Na ficha da creator, use Mudar status e escolha o novo status. Só aparecem as transições permitidas a partir do status atual.\n\n" +
      "Aprovar leva direto para Aprovada. As transições ligadas ao endereço acontecem sozinhas no fluxo seguro de endereço.",
  },
  {
    slug: "respostas-do-formulario",
    category: "Creators",
    title: "Como ver as respostas do formulário de uma creator",
    summary: "A aba Respostas do formulário na ficha.",
    keywords: ["respostas", "formulário", "ficha da creator"],
    content:
      "Abra a creator e veja o bloco Respostas do formulário. Ele mostra cada pergunta com o rótulo que estava no formulário no momento da inscrição, então respostas antigas continuam legíveis mesmo se o formulário mudou depois.",
  },
  {
    slug: "inscricao-possivel-duplicada",
    category: "Creators",
    title: "Inscrição marcada como possível duplicada",
    summary: "Por que uma inscrição aparece sinalizada.",
    keywords: ["duplicada", "duplicidade", "telefone", "mesma pessoa"],
    content:
      "Quando uma nova inscrição tem o mesmo telefone de uma creator já cadastrada, ela é sinalizada como possível duplicada — nunca mesclada automaticamente.\n\n" +
      "Revise as duas e decida. O handle de rede social é o identificador forte; o telefone é só um sinal.",
  },

  // ---- Aprovação -------------------------------------------------
  {
    slug: "como-aprovar-uma-creator",
    category: "Aprovação",
    title: "Como aprovar uma creator",
    summary: "Aprovar e seguir para a coleta de endereço.",
    keywords: ["aprovar", "aprovação", "aprovada"],
    content:
      "1. Abra a creator.\n" +
      "2. Clique em Aprovar (ou use Mudar status → Aprovada).\n" +
      "3. A inscrição fica Aprovada.\n\n" +
      "Depois de aprovar, use Solicitar informações / o fluxo de endereço para pedir o endereço de entrega com segurança.",
  },
  {
    slug: "solicitar-informacoes",
    category: "Aprovação",
    title: "Solicitar informações à creator",
    summary: "Pedir dados adicionais antes de aprovar.",
    keywords: ["solicitar informações", "informações solicitadas", "pendência"],
    content:
      "Use Solicitar informações quando faltar algo para decidir. A inscrição vai para Informações solicitadas. Quando os dados chegarem, volte para Aguardando avaliação e siga com a aprovação.",
  },

  // ---- Endereço -----------------------------------------------
  {
    slug: "como-solicitar-o-endereco",
    category: "Endereço",
    title: "Como solicitar o endereço de uma creator",
    summary: "Gerar o link seguro de endereço.",
    keywords: ["endereço", "solicitar endereço", "link seguro", "envio de produto"],
    content:
      "A creator precisa estar Aprovada.\n\n" +
      "1. Na ficha da creator, abra a área de endereço e gere a solicitação.\n" +
      "2. O Creator Hub cria um link seguro e único.\n" +
      "3. Copie o link e envie para a creator.\n" +
      "4. Ela preenche o endereço na página, com consentimento.\n" +
      "5. A inscrição passa para Aguardando endereço e depois Cadastro completo quando ela concluir.\n\n" +
      "O endereço é preenchido pela creator — a equipe não digita por ela.",
  },
  {
    slug: "como-regenerar-o-link-de-endereco",
    category: "Endereço",
    title: "Como regenerar o link de endereço",
    summary: "Quando o link expirou ou se perdeu.",
    keywords: ["regenerar", "link expirado", "novo link", "endereço"],
    content:
      "Na área de endereço da ficha, use Regenerar link. O link anterior é invalidado na hora e um novo é gerado. Copie e reenvie.\n\n" +
      "Use isso se a creator não recebeu, o link venceu, ou você suspeita que ele vazou.",
  },
  {
    slug: "revogar-solicitacao-de-endereco",
    category: "Endereço",
    title: "Como cancelar uma solicitação de endereço",
    summary: "Revogar um link pendente.",
    keywords: ["revogar", "cancelar", "solicitação de endereço"],
    content:
      "Use Revogar na área de endereço para invalidar a solicitação pendente. A inscrição volta para Aprovada, mantendo a data de aprovação. Você pode gerar uma nova solicitação depois.",
  },
  {
    slug: "endereco-enviado-pela-creator",
    category: "Endereço",
    title: "Onde vejo o endereço que a creator enviou",
    summary: "Endereço na ficha, após a conclusão.",
    keywords: ["endereço enviado", "cadastro completo", "ver endereço"],
    content:
      "Quando a creator conclui, o endereço aparece na ficha marcado como Endereço enviado pela creator, e a inscrição fica Cadastro completo. A partir daí você pode criar um envio.",
  },

  // ---- Envios -------------------------------------------------
  {
    slug: "como-criar-um-envio",
    category: "Envios",
    title: "Como criar um envio",
    summary: "Abrir um envio para uma creator com endereço.",
    keywords: ["envio", "criar envio", "novo envio", "product seeding"],
    content:
      "A creator precisa ter Cadastro completo (endereço recebido).\n\n" +
      "1. Abra Envios e clique em Novo envio, ou use Criar envio na ficha da creator.\n" +
      "2. Adicione os itens do envio (nome e quantidade; SKU é opcional).\n" +
      "3. Salve. O envio nasce como rascunho.\n\n" +
      "O endereço é copiado para o envio no momento da criação, então mudanças futuras no endereço não alteram envios já criados.",
  },
  {
    slug: "status-do-envio",
    category: "Envios",
    title: "Os status de um envio",
    summary: "Rascunho, Preparando, Enviado, Entregue, Cancelado.",
    keywords: ["status do envio", "rascunho", "preparando", "enviado", "entregue"],
    content:
      "- Rascunho: em montagem.\n" +
      "- Preparando: itens confirmados, separando o pacote.\n" +
      "- Enviado: despachado (informe o rastreio).\n" +
      "- Entregue: chegou.\n" +
      "- Cancelado: encerrado sem envio.\n\n" +
      "Use Mudar status para avançar. Também é possível corrigir para trás (ex.: de Enviado para Preparando).",
  },
  {
    slug: "como-adicionar-rastreio",
    category: "Envios",
    title: "Como adicionar o código de rastreio",
    summary: "Preencher transportadora, código e link.",
    keywords: ["rastreio", "rastreamento", "código", "transportadora", "tracking"],
    content:
      "Abra o envio e edite os dados de rastreio: transportadora, código e, opcionalmente, o link de rastreamento (precisa ser http/https).\n\n" +
      "Salve. Marcar o envio como Enviado é um bom momento para registrar o rastreio.",
  },
  {
    slug: "editar-itens-do-envio",
    category: "Envios",
    title: "Como editar os itens de um envio",
    summary: "Ajustar itens enquanto o envio permite.",
    keywords: ["itens do envio", "editar itens", "quantidade", "sku"],
    content:
      "Enquanto o envio está em Rascunho ou Preparando, abra-o e ajuste os itens (nome, quantidade, SKU). Depois de Enviado, os itens ficam travados como registro do que foi despachado.",
  },
  {
    slug: "cancelar-um-envio",
    category: "Envios",
    title: "Como cancelar um envio",
    summary: "Encerrar um envio que não vai acontecer.",
    keywords: ["cancelar envio", "cancelado"],
    content:
      "Abra o envio e use Mudar status → Cancelado. O envio some da operação ativa mas continua no histórico da creator. Não é possível cancelar um envio já Entregue.",
  },

  // ---- Creator Score --------------------------------------
  {
    slug: "o-que-e-o-creator-score",
    category: "Creator Score",
    title: "O que é o Creator Score",
    summary: "Como a nota de 0 a 100 é formada.",
    keywords: ["creator score", "nota", "score", "avaliação", "tier"],
    content:
      "O Creator Score é uma nota de 0 a 100 que combina 8 critérios: 3 avaliados por IA a partir das evidências (qualidade de conteúdo, comunicação, afinidade com a marca) e 5 calculados de forma determinística a partir das métricas.\n\n" +
      "A IA nunca decide aprovação nem devolve a nota final — ela só avalia evidência. O motor de score junta tudo e classifica em um tier (A a D) com um nível de confiança.",
  },
  {
    slug: "como-avaliar-uma-creator",
    category: "Creator Score",
    title: "Como avaliar uma creator com IA",
    summary: "Rodar a análise na ficha da creator.",
    keywords: ["analisar creator", "análise ia", "avaliar", "rodar análise"],
    content:
      "1. Abra a creator.\n" +
      "2. Clique em Analisar creator.\n" +
      "3. Aguarde — o status fica Analisando… e depois Concluída.\n\n" +
      "Cada análise fica no histórico. Se faltar chave de IA no ambiente, a análise fica indisponível e o restante do CRM segue funcionando.\n\n" +
      "Uma creator já em análise não pode ser analisada de novo ao mesmo tempo.",
  },
  {
    slug: "o-que-significa-coverage",
    category: "Creator Score",
    title: "O que significa Coverage (cobertura)",
    summary: "Quanta evidência sustentou a análise.",
    keywords: ["coverage", "cobertura", "evidência", "confiança"],
    content:
      "Coverage é o quanto de evidência real existia para avaliar cada critério, de 0% a 100%.\n\n" +
      "- Cobertura baixa: havia pouca informação (ex.: só um link, sem conteúdo). O critério pode ficar sem nota.\n" +
      "- Cobertura alta: havia evidência suficiente.\n\n" +
      "Ausência de dado significa desconhecido, não ruim. Cobertura baixa em vários critérios reduz a confiança geral da análise.",
  },
  {
    slug: "tiers-do-creator-score",
    category: "Creator Score",
    title: "O que são os tiers A, B, C e D",
    summary: "A faixa de prioridade da creator.",
    keywords: ["tier", "faixa", "prioridade", "A B C D"],
    content:
      "O tier resume a nota em uma faixa de prioridade:\n\n" +
      "- A — Prioridade alta\n" +
      "- B — Boa\n" +
      "- C — Média\n" +
      "- D — Baixa prioridade\n\n" +
      "O tier é orientação, não uma decisão automática. A aprovação continua sendo humana.",
  },
  {
    slug: "confianca-da-analise",
    category: "Creator Score",
    title: "O que é o nível de confiança da análise",
    summary: "Baixa, Média ou Alta.",
    keywords: ["confiança", "confidence", "qualidade da análise"],
    content:
      "A confiança (Baixa / Média / Alta) indica quão sólida é a base da análise. Ela cai quando a cobertura de evidência é baixa em vários critérios. Uma nota com confiança Baixa deve ser lida com cautela e complementada por avaliação manual.",
  },

  // ---- Métricas / Evidências --------------------------
  {
    slug: "o-que-sao-evidencias",
    category: "Métricas / Evidências",
    title: "O que conta como evidência",
    summary: "O material que alimenta a análise.",
    keywords: ["evidência", "conteúdo", "links", "métricas"],
    content:
      "Evidência é o que a análise usa: respostas do formulário, links de conteúdo, temas abordados e métricas observadas.\n\n" +
      "Um link sozinho não é conteúdo — se só há URLs, o critério de conteúdo fica sem nota. Métricas (seguidores, views, engajamento) entram como contexto factual, nunca viram nota por si só.",
  },
  {
    slug: "seguidores-pt-br",
    category: "Métricas / Evidências",
    title: "Contagem de seguidores com ponto ou vírgula",
    summary: "Como '137.000' é interpretado.",
    keywords: ["seguidores", "137000", "milhar", "número", "k", "mil"],
    content:
      "Números como 137.000, 137000 ou 137k são lidos como 137 mil. O ponto e a vírgula são tratados como separadores de milhar no padrão brasileiro, e sufixos como k, mil, mi e M são entendidos.",
  },
  {
    slug: "metricas-observadas-vs-declaradas",
    category: "Métricas / Evidências",
    title: "Métricas declaradas x observadas",
    summary: "A diferença entre o que a creator informou e o que foi registrado.",
    keywords: ["declarado", "observado", "snapshot", "métricas"],
    content:
      "Métricas declaradas vêm do formulário (a creator digitou). Métricas observadas são registros que a equipe adiciona à ficha como um retrato num momento (snapshot). A análise usa ambas como contexto, sem transformar número em nota.",
  },

  // ---- Equipe -------------------------------------
  {
    slug: "como-convidar-alguem-da-equipe",
    category: "Equipe",
    title: "Como convidar alguém da equipe",
    summary: "Gerar e enviar o link de convite.",
    keywords: ["convidar", "equipe", "convite", "membro", "link de convite"],
    content:
      "1. Vá em Configurações → Equipe.\n" +
      "2. Informe o e-mail e o papel (Owner, Admin ou Analyst) e gere o convite.\n" +
      "3. Copie o link e envie para a pessoa.\n" +
      "4. Ela abre o link e, se não tiver conta, cria a conta ali mesmo com esse e-mail; se já tiver, faz login e aceita.\n\n" +
      "O convite vale por 14 dias. Você pode revogar um convite pendente a qualquer momento.",
  },
  {
    slug: "papeis-da-equipe",
    category: "Equipe",
    title: "Papéis: Owner, Admin e Analyst",
    summary: "O que cada papel pode fazer.",
    keywords: ["papel", "owner", "admin", "analyst", "permissão"],
    content:
      "- Owner: controle total, incluindo equipe e plano. A organização precisa de ao menos um Owner.\n" +
      "- Admin: opera tudo e gerencia a equipe.\n" +
      "- Analyst: opera o CRM, sem gerenciar equipe nem aparência.\n\n" +
      "Você pode trocar o papel de um membro em Configurações → Equipe.",
  },
  {
    slug: "remover-membro-ou-convite",
    category: "Equipe",
    title: "Como remover um membro ou revogar um convite",
    summary: "Tirar acesso da equipe.",
    keywords: ["remover", "revogar", "tirar acesso", "último owner"],
    content:
      "Em Configurações → Equipe, use Remover no membro ou Revogar no convite pendente.\n\n" +
      "Não é possível remover o último Owner — promova outra pessoa a Owner antes.",
  },

  // ---- Configurações ---------------------------
  {
    slug: "aparencia-cores-e-logo",
    category: "Configurações",
    title: "Aparência: cores da organização",
    summary: "Definir a cor primária e secundária.",
    keywords: ["aparência", "cores", "tema", "branding", "cor primária"],
    content:
      "Em Configurações → Aparência, defina a cor primária e a secundária (em hexadecimal, ex.: #1E90FF). Elas são aplicadas ao painel e às páginas públicas do seu programa.\n\n" +
      "O logo e o favicon são configurados pela equipe Creator Hub — peça pelo suporte se precisar ajustar.",
  },
  {
    slug: "plano-da-organizacao",
    category: "Configurações",
    title: "Onde vejo o plano da organização",
    summary: "A aba Plano em Configurações.",
    keywords: ["plano", "assinatura", "condição comercial"],
    content:
      "Configurações → Plano mostra o plano atual e desde quando ele vale. Mudanças de plano são feitas pela equipe Creator Hub.",
  },
  {
    slug: "organizacao-suspensa",
    category: "Configurações",
    title: "O que acontece se a organização for suspensa",
    summary: "Painel congelado, dados preservados.",
    keywords: ["suspensa", "suspensão", "bloqueado", "acesso"],
    content:
      "Uma organização suspensa não consegue operar o painel (criar/alterar dados), mas nada é apagado e os formulários públicos continuam recebendo inscrições. Assim que a suspensão é retirada, tudo volta ao normal. Fale com o suporte para regularizar.",
  },

  // ---- Suporte -------------------------------
  {
    slug: "como-enviar-uma-sugestao",
    category: "Suporte",
    title: "Como enviar uma sugestão de melhoria",
    summary: "Registrar e votar em sugestões.",
    keywords: ["sugestão", "feedback", "ideia", "votar", "roadmap"],
    content:
      "Abra Ajuda no topo → Enviar sugestão, ou vá em Sugestões pelo menu de ajuda.\n\n" +
      "Descreva o problema que você tem hoje, com que frequência ele aparece e o quanto é importante. Você também pode votar nas sugestões de outras organizações.\n\n" +
      "Cada organização tem um voto por sugestão — vários membros da mesma empresa não somam votos.",
  },
  {
    slug: "como-falar-com-o-suporte",
    category: "Suporte",
    title: "Como falar com o suporte",
    summary: "Do assistente ao atendimento humano.",
    keywords: ["suporte", "ajuda", "assistente", "ticket", "atendimento"],
    content:
      "Clique em Ajuda no topo do painel e pergunte ao assistente. Ele responde com base na documentação.\n\n" +
      "Se a resposta não resolver, use Falar com suporte para abrir uma solicitação. Você acompanha o andamento em Minhas solicitações.",
  },
  {
    slug: "onde-vejo-o-que-mudou",
    category: "Suporte",
    title: "Onde vejo o que mudou no produto",
    summary: "Novidades e Roadmap.",
    keywords: ["novidades", "changelog", "roadmap", "mudanças"],
    content:
      "Novidades (no menu) lista o que já foi lançado. O Roadmap (pelo menu de ajuda) mostra o que está em avaliação, planejado, em desenvolvimento ou lançado — sem datas, porque prioridades mudam.",
  },
];
