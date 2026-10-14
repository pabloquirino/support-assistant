var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();

var app = builder.Build();

// Garante que o diretório de PDFs existe (volume montado em /app/storage).
var storagePath = app.Configuration["Storage:Path"] ?? Path.Combine(AppContext.BaseDirectory, "storage");
Directory.CreateDirectory(storagePath);
app.Logger.LogInformation("Storage path: {StoragePath}", storagePath);

// Todas as rotas da API ficam sob /api (o nginx faz proxy sem reescrever caminhos).
var api = app.MapGroup("/api");
api.MapHealthChecks("/health");

app.Run();