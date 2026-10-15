namespace AssistantSupport.Api.Domain;

public class Option
{
    public int Id { get; set; }

    public int NodeId { get; set; }
    public Node Node { get; set; } = null!;

    public string Text { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public int NextNodeId { get; set; }
    public Node NextNode { get; set; } = null!;
}