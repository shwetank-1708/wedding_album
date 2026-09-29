import LegalPolicyPage from '@/components/LegalPolicyPage';

export default function DeleteAccountPage() {
  return <LegalPolicyPage
    title="Delete Your EveBash Account"
    lastUpdated="September 28, 2026"
    description="Request deletion of your EveBash account and associated personal data, including if you no longer have the app installed."
    sections={[
      { title: 'Delete from your account', content: <p>In the EveBash mobile app, open Settings → Delete Account. On the website, sign in and open Profile → Delete Account. Follow the confirmation steps. You can request deletion even if you have an active subscription.</p> },
      { title: 'Request deletion without the app', content: <p>Email <a className="text-sky-400 underline" href="mailto:support@evebash.com?subject=EveBash%20account%20deletion%20request">support@evebash.com with the subject “EveBash account deletion request”</a>. Include the email address associated with your EveBash account, preferably sending from that address. If you use a phone account, identify that account instead. We may need to verify ownership before acting. Never send a password, payment credentials or verification code.</p> },
      { title: 'What your request covers', content: <p>Your request covers the authentication account, profile and associated personal data, including uploaded content. Certain records may need to be retained for legal obligations, billing disputes, fraud prevention or security. Backups, caches and processing systems may take additional time to clear. Contact support for the status of your request and applicable retention information. See the <a href="/privacy-policy" className="text-sky-400 underline">Privacy Policy</a> for details.</p> },
      { title: 'Subscriptions', content: <p>Deleting your account or uninstalling the app does not automatically cancel subscriptions billed by Apple or Google. Manage them through the store that billed you. See the <a href="/cancellation-refund-policy" className="text-sky-400 underline">Cancellation &amp; Refund Policy</a>. Subscription cancellation is separate from your right to request account deletion.</p> },
    ]}
  />;
}
