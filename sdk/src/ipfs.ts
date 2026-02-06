import type { IpfsConfig } from "./config.js";
import { DEFAULT_IPFS_URI_SCHEME } from "./config.js";

/** Upload JSON to IPFS and return URI */
export async function uploadJson(
  data: unknown,
  config: IpfsConfig
): Promise<string> {
  const cid = await pinJson(data, config);
  const scheme = config.uriScheme ?? DEFAULT_IPFS_URI_SCHEME;
  return scheme === "https"
    ? `https://ipfs.io/ipfs/${cid}`
    : `ipfs://${cid}`;
}

/** Upload raw bytes/Blob to IPFS and return URI */
export async function uploadFile(
  content: Blob | Uint8Array,
  config: IpfsConfig
): Promise<string> {
  const cid = await pinFile(content, config);
  const scheme = config.uriScheme ?? DEFAULT_IPFS_URI_SCHEME;
  return scheme === "https"
    ? `https://ipfs.io/ipfs/${cid}`
    : `ipfs://${cid}`;
}

async function pinJson(data: unknown, config: IpfsConfig): Promise<string> {
  if (config.provider === "pinata") {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pinata pinJSON failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { IpfsHash: string };
    return json.IpfsHash;
  }

  if (config.provider === "nft.storage") {
    const blob = new Blob([JSON.stringify(data)], {
      type: "application/json",
    });
    const res = await fetch("https://api.nft.storage/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: blob,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NFT.Storage upload failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { value: { cid: string } };
    return json.value.cid;
  }

  throw new Error(`Unknown IPFS provider: ${config.provider}`);
}

async function pinFile(
  content: Blob | Uint8Array,
  config: IpfsConfig
): Promise<string> {
  const blob = content instanceof Blob ? content : new Blob([content]);

  if (config.provider === "pinata") {
    const form = new FormData();
    form.append("file", blob);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pinata pinFile failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { IpfsHash: string };
    return json.IpfsHash;
  }

  if (config.provider === "nft.storage") {
    const res = await fetch("https://api.nft.storage/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: blob,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NFT.Storage upload failed: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { value: { cid: string } };
    return json.value.cid;
  }

  throw new Error(`Unknown IPFS provider: ${config.provider}`);
}
