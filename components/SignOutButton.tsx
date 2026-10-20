import { signOut } from '@/app/auth/actions';

export default function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm font-medium text-neutral-500 underline">
        {label}
      </button>
    </form>
  );
}
