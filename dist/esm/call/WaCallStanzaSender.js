import { toError } from 'zapo-js/util';
/** Sends one call's stanzas, logging a failure under its call id. */
export class WaCallStanzaSender {
    constructor(deps, logger, info) {
        this.deps = deps;
        this.logger = logger;
        this.info = info;
    }
    /** Sends a stanza, the failure left to the caller. */
    send(node) {
        return this.deps.lowLevelCoordinator.sendNode(node);
    }
    /** Sends a stanza built in the same guard, logging a failure; `false` when it failed. */
    async sendLogged(build, failure, level = 'error', context) {
        try {
            await this.deps.lowLevelCoordinator.sendNode(build());
            return true;
        }
        catch (err) {
            this.logger[level](failure, {
                callId: this.info.callId,
                ...context,
                message: toError(err).message
            });
            return false;
        }
    }
    /** Sends a stanza nobody waits on; a failure is only logged. */
    sendDetached(node, failure, level = 'warn', context) {
        void this.sendLogged(() => node, failure, level, context);
    }
}
