using AssistantSupport.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Catalog;

public record CategoryDto(int Id, string Name, int TopicCount);
public record TopicSummaryDto(int Id, string Title);

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/categories");

        // Categorias ativas, com a contagem de assuntos publicados.
        group.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
        {
            var items = await db.Categories
                .AsNoTracking()
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
                .Select(c => new CategoryDto(
                    c.Id,
                    c.Name,
                    c.Topics.Count(t => t.IsActive && t.RootNodeId != null)))
                .ToListAsync(ct);

            return Results.Ok(items);
        });

        // Assuntos publicados de uma categoria.
        group.MapGet("/{id:int}/topics", async (int id, AppDbContext db, CancellationToken ct) =>
        {
            var exists = await db.Categories.AnyAsync(c => c.Id == id && c.IsActive, ct);
            if (!exists)
                return Results.NotFound();

            var items = await db.Topics
                .AsNoTracking()
                .Where(t => t.CategoryId == id && t.IsActive && t.RootNodeId != null)
                .OrderBy(t => t.Title)
                .Select(t => new TopicSummaryDto(t.Id, t.Title))
                .ToListAsync(ct);

            return Results.Ok(items);
        });

        return api;
    }
}