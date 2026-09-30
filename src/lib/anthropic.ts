import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fast/cheap model for structured extraction; stronger model for generation
// that needs real destination and itinerary knowledge.
export const MODEL_FAST = "claude-haiku-4-5-20251001";
export const MODEL_SMART = "claude-sonnet-5";

/**
 * Calls Claude with a single tool definition and forces the model to use it,
 * returning the tool call's input as parsed JSON. This is the structured-output
 * pattern for all three LLM calls (taste extraction, suggestions, itinerary).
 */
export async function callStructured<T>(args: {
  model: string;
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
}): Promise<T> {
  const response = await anthropic.messages.create({
    model: args.model,
    // Room for five suggestions or a multi-day itinerary. A reply that hits the cap is
    // cut off mid-tool-call, which is what intermittently broke suggestion generation.
    max_tokens: 16000,
    system: args.system,
    messages: [{ role: "user", content: args.prompt }],
    tools: [
      {
        name: args.toolName,
        description: args.toolDescription,
        input_schema: {
          type: "object",
          ...args.inputSchema,
        } as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: args.toolName },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(`Claude's ${args.toolName} reply was cut off at max_tokens`);
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude did not return a ${args.toolName} tool call`);
  }

  return toolUse.input as T;
}
