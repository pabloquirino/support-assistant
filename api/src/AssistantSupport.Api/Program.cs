using System.Text.Json.Serialization;
using AssistantSupport.Api.Data;
using AssistantSupport.Api.Data.Seed;
using AssistantSupport.Api.Features.Catalog;
using AssistantSupport.Api.Features.Flow;
using AssistantSupport.Api.Features.Search;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sql => sql.EnableRetryOnFailure()));

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddScoped<DbSeeder>();
builder.Services.AddScoped<SearchService>();
builder.Services.AddScoped<FlowService>();
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

app.Run();