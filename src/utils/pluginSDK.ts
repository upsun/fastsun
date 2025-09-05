/**
 * Plugin SDK for communication with Upsun console
 *
 * This SDK provides a comprehensive communication layer for plugins running in iframes
 * to interact with the Upsun console. It handles:
 * - Bidirectional messaging between plugin and Upsun console
 * - Automatic iframe height adjustment
 * - Type-safe client-server communication patterns
 * - Resource cleanup and memory leak prevention
 *
 * @author Platform.sh Activation Team
 * @version 1.0.0
 * @since 2025
 */

/**
 * Debug flag for development - set to true to enable detailed logging
 * In production, this should be set to false to reduce console noise
 */
const PLUGIN_DEBUG = true;

/**
 * Standard plugin service topics used for communication
 * These constants ensure consistent topic naming across the platform
 */
export const PLUGIN_SRV_PROPS = 'PLUGINS_PROPS'; // replace with project/current
export const PLUGIN_SRV_URL = 'PLUGINS_URL_PARAMS';
export const PLUGIN_TOPIC_URL = 'PLUGINS_URL_PARAMS_SET';
export const PLUGIN_TOPIC_VIEW_LOADED = 'VIEW_LOADED';
export const PLUGIN_TOPIC_RESIZE_IFRAME = 'PLUGINS_RESIZE_IFRAME';

/**
 * Interface representing project properties passed to plugins
 * Contains essential project context information
 */
interface ProjectProps {
  /** Unique identifier for the project */
  projectId: string;
  /** Unique identifier for the environment within the project */
  environmentId: string;
  /** Unique identifier for the organization */
  organizationId: string;
  /** Theme identifier of Upsun console */
  theme: string;
}

/**
 * Base interface for all plugin messages sent via postMessage API
 * All communication between plugin and Upsun console uses this structure
 */
export interface PluginMessage {
  /** The action type or topic identifier */
  action: string;
  /** Optional data payload of any type */
  data?: unknown;
  /** Optional parameters for the message */
  params?: unknown;
}

/**
 * Interface for service messages used in client-server communication
 * Ensures all service messages have a request ID for proper response matching
 *
 * @template T The type of data being sent/received
 */
export interface ServiceMessage<T = unknown> {
  /** Unique request identifier for matching requests with responses */
  reqId: number;
  /** Optional data payload of the specified type */
  data?: T;
}

/**
 * Base interface for all client implementations
 * Provides a common contract for type-safe client management
 */
export interface ClientBase {
  /** The topic this client communicates on */
  readonly topic: string;
  /** Cleanup method to prevent memory leaks */
  destroy(): void;
}

/**
 * Publisher class for publishing messages to the Upsun console
 *
 * This class provides a one-way communication channel for sending structured
 * messages from the plugin to the Upsun console via postMessage API.
 * Each publisher is associated with a specific topic for organized messaging.
 *
 * The publisher automatically handles:
 * - JSON serialization of complex objects
 * - Logging for debugging purposes
 * - Cleanup and resource management
 * - Integration with the PluginBus system
 *
 * @example
 * ```typescript
 * const publisher = pluginBus.createPublisher('MY_TOPIC');
 *
 * // Send simple data
 * publisher.publish('Hello World');
 *
 * // Send complex objects (automatically stringified)
 * publisher.publish({ userId: 123, action: 'login' });
 *
 * // Clean up when done
 * publisher.destroy();
 * ```
 */
export class Publisher {
  /**
   * Creates an instance of the Publisher class.
   *
   * Publishers are typically created through PluginBus.createPublisher()
   * rather than instantiated directly to ensure proper lifecycle management.
   *
   * @param node PluginBus instance that manages this publisher
   * @param topic The topic identifier for message routing
   */
  constructor(
    private readonly node: PluginBus,
    public readonly topic: string,
  ) {
    console.log(`SDK > Bus > Create Publisher of topic: ${this.topic}`);
    this.node.publishers.push(this);
  }

