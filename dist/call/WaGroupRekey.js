"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaGroupRekey = void 0;
const util_1 = require("zapo-js/util");
const encryption_js_1 = require("../crypto/encryption.js");
const jid_js_1 = require("../jid.js");
const group_call_js_1 = require("../signaling/group-call.js");
const group_participants_js_1 = require("./group-participants.js");
/** The rekeys a group call's `<group_info>` asks of us: each run once, minted and fanned out. */
class WaGroupRekey {
    constructor(options) {
        /** The highest `transaction-id` whose rekey this side ran; ordered apart from rosters. */
        this.lastHonouredRekeyTransactionId = null;
        this.info = options.info;
        this.logger = options.logger;
        this.deps = options.deps;
        this.stanzas = options.stanzas;
        this.roster = options.roster;
        this.installKey = options.installKey;
    }
    /** Whether the rekey announced under `transactionId` is ours to run; records it when it is. */
    accept(transactionId) {
        const honoured = this.lastHonouredRekeyTransactionId;
        if (honoured !== null && transactionId <= honoured) {
            this.logger.debug('group rekey already answered at this transaction id or newer', {
                callId: this.info.callId,
                transactionId,
                honouredTransactionId: honoured
            });
            return false;
        }
        this.lastHonouredRekeyTransactionId = transactionId;
        return true;
    }
    /**
     * Runs the rekey a `<group_info rekey>` makes us master of: a new call key, installed and sent
     * in one `<enc_rekey>` per device of every other connected participant but `tos_not_accepted`.
     */
    async run(transactionId, listed) {
        const composition = this.info.groupComposition;
        const selfKey = this.roster.selfAccountKey();
        if (composition === undefined || selfKey === null) {
            this.logger.warn('group rekey asked of us, not run', {
                callId: this.info.callId,
                transactionId,
                reason: composition === undefined ? 'no_composition' : 'no_self_jid'
            });
            return;
        }
        const connected = composition.participants.filter((participant) => participant.state === group_participants_js_1.WA_CALL_PARTICIPANT_STATE.Connected);
        const selfConnected = connected.some((participant) => this.roster.accountKeyOf(participant) === selfKey);
        if (!selfConnected || connected.length < 2) {
            this.logger.debug('group rekey asked of us, not run', {
                callId: this.info.callId,
                transactionId,
                reason: selfConnected ? 'nobody_else_connected' : 'self_not_connected',
                connectedCount: connected.length
            });
            return;
        }
        const termsNotAccepted = new Set(listed
            .filter((participant) => participant.tosNotAccepted)
            .map((participant) => (0, jid_js_1.groupParticipantAccountKey)(participant.jid)));
        const callKey = (0, encryption_js_1.generateCallKey)();
        await this.installKey(callKey, transactionId);
        let sent = 0;
        let skipped = 0;
        let lastError = '';
        const failed = [];
        for (const participant of connected) {
            const accountKey = this.roster.accountKeyOf(participant);
            if (accountKey === selfKey)
                continue;
            if (termsNotAccepted.has(accountKey)) {
                skipped++;
                continue;
            }
            for (const deviceJid of participant.devices) {
                try {
                    const stanza = await (0, group_call_js_1.buildEncRekeyStanza)(this.deps, {
                        callId: this.info.callId,
                        callCreator: this.info.callCreator,
                        transactionId,
                        peerDeviceJid: deviceJid,
                        callKey
                    });
                    await this.stanzas.send(stanza);
                    sent++;
                }
                catch (err) {
                    failed.push(deviceJid);
                    lastError = (0, util_1.toError)(err).message;
                }
            }
        }
        if (failed.length > 0) {
            this.logger.warn('group rekey did not reach every device', {
                callId: this.info.callId,
                transactionId,
                message: lastError,
                droppedCount: failed.length,
                totalExpected: sent + failed.length,
                sample: failed.slice(0, 3)
            });
        }
        this.logger.debug('group rekey distributed', {
            callId: this.info.callId,
            transactionId,
            connectedCount: connected.length,
            sent,
            failed: failed.length,
            skipped
        });
    }
}
exports.WaGroupRekey = WaGroupRekey;
