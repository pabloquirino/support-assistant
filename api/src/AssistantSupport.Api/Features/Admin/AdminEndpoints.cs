using System.Security.Claims;
using AssistantSupport.Api.Features.Auth;
using AssistantSupport.Api.Features.Metrics;
using AssistantSupport.Api.Features.Users;

namespace AssistantSupport.Api.Features.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder api)
    {
        // Toda a área administrativa exige o perfil Admin.
        var g = api.MapGroup("/admin").RequireAuthorization(AuthPolicies.Admin);

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

        // Anexos (campo multipart "file"). O antiforgery fica ativo: o front envia X-XSRF-TOKEN.
        g.MapPost("/blocks/{blockId:int}/attachments", (int blockId, IFormFile file, AdminService s, CancellationToken ct) =>
            s.AddAttachmentAsync(blockId, file, ct));
        g.MapDelete("/attachments/{id:guid}", async (Guid id, AdminService s, CancellationToken ct) =>
        {
            await s.DeleteAttachmentAsync(id, ct);
            return Results.NoContent();
        });

        // Usuários
        g.MapGet("/users", (UserService s, CancellationToken ct) => s.ListAsync(ct));
        g.MapPost("/users", (CreateUserRequest r, UserService s, CancellationToken ct) => s.CreateAsync(r, ct));
        g.MapPut("/users/{id:int}", (int id, UpdateUserRequest r, ClaimsPrincipal me, UserService s, CancellationToken ct) =>
            s.UpdateAsync(id, r, me.GetUserId() ?? 0, ct));
        g.MapPost("/users/{id:int}/password", async (int id, ResetPasswordRequest r, UserService s, CancellationToken ct) =>
        {
            await s.ResetPasswordAsync(id, r, ct);
            return Results.NoContent();
        });

        // Métricas (buscas sem resultado e feedbacks) dos últimos N dias
        g.MapGet("/metrics", (int? days, MetricsService s, CancellationToken ct) => s.GetAsync(days ?? 30, ct));

        return api;
    }
}