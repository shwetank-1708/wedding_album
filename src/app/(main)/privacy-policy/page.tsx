import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function PrivacyPolicyPage() {
  return (
    <LegalPolicyPage
      title="Privacy Policy"
      description="This policy explains how EveBash collects, uses, stores, and protects information when people use our website, event galleries, uploads, and payment features."
      sections={[
        {
          title: "Information We Collect",
          content: (
            <>
              <p>
                We may collect account details such as name, email address,
                phone number, profile details, event details, uploaded media,
                payment status, and technical information needed to operate the
                service.
              </p>
              <p>
                Payment information is processed by our payment gateway partner.
                EveBash does not store full card, UPI, or banking credentials.
              </p>
            </>
          ),
        },
        {
          title: "How We Use Information",
          content: (
            <p>
              We use information to create and manage accounts, host galleries,
              process uploads, provide storage plans, send service updates,
              prevent misuse, and improve the reliability of EveBash.
            </p>
          ),
        },
        {
          title: "Media and Gallery Content",
          content: (
            <p>
              Photos, videos, and event content are used only to provide
              gallery, storage, sharing, indexing, and media processing features
              requested by the account owner or event host.
            </p>
          ),
        },
        {
          title: "Sharing and Security",
          content: (
            <p>
              We do not sell personal information. We may share limited data
              with service providers that help us run hosting, storage,
              analytics, communication, payments, and security systems.
            </p>
          ),
        },
        {
          title: "Your Choices",
          content: (
            <p>
              You may request updates, corrections, access removal, or deletion
              of eligible account information by contacting EveBash support.
            </p>
          ),
        },
      ]}
    />
  );
}
