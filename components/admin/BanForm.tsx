import { ban } from '@/app/admin/actions';

// "Banir" behind a details toggle and a required confirmation box (checked on the server too).
export default function BanForm({ participantId, name }: { participantId: string; name: string }) {
  return (
    <details className="text-sm">
      <summary className="inline-block cursor-pointer rounded-full border border-red-700 px-3 py-1 font-semibold text-red-700">
        Banir…
      </summary>
      <form action={ban} className="mt-2 space-y-2 rounded-xl bg-pink/30 p-3">
        <input type="hidden" name="participantId" value={participantId} />
        <input name="reason" maxLength={200} placeholder="Motivo (opcional, só para a equipa)" className="w-full rounded-lg border border-midnight/15 bg-white px-3 py-2" />
        <label className="flex items-start gap-2">
          <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-4 accent-red-700" />
          <span>
            Confirmo que quero banir <b>{name}</b>: o e-mail fica bloqueado e a conta, os matches dela (e as reviews desses
            matches, também as da outra pessoa) são apagados. Não dá para desfazer.
          </span>
        </label>
        <button className="rounded-full bg-red-700 px-4 py-2 font-semibold text-white">Banir definitivamente</button>
      </form>
    </details>
  );
}