  /**
   * Publishes a message to the Upsun console on this publisher's topic.
   *
   * The message is sent via postMessage API and can contain any serializable data.
   * Objects are automatically stringified for logging purposes but sent as-is
   * to preserve type information for the Upsun console.
   *
   * @param message The data to publish - can be any serializable type
   *
   * @example
   * ```typescript
   * // Send simple values
   * publisher.publish('status_update');
   * publisher.publish(42);
   * publisher.publish(true);
   *
   * // Send complex objects
   * publisher.publish({
   *   event: 'user_action',
   *   payload: { userId: 123, timestamp: Date.now() }
   * });
   * ```
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
   * Destroys this publisher and removes it from the PluginBus registry.
   *
   * This method should be called when the publisher is no longer needed
   * to prevent memory leaks and ensure proper cleanup. After calling destroy(),
   * the publisher should not be used for publishing messages.
   *
   * The method is automatically called during PluginBus.destroy() but can
   * be called manually for individual publisher cleanup.
   *
   * @example
   * ```typescript
   * const publisher = pluginBus.createPublisher('TEMP_TOPIC');
   * publisher.publish('one-time message');
   * publisher.destroy(); // Clean up immediately after use
   * ```
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
 * Subscription class for receiving messages from the Upsun console
 *
 * This class provides a way for plugins to listen to specific topics and
 * react to incoming messages from the Upsun console. When a message is received
 * on the subscribed topic, the provided callback function is invoked.
 *
 * The subscription automatically handles:
 * - Message filtering by topic
 * - Error handling in user callbacks (prevents crashes)
 * - Debug logging for development
 * - Cleanup and resource management
 *
 * @example
 * ```typescript
 * // Create a subscription to listen for configuration changes
 * const subscription = pluginBus.createSubscription('CONFIG_UPDATE', (data) => {
 *   console.log('Configuration updated:', data);
 *   updatePluginConfig(data);
 * });
 *
 * // Clean up when no longer needed
 * subscription.destroy();
 * ```
 */
export class Subscription {
  /**
   * Creates an instance of the Subscription class.
   *
   * Subscriptions are typically created through PluginBus.createSubscription()
   * rather than instantiated directly to ensure proper integration with the
   * message handling system.
   *
   * @param node PluginBus instance that manages this subscription
   * @param topic The topic identifier to listen for
   * @param callback Function to call when messages are received on this topic.
   *                 This function is wrapped with error handling to prevent crashes.
   */
  constructor(
    private readonly node: PluginBus,
    public readonly topic: string,
    public readonly callback: (data: unknown) => void,
  ) {
    console.log(`SDK > Bus > Create Subscription of topic: ${this.topic}`);
    this.node.subscriptions.push(this);
  }

  /**
   * Destroys this subscription and removes it from the PluginBus registry.
   *
   * This method should be called when the subscription is no longer needed
   * to prevent memory leaks and stop receiving unwanted messages. After
   * calling destroy(), the subscription will no longer receive messages.
   *
   * The method is automatically called during PluginBus.destroy() but can
   * be called manually for individual subscription cleanup.
   *
   * @example
   * ```typescript
   * const subscription = pluginBus.createSubscription('TEMP_TOPIC', handler);
   * // ... later when no longer needed
   * subscription.destroy();
   * ```
   */
  public destroy(): void {
    console.log(`SDK > Bus > Unsubscribe and destroy of topic: ${this.topic}`);
    const index = this.node.subscriptions.indexOf(this);
    if (index > -1) {
      this.node.subscriptions.splice(index, 1);
    }
  }

