using System.Text.Json.Serialization;
using AssistantSupport.Api.Common;
using AssistantSupport.Api.Data;
using AssistantSupport.Api.Data.Seed;
using AssistantSupport.Api.Features.Admin;
using AssistantSupport.Api.Features.Attachments;
using AssistantSupport.Api.Features.Auth;
using AssistantSupport.Api.Features.Catalog;
using AssistantSupport.Api.Features.Feedbacks;
using AssistantSupport.Api.Features.Flow;
using AssistantSupport.Api.Features.Metrics;
using AssistantSupport.Api.Features.Search;
using AssistantSupport.Api.Features.Users;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var storagePath = Path.GetFullPath(
    builder.Configuration["Storage:Path"] ?? Path.Combine(AppContext.BaseDirectory, "storage"));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sql => sql.EnableRetryOnFailure()));

// Enums serializados como texto ("Question", "Steps"...), alinhado ao que está no banco.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddSingleton<FileStorage>();
builder.Services.AddScoped<DbSeeder>();
builder.Services.AddScoped<AdminSeeder>();
builder.Services.AddScoped<SearchService>();
builder.Services.AddScoped<FlowService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<MetricsService>();
builder.Services.AddAppAuth(builder.Configuration, storagePath);
builder.Services.AddHealthChecks();

var app = builder.Build();

// Garante que o diretório de PDFs existe (volume montado em /app/storage).
Directory.CreateDirectory(storagePath);
app.Logger.LogInformation("Storage path: {StoragePath}", storagePath);

await app.InitializeDatabaseAsync();

app.UseAppAuth();

// Todas as rotas da API ficam sob /api (o nginx faz proxy sem reescrever caminhos).
var api = app.MapGroup("/api");
api.MapHealthChecks("/health").AllowAnonymous();
api.MapAuthEndpoints();
api.MapCatalogEndpoints();
api.MapSearchEndpoints();
api.MapFlowEndpoints();
api.MapAttachmentEndpoints();
api.MapFeedbackEndpoints();
api.MapAdminEndpoints();

app.Run();