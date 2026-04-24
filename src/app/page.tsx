import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">AIA Insight</p>
        <h1>Base pronta para uma DEMO rastreavel de RAG documental.</h1>
        <p>
          O projeto comeca pela fundacao: Next.js, TypeScript, testes, banco
          local com pgvector e contratos de governanca para documentos.
        </p>
        <Link className="primary-link" href="/query">
          Acessar consulta RAG
        </Link>
      </section>
    </main>
  );
}
