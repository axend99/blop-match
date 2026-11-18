import Image from 'next/image';
import logo from '@/public/brand/logo.png';

// The BLOP logo ("blop" lettering with the gradient dot), the same one used in the e-mails.
export default function BlopLogo({ className = '' }: { className?: string }) {
  return <Image src={logo} alt="BLOP" priority sizes="120px" className={`h-8 w-auto ${className}`} />;
}
