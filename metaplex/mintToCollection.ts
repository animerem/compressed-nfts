/**
 * Script to mint a compressed NFT using Metaplex SDK
 * Note: A collection can use multiple trees. This demo uses one tree.
 */

import dotenv from "dotenv";
dotenv.config();

import {
  Metaplex,
  ReadApiConnection,
  keypairIdentity,
} from "@metaplex-foundation/js";
import { PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  loadPublicKeysFromFile,
  loadKeypairFromFile,
  loadOrGenerateKeypair,
  explorerURL,
  printConsoleSeparator,
  savePublicKeyToFile,
} from "../utils/helpers";
import { getLeafAssetId, metadataArgsBeet } from "@metaplex-foundation/mpl-bubblegum";
import {
  changeLogEventV1Beet,
  deserializeApplicationDataEvent,
  deserializeChangeLogEventV1,
} from "@solana/spl-account-compression";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { BN } from "@project-serum/anchor";

const CLUSTER_URL = process.env.RPC_URL ?? clusterApiUrl("devnet");
const connection = new ReadApiConnection(CLUSTER_URL);

(async () => {
  try {
    const testWallet = loadOrGenerateKeypair("testWallet");
    const payer = process.env.LOCAL_PAYER_JSON_ABSPATH
      ? loadKeypairFromFile(process.env.LOCAL_PAYER_JSON_ABSPATH)
      : loadOrGenerateKeypair("payer");

    console.log("Payer:", payer.publicKey.toBase58());
    console.log("Test Wallet:", testWallet.publicKey.toBase58());

    const keys = loadPublicKeysFromFile();
    if (!keys?.collectionMint || !keys?.treeAddress) {
      console.warn("No local keys found. Run the `index` script first.");
      return;
    }

    const treeAddress: PublicKey = keys.treeAddress;
    const collectionMint: PublicKey = keys.collectionMint;
    const collectionAuthority: PublicKey = keys.collectionAuthority;

    console.log("Tree Address:", treeAddress.toBase58());
    console.log("Collection Mint:", collectionMint.toBase58());

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));
    printConsoleSeparator("Minting Compressed NFT");

    const { response, nft } = await metaplex.nfts().create({
      uri: "https://supersweetcollection.notarealurl/token.json",
      name: "compressed with metaplex",
      sellerFeeBasisPoints: 500,
      collection: collectionMint,
      collectionAuthority: payer,
      tree: treeAddress,
    });

    savePublicKeyToFile("assetIdTestAddress", new PublicKey(nft.address));
    console.log("Minted NFT:", nft);
    printConsoleSeparator("Explorer Link");
    console.log(explorerURL({ txSignature: response.signature }));
  } catch (error) {
    console.error("Failed to mint compressed NFT:", error);
  }
})();
