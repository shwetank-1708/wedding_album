import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function ShippingDeliveryPolicyScreen() {
  return (
    <LegalPolicyScreen
      title="Shipping & Delivery Policy"
      description="EveBash is a digital service. This policy explains how digital access, gallery delivery, and media processing are handled."
      sections={[
        {
          title: 'Digital Delivery',
          paragraphs: [
            'EveBash does not ship physical products by default. Gallery access, uploads, storage, and account features are delivered digitally through the website and connected apps.',
          ],
        },
        {
          title: 'Access Timeline',
          paragraphs: [
            'Account and plan access is usually available shortly after signup or successful payment, subject to payment confirmation and system availability.',
          ],
        },
        {
          title: 'Media Processing',
          paragraphs: [
            'Uploaded photos and videos may require processing, resizing, indexing, or optimization before they appear across galleries and dashboards.',
          ],
        },
        {
          title: 'Delivery Issues',
          paragraphs: [
            'If gallery access, uploads, or plan benefits do not appear after a successful payment, contact support with your account email, event details, and payment reference.',
          ],
        },
        {
          title: 'No Physical Shipping',
          paragraphs: [
            'Unless a separate physical product is explicitly offered and purchased, no courier, postal, or physical delivery timeline applies.',
          ],
        },
      ]}
    />
  );
}
