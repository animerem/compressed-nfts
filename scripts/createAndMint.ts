import { Keypair, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { ValidDepthSizePair } from "@solana/spl-account-compression";
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";
import { CreateMetadataAccountArgsV3 } from "@metaplex-foundation/mpl-token-metadata";

import { loadKeypairFromFile, loadOrGenerateKeypair, numberFormatter } from "../utils/helpers";
import { createCollection, createTree, mintCompressedNFT } from "../utils/compression";
import { WrapperConnection } from "../ReadApi/WrapperConnection";

import dotenv from "dotenv";
dotenv.config();

(async () => {
  try {
    const testWallet = loadOrGenerateKeypair("testWallet");

    const payer = process.env.LOCAL_PAYER_JSON_ABSPATH
      ? loadKeypairFromFile(process.env.LOCAL_PAYER_JSON_ABSPATH)
      : loadOrGenerateKeypair("payer");

    console.log("Payer address:", payer.publicKey.toBase58());
    console.log("Test wallet address:", testWallet.publicKey.toBase58());

    const CLUSTER_URL = process.env.RPC_URL ?? clusterApiUrl("devnet");
    const connection = new WrapperConnection(CLUSTER_URL, "confirmed");

    const initBalance = await connection.getBalance(payer.publicKey);

    const maxDepthSizePair: ValidDepthSizePair = {
      maxDepth: 14,
      maxBufferSize: 64,
    };
    const canopyDepth = maxDepthSizePair.maxDepth - 5;

    const treeKeypair = Keypair.generate();
    const tree = await createTree(connection, payer, treeKeypair, maxDepthSizePair, canopyDepth);

    const collectionMetadataV3: CreateMetadataAccountArgsV3 = {
      data: {
        name: "Super Sweet NFT Collection",
        symbol: "SSNC",
        uri: "https://supersweetcollection.notarealurl/collection.json",
        sellerFeeBasisPoints: 100,
        creators: [
          {
            address: payer.publicKey,
            verified: false,
            share: 100,
          },
        ],
        collection: null,
        uses: null,
      },
      isMutable: false,
      collectionDetails: null,
    };

    const collection = await createCollection(connection, payer, collectionMetadataV3);

    const compressedNFTMetadata: MetadataArgs = {
      name: "NFT Name",
      symbol: collectionMetadataV3.data.symbol,
      uri: "https://supersweetcollection.notarealurl/token.json",
      creators: [
        {
          address: payer.publicKey,
          verified: false,
          share: 100,
        },
        {
          address: testWallet.publicKey,
          verified: false,
          share: 0,
        },
      ],
      editionNonce: 0,
      uses: null,
      collection: null,
      primarySaleHappened: false,
      sellerFeeBasisPoints: 0,
      isMutable: false,
      tokenProgramVersion: TokenProgramVersion.Original,
      tokenStandard: TokenStandard.NonFungible,
    };

    console.log(`Minting a compressed NFT to ${payer.publicKey.toBase58()}...`);
    await mintCompressedNFT(
      connection,
      payer,
      treeKeypair.publicKey,
      collection.mint,
      collection.metadataAccount,
      collection.masterEditionAccount,
      compressedNFTMetadata,
      payer.publicKey
    );

    console.log(`Minting a compressed NFT to ${testWallet.publicKey.toBase58()}...`);
    await mintCompressedNFT(
      connection,
      payer,
      treeKeypair.publicKey,
      collection.mint,
      collection.metadataAccount,
      collection.masterEditionAccount,
      compressedNFTMetadata,
      testWallet.publicKey
    );

    const balance = await connection.getBalance(payer.publicKey);

    console.log(`===============================`);
    console.log(
      "Total cost:",
      numberFormatter((initBalance - balance) / LAMPORTS_PER_SOL, true),
      "SOL\n"
    );
  } catch (error) {
    console.error("Script execution failed:", error);
  }
})();
