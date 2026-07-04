/** Bloco de página ainda não implementada (preenchido no sprint correspondente). */
export function PagePlaceholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="text-xl font-bold">
        {titulo}
      </h1>
      <p className="mt-1 text-sm text-muted">{descricao}</p>
      <div className="card mt-4 text-sm text-muted">
        🚧 Em construção — entra no sprint correspondente do plano.
      </div>
    </section>
  );
}
