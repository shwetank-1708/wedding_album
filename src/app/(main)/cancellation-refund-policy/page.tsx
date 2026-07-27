import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function CancellationRefundPolicyPage() {
  return (
    <LegalPolicyPage
      title="Cancellation & Refund Policy"
      description="This policy explains how cancellations, upgrades, downgrades, failed payments, and refund requests are handled for EveBash plans."
      sections={[
        {
          title: "Cancelling a Plan",
          content: (
            <p>
              You may cancel or stop renewal of a paid plan from your account
              settings where available, or by contacting support. Access remains
              subject to the active plan period and storage rules.
            </p>
          ),
        },
        {
          title: "Upgrades",
          content: (
            <p>
              Plan upgrades may be applied immediately after successful payment
              so the account can use the higher storage or feature limits right
              away.
            </p>
          ),
        },
        {
          title: "Downgrades",
          content: (
            <p>
              Plan downgrades are scheduled for the next billing cycle so users
              do not unexpectedly lose access to storage capacity already paid
              for in the current cycle.
            </p>
          ),
        },
        {
          title: "Refunds",
          content: (
            <p>
              Refund eligibility depends on the payment status, usage, billing
              period, and nature of the issue. Approved refunds are processed
              through the original payment method where possible.
            </p>
          ),
        },
        {
          title: "Failed or Duplicate Payments",
          content: (
            <p>
              If a payment fails, is charged twice, or does not update the
              account correctly, contact support with the payment reference so
              we can investigate and resolve it.
            </p>
          ),
        },
      ]}
    />
  );
}
