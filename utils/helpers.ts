import fs from "fs";
import path from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

// default storage settings
const DEFAULT_KEY_DIR_NAME = ".local_keys";
const DEFAULT_PUBLIC_KEY_FILE = "keys.json";
const DEFAULT_DEMO_DATA_FILE = "demo.json";

const ensureDirExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export function loadPublicKeysFromFile(
  absPath: string = path.join(DEFAULT_KEY_DIR_NAME, DEFAULT_PUBLIC_KEY_FILE)
): Record<string, PublicKey> {
  try {
    if (!fs.existsSync(absPath)) return {};
    const raw = fs.readFileSync(absPath, "utf-8");
    const data = JSON.parse(raw);
    const parsed: Record<string, PublicKey> = {};
    for (const [key, value] of Object.entries(data)) {
      parsed[key] = new PublicKey(value as string);
    }
    return parsed;
  } catch (err) {
    console.warn("Failed to load public keys:", err);
    return {};
  }
}

export function savePublicKeyToFile(
  name: string,
  publicKey: PublicKey,
  absPath: string = path.join(DEFAULT_KEY_DIR_NAME, DEFAULT_PUBLIC_KEY_FILE)
): Record<string, PublicKey> {
  try {
    ensureDirExists(path.dirname(absPath));
    const data = loadPublicKeysFromFile(absPath);
    data[name] = publicKey;
    const toSave: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      toSave[k] = v.toBase58();
    }
    fs.writeFileSync(absPath, JSON.stringify(toSave, null, 2), "utf-8");
    return data;
  } catch (err) {
    console.warn("Failed to save public key:", err);
    return {};
  }
}

export function saveDemoDataToFile(
  name: string,
  newData: any,
  absPath: string = path.join(DEFAULT_KEY_DIR_NAME, DEFAULT_DEMO_DATA_FILE)
) {
  try {
    ensureDirExists(path.dirname(absPath));
    let data: Record<string, any> = {};
    if (fs.existsSync(absPath)) {
      data = JSON.parse(fs.readFileSync(absPath, "utf-8"));
    }
    data[name] = newData;
    fs.writeFileSync(absPath, JSON.stringify(data, null, 2), "utf-8");
    return data;
  } catch (err) {
    console.warn("Failed to save demo data:", err);
    return {};
  }
}

export function loadKeypairFromFile(absPath: string): Keypair {
  if (!fs.existsSync(absPath)) throw new Error("Keypair file does not exist");
  const raw = JSON.parse(fs.readFileSync(absPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

export function saveKeypairToFile(
  keypair: Keypair,
  fileName: string,
  dirName: string = DEFAULT_KEY_DIR_NAME
): string {
  ensureDirExists(dirName);
  const fullPath = path.join(dirName, `${fileName}.json`);
  fs.writeFileSync(fullPath, JSON.stringify(Array.from(keypair.secretKey)), "utf-8");
  return fullPath;
}

export function loadOrGenerateKeypair(
  fileName: string,
  dirName: string = DEFAULT_KEY_DIR_NAME
): Keypair {
  const fullPath = path.join(dirName, `${fileName}.json`);
  if (fs.existsSync(fullPath)) return loadKeypairFromFile(fullPath);
  const kp = Keypair.generate();
  saveKeypairToFile(kp, fileName, dirName);
  return kp;
}

export function explorerURL({
  address,
  txSignature,
  cluster = "devnet",
}: {
  address?: string;
  txSignature?: string;
  cluster?: "devnet" | "testnet" | "mainnet" | "mainnet-beta";
}): string {
  if (!address && !txSignature) return "[unknown]";
  const base = address
    ? `https://explorer.solana.com/address/${address}`
    : `https://explorer.solana.com/tx/${txSignature}`;
  const url = new URL(base);
  url.searchParams.append("cluster", cluster);
  return url.toString();
}

export async function airdropOnLowBalance(
  connection: Connection,
  keypair: Keypair,
  forceAirdrop = false
): Promise<number> {
  const balance = await connection.getBalance(keypair.publicKey);
  const threshold = LAMPORTS_PER_SOL / 2;
  if (forceAirdrop || balance < threshold) {
    console.log(`Airdropping 1 SOL to ${keypair.publicKey.toBase58()}...`);
    const sig = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
    console.log("Tx:", sig);
  }
  return balance;
}

export async function extractSignatureFromFailedTransaction(
  connection: Connection,
  err: any,
  fetchLogs = false
): Promise<string | undefined> {
  const message = err?.message?.toString() ?? "";
  const match = /^((.*)?Error: )?(Transaction|Signature) ([A-Z0-9]{32,}) /im.exec(message);
  const sig = err?.signature ?? match?.[4];
  if (!sig) return;

  console.log(explorerURL({ txSignature: sig }));

  if (fetchLogs) {
    const tx = await connection.getTransaction(sig, {
      maxSupportedTransactionVersion: 0,
    });
    console.log("Log messages:", tx?.meta?.logMessages ?? "No logs");
  }

  return sig;
}

export function numberFormatter(num: number, forceDecimals = false): string {
  const minFraction = num < 1 || forceDecimals ? 10 : 2;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: minFraction,
  }).format(num);
}

export function printConsoleSeparator(message?: string): void {
  console.log("\n===============================================");
  console.log("===============================================\n");
  if (message) console.log(message);
}
