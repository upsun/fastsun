/**
 * Plugin SDK for communication with parent frame
 * Handles plugin-to-parent communication and iframe resizing
 */

const PLUGIN_DEBUG = false;

export const PLUGIN_SRV_PROPS = 'PLUGINS_PROPS'; // replace with project/current
export const PLUGIN_TOPIC_VIEW_LOADED = 'VIEW_LOADED';
export const PLUGIN_TOPIC_RESIZE_IFRAME = 'PLUGINS_RESIZE_IFRAME';

export interface PluginMessage {
  action: string;
  data?: unknown;
  params?: unknown;
}

/**
 * Publisher class for publishing messages to a specific topic
 *
 * This class allows plugins to send messages to the parent frame.
 * It can be used to send structured data, such as configuration changes,
 * state updates, or any other information that needs to be communicated.
 * The message can be a string, number, boolean, or an object.
 * If the message is an object, it will be stringified before sending.
 * This is useful for sending structured data to the parent frame.
 */
export class Publisher {
  /**
   * Creates an instance of the Publisher class.
   * @param node PluginSDK instance
   * @param topic The topic to publish messages to
   */
  constructor(
    private readonly node: PluginSDK,
    public readonly topic: string,
  ) {
    console.log(`SDK > Bus > Create Publisher of topic: ${this.topic}`);
    this.node.publishers.push(this);
  }

  /**
   * Publishes a message to the specified topic.
   * If the message is an object, it will be stringified before sending.
   * This is useful for sending structured data to the parent frame.
   * @param message The message to publish
   */
  public publish(message: unknown): void {
    let displayData = message;
    if (typeof message === 'object') {
      displayData = JSON.stringify(message);
    }
    console.log(`SDK > Bus > Publish to topic: ${this.topic} with data: ${displayData}`);

    parent.postMessage({ action: this.topic, data: message } as PluginMessage, '*');
  }

  /**
   * Unsubscribe (destroy) this publisher and remove it from the list
   */
  public destroy(): void {
    console.log(`SDK > Bus > Destroy publisher of topic: ${this.topic}`);
    const index = this.node.publishers.indexOf(this);
    if (index > -1) {
      this.node.publishers.splice(index, 1);
    }
  }
}

/**
 * Subscription class for subscribing to a specific topic
 * and handling incoming messages.
 * When a message is received, the callback function is invoked with the data.
 * This allows plugins to react to events or data changes from the parent frame.
 */
export class Subscription {
  /**
   * Creates an instance of the Subscription class.
   *
   * @param node PluginSDK instance
   * @param topic The topic to subscribe to
   * @param callback The callback function to invoke when a message is received
   */
  constructor(
    private readonly node: PluginSDK,
    public readonly topic: string,
    public readonly callback: (data: unknown) => void,
  ) {
    console.log(`SDK > Bus > Create Subscription of topic: ${this.topic}`);
    this.node.subscriptions.push(this);
  }

  /**
   * Unsubscribe (destroy) this subscription and remove it from the list
   */
  public destroy(): void {
    console.log(`SDK > Bus > Unsubscribe from topic: ${this.topic}`);
    const index = this.node.subscriptions.indexOf(this);
    if (index > -1) {
      this.node.subscriptions.splice(index, 1);
    }
  }

  /**
   * Notifies the subscriber with the received data.
   * This method is called when a message is received on the subscribed topic.
   * It invokes the callback function with the data.
   *
   * @param data The data received from the parent frame
   */
  notify(data: unknown): void {
    if (PLUGIN_DEBUG) {
      console.log(`SDK > Bus > Debug > Notify from topic: ${this.topic} with data:`, data);
    }
    this.callback(data);
  }
}

export class Service {}

export class Client {
  private pubSrv: Publisher;
  public subSrv: Subscription;
  private pendingRequests: Map<number, (data: unknown) => void> = new Map();

  constructor(
    private readonly node: PluginSDK,
    public readonly topic: string,
  ) {
    console.log(`SDK > Bus > Create Client of topic: ${this.topic}`);
    this.node.clients.push(this);

    this.pubSrv = this.node.createPublisher(`${this.topic}_REQ`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.subSrv = this.node.createSubscription(`${this.topic}_RES`, (response: any) => {
      const reqId = response?.reqId;

      if (PLUGIN_DEBUG) {
        console.log(`SDK > Bus > Debug > Is service callback with id: ${reqId} `);
      }

      if (reqId !== undefined && this.pendingRequests.has(reqId)) {
        const resolve = this.pendingRequests.get(reqId)!;
        resolve(response);
        this.pendingRequests.delete(reqId);
      }
    });
  }

  public sendRequest(reqId: number, data: unknown): Promise<unknown> {
    if (PLUGIN_DEBUG) {
      console.log(`SDK > Bus > Debug > Send request to service_topic: ${this.topic} with data:`, data);
    }
    return new Promise((resolve) => {
      this.pendingRequests.set(reqId, resolve);
      this.pubSrv.publish({ reqId, data });
    });
  }

  /**
   * Unsubscribe (destroy) this client and remove it from the list
   */
  public destroy(): void {
    console.log(`SDK > Bus > Destroy client`);
    const index = this.node.clients.indexOf(this);
    if (index > -1) {
      this.node.clients.splice(index, 1);
    }
    this.subSrv.destroy();
    this.pendingRequests.clear();
  }
}

/**
 * PluginSDK class for managing publishers, subscriptions, and services
 * Handles communication with the parent frame and iframe resizing
 */
export class PluginSDK {
  subscriptions: Subscription[] = [];
  publishers: Publisher[] = [];
  services: Service[] = [];
  clients: Client[] = [];

