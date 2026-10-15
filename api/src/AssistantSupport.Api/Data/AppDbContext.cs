using AssistantSupport.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AssistantSupport.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<TopicTerm> TopicTerms => Set<TopicTerm>();
    public DbSet<Node> Nodes => Set<Node>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<Solution> Solutions => Set<Solution>();
    public DbSet<SolutionBlock> SolutionBlocks => Set<SolutionBlock>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<SearchLog> SearchLogs => Set<SearchLog>();
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Category>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();

            // Não permite apagar categoria que ainda tem assuntos.
            e.HasMany(x => x.Topics)
                .WithOne(x => x.Category)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Topic>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.NormalizedTitle).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.NormalizedTitle);

            e.HasMany(x => x.Nodes)
                .WithOne(x => x.Topic)
                .HasForeignKey(x => x.TopicId)
                .OnDelete(DeleteBehavior.Cascade);

            // Referência circular Topic <-> Node: o lado "raiz" não propaga exclusão.
            e.HasOne(x => x.RootNode)
                .WithMany()
                .HasForeignKey(x => x.RootNodeId)
                .OnDelete(DeleteBehavior.NoAction);

            e.HasMany(x => x.Terms)
                .WithOne(x => x.Topic)
                .HasForeignKey(x => x.TopicId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<TopicTerm>(e =>
        {
            e.Property(x => x.Term).HasMaxLength(200).IsRequired();
            e.Property(x => x.NormalizedTerm).HasMaxLength(200).IsRequired();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => x.NormalizedTerm);
        });

        b.Entity<Node>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.QuestionText).HasMaxLength(500);

            e.HasMany(x => x.Options)
                .WithOne(x => x.Node)
                .HasForeignKey(x => x.NodeId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Solution)
                .WithOne(x => x.Node)
                .HasForeignKey<Solution>(x => x.NodeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Option>(e =>
        {
            e.Property(x => x.Text).HasMaxLength(200).IsRequired();
            e.HasIndex(x => new { x.NodeId, x.SortOrder });

            // Destino da opção: sem cascata (evita múltiplos caminhos no SQL Server).
            e.HasOne(x => x.NextNode)
                .WithMany()
                .HasForeignKey(x => x.NextNodeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Solution>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Summary).HasMaxLength(300).IsRequired();
            e.Property(x => x.SearchText).IsRequired(); // nvarchar(max)

            e.HasMany(x => x.Blocks)
                .WithOne(x => x.Solution)
                .HasForeignKey(x => x.SolutionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SolutionBlock>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.ContentMarkdown).IsRequired(); // nvarchar(max)
            e.HasIndex(x => new { x.SolutionId, x.SortOrder });

            e.HasMany(x => x.Attachments)
                .WithOne(x => x.SolutionBlock)
                .HasForeignKey(x => x.SolutionBlockId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Attachment>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired();
        });

        b.Entity<SearchLog>(e =>
        {
            e.Property(x => x.Term).HasMaxLength(200).IsRequired();
            e.Property(x => x.NormalizedTerm).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.NormalizedTerm);
            e.HasIndex(x => x.CreatedAt);

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Feedback>(e =>
        {
            e.Property(x => x.SolutionTitle).HasMaxLength(200).IsRequired();
            e.Property(x => x.Comment).HasMaxLength(1000);
            e.HasIndex(x => x.CreatedAt);

            e.HasOne(x => x.Solution)
                .WithMany()
                .HasForeignKey(x => x.SolutionId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<User>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => x.Email).IsUnique();
        });
    }
}