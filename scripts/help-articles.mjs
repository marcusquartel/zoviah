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
    title: "Visão geral da Zoviah",
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
      "Ao adicionar um campo de Instagram ou TikTok, a Zoviah normaliza o handle (remove o @, deixa minúsculo) e monta a URL do perfil.\n\n" +
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
    keywords: [
      "mudar status", "alterar status", "trocar status", "mover", "kanban",
      "aprovar", "reprovar", "avançar", "etapa",
    ],
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
      "2. A Zoviah cria um link seguro e único.\n" +
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
      "O logo e o favicon são configurados pela equipe Zoviah — peça pelo suporte se precisar ajustar.",
  },
  {
    slug: "plano-da-organizacao",
    category: "Configurações",
    title: "Onde vejo o plano da organização",
    summary: "A aba Plano em Configurações.",
    keywords: ["plano", "assinatura", "condição comercial"],
    content:
      "Configurações → Plano mostra o plano atual e desde quando ele vale. Mudanças de plano são feitas pela equipe Zoviah.",
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

  // ========================================================================
  // Base ampliada — cenários, erros comuns e passo a passo com nomes reais.
  // ========================================================================

  // ---- Primeiros passos ------------------------------------------------
  {
    slug: "o-que-e-a-zoviah",
    category: "Primeiros passos",
    title: "O que é a Zoviah",
    summary: "A plataforma em uma frase e os conceitos básicos.",
    keywords: ["zoviah", "o que é", "conceito", "plataforma", "crm de creators"],
    content:
      "A Zoviah é onde sua empresa recebe, avalia e organiza creators (influenciadores) e o envio de produtos para eles.\n\n" +
      "Conceitos:\n" +
      "- Programa: uma campanha ou seleção, com um formulário público de inscrição.\n" +
      "- Inscrição: uma resposta ao formulário; vira uma creator na sua lista.\n" +
      "- Creator: a pessoa. Tem status (nova, em avaliação, aprovada…), análise de IA e, quando aprovada, endereço e envios.\n\n" +
      "Fluxo típico: criar programa → publicar o formulário → receber inscrições → avaliar/aprovar → solicitar endereço → criar o envio.",
  },
  {
    slug: "glossario-de-termos",
    category: "Primeiros passos",
    title: "Glossário de termos",
    summary: "O vocabulário usado no painel.",
    keywords: ["glossário", "termos", "vocabulário", "significado"],
    content:
      "- Programa: campanha com formulário público.\n" +
      "- Inscrição / Application: uma resposta ao formulário.\n" +
      "- Creator: a pessoa inscrita.\n" +
      "- Creator Score: nota de 0 a 100 calculada pelo sistema.\n" +
      "- Tier: faixa do score (ex.: A, B, C).\n" +
      "- Evidência: um dado observado (ex.: seguidores medidos) que sustenta a análise.\n" +
      "- Snapshot de endereço: cópia do endereço no momento em que o envio foi criado.\n" +
      "- Slug: o trecho do endereço público do formulário (zoviah.app/p/slug/...).\n" +
      "- Subdomínio: o endereço da sua empresa (empresa.zoviah.app).",
  },
  {
    slug: "como-testar-meu-formulario",
    category: "Primeiros passos",
    title: "Como testar meu formulário antes de divulgar",
    summary: "Enviar uma inscrição de teste e limpá-la depois.",
    keywords: ["testar", "teste", "formulário", "preview", "antes de divulgar"],
    content:
      "1. Publique o programa (status Ativo) — o formulário só abre quando o programa está ativo.\n" +
      "2. Abra o link público do formulário e preencha como se fosse uma creator.\n" +
      "3. Confira se a inscrição apareceu em Creators e se os campos mapeados (nome, e-mail, cidade, estado) chegaram nas colunas certas.\n" +
      "4. Para remover o teste, mude o status da inscrição ou arquive-a. Se preferir manter o programa fechado enquanto testa, volte-o para Pausado depois.",
  },
  {
    slug: "primeiro-envio-do-zero",
    category: "Primeiros passos",
    title: "Do zero ao primeiro envio",
    summary: "A sequência completa, do formulário à etiqueta.",
    keywords: ["primeiro envio", "passo a passo", "começar", "fluxo completo"],
    content:
      "1. Crie um programa e monte o formulário (inclua nome, e-mail, WhatsApp, Estado e Cidade).\n" +
      "2. Publique o programa e divulgue o link.\n" +
      "3. Ao receber inscrições, avalie na aba Resumo da creator e clique em Aprovar.\n" +
      "4. Na aba Endereço, clique em Solicitar endereço e envie o link seguro para a creator.\n" +
      "5. Quando ela preencher (com CPF, exigido pelos Correios), crie o envio na aba Endereço/Envios.\n" +
      "6. Prepare, adicione o rastreio e marque como enviado.",
  },

  // ---- Programas ------------------------------------------------------
  {
    slug: "onde-encontro-o-link-do-formulario",
    category: "Programas",
    title: "Onde encontro o link público do formulário",
    summary: "Copiar e compartilhar o endereço de inscrição.",
    keywords: ["link", "url", "formulário", "compartilhar", "divulgar", "inscrição"],
    content:
      "Abra o programa e vá em Formulário. O endereço público tem o formato zoviah.app/p/SEU-SLUG/SLUG-DO-PROGRAMA.\n\n" +
      "O link só responde quando o programa está com status Ativo. Em rascunho ou arquivado ele mostra 'inscrições encerradas'.",
  },
  {
    slug: "editar-titulo-e-descricao-publicos",
    category: "Programas",
    title: "Editar o título e a descrição que a creator vê",
    summary: "Os textos públicos do formulário.",
    keywords: ["título público", "descrição", "texto", "formulário", "editar"],
    content:
      "No programa, aba Geral: 'Título público' e 'Descrição pública' aparecem no topo do formulário. 'Mensagem de sucesso' é o que a creator lê depois de enviar.\n\n" +
      "Mudar esses textos não altera a versão do formulário nem invalida inscrições anteriores.",
  },
  {
    slug: "versao-do-formulario",
    category: "Programas",
    title: "O que é a versão do formulário",
    summary: "Por que algumas edições incrementam a versão.",
    keywords: ["versão", "formulário", "campos", "histórico", "snapshot"],
    content:
      "Mudanças estruturais nos campos (adicionar, remover, renomear a chave, mudar o tipo, tornar obrigatório) incrementam a versão do formulário.\n\n" +
      "Cada inscrição guarda um retrato dos campos da versão em que foi enviada, então inscrições antigas continuam legíveis mesmo depois de você mudar o formulário.",
  },
  {
    slug: "despublicar-ou-arquivar-programa",
    category: "Programas",
    title: "Pausar, despublicar ou arquivar um programa",
    summary: "Fechar as inscrições sem perder os dados.",
    keywords: ["pausar", "despublicar", "arquivar", "encerrar", "fechar inscrições"],
    content:
      "- Pausado: o formulário fecha, mas o programa continua na lista para você reabrir.\n" +
      "- Arquivado: some da operação do dia a dia; as inscrições e creators continuam salvas.\n\n" +
      "Nenhum dos dois apaga inscrições. Para reabrir, volte o status para Ativo.",
  },
  {
    slug: "duplicar-um-programa",
    category: "Programas",
    title: "Posso duplicar um programa?",
    summary: "Não há botão de duplicar — o caminho é recriar.",
    keywords: ["duplicar", "copiar", "clonar", "programa"],
    content:
      "Ainda não existe 'duplicar programa'. Crie um novo programa e monte o formulário novamente com os mesmos campos.\n\n" +
      "Se isso for importante para o seu fluxo, registre em Ajuda → Enviar sugestão.",
  },
  {
    slug: "varios-programas-ao-mesmo-tempo",
    category: "Programas",
    title: "Rodar vários programas ao mesmo tempo",
    summary: "Cada programa tem seu formulário e suas inscrições.",
    keywords: ["vários programas", "múltiplos", "simultâneos", "campanhas"],
    content:
      "Você pode ter quantos programas quiser ativos ao mesmo tempo, cada um com seu link e seu formulário.\n\n" +
      "Na lista de Creators, filtre por programa para ver só as inscrições de uma campanha. A Visão Geral mostra os programas com mais creators.",
  },

  // ---- Formulários --------------------------------------------------
  {
    slug: "tipos-de-campo-do-formulario",
    category: "Formulários",
    title: "Tipos de campo disponíveis",
    summary: "A lista completa e para que serve cada um.",
    keywords: ["tipos de campo", "campos", "formulário", "texto", "seleção", "data"],
    content:
      "Texto curto, Texto longo, E-mail, Telefone / WhatsApp, Número, Link (URL), Data, Seleção única, Seleção múltipla, Confirmação (checkbox), Instagram (@handle), TikTok (@handle), Estado (BR) e Cidade (BR).\n\n" +
      "Estado (BR) e Cidade (BR) usam listas oficiais e não deixam a pessoa digitar livre. Instagram/TikTok normalizam o @ e podem alimentar os seguidores declarados.",
  },
  {
    slug: "campo-estado-e-cidade-br",
    category: "Formulários",
    title: "Campos Estado (BR) e Cidade (BR)",
    summary: "Listas fixas, com a cidade dependente do estado.",
    keywords: ["estado", "cidade", "uf", "ibge", "lista", "seleção", "endereço"],
    content:
      "Estado (BR) mostra as 27 UFs. Cidade (BR) mostra os municípios daquele estado, com busca — a pessoa escolhe da lista, não digita livre.\n\n" +
      "A Cidade só habilita depois que o Estado é escolhido. Os dois alimentam automaticamente creators.state e creators.city — não é preciso mapear nada.\n\n" +
      "Para um formulário novo, adicione primeiro o campo Estado (BR) e depois o Cidade (BR).",
  },
  {
    slug: "campo-obrigatorio-ou-opcional",
    category: "Formulários",
    title: "Tornar um campo obrigatório",
    summary: "A marca de obrigatório e o efeito na versão.",
    keywords: ["obrigatório", "opcional", "required", "campo", "asterisco"],
    content:
      "Ao editar o campo, marque 'Resposta obrigatória'. No formulário ele ganha um asterisco e a inscrição não é enviada sem ele.\n\n" +
      "Mudar obrigatoriedade é uma alteração estrutural: incrementa a versão do formulário.",
  },
  {
    slug: "mapear-campo-para-coluna",
    category: "Formulários",
    title: "Mapear um campo para uma coluna da creator",
    summary: "Como 'Mapear para' alimenta nome, e-mail, telefone, CEP…",
    keywords: ["mapear", "mapeamento", "coluna", "nome", "email", "telefone", "cep"],
    content:
      "Em 'Mapear para', escolha o destino: Nome completo, Nome preferido, Data de nascimento, E-mail, Telefone, Cidade, Estado ou CEP.\n\n" +
      "O valor respondido vai para a coluna correspondente da creator (além de ficar nas respostas). Campos sem mapeamento ficam só nas respostas do formulário.\n\n" +
      "Estado (BR) e Cidade (BR) já vêm mapeados e não deixam trocar o destino.",
  },
  {
    slug: "reordenar-campos-do-formulario",
    category: "Formulários",
    title: "Reordenar os campos",
    summary: "A ordem no construtor é a ordem no formulário.",
    keywords: ["reordenar", "ordem", "posição", "campos", "arrastar"],
    content:
      "No construtor do formulário, a sequência dos campos é a que a creator vê. Ajuste a ordem ali. Reordenar não muda a versão do formulário.",
  },
  {
    slug: "a-chave-do-campo",
    category: "Formulários",
    title: "Para que serve a 'chave' do campo",
    summary: "O identificador técnico de cada campo.",
    keywords: ["chave", "field key", "identificador", "campo"],
    content:
      "A chave é o identificador do campo nas respostas salvas (ex.: nome_completo). Ela começa com letra e só tem letras minúsculas, números e '_'.\n\n" +
      "Mudar a chave é estrutural (incrementa a versão) e não pode repetir dentro do mesmo programa.",
  },
  {
    slug: "placeholder-e-texto-de-ajuda",
    category: "Formulários",
    title: "Placeholder e texto de ajuda",
    summary: "As duas dicas que aparecem no campo.",
    keywords: ["placeholder", "texto de ajuda", "dica", "exemplo", "campo"],
    content:
      "Placeholder é o texto cinza dentro do campo vazio (um exemplo). Texto de ajuda aparece abaixo do campo, sempre visível, para instruções.\n\n" +
      "Nenhum dos dois é obrigatório e nenhum muda a versão do formulário.",
  },
  {
    slug: "protecao-contra-spam-no-formulario",
    category: "Formulários",
    title: "Proteção contra spam no formulário",
    summary: "Honeypot e limite por IP.",
    keywords: ["spam", "bot", "honeypot", "limite", "ip", "throttle"],
    content:
      "O formulário tem um campo-armadilha invisível: se for preenchido, o envio é descartado silenciosamente.\n\n" +
      "Há também um limite de envios por IP em uma janela de alguns minutos. Uma creator legítima que recebe 'muitas tentativas' deve aguardar e tentar de novo.",
  },
  {
    slug: "o-que-a-creator-ve-depois-de-enviar",
    category: "Formulários",
    title: "O que a creator vê depois de enviar",
    summary: "A mensagem de sucesso.",
    keywords: ["depois de enviar", "confirmação", "mensagem de sucesso", "obrigado"],
    content:
      "Ela vê a 'Mensagem de sucesso' configurada no programa (aba Geral). Se você não definir uma, aparece um texto padrão de confirmação.\n\n" +
      "Nenhuma inscrição dispara IA automaticamente — a análise só acontece quando alguém do time clica em Analisar.",
  },
  {
    slug: "seguidores-declarados-no-formulario",
    category: "Formulários",
    title: "Coletar seguidores declarados",
    summary: "Campo Número mapeado para seguidores de Instagram/TikTok.",
    keywords: ["seguidores", "declarados", "instagram", "tiktok", "número", "campo"],
    content:
      "Crie um campo do tipo Número e mapeie para 'Seguidores Instagram' ou 'Seguidores TikTok'. O valor é aceito em formatos comuns (ex.: 12k, 1,2 mi).\n\n" +
      "Esse número é declarado pela creator — diferente das métricas observadas que a análise coleta.",
  },
  {
    slug: "limite-de-campos-no-formulario",
    category: "Formulários",
    title: "Quantos campos posso ter",
    summary: "Não há limite prático; foque no essencial.",
    keywords: ["limite", "quantos campos", "tamanho do formulário"],
    content:
      "Não há um limite fixo, mas formulários curtos convertem melhor. Peça o essencial para avaliar e contatar; o resto pode vir depois da aprovação.",
  },

  // ---- Creators / Inscrições --------------------------------------
  {
    slug: "a-lista-de-creators",
    category: "Creators",
    title: "A lista de Creators",
    summary: "Colunas, busca e filtros.",
    keywords: ["lista", "creators", "colunas", "filtro", "busca", "kanban"],
    content:
      "Creators mostra todas as pessoas inscritas nos seus programas. Você pode buscar por nome e filtrar por status, programa, tier, confiança, score mínimo e situação da análise.\n\n" +
      "A coluna IA traz o Creator Score quando a creator já foi analisada. Há também uma visão em Kanban por status.",
  },
  {
    slug: "abas-da-creator",
    category: "Creators",
    title: "As abas ao abrir uma creator",
    summary: "Resumo, Inteligência, Endereço, Timeline.",
    keywords: ["abas", "creator", "resumo", "inteligência", "endereço", "timeline"],
    content:
      "- Resumo: dados, respostas do formulário e as ações (Aprovar, Solicitar informações, Arquivar).\n" +
      "- Inteligência: Creator Score, tier, confiança, evidence coverage e a avaliação qualitativa.\n" +
      "- Endereço: solicitar/regenerar o link seguro e ver o endereço enviado.\n" +
      "- Timeline: o histórico de tudo que aconteceu com a creator.",
  },
  {
    slug: "transicoes-de-status-permitidas",
    category: "Creators",
    title: "Quais mudanças de status são permitidas",
    summary: "O que pode e o que exige o fluxo seguro.",
    keywords: ["status", "transição", "mudar", "permitido", "fluxo"],
    content:
      "Você move manualmente entre nova, em avaliação, informações solicitadas, aprovada e arquivada.\n\n" +
      "As etapas 'aguardando endereço' e 'completo' NÃO são manuais: elas só acontecem pelo fluxo de Solicitar endereço → a creator preenche. O sistema recusa o atalho manual para essas etapas.",
  },
  {
    slug: "solicitar-informacoes-o-que-a-creator-recebe",
    category: "Creators",
    title: "Solicitar informações: o que a creator recebe",
    summary: "O status muda; o contato é feito por você.",
    keywords: ["solicitar informações", "pendência", "informação", "contato"],
    content:
      "'Solicitar informações' coloca a inscrição em 'informações solicitadas' para você lembrar de cobrar algo que faltou. A Zoviah não envia e-mail automático nessa etapa — o contato com a creator é feito pelo seu canal (WhatsApp, e-mail).\n\n" +
      "Quando a pessoa responder, volte o status para em avaliação ou aprove.",
  },
  {
    slug: "possivel-duplicada-telefone-sinal-fraco",
    category: "Creators",
    title: "Por que uma inscrição aparece como possível duplicada",
    summary: "Telefone é um sinal fraco de duplicidade.",
    keywords: ["duplicada", "duplicado", "telefone", "whatsapp", "mesmo número"],
    content:
      "Duas inscrições que compartilham o mesmo número de telefone são marcadas como 'possível duplicada' — mas isso é só um alerta. Pessoas diferentes às vezes usam o mesmo WhatsApp (família, agência).\n\n" +
      "Confira nome, e-mail e redes antes de decidir. Esse alerta fica no CRM, não na Visão Geral.",
  },
  {
    slug: "a-timeline-da-creator",
    category: "Creators",
    title: "A Timeline da creator",
    summary: "O histórico de eventos.",
    keywords: ["timeline", "histórico", "eventos", "linha do tempo", "auditoria"],
    content:
      "A Timeline registra inscrição, mudanças de status, criação/uso de link de endereço, endereço enviado, análises e criação de envios — com data e quem fez.\n\n" +
      "Eventos públicos (feitos pela creator, como o envio do endereço) aparecem sem um autor do time.",
  },
  {
    slug: "exportar-creators",
    category: "Creators",
    title: "Exportar a lista de creators",
    summary: "Ainda não há exportação em CSV.",
    keywords: ["exportar", "csv", "planilha", "download", "baixar"],
    content:
      "Ainda não existe exportação para planilha. Você consegue filtrar e visualizar tudo no painel.\n\n" +
      "Se exportar é importante para você, registre em Ajuda → Enviar sugestão.",
  },
  {
    slug: "buscar-uma-creator",
    category: "Creators",
    title: "Encontrar uma creator específica",
    summary: "Busca por nome e filtros combinados.",
    keywords: ["buscar", "procurar", "encontrar", "nome", "filtro"],
    content:
      "Use o campo de busca da lista de Creators (por nome). Combine com os filtros de status, programa, tier e score para chegar rápido.\n\n" +
      "Abrir uma creator pela lista mostra todas as abas dela.",
  },

  // ---- Aprovação / Endereço --------------------------------------
  {
    slug: "fluxo-de-aprovacao",
    category: "Aprovação",
    title: "Como aprovar uma creator",
    summary: "Na aba Resumo, botão Aprovar.",
    keywords: ["aprovar", "aprovação", "resumo", "decisão"],
    content:
      "Abra a creator, aba Resumo, e clique em Aprovar. A decisão é sempre humana — o Creator Score ajuda, mas não aprova ninguém.\n\n" +
      "Depois de aprovada, a aba Endereço libera o botão Solicitar endereço.",
  },
  {
    slug: "o-link-seguro-de-endereco",
    category: "Endereço",
    title: "Como funciona o link seguro de endereço",
    summary: "Validade de 14 dias, uso único, não reexibível.",
    keywords: ["link seguro", "endereço", "token", "validade", "expira"],
    content:
      "Ao clicar em Solicitar endereço, a Zoviah gera um link único para a creator preencher o endereço. Ele:\n" +
      "- vale por 14 dias;\n" +
      "- serve uma vez (depois de enviado, não abre de novo);\n" +
      "- não pode ser reexibido — se você perder, gere um novo.\n\n" +
      "O link vai por você (WhatsApp, e-mail). A Zoviah não dispara e-mail nessa etapa.",
  },
  {
    slug: "regenerar-ou-revogar-o-link",
    category: "Endereço",
    title: "Regenerar ou revogar o link de endereço",
    summary: "Quando o link venceu ou foi enviado errado.",
    keywords: ["regenerar", "revogar", "novo link", "expirado", "cancelar link"],
    content:
      "Na aba Endereço da creator:\n" +
      "- Gerar novo link: invalida o anterior e cria outro (use quando o link venceu ou foi para a pessoa errada).\n" +
      "- Revogar solicitação: derruba o link atual e volta a creator para aprovada, sem endereço pendente.",
  },
  {
    slug: "cpf-do-destinatario",
    category: "Endereço",
    title: "Por que pedimos o CPF do destinatário",
    summary: "Os Correios exigem CPF para a etiqueta.",
    keywords: ["cpf", "correios", "destinatário", "documento", "envio", "etiqueta"],
    content:
      "O CPF do destinatário é obrigatório no formulário de endereço porque os Correios exigem esse dado para emitir a etiqueta de envio.\n\n" +
      "Ele é guardado só com os dígitos, aparece para o time na aba Endereço e no envio, e nunca vai para relatórios, histórico público ou para a IA.",
  },
  {
    slug: "creator-diz-que-o-link-expirou",
    category: "Endereço",
    title: "A creator diz que o link de endereço expirou",
    summary: "Gere um novo link.",
    keywords: ["link expirado", "expirou", "não abre", "endereço", "erro"],
    content:
      "O link vale 14 dias e serve uma vez. Se a creator vê 'link indisponível ou expirou', abra a creator, aba Endereço, e clique em Gerar novo link. Envie o novo link para ela.",
  },
  {
    slug: "cep-nao-encontrado",
    category: "Endereço",
    title: "A creator diz que o CEP não foi encontrado",
    summary: "O preenchimento automático é opcional.",
    keywords: ["cep", "não encontrado", "viacep", "endereço", "preenchimento"],
    content:
      "O formulário tenta preencher cidade e estado a partir do CEP, mas isso é um apoio. Se o CEP não for reconhecido, a creator pode digitar rua, bairro, cidade e estado manualmente e enviar normalmente.",
  },
  {
    slug: "cpf-invalido-no-formulario-de-endereco",
    category: "Endereço",
    title: "Erro 'CPF inválido' no formulário de endereço",
    summary: "O CPF é conferido pelos dígitos verificadores.",
    keywords: ["cpf inválido", "erro", "endereço", "dígito verificador", "correios"],
    content:
      "O formulário confere se o CPF tem 11 dígitos e se os dois dígitos verificadores batem. 'CPF inválido' quase sempre é um dígito trocado.\n\n" +
      "Peça para a creator conferir o número no documento e digitar de novo. A máscara 000.000.000-00 é aplicada sozinha.",
  },
  {
    slug: "onde-vejo-o-endereco-enviado",
    category: "Endereço",
    title: "Onde vejo o endereço que a creator enviou",
    summary: "Aba Endereço da creator.",
    keywords: ["endereço enviado", "ver endereço", "cadastro completo", "copiar"],
    content:
      "Depois que a creator preenche, a aba Endereço mostra o endereço atual (com CPF) e um botão Copiar. A inscrição passa para 'completo'.\n\n" +
      "O histórico de solicitações fica logo abaixo, com quem criou cada link e quando foi concluído.",
  },

  // ---- Envios ------------------------------------------------------
  {
    slug: "criar-envio-a-partir-da-creator",
    category: "Envios",
    title: "Criar um envio",
    summary: "Precisa de creator aprovada com endereço.",
    keywords: ["criar envio", "novo envio", "shipment", "endereço", "aprovada"],
    content:
      "Um envio nasce de uma creator que está 'completo' (aprovada e com endereço enviado). Na aba Endereço/Envios, crie o envio: ele copia um snapshot do endereço atual (inclusive o CPF).\n\n" +
      "Depois você adiciona os itens, o rastreio e vai mudando o status.",
  },
  {
    slug: "endereco-do-envio-desatualizado",
    category: "Envios",
    title: "O endereço do envio ficou desatualizado",
    summary: "Atualizar o snapshot quando a creator mudou de endereço.",
    keywords: ["endereço desatualizado", "snapshot", "atualizar", "mudou de endereço", "envio"],
    content:
      "O envio guarda uma cópia do endereço de quando foi criado. Se a creator enviar um endereço mais novo, o envio mostra um aviso enquanto estiver em rascunho ou preparando.\n\n" +
      "Clique em Atualizar endereço do envio para trazer a versão atual (com o CPF novo, se mudou).",
  },
  {
    slug: "cpf-na-etiqueta-dos-correios",
    category: "Envios",
    title: "O CPF no envio e na etiqueta",
    summary: "O CPF vai junto no snapshot do envio.",
    keywords: ["cpf", "etiqueta", "correios", "envio", "snapshot", "destinatário"],
    content:
      "Quando o envio é criado, o CPF do destinatário entra no snapshot do endereço, junto com nome, CEP e demais campos. Ele aparece no bloco de endereço do envio para você usar na etiqueta dos Correios.",
  },
  {
    slug: "status-do-envio-detalhado",
    category: "Envios",
    title: "Os status de um envio",
    summary: "Rascunho, preparando, enviado, entregue, cancelado.",
    keywords: ["status", "envio", "rascunho", "preparando", "enviado", "entregue", "cancelado"],
    content:
      "- Rascunho: em montagem.\n" +
      "- Preparando: itens definidos, ainda não postado.\n" +
      "- Enviado: postado; normalmente já com código de rastreio.\n" +
      "- Entregue: confirmado.\n" +
      "- Cancelado: encerrado sem envio.\n\n" +
      "A Visão Geral conta como 'envios ativos' os que estão em rascunho, preparando ou enviado.",
  },
  {
    slug: "adicionar-rastreio-ao-envio",
    category: "Envios",
    title: "Adicionar código e link de rastreio",
    summary: "Transportadora, código e URL.",
    keywords: ["rastreio", "rastreamento", "código", "transportadora", "tracking"],
    content:
      "No envio, informe a transportadora, o código de rastreio e, se quiser, a URL de rastreamento. Depois marque o envio como Enviado.\n\n" +
      "O link fica disponível para consulta rápida no próprio envio.",
  },
  {
    slug: "editar-ou-cancelar-um-envio",
    category: "Envios",
    title: "Editar itens ou cancelar um envio",
    summary: "O que dá para mudar depois de criado.",
    keywords: ["editar envio", "cancelar envio", "itens", "mudar"],
    content:
      "Itens podem ser ajustados enquanto o envio está em rascunho ou preparando. Cancelar um envio o encerra sem baixa de estoque e sem afetar o status da creator.\n\n" +
      "Um envio cancelado continua no histórico.",
  },

  // ---- Creator Score / IA ---------------------------------------
  {
    slug: "creator-score-como-e-calculado",
    category: "Creator Score",
    title: "Como o Creator Score é calculado",
    summary: "Nota de 0 a 100, determinística, feita no backend.",
    keywords: ["creator score", "score", "cálculo", "0 a 100", "determinístico"],
    content:
      "O score (0–100) é calculado pelo backend de forma determinística a partir de evidências. A IA só produz uma avaliação qualitativa de 3 critérios — nunca a nota geral.\n\n" +
      "Rodar a análise de novo com as mesmas evidências dá o mesmo número.",
  },
  {
    slug: "criterio-sem-evidencia-e-desconhecido",
    category: "Creator Score",
    title: "Critério sem evidência = desconhecido",
    summary: "Falta de dado não vira nota zero.",
    keywords: ["evidência", "desconhecido", "null", "sem dado", "zero", "critério"],
    content:
      "Quando falta evidência para um critério, ele fica como 'desconhecido', não como 0. Isso evita punir uma creator só porque um dado não foi coletado.\n\n" +
      "O evidence coverage mostra quanto da avaliação está apoiado em dados observados.",
  },
  {
    slug: "score-nao-aprova-ninguem",
    category: "Creator Score",
    title: "O score não aprova ninguém",
    summary: "Aprovar, arquivar e solicitar informações são decisões suas.",
    keywords: ["score", "aprovar", "decisão humana", "automático"],
    content:
      "O Creator Score, o tier e a confiança são apoio à decisão. Aprovar, arquivar ou pedir informações continua sendo uma ação manual na aba Resumo.",
  },
  {
    slug: "analise-que-falhou-reprocessar",
    category: "Creator Score",
    title: "Uma análise falhou — como reprocessar",
    summary: "Rodar de novo pela aba Inteligência.",
    keywords: ["análise falhou", "erro", "reprocessar", "tentar de novo", "ia"],
    content:
      "Na Visão Geral, 'Análises que falharam' leva à lista filtrada. Abra a creator, aba Inteligência, e clique em Analisar de novo.\n\n" +
      "Se continuar falhando, verifique se a integração de IA está configurada em /app/ai.",
  },
  {
    slug: "ia-precisa-de-chave",
    category: "Creator Score",
    title: "A análise de IA precisa de configuração",
    summary: "ANTHROPIC_API_KEY e ANTHROPIC_MODEL no servidor.",
    keywords: ["ia", "configuração", "anthropic", "chave", "api key", "não configurada"],
    content:
      "A análise de creators exige ANTHROPIC_API_KEY e ANTHROPIC_MODEL no servidor. Sem elas, o CRM funciona igual e a aba Inteligência mostra 'IA não configurada'.\n\n" +
      "A tela /app/ai mostra o status da integração, o modelo e as versões de prompt e de scoring.",
  },
  {
    slug: "observadas-vs-declaradas",
    category: "Métricas / Evidências",
    title: "Métricas observadas x declaradas",
    summary: "O que a creator informou x o que foi medido.",
    keywords: ["observadas", "declaradas", "seguidores", "métricas", "evidência"],
    content:
      "Declarado: o número que a creator digitou no formulário. Observado: o número que a coleta de evidências mediu.\n\n" +
      "A análise dá mais peso ao observado. Divergências grandes entre os dois aparecem na aba Inteligência.",
  },
  {
    slug: "o-que-e-evidence-coverage",
    category: "Métricas / Evidências",
    title: "O que é evidence coverage",
    summary: "Quanto da análise está apoiada em dados observados.",
    keywords: ["evidence coverage", "cobertura", "evidência", "confiança", "dados"],
    content:
      "Evidence coverage é a proporção dos critérios que têm evidência observada por trás. Coverage baixo significa que a avaliação depende muito do que foi declarado — leia com mais cautela.",
  },

  // ---- Configurações / Conta ----------------------------------
  {
    slug: "cores-da-marca",
    category: "Configurações",
    title: "Definir as cores da marca",
    summary: "Cor primária e secundária em hexadecimal.",
    keywords: ["cores", "primária", "secundária", "hex", "tema", "aparência", "white label"],
    content:
      "Em Configurações → Aparência, informe a cor primária e a secundária em hexadecimal (#RGB ou #RRGGBB). Elas são aplicadas aos tokens de tema em todo o painel e nos formulários públicos.\n\n" +
      "Deixar em branco volta ao tema neutro. Só owner e admin alteram.",
  },
  {
    slug: "upload-da-logo",
    category: "Configurações",
    title: "Enviar a logo da empresa",
    summary: "Feito pela gestão Zoviah; fundo claro, PNG/JPG até 1 MB.",
    keywords: ["logo", "marca", "upload", "imagem", "png", "jpg", "fundo claro"],
    content:
      "O upload da marca é feito pela equipe Zoviah no painel administrativo. A imagem aparece sobre fundo claro (login, topo do sistema e formulários), então evite logos brancas.\n\n" +
      "Formatos aceitos: PNG ou JPG, até 1 MB. Também é possível informar uma URL de imagem em vez de enviar o arquivo.",
  },
  {
    slug: "onde-a-logo-aparece",
    category: "Configurações",
    title: "Onde a logo da empresa aparece",
    summary: "Login, topo do sistema e topo dos formulários.",
    keywords: ["logo", "onde aparece", "login", "topo", "formulário", "marca"],
    content:
      "A logo aparece na tela de login (no endereço da sua empresa), no canto superior do painel — com 'by Zoviah' logo abaixo — e no topo dos formulários públicos.\n\n" +
      "Se ainda não há logo, aparece o nome da organização.",
  },
  {
    slug: "trocar-senha",
    category: "Configurações",
    title: "Trocar a senha ou recuperar acesso",
    summary: "Use 'Esqueci minha senha' na tela de login.",
    keywords: ["senha", "trocar senha", "esqueci", "recuperar", "acesso", "login"],
    content:
      "Na tela de login, clique em 'Esqueci minha senha' e informe seu e-mail. Você recebe um link para definir uma nova senha.\n\n" +
      "O link de recuperação sempre resolve no endereço principal (zoviah.app). Depois de redefinir, acesse o endereço da sua empresa normalmente.",
  },
  {
    slug: "plano-e-condicoes",
    category: "Configurações",
    title: "O plano da organização",
    summary: "Onde ver a condição comercial atual.",
    keywords: ["plano", "condição", "comercial", "assinatura", "billing"],
    content:
      "Configurações → Plano mostra a condição comercial atual da organização. Mudanças de plano são feitas pela equipe Zoviah.\n\n" +
      "A Zoviah ainda não cobra dentro do produto; a cobrança é tratada fora da plataforma.",
  },
  {
    slug: "organizacao-suspensa-o-que-acontece",
    category: "Configurações",
    title: "O que acontece se a organização for suspensa",
    summary: "Os dados ficam; a operação para.",
    keywords: ["suspensa", "suspensão", "bloqueada", "acesso", "reativar"],
    content:
      "Numa organização suspensa, os membros deixam de operar o painel e o formulário público fecha. Nenhum dado é apagado.\n\n" +
      "Ao reativar, tudo volta como estava. A reativação é feita pela equipe Zoviah.",
  },

  // ---- Equipe ------------------------------------------------------
  {
    slug: "equipe-agora-no-menu-lateral",
    category: "Equipe",
    title: "Onde fica a Equipe",
    summary: "Agora é um item do menu lateral, antes de Novidades.",
    keywords: ["equipe", "menu", "onde fica", "configurações", "membros"],
    content:
      "Equipe agora é um item do menu lateral (entre IA e Novidades). Antes ficava dentro de Configurações — o link antigo continua funcionando e leva para o novo lugar.",
  },
  {
    slug: "papeis-owner-admin-analyst",
    category: "Equipe",
    title: "Papéis: owner, admin e analyst",
    summary: "O que cada papel pode fazer.",
    keywords: ["papéis", "permissões", "owner", "admin", "analyst", "analista"],
    content:
      "- Owner: tudo, incluindo aparência, plano e gestão da equipe.\n" +
      "- Admin: opera o CRM, programas, envios e a equipe; também altera a aparência.\n" +
      "- Analyst (analista): opera o CRM e programas, mas não altera aparência nem equipe.\n\n" +
      "Qualquer papel pode gerar link de endereço.",
  },
  {
    slug: "convidar-membro-por-email",
    category: "Equipe",
    title: "Convidar alguém para a equipe",
    summary: "Convite por e-mail com um papel.",
    keywords: ["convidar", "convite", "e-mail", "membro", "adicionar"],
    content:
      "Em Equipe, informe o e-mail e escolha o papel. A pessoa recebe um convite para criar a conta e entrar na organização.\n\n" +
      "Convites pendentes aparecem na mesma tela; a Visão Geral também conta quantos existem.",
  },
  {
    slug: "convidado-nao-recebeu-o-email",
    category: "Equipe",
    title: "O convidado não recebeu o e-mail",
    summary: "Copie o link do convite ou gere outro.",
    keywords: ["convite", "não recebeu", "e-mail", "spam", "reenviar", "link"],
    content:
      "Peça para a pessoa checar spam/lixo eletrônico. Na tela de Equipe você consegue copiar o link do convite pendente e mandar por outro canal, ou remover o convite e criar um novo.\n\n" +
      "O convite tem prazo de validade; depois de vencido, gere outro.",
  },
  {
    slug: "remover-membro-ou-convite-detalhe",
    category: "Equipe",
    title: "Remover um membro ou um convite",
    summary: "E por que o último owner não sai.",
    keywords: ["remover", "excluir", "membro", "convite", "último owner"],
    content:
      "Em Equipe, use a ação de remover ao lado do membro ou do convite pendente.\n\n" +
      "A organização precisa ter pelo menos um owner: o sistema recusa remover ou rebaixar o último owner. Promova outra pessoa a owner antes.",
  },

  // ---- Subdomínio / white-label -----------------------------
  {
    slug: "endereco-da-sua-empresa",
    category: "Configurações",
    title: "O endereço da sua empresa (subdomínio)",
    summary: "empresa.zoviah.app para o seu time acessar.",
    keywords: ["subdomínio", "endereço", "empresa.zoviah.app", "white label", "url"],
    content:
      "Cada organização pode ter um endereço próprio no formato empresa.zoviah.app. É por ali que o seu time faz login e usa o painel, já com a sua marca e as suas cores.\n\n" +
      "O endereço é configurado pela equipe Zoviah.",
  },
  {
    slug: "slug-x-subdominio",
    category: "Configurações",
    title: "Diferença entre slug e subdomínio",
    summary: "Slug é a URL do formulário; subdomínio é o endereço do painel.",
    keywords: ["slug", "subdomínio", "diferença", "url", "formulário", "painel"],
    content:
      "- Slug: aparece nas URLs públicas dos formulários (zoviah.app/p/slug/...). Não muda para não quebrar links já divulgados.\n" +
      "- Subdomínio: o endereço do painel da sua empresa (empresa.zoviah.app).\n\n" +
      "São independentes: ex. slug 'rare-way' e subdomínio 'rareway'.",
  },
  {
    slug: "formularios-publicos-continuam-no-dominio-principal",
    category: "Formulários",
    title: "Os formulários públicos continuam em zoviah.app",
    summary: "O subdomínio não muda o link de inscrição.",
    keywords: ["formulário público", "link", "zoviah.app", "subdomínio", "url"],
    content:
      "Mesmo com o endereço próprio da empresa, os formulários de inscrição continuam em zoviah.app/p/slug/programa. Isso mantém válidos todos os links já compartilhados.",
  },
  {
    slug: "por-que-a-logo-nao-pode-ser-branca",
    category: "Configurações",
    title: "Por que a logo não deve ser branca",
    summary: "Ela aparece sobre fundo claro.",
    keywords: ["logo", "branca", "fundo claro", "contraste", "marca"],
    content:
      "A marca é exibida sobre fundo claro no login, no topo do sistema e nos formulários. Uma logo branca ou muito clara fica invisível. Prefira uma versão com cor ou contorno escuro.",
  },
  {
    slug: "acessei-o-subdominio-e-nao-entra",
    category: "Configurações",
    title: "Acessei o endereço da empresa e não consigo entrar",
    summary: "Sua conta precisa ser membro daquela organização.",
    keywords: ["subdomínio", "não entra", "acesso negado", "organização indisponível", "login"],
    content:
      "O endereço empresa.zoviah.app só dá acesso a quem é membro daquela organização. Se a sua conta não for membro, aparece 'Organização indisponível'.\n\n" +
      "Peça um convite a um admin/owner, ou entre com a conta correta.",
  },

  // ---- Suporte ---------------------------------------------------
  {
    slug: "o-que-o-assistente-de-ajuda-faz",
    category: "Suporte",
    title: "O que o assistente de ajuda faz (e não faz)",
    summary: "Responde pela documentação; não acessa seus dados.",
    keywords: ["assistente", "ajuda", "ia de suporte", "o que faz", "limites"],
    content:
      "O assistente responde com base nos artigos de ajuda. Ele NÃO acessa suas creators, endereços, envios ou métricas, e NÃO executa ações (não move status, não abre tickets).\n\n" +
      "Quando a documentação não cobre o assunto, ele diz isso e oferece encaminhar para o suporte humano.",
  },
  {
    slug: "abrir-solicitacao-ao-suporte-humano",
    category: "Suporte",
    title: "Abrir uma solicitação para o suporte humano",
    summary: "Quando o assistente não resolve.",
    keywords: ["suporte humano", "ticket", "solicitação", "abrir chamado", "falar com alguém"],
    content:
      "No fim de uma conversa com o assistente, use 'Falar com suporte' para abrir uma solicitação com o histórico da conversa anexado.\n\n" +
      "Acompanhe o andamento em Minhas solicitações (pelo menu de ajuda).",
  },
  {
    slug: "minhas-solicitacoes",
    category: "Suporte",
    title: "Acompanhar Minhas solicitações",
    summary: "Onde ver o status dos seus chamados.",
    keywords: ["minhas solicitações", "tickets", "acompanhar", "status", "chamado"],
    content:
      "Minhas solicitações lista os chamados que você abriu, com o status atual. Você recebe atualização quando o suporte responde.",
  },

  // ---- Visão Geral / dashboard --------------------------------
  {
    slug: "ler-a-visao-geral",
    category: "Primeiros passos",
    title: "Como ler a Visão Geral",
    summary: "Os blocos do painel operacional.",
    keywords: ["visão geral", "dashboard", "métricas", "painel", "ler"],
    content:
      "Topo: total de creators, novos no período, aprovadas, cadastro completo e envios ativos.\n" +
      "Depois: crescimento da base, funil de inscrições, pontos de atenção, distribuições (top cidades, estados, programas) e as últimas inscrições.\n\n" +
      "O seletor 7 / 30 / 90 dias muda o período das métricas e do gráfico de crescimento.",
  },
  {
    slug: "pontos-de-atencao",
    category: "Primeiros passos",
    title: "O bloco 'Pontos de atenção'",
    summary: "O que ele lista.",
    keywords: ["pontos de atenção", "atenção", "pendências", "aguardando endereço"],
    content:
      "Mostra o que trava a operação: creators 'Aguardando endereço' e 'Análises que falharam'. Cada item leva para a lista já filtrada.\n\n" +
      "Possíveis duplicadas não aparecem aqui — isso é tratado na lista de Creators.",
  },
  {
    slug: "o-funil-de-inscricoes",
    category: "Primeiros passos",
    title: "O funil de inscrições",
    summary: "Quantas inscrições há em cada etapa.",
    keywords: ["funil", "etapas", "status", "conversão", "inscrições"],
    content:
      "O funil conta as inscrições por etapa: nova, avaliação, informações, aprovada, endereço e completo. Serve para ver onde as pessoas estão paradas.",
  },
  {
    slug: "top-cidades-e-estados",
    category: "Primeiros passos",
    title: "Top cidades e Top estados",
    summary: "De onde vêm suas creators.",
    keywords: ["top cidades", "top estados", "distribuição", "localização"],
    content:
      "Esses blocos agregam creators.city e creators.state das inscrições. Ficam mais precisos quando o formulário usa os campos Estado (BR) e Cidade (BR), que padronizam os valores.",
  },

  // ---- Programas: slug e publicação --------------------------
  {
    slug: "regras-do-slug-do-programa",
    category: "Programas",
    title: "Regras do slug do programa",
    summary: "Minúsculas, números e hífens.",
    keywords: ["slug", "programa", "url", "regras", "hífen"],
    content:
      "O slug do programa entra na URL do formulário. Use apenas letras minúsculas, números e hífens (ex.: campanha-verao).\n\n" +
      "Mudar o slug muda o link público — evite trocar depois de divulgar.",
  },
  {
    slug: "por-que-o-formulario-diz-encerrado",
    category: "Programas",
    title: "O formulário diz 'inscrições encerradas'",
    summary: "Quase sempre é o status do programa.",
    keywords: ["encerradas", "encerrado", "formulário fechado", "não abre", "status"],
    content:
      "O formulário só aceita inscrições com o programa em status Ativo. Em rascunho, pausado ou arquivado ele mostra 'inscrições encerradas'.\n\n" +
      "Abra o programa, aba Geral, e mude o status para Ativo.",
  },

  // ---- Inscrições: casos --------------------------------------
  {
    slug: "reabrir-inscricao-arquivada",
    category: "Creators",
    title: "Reabrir uma inscrição arquivada",
    summary: "Mudar o status de volta.",
    keywords: ["arquivada", "reabrir", "restaurar", "status", "voltar"],
    content:
      "Abra a creator e mude o status de arquivada para em avaliação (ou nova). Nada é perdido ao arquivar — é só um estado.",
  },
  {
    slug: "mesma-creator-em-programas-diferentes",
    category: "Creators",
    title: "A mesma pessoa se inscreveu em dois programas",
    summary: "Cada inscrição é independente.",
    keywords: ["dois programas", "várias inscrições", "mesma pessoa", "duplicada"],
    content:
      "Uma pessoa pode se inscrever em vários programas. Cada inscrição tem seu próprio status e histórico.\n\n" +
      "Se o mesmo telefone aparece em inscrições diferentes, elas podem ser marcadas como 'possível duplicada' — confira antes de agir.",
  },
  {
    slug: "nao-recebi-nada-apos-a-inscricao",
    category: "Formulários",
    title: "A creator diz que não recebeu confirmação por e-mail",
    summary: "Não há e-mail automático de confirmação.",
    keywords: ["não recebi", "confirmação", "e-mail", "após inscrição", "resposta"],
    content:
      "A Zoviah não envia e-mail automático quando a inscrição é feita — a creator só vê a mensagem de sucesso na tela.\n\n" +
      "O contato seguinte (aprovação, pedir informações) é feito pelo seu time, pelo canal que você usa.",
  },

  // ---- Conta / acesso ---------------------------------------
  {
    slug: "aceitar-um-convite",
    category: "Equipe",
    title: "Aceitar um convite e criar a conta",
    summary: "Pelo link do convite.",
    keywords: ["aceitar convite", "criar conta", "cadastro", "signup", "primeiro acesso"],
    content:
      "Abra o link do convite, defina uma senha e a conta é criada já dentro da organização, com o papel escolhido por quem convidou.\n\n" +
      "Se o link estiver vencido, peça um novo a um admin/owner.",
  },
  {
    slug: "mudar-o-email-de-login",
    category: "Configurações",
    title: "Mudar o e-mail de login",
    summary: "Ainda não é autoatendimento.",
    keywords: ["e-mail", "login", "trocar e-mail", "alterar", "conta"],
    content:
      "A troca de e-mail de acesso ainda não é feita pelo painel. Abra uma solicitação em Ajuda → Falar com suporte com o e-mail atual e o novo.",
  },
  {
    slug: "idioma-e-navegador",
    category: "Primeiros passos",
    title: "Idioma e navegador recomendado",
    summary: "Português do Brasil; navegador atualizado.",
    keywords: ["idioma", "navegador", "português", "chrome", "compatibilidade"],
    content:
      "O painel é em português do Brasil. Use um navegador atualizado (Chrome, Edge, Firefox ou Safari recentes). O painel funciona em telas menores, com o menu recolhido no topo.",
  },

  // ---- LGPD / dados ----------------------------------------
  {
    slug: "consentimento-e-lgpd",
    category: "Formulários",
    title: "Consentimento e uso dos dados",
    summary: "O checkbox de autorização no formulário.",
    keywords: ["lgpd", "consentimento", "dados", "privacidade", "autorização"],
    content:
      "Todo formulário público pede a autorização da creator para o uso das informações na avaliação e no contato. Sem marcar, a inscrição não é enviada.\n\n" +
      "Dados sensíveis como CPF ficam restritos ao time e nunca vão para a IA nem para históricos públicos.",
  },
  {
    slug: "quem-ve-o-cpf",
    category: "Endereço",
    title: "Quem enxerga o CPF do destinatário",
    summary: "Apenas o time, na aba Endereço e no envio.",
    keywords: ["cpf", "quem vê", "privacidade", "acesso", "restrito"],
    content:
      "O CPF aparece só para membros da organização, na aba Endereço da creator e no bloco de endereço do envio. Ele não entra em relatórios, na Timeline pública, na lista de creators nem em qualquer conteúdo enviado para a IA.",
  },

  // ---- Creators: editar, corrigir, arquivar, excluir ----------
  {
    slug: "editar-dados-da-creator",
    category: "Creators",
    title: "Como alterar ou editar os dados de uma creator",
    summary: "Os dados vêm do formulário; o que você muda é status, notas e endereço.",
    keywords: [
      "editar", "alterar", "mudar", "atualizar", "corrigir", "modificar",
      "trocar", "dados da creator", "informações", "cadastro",
    ],
    content:
      "Você não edita diretamente os campos que a creator preencheu no formulário (nome, cidade, redes). O que você faz na tela da creator:\n" +
      "- Mudar o status (nova, em avaliação, informações solicitadas, aprovada, arquivada).\n" +
      "- Adicionar notas internas.\n" +
      "- Solicitar informações — coloca a inscrição nesse status para você cobrar a correção pelo seu canal (WhatsApp, e-mail).\n" +
      "- Quando aprovada, solicitar o endereço.\n\n" +
      "Para corrigir um dado errado do formulário, use Solicitar informações e peça para a creator reenviar, ou registre a informação certa numa nota.",
  },
  {
    slug: "corrigir-informacao-errada-da-creator",
    category: "Creators",
    title: "A creator preencheu um dado errado",
    summary: "Solicitar informações ou registrar em nota.",
    keywords: [
      "erro", "errado", "dado errado", "corrigir", "informação incorreta",
      "consertar", "ajustar", "e-mail errado", "telefone errado",
    ],
    content:
      "Abra a creator e clique em Solicitar informações: o status vira 'informações solicitadas' e você combina a correção com a pessoa pelo canal que usa. Quando ela reenviar, volte o status para em avaliação ou aprove.\n\n" +
      "Se for algo pequeno e você já tem o dado certo, registre numa nota interna para o time não se perder.",
  },
  {
    slug: "arquivar-uma-creator",
    category: "Creators",
    title: "Arquivar uma creator",
    summary: "Tira da operação sem apagar nada.",
    keywords: [
      "arquivar", "arquivada", "tirar da lista", "esconder", "inativar",
      "descartar", "recusar", "reprovar",
    ],
    content:
      "Na tela da creator, mude o status para arquivada. Ela sai do fluxo do dia a dia, mas a inscrição, as respostas e o histórico continuam salvos.\n\n" +
      "Para trazer de volta, mude o status de arquivada para em avaliação (ou nova).",
  },
  {
    slug: "excluir-ou-remover-uma-creator",
    category: "Creators",
    title: "Como excluir ou deletar uma creator",
    summary: "Não há exclusão pelo painel — o caminho é Arquivar.",
    keywords: [
      "excluir", "deletar", "apagar", "remover", "eliminar", "delete",
      "tirar", "sumir", "excluir creator", "deletar inscrição",
    ],
    content:
      "O painel não tem 'excluir creator' — isso evita apagar dados por engano e perder o histórico. Use Arquivar: muda o status para arquivada e a creator sai da operação, com tudo preservado.\n\n" +
      "Se você precisa remover os dados de vez (ex.: pedido de exclusão por LGPD), abra uma solicitação em Ajuda → Falar com suporte informando a creator e o motivo.",
  },
  {
    slug: "adicionar-nota-interna-na-creator",
    category: "Creators",
    title: "Adicionar uma nota interna",
    summary: "Anotações do time na tela da creator.",
    keywords: [
      "nota", "notas", "comentário", "observação", "anotação", "registro",
      "interno", "histórico",
    ],
    content:
      "Na tela da creator há um campo de nota. O que você escrever fica visível para o time na Timeline e não é mostrado para a creator.\n\n" +
      "Use para registrar combinados, contexto de avaliação ou correções informadas por fora.",
  },
  {
    slug: "remover-dados-por-lgpd",
    category: "Configurações",
    title: "Pedido de exclusão de dados (LGPD)",
    summary: "Como tratar um pedido para apagar dados pessoais.",
    keywords: [
      "lgpd", "exclusão", "apagar dados", "direito ao esquecimento",
      "remover dados pessoais", "privacidade", "deletar dados",
    ],
    content:
      "O painel não apaga creators nem dados de endereço por conta própria. Para atender um pedido de exclusão, abra uma solicitação em Ajuda → Falar com suporte com a identificação da pessoa e o pedido.\n\n" +
      "Enquanto isso, você pode Arquivar a creator para tirá-la da operação.",
  },
  {
    slug: "o-assistente-nao-encontrou",
    category: "Suporte",
    title: "O assistente respondeu que 'não encontrou'",
    summary: "Reformule a pergunta ou fale com o suporte humano.",
    keywords: [
      "não encontrei", "não sei", "assistente não respondeu", "sem resposta",
      "reformular", "não achou",
    ],
    content:
      "O assistente responde só pela documentação. Se ele não achou, tente reformular com outras palavras (ex.: 'editar' em vez de 'alterar') ou seja mais específico sobre a tela.\n\n" +
      "Se ainda assim não resolver, use 'Falar com suporte' para abrir uma solicitação — o histórico da conversa vai junto.",
  },
];
