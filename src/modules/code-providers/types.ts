export type CodeMail =
  | { kind: 'login_code'; accountEmail: string | null; code: string }
  | { kind: 'travel_link'; accountEmail: string | null; verifyUrl: string; profileName: string | null };
export type DatedCodeMail = { receivedAt: string; messageId: string | null; mail: CodeMail };
type CodeService = { email: string };
type CodeProfile = { profiles: readonly string[] };
export type CodeDelivery = {
  message: 'login_code_sent' | 'travel_code_sent' | 'travel_link_sent';
  values: Record<string, string>;
  result: 'code' | 'link';
};
export interface CodeProvider {
  readonly key: string;
  readonly label: string;
  /** Logical configuration key; adapters never contain credentials. */
  readonly mailboxConfigKey: string;
  readonly kinds: readonly CodeMail['kind'][];
  parse(rawMail: { html: string }): CodeMail | null;
  belongsTo(mail: CodeMail, service: CodeService, profile: CodeProfile): boolean;
  formatDelivery(mail: CodeMail, options: { minutes: string; travelCode?: string | null }): CodeDelivery;
  recentMails(mails: readonly DatedCodeMail[], accounts: ReadonlySet<string>, kind: CodeMail['kind'],
    now: Date, maxAgeMs: number): Map<string, DatedCodeMail[]>;
  parseTravelPage(html: string): string | null;
}
