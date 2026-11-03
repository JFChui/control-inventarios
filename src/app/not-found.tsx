import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-teal-800">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Página no encontrada
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        La ruta no existe o el registro que buscas ya no está disponible.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-10 w-fit items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
