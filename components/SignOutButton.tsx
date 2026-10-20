import { signOut } from '@/app/auth/actions';

export default function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-full border border-midnight/20 bg-white px-3 py-1.5 text-sm font-medium text-midnight/80"
      >
        {label}
      </button>
    </form>
  );
}
