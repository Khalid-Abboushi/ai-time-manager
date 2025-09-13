export const askAI = async (userInput: string): Promise<string> => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: userInput }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      // Show real error message
      return `${"AI currently not funded."}`;
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Network or parsing error:", error);
    return "❌ Something went wrong with the AI request.";
  }
};
