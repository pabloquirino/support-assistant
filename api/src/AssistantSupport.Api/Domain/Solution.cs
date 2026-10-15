namespace AssistantSupport.Api.Domain;

public class Solution
{
    public int Id { get; set; }

    public int NodeId { get; set; }
    public Node Node { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    /// <summary>Resumo de uma linha exibido no cabeçalho do painel.</summary>
    public string Summary { get; set; } = string.Empty;

    /// <summary>Título + resumo + conteúdo dos blocos, normalizados. Usado no ranking por conteúdo.</summary>
    public string SearchText { get; set; } = string.Empty;

    public List<SolutionBlock> Blocks { get; set; } = [];
}