import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Gio from 'gi://Gio';
import * as Shell from 'gi://Shell';

export default class DBusSignalNotifierExtension extends Extension {
    bus = null;
    queue_length = null;
    queue_position = null;

    enable() {
        this.bus = Gio.DBus.system;
        this.queue_length = 0;
        this.queue_position = 0;
    }

    disable() {
        // Disconnect from the dbus signal
        this.bus = null;
        this.queue_length = null;
        this.queue_position = null;
    }

    function QueueChanged(connection, sender, path, iface, signal, params) {
        const [locked] = params.recursiveUnpack();

        console.log(`Screen Locked: ${locked}`);
    }

    function ProgressChanged(connection, sender, path, iface, signal, params) {
        const [locked] = params.recursiveUnpack();

        console.log(`Screen Locked: ${locked}`);
    }

    function
}
