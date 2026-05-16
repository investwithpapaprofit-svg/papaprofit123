export function mapChatError(error: any): string {
  if (!error) return "An unexpected communication error occurred.";

  const errStr = error instanceof Error ? error.message : (error.message || String(error));

  if (errStr.includes("401")) {
    return "Your session seems to have expired. Please log in again.";
  }
  if (errStr.includes("429")) {
    return "I'm receiving too many requests right now. Please wait a moment and try again.";
  }
  if (errStr.includes("Failed to fetch") || errStr.toLowerCase().includes("network")) {
    return "It looks like you're offline or experiencing network issues. Please check your connection.";
  }
  if (errStr.includes("GROQ_API_KEY") || errStr.includes("configuration")) {
    return "My AI systems are currently unconfigured. Please check the backend configuration.";
  }
  if (errStr.includes("500") || errStr.includes("outage")) {
    return "My cognitive provider is experiencing a temporary outage. I'll be back online soon.";
  }

  return "I'm having a bit of trouble connecting right now. Let me try again in a moment.";
}
