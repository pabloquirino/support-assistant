using System.Text.Json.Serialization;
using AssistantSupport.Api.Common;
using AssistantSupport.Api.Data;
using AssistantSupport.Api.Data.Seed;
using AssistantSupport.Api.Features.Admin;
using AssistantSupport.Api.Features.Attachments;
using AssistantSupport.Api.Features.Catalog;
using AssistantSupport.Api.Features.Feedbacks;
using AssistantSupport.Api.Features.Flow;
using AssistantSupport.Api.Features.Search;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sql => sql.EnableRetryOnFailure()));

// Enums serializados como texto ("Question", "Steps"...), alinhado ao que está no banco.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddSingleton<FileStorage>();
builder.Services.AddScoped<DbSeeder>();
builder.Services.AddScoped<SearchService>();
builder.Services.AddScoped<FlowService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddHealthChecks();

var app = builder.Build();

// Garante que o diretório de PDFs existe (volume montado em /app/storage).
var storagePath = app.Configuration["Storage:Path"] ?? Path.Combine(AppContext.BaseDirectory, "storage");
Directory.CreateDirectory(storagePath);
app.Logger.LogInformation("Storage path: {StoragePath}", storagePath);

await app.InitializeDatabaseAsync();

// Todas as rotas da API ficam sob /api (o nginx faz proxy sem reescrever caminhos).
var api = app.MapGroup("/api");
api.MapHealthChecks("/health");
api.MapCatalogEndpoints();
api.MapSearchEndpoints();
api.MapFlowEndpoints();
api.MapAttachmentEndpoints();
api.MapFeedbackEndpoints();
api.MapAdminEndpoints();

app.Run();