  /**
   * Notifies the subscriber with received data from the Upsun console.
   *
   * This method is called internally by the PluginBus when a message is received
   * on this subscription's topic. It safely invokes the user-provided callback
   * function with proper error handling to prevent uncaught exceptions from
   * crashing the plugin.
   *
   * Error handling ensures that:
   * - Exceptions in user callbacks don't break the SDK
   * - Other subscriptions continue to work even if one fails
   * - Errors are logged for debugging purposes
   *
   * @param data The data received from the Upsun console
   * @internal This method is called automatically by the message handling system
   *
   * @example
   * ```typescript
   * // This is called automatically when messages arrive:
   * // subscription.notify(receivedData);
   *
   * // User callback receives the data:
   * const subscription = pluginBus.createSubscription('TOPIC', (data) => {
   *   // This function is called via notify()
   *   console.log('Received:', data);
   * });
   * ```
   */
  notify(data: unknown): void {
    if (PLUGIN_DEBUG) {
      console.log(`SDK > Bus > Debug > Notify from topic: ${this.topic} with data:`, data);
    }

    try {
      this.callback(data);
    } catch (error) {
      console.error(`SDK > Bus > Error in subscription callback for topic ${this.topic}:`, error);
    }
  }
}

/**
 * Base Service class for implementing plugin services
 *
 * This abstract base class provides a foundation for creating services within
 * the plugin system. Services represent reusable components that can handle
 * specific functionality, process data, or manage state.
 *
 * All concrete service implementations should extend this class and implement
 * their specific functionality while ensuring proper cleanup in the destroy method.
 *
 * @example
 * ```typescript
 * class DataProcessingService extends Service {
 *   private timer: number | null = null;
 *
 *   constructor() {
 *     super();
 *     this.timer = setInterval(this.processData, 1000);
 *   }
 *
 *   private processData = () => {
 *     // Process data logic here
 *   }
 *
 *   public destroy(): void {
 *     if (this.timer) {
 *       clearInterval(this.timer);
 *       this.timer = null;
 *     }
 *     super.destroy(); // Call parent cleanup
 *   }
 * }
 * ```
 */
export class Service {
  /**
   * Destroys this service instance and cleans up resources.
   *
   * This is a base implementation that provides basic cleanup logging.
   * Concrete service implementations should override this method to:
   * - Clean up timers, intervals, and event listeners
   * - Close connections and clear resources
   * - Cancel pending operations
   * - Call super.destroy() for base cleanup
   *
   * This method is automatically called during PluginBus.destroy() but can
   * be called manually for individual service cleanup.
   *
   * @example
   * ```typescript
   * class MyService extends Service {
   *   public destroy(): void {
   *     // Clean up service-specific resources
   *     this.cleanup();
   *
   *     // Always call parent destroy
   *     super.destroy();
   *   }
   * }
   * ```
   */
  public destroy(): void {
    // Default implementation - concrete services should override this
    console.log('SDK > Service > Base service destroyed');
  }
}

/**
 * Client class for request-response communication with Upsun console services
 *
 * This class provides a type-safe, bidirectional communication channel for
 * sending requests to services in the Upsun console and receiving responses.
 * It implements a request-response pattern with automatic request ID management,
 * timeout handling, and memory leak prevention.
 *
 * Key features:
 * - Generic typing for request and response data (TRequest, TResponse)
 * - Automatic request ID generation and response matching
 * - Configurable timeouts with Promise.race mechanism
 * - Memory leak prevention through proper cleanup
 * - Error handling for user callbacks
 * - Debug logging for development
 *
 * @template TRequest The type of data sent in requests
 * @template TResponse The type of data expected in responses
 *
 * @example
 * ```typescript
 * interface AuthRequest {
 *   username: string;
 *   password: string;
 * }
 *
 * interface AuthResponse {
 *   token: string;
 *   userId: number;
 * }
 *
 * const authClient = pluginBus.createClient<AuthRequest, AuthResponse>('AUTH_SERVICE');
 *
 * const response = await authClient.sendRequest(1, {
 *   username: 'user@example.com',
 *   password: 'password123'
 * }, 5000);
 *
 * if (response) {
 *   console.log('Authentication successful:', response.token);
 * } else {
 *   console.log('Authentication timeout or failed');
 * }
 *
 * // Clean up when done
 * authClient.destroy();
 * ```
 */
export class Client<TRequest = unknown, TResponse = unknown> implements ClientBase {
  private pubSrv: Publisher;
  public subSrv: Subscription;
  private pendingRequests: Map<number, (data: TResponse) => void> = new Map();

  /**
   * Creates a new client for communicating with a specific service topic.
   *
   * The client automatically sets up the necessary communication infrastructure:
   * - Creates a publisher for sending requests (topic + "_REQ")
   * - Creates a subscription for receiving responses (topic + "_RES")
   * - Initializes request tracking for response matching
   * - Registers itself with the PluginBus for lifecycle management
   *
   * Clients are typically created through PluginBus.createClient() rather than
   * instantiated directly to ensure proper integration.
   *
   * @param node PluginBus instance that manages this client
   * @param topic The base topic for the service (automatically suffixed with _REQ/_RES)
   *
   * @example
   * ```typescript
   * // Create a client for user management service
   * const userClient = pluginBus.createClient<UserRequest, UserResponse>('USER_SERVICE');
   *
   * // The client automatically creates:
   * // - Publisher for "USER_SERVICE_REQ"
   * // - Subscription for "USER_SERVICE_RES"
   * ```
   */
  constructor(
    private readonly node: PluginBus,
    public readonly topic: string,
  ) {
    console.log(`SDK > Bus > Create Client of topic: ${this.topic}`);
    this.node.clients.push(this);

    this.pubSrv = this.node.createPublisher(`${this.topic}_REQ`);
    this.subSrv = this.node.createSubscription(`${this.topic}_RES`, (response: unknown) => {
      const serviceMessage = response as ServiceMessage<TResponse>;
      const reqId = serviceMessage?.reqId;

      if (PLUGIN_DEBUG) {
        console.log(`SDK > Bus > Debug > Is service_topic callback with id: ${reqId} `);
      }

      if (reqId !== undefined && this.pendingRequests.has(reqId)) {
        const resolve = this.pendingRequests.get(reqId)!;

        try {
          resolve(serviceMessage.data as TResponse); // Call user callback (may throw exception)
        } catch (error) {
          console.error(`SDK > Bus > Error in callback for request ${reqId}:`, error);
        } finally {
          // Cleanup guaranteed, even if exception occurs
          this.pendingRequests.delete(reqId);
        }
      }
    });
  }

