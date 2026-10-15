namespace AssistantSupport.Api.Domain;

public class Node
{
    public int Id { get; set; }

    public int TopicId { get; set; }
    public Topic Topic { get; set; } = null!;

    public NodeType Type { get; set; }

    /// <summary>Preenchido apenas quando Type = Question.</summary>
    public string? QuestionText { get; set; }

    /// <summary>Opções de resposta (Type = Question).</summary>
    public List<Option> Options { get; set; } = [];

    /// <summary>Conteúdo (Type = Solution).</summary>
    public Solution? Solution { get; set; }
}