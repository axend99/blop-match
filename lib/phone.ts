import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/mobile';

// WhatsApp numbers: always the "mobile" metadata, so fixed lines are rejected (client and server).

export type Country = { code: CountryCode; dial: string; label: string };

const FIRST: CountryCode[] = ['PT', 'BR'];

const flag = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

// Built on the server and passed to the form, so names and order never differ at hydration.
export function countryList(lang: string): Country[] {
  const names = new Intl.DisplayNames([lang], { type: 'region' });
  const all = getCountries().map((code) => {
    const dial = getCountryCallingCode(code);
    const name = names.of(code) ?? code;
    return { code, dial, name, label: `${flag(code)} ${name} +${dial}` };
  });
  const first = FIRST.map((code) => all.find((c) => c.code === code)!);
  const rest = all.filter((c) => !FIRST.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, lang));
  return [...first, ...rest].map(({ code, dial, label }) => ({ code, dial, label }));
}

// E.164 for a valid mobile number, else null. Accepts "+…"/"00…" (country taken from the
// number) or a national number for `country`.
export function toWhatsapp(value: string, country?: string): string | null {
  const compact = value.trim().replace(/[\s\-.()]/g, '');
  const intl = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  const parsed = intl.startsWith('+')
    ? parsePhoneNumberFromString(intl)
    : country
      ? parsePhoneNumberFromString(intl, country as CountryCode)
      : undefined;
  return parsed?.isValid() ? parsed.number : null;
}

// A typed or pasted international number ("+55…", "0055…") split into country and national
// number, to switch the selector. Undefined for national input or an unknown country.
export function splitInternational(value: string): { country: CountryCode; national: string } | undefined {
  const compact = value.trim().replace(/[\s\-.()]/g, '');
  const intl = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  if (!intl.startsWith('+')) return undefined;
  const typer = new AsYouType();
  typer.input(intl);
  const country = typer.getCountry();
  const national = typer.getNumber()?.nationalNumber;
  return country && national ? { country, national } : undefined;
}

// National number formatted while typing.
export function formatNational(value: string, country: string): string {
  return new AsYouType(country as CountryCode).input(value);
}