  /**
   * Sends a typed request to the service and returns a promise with the response.
   *
   * This method implements a robust request-response pattern with the following features:
   * - Type-safe request and response handling
   * - Configurable timeout mechanism using Promise.race
   * - Automatic request ID validation to prevent duplicates
   * - Memory leak prevention through proper cleanup
   * - Error handling for user callback exceptions
   * - Returns null on timeout or error conditions
   *
   * The method uses Promise.race to handle timeouts elegantly without NodeJS dependencies:
   * - Main promise resolves when response is received
   * - Timeout promise resolves with null after specified time
   * - Whichever resolves first is returned to the caller
   *
   * @param reqId Unique request identifier for matching responses.
   *              Must be unique across all pending requests for this client.
   * @param data The typed request data to send to the service
   * @param timeoutMs Optional timeout in milliseconds (default: 1000ms).
   *                  Set to 0 to disable timeout.
   * @returns Promise that resolves with:
   *          - TResponse data on successful response
   *          - null on timeout, duplicate request ID, or error
   *
   * @example
   * ```typescript
   * interface LoginRequest {
   *   email: string;
   *   password: string;
   * }
   *
   * interface LoginResponse {
   *   success: boolean;
   *   token?: string;
   *   error?: string;
   * }
   *
   * const client = pluginBus.createClient<LoginRequest, LoginResponse>('AUTH');
   *
   * // Send request with 5 second timeout
   * const result = await client.sendRequest(123, {
   *   email: 'user@example.com',
   *   password: 'password123'
   * }, 5000);
   *
   * if (result) {
   *   if (result.success) {
   *     console.log('Login successful:', result.token);
   *   } else {
   *     console.error('Login failed:', result.error);
   *   }
   * } else {
   *   console.error('Request timeout or error');
   * }
   * ```
   */
  public sendRequest(reqId: number, data: TRequest, timeoutMs: number = 1000): Promise<TResponse | null> {
    if (PLUGIN_DEBUG) {
      console.log(`SDK > Bus > Debug > Send request to service_topic: ${this.topic} with data:`, data);
    }

    // Check for duplicate request ID
    if (this.pendingRequests.has(reqId)) {
      console.warn(`SDK > Bus > Warning > Request ID ${reqId} already exists, rejecting duplicate`);
      return Promise.resolve(null);
    }

    // Create the main request promise
    const requestPromise = new Promise<TResponse | null>((resolve) => {
      this.pendingRequests.set(reqId, (response: TResponse) => {
        resolve(response);
      });

      this.pubSrv.publish({ reqId, data } as ServiceMessage<TRequest>);
    });

    // Create the timeout promise
    const timeoutPromise = new Promise<TResponse | null>((resolve) => {
      setTimeout(() => {
        if (PLUGIN_DEBUG) {
          console.log(
            `SDK > Bus > Debug > Request ${reqId} to service ${this.topic} timed out after ${timeoutMs}ms - returning null`,
          );
        }
        // Only delete if still pending (race condition protection)
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
          resolve(null);
        }
        // If request was already handled, timeout promise never resolves (gets garbage collected)
      }, timeoutMs);
    });

    // Use Promise.race to return whichever resolves first
    return Promise.race([requestPromise, timeoutPromise]);
  }

  /**
   * Destroys this client and cleans up all associated resources.
   *
   * This method ensures complete cleanup to prevent memory leaks by:
   * - Logging pending requests for debugging (warns if any exist)
   * - Removing the client from the PluginBus registry
   * - Destroying the internal publisher and subscription
   * - Clearing the pending requests map
   *
   * After calling destroy(), the client should not be used for sending requests.
   * Any pending requests will not receive responses after destruction.
   *
   * This method is automatically called during PluginBus.destroy() but can
   * be called manually for individual client cleanup.
   *
   * @example
   * ```typescript
   * const client = pluginBus.createClient('TEMP_SERVICE');
   * const response = await client.sendRequest(1, data);
   *
   * // Clean up when done
   * client.destroy();
   *
   * // Client is now unusable
   * // client.sendRequest() should not be called after destroy()
   * ```
   */
  public destroy(): void {
    console.log(`SDK > Bus > Destroy client of service_topic: ${this.topic}`);

    // Log pending requests for debugging
    if (this.pendingRequests.size > 0) {
      console.warn(`SDK > Bus > Warning > Destroying client with ${this.pendingRequests.size} pending requests`);
    }

    // Remove from clients list
    const index = this.node.clients.indexOf(this);
    if (index > -1) {
      this.node.clients.splice(index, 1);
    }

    // Destroy publisher and subscription to prevent memory leaks
    this.pubSrv.destroy();
    this.subSrv.destroy();

    // Clear pending requests
    this.pendingRequests.clear();
  }
}

