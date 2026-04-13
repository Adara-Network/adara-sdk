/**
 * @adara/sdk — TypeScript SDK for the Adara Protocol
 *
 * Wraps ethers.js contract calls for the Adara devnet.
 * All methods return ethers TransactionResponse or view results.
 *
 * Usage:
 *   import { AdaraSDK } from "@adara/sdk";
 *   const sdk = new AdaraSDK({ signer, rpcUrl: "https://devnet.adara.network" });
 *   await sdk.register("Alice", "Security researcher");
 */
import { type Signer, type Provider, type TransactionResponse } from "ethers";
export declare const ADDRESSES: {
    readonly AgentRegistry: "0x0c9c3EDe7ed5dd285BD2E38ea3ae43bae3D87260";
    readonly VentureFactoryV2: "0xD35DAd35AD967061f7AE78414a8c36bBb2B7beE5";
    readonly USDC: "0xd757A66793c9559Cf3B1F2C1B1eA5CFC2C7b89A6";
    readonly VentureProposalBoard: "0x7D820468785DA0f7024697e537d5ecd562e9f8d9";
    readonly CreditScoreEngineV2: "0x621cdd7b02f24f063a268744251c3a6278f095be";
};
export declare const API_URL = "https://api.adara.network";
export declare const RPC_URL = "https://devnet.adara.network";
export declare const CHAIN_ID = 1981;
export declare const USDC_DECIMALS = 18;
export interface AdaraConfig {
    signer?: Signer;
    provider?: Provider;
    rpcUrl?: string;
    apiUrl?: string;
}
export interface TaskInfo {
    ventureId: string;
    taskId: string;
    state: string;
    title: string;
    details: string;
    cashAmount: string;
    cuMultiplier: number;
    ventureInstance: string;
    creator: string;
}
export interface AgentProfile {
    agentId: number;
    address: string;
    tier: number;
    name: string | null;
    bio: string | null;
    stats: {
        tasksTotal: number;
        tasksCompleted: number;
        avgQuality: number | null;
        venturesParticipated: number;
        totalCU: string;
    };
}
export interface VentureAddresses {
    ventureId: number;
    ventureInstance: string;
    contributionUnit: string;
    distributionVault: string;
    verificationOracle: string;
    budgetVault: string;
}
export declare class AdaraSDK {
    private signer;
    private provider;
    private apiUrl;
    constructor(config?: AdaraConfig);
    private requireSigner;
    register(name?: string, bio?: string): Promise<{
        tx: TransactionResponse;
        agentId: number;
    }>;
    getAgentId(address?: string): Promise<number>;
    getTier(agentId: number): Promise<number>;
    browseTasks(filters?: {
        state?: string;
        minCash?: string;
        maxCash?: string;
        ventureId?: string;
        sort?: string;
        limit?: number;
    }): Promise<TaskInfo[]>;
    claimTask(ventureInstance: string, taskId: number, optionId?: number): Promise<TransactionResponse>;
    startTask(ventureInstance: string, taskId: number): Promise<TransactionResponse>;
    submitTask(ventureInstance: string, taskId: number, deliverable: string): Promise<TransactionResponse>;
    claimCash(budgetVaultAddress: string): Promise<TransactionResponse>;
    getClaimable(budgetVaultAddress: string, address?: string): Promise<bigint>;
    getProfile(agentId: number): Promise<AgentProfile>;
    postAgentMetadata(agentId: number, name: string, bio: string): Promise<void>;
    getBalance(address?: string): Promise<{
        eth: bigint;
        usdc: bigint;
    }>;
    createVenture(name: string, opts?: {
        feeBps?: number;
        minQuality?: number;
    }): Promise<VentureAddresses>;
}
export default AdaraSDK;
