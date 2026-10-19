using AssistantSupport.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Attachments;

public static class AttachmentEndpoints
{
    public static IEndpointRouteBuilder MapAttachmentEndpoints(this IEndpointRouteBuilder api)
    {
        // A constraint :guid garante que nada além de um GUID chega ao handler (sem path traversal).
        api.MapGet("/attachments/{id:guid}/download", async (
            Guid id,
            HttpContext http,
            AppDbContext db,
            IConfiguration config,
            ILoggerFactory loggers,
            CancellationToken ct) =>
        {
            var attachment = await db.Attachments
                .AsNoTracking()
                .Where(a => a.Id == id
                    && a.SolutionBlock.Solution.Node.Topic.IsActive
                    && a.SolutionBlock.Solution.Node.Topic.Category.IsActive)
                .Select(a => new { a.Id, a.OriginalFileName })
                .FirstOrDefaultAsync(ct);

            if (attachment is null)
                return Results.NotFound();

            // Nome em disco = {Id}.pdf, montado a partir do registro do banco.
            var root = Path.GetFullPath(
                config["Storage:Path"] ?? Path.Combine(AppContext.BaseDirectory, "storage"));
            var path = Path.Combine(root, $"{attachment.Id}.pdf");

            if (!File.Exists(path))
            {
                loggers.CreateLogger("Attachments")
                    .LogWarning("Arquivo do anexo {AttachmentId} não encontrado em {Path}.", attachment.Id, path);
                return Results.NotFound();
            }

            http.Response.Headers["X-Content-Type-Options"] = "nosniff";

            var stream = new FileStream(
                path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096,
                FileOptions.Asynchronous | FileOptions.SequentialScan);

            // fileDownloadName gera Content-Disposition: attachment (com encoding de acentos).
            return Results.File(stream, "application/pdf", attachment.OriginalFileName);
        });

        return api;
    }
}