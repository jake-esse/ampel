import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createXai } from "@ai-sdk/xai";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// Type definitions for Parallel Search API
interface ParallelSearchResult {
  url: string;
  title: string;
  excerpts: string[];
}

interface ParallelSearchResponse {
  search_id: string;
  results: ParallelSearchResult[];
}

/**
 * Perform web search using Parallel Search API (native fetch)
 * Returns formatted search results and citation URLs
 *
 * Using native fetch instead of SDK for better Deno Edge Runtime compatibility
 */
async function performWebSearch(query: string, parallelApiKey: string) {
  try {
    console.log("[Parallel Search] Starting search for query:", query);
    const startTime = Date.now();

    // Call Parallel Search API with AbortSignal timeout (cleaner than Promise.race)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (API should respond in <3s)

    const response = await fetch("https://api.parallel.ai/v1beta/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": parallelApiKey,
      },
      body: JSON.stringify({
        objective: query,
        processor: "base",
        max_results: 5,
        max_chars_per_result: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Parallel Search] API error:", response.status, errorText);
      return null;
    }

    const data: ParallelSearchResponse = await response.json();
    const duration = Date.now() - startTime;

    console.log(`[Parallel Search] Completed in ${duration}ms. Results:`, data.results?.length || 0);

    if (!data.results || data.results.length === 0) {
      console.log("[Parallel Search] No results returned");
      return null;
    }

    // Format results for LLM context
    const formattedResults = data.results
      .map((result, index) => {
        const excerptText = result.excerpts.join(" ");
        return `[${index + 1}] ${result.title}\nURL: ${result.url}\n${excerptText}\n\n---`;
      })
      .join("\n\n");

    // Extract citation URLs in order
    const citationUrls = data.results.map((result) => result.url);

    return {
      formattedResults,
      citationUrls,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[Parallel Search] Request timeout after 5 seconds");
    } else {
      console.error("[Parallel Search] Error:", error);
      console.error(
        "[Parallel Search] Error details:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    return null;
  }
}

/**
 * Build system prompt based on reasoning mode and optional search results
 */
function buildSystemPrompt(reasoning: boolean, searchResults?: string) {
  const basePrompt = reasoning
    ? "You are an AI assistant that uses step-by-step reasoning. Think through problems carefully before answering."
    : "You are a helpful AI assistant. Be concise and accurate.";

  if (!searchResults) {
    return basePrompt;
  }

  return `${basePrompt}\n\nWEB SEARCH RESULTS:\n${searchResults}\n\nUse these search results to inform your response. Cite sources using [Source N] format where N corresponds to the numbered sources above.`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Parse request body
    const { messages, reasoning, webSearch } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Get API keys from environment
    const xaiApiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiApiKey) {
      console.error("XAI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Perform web search if requested (using Parallel Search API)
    let searchResults: string | undefined;
    let citationUrls: string[] = [];

    if (webSearch) {
      const parallelApiKey = Deno.env.get("PARALLEL_API_KEY");
      if (!parallelApiKey) {
        console.warn("[Parallel Search] PARALLEL_API_KEY not configured, skipping search");
      } else {
        // Extract user's latest question for search query
        const latestUserMessage = messages
          .slice()
          .reverse()
          .find((m: any) => m.role === "user");

        if (latestUserMessage) {
          const searchData = await performWebSearch(
            latestUserMessage.content,
            parallelApiKey
          );

          if (searchData) {
            searchResults = searchData.formattedResults;
            citationUrls = searchData.citationUrls;
            console.log(
              "[Parallel Search] Search completed with",
              citationUrls.length,
              "citations"
            );
          }
        }
      }
    }

    // 5. Build system prompt with optional search context
    const systemPrompt = buildSystemPrompt(reasoning, searchResults);

    // 6. Prepare messages for LLM (inject system prompt as first message)
    const llmMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...messages
    ];

    // 7. Select model based on reasoning flag
    const modelName = reasoning ? "grok-4-fast-reasoning" : "grok-4-fast-non-reasoning";

    console.log(
      "User:",
      user.id,
      "| Model:",
      modelName,
      "| Web Search:",
      webSearch,
      "| Citations:",
      citationUrls.length,
      "| Messages:",
      messages.length
    );

    // 8. Configure xAI provider (NO built-in search - we're using Parallel)
    const xai = createXai({
      apiKey: xaiApiKey
    });

    // 9. Stream response from xAI (without xAI's built-in search)
    const result = streamText({
      model: xai(modelName),
      messages: llmMessages
    });

    // 10. Stream the text response, then append token usage and citations
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream all text chunks
          for await (const textPart of result.textStream) {
            controller.enqueue(new TextEncoder().encode(textPart));
          }

          // After streaming completes, get token usage
          const usage = await result.usage;
          const totalTokens = usage?.totalTokens || 0;

          console.log("Token usage:", {
            prompt: usage?.promptTokens,
            completion: usage?.completionTokens,
            total: totalTokens
          });

          // Build response markers
          // Format: \n\n__TOKENS__:{count}__CITATIONS__:["url1","url2",...]
          let markers = `\n\n__TOKENS__:${totalTokens}`;

          if (citationUrls.length > 0) {
            markers += `__CITATIONS__:${JSON.stringify(citationUrls)}`;
          }

          controller.enqueue(new TextEncoder().encode(markers));

          console.log("Stream completed. Total tokens:", totalTokens, "Citations:", citationUrls.length);

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked"
      }
    });
  } catch (error) {
    console.error("Chat function error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
