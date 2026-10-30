using AssistantSupport.Api.Domain;
using AssistantSupport.Api.Features.Flow;

namespace AssistantSupport.Api.Features.Admin;

// ---- Requests ----
public record CategoryRequest(string Name, int SortOrder, bool IsActive);
public record CreateTopicRequest(int CategoryId, string Title);
public record TermRequest(string Term, TermKind Kind);
public record UpdateTopicRequest(int CategoryId, string Title, bool IsActive, int? RootNodeId, List<TermRequest> Terms);

/// <summary>Text = texto da pergunta (Question) ou título da solução (Solution).</summary>
public record CreateNodeRequest(NodeType Type, string Text);

public record OptionRequest(int? Id, string Text, int NextNodeId);
public record UpdateQuestionRequest(string QuestionText, List<OptionRequest> Options);

public record BlockRequest(int? Id, BlockType Type, string Title, string ContentMarkdown, bool CollapsedByDefault);
public record UpdateSolutionRequest(string Title, string Summary, List<BlockRequest> Blocks);

// ---- Responses ----
public record AdminCategoryDto(int Id, string Name, int SortOrder, bool IsActive, int TopicCount);
public record AdminTopicItemDto(int Id, string Title, int CategoryId, string CategoryName, bool IsActive, bool HasRoot);
public record AdminTermDto(string Term, TermKind Kind);
public record AdminOptionDto(int Id, string Text, int NextNodeId);

public record AdminBlockDto(
    int Id,
    BlockType Type,
    string Title,
    string ContentMarkdown,
    bool CollapsedByDefault,
    IReadOnlyList<AttachmentDto> Attachments);

public record AdminSolutionDto(int Id, string Title, string Summary, IReadOnlyList<AdminBlockDto> Blocks);

public record AdminNodeDto(
    int Id,
    NodeType Type,
    string? QuestionText,
    IReadOnlyList<AdminOptionDto> Options,
    AdminSolutionDto? Solution);

public record AdminTopicDto(
    int Id,
    int CategoryId,
    string Title,
    bool IsActive,
    int? RootNodeId,
    IReadOnlyList<AdminTermDto> Terms,
    IReadOnlyList<AdminNodeDto> Nodes);