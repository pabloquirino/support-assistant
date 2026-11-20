using AssistantSupport.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Metrics;

public record UnansweredSearchDto(string NormalizedTerm, int Count, DateTime LastAt);

/// <summary>SolutionId null = feedbacks de soluções que já foram excluídas.</summary>
public record SolutionFeedbackDto(
    int? SolutionId,
    string SolutionTitle,
    string? TopicTitle,
    int Total,
    int Resolved,
    int NotResolved,
    double ResolvedRate,
    DateTime LastAt);

public record MetricsDto(
    int Days,
    int TotalSearches,
    int SearchesWithoutResult,
    int TotalFeedback,
    int ResolvedFeedback,
    IReadOnlyList<UnansweredSearchDto> UnansweredSearches,
    IReadOnlyList<SolutionFeedbackDto> Solutions);

public class MetricsService(AppDbContext db)
{
    private const int MaxUnanswered = 100;

    public async Task<MetricsDto> GetAsync(int days, CancellationToken ct)
    {
        days = Math.Clamp(days, 1, 365);
        var since = DateTime.UtcNow.AddDays(-days);

        var searches = db.SearchLogs.AsNoTracking().Where(s => s.CreatedAt >= since);
        var totalSearches = await searches.CountAsync(ct);
        var withoutResult = await searches.CountAsync(s => s.ResultCount == 0, ct);

        var unanswered = (await searches
                .Where(s => s.ResultCount == 0)
                .GroupBy(s => s.NormalizedTerm)
                .Select(g => new { Term = g.Key, Count = g.Count(), LastAt = g.Max(x => x.CreatedAt) })
                .OrderByDescending(x => x.Count).ThenByDescending(x => x.LastAt)
                .Take(MaxUnanswered)
                .ToListAsync(ct))
            .Select(x => new UnansweredSearchDto(x.Term, x.Count, AsUtc(x.LastAt)))
            .ToList();

        var grouped = await db.Feedbacks
            .AsNoTracking()
            .Where(f => f.CreatedAt >= since)
            .GroupBy(f => f.SolutionId)
            .Select(g => new
            {
                SolutionId = g.Key,
                Total = g.Count(),
                Resolved = g.Count(x => x.Resolved),
                LastAt = g.Max(x => x.CreatedAt),
                SnapshotTitle = g.Max(x => x.SolutionTitle)
            })
            .ToListAsync(ct);

        // Título atual (pode ter sido renomeada depois do feedback) e o assunto de cada solução.
        var ids = grouped.Where(g => g.SolutionId != null).Select(g => g.SolutionId!.Value).ToList();
        var current = await db.Solutions
            .AsNoTracking()
            .Where(s => ids.Contains(s.Id))
            .Select(s => new { s.Id, s.Title, Topic = s.Node.Topic.Title })
            .ToDictionaryAsync(s => s.Id, ct);

        var solutions = grouped
            .Select(g =>
            {
                var found = g.SolutionId is { } id && current.TryGetValue(id, out var c) ? c : null;
                var title = found?.Title ?? (g.SolutionId is null ? "Soluções excluídas" : g.SnapshotTitle ?? "(sem título)");
                return new SolutionFeedbackDto(
                    g.SolutionId,
                    title,
                    found?.Topic,
                    g.Total,
                    g.Resolved,
                    g.Total - g.Resolved,
                    g.Total == 0 ? 0 : Math.Round((double)g.Resolved / g.Total, 4),
                    AsUtc(g.LastAt));
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        return new MetricsDto(
            days,
            totalSearches,
            withoutResult,
            solutions.Sum(s => s.Total),
            solutions.Sum(s => s.Resolved),
            unanswered,
            solutions);
    }

    /// <summary>O SQL Server devolve DateTime sem Kind; gravamos em UTC, então o JSON deve sair com "Z".</summary>
    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
