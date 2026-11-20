using AssistantSupport.Api.Data.Seed;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        var settings = app.Configuration.GetSection("Database");
        var autoMigrate = settings.GetValue("AutoMigrate", true);
        var seed = settings.GetValue("Seed", true);

        using var scope = app.Services.CreateScope();

        if (autoMigrate)
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            app.Logger.LogInformation("Applying database migrations...");
            await db.Database.MigrateAsync();
        }

        // Admin inicial (ADMIN_EMAIL/ADMIN_PASSWORD): roda mesmo com DB_SEED=false.
        await scope.ServiceProvider.GetRequiredService<AdminSeeder>().SeedAsync();

        if (seed)
        {
            var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
            await seeder.SeedAsync();
        }
    }
}