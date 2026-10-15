namespace AssistantSupport.Api.Domain;

public class SolutionBlock
{
    public int Id { get; set; }

    public int SolutionId { get; set; }
    public Solution Solution { get; set; } = null!;

    public BlockType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentMarkdown { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool CollapsedByDefault { get; set; }

    /// <summary>Usado apenas por blocos do tipo Attachments (zero ou mais PDFs).</summary>
    public List<Attachment> Attachments { get; set; } = [];
}