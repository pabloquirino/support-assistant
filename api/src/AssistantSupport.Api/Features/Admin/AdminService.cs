using AssistantSupport.Api.Common;
using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using AssistantSupport.Api.Features.Flow;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Admin;

/// <summary>Erro de regra de negócio/validação; o filtro do grupo converte em { error } com o status.</summary>
public class AdminException(string message, int status = StatusCodes.Status400BadRequest) : Exception(message)
{
    public int Status { get; } = status;
}

public class AdminService(AppDbContext db, FileStorage storage)
{
    private const int MaxTerms = 100;
    private const int MaxOptions = 20;
    private const int MaxBlocks = 50;
    private const int MaxContent = 20_000;

    private static readonly byte[] PdfMagic = "%PDF-"u8.ToArray();

    // ------------------------------------------------------------
    // Categorias
    // ------------------------------------------------------------
    public Task<List<AdminCategoryDto>> ListCategoriesAsync(CancellationToken ct) =>
        db.Categories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new AdminCategoryDto(c.Id, c.Name, c.SortOrder, c.IsActive, c.Topics.Count))
            .ToListAsync(ct);

    public async Task<AdminCategoryDto> SaveCategoryAsync(int? id, CategoryRequest r, CancellationToken ct)
    {
        var name = Required(r.Name, "O nome da categoria", 100);
        var self = id ?? 0;

        if (await db.Categories.AnyAsync(c => c.Name == name && c.Id != self, ct))
            throw new AdminException("Já existe uma categoria com esse nome.", 409);

        Category entity;
        if (id is null)
        {
            entity = new Category();
            db.Categories.Add(entity);
        }
        else
        {
            entity = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
                     ?? throw NotFound("categoria");
        }

        entity.Name = name;
        entity.SortOrder = r.SortOrder;
        entity.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);

        var count = await db.Topics.CountAsync(t => t.CategoryId == entity.Id, ct);
        return new AdminCategoryDto(entity.Id, entity.Name, entity.SortOrder, entity.IsActive, count);
    }

    public async Task DeleteCategoryAsync(int id, CancellationToken ct)
    {
        if (await db.Topics.AnyAsync(t => t.CategoryId == id, ct))
            throw new AdminException("A categoria ainda tem assuntos. Mova ou exclua os assuntos primeiro.", 409);

        var deleted = await db.Categories.Where(c => c.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0) throw NotFound("categoria");
    }

    // ------------------------------------------------------------
    // Assuntos
    // ------------------------------------------------------------
    public Task<List<AdminTopicItemDto>> ListTopicsAsync(int? categoryId, CancellationToken ct) =>
        db.Topics
            .AsNoTracking()
            .Where(t => categoryId == null || t.CategoryId == categoryId)
            .OrderBy(t => t.Category.SortOrder).ThenBy(t => t.Title)
            .Select(t => new AdminTopicItemDto(
                t.Id, t.Title, t.CategoryId, t.Category.Name, t.IsActive, t.RootNodeId != null))
            .ToListAsync(ct);

    public async Task<AdminTopicDto> GetTopicAsync(int id, CancellationToken ct)
    {
        var topic = await db.Topics
            .AsNoTracking()
            .AsSplitQuery()
            .Include(t => t.Terms)
            .Include(t => t.Nodes).ThenInclude(n => n.Options)
            .Include(t => t.Nodes).ThenInclude(n => n.Solution).ThenInclude(s => s!.Blocks).ThenInclude(b => b.Attachments)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw NotFound("assunto");

        return new AdminTopicDto(
            topic.Id,
            topic.CategoryId,
            topic.Title,
            topic.IsActive,
            topic.RootNodeId,
            topic.Terms.OrderBy(x => x.Id).Select(x => new AdminTermDto(x.Term, x.Kind)).ToList(),
            topic.Nodes.OrderBy(n => n.Id).Select(MapNode).ToList());
    }

    public async Task<AdminTopicDto> CreateTopicAsync(CreateTopicRequest r, CancellationToken ct)
    {
        var title = Required(r.Title, "O título", 200);

        if (!await db.Categories.AnyAsync(c => c.Id == r.CategoryId, ct))
            throw NotFound("categoria");

        var topic = new Topic
        {
            CategoryId = r.CategoryId,
            Title = title,
            NormalizedTitle = TextNormalizer.Normalize(title)
        };

        db.Topics.Add(topic);
        await db.SaveChangesAsync(ct);
        return await GetTopicAsync(topic.Id, ct);
    }

    public async Task<AdminTopicDto> UpdateTopicAsync(int id, UpdateTopicRequest r, CancellationToken ct)
    {
        var topic = await db.Topics.Include(t => t.Terms).FirstOrDefaultAsync(t => t.Id == id, ct)
                    ?? throw NotFound("assunto");

        var title = Required(r.Title, "O título", 200);

        if (!await db.Categories.AnyAsync(c => c.Id == r.CategoryId, ct))
            throw new AdminException("Categoria inválida.");

        if (r.RootNodeId is int root && !await db.Nodes.AnyAsync(n => n.Id == root && n.TopicId == id, ct))
            throw new AdminException("O nó inicial precisa pertencer a este assunto.");

        var terms = BuildTerms(r.Terms);

        topic.CategoryId = r.CategoryId;
        topic.Title = title;
        topic.NormalizedTitle = TextNormalizer.Normalize(title);
        topic.IsActive = r.IsActive;
        topic.RootNodeId = r.RootNodeId;
        topic.UpdatedAt = DateTime.UtcNow;

        topic.Terms.Clear(); // órfãos são excluídos (FK obrigatória)
        topic.Terms.AddRange(terms);

        await db.SaveChangesAsync(ct);
        return await GetTopicAsync(id, ct);
    }

    public async Task DeleteTopicAsync(int id, CancellationToken ct)
    {
        var fileIds = await db.Attachments
            .Where(a => a.SolutionBlock.Solution.Node.TopicId == id)
            .Select(a => a.Id)
            .ToListAsync(ct);

        // Ordem importa: a raiz e as opções (FKs sem cascata) saem antes; o resto cai em cascata.
        var strategy = db.Database.CreateExecutionStrategy();
        var deleted = await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Topics.Where(t => t.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RootNodeId, (int?)null), ct);
            await db.Options.Where(o => o.Node.TopicId == id).ExecuteDeleteAsync(ct);
            var count = await db.Topics.Where(t => t.Id == id).ExecuteDeleteAsync(ct);
            await tx.CommitAsync(ct);
            return count;
        });

        if (deleted == 0) throw NotFound("assunto");

        foreach (var fileId in fileIds) storage.Delete(fileId);
    }

    // ------------------------------------------------------------
    // Nós
    // ------------------------------------------------------------
    public async Task<AdminNodeDto> GetNodeAsync(int id, CancellationToken ct)
    {
        var node = await db.Nodes
            .AsNoTracking()
            .AsSplitQuery()
            .Include(n => n.Options)
            .Include(n => n.Solution).ThenInclude(s => s!.Blocks).ThenInclude(b => b.Attachments)
            .FirstOrDefaultAsync(n => n.Id == id, ct)
            ?? throw NotFound("nó");

        return MapNode(node);
    }

    public async Task<AdminNodeDto> CreateNodeAsync(int topicId, CreateNodeRequest r, CancellationToken ct)
    {
        var topic = await db.Topics.FirstOrDefaultAsync(t => t.Id == topicId, ct) ?? throw NotFound("assunto");

        if (!Enum.IsDefined(r.Type)) throw new AdminException("Tipo de nó inválido.");

        var node = new Node { TopicId = topicId, Type = r.Type };

        if (r.Type == NodeType.Question)
        {
            node.QuestionText = Required(r.Text, "O texto da pergunta", 500);
        }
        else
        {
            var title = Required(r.Text, "O título da solução", 200);
            node.Solution = new Solution
            {
                Title = title,
                Summary = string.Empty,
                SearchText = TextNormalizer.Normalize(title)
            };
        }

        db.Nodes.Add(node);
        await db.SaveChangesAsync(ct);

        // O primeiro nó criado vira o nó inicial.
        if (topic.RootNodeId is null)
        {
            topic.RootNodeId = node.Id;
            topic.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return await GetNodeAsync(node.Id, ct);
    }

    public async Task<AdminNodeDto> UpdateQuestionAsync(int nodeId, UpdateQuestionRequest r, CancellationToken ct)
    {
        var node = await db.Nodes.Include(n => n.Options).FirstOrDefaultAsync(n => n.Id == nodeId, ct)
                   ?? throw NotFound("nó");

        if (node.Type != NodeType.Question) throw new AdminException("Este nó não é uma pergunta.");

        var questionText = Required(r.QuestionText, "O texto da pergunta", 500);
        var incoming = r.Options ?? [];

        if (incoming.Count is 0 or > MaxOptions)
            throw new AdminException($"Informe de 1 a {MaxOptions} opções.");

        var topicNodeIds = await db.Nodes
            .Where(n => n.TopicId == node.TopicId)
            .Select(n => n.Id)
            .ToListAsync(ct);

        if (incoming.Any(o => !topicNodeIds.Contains(o.NextNodeId)))
            throw new AdminException("Toda opção precisa apontar para um nó deste assunto.");

        await EnsureNoCycleAsync(node, incoming.Select(o => o.NextNodeId), ct);

        var existing = node.Options.ToDictionary(o => o.Id);
        var keep = new HashSet<int>();

        for (var i = 0; i < incoming.Count; i++)
        {
            var o = incoming[i];
            var text = Required(o.Text, "O texto da opção", 200);

            Option entity;
            if (o.Id is int optionId)
            {
                entity = existing.GetValueOrDefault(optionId) ?? throw new AdminException("Opção inválida.");
                keep.Add(optionId);
            }
            else
            {
                entity = new Option { NodeId = node.Id };
                node.Options.Add(entity);
            }

            entity.Text = text;
            entity.NextNodeId = o.NextNodeId;
            entity.SortOrder = i + 1;
        }

        foreach (var removed in existing.Values.Where(o => !keep.Contains(o.Id)))
            db.Options.Remove(removed);

        node.QuestionText = questionText;
        await db.SaveChangesAsync(ct);

        return await GetNodeAsync(nodeId, ct);
    }

    public async Task<AdminNodeDto> UpdateSolutionAsync(int nodeId, UpdateSolutionRequest r, CancellationToken ct)
    {
        var node = await db.Nodes
            .Include(n => n.Solution).ThenInclude(s => s!.Blocks).ThenInclude(b => b.Attachments)
            .FirstOrDefaultAsync(n => n.Id == nodeId, ct)
            ?? throw NotFound("nó");

        var solution = node.Solution ?? throw new AdminException("Este nó não é uma solução.");

        var title = Required(r.Title, "O título da solução", 200);
        var summary = Required(r.Summary, "O resumo da solução", 300);
        var incoming = r.Blocks ?? [];

        if (incoming.Count > MaxBlocks) throw new AdminException($"Máximo de {MaxBlocks} blocos por solução.");

        var existing = solution.Blocks.ToDictionary(b => b.Id);
        var keep = new HashSet<int>();
        var ordered = new List<SolutionBlock>();

        foreach (var b in incoming)
        {
            if (!Enum.IsDefined(b.Type)) throw new AdminException("Tipo de bloco inválido.");

            var blockTitle = Required(b.Title, "O título do bloco", 200);
            var content = (b.ContentMarkdown ?? string.Empty).Trim();

            if (content.Length > MaxContent)
                throw new AdminException($"O bloco \"{blockTitle}\" excede {MaxContent} caracteres.");

            if (b.Type != BlockType.Attachments && content.Length == 0)
                throw new AdminException($"O bloco \"{blockTitle}\" precisa de conteúdo.");

            SolutionBlock entity;
            if (b.Id is int blockId)
            {
                entity = existing.GetValueOrDefault(blockId) ?? throw new AdminException("Bloco inválido.");
                keep.Add(blockId);

                if (entity.Type == BlockType.Attachments && b.Type != BlockType.Attachments && entity.Attachments.Count > 0)
                    throw new AdminException($"Remova os PDFs do bloco \"{blockTitle}\" antes de mudar o tipo.");
            }
            else
            {
                entity = new SolutionBlock();
                solution.Blocks.Add(entity);
            }

            entity.Type = b.Type;
            entity.Title = blockTitle;
            entity.ContentMarkdown = content;
            entity.CollapsedByDefault = b.CollapsedByDefault;
            ordered.Add(entity);
        }

        for (var i = 0; i < ordered.Count; i++) ordered[i].SortOrder = i + 1;

        var removedFiles = new List<Guid>();
        foreach (var old in existing.Values.Where(b => !keep.Contains(b.Id)))
        {
            removedFiles.AddRange(old.Attachments.Select(a => a.Id));
            db.SolutionBlocks.Remove(old); // anexos caem em cascata
        }

        solution.Title = title;
        solution.Summary = summary;
        solution.SearchText = TextNormalizer.Normalize(
            string.Join(' ', new[] { title, summary }.Concat(ordered.Select(b => b.ContentMarkdown))));

        await db.SaveChangesAsync(ct);

        foreach (var fileId in removedFiles) storage.Delete(fileId);

        return await GetNodeAsync(nodeId, ct);
    }

    public async Task DeleteNodeAsync(int nodeId, CancellationToken ct)
    {
        var node = await db.Nodes
            .AsNoTracking()
            .Where(n => n.Id == nodeId)
            .Select(n => new { n.Id, IsRoot = n.Topic.RootNodeId == n.Id })
            .FirstOrDefaultAsync(ct)
            ?? throw NotFound("nó");

        if (node.IsRoot)
            throw new AdminException("Este é o nó inicial do assunto. Defina outro nó inicial antes de excluir.", 409);

        var referrers = await db.Options
            .AsNoTracking()
            .Where(o => o.NextNodeId == nodeId)
            .Select(o => o.Node.QuestionText)
            .Distinct()
            .ToListAsync(ct);

        if (referrers.Count > 0)
            throw new AdminException(
                $"Há opções apontando para este nó (perguntas: {string.Join("; ", referrers.Select(q => $"“{q}”"))}). Altere-as antes de excluir.",
                409);

        var fileIds = await db.Attachments
            .Where(a => a.SolutionBlock.Solution.NodeId == nodeId)
            .Select(a => a.Id)
            .ToListAsync(ct);

        await db.Nodes.Where(n => n.Id == nodeId).ExecuteDeleteAsync(ct); // opções, solução e blocos em cascata

        foreach (var fileId in fileIds) storage.Delete(fileId);
    }

    // ------------------------------------------------------------
    // Anexos (PDF)
    // ------------------------------------------------------------
    public async Task<AttachmentDto> AddAttachmentAsync(int blockId, IFormFile file, CancellationToken ct)
    {
        var block = await db.SolutionBlocks
            .AsNoTracking()
            .Where(b => b.Id == blockId)
            .Select(b => new { b.Type })
            .FirstOrDefaultAsync(ct)
            ?? throw NotFound("bloco");

        if (block.Type != BlockType.Attachments)
            throw new AdminException("Este bloco não é do tipo Anexos. Salve a solução antes de enviar PDFs.");

        if (file.Length == 0)
            throw new AdminException("O arquivo está vazio.");

        if (file.Length > storage.MaxUploadBytes)
            throw new AdminException($"O arquivo excede o limite de {storage.MaxUploadBytes / 1024 / 1024} MB.", 413);

        var name = CleanFileName(file.FileName);
        if (!name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            throw new AdminException("Envie apenas arquivos PDF.", 415);

        await using var stream = file.OpenReadStream();

        // Valida pelo conteúdo, não só pela extensão: todo PDF começa com "%PDF-".
        var header = new byte[PdfMagic.Length];
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        if (read < header.Length || !header.AsSpan().SequenceEqual(PdfMagic))
            throw new AdminException("O conteúdo do arquivo não é um PDF válido.", 415);

        stream.Position = 0;

        var id = Guid.NewGuid(); // nome em disco gerado no servidor
        try
        {
            await storage.SaveAsync(id, stream, ct);

            db.Attachments.Add(new Attachment
            {
                Id = id,
                SolutionBlockId = blockId,
                OriginalFileName = name,
                SizeBytes = file.Length
            });
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            storage.Delete(id);
            throw;
        }

        return new AttachmentDto(id, name, file.Length);
    }

    public async Task DeleteAttachmentAsync(Guid id, CancellationToken ct)
    {
        var deleted = await db.Attachments.Where(a => a.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0) throw NotFound("anexo");

        storage.Delete(id);
    }

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------
    private static AdminNodeDto MapNode(Node n) => new(
        n.Id,
        n.Type,
        n.QuestionText,
        n.Options.OrderBy(o => o.SortOrder).Select(o => new AdminOptionDto(o.Id, o.Text, o.NextNodeId)).ToList(),
        n.Solution is null
            ? null
            : new AdminSolutionDto(
                n.Solution.Id,
                n.Solution.Title,
                n.Solution.Summary,
                n.Solution.Blocks
                    .OrderBy(b => b.SortOrder)
                    .Select(b => new AdminBlockDto(
                        b.Id,
                        b.Type,
                        b.Title,
                        b.ContentMarkdown,
                        b.CollapsedByDefault,
                        b.Attachments
                            .OrderBy(a => a.UploadedAt)
                            .Select(a => new AttachmentDto(a.Id, a.OriginalFileName, a.SizeBytes))
                            .ToList()))
                    .ToList()));

    /// <summary>Impede que as novas opções do nó levem, direta ou indiretamente, de volta a ele.</summary>
    private async Task EnsureNoCycleAsync(Node node, IEnumerable<int> nextIds, CancellationToken ct)
    {
        var edges = await db.Options
            .AsNoTracking()
            .Where(o => o.Node.TopicId == node.TopicId && o.NodeId != node.Id)
            .Select(o => new { o.NodeId, o.NextNodeId })
            .ToListAsync(ct);

        var adjacency = edges.ToLookup(e => e.NodeId, e => e.NextNodeId);
        var seen = new HashSet<int>();
        var stack = new Stack<int>(nextIds);

        while (stack.Count > 0)
        {
            var current = stack.Pop();

            if (current == node.Id)
                throw new AdminException("Essas opções criariam um ciclo na árvore (o fluxo voltaria a esta pergunta).");

            if (!seen.Add(current)) continue;

            foreach (var next in adjacency[current]) stack.Push(next);
        }
    }

    private static List<TopicTerm> BuildTerms(List<TermRequest>? input)
    {
        var result = new List<TopicTerm>();
        var seen = new HashSet<string>();

        foreach (var t in input ?? [])
        {
            var term = (t.Term ?? string.Empty).Trim();
            if (term.Length == 0) continue;

            if (!Enum.IsDefined(t.Kind)) throw new AdminException("Tipo de termo inválido.");
            if (term.Length > 200) throw new AdminException($"Termo muito longo (máx. 200 caracteres): {term[..30]}…");

            var normalized = TextNormalizer.Normalize(term);
            if (normalized.Length == 0 || !seen.Add(normalized)) continue; // ignora duplicados

            result.Add(new TopicTerm { Term = term, NormalizedTerm = normalized, Kind = t.Kind });
        }

        if (result.Count > MaxTerms) throw new AdminException($"Máximo de {MaxTerms} palavras-chave e sinônimos.");
        return result;
    }

    private static string CleanFileName(string? raw)
    {
        var name = Path.GetFileName((raw ?? string.Empty).Replace('\\', '/'));
        var invalid = Path.GetInvalidFileNameChars();
        name = new string(name.Where(c => !char.IsControl(c) && !invalid.Contains(c)).ToArray()).Trim();

        if (name.Length == 0) return "documento.pdf";
        return name.Length > 255 ? name[^255..] : name; // mantém a extensão
    }

    private static string Required(string? value, string label, int max)
    {
        var v = (value ?? string.Empty).Trim();
        if (v.Length == 0) throw new AdminException($"{label} é obrigatório.");
        if (v.Length > max) throw new AdminException($"{label} excede {max} caracteres.");
        return v;
    }

    private static AdminException NotFound(string what) => new($"Não encontrei: {what}.", 404);
}