/**
 * PluginBus - Core message routing and lifecycle management system
 *
 * The PluginBus acts as the central communication hub for the plugin system,
 * managing all publishers, subscriptions, clients, and services. It handles:
 *
 * - Message routing between plugin and Upsun console via postMessage API
 * - Lifecycle management of all communication components
 * - Event listener management for window message events
 * - Centralized cleanup and resource management
 * - Debug logging and error handling
 *
 * The bus uses a topic-based messaging system where each message is identified
 * by an action/topic string. It automatically filters and routes messages to
 * the appropriate subscriptions.
 *
 * Security features:
 * - Message origin validation (currently commented for development)
 * - Structured message validation
 * - Safe error handling that doesn't crash the plugin
 *
 * @example
 * ```typescript
 * const bus = new PluginBus();
 *
 * // Create communication components
 * const publisher = bus.createPublisher('STATUS_UPDATE');
 * const subscription = bus.createSubscription('CONFIG_CHANGE', handleConfig);
 * const client = bus.createClient<Request, Response>('API_SERVICE');
 *
 * // Use components...
 *
 * // Clean up everything
 * bus.destroy();
 * ```
 */
class PluginBus {
  /** Array of all active subscriptions managed by this bus */
  readonly subscriptions: Subscription[] = [];

  /** Array of all active publishers managed by this bus */
  readonly publishers: Publisher[] = [];

  /** Array of all active services managed by this bus */
  readonly services: Service[] = [];

  /** Array of all active clients managed by this bus */
  readonly clients: ClientBase[] = [];

  /** Reference to the window message event handler for proper cleanup */
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  /**
   * Creates a new publisher for sending messages to a specific topic.
   *
   * Publishers provide one-way communication from plugin to Upsun console.
   * The created publisher is automatically registered with this bus for
   * lifecycle management and will be cleaned up during bus destruction.
   *
   * @param topic The topic identifier for message routing
   * @returns A new Publisher instance ready for sending messages
   *
   * @example
   * ```typescript
   * const statusPublisher = bus.createPublisher('PLUGIN_STATUS');
   * statusPublisher.publish({ status: 'ready', timestamp: Date.now() });
   * ```
   */
  public createPublisher(topic: string): Publisher {
    return new Publisher(this, topic);
  }

  /**
   * Creates a new subscription for receiving messages from a specific topic.
   *
   * Subscriptions provide one-way communication from Upsun console to plugin.
   * The created subscription is automatically registered with this bus and
   * will receive messages when the Upsun console sends them on the specified topic.
   *
   * @param topic The topic identifier to listen for
   * @param callback Function to call when messages are received.
   *                 Will be wrapped with error handling to prevent crashes.
   * @returns A new Subscription instance that will receive messages
   *
   * @example
   * ```typescript
   * const configSub = bus.createSubscription('CONFIG_UPDATE', (data) => {
   *   console.log('Configuration updated:', data);
   *   applyNewConfig(data);
   * });
   * ```
   */
  public createSubscription(topic: string, callback: (data: unknown) => void): Subscription {
    return new Subscription(this, topic, callback);
  }

  /**
   * Creates a new type-safe client for request-response communication.
   *
   * Clients provide bidirectional communication with services in the Upsun console
   * using a request-response pattern. The client automatically handles request ID
   * generation, response matching, and timeout mechanisms.
   *
   * @template TRequest The type of data sent in requests
   * @template TResponse The type of data expected in responses
   * @param topic The base topic for the service (automatically suffixed with _REQ/_RES)
   * @returns A new type-safe Client instance for service communication
   *
   * @example
   * ```typescript
   * interface UserData { userId: number; name: string; }
   * interface UserRequest { action: 'get' | 'update'; userId?: number; }
   *
   * const userClient = bus.createClient<UserRequest, UserData>('USER_SERVICE');
   * const userData = await userClient.sendRequest(1, { action: 'get', userId: 123 });
   * ```
   */
  public createClient<TRequest = unknown, TResponse = unknown>(topic: string): Client<TRequest, TResponse> {
    return new Client<TRequest, TResponse>(this, topic);
  }

