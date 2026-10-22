import pt from '@/lib/i18n/pt';

// Portuguese labels shared by the /admin pages (the admin is Portuguese only).
const CATEGORY_LABEL: Record<string, string> = pt.join.categories;

export const FLAG_CATEGORY: Record<string, string> = {
  sexual: 'sexual',
  obscene: 'obsceno',
  harassment: 'assédio/insulto',
  hate: 'ódio',
  violence: 'violência',
  self_harm: 'autolesão',
  spam: 'spam/publicidade',
  personal_data: 'dados de contacto',
  not_a_name: 'não parece um nome',
  banned_mailbox: 'variação de um e-mail banido',
  same_mailbox: 'mesma caixa de e-mail que outro perfil',
};

export const flagField = (field: string) =>
  field === 'name'
    ? 'Nome'
    : field === 'email'
      ? 'E-mail'
    : field === 'talk_about'
      ? 'Quero falar sobre'
      : field === 'review_comment'
        ? 'Comentário da review'
        : field.startsWith('other_text.')
          ? `Outro (${CATEGORY_LABEL[field.slice(11)] ?? field.slice(11)})`
          : field;

export const REPORT_REASON: Record<string, string> = pt.report.reasons;
