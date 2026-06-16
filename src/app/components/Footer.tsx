import Image from "next/image";
import Link from "next/link";

import styles from "./Footer.module.css";

const FOOTER_NAV = [
  { href: "/query", label: "Consulta" },
  { href: "/ingestion", label: "Ingestão" },
  { href: "/indexing", label: "Indexação" },
] as const;

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Image
            src="/logo-petrobras.png"
            alt="Petrobras"
            width={148}
            height={44}
            className={styles.logo}
            priority={false}
          />
          <p className={styles.tagline}>
            Projeto de pesquisa apoiado pela Petrobras.
          </p>
        </div>

        <nav className={styles.nav} aria-label="Navegação do rodapé">
          <span className={styles.navTitle}>Plataforma</span>
          <ul className={styles.navList}>
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link className={styles.navLink} href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
