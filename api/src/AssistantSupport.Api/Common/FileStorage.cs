namespace AssistantSupport.Api.Common;

/// <summary>Único ponto que conhece o caminho do volume de PDFs. Nome em disco: {Guid}.pdf.</summary>
public class FileStorage(IConfiguration config, ILogger<FileStorage> logger)
{
    private readonly string _root = Path.GetFullPath(
        config["Storage:Path"] ?? Path.Combine(AppContext.BaseDirectory, "storage"));

    public long MaxUploadBytes { get; } = config.GetValue("Storage:MaxUploadMb", 10) * 1024L * 1024L;

    public string PathFor(Guid id) => Path.Combine(_root, $"{id}.pdf");

    public async Task SaveAsync(Guid id, Stream content, CancellationToken ct)
    {
        Directory.CreateDirectory(_root);
        await using var file = new FileStream(
            PathFor(id), FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(file, ct);
    }

    /// <summary>Remoção best-effort: um arquivo órfão não deve derrubar a operação.</summary>
    public void Delete(Guid id)
    {
        try
        {
            File.Delete(PathFor(id));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Não foi possível remover o arquivo do anexo {AttachmentId}.", id);
        }
    }
}