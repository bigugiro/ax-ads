/** Bloco de página ainda não implementada (preenchido no sprint correspondente). */
export function PagePlaceholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="font-display text-2xl font-extrabold">
        {titulo}
      </h1>
      <p className="mt-1 text-sm text-content-2">{descricao}</p>
      <div className="card mt-4 text-sm text-muted">
        🚀 Tá vindo — chega no próximo sprint. Bora, é logo ali.
      </div>
    </section>
  );
}
