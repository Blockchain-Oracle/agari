/** One Kit client per role key: that key is both fee payer and signer (single writer per key, plan §4). */
import { createDeployClient, type DeployClient, type DeployClientConfig } from "../deploy/client";

export type OpsClientConfig = DeployClientConfig;
export type OpsClient = DeployClient;

export const createOpsClient = (config: OpsClientConfig): Promise<OpsClient> => createDeployClient(config);
