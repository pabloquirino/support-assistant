using System.Text.RegularExpressions;
using AssistantSupport.Api.Common;
using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Search;

public enum MatchSource
{
    Title,
    Keyword,
    Synonym,
    Content
}

public record SearchResultDto(int TopicId, string Title, int CategoryId, string CategoryName, MatchSource MatchedBy);

public record SearchResponse(string Query, int Total, IReadOnlyList<SearchResultDto> Results);

/// <summary>
/// Busca determinística (sem IA). Ranking em camadas, da mais para a menos relevante:
///   Título         700..1000  (igual > contém a frase > cobertura de palavras)
///   Termos         400..650   (palavras-chave e sinônimos)
///   Conteúdo       100..300   (SearchText das soluções)
/// </summary>
public partial class SearchService(AppDbContext db, ILogger<SearchService> logger)
{
    private const int MaxResults = 10;
    private const int MaxTokens = 6;

    private static readonly HashSet<string> StopWords =
    [
        "de", "da", "do", "das", "dos", "o", "a", "os", "as", "um", "uma",
        "e", "em", "no", "na", "nos", "nas", "para", "por", "com", "ao", "que"
    ];

    public async Task<SearchResponse> SearchAsync(string term, int? userId, CancellationToken ct)
    {
        var normalized = TextNormalizer.Normalize(term);
        var ranked = await RankAsync(normalized, ct);

        await LogAsync(term, normalized, ranked.Count, userId);

        return new SearchResponse(term, ranked.Count, ranked.Take(MaxResults).ToList());
    }

    private async Task<List<SearchResultDto>> RankAsync(string query, CancellationToken ct)
    {
        var tokens = Tokenize(query);
        if (tokens.Count == 0)
            return [];

        // Com várias palavras, ao menos metade precisa casar (1→1, 2→1, 3→2, 4→2, 5→3...).
        var minMatch = Math.Max(1, (tokens.Count + 1) / 2);

        // Volume pequeno (ferramenta interna): título e termos são ranqueados em memória.
        var topics = await db.Topics
            .AsNoTracking()
            .Where(t => t.IsActive && t.RootNodeId != null && t.Category.IsActive)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.NormalizedTitle,
                t.CategoryId,
                CategoryName = t.Category.Name,
                Terms = t.Terms.Select(x => new { x.NormalizedTerm, x.Kind }).ToList()
            })
            .ToListAsync(ct);

        var (contentTokens, contentPhrase) = await FindContentHitsAsync(query, tokens, ct);

        var results = new List<(int Score, SearchResultDto Dto)>();

        foreach (var t in topics)
        {
            var best = (Score: 0, Source: MatchSource.Title);

            var titleScore = ScoreTitle(t.NormalizedTitle, query, tokens, minMatch);
            if (titleScore > best.Score)
                best = (titleScore, MatchSource.Title);

            foreach (var term in t.Terms)
            {
                var termScore = ScoreTerm(term.NormalizedTerm, query, tokens, minMatch);
                if (termScore > best.Score)
                {
                    best = (termScore, term.Kind == TermKind.Keyword ? MatchSource.Keyword : MatchSource.Synonym);
                }
            }

            var contentScore = ScoreContent(t.Id, tokens, minMatch, contentTokens, contentPhrase);
            if (contentScore > best.Score)
                best = (contentScore, MatchSource.Content);

            if (best.Score == 0)
                continue;

            results.Add((best.Score,
                new SearchResultDto(t.Id, t.Title, t.CategoryId, t.CategoryName, best.Source)));
        }

        return results
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.Dto.Title, StringComparer.CurrentCultureIgnoreCase)
            .Select(r => r.Dto)
            .ToList();
    }

    // -------------------------------------------------------------
    // Pontuação
    // -------------------------------------------------------------
    private static int ScoreTitle(string title, string query, List<string> tokens, int minMatch)
    {
        if (title == query) return 1000;
        if (title.Contains(query)) return 900;

        var matched = tokens.Count(title.Contains);
        return matched >= minMatch ? 700 + 150 * matched / tokens.Count : 0;
    }

    private static int ScoreTerm(string term, string query, List<string> tokens, int minMatch)
    {
        if (term == query) return 650;
        if (term.Contains(query)) return 600;

        // Consulta mais longa que o termo: "meu pix nao compensou" contém "pix nao compensou".
        if (term.Length >= 3 && query.Contains(term))
            return 500 + Math.Min(term.Length, 49);

        var matched = tokens.Count(term.Contains);
        return matched >= minMatch ? 400 + 99 * matched / tokens.Count : 0;
    }

    private static int ScoreContent(
        int topicId,
        List<string> tokens,
        int minMatch,
        Dictionary<int, HashSet<string>> contentTokens,
        HashSet<int> contentPhrase)
    {
        if (contentPhrase.Contains(topicId)) return 300;

        if (contentTokens.TryGetValue(topicId, out var hit) && hit.Count >= minMatch)
            return 100 + 150 * hit.Count / tokens.Count;

        return 0;
    }

    // -------------------------------------------------------------
    // Conteúdo (Solution.SearchText): uma consulta por palavra + uma pela frase
    // -------------------------------------------------------------
    private async Task<(Dictionary<int, HashSet<string>> Tokens, HashSet<int> Phrase)> FindContentHitsAsync(
        string query, List<string> tokens, CancellationToken ct)
    {
        var byTopic = new Dictionary<int, HashSet<string>>();

        foreach (var token in tokens)
        {
            var topicIds = await db.Solutions
                .AsNoTracking()
                .Where(s => s.SearchText.Contains(token))
                .Select(s => s.Node.TopicId)
                .Distinct()
                .ToListAsync(ct);

            foreach (var id in topicIds)
            {
                if (!byTopic.TryGetValue(id, out var set))
                {
                    set = new HashSet<string>();
                    byTopic[id] = set;
                }

                set.Add(token);
            }
        }

        HashSet<int> phrase;
        if (tokens.Count == 1 && tokens[0] == query)
        {
            // Consulta de uma palavra: a frase é a própria palavra, não precisa de nova ida ao banco.
            phrase = byTopic.Where(kv => kv.Value.Contains(query)).Select(kv => kv.Key).ToHashSet();
        }
        else
        {
            var ids = await db.Solutions
                .AsNoTracking()
                .Where(s => s.SearchText.Contains(query))
                .Select(s => s.Node.TopicId)
                .Distinct()
                .ToListAsync(ct);
            phrase = ids.ToHashSet();
        }

        return (byTopic, phrase);
    }

    // -------------------------------------------------------------
    // Utilidades
    // -------------------------------------------------------------
    private static List<string> Tokenize(string normalized) =>
        TokenSplitter()
            .Split(normalized)
            .Where(t => t.Length >= 2 && !StopWords.Contains(t))
            .Distinct()
            .Take(MaxTokens)
            .ToList();

    [GeneratedRegex(@"[^\p{L}\p{N}]+")]
    private static partial Regex TokenSplitter();

    private async Task LogAsync(string term, string normalized, int resultCount, int? userId)
    {
        try
        {
            db.SearchLogs.Add(new SearchLog
            {
                Term = term,
                NormalizedTerm = normalized,
                ResultCount = resultCount,
                UserId = userId
            });

            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Falha no log não pode derrubar a busca.
            logger.LogWarning(ex, "Não foi possível registrar a busca '{Term}'.", term);
        }
    }
}