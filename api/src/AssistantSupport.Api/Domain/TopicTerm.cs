namespace AssistantSupport.Api.Domain;

public class TopicTerm
{
    public int Id { get; set; }

    public int TopicId { get; set; }
    public Topic Topic { get; set; } = null!;

    public string Term { get; set; } = string.Empty;
    public string NormalizedTerm { get; set; } = string.Empty;
    public TermKind Kind { get; set; }
}