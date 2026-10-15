namespace AssistantSupport.Api.Domain;

public class Topic
{
    public int Id { get; set; }

    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    /// <summary>Título em minúsculas e sem acento, usado na busca.</summary>
    public string NormalizedTitle { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Primeiro nó da árvore (pergunta ou solução). Nulo apenas enquanto o assunto está sendo montado.</summary>
    public int? RootNodeId { get; set; }
    public Node? RootNode { get; set; }

    public List<TopicTerm> Terms { get; set; } = [];
    public List<Node> Nodes { get; set; } = [];
}