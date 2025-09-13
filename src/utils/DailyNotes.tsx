import { useEffect, useRef, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { askAI } from "@/utils/askAI";


const DailyNotes = () => {
  const [dailyNotes, setDailyNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Load notes on mount
  useEffect(() => {
    const saved = localStorage.getItem("dailyNotes");
    if (saved && editorRef.current) {
      editorRef.current.innerHTML = saved;
      setDailyNotes(saved);
    }
  }, []);

  // Save notes whenever they change
  const handleInput = () => {
    const html = editorRef.current?.innerHTML || "";
    setDailyNotes(html);
    localStorage.setItem("dailyNotes", html);
  };

  const formatText = (command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
  };

  const handleAskAI = async () => {
    if (!editorRef.current) return;
    setLoading(true);

    const prompt = editorRef.current.innerText;
    try {
      const aiResponse = await askAI(prompt);
      const responseNode = document.createElement("p");
      responseNode.innerHTML = `<strong>AI:</strong> ${aiResponse}`;
      editorRef.current.appendChild(responseNode);
      handleInput(); // re-save to localStorage
    } catch (err) {
      const errorNode = document.createElement("p");
      errorNode.innerHTML = `<strong>AI:</strong> ❌ AI request failed.`;
      editorRef.current.appendChild(errorNode);
      handleInput();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 border-b pb-2">
        <button
          type="button"
          className="text-sm font-bold px-2 py-1 rounded hover:bg-muted transition"
          onClick={() => formatText("bold")}
        >
          B
        </button>
        <button
          type="button"
          className="text-sm italic px-2 py-1 rounded hover:bg-muted transition"
          onClick={() => formatText("italic")}
        >
          I
        </button>
        <button
          type="button"
          className="text-sm underline px-2 py-1 rounded hover:bg-muted transition"
          onClick={() => formatText("underline")}
        >
          U
        </button>
        <button
          type="button"
          className="ml-auto text-sm flex items-center space-x-1 px-2 py-1 rounded border hover:bg-primary/10 transition"
          onClick={handleAskAI}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
          <span>Ask AI</span>
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
        className="w-full min-h-[150px] p-4 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary resize-y"
      />
    </div>
  );
};

export default DailyNotes;
