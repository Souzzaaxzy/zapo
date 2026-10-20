"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRelayEndpoints = extractRelayEndpoints;
exports.buildRelayLatencyStanza = buildRelayLatencyStanza;
exports.buildTransportStanza = buildTransportStanza;
const protocol_1 = require("zapo-js/protocol");
const transport_1 = require("zapo-js/transport");
const call_stanza_js_1 = require("./call-stanza.js");
function toRelayEndpoint(node) {
    const relay = {
        ip: node.attrs?.ip || '',
        port: parseInt(node.attrs?.port || '3480', 10),
        token: node.attrs?.token || '',
        key: node.attrs?.['relay-key'] || node.attrs?.key || '',
        relayId: parseInt(node.attrs?.['relay-id'] || '0', 10),
        c2rRtt: node.attrs?.['c2r-rtt'] ? parseInt(node.attrs['c2r-rtt'], 10) : undefined
    };
    return relay.ip && relay.token ? relay : null;
}
function extractRelayEndpoints(node) {
    const relayNodes = [...(0, transport_1.getNodeChildrenByTag)(node, 'relay')];
    for (const wrapper of (0, transport_1.getNodeChildrenByTag)(node, 'relays')) {
        relayNodes.push(...(0, transport_1.getNodeChildrenByTag)(wrapper, 'relay'));
    }
    const relays = [];
    for (const relayNode of relayNodes) {
        const relay = toRelayEndpoint(relayNode);
        if (relay) {
            relays.push(relay);
        }
    }
    relays.sort((a, b) => (a.c2rRtt ?? Infinity) - (b.c2rRtt ?? Infinity));
    return relays;
}
function buildRelayLatencyStanza(peerJid, callId, callCreator, relays, destinationJids) {
    const seenRelays = new Set();
    const teNodes = [];
    for (const relay of relays) {
        if (!relay.relayName || seenRelays.has(relay.relayName))
            continue;
        seenRelays.add(relay.relayName);
        const encodedLatency = 0x2000000 + (relay.latency || 0);
        teNodes.push({
            tag: 'te',
            attrs: {
                latency: String(encodedLatency),
                relay_name: relay.relayName
            },
            content: relay.addressBytes || undefined
        });
    }
    if (destinationJids.length > 0) {
        teNodes.push({
            tag: 'destination',
            attrs: {},
            content: destinationJids.map((jid) => ({ tag: 'to', attrs: { jid } }))
        });
    }
    return (0, call_stanza_js_1.callStanza)((0, protocol_1.toUserJid)(peerJid), 'relaylatency', callId, callCreator, undefined, teNodes);
}
function buildTransportStanza(peerJid, callId, callCreator, messageType = '0', p2pCandRound = '0') {
    return (0, call_stanza_js_1.callStanza)(peerJid, 'transport', callId, callCreator, { 'transport-message-type': messageType, 'p2p-cand-round': p2pCandRound }, [{ tag: 'net', attrs: { medium: '2', protocol: '0' } }]);
}
