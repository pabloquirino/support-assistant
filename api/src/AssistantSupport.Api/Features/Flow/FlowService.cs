using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Flow;

public record OptionDto(int Id, string Text, int NextNodeId);

public record AttachmentDto(Guid Id, string FileName, long SizeBytes);

public record BlockDto(
    int Id,
    BlockType Type,
    string Title,
    string ContentMarkdown,
    int SortOrder,
    bool CollapsedByDefault,
    IReadOnlyList<AttachmentDto> Attachments);

public record SolutionDto(int Id, string Title, string Summary, IReadOnlyList<BlockDto> Blocks);

/// <summary>
/// Nó da árvore. Type = Question: QuestionText + Options. Type = Solution: Solution.
/// </summary>
public record NodeDto(
    int Id,
    int TopicId,
    string TopicTitle,
    NodeType Type,
    string? QuestionText,
    IReadOnlyList<OptionDto> Options,
    SolutionDto? Solution);

public class FlowService(AppDbContext db)
{
    /// <summary>Id do nó raiz de um assunto ativo (nulo se não existir, inativo ou sem raiz).</summary>
    public Task<int?> GetRootNodeIdAsync(int topicId, CancellationToken ct) =>
        db.Topics
            .AsNoTracking()
            .Where(t => t.Id == topicId && t.IsActive && t.Category.IsActive)
            .Select(t => t.RootNodeId)
            .FirstOrDefaultAsync(ct);

    public async Task<NodeDto?> GetNodeAsync(int nodeId, CancellationToken ct)
    {
        var head = await db.Nodes
            .AsNoTracking()
            .Where(n => n.Id == nodeId && n.Topic.IsActive && n.Topic.Category.IsActive)
            .Select(n => new
            {
                n.Id,
                n.TopicId,
                TopicTitle = n.Topic.Title,
                n.Type,
                n.QuestionText
            })
            .FirstOrDefaultAsync(ct);

        if (head is null)
            return null;

        if (head.Type == NodeType.Question)
        {
            var options = await db.Options
                .AsNoTracking()
                .Where(o => o.NodeId == nodeId)
                .OrderBy(o => o.SortOrder)
                .Select(o => new OptionDto(o.Id, o.Text, o.NextNodeId))
                .ToListAsync(ct);

            return new NodeDto(head.Id, head.TopicId, head.TopicTitle, head.Type, head.QuestionText, options, null);
        }

        // Projeção explícita: evita carregar Solution.SearchText (campo grande, só usado na busca).
        var solution = await db.Solutions
            .AsNoTracking()
            .Where(s => s.NodeId == nodeId)
            .Select(s => new SolutionDto(
                s.Id,
                s.Title,
                s.Summary,
                s.Blocks
                    .OrderBy(b => b.SortOrder)
                    .Select(b => new BlockDto(
                        b.Id,
                        b.Type,
                        b.Title,
                        b.ContentMarkdown,
                        b.SortOrder,
                        b.CollapsedByDefault,
                        b.Attachments
                            .OrderBy(a => a.UploadedAt)
                            .Select(a => new AttachmentDto(a.Id, a.OriginalFileName, a.SizeBytes))
                            .ToList()))
                    .ToList()))
            .FirstOrDefaultAsync(ct);

        return new NodeDto(head.Id, head.TopicId, head.TopicTitle, head.Type, null, [], solution);
    }
}