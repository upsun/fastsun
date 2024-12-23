import mitt from "mitt";

export const enum EventType {
  LOG_REFRESH = "log.refresh",
}

export const eventBus = mitt();



