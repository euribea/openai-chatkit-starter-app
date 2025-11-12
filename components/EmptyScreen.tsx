import { GREETING } from "@/lib/config";

export default function EmptyScreen() {
  return (
    <div className="ck-empty">
      {/* título pequeño arriba (sticky-like) */}
      <div className="ck-empty-top">
        {GREETING}
      </div>

      {/* saludo grande centrado */}
      <h1 className="ck-empty-title">
        {GREETING}
      </h1>
    </div>
  );
}
