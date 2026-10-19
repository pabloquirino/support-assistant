namespace AssistantSupport.Api.Features.Flow;

public static class FlowEndpoints
{
    public static IEndpointRouteBuilder MapFlowEndpoints(this IEndpointRouteBuilder api)
    {
        // Primeiro nó do assunto (pergunta ou solução direta).
        api.MapGet("/topics/{topicId:int}/start", async (int topicId, FlowService flow, CancellationToken ct) =>
        {
            var rootId = await flow.GetRootNodeIdAsync(topicId, ct);
            if (rootId is null)
                return Results.NotFound();

            var node = await flow.GetNodeAsync(rootId.Value, ct);
            return node is null ? Results.NotFound() : Results.Ok(node);
        });

        // Qualquer nó: o cliente segue Option.NextNodeId.
        api.MapGet("/nodes/{nodeId:int}", async (int nodeId, FlowService flow, CancellationToken ct) =>
        {
            var node = await flow.GetNodeAsync(nodeId, ct);
            return node is null ? Results.NotFound() : Results.Ok(node);
        });

        return api;
    }
}