import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function TermsAndConditionsScreen() {
  return (
    <LegalPolicyScreen
      title="Terms & Conditions"
      description="These terms describe the rules for using EveBash websites, accounts, galleries, uploads, subscriptions, and related services."
      sections={[
        {
          title: 'Use of EveBash',
          paragraphs: [
            'You agree to use EveBash only for lawful purposes and to avoid uploading content that violates rights, privacy, safety, or applicable law.',
          ],
        },
        {
          title: 'Accounts and Responsibilities',
          paragraphs: [
            'You are responsible for maintaining accurate account details, protecting login access, managing event access, and ensuring that uploaded media has the required permissions.',
          ],
        },
        {
          title: 'Plans, Payments, and Billing',
          paragraphs: [
            'Paid plans provide storage, event, upload, and feature limits shown at the time of purchase. Pricing, features, and plan limits may change with notice where required.',
          ],
        },
        {
          title: 'User Content',
          paragraphs: [
            'You retain ownership of your uploaded content. You grant EveBash the limited permission needed to store, process, display, optimize, and deliver that content through the service.',
          ],
        },
        {
          title: 'Service Changes',
          paragraphs: [
            'We may update features, fix issues, add safeguards, or modify services to maintain performance, security, legal compliance, and product quality.',
          ],
        },
      ]}
    />
  );
}
