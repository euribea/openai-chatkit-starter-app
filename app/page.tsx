// app/page.tsx
import { ChatKit } from "@openai/chatkit";   // ✅ <- sin /react
import options from "@/chatkit.config";      // si usas tu options
// o tus helpers:
import { getThemeConfig, GREETING, PLACEHOLDER_INPUT } from "@/lib/config";

export default function Page() {
  return (
    <ChatKit
      options={{
        theme: getThemeConfig("light"),
        composer: { placeholder: PLACEHOLDER_INPUT, attachments: { enabled: false } },
        startScreen: { greeting: GREETING, prompts: [] },
      }}
    />
  );
}
