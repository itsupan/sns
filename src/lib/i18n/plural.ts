/** A message's plural forms; `other` stands in for any form the message leaves out. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Picks the form of a message for `count` by the plural rules of `locale`. */
export function pluralFor(locale: string): (count: number, forms: PluralForms) => string {
	const rules = new Intl.PluralRules(locale);
	return (count, forms) => forms[rules.select(count)] ?? forms.other;
}
