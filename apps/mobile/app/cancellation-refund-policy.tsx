import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function CancellationRefundPolicyScreen() {
  return (
    <LegalPolicyScreen
      title="Cancellation & Refund Policy"
      description="This policy explains how cancellations, upgrades, downgrades, failed payments, and refund requests are handled for EveBash plans."
      sections={[
        {
          title: 'Cancelling a Plan',
          paragraphs: [
            'You may cancel or stop renewal of a paid plan from your account settings where available, or by contacting support. Access remains subject to the active plan period and storage rules.',
          ],
        },
        {
          title: 'Upgrades',
          paragraphs: [
            'Plan upgrades may be applied immediately after successful payment so the account can use the higher storage or feature limits right away.',
          ],
        },
        {
          title: 'Downgrades',
          paragraphs: [
            'Plan downgrades are scheduled for the next billing cycle so users do not unexpectedly lose access to storage capacity already paid for in the current cycle.',
          ],
        },
        {
          title: 'Refunds',
          paragraphs: [
            'Refund eligibility depends on the payment status, usage, billing period, and nature of the issue. Approved refunds are processed through the original payment method where possible.',
          ],
        },
        {
          title: 'Failed or Duplicate Payments',
          paragraphs: [
            'If a payment fails, is charged twice, or does not update the account correctly, contact support with the payment reference so we can investigate and resolve it.',
          ],
        },
      ]}
    />
  );
}
