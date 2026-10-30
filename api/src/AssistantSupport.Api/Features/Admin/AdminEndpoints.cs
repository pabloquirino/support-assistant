namespace AssistantSupport.Api.Features.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/admin");

        g.AddEndpointFilter(async (ctx, next) =>
        {
            try
            {
                return await next(ctx);
            }
            catch (AdminException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: ex.Status);
            }
        });

        // Categorias
        g.MapGet("/categories", (AdminService s, CancellationToken ct) => s.ListCategoriesAsync(ct));
        g.MapPost("/categories", (CategoryRequest r, AdminService s, CancellationToken ct) =>
            s.SaveCategoryAsync(null, r, ct));
        g.MapPut("/categories/{id:int}", (int id, CategoryRequest r, AdminService s, CancellationToken ct) =>
            s.SaveCategoryAsync(id, r, ct));
        g.MapDelete("/categories/{id:int}", async (int id, AdminService s, CancellationToken ct) =>
        {
            await s.DeleteCategoryAsync(id, ct);
            return Results.NoContent();
        });

        // Assuntos
        g.MapGet("/topics", (int? categoryId, AdminService s, CancellationToken ct) =>
            s.ListTopicsAsync(categoryId, ct));
        g.MapGet("/topics/{id:int}", (int id, AdminService s, CancellationToken ct) => s.GetTopicAsync(id, ct));
        g.MapPost("/topics", (CreateTopicRequest r, AdminService s, CancellationToken ct) =>
            s.CreateTopicAsync(r, ct));
        g.MapPut("/topics/{id:int}", (int id, UpdateTopicRequest r, AdminService s, CancellationToken ct) =>
            s.UpdateTopicAsync(id, r, ct));
        g.MapDelete("/topics/{id:int}", async (int id, AdminService s, CancellationToken ct) =>
        {
            await s.DeleteTopicAsync(id, ct);
            return Results.NoContent();
        });

        // Nós
        g.MapPost("/topics/{topicId:int}/nodes", (int topicId, CreateNodeRequest r, AdminService s, CancellationToken ct) =>
            s.CreateNodeAsync(topicId, r, ct));
        g.MapGet("/nodes/{id:int}", (int id, AdminService s, CancellationToken ct) => s.GetNodeAsync(id, ct));
        g.MapPut("/nodes/{id:int}/question", (int id, UpdateQuestionRequest r, AdminService s, CancellationToken ct) =>
            s.UpdateQuestionAsync(id, r, ct));
        g.MapPut("/nodes/{id:int}/solution", (int id, UpdateSolutionRequest r, AdminService s, CancellationToken ct) =>
            s.UpdateSolutionAsync(id, r, ct));
        g.MapDelete("/nodes/{id:int}", async (int id, AdminService s, CancellationToken ct) =>
        {
            await s.DeleteNodeAsync(id, ct);
            return Results.NoContent();
        });

        // Anexos (campo multipart "file")
        g.MapPost("/blocks/{blockId:int}/attachments", (int blockId, IFormFile file, AdminService s, CancellationToken ct) =>
                s.AddAttachmentAsync(blockId, file, ct))
            .DisableAntiforgery();
        g.MapDelete("/attachments/{id:guid}", async (Guid id, AdminService s, CancellationToken ct) =>
        {
            await s.DeleteAttachmentAsync(id, ct);
            return Results.NoContent();
        });

        return api;
    }
}