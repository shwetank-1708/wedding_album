import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function TermsAndConditionsPage() {
  return (
    <LegalPolicyPage
      title="Terms & Conditions"
      description="These terms describe the rules for using EveBash websites, accounts, galleries, uploads, subscriptions, and related services."
      sections={[
        {
          title: "Use of EveBash",
          content: (
            <p>
              You agree to use EveBash only for lawful purposes and to avoid
              uploading content that violates rights, privacy, safety, or
              applicable law.
            </p>
          ),
        },
        {
          title: "Accounts and Responsibilities",
          content: (
            <p>
              You are responsible for maintaining accurate account details,
              protecting login access, managing event access, and ensuring that
              uploaded media has the required permissions.
            </p>
          ),
        },
        {
          title: "Plans, Payments, and Billing",
          content: (
            <p>
              Paid plans provide storage, event, upload, and feature limits
              shown at the time of purchase. Pricing, features, and plan limits
              may change with notice where required.
            </p>
          ),
        },
        {
          title: "User Content",
          content: (
            <p>
              You retain ownership of your uploaded content. You grant EveBash
              the limited permission needed to store, process, display,
              optimize, and deliver that content through the service.
            </p>
          ),
        },
        {
          title: "Service Changes",
          content: (
            <p>
              We may update features, fix issues, add safeguards, or modify
              services to maintain performance, security, legal compliance, and
              product quality.
            </p>
          ),
        },
      ]}
    />
  );
}
