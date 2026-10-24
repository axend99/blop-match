import Image from 'next/image';
import logo from '@/public/brand/logo.png';

// The BLOP logo (the Blop above the "BLOP" lettering), the same one used in the e-mails and flyers.
export default function BlopLogo({ className = '' }: { className?: string }) {
  return <Image src={logo} alt="BLOP" priority sizes="72px" className={`h-14 w-auto ${className}`} />;
}
