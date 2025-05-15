import { Commitment, Connection, ConnectionConfig, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { PROGRAM_ID as BUBBLEGUM_PROGRAM_ID } from "@metaplex-foundation/mpl-bubblegum";

import {
  MetaplexError,
  toBigNumber,
  Pda,
  amount,
} from "@metaplex-foundation/js";
import type {
  SplTokenCurrency,
  Metadata,
  Mint,
  NftOriginalEdition,
} from "@metaplex-foundation/js";

import type {
  GetAssetProofRpcInput,
  GetAssetProofRpcResponse,
  GetAssetRpcInput,
  GetAssetsByOwnerRpcInput,
  GetAssetsByGroupRpcInput,
  ReadApiAsset,
  ReadApiAssetList,
} from "@/ReadApi/types";

// Simplified JSON-RPC types
type RpcRequest<T> = {
  method: string;
  id?: string;
  params: T;
};

type RpcResponse<T> = {
  result: T;
};

// === Error ===
export class ReadApiError extends MetaplexError {
  readonly name: string = "ReadApiError";
  constructor(message: string, cause?: Error) {
    super(message, "rpc", undefined, cause);
  }
}

// === Transformers ===
export const toNftEditionFromReadApiAsset = (
  input: ReadApiAsset
): NftOriginalEdition => ({
  model: "nftEdition",
  isOriginal: true,
  address: new PublicKey(input.id),
  supply: toBigNumber(input.supply.print_current_supply),
  maxSupply: toBigNumber(input.supply.print_max_supply),
});

export const toMintFromReadApiAsset = (input: ReadApiAsset): Mint => {
  const currency: SplTokenCurrency = {
    symbol: "Token",
    decimals: 0,
    namespace: "spl-token",
  };

  return {
    model: "mint",
    address: new PublicKey(input.id),
    mintAuthorityAddress: new PublicKey(input.id),
    freezeAuthorityAddress: new PublicKey(input.id),
    decimals: 0,
    supply: amount(1, currency),
    isWrappedSol: false,
    currency,
  };
};

export const toMetadataFromReadApiAsset = (
  input: ReadApiAsset
): Metadata => {
  const updateAuthority = input.authorities?.find((a) =>
    a.scopes.includes("full")
  );

  if (!updateAuthority) {
    throw new ReadApiError("No update authority with full scope found.");
  }

  const collection = input.grouping.find(
    ({ group_key }) => group_key === "collection"
  );

  return {
    model: "metadata",
    address: Pda.find(BUBBLEGUM_PROGRAM_ID, [
      Buffer.from("asset", "utf-8"),
      new PublicKey(input.compression.tree).toBuffer(),
      Uint8Array.from(new BN(input.compression.leaf_id).toArray("le", 8)),
    ]).data,
    mintAddress: new PublicKey(input.id),
    updateAuthorityAddress: new PublicKey(updateAuthority.address),
    name: input.content.metadata?.name ?? "",
    symbol: input.content.metadata?.symbol ?? "",
    json: input.content.metadata,
    jsonLoaded: true,
    uri: input.content.json_uri,
    isMutable: input.mutable,
    primarySaleHappened: input.royalty.primary_sale_happened,
    sellerFeeBasisPoints: input.royalty.basis_points,
    creators: input.creators,
    editionNonce: input.supply.edition_nonce,
    tokenStandard: TokenStandard.NonFungible,
    collection: collection
      ? {
          address: new PublicKey(collection.group_value),
          verified: false,
        }
      : null,
    // @ts-ignore: compression is not part of the Metadata type
    compression: input.compression,
    collectionDetails: null,
    uses: null,
    programmableConfig: null,
  };
};

// === WrapperConnection ===
export class WrapperConnection extends Connection {
  constructor(endpoint: string, commitmentOrConfig?: Commitment | ConnectionConfig) {
    super(endpoint, commitmentOrConfig);
  }

  private async callReadApi<TParams, TResult>(
    request: RpcRequest<TParams>
  ): Promise<RpcResponse<TResult>> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: request.method,
          id: request.id ?? "rpd-op-123",
          params: request.params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (e) {
      throw new ReadApiError("Failed to call ReadAPI", e instanceof Error ? e : undefined);
    }
  }

  private validatePagination(page?: number, before?: string | null, after?: string | null) {
    if (typeof page === "number" && (before || after)) {
      throw new ReadApiError(
        "Pagination Error. Only one pagination parameter supported per query."
      );
    }
  }

  async getAsset(assetId: PublicKey): Promise<ReadApiAsset> {
    const { result } = await this.callReadApi<GetAssetRpcInput, ReadApiAsset>({
      method: "getAsset",
      params: { id: assetId.toBase58() },
    });

    if (!result) throw new ReadApiError("No asset returned");
    return result;
  }

  async getAssetProof(assetId: PublicKey): Promise<GetAssetProofRpcResponse> {
    const { result } = await this.callReadApi<GetAssetProofRpcInput, GetAssetProofRpcResponse>({
      method: "getAssetProof",
      params: { id: assetId.toBase58() },
    });

    if (!result) throw new ReadApiError("No asset proof returned");
    return result;
  }

  async getAssetsByGroup(input: GetAssetsByGroupRpcInput): Promise<ReadApiAssetList> {
    this.validatePagination(input.page, input.before, input.after);

    const { result } = await this.callReadApi<GetAssetsByGroupRpcInput, ReadApiAssetList>({
      method: "getAssetsByGroup",
      params: {
        ...input,
        page: input.page ?? 1,
        before: input.before ?? null,
        after: input.after ?? null,
        limit: input.limit ?? null,
        sortBy: input.sortBy ?? null,
      },
    });

    if (!result) throw new ReadApiError("No results returned");
    return result;
  }

  async getAssetsByOwner(input: GetAssetsByOwnerRpcInput): Promise<ReadApiAssetList> {
    this.validatePagination(input.page, input.before, input.after);

    const { result } = await this.callReadApi<GetAssetsByOwnerRpcInput, ReadApiAssetList>({
      method: "getAssetsByOwner",
      params: {
        ...input,
        page: input.page ?? 1,
        before: input.before ?? null,
        after: input.after ?? null,
        limit: input.limit ?? null,
        sortBy: input.sortBy ?? null,
      },
    });

    if (!result) throw new ReadApiError("No results returned");
    return result;
  }
}
