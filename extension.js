/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';


class Action {
    constructor() {
        this.package_id = "";
        this.app_name = "";
        this.manager_id = "";
        this.running = false;
        this.task = "";
        this.progress = 0;
        this.error = "";
        this.background = false;
    }

    notification_message() {
        switch (this.task.toLowerCase()) {
            case "install":
                return `Installing ${this.app_name}`;
            case "remove":
                return `Removing ${this.app_name}`;
            case "update":
                return `Updating ${this.app_name}`;
            case "unknown":
                return `Unknown task involving ${this.app_name}`;
            default:
                return "";
        }
    }

    static from_dict(dictionary) {
        const instance = new Action();

        for (const [key, value] of Object.entries(dictionary)) {
            switch (key) {
                case 'package_id':
                    instance.package_id = value;
                    break;
                case 'app_name':
                    instance.app_name = value;
                    break;
                case 'manager_id':
                    instance.manager_id = value;
                    break;
                case 'task':
                    instance.task = value;
                    break;
                case 'error':
                    instance.error = value;
                    break;
                case 'background':
                    instance.background = value === 'True';
                    break;
            }
        }

        return instance;
    }

    /*static from_dict(data) {
        let action = new Action();
        console.warn(data)
        action.package_id = String(data["package_id"]);
        action.app_name = String(data["app_name"]);
        action.manager_id = String(data["manager_id"]);
        action.task = String(data["task"]);
        action.background = Boolean(data["background"] !== undefined ? data["background"] : false);

        return action;
    }*/
}

const NotificationPolicy = GObject.registerClass(
class NotificationPolicy extends MessageTray.NotificationPolicy {
        get enable() { return true; }
        get enableSound() { return false; }
        get showBanners() { return true; }
        get forceExpanded() { return false; }
        get showInLockScreen() { return false; }
        get detailsInLockScreen() { return false; }
});

export default class SamGnome extends Extension {
    proxy = null;
    current_id = null;
    queue_position = 1;
    queue_length = 0;
    notification = null;
    notification_source = null;

    setNotificationSource() {
        if (!this.notification_source) {
            const notificationPolicy = new NotificationPolicy();

            this.notification_source = new MessageTray.Source({
                // The source name (e.g. application name)
                title: _("App Manager"),
                // Same as `icon`, but takes a themed icon name
                iconName: 'system-software-install-symbolic',
                // The notification policy
                policy: new NotificationPolicy,
            });

            // Reset the notification source if it's destroyed
            this.notification_source.connect('destroy', _source => {
                this.notification_source = null;
            });
            Main.messageTray.add(this.notification_source);
        }
    }

    send_notification(action) {
        this.setNotificationSource();
        let urgency = MessageTray.Urgency.NORMAL;
        if (action.background) {
            urgency = MessageTray.Urgency.LOW;
        }

        if (!(action.app_name)) {
            action.app_name = action.package_id;
        } else {
            console.warn(action.package_id, action.app_name)
        }

        this.notification = new MessageTray.Notification({
            source: this.notification_source,
            title: _(
                `${action.notification_message()} (${this.queue_position}/${this.queue_length - 1 + this.queue_position})`
            ),
            body: _(`Progress: ${action.progress}%`),
            urgency: urgency
        });
        this.notification_source.addNotification(this.notification)
    }

    get_current_action(proxy) {
        if (proxy === null) {
            return null;
        }

        let error = null;
        let queue = proxy.call_sync(
            "get_queue_actions_dict", null,
            Gio.DBusCallFlags.NONE, -1, error
        );

        console.warn(error)

        queue = queue.deep_unpack();
        this.queue_length = queue.length;

        if (queue.length !== 0) {
            console.log(queue[0])
            return Action.from_dict(queue[0][0]);  // I don't know why I need to get the first element of two nested arrays
        }
        return null;
    }

    signal_received(proxy, _senderName, signalName, _parameters) {
        console.warn(signalName)
        if (signalName === "queue_changed") {
            let action = this.get_current_action(proxy);
            if (!(action))  {
                return;
            }

            if (signalName === "queue_changed") {
                if (this.queue_length === 0) {
                    this.queue_position = 0;
                    this.current_id = null;
                } else if (!(this.current_id === action.package_id)) {
                    this.queue_position = this.queue_position + 1;
                    this.current_id = action.package_id;
                }
            }

            this.send_notification(action)
        } else if (signalName === "progress_changed") {
            if (this.notification) {
                this.notification.update(this.notification.body, _(`Progress: ${this.progress}%`));
            }

        }
    }
    enable() {
        console.warn("Enabled")
        this.proxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            "io.stillhq.SamService",
            "/io/stillhq/SamService",
            "io.stillhq.SamService",
            null
        );
        this.proxy.connect("g-signal", this.signal_received.bind(this)); console.warn("Signal Connected")
    }

    disable() {
        this.proxy = null;
        this.current_id = null;
        this.queue_position = null;
        this.queue_length = null;
        this.notification_source = null;
    }
}
