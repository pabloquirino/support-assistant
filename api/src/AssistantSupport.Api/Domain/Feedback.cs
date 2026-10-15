namespace AssistantSupport.Api.Domain;

public class Feedback
{
    public int Id { get; set; }

    public int? SolutionId { get; set; }
    public Solution? Solution { get; set; }

    /// <summary>Snapshot do título, para as métricas sobreviverem à exclusão da solução.</summary>
    public string SolutionTitle { get; set; } = string.Empty;

    public bool Resolved { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? UserId { get; set; }
    public User? User { get; set; }
}