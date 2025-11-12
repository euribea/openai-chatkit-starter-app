// lib/config.ts
import { ColorScheme, ThemeOption, StartScreenPrompt } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// Deja prompts vacío si no los usas, pero EXPORTA el nombre que el panel importa
export const STARTER_PROMPTS: StartScreenPrompt[] = [];

// Textos (estética)
export const GREETING = "Bienvenido, que duda tienes hoy?";
export const PLACEHOLDER_INPUT = "Enviar mensaje a la IA";

// Tema (solo estética)
export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    background: "#ffffff",
    foreground: "#0f172a",
    border: { color: "#e5e7eb" },
    grayscale: { hue: 220, tint: 6, shade: theme === "dark" ? -1 : -4 },
    accent: { primary: "#0f172a", level: 1 }, // cambia a #f15f19 si quieres tu naranja
  },
  radius: "pill",
  density: "compact",
  typography: {
    baseSize: 16,
    fontFamily:
      '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
    fontFamilyMono:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
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