  /**
   * Destroys the PluginBus and performs comprehensive cleanup.
   *
   * This method ensures complete resource cleanup to prevent memory leaks by:
   * 1. Destroying all registered subscriptions (stops message reception)
   * 2. Destroying all registered publishers (prevents further message sending)
   * 3. Destroying all registered clients (cleans up request-response channels)
   * 4. Destroying all registered services (custom service cleanup)
   * 5. Removing the window message event listener (stops all message processing)
   *
   * The destruction order is important:
   * - Communication components are destroyed first
   * - Message listener is removed last to prevent race conditions
   *
   * Each destruction is wrapped in error handling to ensure partial failures
   * don't prevent complete cleanup.
   *
   * After calling destroy(), the PluginBus should not be used for any operations.
   *
   * @example
   * ```typescript
   * const bus = new PluginBus();
   *
   * // Create and use communication components...
   *
   * // Clean up everything when shutting down
   * bus.destroy();
   *
   * // Bus is now unusable - create a new one if needed
   * ```
   */
  public destroy(): void {
    console.log('SDK > Bus > Starting cleanup...');

    // Helper to destroy and clear an array of items with a destroy method
    const destroyAll = <T extends { destroy: () => void }>(arr: T[]) => {
      for (const item of arr) {
        try {
          item.destroy();
        } catch (error) {
          console.error('SDK > Bus > Error destroying item:', error);
        }
      }
      arr.length = 0;
    };

    destroyAll(this.subscriptions);
    destroyAll(this.publishers);
    destroyAll(this.clients);
    destroyAll(this.services);

    // Remove message event listener LAST (after all publishers/subscriptions are destroyed)
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
  }

  /**
   * Initializes the PluginBus and sets up message handling.
   *
   * The constructor automatically sets up the communication infrastructure:
   * - Creates and registers a window message event listener
   * - Configures message filtering and routing logic
   * - Sets up debug logging for development
   * - Implements security checks for message origin (configurable)
   *
   * Message handling process:
   * 1. Receives postMessage events from Upsun console
   * 2. Validates message structure (action, data, params)
   * 3. Filters messages by topic using registered subscriptions
   * 4. Routes messages to appropriate subscription callbacks
   * 5. Provides error handling and debug logging
   *
   * Security considerations:
   * - Origin validation can be enabled for production (currently commented)
   * - Message structure validation prevents malformed data
   * - Error handling prevents crashes from malicious messages
   *
   * @example
   * ```typescript
   * // Constructor is called automatically when creating a PluginBus
   * const bus = new PluginBus();
   *
   * // Message listener is now active and will route incoming messages
   * // to appropriate subscriptions based on their topic
   * ```
   */
  constructor() {
    console.log('SDK > Bus > Listen subscriptions topics...');

    this.messageHandler = (event: MessageEvent) => {
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

    window.addEventListener('message', this.messageHandler);
  }
}

/**
 * PluginSDK - Main interface for plugin development and Upsun console communication
 *
 * The PluginSDK provides a high-level, easy-to-use interface for plugin developers
 * to interact with the Upsun console and access platform services. It encapsulates
 * the underlying PluginBus complexity and provides convenient methods for common
 * plugin operations.
 *
 * Key features:
 * - Automatic iframe height adjustment using ResizeObserver
 * - Access to Upsun/Platform.sh project context
 * - URL parameter management (get/set)
 * - Centralized resource management and cleanup
 * - Integration with the underlying communication bus
 *
 * The SDK automatically handles:
 * - iframe resizing when content changes
 * - Resource cleanup to prevent memory leaks
 * - Communication with standard platform services
 * - Error handling and logging
 *
 * @example
 * ```typescript
 * // Get the singleton SDK instance
 * const sdk = getPluginSDK();
 *
 * // Access platform context
 * const context = await sdk.getUpsunContext();
 * console.log('Project ID:', context?.projectId);
 *
 * // Get URL parameters
 * const params = await sdk.getUrlParams<{tab?: string}>();
 * console.log('Active tab:', params?.tab);
 *
 * // Set URL parameters
 * await sdk.setUrlParams({ tab: 'settings', view: 'advanced' });
 *
 * // Access the underlying bus for custom communication
 * const customClient = sdk.bus.createClient('CUSTOM_SERVICE');
 *
 * // Clean up when done (usually not needed as it's a singleton)
 * destroyPluginSDK();
 * ```
 */
export class PluginSDK {
  /** The underlying communication bus for advanced usage */
  public bus = new PluginBus();

  // Internal resources for iframe management
  /** Publisher for sending height updates to Upsun console */
  private readonly pubHeight: Publisher;

  /** ResizeObserver for detecting content size changes */
  private readonly resizeObserver: ResizeObserver;

  /** Current iframe height to avoid unnecessary updates */
  private frmHeight: number = 0;

  /**
   * Initializes the PluginSDK with automatic iframe management.
   *
   * The constructor sets up:
   * - Height publisher for iframe resizing communication
   * - ResizeObserver for detecting content changes
   * - Automatic height adjustment system
   *
   * The iframe height is automatically managed to ensure the plugin content
   * is properly visible without scrollbars within the Upsun console.
   */
  constructor() {
    // Internal resources
    this.pubHeight = this.bus.createPublisher(PLUGIN_TOPIC_RESIZE_IFRAME);
    this.resizeObserver = new ResizeObserver(() => {
      this._sendHeightToUpsunConsole();
    });

    this._startResizeObserver();
  }

