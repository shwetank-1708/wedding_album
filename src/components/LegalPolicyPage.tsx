import Link from "next/link";
import type { ReactNode } from "react";

type PolicySection = {
  title: string;
  content: ReactNode;
};

type LegalPolicyPageProps = {
  title: string;
  description: string;
  sections: PolicySection[];
};

export default function LegalPolicyPage({
  title,
  description,
  sections,
}: LegalPolicyPageProps) {
  return (
    <main className="min-h-screen bg-[var(--site-bg)] px-4 py-24 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm font-semibold text-sky-400 hover:text-sky-300"
        >
          Back to EveBash
        </Link>

        <article className="mt-6 rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-8 shadow-sm md:p-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
            EveBash Policy
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[var(--site-text)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[var(--site-muted)]">
            Last updated: July 25, 2026
          </p>
          <p className="mt-6 text-lg leading-8 text-[var(--site-subtle)]">
            {description}
          </p>

          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section
                key={section.title}
                className="border-t border-[var(--site-border)] pt-6"
              >
                <h2 className="font-serif text-2xl font-semibold text-[var(--site-text)]">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-7 text-[var(--site-subtle)]">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-10 rounded-xl bg-[var(--site-card-muted)] p-4 text-sm leading-6 text-[var(--site-muted)]">
            For questions about these policies, contact us at{" "}
            <a
              href="mailto:support@evebash.com"
              className="font-semibold text-sky-400 hover:text-sky-300"
            >
              support@evebash.com
            </a>
            .
          </p>
        </article>
      </div>
    </main>
  );
}
