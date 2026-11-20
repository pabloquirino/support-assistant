using AssistantSupport.Api.Data;
using AssistantSupport.Api.Domain;
using AssistantSupport.Api.Features.Admin;
using AssistantSupport.Api.Features.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Features.Users;

public record CreateUserRequest(string Name, string Email, string Password, UserRole Role);
public record UpdateUserRequest(string Name, string Email, UserRole Role, bool IsActive);
public record ResetPasswordRequest(string Password);
public record AdminUserDto(int Id, string Name, string Email, UserRole Role, bool IsActive, DateTime CreatedAt);

public static class UserRules
{
    public const int MinPassword = 8;
    public const int MaxPassword = 128;

    public static string? ValidateEmail(string email)
    {
        if (email.Length is 0 or > 200) return "Informe um e-mail com até 200 caracteres.";
        var at = email.IndexOf('@');
        if (at <= 0 || at != email.LastIndexOf('@') || at == email.Length - 1 || email.Any(char.IsWhiteSpace))
            return "E-mail inválido.";
        return null;
    }

    public static string? ValidatePassword(string password) =>
        password.Length is < MinPassword or > MaxPassword
            ? $"A senha deve ter entre {MinPassword} e {MaxPassword} caracteres."
            : null;
}

public class UserService(AppDbContext db, IPasswordHasher<User> hasher)
{
    public Task<List<AdminUserDto>> ListAsync(CancellationToken ct) =>
        db.Users
            .AsNoTracking()
            .OrderBy(u => u.Name)
            .Select(u => new AdminUserDto(
                u.Id, u.Name, u.Email, u.Role, u.IsActive, DateTime.SpecifyKind(u.CreatedAt, DateTimeKind.Utc)))
            .ToListAsync(ct);

    public async Task<AdminUserDto> CreateAsync(CreateUserRequest r, CancellationToken ct)
    {
        var (name, email) = await ValidateIdentityAsync(r.Name, r.Email, null, ct);
        Check(UserRules.ValidatePassword(r.Password ?? string.Empty));
        CheckRole(r.Role);

        var user = new User { Name = name, Email = email, Role = r.Role };
        user.PasswordHash = hasher.HashPassword(user, r.Password!);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        return Map(user);
    }

    public async Task<AdminUserDto> UpdateAsync(int id, UpdateUserRequest r, int currentUserId, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                   ?? throw new AdminException("Usuário não encontrado.", 404);

        var (name, email) = await ValidateIdentityAsync(r.Name, r.Email, id, ct);
        CheckRole(r.Role);

        var losesAdmin = user.Role == UserRole.Admin && user.IsActive && (r.Role != UserRole.Admin || !r.IsActive);
        if (losesAdmin)
        {
            if (id == currentUserId)
                throw new AdminException("Você não pode desativar nem remover o perfil Admin da sua própria conta.", 409);

            var otherAdmins = await db.Users.CountAsync(
                u => u.Id != id && u.Role == UserRole.Admin && u.IsActive, ct);
            if (otherAdmins == 0)
                throw new AdminException("É preciso manter ao menos um administrador ativo.", 409);
        }

        user.Name = name;
        user.Email = email;
        user.Role = r.Role;
        user.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);

        return Map(user);
    }

    public async Task ResetPasswordAsync(int id, ResetPasswordRequest r, CancellationToken ct)
    {
        Check(UserRules.ValidatePassword(r.Password ?? string.Empty));

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                   ?? throw new AdminException("Usuário não encontrado.", 404);

        user.PasswordHash = hasher.HashPassword(user, r.Password!);
        await db.SaveChangesAsync(ct);
    }

    private async Task<(string Name, string Email)> ValidateIdentityAsync(
        string? rawName, string? rawEmail, int? selfId, CancellationToken ct)
    {
        var name = (rawName ?? string.Empty).Trim();
        if (name.Length is 0 or > 150)
            throw new AdminException("Informe um nome com até 150 caracteres.");

        var email = EmailNormalizer.Normalize(rawEmail);
        Check(UserRules.ValidateEmail(email));

        var self = selfId ?? 0;
        if (await db.Users.AnyAsync(u => u.Email == email && u.Id != self, ct))
            throw new AdminException("Já existe um usuário com esse e-mail.", 409);

        return (name, email);
    }

    private static void CheckRole(UserRole role)
    {
        if (!Enum.IsDefined(role))
            throw new AdminException("Perfil inválido.");
    }

    private static void Check(string? error)
    {
        if (error is not null) throw new AdminException(error);
    }

    private static AdminUserDto Map(User u) => new(u.Id, u.Name, u.Email, u.Role, u.IsActive, DateTime.SpecifyKind(u.CreatedAt, DateTimeKind.Utc));
}
