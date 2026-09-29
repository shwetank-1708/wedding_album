import policies from './policies.json';

export type PolicySlug = keyof typeof policies;
export type PolicyBlock = { kind: string; text: string };
export type PolicySection = { title: string; blocks: PolicyBlock[] };
export type Policy = { title: string; description: string; lastUpdated: string; sections: PolicySection[] };

export function getPolicy(slug: PolicySlug): Policy {
  return policies[slug];
}

// Only explicit HTTPS URLs and our support address become interactive links.
export function policyTextParts(text: string) {
  return text.split(/(https:\/\/[^\s<>]+|support@evebash\.com)/g).filter(Boolean).flatMap(part => {
    if (part === 'support@evebash.com') return [{ text: part, href: `mailto:${part}` }];
    if (part.startsWith('https://')) {
      const url = part.replace(/[.,;)]+$/, '');
      const suffix = part.slice(url.length);
      return [{ text: url, href: url }, ...(suffix ? [{ text: suffix, href: undefined }] : [])];
    }
    return [{ text: part, href: undefined }];
  });
}
