import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "Consultar normativa DS-1",
    prompt: "Explícame los límites de contaminación lumínica según la DS-1.",
  },
  {
    label: "Ensayos fotométricos",
    prompt: "¿Cómo se realiza un ensayo LM-79?",
  },
];

export const PLACEHOLDER_INPUT = "Escribe tu consulta sobre iluminación...";
export const GREETING = "Hola, soy el asistente DS1. ¿En qué puedo ayudarte hoy?";

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: { hue: 220, tint: 6, shade: theme === "dark" ? -1 : -4 },
    accent: { primary: "#f15f19", level: 1 },
  },
  radius: "pill",
  density: "compact",
  typography: {
    baseSize: 16,
    fontFamily:
      '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontFamilyMono:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSources: [
      {
        family: "OpenAI Sans",
        src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
        weight: 400,
        style: "normal",
        display: "swap",
      },
    ],
  },
});
