/**
 * A device jid with its `:device`, bare meaning the primary: the form SSRCs and SRTP keys derive
 * from. The server is kept as received.
 */
export declare function toDeviceJid(jid: string): string;
/** Device 0 travels both bare and as `:0`, so device jids compare in one form. */
export declare function isSameDeviceJid(left: string, right: string): boolean;
/**
 * The key an account is matched by: user and canonical domain, device dropped. One account
 * travels bare, as `:0` and as `:76` within a single call.
 */
export declare function groupParticipantAccountKey(jid: string): string;
/** A device jid parsed into its addressed form: a bare jid names the primary and gets its `:0`. */
export declare function addressDeviceJid(jid: string): {
    readonly jid: string;
    readonly deviceId: number;
    readonly server: string;
};
/** Our device as the relay lists it among the participants, else our account jid. */
export declare function relayListedDeviceJid(ourJid: string, participantJids: readonly string[]): string;
