"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeWAMessage = encodeWAMessage;
exports.decryptCallKey = decryptCallKey;
exports.encryptCallKeyForDevices = encryptCallKeyForDevices;
exports.deviceIdentityNode = deviceIdentityNode;
const zapo_js_1 = require("zapo-js");
const proto_1 = require("zapo-js/proto");
const protocol_1 = require("zapo-js/protocol");
const transport_1 = require("zapo-js/transport");
const util_1 = require("zapo-js/util");
async function encodeWAMessage(message) {
    return (0, zapo_js_1.writeRandomPadMax16)(proto_1.proto.Message.encode(message).finish());
}
function encodeSignedDeviceIdentity(account) {
    return proto_1.proto.ADVSignedDeviceIdentity.encode(account).finish();
}
async function decryptCallKey(deps, node, peerJid, logger) {
    const log = logger ?? (0, zapo_js_1.createNoopLogger)();
    const isEnc = (child) => child.tag === 'enc' && !!child.attrs?.type;
    const encNodes = (0, transport_1.getNodeChildren)(node).filter(isEnc);
    const destinationNode = (0, transport_1.findNodeChild)(node, 'destination');
    if (destinationNode) {
        for (const toNode of (0, transport_1.getNodeChildren)(destinationNode)) {
            if (toNode.tag === 'to') {
                encNodes.push(...(0, transport_1.getNodeChildren)(toNode).filter(isEnc));
            }
        }
    }
    const address = (0, protocol_1.parseSignalAddressFromJid)(peerJid);
    for (const encNode of encNodes) {
        if (!(encNode.content instanceof Uint8Array)) {
            continue;
        }
        try {
            const decrypted = await deps.signalProtocol.decryptMessage(address, {
                type: encNode.attrs.type,
                ciphertext: encNode.content
            });
            const message = proto_1.proto.Message.decode((0, zapo_js_1.unpadPkcs7)(decrypted));
            const callKey = message.call?.callKey;
            if (callKey && callKey.length === 32) {
                return callKey;
            }
        }
        catch (err) {
            log.trace('call key decrypt candidate failed', { message: (0, util_1.toError)(err).message });
        }
    }
    return undefined;
}
/**
 * Encrypts a call key for each device under `<enc v='2' type count='0'>`: a 1:1 offer wraps
 * each in a `<to>`, an `<enc_rekey>` carries one directly.
 *
 * @throws for the whole batch when a device has no Signal session.
 */
async function encryptCallKeyForDevices(deps, devices, callKey) {
    const resolved = await deps.sessionResolver.ensureSessionsBatch(devices);
    const plaintext = await encodeWAMessage({ call: { callKey } });
    const encrypted = await deps.signalProtocol.encryptMessagesBatch(devices.map((jid) => ({ address: (0, protocol_1.parseSignalAddressFromJid)(jid), plaintext })), resolved.map((target) => ({ address: target.address, session: target.session })));
    return {
        encNodes: encrypted.map((entry) => ({
            tag: 'enc',
            attrs: { v: '2', type: entry.type, count: '0' },
            content: entry.ciphertext
        })),
        shouldIncludeDeviceIdentity: encrypted.some((entry) => entry.type === 'pkmsg')
    };
}
/** `<device-identity>` of our account, sent beside a `pkmsg` key. */
function deviceIdentityNode(signedIdentity) {
    return {
        tag: 'device-identity',
        attrs: {},
        content: encodeSignedDeviceIdentity(signedIdentity)
    };
}
