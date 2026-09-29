import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';
import { getPolicy } from '../../../shared/legal';

export default function PolicyScreen() {
  return <LegalPolicyScreen {...getPolicy('digital-service-delivery-policy')} />;
}
