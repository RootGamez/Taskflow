import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center dark:bg-zinc-950">
      <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50">404</h1>
      <p className="mt-2 text-sm text-zinc-500">La pagina que buscas no existe.</p>
      <Link to="/dashboard" className="mt-4 text-brand-600">Volver al dashboard</Link>
    </div>
  );
}
                      