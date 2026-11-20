using System.Security.Claims;
using AssistantSupport.Api.Features.Auth;

namespace AssistantSupport.Api.Features.Search;

public static class SearchEndpoints
{
    private const int MinLength = 2;
    private const int MaxLength = 200;

    public static IEndpointRouteBuilder MapSearchEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/search", async (string? q, ClaimsPrincipal user, SearchService search, CancellationToken ct) =>
        {
            var term = (q ?? string.Empty).Trim();

            if (term.Length < MinLength)
                return Results.BadRequest(new { error = $"Informe ao menos {MinLength} caracteres." });

            if (term.Length > MaxLength)
                term = term[..MaxLength];

            return Results.Ok(await search.SearchAsync(term, user.GetUserId(), ct));
        });

        return api;
    }
}
