import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-2 font-display text-5xl font-bold tracking-[-0.02em] text-foreground">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">La página que buscás no existe.</p>
      <Link
        to="/dashboard"
        className="mt-5 border-2 border-foreground bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-hard transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5"
      >
        Volver al dashboard
      </Link>
    </div>
  );
}
