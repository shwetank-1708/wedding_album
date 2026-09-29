import LegalPolicyPage from './LegalPolicyPage';
import { getPolicy, policyTextParts, type PolicySlug } from '../../shared/legal';

export default function SharedLegalPolicyPage({ slug }: { slug: PolicySlug }) {
  const policy = getPolicy(slug);
  return <LegalPolicyPage {...policy} sections={policy.sections.map(section => ({
    title: section.title,
    content: section.blocks.map((block, index) => {
      const text = policyTextParts(block.text).map((part, partIndex) => part.href
        ? <a key={partIndex} href={part.href} className="font-semibold text-sky-400 underline break-words">{part.text}</a>
        : part.text);
      if (block.kind === 'heading') return <h3 key={index} className="mt-4 font-bold">{text}</h3>;
      if (block.kind === 'bullet') return <ul key={index} className="list-disc pl-5"><li>{text}</li></ul>;
      return <p key={index}>{text}</p>;
    }),
  }))} />;
}
