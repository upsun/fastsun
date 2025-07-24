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
    console.log(`SDK > Bus > Unsubscribe and destroy of topic: ${this.topic}`);
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

export class Service {
  destroy() {
    throw new Error('Method not implemented.');
  }
}

/**
 * Client class for sending requests to a service and receiving responses
 * This class allows plugins to communicate with services by sending requests
 * and receiving responses asynchronously.
 * It manages request IDs to match requests with their corresponding responses.
 */
export class Client {
  private pubSrv: Publisher;
  public subSrv: Subscription;
  private pendingRequests: Map<number, (data: unknown) => void> = new Map();

  /**
   * Creates a new client for a specific service topic.
   * This client can send requests to the service and handle responses.
   * It maintains a map of pending requests to match responses with their requests.
   * The topic is used to identify the service this client communicates with.
   * @param node PluginSDK instance
   * @param topic The topic for the service
   */
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
        console.log(`SDK > Bus > Debug > Is service_topic callback with id: ${reqId} `);
      }

      if (reqId !== undefined && this.pendingRequests.has(reqId)) {
        const resolve = this.pendingRequests.get(reqId)!;
        resolve(response);
        this.pendingRequests.delete(reqId);
      }
    });
  }

  /**
   * Sends a request to the service and returns a promise that resolves with the response data.
   * @param reqId Unique request ID to match the response
   * @param data The data to send with the request
   * @returns A promise that resolves with the response data
   */
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
    console.log(`SDK > Bus > Destroy client of service_topic: ${this.topic}`);
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
  readonly subscriptions: Subscription[] = [];
  readonly publishers: Publisher[] = [];
  readonly services: Service[] = [];
  readonly clients: Client[] = [];

  // Internal resources
  private readonly pubHeight: Publisher; // Publisher for iframe height resizing
  private readonly resizeObserver: ResizeObserver;
  private frmHeight: number = 0; // Current iframe height

  constructor() {
    this._initializeMessageListener();

    // Internal resources
    this.pubHeight = this.createPublisher(PLUGIN_TOPIC_RESIZE_IFRAME);
    this.resizeObserver = new ResizeObserver(() => {
      this._sendHeightToParent();
    });

    this._startResizeObserver();
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

  /**
   * Creates a new client instance for the specified topic.
   * This client can be used to handle specific functionality or data processing.
   * Clients can be used to encapsulate logic that plugins can interact with.
   * @param topic The topic for the client
   * @returns A new client instance
   */
  public createClient(topic: string): Client {
    return new Client(this, topic);
  }

  /**
   * Destroy the PluginSDK instance and clean up resources
   */
  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Helper to destroy and clear an array of items with a destroy method
    const destroyAll = <T extends { destroy: () => void }>(arr: T[]) => {
      for (const item of arr) {
        item.destroy();
      }
      arr.length = 0;
    };

    destroyAll(this.subscriptions);
    destroyAll(this.publishers);
    destroyAll(this.clients);
    destroyAll(this.services);

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
  private _startResizeObserver(): void {
    console.log('SDK > iframe > Initialize ResizeObserver for iframe height adjustment');

    if (document.body) {
      // Observe document body for changes
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
    sdk,
  };
}
