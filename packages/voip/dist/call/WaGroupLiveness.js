"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaGroupLiveness = void 0;
const jid_js_1 = require("../jid.js");
const group_call_js_1 = require("../signaling/group-call.js");
const call_jids_js_1 = require("./call-jids.js");
const call_state_js_1 = require("./call-state.js");
const group_participants_js_1 = require("./group-participants.js");
/** How long a connected sender may go unheard before we report it invisible; RTCP counts as heard. */
const PEER_INVISIBLE_AFTER_MS = 20000;
/** Every connected member of a group call sends the call a `<heartbeat>` this often. */
const HEARTBEAT_INTERVAL_MS = 10000;
/** How often that is checked. */
const PEER_INVISIBLE_SWEEP_MS = 5000;
/** Keeps a connected group call alive and its members' visibility honest: heartbeat and sweep. */
class WaGroupLiveness {
    constructor(options) {
        /** Since when we have been waiting on each connected group sender's media, by device. */
        this.senderWaitingSince = new Map();
        this.invisibleReported = new Set();
        this.invisibleSweep = null;
        this.heartbeatTimer = null;
        this.info = options.info;
        this.logger = options.logger;
        this.now = options.now;
        this.stanzas = options.stanzas;
        this.roster = options.roster;
        this.delegate = options.delegate;
    }
    /**
     * A group sender's media started or stopped reaching us, as the media host reports it.
     * Edge-triggered: an unchanged state is not reported again.
     */
    handleSenderMedia(senderId, receiving) {
        const participantJid = this.info.groupSenders.get(senderId);
        if (!participantJid) {
            this.logger.debug('media of an unknown group sender', {
                callId: this.info.callId,
                senderId,
                receiving
            });
            return;
        }
        const entry = (0, call_state_js_1.trackParticipantMedia)(this.info, participantJid, this.logger);
        if (entry) {
            if (entry.receiving === receiving)
                return;
            entry.receiving = receiving;
        }
        if (receiving) {
            this.senderWaitingSince.delete(participantJid);
            this.invisibleReported.delete((0, jid_js_1.groupParticipantAccountKey)(participantJid));
        }
        else {
            this.senderWaitingSince.set(participantJid, this.now());
        }
        this.delegate.emitParticipantMedia?.(this.info, participantJid, receiving);
    }
    /** Forgets what was tracked of a device that left, `key` its addressed form. */
    forget(key, deviceJid) {
        this.senderWaitingSince.delete(key);
        this.invisibleReported.delete((0, jid_js_1.groupParticipantAccountKey)(deviceJid));
    }
    /** Sends the call a `<heartbeat>` now and on every interval while this group call lasts. */
    startHeartbeat() {
        if (!this.info.isGroupCall || this.heartbeatTimer || this.info.isEnded)
            return;
        const intervalMs = this.info.voipSettings?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
        this.sendHeartbeat();
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), intervalMs);
        this.heartbeatTimer.unref?.();
        this.logger.debug('group heartbeat started', { callId: this.info.callId, intervalMs });
    }
    /** Starts checking, on a group call, for members nobody hears. */
    startSweep() {
        if (!this.info.isGroupCall || this.invisibleSweep)
            return;
        this.invisibleSweep = setInterval(() => this.sweepInvisibleSenders(), PEER_INVISIBLE_SWEEP_MS);
        this.invisibleSweep.unref?.();
    }
    /** Stops the sweep, then the heartbeat. */
    stop() {
        if (this.invisibleSweep)
            clearInterval(this.invisibleSweep);
        this.invisibleSweep = null;
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }
    /**
     * Reports invisible, once, each connected member none of whose devices was heard for
     * {@link PEER_INVISIBLE_AFTER_MS}; nobody while nobody at all is heard, our own path down.
     */
    sweepInvisibleSenders() {
        const media = this.info.participantMedia;
        if (!this.hearsAnySender())
            return;
        const selfKey = this.roster.selfAccountKey();
        const now = this.now();
        for (const participant of this.info.groupComposition?.participants ?? []) {
            if (participant.state !== group_participants_js_1.WA_CALL_PARTICIPANT_STATE.Connected)
                continue;
            const accountKey = this.roster.accountKeyOf(participant);
            if (accountKey === selfKey || this.invisibleReported.has(accountKey))
                continue;
            if (participant.devices.length === 0)
                continue;
            let silentMs = Infinity;
            for (const deviceJid of participant.devices) {
                const key = (0, call_jids_js_1.toAddressedJid)(deviceJid, this.logger);
                if (media.get(key)?.receiving === true) {
                    silentMs = -1;
                    break;
                }
                const since = this.senderWaitingSince.get(key);
                if (since === undefined)
                    this.senderWaitingSince.set(key, now);
                silentMs = Math.min(silentMs, since === undefined ? 0 : now - since);
            }
            if (silentMs < PEER_INVISIBLE_AFTER_MS)
                continue;
            this.invisibleReported.add(accountKey);
            this.reportPeerInvisible(participant.jid, silentMs);
        }
    }
    hearsAnySender() {
        for (const entry of this.info.participantMedia.values()) {
            if (entry.receiving === true)
                return true;
        }
        return false;
    }
    reportPeerInvisible(peerJid, silentMs) {
        this.logger.debug('reporting a peer invisible', {
            callId: this.info.callId,
            peerJid,
            silentMs: Math.round(silentMs)
        });
        this.stanzas.sendDetached((0, group_call_js_1.buildPeerStateStanza)(this.info.callId, this.info.callCreator, peerJid, group_call_js_1.WA_PEER_STATE.Invisible), 'peer_state send failed');
    }
    sendHeartbeat() {
        this.stanzas.sendDetached((0, group_call_js_1.buildHeartbeatStanza)(this.info.callId, this.info.callCreator), 'heartbeat send failed', 'trace');
    }
}
exports.WaGroupLiveness = WaGroupLiveness;
