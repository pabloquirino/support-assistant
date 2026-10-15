namespace AssistantSupport.Api.Domain;

public class SearchLog
{
    public int Id { get; set; }
    public string Term { get; set; } = string.Empty;
    public string NormalizedTerm { get; set; } = string.Empty;
    public int ResultCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? UserId { get; set; }
    public User? User { get; set; }
}