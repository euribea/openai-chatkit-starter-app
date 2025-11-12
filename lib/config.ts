import { ColorScheme, ThemeOption } from "@openai/chatkit";

export const GREETING = "Bienvenido, que duda tienes hoy?";
export const PLACEHOLDER_INPUT = "Enviar mensaje a la IA";

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    // fondo blanco y textos en gris oscuro
    background: "#ffffff",
    foreground: "#0f172a",
    grayscale: { hue: 220, tint: 6, shade: theme === "dark" ? -1 : -4 },
    accent: { primary: "#0f172a", level: 1 }, // puedes cambiar por tu naranja corporativo
    border: { color: "#e5e7eb" },
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
