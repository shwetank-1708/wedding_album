import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function PrivacyPolicyScreen() {
  return (
    <LegalPolicyScreen
      title="Privacy Policy"
      description="This policy explains how EveBash collects, uses, stores, and protects information when people use our website, event galleries, uploads, and payment features."
      sections={[
        {
          title: 'Information We Collect',
          paragraphs: [
            'We may collect account details such as name, email address, phone number, profile details, event details, uploaded media, payment status, and technical information needed to operate the service.',
            'Payment information is processed by our payment gateway partner. EveBash does not store full card, UPI, or banking credentials.',
          ],
        },
        {
          title: 'How We Use Information',
          paragraphs: [
            'We use information to create and manage accounts, host galleries, process uploads, provide storage plans, send service updates, prevent misuse, and improve the reliability of EveBash.',
          ],
        },
        {
          title: 'Media and Gallery Content',
          paragraphs: [
            'Photos, videos, and event content are used only to provide gallery, storage, sharing, indexing, and media processing features requested by the account owner or event host.',
          ],
        },
        {
          title: 'Sharing and Security',
          paragraphs: [
            'We do not sell personal information. We may share limited data with service providers that help us run hosting, storage, analytics, communication, payments, and security systems.',
          ],
        },
        {
          title: 'Your Choices',
          paragraphs: [
            'You may request updates, corrections, access removal, or deletion of eligible account information by contacting EveBash support.',
          ],
        },
      ]}
    />
  );
}
