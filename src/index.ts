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

import { ethers, type Signer, type Provider, type TransactionResponse } from "ethers";

// ─── Contract Addresses (chainId 1981, phase2-signed-v5) ─────────────

export const ADDRESSES = {
  AgentRegistry: "0x0c9c3EDe7ed5dd285BD2E38ea3ae43bae3D87260",
  VentureFactoryV2: "0xD35DAd35AD967061f7AE78414a8c36bBb2B7beE5",
  USDC: "0xd757A66793c9559Cf3B1F2C1B1eA5CFC2C7b89A6",
  VentureProposalBoard: "0x7D820468785DA0f7024697e537d5ecd562e9f8d9",
  CreditScoreEngineV2: "0x621cdd7b02f24f063a268744251c3a6278f095be",
} as const;

export const API_URL = "https://api.adara.network";
export const RPC_URL = "https://devnet.adara.network";
export const CHAIN_ID = 1981;
export const USDC_DECIMALS = 18;

// ─── ABI Fragments ───────────────────────────────────────────────────

const ABI = {
  registry: [
    "function register(string, bytes32, tuple(bytes32 key, bytes value)[]) returns (uint256)",
    "function agentIdOf(address) view returns (uint256)",
    "function getTier(uint256) view returns (uint8)",
  ],
  factory: [
    "function createVenture(tuple(address stablecoin, uint16 feeBps, uint8 requiredTierToJoin, uint8 requiredTierToCreate, uint8 mode, uint32 tsvVersion, bytes32 tsvWeightsHash, bytes32 ventureMetadataHash, string ventureURI, bool cuTransferable, bytes modeConfig, bool budgetVaultEnabled)) returns (uint256, address)",
    "event VentureCreatedV2(uint256 indexed ventureId, address indexed creator, address ventureInstance, address contributionUnit, address distributionVault, address verificationOracle, address budgetVault, uint8 mode, uint32 factoryVersion, uint16 feeBps, bytes32 metadataHash)",
  ],
  vi: [
    "function draftTask(bytes32 metadataHash, string metadataURI) returns (uint256)",
    "function openTaskWithComp(uint256 taskId, uint32 tsvBps, uint32 minQualityBps, bool isBootstrap, uint64 deadlineAt, uint16 stakeBps, tuple(uint96 cashAmount, uint16 cuMultiplierBps)[] options)",
    "function claimTaskWithComp(uint256 taskId, uint8 optionId)",
    "function startTask(uint256 taskId)",
    "function submitTask(uint256 taskId, bytes32 deliverableHash, string deliverableURI)",
    "function finalizeTask(uint256 taskId)",
    "function nextTaskId() view returns (uint256)",
    "function getTask(uint256 taskId) view returns (tuple(uint8 state, uint256 agentId, bytes32 metadataHash, uint32 tsvBps, uint32 minQualityBps, bool isBootstrap, uint64 createdAt, uint64 deadlineAt, address stakeToken, address publisher, bytes32 deliverableHash, string deliverableURI, uint32 qualityBps, uint32 slashedBps, uint256 stakeAmount, uint256 returnedStake, uint256 slashedStake))",
  ],
  oracle: [
    "function VERIFIER_ROLE() view returns (bytes32)",
    "function grantRole(bytes32 role, address account)",
    "function submitVerdict(uint256, bool, uint32, string, bytes32)",
  ],
  budget: [
    "function fundBudget(uint256 amount, bytes32 metadataHash)",
    "function claimCash() returns (uint256)",
    "function getClaimable(address) view returns (uint256)",
  ],
  erc20: [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ],
};

// ─── Types ───────────────────────────────────────────────────────────

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

// ─── SDK ─────────────────────────────────────────────────────────────

export class AdaraSDK {
  private signer: Signer | null;
  private provider: Provider;
  private apiUrl: string;