  /**
   * Destroys the PluginSDK and cleans up all resources.
   *
   * This method ensures complete cleanup by:
   * 1. Disconnecting the ResizeObserver to stop monitoring content changes
   * 2. Destroying the height publisher to stop resize communications
   * 3. Destroying the underlying PluginBus and all its managed components
   *
   * After calling destroy(), the SDK should not be used for any operations.
   * For the singleton instance, use destroyPluginSDK() instead.
   *
   * @example
   * ```typescript
   * const sdk = new PluginSDK();
   * // ... use the SDK
   * sdk.destroy(); // Clean up when done
   * ```
   */
  public destroy(): void {
    console.log('SDK > PluginSDK > Starting cleanup...');

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Destroy internal publisher BEFORE removing message handler
    if (this.pubHeight) {
      this.pubHeight.destroy();
    }

    this.bus.destroy();

    console.log('SDK > PluginSDK destroyed and resources cleaned up.');
  }

  /**
   * Retrieves the current Upsun/Platform.sh project context.
   *
   * This method communicates with the Upsun console to get essential project
   * information including project ID and environment ID. This context is
   * necessary for making API calls and understanding the current deployment context.
   *
   * @returns Promise that resolves with:
   *          - ProjectProps containing projectId and environmentId on success
   *          - null on timeout, error, or if context is not available
   *
   * @example
   * ```typescript
   * const context = await sdk.getUpsunContext();
   * if (context) {
   *   console.log(`Project: ${context.projectId}, Env: ${context.environmentId}`);
   *   // Use context for API calls
   *   const apiUrl = `https://api.platform.sh/projects/${context.projectId}`;
   * } else {
   *   console.error('Failed to get project context');
   * }
   * ```
   */
  public async getUpsunContext(): Promise<ProjectProps | null> {
    const cltProps = this.bus.createClient<String, ProjectProps>(PLUGIN_SRV_PROPS);
    const props = await cltProps.sendRequest(1, '*');
    return props;
  }

  /**
   * Retrieves URL parameters from the Upsun console.
   *
   * This method allows plugins to access URL parameters and state from the
   * Upsun console, enabling deep linking and state persistence across page reloads.
   *
   * @template TResponse The expected type of the URL parameters object
   * @returns Promise that resolves with:
   *          - Typed URL parameters object on success
   *          - null on timeout, error, or if no parameters available
   *
   * @example
   * ```typescript
   * interface UrlParams {
   *   tab?: string;
   *   view?: string;
   *   userId?: number;
   * }
   *
   * const params = await sdk.getUrlParams<UrlParams>();
   * if (params) {
   *   console.log('Current tab:', params.tab);
   *   console.log('Current view:', params.view);
   *   if (params.userId) {
   *     loadUserData(params.userId);
   *   }
   * }
   * ```
   */
  public async getUrlParams<TResponse = unknown>(): Promise<TResponse | null> {
    const cltUrl = this.bus.createClient<String, TResponse>(PLUGIN_SRV_URL);
    const urlProps = await cltUrl.sendRequest(1, '*');
    return urlProps;
  }

  /**
   * Updates URL parameters in the Upsun console.
   *
   * This method allows plugins to update the browser URL and state in the Upsun
   * console, enabling deep linking and state persistence. The parameters are merged
   * with existing URL parameters.
   *
   * @param params Object containing URL parameters to set or update
   *
   * @example
   * ```typescript
   * // Set multiple URL parameters
   * await sdk.setUrlParams({
   *   tab: 'dashboard',
   *   view: 'detailed',
   *   filter: 'active'
   * });
   *
   * // Update a single parameter
   * await sdk.setUrlParams({ userId: 123 });
   *
   * // Clear a parameter by setting it to null
   * await sdk.setUrlParams({ filter: null });
   * ```
   */
  public async setUrlParams(params: Record<string, unknown>): Promise<void> {
    const pubUrl = this.bus.createPublisher(PLUGIN_TOPIC_URL);
    pubUrl.publish(params);
    pubUrl.destroy(); // One-time use publisher
  }