  // Internal resources
  pubHeight: Publisher; // Publisher for iframe height resizing
  frmHeight: number = 0; // Current iframe height
  resizeObserver: ResizeObserver | null = null;

  constructor() {
    this._initializeMessageListener();

    // Internal resources
    this.pubHeight = this.createPublisher(PLUGIN_TOPIC_RESIZE_IFRAME);
    this._initializeResizeObserver();
  }

  /**
   * Create a new publisher for a specific topic
   * @param topic The topic to publish messages to
   */
  public createPublisher(topic: string): Publisher {
    return new Publisher(this, topic);
  }

  /**
   * Create a new subscription for a specific topic
   * @param topic The topic to subscribe to
   * @param callback The callback function to invoke when a message is received
   */
  public createSubscription(topic: string, callback: (data: unknown) => void): Subscription {
    return new Subscription(this, topic, callback);
  }

  public createClient(topic: string): Client {
    return new Client(this, topic);
  }

  /**
   * Destroy the PluginSDK instance and clean up resources
   */
  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.subscriptions.length = 0;
    this.publishers.length = 0;
    this.services.length = 0;
    this.clients.length = 0;

    console.log('SDK > PluginSDK destroyed and resources cleaned up.');
  }

  /**
   * Initialize message listener for parent communication
   */
  private _initializeMessageListener(): void {
    console.log('SDK > Bus > Listen subscriptions topics...');

    const handleMessage = (event: MessageEvent) => {
      // Security check - only accept messages from plugins.pltfrm.sh
      //if (!event.origin.endsWith('plugins.pltfrm.sh')) return;

      const { action, data, params } = (event.data as PluginMessage) || {};
      if (!action) return;
      if (PLUGIN_DEBUG) {
        console.log('SDK > Bus > Debug > Receive subscribed topic:', action, 'with data:', data, 'and params:', params);
      }

      // Check if we have handlers for this action
      const subscriptions = this.subscriptions.filter((sub) => sub.topic === action);
      if (subscriptions.length > 0) {
        let displayData = data;
        if (typeof data === 'object') {
          displayData = JSON.stringify(data);
        }
        console.log(
          `SDK > Bus > Receive on subscription topic: ${action}, with data: ${displayData}, and params: ${params}`,
        );

        subscriptions.forEach((subscription) => {
          subscription.notify(data || params);
        });
      }
    };

    window.addEventListener('message', handleMessage);
  }

  //// Resize stack ////

  /**
   * Send height information to parent for iframe resizing
   */
  private _sendHeightToParent(): void {
    console.log('SDK > iframe > Resize window triggered, sending height to parent');
    const height = document.documentElement.scrollHeight;
    if (this.frmHeight === height) {
      console.log('SDK > iframe > Height is unchanged, skipping publish');
    } else {
      this.frmHeight = height;
      this.pubHeight.publish(height);
    }
  }

  /**
   * Initialize resize observer to automatically adjust iframe height
   */
  private _initializeResizeObserver(): void {
    console.log('SDK > iframe > Initialize ResizeObserver for iframe height adjustment');

    this.resizeObserver = new ResizeObserver(() => {
      this._sendHeightToParent();
    });

    // Observe document body for changes
    if (document.body) {
      this.resizeObserver.observe(document.body);
    }

    // Send initial height when DOM is loaded
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => {
        this._sendHeightToParent();
      });
    } else {
      // DOM is already loaded
      setTimeout(() => this._sendHeightToParent(), 0);
    }
  }
}

///// Plugin SDK Composable /////

// Singleton instance
let pluginSDKInstance: PluginSDK | null = null;

/**
 * Get the singleton instance of PluginSDK
 */
export function getPluginSDK(): PluginSDK {
  if (!pluginSDKInstance) {
    pluginSDKInstance = new PluginSDK();
  }
  return pluginSDKInstance;
}

/**
 * Vue composable for using the Plugin SDK
 */
export function usePluginSDK() {
  const sdk = getPluginSDK();

  return {
    // publish: (topic: string, message: unknown) => sdk.publish2console(topic, message),
    // subscribe: (topic: string, callback: (data: unknown) => void) => sdk.subscribe2console(topic, callback),
    // unsubscribe: (topic: string) => sdk.unsubscribe2console(topic),
    // sendHeight: () => sdk._sendHeightToParent(),
    sdk,
  };
}
