namespace AssistantSupport.Api.Domain;

public class Attachment
{
    /// <summary>Também é o nome do arquivo no volume: {Id}.pdf</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    public int SolutionBlockId { get; set; }
    public SolutionBlock SolutionBlock { get; set; } = null!;

    /// <summary>Nome original, usado apenas para exibição e para o download.</summary>
    public string OriginalFileName { get; set; } = string.Empty;

    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}