  /**
   * Sends current document height to Upsun console for iframe resizing.
   *
   * This private method calculates the current document height and sends it
   * to the Upsun console so the iframe can be resized to fit the content without
   * scrollbars. It includes optimization to avoid unnecessary updates when
   * the height hasn't changed.
   *
   * The method is called automatically by the ResizeObserver when content changes
   * and during initial setup.
   *
   * @private
   * @internal
   */
  private _sendHeightToUpsunConsole(): void {
    console.log('SDK > iframe > Resize window triggered, sending height to Upsun console');
    const height = document.documentElement.scrollHeight;
    if (this.frmHeight === height) {
      console.log('SDK > iframe > Height is unchanged, skipping publish');
    } else {
      this.frmHeight = height;
      this.pubHeight.publish(height);
    }
  }

  /**
   * Initializes the ResizeObserver system for automatic iframe height adjustment.
   *
   * This private method sets up:
   * - ResizeObserver on document.body to detect content changes
   * - Initial height calculation and transmission
   * - Event listener for DOM load completion
   *
   * The system automatically adjusts iframe height when:
   * - Content is added or removed from the DOM
   * - Elements change size due to CSS or user interaction
   * - Images load and change the document height
   * - Dynamic content is rendered
   *
   * @private
   * @internal
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
        this._sendHeightToUpsunConsole();
      });
    } else {
      // DOM is already loaded
      setTimeout(() => this._sendHeightToUpsunConsole(), 0);
    }
  }
}

///// Plugin SDK Composable and Utilities /////

/**
 * Singleton instance of PluginSDK for application-wide use.
 *
 * The SDK is implemented as a singleton to ensure:
 * - Only one instance manages communication with the Upsun console
 * - Consistent state across the entire plugin application
 * - Proper resource management and cleanup
 * - Avoid conflicts between multiple SDK instances
 *
 * @private
 */
let pluginSDKInstance: PluginSDK | null = null;

/**
 * Gets or creates the singleton instance of PluginSDK.
 *
 * This function provides access to the global PluginSDK instance, creating it
 * if it doesn't exist. The singleton pattern ensures consistent communication
 * with the Upsun console across the entire plugin application.
 *
 * @returns The singleton PluginSDK instance, ready for use
 *
 * @example
 * ```typescript
 * // Get the SDK instance anywhere in your application
 * const sdk = getPluginSDK();
 *
 * // Use SDK methods
 * const context = await sdk.getUpsunContext();
 *
 * // Access the underlying bus for advanced usage
 * const customClient = sdk.bus.createClient('MY_SERVICE');
 * ```
 */
export function getPluginSDK(): PluginSDK {
  if (!pluginSDKInstance) {
    pluginSDKInstance = new PluginSDK();
  }
  return pluginSDKInstance;
}

/**
 * Destroys the singleton PluginSDK instance and cleans up all resources.
 *
 * This function should be called when the plugin is being unloaded or when
 * you need to completely reset the SDK state. It ensures all communication
 * channels are closed and resources are freed to prevent memory leaks.
 *
 * After calling this function, getPluginSDK() will create a new instance
 * on the next call.
 *
 * @example
 * ```typescript
 * // During plugin shutdown or cleanup
 * destroyPluginSDK();
 *
 * // SDK is now destroyed, next call to getPluginSDK() will create a new instance
 * const newSdk = getPluginSDK(); // Creates fresh instance
 * ```
 */
export function destroyPluginSDK(): void {
  if (pluginSDKInstance) {
    pluginSDKInstance.destroy();
    pluginSDKInstance = null;
  }
}

/**
 * Vue 3 Composition API composable for using the Plugin SDK.
 *
 * This composable provides a convenient way to use the Plugin SDK in Vue 3
 * components with the Composition API. It returns the singleton SDK instance
 * and a destroy function for cleanup.
 *
 * The composable follows Vue 3 patterns and can be used in setup() functions
 * or `<script setup>` blocks.
 *
 * @returns Object containing:
 *          - sdk: The singleton PluginSDK instance
 *          - destroy: Function to destroy the SDK (use with caution)
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { usePluginSDK } from '@/utils/pluginSDK';
 * import { onMounted, ref } from 'vue';
 *
 * const { sdk } = usePluginSDK();
 * const projectContext = ref(null);
 *
 * onMounted(async () => {
 *   projectContext.value = await sdk.getUpsunContext();
 * });
 *
 * // Set URL parameters when user navigates
 * const navigateToTab = (tabName: string) => {
 *   sdk.setUrlParams({ tab: tabName });
 * };
 * </script>
 *
 * <template>
 *   <div>
 *     <h1>Project: {{ projectContext?.projectId }}</h1>
 *     <button @click="navigateToTab('settings')">Go to Settings</button>
 *   </div>
 * </template>
 * ```
 */
export function usePluginSDK() {
  const sdk = getPluginSDK();

  return {
    /** The singleton PluginSDK instance for plugin communication */
    sdk,
    /** Function to destroy the SDK (use with caution - affects entire application) */
    destroy: destroyPluginSDK,
  };
}
