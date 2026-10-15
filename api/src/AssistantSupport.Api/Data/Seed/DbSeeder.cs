using AssistantSupport.Api.Common;
using AssistantSupport.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Data.Seed;

/// <summary>
/// Popula exemplos de conteúdo. Só roda com o banco sem categorias.
/// O conteúdo é ilustrativo: substitua pelos procedimentos reais via admin (etapa 6).
/// </summary>
public class DbSeeder(AppDbContext db, ILogger<DbSeeder> logger)
{
    public async Task SeedAsync(CancellationToken ct = default)
    {
        var strategy = db.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();

            if (await db.Categories.AnyAsync(ct))
            {
                logger.LogInformation("Seed ignorado: já existem categorias.");
                return;
            }

            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var financeiro = new Category { Name = "Financeiro", SortOrder = 1 };
            var acesso = new Category { Name = "Acesso", SortOrder = 2 };
            var info = new Category { Name = "Info", SortOrder = 3 };
            db.Categories.AddRange(financeiro, acesso, info);

            var built = new[]
            {
                BuildPaymentTopic(financeiro),
                BuildPasswordTopic(acesso),
                BuildSupportChannelsTopic(info)
            };

            db.Topics.AddRange(built.Select(x => x.Topic));
            await db.SaveChangesAsync(ct);

            // Raiz definida depois do primeiro save (referência circular Topic <-> Node).
            foreach (var (topic, root) in built)
                topic.RootNodeId = root.Id;

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            logger.LogInformation("Seed concluído: {Count} assuntos de exemplo.", built.Length);
        });
    }

    // ---------------------------------------------------------------
    // Financeiro > Pagamento não processado (condições encadeadas)
    // ---------------------------------------------------------------
    private static (Topic Topic, Node Root) BuildPaymentTopic(Category category)
    {
        var topic = NewTopic(
            category,
            "Pagamento não processado",
            keywords: ["pagamento", "cobrança", "pix", "boleto", "cartão", "compensação"],
            synonyms: ["pgto não caiu", "pix não compensou", "pagamento não identificado",
                       "boleto não baixou", "cobrança não liquidada"]);

        var pixRecent = SolutionNode(topic,
            "Pix realizado há menos de 1 hora",
            "Aguardar a compensação e orientar o cliente antes de escalar.",
            Block(BlockType.Steps, "Procedimento", """
                1. Confirme com o cliente o valor e o horário exatos do Pix.
                2. Localize a cobrança correspondente no módulo Financeiro.
                3. Confirme que o status ainda está como **Pendente**.
                4. Oriente o cliente a aguardar até completar 1 hora e a consultar novamente.
                5. Se passar de 1 hora sem baixa, siga o procedimento de "Pix há mais de 1 hora".
                """),
            Block(BlockType.CustomerMessage, "Mensagem ao cliente", """
                Olá! Identificamos que o seu Pix foi realizado há pouco tempo. A compensação
                pode levar até 1 hora. Se após esse prazo o pagamento não constar como
                confirmado, nos avise com o comprovante e verificaremos imediatamente.
                """),
            Block(BlockType.Note, "Prazo de compensação", """
                O Pix costuma compensar em segundos. Atrasos de até 1 hora podem ocorrer por
                instabilidade do banco do pagador.
                """));

        var pixOld = SolutionNode(topic,
            "Pix realizado há mais de 1 hora",
            "Solicitar comprovante e abrir ticket para conciliação manual.",
            Block(BlockType.Steps, "Procedimento", """
                1. Solicite ao cliente o **comprovante** do Pix (com ID da transação E2E).
                2. Confira se valor, data e chave de destino conferem com a cobrança.
                3. Verifique se há outra cobrança em aberto com o mesmo valor.
                4. Se tudo conferir, abra o ticket de conciliação manual (modelo abaixo).
                5. Informe ao cliente o número do ticket e o prazo de retorno.
                """),
            Block(BlockType.Warning, "Atenção", """
                **Nunca** peça ao cliente para pagar novamente enquanto a conciliação não for
                concluída.
                """),
            Block(BlockType.CustomerMessage, "Mensagem ao cliente", """
                Olá! Recebemos o seu comprovante e abrimos um chamado para conciliar o
                pagamento manualmente. O número do protocolo é **[PROTOCOLO]** e retornaremos
                em até **[PRAZO]**. Não é necessário pagar novamente.
                """),
            Block(BlockType.Ticket, "Modelo de ticket", """
                - **Assunto:** Pix não compensado há mais de 1h
                - **Cliente:** [nome / documento]
                - **Valor:** [R$ 0,00]
                - **Data e hora do Pix:** [dd/mm/aaaa hh:mm]
                - **ID da transação (E2E):** [ID]
                - **Comprovante anexado:** sim
                - **Verificações realizadas:** cobrança pendente, sem duplicidade
                """),
            Block(BlockType.Attachments, "Materiais de apoio", """
                PDFs para enviar ao cliente (cadastrados pelo admin).
                """, collapsed: true));

        var boleto = SolutionNode(topic,
            "Boleto não baixado",
            "Verificar prazo de compensação bancária e conferir o pagamento.",
            Block(BlockType.Steps, "Procedimento", """
                1. Confirme a data em que o cliente pagou o boleto.
                2. Verifique se já se passaram **3 dias úteis** desde o pagamento.
                3. Se o prazo não venceu, oriente o cliente a aguardar.
                4. Se venceu, solicite o comprovante com a autenticação bancária.
                5. Abra ticket para conferência com o banco, anexando o comprovante.
                """),
            Block(BlockType.Warning, "Prazo de compensação", """
                Boletos pagos em fins de semana e feriados só são compensados no próximo dia útil.
                """),
            Block(BlockType.CustomerMessage, "Mensagem ao cliente", """
                Olá! A compensação de boletos pode levar até 3 dias úteis após o pagamento.
                Caso esse prazo já tenha passado, envie o comprovante com a autenticação
                bancária para que possamos verificar.
                """));

        var card = SolutionNode(topic,
            "Cartão de crédito recusado ou pendente",
            "Checar status da transação na operadora antes de orientar o cliente.",
            Block(BlockType.Steps, "Procedimento", """
                1. Consulte o status da transação (aprovada, negada ou em análise).
                2. Se **negada**, confirme o motivo informado pela operadora.
                3. Se **em análise**, oriente o cliente a aguardar até 24 horas.
                4. Se o cliente foi cobrado mas o sistema não liberou, abra o ticket abaixo.
                """),
            Block(BlockType.Note, "Motivos comuns de recusa", """
                Limite insuficiente, dados do cartão incorretos ou bloqueio preventivo do
                banco emissor.
                """),
            Block(BlockType.Ticket, "Modelo de ticket", """
                - **Assunto:** Cobrança no cartão sem liberação no sistema
                - **Cliente:** [nome / documento]
                - **Valor:** [R$ 0,00]
                - **Data e hora da transação:** [dd/mm/aaaa hh:mm]
                - **Últimos 4 dígitos do cartão:** [0000]
                - **NSU / código de autorização:** [código]
                """));

        var pixQuestion = Question(topic,
            "O Pix foi realizado há mais de 1 hora?",
            ("Sim", pixOld),
            ("Não", pixRecent));

        var root = Question(topic,
            "Qual foi a forma de pagamento utilizada pelo cliente?",
            ("Pix", pixQuestion),
            ("Boleto", boleto),
            ("Cartão de crédito", card));

        return (topic, root);
    }

    // ---------------------------------------------------------------
    // Acesso > Redefinir senha (assunto sem condições: raiz = solução)
    // ---------------------------------------------------------------
    private static (Topic Topic, Node Root) BuildPasswordTopic(Category category)
    {
        var topic = NewTopic(
            category,
            "Redefinir senha de acesso",
            keywords: ["senha", "login", "acesso", "redefinir", "recuperar"],
            synonyms: ["esqueci a senha", "não consigo entrar", "senha expirada",
                       "não consigo logar", "resetar senha"]);

        var solution = SolutionNode(topic,
            "Redefinição de senha",
            "Enviar link de redefinição para o e-mail cadastrado do usuário.",
            Block(BlockType.Steps, "Procedimento", """
                1. Confirme a identidade do usuário (nome completo e e-mail cadastrado).
                2. Na tela de login, peça que clique em **Esqueci minha senha**.
                3. Caso não receba o e-mail, verifique a caixa de spam.
                4. Se ainda assim não chegar, confirme no cadastro se o e-mail está correto.
                5. Se o e-mail estiver incorreto, atualize-o e reenvie o link.
                """),
            Block(BlockType.Warning, "Segurança", """
                **Nunca** solicite ou receba a senha do cliente por chat, e-mail ou telefone.
                """),
            Block(BlockType.CustomerMessage, "Mensagem ao cliente", """
                Olá! Para redefinir sua senha, acesse a tela de login e clique em
                **Esqueci minha senha**. Enviaremos um link para o e-mail cadastrado. Se não
                o encontrar, confira a caixa de spam e nos avise.
                """));

        return (topic, solution);
    }

    // ---------------------------------------------------------------
    // Info > Canais e horário de atendimento
    // ---------------------------------------------------------------
    private static (Topic Topic, Node Root) BuildSupportChannelsTopic(Category category)
    {
        var topic = NewTopic(
            category,
            "Canais e horário de atendimento",
            keywords: ["horário", "atendimento", "telefone", "contato", "suporte", "canais"],
            synonyms: ["qual o horário", "como falar com o suporte", "telefone do suporte"]);

        var solution = SolutionNode(topic,
            "Canais e horário de atendimento",
            "Informar os canais disponíveis e o horário de funcionamento do suporte.",
            Block(BlockType.Note, "Horário", """
                Segunda a sexta, das **8h às 18h** (exemplo: ajuste para o horário real).
                """),
            Block(BlockType.CustomerMessage, "Mensagem ao cliente", """
                Olá! Nosso suporte atende de segunda a sexta, das 8h às 18h, pelos canais
                **chat**, **e-mail** e **telefone**.
                """));

        return (topic, solution);
    }

    // ---------------------------------------------------------------
    // Helpers de construção do grafo
    // ---------------------------------------------------------------
    private static Topic NewTopic(Category category, string title, string[] keywords, string[] synonyms)
    {
        var topic = new Topic
        {
            Category = category,
            Title = title,
            NormalizedTitle = TextNormalizer.Normalize(title)
        };

        topic.Terms.AddRange(keywords.Select(k => NewTerm(k, TermKind.Keyword)));
        topic.Terms.AddRange(synonyms.Select(s => NewTerm(s, TermKind.Synonym)));
        return topic;
    }

    private static TopicTerm NewTerm(string term, TermKind kind) => new()
    {
        Term = term,
        NormalizedTerm = TextNormalizer.Normalize(term),
        Kind = kind
    };

    private static Node Question(Topic topic, string text, params (string Text, Node Next)[] options)
    {
        var node = new Node { Type = NodeType.Question, QuestionText = text };

        for (var i = 0; i < options.Length; i++)
        {
            node.Options.Add(new Option
            {
                Text = options[i].Text,
                SortOrder = i + 1,
                NextNode = options[i].Next
            });
        }

        topic.Nodes.Add(node);
        return node;
    }

    private static Node SolutionNode(Topic topic, string title, string summary, params SolutionBlock[] blocks)
    {
        for (var i = 0; i < blocks.Length; i++)
            blocks[i].SortOrder = i + 1;

        var searchText = TextNormalizer.Normalize(
            string.Join(' ', new[] { title, summary }.Concat(blocks.Select(b => b.ContentMarkdown))));

        var node = new Node
        {
            Type = NodeType.Solution,
            Solution = new Solution
            {
                Title = title,
                Summary = summary,
                SearchText = searchText,
                Blocks = [.. blocks]
            }
        };

        topic.Nodes.Add(node);
        return node;
    }

    private static SolutionBlock Block(BlockType type, string title, string markdown, bool collapsed = false) => new()
    {
        Type = type,
        Title = title,
        ContentMarkdown = markdown.Trim(),
        CollapsedByDefault = collapsed
    };
}