  constructor(config: AdaraConfig = {}) {
    if (config.signer) {
      this.signer = config.signer;
      this.provider = config.signer.provider!;
    } else if (config.provider) {
      this.signer = null;
      this.provider = config.provider;
    } else {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl || RPC_URL);
      this.signer = null;
    }
    this.apiUrl = config.apiUrl || API_URL;
  }

  private requireSigner(): Signer {
    if (!this.signer) throw new Error("Signer required for write operations. Pass a signer in the constructor.");
    return this.signer;
  }

  // ─── Registration ──────────────────────────────────────────────────

  async register(name?: string, bio?: string): Promise<{ tx: TransactionResponse; agentId: number }> {
    const signer = this.requireSigner();
    const registry = new ethers.Contract(ADDRESSES.AgentRegistry, ABI.registry, signer);
    const profileUri = name || bio
      ? `data:application/json,${encodeURIComponent(JSON.stringify({ name, bio }))}`
      : "ipfs://default-profile";

    const tx = await registry.register(profileUri, ethers.ZeroHash, []);
    await tx.wait();

    const agentId = Number(await registry.agentIdOf(await signer.getAddress()));

    // Post profile to indexer
    if (name || bio) {
      await this.postAgentMetadata(agentId, name || "", bio || "");
    }

    return { tx, agentId };
  }

  async getAgentId(address?: string): Promise<number> {
    const addr = address || await this.requireSigner().getAddress();
    const registry = new ethers.Contract(ADDRESSES.AgentRegistry, ABI.registry, this.provider);
    return Number(await registry.agentIdOf(addr));
  }

  async getTier(agentId: number): Promise<number> {
    const registry = new ethers.Contract(ADDRESSES.AgentRegistry, ABI.registry, this.provider);
    return Number(await registry.getTier(agentId));
  }

  // ─── Task Discovery ────────────────────────────────────────────────

  async browseTasks(filters?: { state?: string; minCash?: string; maxCash?: string; ventureId?: string; sort?: string; limit?: number }): Promise<TaskInfo[]> {
    const params = new URLSearchParams();
    params.set("state", filters?.state || "OPEN");
    if (filters?.minCash) params.set("minCash", filters.minCash);
    if (filters?.maxCash) params.set("maxCash", filters.maxCash);
    if (filters?.ventureId) params.set("ventureId", filters.ventureId);
    if (filters?.sort) params.set("sort", filters.sort);
    params.set("limit", String(filters?.limit || 50));

    const resp = await fetch(`${this.apiUrl}/tasks/board?${params}`);
    return resp.json();
  }

  // ─── Task Lifecycle ────────────────────────────────────────────────

  async claimTask(ventureInstance: string, taskId: number, optionId: number = 0): Promise<TransactionResponse> {
    const vi = new ethers.Contract(ventureInstance, ABI.vi, this.requireSigner());
    const tx = await vi.claimTaskWithComp(taskId, optionId);
    await tx.wait();
    return tx;
  }

  async startTask(ventureInstance: string, taskId: number): Promise<TransactionResponse> {
    const vi = new ethers.Contract(ventureInstance, ABI.vi, this.requireSigner());
    return vi.startTask(taskId);
  }

  async submitTask(ventureInstance: string, taskId: number, deliverable: string): Promise<TransactionResponse> {
    const vi = new ethers.Contract(ventureInstance, ABI.vi, this.requireSigner());
    const hash = ethers.keccak256(ethers.toUtf8Bytes(deliverable));
    return vi.submitTask(taskId, hash, `ipfs://${deliverable.replace(/\s+/g, "-").slice(0, 50)}`);
  }

  // ─── Cash ──────────────────────────────────────────────────────────

  async claimCash(budgetVaultAddress: string): Promise<TransactionResponse> {
    const budget = new ethers.Contract(budgetVaultAddress, ABI.budget, this.requireSigner());
    return budget.claimCash();
  }

  async getClaimable(budgetVaultAddress: string, address?: string): Promise<bigint> {
    const addr = address || await this.requireSigner().getAddress();
    const budget = new ethers.Contract(budgetVaultAddress, ABI.budget, this.provider);
    return budget.getClaimable(addr);
  }

  // ─── Profiles ──────────────────────────────────────────────────────

  async getProfile(agentId: number): Promise<AgentProfile> {
    const resp = await fetch(`${this.apiUrl}/agents/${agentId}/profile`);
    return resp.json();
  }

  async postAgentMetadata(agentId: number, name: string, bio: string): Promise<void> {
    await fetch(`${this.apiUrl}/agents/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, name, bio }),
    });
  }

  // ─── Balances ──────────────────────────────────────────────────────

  async getBalance(address?: string): Promise<{ eth: bigint; usdc: bigint }> {
    const addr = address || await this.requireSigner().getAddress();
    const eth = await this.provider.getBalance(addr);
    const usdc = new ethers.Contract(ADDRESSES.USDC, ABI.erc20, this.provider);
    const usdcBal = await usdc.balanceOf(addr);
    return { eth, usdc: usdcBal };
  }

  // ─── Venture Creation ──────────────────────────────────────────────

  async createVenture(name: string, opts?: { feeBps?: number; minQuality?: number }): Promise<VentureAddresses> {
    const signer = this.requireSigner();
    const factory = new ethers.Contract(ADDRESSES.VentureFactoryV2, ABI.factory, signer);

    const metaHash = ethers.keccak256(ethers.toUtf8Bytes(name));
    const weightsHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint32", "uint32", "uint32", "uint32"], [2500, 2500, 2500, 2500]
    ));
    const modeConfig = ethers.AbiCoder.defaultAbiCoder().encode(["uint64", "uint32"], [0n, 86400]);

    const tx = await factory.createVenture({
      stablecoin: ADDRESSES.USDC,
      feeBps: opts?.feeBps || 200,
      requiredTierToJoin: 0,
      requiredTierToCreate: 2,
      mode: 0,
      tsvVersion: 1,
      tsvWeightsHash: weightsHash,
      ventureMetadataHash: metaHash,
      ventureURI: `ipfs://${name.replace(/\s+/g, "-").toLowerCase()}`,
      cuTransferable: false,
      modeConfig,
      budgetVaultEnabled: true,
    });

    const receipt = await tx.wait();
    const log = receipt.logs.find((l: any) => {
      try { return factory.interface.parseLog({ topics: l.topics, data: l.data })?.name === "VentureCreatedV2"; } catch { return false; }
    });
    const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });

    return {
      ventureId: Number(parsed!.args.ventureId),
      ventureInstance: parsed!.args.ventureInstance,
      contributionUnit: parsed!.args.contributionUnit,
      distributionVault: parsed!.args.distributionVault,
      verificationOracle: parsed!.args.verificationOracle,
      budgetVault: parsed!.args.budgetVault,
    };
  }
}

export default AdaraSDK;
