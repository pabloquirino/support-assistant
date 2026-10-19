using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Feedbacks;

public record CreateFeedbackRequest(int SolutionId, bool Resolved);

public static class FeedbackEndpoints
{
    public static IEndpointRouteBuilder MapFeedbackEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/feedback", async (CreateFeedbackRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var title = await db.Solutions
                .AsNoTracking()
                .Where(s => s.Id == request.SolutionId)
                .Select(s => s.Title)
                .FirstOrDefaultAsync(ct);

            if (title is null)
                return Results.NotFound();

            db.Feedbacks.Add(new Feedback
            {
                SolutionId = request.SolutionId,
                SolutionTitle = title, // snapshot: as métricas sobrevivem à exclusão da solução
                Resolved = request.Resolved
            });

            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        return api;
    }
}