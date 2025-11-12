// app/page.tsx o components/Chat.tsx
import { ChatKit } from "@openai/chatkit/react";
import { getThemeConfig, GREETING, PLACEHOLDER_INPUT } from "@/lib/config";
import EmptyScreen from "@/components/EmptyScreen";

export default function ChatPage() {
  return (
    <ChatKit
      options={{
        theme: getThemeConfig("light"),
        composer: { placeholder: PLACEHOLDER_INPUT, attachments: { enabled: false } },
        startScreen: { greeting: GREETING, prompts: [] },
      }}
      components={{
        EmptyScreen, // usa nuestro componente para la bienvenida
      }}
      className="max-w-[420px] mx-auto p-4" // ancho parecido al de la captura
    />
  );
}
