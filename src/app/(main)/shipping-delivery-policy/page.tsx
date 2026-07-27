import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function ShippingDeliveryPolicyPage() {
  return (
    <LegalPolicyPage
      title="Shipping & Delivery Policy"
      description="EveBash is a digital service. This policy explains how digital access, gallery delivery, and media processing are handled."
      sections={[
        {
          title: "Digital Delivery",
          content: (
            <p>
              EveBash does not ship physical products by default. Gallery
              access, uploads, storage, and account features are delivered
              digitally through the website and connected apps.
            </p>
          ),
        },
        {
          title: "Access Timeline",
          content: (
            <p>
              Account and plan access is usually available shortly after signup
              or successful payment, subject to payment confirmation and system
              availability.
            </p>
          ),
        },
        {
          title: "Media Processing",
          content: (
            <p>
              Uploaded photos and videos may require processing, resizing,
              indexing, or optimization before they appear across galleries and
              dashboards.
            </p>
          ),
        },
        {
          title: "Delivery Issues",
          content: (
            <p>
              If gallery access, uploads, or plan benefits do not appear after a
              successful payment, contact support with your account email, event
              details, and payment reference.
            </p>
          ),
        },
        {
          title: "No Physical Shipping",
          content: (
            <p>
              Unless a separate physical product is explicitly offered and
              purchased, no courier, postal, or physical delivery timeline
              applies.
            </p>
          ),
        },
      ]}
    />
  );
}
