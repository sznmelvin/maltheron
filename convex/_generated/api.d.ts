/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as auditLogs from "../auditLogs.js";
import type * as idempotency from "../idempotency.js";
import type * as memory from "../memory.js";
import type * as memorySnapshots from "../memorySnapshots.js";
import type * as nonces from "../nonces.js";
import type * as scheduler from "../scheduler.js";
import type * as sessions from "../sessions.js";
import type * as taxes from "../taxes.js";
import type * as transactions from "../transactions.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  auditLogs: typeof auditLogs;
  idempotency: typeof idempotency;
  memory: typeof memory;
  memorySnapshots: typeof memorySnapshots;
  nonces: typeof nonces;
  scheduler: typeof scheduler;
  sessions: typeof sessions;
  taxes: typeof taxes;
  transactions: typeof transactions;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
