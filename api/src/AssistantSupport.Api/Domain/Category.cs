namespace AssistantSupport.Api.Domain;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public List<Topic> Topics { get; set; } = [];
}