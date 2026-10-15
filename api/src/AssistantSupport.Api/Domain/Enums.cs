namespace AssistantSupport.Api.Domain;

public enum NodeType
{
    Question = 1,
    Solution = 2
}

public enum BlockType
{
    Steps = 1,
    CustomerMessage = 2,
    Ticket = 3,
    Attachments = 4,
    Note = 5,
    Warning = 6
}

public enum TermKind
{
    Keyword = 1,
    Synonym = 2
}

public enum UserRole
{
    Analyst = 1,
    Admin = 2
}